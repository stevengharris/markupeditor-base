import {keymap} from "prosemirror-keymap"
import {history} from "prosemirror-history"
import {baseKeymap} from "prosemirror-commands"
import {AllSelection, NodeSelection, Plugin} from "prosemirror-state"
import {dropCursor} from "prosemirror-dropcursor"
import {gapCursor} from "prosemirror-gapcursor"
import {Decoration, DecorationSet} from "prosemirror-view"
import {search} from "prosemirror-search"
import {buildMenuItems, markupMenuConfig} from "./menu"
import {buildKeymap, markupKeymapConfig} from "./keymap"
import {toolbar, toolbarView} from "./toolbar"
import {buildInputRules} from "./inputrules"

import {placeholderText, postMessage, selectedID, resetSelectedID, stateChanged, searchIsActive, setPlaceholder} from "../markup"

/**
 * The tablePlugin handles decorations that add CSS styling 
 * for table borders.
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
        stateChanged()
      }
      return srcMap
    }
  },
  props: {
    attributes: (state) => { return imagePlugin.getState(state) }
  }
})

/**
 * A simple plugin to show placeholder text when the document is empty.
 * 
 * The placeholder text is imported from markup.js and is set there via setPlaceholder.
 * 
 * Adapted from https://discuss.prosemirror.net/t/how-to-input-like-placeholder-behavior/705/3
 * 
 * @returns {Plugin}
 */
const placeholderPlugin = new Plugin({
  props: {
    decorations(state) {
      if (!placeholderText) return;   // No need to mess around if we have no placeholder
      const doc = state.doc
      if (doc.childCount == 1 && doc.firstChild.isTextblock && doc.firstChild.content.size == 0) {
        const allSelection = new AllSelection(doc);
        // The attributes are applied to the empty paragraph and styled based on editor.css
        const decoration = Decoration.node(allSelection.from, allSelection.to, {class: 'placeholder', placeholder: placeholderText});
        return DecorationSet.create(doc, [decoration])
      }
    }
  }
})

/**
 * Insert an array of MenuItems or a single MenuItem at the front of the toolbar
 * @param {[MenuItem] | MenuItem} menuItems 
 */
export function prependToolbar(menuItems) {
  let items = Array.isArray(menuItems) ? menuItems : [menuItems];
  toolbarView.prepend(items)
}

/**
 * Append an array of MenuItems or a single MenuItem at the end of the toolbar
 * @param {[MenuItem] | MenuItem} menuItems 
 */
export function appendToolbar(menuItems) {
  let items = Array.isArray(menuItems) ? menuItems : [menuItems];
  toolbarView.append(items)
}

/**
 * Return an array of Plugins used for the MarkupEditor
 * @param {Schema} schema The schema used for the MarkupEditor
 * @returns 
 */
export function markupSetup(schema, config) {
  let prefix = "Markup"
  let menuConfig = config?.menu ? config.menu : markupMenuConfig
  let keymapConfig = config?.keymap ? config.keymap: markupKeymapConfig
  let plugins = [
    buildInputRules(schema),
    keymap(buildKeymap(keymapConfig, schema)),
    keymap(baseKeymap),
    dropCursor(),
    gapCursor(),
  ]

  // Only show the toolbar if the config indicates it is visible
  if (menuConfig.visibility.toolbar) {
    let content = buildMenuItems(prefix, menuConfig, keymapConfig, schema);
    plugins.push(toolbar(prefix, content));
  }

  plugins.push(history())

  // Add the plugin that handles table borders
  plugins.push(tablePlugin);

  // Add the plugin that handles placeholder display for an empty document
  if (config?.placeholder) setPlaceholder(config.placeholder)
  plugins.push(placeholderPlugin)

  // Add the plugin to handle notifying the Swift side of images loading
  plugins.push(imagePlugin)

  // Add the plugins that performs search, decorates matches, and indicates searchmode
  plugins.push(search())
  //TODO: Is this plugin needed when used with Swift. It is not for the browser.
  //plugins.push(searchModePlugin)

  return plugins;
}
