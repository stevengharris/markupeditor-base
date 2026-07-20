import {keymap} from "prosemirror-keymap"
import {history} from "prosemirror-history"
import {baseKeymap} from "prosemirror-commands"
import {AllSelection, NodeSelection, Selection, TextSelection, Plugin} from "prosemirror-state"
import {dropCursor} from "prosemirror-dropcursor"
import {gapCursor} from "prosemirror-gapcursor"
import {Decoration, DecorationSet} from "prosemirror-view"
import {search} from "prosemirror-search"
import {buildMenuItems} from "./menu"
import {buildKeymap} from "./keymap"
import {toolbar, toolbarView} from "./toolbar"
import {buildInputRules} from "./inputrules"
import {prefix, setPrefix, getToolbar} from "../domaccess.js"
import {LinkItem, ImageItem, SearchItem, LanguageDialogItem} from "./menuitems.js"
import {postMessage, searchIsActive, codeLanguageOverlayInfo, codeBlockAtSelection, setCodeLanguageCommand} from "../markup"
import {activeConfig, selectedID} from "../registry.js"
import {highlightSpans, isRecognizedLanguage} from "../highlighting.js"

/**
 * The tablePlugin handles decorations that add CSS styling 
 * for table borders.
 * 
 * @ignore
 */
const tablePlugin = new Plugin({
  state: {
    init(_, {doc}) {
      return DecorationSet.create(doc, [])
    },
    apply(tr, set) {
      if (tr.getMeta('bordered-table')) {
        const {border, fromPos, toPos} = tr.getMeta('bordered-table')
        return DecorationSet.create(tr.doc, [
          Decoration.node(fromPos, toPos, {class: 'bordered-table-' + border})
        ])
      } else if (set) {
        // map other changes so our decoration stays put
        // (e.g. user is typing so decoration's pos must change)
        return set.map(tr.mapping, tr.doc)
      }
    }
  },
  props: {
    decorations: (state) => { return tablePlugin.getState(state) }
  }
})

function decorationsForSpans(pos, spans) {
  return spans.map(({from, to, class: cls}) => Decoration.inline(pos + 1 + from, pos + 1 + to, {class: cls}))
}

// null for anything that isn't a highlightable code_block, so callers can
// skip it (no cache entry, no decorations) with a single check.
function highlightEntryFor(node) {
  const language = node.attrs.language
  if (!language || !isRecognizedLanguage(language)) return null
  return {node, spans: highlightSpans(node.textContent, language)}
}

function computeAllHighlights(doc) {
  const cache = new Map()
  const decorations = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'code_block') return
    const entry = highlightEntryFor(node)
    if (entry) {
      cache.set(pos, entry)
      decorations.push(...decorationsForSpans(pos, entry.spans))
    }
    return false
  })
  return {cache, decorations: DecorationSet.create(doc, decorations)}
}

/**
 * Walk cur's children, comparing against old's, skipping any subtree that's
 * the same node object as before. Bounds cost to the changed region rather
 * than the whole document.
 *
 * @ignore
 */
function changedDescendants(old, cur, offset, f) {
  const oldSize = old.childCount, curSize = cur.childCount
  outer: for (let i = 0, j = 0; i < curSize; i++) {
    const child = cur.child(i)
    for (let scan = j, e = Math.min(oldSize, i + 3); scan < e; scan++) if (old.child(scan) == child) {
      j = scan + 1
      offset += child.nodeSize
      continue outer
    }
    f(child, offset)
    if (j < oldSize && old.child(j).sameMarkup(child)) changedDescendants(old.child(j), child, offset + 1, f)
    else child.nodesBetween(0, child.content.size, f, offset + 1)
    offset += child.nodeSize
  }
}

// Carries cache entries forward by position + Node.eq, not object identity;
// changedDescendants then fills in anything new or actually changed.
function updateHighlights(tr, {cache}) {
  const nextCache = new Map()
  const decorations = []
  const carryForward = (pos, entry) => {
    nextCache.set(pos, entry)
    decorations.push(...decorationsForSpans(pos, entry.spans))
  }

  cache.forEach(({node, spans}, pos) => {
    const mapped = tr.mapping.mapResult(pos)
    if (mapped.deleted) return
    const newNode = tr.doc.nodeAt(mapped.pos)
    if (newNode && newNode.eq(node)) carryForward(mapped.pos, {node: newNode, spans})
  })

  changedDescendants(tr.before, tr.doc, 0, (node, pos) => {
    if (node.type.name !== 'code_block' || nextCache.has(pos)) return
    const entry = highlightEntryFor(node)
    if (entry) carryForward(pos, entry)
  })

  return {cache: nextCache, decorations: DecorationSet.create(tr.doc, decorations)}
}

// Syntax-highlighting decorations for code_block nodes with a registered
// language. Only registered via markupSetup() when highlightCode is on.
export const codeHighlightPlugin = new Plugin({
  state: {
    init(_, {doc}) {
      return computeAllHighlights(doc)
    },
    apply(tr, value) {
      return tr.docChanged ? updateHighlights(tr, value) : value
    }
  },
  props: {
    decorations(state) { return codeHighlightPlugin.getState(state).decorations }
  }
})

/**
 * Approximate rendered height of the language overlay label (font-size 0.75rem +
 * padding 2px 6px, styles/markup.css). Only used for the room-above check below —
 * doesn't need to be pixel-exact, just enough to decide which side to attach to.
 *
 * @ignore
 */
const CODE_LANGUAGE_OVERLAY_HEIGHT = 24

/**
 * Whether there's room above `preDOM` (the code_block's own <pre> element) to show
 * the language overlay label there without it being pushed above the toolbar or
 * off-screen — if not, it should attach below instead. `view.nodeDOM` is used
 * read-only here (getBoundingClientRect only); mutating its result is what caused
 * the CPU-loop regression fixed earlier, so this must never write to preDOM.
 *
 * @ignore
 */
export function hasRoomAboveOverlay(view, preDOM) {
  if (!preDOM) return true
  const preRect = preDOM.getBoundingClientRect()
  const toolbarRect = getToolbar(view)?.getBoundingClientRect()
  const minTop = (toolbarRect?.bottom ?? 0) + CODE_LANGUAGE_OVERLAY_HEIGHT
  return preRect.top >= minTop
}

/**
 * Semi-transparent "Language: <name>" widget Decoration for the selected
 * code_block, if any. A selection lookup plus a string, cheap enough to
 * recompute every transaction with no caching.
 *
 * @ignore
 */
function computeCodeLanguageOverlayDecorations(state, languageDialog) {
  const info = codeLanguageOverlayInfo(state)
  if (!info) return DecorationSet.empty
  const found = codeBlockAtSelection(state)
  if (!found) return DecorationSet.empty
  const widget = Decoration.widget(info.pos, (view) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = prefix + '-code-language-overlay'
    if (!hasRoomAboveOverlay(view, view.nodeDOM(found.pos))) {
      button.classList.add(prefix + '-code-language-overlay-below')
    }
    button.textContent = info.label
    // Without this, the button is ambiguous to the browser's native cursor placement
    // as part of the code_block's editable text flow.
    button.contentEditable = 'false'
    button.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const found = codeBlockAtSelection(view.state)
      languageDialog.open(view, found?.node.attrs.language ?? '', (entered) => {
        setCodeLanguageCommand(entered ? entered : null)(view.state, view.dispatch, view)
      })
    })
    return button
  }, {
    // Negative side keeps domFromPos from ever landing on the widget itself
    // (its domAtom is always true, so side >= 0 can't resolve past it).
    side: -1,
    relaxedSide: true,
    // Keyed so ProseMirror reuses the existing button DOM node (and its click listener)
    // across transactions unrelated to this block, instead of destroying and rebuilding it
    // on every single transaction while a code block is selected (WidgetType.eq() only
    // short-circuits reuse on a spec.key match). The key includes pos and label — not just
    // a static string — so a genuinely different block or language change still gets a
    // fresh toDOM call rather than silently reusing stale button text.
    key: `code-language-overlay-${info.pos}-${info.label}`
  })
  return DecorationSet.create(state.doc, [widget])
}

/**
 * Computes the next ArrowLeft/ArrowRight position from the model and
 * dispatches it directly, instead of trusting native cursor movement.
 *
 * A selection resolved exactly at a widget's own position never renders
 * correctly, and native arrow-key movement doesn't reliably cross that
 * boundary either. Scoped to code_block boundaries by DOCUMENT STRUCTURE
 * (is the current or landing position's parent a code_block), not by
 * decoration presence — an earlier decoration-presence check
 * (hasWidgetAt) was tried and reverted because the widget doesn't exist
 * in decorations until the block is already selected, so there was
 * nothing to detect on the way in. Structure is known independent of
 * decorations/selection, so it doesn't have that chicken-and-egg problem,
 * and it keeps this handler from overriding native RTL/bidi and
 * grapheme-cluster caret movement in ordinary prose, where none of this
 * is needed.
 *
 * @ignore
 */
function handlePlainArrowKeyNavigation(view, event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false
  if (event.shiftKey || event.metaKey || event.altKey || event.ctrlKey) return false
  const { state } = view
  const sel = state.selection
  if (!(sel instanceof TextSelection) || !sel.empty) return false
  const dir = event.key === 'ArrowLeft' ? -1 : 1
  const targetPos = sel.from + dir
  if (targetPos < 0 || targetPos > state.doc.content.size) return false
  const newSel = TextSelection.near(state.doc.resolve(targetPos), dir)
  const currentlyInCodeBlock = sel.$from.parent.type.name === 'code_block'
  const landingInCodeBlock = newSel.$from.parent.type.name === 'code_block'
  if (!currentlyInCodeBlock && !landingInCodeBlock) return false
  view.dispatch(state.tr.setSelection(newSel).scrollIntoView())
  return true
}

/**
 * Build the plugin that shows the selected code_block's language overlay.
 * A factory (not a module-level singleton like codeHighlightPlugin) because it
 * owns a LanguageDialogItem bound to this editor instance's `config` — sharing
 * one across multiple `<markup-editor>` instances on the same page would let
 * one instance's dialog state stomp on another's.
 *
 * @ignore
 */
export function codeLanguageOverlayPlugin(config) {
  const languageDialog = new LanguageDialogItem(config)
  const thePlugin = new Plugin({
    state: {
      init() {
        return DecorationSet.empty
      },
      apply(tr, set, oldState, newState) {
        return computeCodeLanguageOverlayDecorations(newState, languageDialog)
      }
    },
    props: {
      decorations(state) { return thePlugin.getState(state) },
      handleKeyDown: handlePlainArrowKeyNavigation
    }
  })
  return thePlugin
}

/**
 * Character inserted into a code_block whenever it would otherwise be
 * genuinely empty (content.size === 0), so it never actually is.
 *
 * A plain empty textblock is fine on its own — prosemirror-view's own
 * addTextblockHacks (NodeViewDesc.addTextblockHacks) inserts a trailing
 * <br class="ProseMirror-trailingBreak"> to keep it natively selectable,
 * and that alone works correctly (a <p></p> with nothing else needs
 * exactly this, and gets it). The problem is specific to a code_block
 * that's ALSO showing a widget (this plugin's own Language tab, or a
 * downstream plugin's, e.g. the mermaid plugin's Source/Diagram tabs):
 * addTextblockHacks's own check is `lastChild.dom.contentEditable ==
 * "false"` — unconditional, no decoration-spec flag exempts a widget from
 * it — and when a widget is the block's only content, IT is lastChild.
 * That additionally inserts an <img class="ProseMirror-separator">, and
 * that separator is an UNCONDITIONAL native-selection barrier (scanFor's
 * atomElements regex matches any <img>, no relaxedSide exception).
 * Confirmed via real Safari testing: with the widget showing on a
 * genuinely empty code_block, a real keystroke lands in the PRECEDING
 * block instead of the code_block, silently.
 *
 * Guaranteeing real content sidesteps addTextblockHacks's check entirely
 * (lastChild becomes a real TextViewDesc, not the widget) — a widget
 * followed by real text is the normal, already-working shape every
 * non-empty code_block already has.
 *
 * A single regular space, not a zero-width one — a zero-width character
 * is real content that keeps content.size > 0, but the caret produces NO
 * visible movement crossing it, which reads as broken/unresponsive to a
 * user pressing an arrow key. A plain space moves the caret visibly, the
 * same as it would across any other single character, and (unlike a
 * zero-width space) is already stripped by plain .trim() — no downstream
 * "is this code_block meaningfully empty" check needs updating to know
 * about it specially.
 *
 * Not exported from this package's public surface (see this file's own
 * changedDescendants-style precedent in downstream plugins) — a consumer
 * needing the same "is this code_block meaningfully empty" check (e.g.
 * markupeditor-mermaid.js) already gets it for free via .trim(), so no
 * cross-package constant sharing is actually needed here.
 *
 * @ignore
 */
export const EMPTY_CODE_BLOCK_PLACEHOLDER = ' '

/**
 * Keeps EMPTY_CODE_BLOCK_PLACEHOLDER's invariant true: every code_block
 * either has real (non-placeholder) content, or contains ONLY the
 * placeholder — never truly empty, and never the placeholder coexisting
 * with real content for more than the one transaction it takes to notice.
 * Runs via appendTransaction (not apply()) because it needs to react to
 * the FINAL doc a transaction produces and possibly fold in one more
 * step, atomically, before the state settles.
 *
 * Two fixups:
 *  - Insertion: any code_block that's genuinely empty in the FINAL doc
 *    (content.size === 0) — a fresh conversion of an already-empty
 *    paragraph, or the user backspaced out everything. Checked against
 *    every code_block; there's no history-dependence here, an empty
 *    code_block should always get the placeholder regardless of how it
 *    got that way.
 *  - Stripping: scoped to code_blocks whose content was EXACTLY the
 *    placeholder in oldState (mapped forward through this transaction's
 *    own steps to find where that same block ended up) — NOT a blind
 *    "does this code_block's current text contain a space anywhere"
 *    check. That distinction matters: a pre-existing, legitimate
 *    code_block containing real spaces (e.g. "function foo() {}") must
 *    never have a character silently deleted from it just because some
 *    UNRELATED edit elsewhere in the document triggered this plugin's
 *    appendTransaction. Only a block that was JUST a lone placeholder
 *    moments ago is eligible to have it stripped.
 *
 * Each fixup's position is mapped through the accumulating transaction's
 * own mapping before being applied, so multiple code_blocks needing a
 * fixup in the same transaction (e.g. a multi-block paste) are all
 * handled correctly in one appendTransaction call, not just the first.
 *
 * Selection placement on insertion: the placeholder is inserted AT the
 * position selection would otherwise land, which — left to
 * insertText's own default "push the cursor past what was just
 * inserted" mapping — puts the cursor AFTER the placeholder space, not
 * before it. Visually that reads as the caret sitting to the right of a
 * blank space for no reason, which looks wrong; a block that's
 * conceptually still empty should have its cursor at the very start,
 * the same place native Home/click-at-start lands on any other empty
 * or non-empty textblock. So the fixup, when it discovers the doc's
 * OTHER (pre-fixup) selection was already exactly at the insertion
 * point — i.e. this specific block is the one actually being
 * interacted with, not some unrelated empty code_block elsewhere in
 * the document this same appendTransaction also happens to fix up —
 * explicitly resets selection to the placeholder's start afterward.
 *
 * @ignore
 */
export const emptyCodeBlockPlaceholderPlugin = new Plugin({
  appendTransaction(transactions, oldState, newState) {
    // Deliberately NOT gated on tr.docChanged (matching
    // computeCodeLanguageOverlayDecorations's own "recomputed on every
    // transaction" choice) — a document can LOAD with an already-empty
    // code_block, or the user can select into one, with no doc-changing
    // transaction involved at all; appendTransaction still runs for a
    // selection-only transaction, and that's the only hook available for
    // fixing up a document that was already in this state before this
    // plugin ever got a chance to react (EditorState.create()'s own
    // init() has no equivalent of appendTransaction to hang this on).
    const fixups = []
    newState.doc.descendants((node, pos) => {
      if (node.type.name === 'code_block' && node.content.size === 0) {
        // Only this specific block's insertion should claim the cursor —
        // compared against newState.selection (the doc/selection this
        // appendTransaction is reacting to, before any of ITS OWN steps),
        // not some later, already-mapped position.
        const claimsSelection = newState.selection.empty && newState.selection.from === pos + 1
        fixups.push({ insertAt: pos + 1, claimsSelection })
      }
    })
    oldState.doc.descendants((node, oldPos) => {
      if (node.type.name !== 'code_block' || node.textContent !== EMPTY_CODE_BLOCK_PLACEHOLDER) return
      // Track the placeholder CHARACTER's own position through the mapping (not the
      // block's position, and not a text search over the block's new content) — an
      // indexOf-based search can't tell "the surviving placeholder" apart from a
      // coincidental space introduced by whatever was just typed or pasted (e.g.
      // pasting "graph TD" over/before the placeholder: naively stripping the first
      // space found deletes the one between "graph" and "TD" instead). If any step
      // deletes the placeholder's own position, it was consumed by the edit (e.g. a
      // paste that replaced the selected placeholder) and there's nothing left to strip.
      let charPos = oldPos + 1
      let consumed = false
      for (const tr of transactions) {
        const result = tr.mapping.mapResult(charPos, 1)
        if (result.deleted) { consumed = true; break }
        charPos = result.pos
      }
      if (consumed) return
      const newNode = newState.doc.nodeAt(newState.doc.resolve(charPos).before())
      if (!newNode || newNode.type.name !== 'code_block' || newNode.textContent === EMPTY_CODE_BLOCK_PLACEHOLDER) return
      if (newState.doc.textBetween(charPos, charPos + 1) !== EMPTY_CODE_BLOCK_PLACEHOLDER) return
      fixups.push({ deleteFrom: charPos, deleteTo: charPos + 1 })
    })
    if (fixups.length === 0) return null
    const tr = newState.tr
    for (const fixup of fixups) {
      if (fixup.insertAt !== undefined) {
        const mappedPos = tr.mapping.map(fixup.insertAt)
        tr.insertText(EMPTY_CODE_BLOCK_PLACEHOLDER, mappedPos)
        if (fixup.claimsSelection) {
          tr.setSelection(Selection.near(tr.doc.resolve(mappedPos)))
        }
      } else {
        tr.delete(tr.mapping.map(fixup.deleteFrom), tr.mapping.map(fixup.deleteTo))
      }
    }
    return tr
  }
})

const searchModePlugin  = new Plugin({
  state: {
    init(_, {doc}) {
      return DecorationSet.create(doc, [])
    },
    apply(tr, set) {
      if (tr.getMeta('search$')) {
        if (searchIsActive()) {
          const nodeSelection = new NodeSelection(tr.doc.resolve(0));
          const decoration = Decoration.node(nodeSelection.from, nodeSelection.to, {class: 'searching'})
          return DecorationSet.create(tr.doc, [decoration])
        }
      } else if (set) {
        // map other changes so our decoration stays put 
        // (e.g. user is typing so decoration's pos must change)
        return set.map(tr.mapping, tr.doc)
      }
    }
  },
  props: {
    decorations: (state) => { return searchModePlugin.getState(state) }
  }
}) 

/**
 * The imagePlugin handles the interaction with the Swift side that we need for images.
 * Specifically, we want notification that an image was added at load time, but only once. 
 * The loaded event can fire multiple times, both when the initial ImageView is created 
 * as an img element is found, but also whenever the ImageView is recreated. This happens
 * whenever we resize and image and dispatch a transaction to update its state.
 * 
 * We want a notification on the Swift side for the first image load, because when we insert 
 * a new image, that new image is placed in cached storage but has not been saved for the doc.
 * This is done using postMessage to send 'addedImage', identifying the src. However, we don't 
 * want to tell the Swift side we added an image every time we resize it. To deal with this 
 * problem, we set 'imageLoaded' metadata in the transaction that is dispatched on at load. The 
 * first time, we update the Map held in the imagePlugin. When we resize, the image loads again 
 * as the ImageView gets recreated, but in the plugin, we can check the Map to see if we already 
 * loaded it once and avoid notifying the Swift side multiple times.
 * 
 * The Map is keyed by the src for the image. If the src is duplicated in the document, we only 
 * get one 'addedImage' notification.
 * 
 * @ignore
 */
const imagePlugin = new Plugin({
  state: {
    init() {
      return new Map()
    },
    apply(tr, srcMap) {
      if (tr.getMeta('imageLoaded')) {
        const src = tr.getMeta('imageLoaded').src
        const srcIsLoaded = srcMap.get(src) == true
        if (!srcIsLoaded) {
          srcMap.set(src, true)
          postMessage({ 'messageType': 'addedImage', 'src': src, 'divId': (selectedID ?? '') });
        }
          // We already notified of a state change, and this one causes callbackInput which 
          // is used to track changes
          //stateChanged();
      }
      return srcMap
    }
  },
  props: {
    attributes: (state) => { return imagePlugin.getState(state) }
  }
})

/**
 * Insert an array of MenuItems or a single MenuItem at the front of the toolbar.
 * 
 * @ignore
 * @param {Array<MenuItem> | MenuItem} menuItems 
 */
export function prependToolbar(menuItems) {
  let items = Array.isArray(menuItems) ? menuItems : [menuItems];
  toolbarView.prepend(items)
}

/**
 * Append an array of MenuItems or a single MenuItem at the end of the toolbar
 * 
 * @ignore
 * @param {Array<MenuItem> | MenuItem} menuItems 
 */
export function appendToolbar(menuItems) {
  let items = Array.isArray(menuItems) ? menuItems : [menuItems];
  toolbarView.append(items)
}

/**
 * Toggle the search bar off and on.
 */
export function toggleSearch() {
  let searchItem = new SearchItem(activeConfig())
  // TODO: How to not rely on toolbarView being present
  let view = toolbarView.editorView
  searchItem.toggleSearch(view.state, view.dispatch, view)
}

/**
 * Open the default dialog to insert/edit links.
 */
export function openLinkDialog() {
  let linkItem = new LinkItem(activeConfig())
  let view = toolbarView.editorView
  linkItem.openDialog(view.state, view.dispatch, view)
}

/**
 * Open the default dialog to insert/edit images.
 */
export function openImageDialog() {
  let imageItem = new ImageItem(activeConfig())
  let view = toolbarView.editorView
  imageItem.openDialog(view.state, view.dispatch, view)
}

/**
 * Return an array of Plugins used for the MarkupEditor
 * @ignore
 * @param {Schema} schema The schema used for the MarkupEditor
 * @returns {Array<Plugin>}
 */
export function markupSetup(config, schema) {
  setPrefix('Markup')
  let plugins = [
    buildInputRules(schema),
    keymap(buildKeymap(config, schema)),
    keymap(baseKeymap),
    dropCursor(),
    gapCursor(),
  ]

  // Always build the toolbar, but only show it if the config indicates it is visible
  let content = buildMenuItems(config, schema)
  plugins.push(toolbar(content, config.toolbar.visibility.toolbar))

  plugins.push(history())

  // Add the plugin that handles table borders
  plugins.push(tablePlugin);

  // Keeps code_blocks from ever being genuinely empty — see
  // emptyCodeBlockPlaceholderPlugin's own comment. Registered unconditionally
  // (not gated behind highlightCode): the invariant it maintains is useful to
  // ANY plugin that might show a widget on a selected code_block, not just
  // codeLanguageOverlayPlugin below — e.g. the mermaid plugin's own Source/
  // Diagram tabs, added independently, outside this config.
  plugins.push(emptyCodeBlockPlaceholderPlugin)

  // Add the plugins that highlight code blocks and show the selected block's
  // language overlay, if enabled in behavior config
  if (config.behavior.highlightCode) {
    plugins.push(codeHighlightPlugin)
    plugins.push(codeLanguageOverlayPlugin(config))
  }

  // Add the plugin that handles placeholder display for an empty document, as passed in config
  // Adapted from https://discuss.prosemirror.net/t/how-to-input-like-placeholder-behavior/705/3
  const placeholderPlugin = new Plugin({
    props: {
      decorations(state) {
        const doc = state.doc
        if (doc.childCount == 1 && doc.firstChild.isTextblock && doc.firstChild.content.size == 0) {
          const allSelection = new AllSelection(doc);
          // The attributes are applied to the empty paragraph and styled based on editor.css
          const decoration = Decoration.node(allSelection.from, allSelection.to, { class: 'placeholder', placeholder: this.spec.props.placeholder });
          return DecorationSet.create(doc, [decoration])
        }
      },
      placeholder: config.placeholder
    }
  })
  plugins.push(placeholderPlugin)

  // Add the plugin to handle notifying the Swift side of images loading
  plugins.push(imagePlugin)

  // Add the plugins that performs search, decorates matches, and indicates searchmode
  plugins.push(search())
  //TODO: Is this plugin needed when used with Swift. It is not for the browser.
  //plugins.push(searchModePlugin)

  return plugins;
}
