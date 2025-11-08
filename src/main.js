import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {DOMParser} from "prosemirror-model"
import {schema} from "./schema/index.js"
import {markupSetup} from "./setup/index.js"

import {
  DivView,
  ImageView,
  LinkView,
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
  isChanged,
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

import { 
  MenuItem,
  Dropdown, 
  DropdownSubmenu, 
  cmdItem,
  renderGrouped,
  renderDropdownItems
 } from "./setup/menuitems.js"

import {ToolbarConfig} from "./setup/toolbarconfig.js"
import {KeymapConfig} from "./setup/keymapconfig.js"
import {BehaviorConfig} from "./setup/behaviorconfig.js"

import { 
  prependToolbar, 
  appendToolbar,
  toggleSearch,
  openLinkDialog,
  openImageDialog
} from "./setup/index.js"

import {MessageHandler} from "./messagehandler.js"
import {toolbarView} from "./setup/toolbar.js"

import { 
  getMarkupEditorConfig, 
  setMarkupEditorConfig,
  generateShortId,
 } from "./setup/utilities.js"

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
  isChanged,
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
  getMarkupEditorConfig,
  setMarkupEditorConfig
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

    // Make sure config always contains menu, keymap, and behavior
    this.config = config ?? {}
    if (!this.config.toolbar) this.config.toolbar = ToolbarConfig.standard()
    if (!this.config.keymap) this.config.keymap = KeymapConfig.standard()
    if (!this.config.behavior) this.config.behavior = BehaviorConfig.standard()
    setMarkupEditorConfig(this.config)

    // There is only one `schema` for the window, not a separate one for each MarkupEditor instance.
    window.schema = schema

    // Retain an ID for this MarkupEditor and identify the view using it, too. The view will be 
    // reachable from the window.viewRegistry by this ID.
    this.id = config.id ?? generateShortId()

    // Set up the global `messageHandler` if the element is *not* in the shadow DOM (i.e., 
    // we are not using the MarkupEditorElement web component). In that case, there is only 
    // one view and it uses a single instance of MessageHandler, either passed-in as part 
    // of the `config`, or created here using the default MessageHandler. We communicate 
    // with the MessageHandler using `postMessage`.
    // When we are using one or more MarkupEditorElements, we communicate with the individual 
    // MarkupEditor instances using a `muCallback` CustomEvent that each editor element listens 
    // for and can take appropriate action for only that element in the shadow DOM, rather than 
    // for one in window.document.
    const globalHandler = (this.element.getRootNode() instanceof ShadowRoot) ? null : new MessageHandler(this)
    this.messageHandler = this.config.messageHandler ?? globalHandler
    setMessageHandler(this.messageHandler)

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
        'input': (view, e) => { callbackInput(e.target) },
        'focus': (view, e) => { setTimeout(() => focused(e.target))},
        'blur': (view, e) => { setTimeout(() => blurred(e.target))},
        'cut': (view, e) => { setTimeout(() => { callbackInput(e.target) }, 0) },
        'click': (view, e) => { setTimeout(() => { clicked(view, e.target) }, 0) },
        'delete': (view, e) => { setTimeout(() => { callbackInput(e.target) }, 0) },
      },
      handlePaste() {
        setTimeout(() => { callbackInput() }, 0)
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
      // Here we guard against selecting across divs.
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
        selectionChanged(view.dom.getRootNode());
        // clicked(); // TODO: Removed, but is it needed in Swift MarkupEditor?
        return null;                        // Default behavior should occur
      }
    })

    // Make the config visible to the view. This way when we have more than one view, we can use 
    // the config specific to it (e.g., a placeholder when contents is empty)
    this.view.config = this.config

    // Track the view by `id` in the global `window.viewRegistry`.
    this.registerView(this.view, this.id)
  }

  /**
   * Hold onto the EditorView instance in the `window.viewRegistry` using `id`.
   * @param {EditorView} view 
   * @param {String} id 
   */
  registerView(view, id) {
    if (typeof window.viewRegistry == 'undefined') {
      window.viewRegistry = {}
    }
    window.viewRegistry[id] = view
  }

  /**
   * Destroy the EditorView we are holding onto and remove it from the `window.viewRegistry`.
   */
  destroy() {
    delete window.viewRegistry[this.id]
    this.view.destroy()
  }
}