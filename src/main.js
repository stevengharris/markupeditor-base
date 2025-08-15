import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {DOMParser} from "prosemirror-model"
import {schema} from "./schema/index.js"
import {markupSetup} from "./setup/index.js"

import {
  DivView,
  ImageView,
  setTopLevelAttributes,
  setMessageHandler,
  loadUserFiles,
  searchFor,
  deactivateSearch,
  cancelSearch,
  pasteText,
  pasteHTML,
  emptyDocument,
  emptyHTML,
  getHTML,
  getTestHTML,
  isChanged,
  setHTML,
  setTestHTML,
  setPlaceholder,
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
} from "./markup.js"

import { 
  MenuItem, 
  Dropdown, 
  DropdownSubmenu, 
  cmdItem, 
  renderGrouped, 
  renderDropdownItems,
} from "./setup/menu.js"

import {ToolbarConfig} from "./setup/toolbarconfig.js"
import {KeymapConfig} from "./setup/keymapconfig.js"
import {BehaviorConfig} from "./setup/behaviorconfig.js"

import { 
  prependToolbar, 
  appendToolbar 
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
  isChanged,
  setTestHTML,
  setPlaceholder,
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
  // Allow access to the EditorView aka MarkupEditor
  MarkupEditor,
  // Helpers to create custom toolbar items
  MenuItem, 
  Dropdown, 
  DropdownSubmenu, 
  cmdItem, 
  renderGrouped, 
  renderDropdownItems,
  toolbarView,
  // Helpers to add items to the toolbar
  prependToolbar, 
  appendToolbar,
  // Config access
  ToolbarConfig,
  KeymapConfig,
  BehaviorConfig,
}

/**
 * The MarkupEditor holds the properly set-up EditorView and any additional configuration.
 */
class MarkupEditor {
  constructor(target, config) {
    this.element = target ?? document.querySelector("#editor")

    // Make sure config always contains menu, keymap, and behavior
    this.config = config ?? {}
    if (!this.config.toolbar) this.config.toolbar = ToolbarConfig.standard()
    if (!this.config.keymap) this.config.keymap = KeymapConfig.standard()
    if (!this.config.behavior) this.config.behavior = BehaviorConfig.standard()

    this.html = this.config.html ?? emptyHTML()
    setMessageHandler(this.config.messageHandler ?? new MessageHandler(this));
    window.view = new EditorView(this.element, {
      state: EditorState.create({
        // For the MarkupEditor, we can just use the editor element. 
        // There is no need to use a separate content element.
        doc: DOMParser.fromSchema(schema).parse(this.element),
        plugins: markupSetup(config, schema)
      }),
      nodeViews: {
        image(node, view, getPos) { return new ImageView(node, view, getPos) },
        div(node, view, getPos) { return new DivView(node, view, getPos) },
      },
      // All text input makes callbacks to indicate the document state has changed.
      // For history, used handleTextInput, but that fires *before* input happens.
      // Note the `setTimeout` hack is used to have the function called after the change
      // for things things other than the `input` event.
      handleDOMEvents: {
        'input': () => { callbackInput() },
        'cut': () => { setTimeout(() => { callbackInput() }, 0) },
        'click': () => { setTimeout(() => { clicked() }, 0) },
        'delete': () => { setTimeout(() => { callbackInput() }, 0) },
      },
      handlePaste(view, event, slice) {
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
        selectionChanged();
        // clicked(); // TODO: Removed, but is it needed in Swift MarkupEditor?
        return null;                        // Default behavior should occur
      }
    })
  }
}