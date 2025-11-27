import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {DOMParser} from "prosemirror-model"
import {schema} from "./schema/index.js"
import {markupSetup} from "./setup/index.js"

import {
  setTopLevelAttributes,
  setMessageHandler,
  loadUserFiles,
  searchFor,
  deactivateSearch,
  cancelSearch,
  pasteText,
  pasteHTML,
  emptyDocument,
  getHTML,
  getTestHTML,
  setHTML,
  setTestHTML,
  getHeight,
  padBottom,
  focus,
  focusOn,
  resetSelection,
  addDiv,
  removeDiv,
  addButton,
  removeButton,
  removeAllDivs,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleCode,
  toggleStrike,
  toggleSubscript,
  toggleSuperscript,
  setStyle,
  replaceStyle,
  toggleListItem,
  indent,
  outdent,
  startModalInput,
  endModalInput,
  getSelectionState,
  selectionChanged,
  callbackInput,
  clicked,
  doUndo,
  doRedo,
  resetSelectedID,
  outermostOfTypeAt,
  testBlockquoteEnter,
  testListEnter,
  testExtractContents,
  testPasteHTMLPreprocessing,
  testPasteTextPreprocessing,
  insertLink,
  deleteLink,
  getDataImages,
  savedDataImage,
  insertImage,
  modifyImage,
  cutImage,
  insertTable,
  addRow,
  addCol,
  addHeader,
  deleteTableArea,
  borderTable,
  handleEnter,
  focused,
  blurred,
} from "./markup.js"

import {LinkView} from "./nodeview/linkview.js"
import {ImageView} from "./nodeview/imageview.js"
import {DivView} from "./nodeview/divview.js"

import {Searcher} from "./searcher.js"

import {
  registerEditor,
  unregisterEditor,
  activeEditor,
  registerDelegate,
  getDelegate,
  registerConfig,
  activeConfig,
  getConfig,
  registerMessageHandler,
  getMessageHandler,
  registerAugmentation,
  getAugmentation,
  setActiveView,
} from "./registry.js"

import { 
  MenuItem,
  Dropdown, 
  DropdownSubmenu, 
  cmdItem,
  renderGrouped,
  renderDropdownItems
 } from "./setup/menuitems.js"

import {ToolbarConfig} from "./config/toolbarconfig.js"
import {KeymapConfig} from "./config/keymapconfig.js"
import {BehaviorConfig} from "./config/behaviorconfig.js"

import { 
  prependToolbar, 
  appendToolbar,
  toggleSearch,
  openLinkDialog,
  openImageDialog
} from "./setup/index.js"

import {MessageHandler} from "./messagehandler.js"
import {toolbarView} from "./setup/toolbar.js"

/**
 * The public MarkupEditor API callable as "MU.<function name>"
 */
export {
  setTopLevelAttributes,
  setMessageHandler,
  loadUserFiles,
  searchFor,
  deactivateSearch,
  cancelSearch,
  pasteText,
  pasteHTML,
  emptyDocument,
  getHTML,
  getTestHTML,
  setHTML,
  setTestHTML,
  getHeight,
  padBottom,
  focus,
  focusOn,
  resetSelection,
  addDiv,
  removeDiv,
  addButton,
  removeButton,
  removeAllDivs,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleCode,
  toggleStrike,
  toggleSubscript,
  toggleSuperscript,
  setStyle,
  replaceStyle,
  toggleListItem,
  indent,
  outdent,
  startModalInput,
  endModalInput,
  getSelectionState,
  doUndo,
  doRedo,
  testBlockquoteEnter,
  testListEnter,
  testExtractContents,
  testPasteHTMLPreprocessing,
  testPasteTextPreprocessing,
  openLinkDialog,
  insertLink,
  deleteLink,
  getDataImages,
  savedDataImage,
  openImageDialog,
  insertImage,
  modifyImage,
  cutImage,
  insertTable,
  addRow,
  addCol,
  addHeader,
  deleteTableArea,
  borderTable,
  // Allow access to the MarkupEditor class and the instance config
  MarkupEditor,
  // Helpers to create custom toolbar items
  MenuItem, 
  Dropdown, 
  DropdownSubmenu, 
  cmdItem, 
  renderGrouped, 
  renderDropdownItems,
  toolbarView,
  toggleSearch,
  // Helpers to add items to the toolbar
  prependToolbar, 
  appendToolbar,
  // Config access
  ToolbarConfig,
  KeymapConfig,
  BehaviorConfig,
  // muRegistry access
  activeEditor,
  registerDelegate,
  registerConfig,
  registerMessageHandler,
  getMessageHandler,
  activeConfig,
  registerAugmentation,
  getAugmentation,
  setActiveView,
}

/**
 * The MarkupEditor holds the properly set-up EditorView and any additional configuration.
 * 
 * @param {HTMLElement} target  The div that will contain the editor.
 * @param {Object}      config  The configuration object. See the Developer's Guide.
 */
class MarkupEditor {
  constructor(target, config) {

    // We will be creating an EditorView in the `target` element, which should be a DIV
    // with `id` set to "editor".
    this.element = target ?? document.querySelector("#editor")

    // Make sure config always contains `toolbar`, `keymap`, and `behavior`.
    // The three configurations can be specified by string name that is 
    // dereferenced to an instance using `getConfig`, or as an instance
    // modeled on ToolbarConfig, KeymapConfig, or BehaviorConfig.
    this.config = config ?? {}

    // Toolbar configuration
    let toolbarConfig = this.config.toolbar
    if (toolbarConfig) {
      if (typeof toolbarConfig === 'string') {
        this.config.toolbar = getConfig(toolbarConfig)
      } else {
        this.config.toolbar = toolbarConfig
      }
    } else {
      this.config.toolbar = ToolbarConfig.standard()
    }

    // Keymap configuration
    let keymapConfig = this.config.keymap
    if (keymapConfig) {
      if (typeof keymapConfig === 'string') {
        this.config.keymap = getConfig(keymapConfig)
      } else {
        this.config.keymap = keymapConfig
      }
    } else {
      this.config.keymap = KeymapConfig.standard()
    }

    // Behavior configuration
    let behaviorConfig = this.config.behavior
    if (behaviorConfig) {
      if (typeof behaviorConfig === 'string') {
        this.config.behavior = getConfig(behaviorConfig)
      } else {
        this.config.behavior = behaviorConfig
      }
    } else {
      this.config.behavior = BehaviorConfig.standard()
    }

    // If `delegate` is supplied as a string, then dereference it to get the class from muRegistry.
    let delegate = this.config.delegate
    if (delegate && (typeof delegate === 'string')) {
      this.config.delegate = getDelegate(delegate)
    }

    // Create the EditorView for this MarkupEditor
    this.view = new EditorView(this.element, {
      state: EditorState.create({
        // For the MarkupEditor, we can just use the editor element. 
        // There is no need to use a separate content element.
        doc: DOMParser.fromSchema(schema).parse(this.element),
        plugins: markupSetup(this.config, schema)
      }),
      nodeViews: {
        link(node, view, getPos) { return new LinkView(node, view, getPos)},
        image(node, view, getPos) { return new ImageView(node, view, getPos) },
        div(node, view, getPos) { return new DivView(node, view, getPos) },
      },
      // All text input makes callbacks to indicate the document state has changed.
      // For history, used handleTextInput, but that fires *before* input happens.
      // Note the `setTimeout` hack is used to have the function called after the change
      // for things things other than the `input` event.
      handleDOMEvents: {
        'input': () => { callbackInput(target) },
        'focus': () => { setTimeout(() => focused(this.element))},
        'blur': () => { setTimeout(() => blurred(this.element))},
        'cut': () => { setTimeout(() => { callbackInput(this.element) }, 0) },
        'click': (view) => { setTimeout(() => { clicked(view, this.element) }, 0) },
        'delete': () => { setTimeout(() => { callbackInput(this.element) }, 0) },
      },
      handlePaste() {
        setTimeout(() => { callbackInput(this.element) }, 0)
        return false
      },
      handleKeyDown(view, event) {
        switch (event.key) {
          case 'Enter':
          case 'Delete':
          case 'Backspace':
            { setTimeout(() => { handleEnter() }, 0) }
        }
        return false
      },
      // Use createSelectionBetween to handle selection and click both.
      // We need access to `this.editor` for `selectionChanged`.
      // We use it guard against selecting across divs.
      createSelectionBetween: this.createSelectionBetween.bind(this)
    })

    // The `messageHandler` is specific to this `editor` and is accessible from 
    // `activeMessageHandler()` or directly from an editor instance. It can 
    // be passed-in as a string that is dereferenced from the registry using 
    // `getMessageHandler` by name, or as an instance. In any case, the 
    // expectation is that there will be a MessageHandler of some kind to 
    // receive `postMessage`.
    let messageHandler = this.config.messageHandler
    if (messageHandler) {
      if (typeof messageHandler === 'string') {
        this.messageHandler = getMessageHandler(messageHandler)
      } else {
        this.messageHandler = messageHandler
      }
    } else {
      this.messageHandler = new MessageHandler(this)
    }

    // Assign a generated `muId` to the document or shadow root. We can get 
    // `muId` from the `view.root.muId` if we have `view`, or directly from the `editor`.
    // Note `muId` is distinct from the `id` of the editor div or the web component id 
    // if that is set.
    this.muId = this.generateMuId()
    this.view.root.muId = this.muId

    // Track the Searcher instance for this editor, using the same muId
    this.searcher = new Searcher()

    // Track the ID of the selected contentEditable element (relevant when 
    // there is more than one; otherwise is `editor` or null)
    this.selectedID = null

    // Finally, track the editor in the muRegistry.
    registerEditor(this)
  }

  createSelectionBetween(view, $anchor, $head) {
    const divType = view.state.schema.nodes.div;
    const range = $anchor.blockRange($head);
    // Find the divs that the anchor and head reside in.
    // Both, one, or none can be null.
    const fromDiv = outermostOfTypeAt(divType, range.$from);
    const toDiv = outermostOfTypeAt(divType, range.$to);
    // If selection is all within one div, then default occurs; else return existing selection
    if ((fromDiv || toDiv) && !$anchor.sameParent($head)) {
      if (fromDiv != toDiv) {
        return view.state.selection;    // Return the existing selection
      }
    };
    resetSelectedID(fromDiv?.attrs.id ?? toDiv?.attrs.id ?? null)  // Set the selectedID to the div's id or null.
    selectionChanged(this.element);
    // clicked(); // TODO: Removed, but is it needed in Swift MarkupEditor?
    return null;                        // Default behavior should occur
  }

  /* Return a string ID we can use for this MarkupEditor */
  generateMuId() {
    const timestamp = Date.now().toString(36); // Convert timestamp to base36
    const randomPart = Math.random().toString(36).substring(2, 7); // Add a short random string
    return timestamp + randomPart;
}

  /**
   * Destroy the EditorView we are holding onto and remove it from the `muRegistry`.
   */
  destroy() {
    unregisterEditor(this)
    this.view.destroy()
  }
}