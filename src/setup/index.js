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
import {setPrefix} from "../domaccess.js"
import {LinkItem, ImageItem, SearchItem} from "./menuitems.js"
import {postMessage, searchIsActive, codeBlockAtSelection} from "../markup"
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
 * Return the plugin that shows the selected code_block's language tab (owned
 * by its CodeView NodeView, ../nodeview/codeview.js).
 *
 * @ignore
 */
export function codeLanguageTabPlugin() {
  return new Plugin({
    view(editorView) {
      let activeCodeView = null
      // A pure selection-only transaction never calls a NodeView's own
      // update(), so this reaches the CodeView directly via view.nodeDOM(pos)
      // instead.
      const sync = (view) => {
        const found = codeBlockAtSelection(view.state)
        const nextCodeView = found ? view.nodeDOM(found.pos)?.codeView : null
        if (nextCodeView === activeCodeView) return
        activeCodeView?.setActive(false)
        nextCodeView?.setActive(true)
        activeCodeView = nextCodeView
      }
      sync(editorView)
      return { update: sync }
    }
  })
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
  // language tab, if enabled in behavior config
  if (config.behavior.highlightCode) {
    plugins.push(codeHighlightPlugin)
    plugins.push(codeLanguageTabPlugin())
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
