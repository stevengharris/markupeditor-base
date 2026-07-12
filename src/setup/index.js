import {keymap} from "prosemirror-keymap"
import {history} from "prosemirror-history"
import {baseKeymap} from "prosemirror-commands"
import {AllSelection, NodeSelection, Plugin} from "prosemirror-state"
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
import {hljs} from "../highlighting.js"

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

const codeHighlightCache = new WeakMap()

/**
 * Convert an hljs-highlighted HTML string into a list of {from, to, class}
 * ranges relative to the start of the original plain-text code, by building
 * a detached element via innerHTML (not the global DOMParser class, whose
 * separate parseFromString implementation is less consistently supported
 * across environments than innerHTML) and walking its child nodes.
 *
 * @ignore
 */
function highlightSpecs(code, language) {
  let html
  try {
    html = hljs.highlight(code, {language, ignoreIllegals: true}).value
  } catch {
    return []
  }
  const container = document.createElement('div')
  container.innerHTML = html
  const specs = []
  let offset = 0
  function walk(parent) {
    parent.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        offset += child.textContent.length
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const start = offset
        walk(child)
        const cls = child.getAttribute('class')
        if (cls) specs.push({from: start, to: offset, class: cls})
      }
    })
  }
  walk(container)
  return specs
}

/**
 * Walk doc for code_block nodes with a registered language and build a
 * DecorationSet highlighting each one, using a WeakMap cache keyed by node
 * identity so unchanged blocks (same node reference across transactions,
 * per ProseMirror's persistent-tree structural sharing) are never re-run
 * through hljs.highlight().
 *
 * @ignore
 */
function computeCodeHighlightDecorations(doc) {
  const decorations = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'code_block') return
    const language = node.attrs.language
    if (!language || !hljs.getLanguage(language)) return
    let specs = codeHighlightCache.get(node)
    if (!specs) {
      specs = highlightSpecs(node.textContent, language)
      codeHighlightCache.set(node, specs)
    }
    specs.forEach(({from, to, class: cls}) => {
      decorations.push(Decoration.inline(pos + 1 + from, pos + 1 + to, {class: cls}))
    })
    return false
  })
  return DecorationSet.create(doc, decorations)
}

/**
 * Walk cur's children, comparing against old's, skipping any subtree that's
 * the same node object as before (ProseMirror's persistent-tree structural
 * sharing means an unchanged subtree is reference-identical). Only visits
 * nodes in the changed region, so cost is bounded by how much of the doc
 * actually changed rather than the whole document.
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

/**
 * The codeHighlightPlugin applies syntax-highlighting decorations to
 * code_block nodes whose language is registered in highlighting.js's hljs
 * instance. Only registered via markupSetup() when the highlightCode
 * behavior setting is on.
 *
 * @ignore
 */
export const codeHighlightPlugin = new Plugin({
  state: {
    init(_, {doc}) {
      return computeCodeHighlightDecorations(doc)
    },
    apply(tr, set) {
      if (!tr.docChanged) return set
      let touchedCodeBlock = false
      const checkCodeBlock = (node) => {
        if (node.type.name === 'code_block') touchedCodeBlock = true
      }
      // Check both directions: a code_block added/changed in the new doc, and one
      // removed (e.g. by undoing a paragraph->code_block conversion) from the old
      // doc. changedDescendants(old, cur, ...) only ever visits cur's children, so
      // catching removal requires calling it again with old/new swapped.
      changedDescendants(tr.before, tr.doc, 0, checkCodeBlock)
      if (!touchedCodeBlock) changedDescendants(tr.doc, tr.before, 0, checkCodeBlock)
      if (!touchedCodeBlock) return set.map(tr.mapping, tr.doc)
      return computeCodeHighlightDecorations(tr.doc)
    }
  },
  props: {
    decorations(state) { return codeHighlightPlugin.getState(state) }
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
 * Compute the semi-transparent "Language: <name>" widget Decoration for the
 * selected code_block, if any. Recomputed on every transaction — this is only
 * a selection lookup plus a string, not a doc walk, so unlike
 * computeCodeHighlightDecorations there's no need to cache or gate on
 * tr.docChanged.
 *
 * @ignore
 */
function computeCodeLanguageOverlayDecorations(state, languageDialog) {
  const info = codeLanguageOverlayInfo(state)
  if (!info) return DecorationSet.empty
  // An empty code_block's only content would become this widget's contentEditable=false
  // button — the exact "non-editable content alone in a textblock" case prosemirror-view
  // itself flags as fragile in Safari/Chrome (addTextblockHacks, working around Safari
  // bug #1165 and Chrome bug #1152). Skip the overlay until there's actual code; there's
  // nothing useful to show a language badge over yet anyway.
  const found = codeBlockAtSelection(state)
  if (!found || found.node.content.size === 0) return DecorationSet.empty
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
    side: 1,
    // By default the cursor at the widget's position is strictly kept on the
    // `side` indicated above, and per prosemirror-view's own docs "keyboard
    // cursor motion will not, without further custom handling, visit both
    // sides of the widget" — which is what broke placing/moving the cursor to
    // a code_block's start. relaxedSide lets the DOM selection land on either
    // side instead of being force-pinned to one.
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
      decorations(state) { return thePlugin.getState(state) }
    }
  })
  return thePlugin
}

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
