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
  undoCommand,
  redoCommand,
  resetSelectedID,
  outermostOfTypeAt,
  testBlockquoteEnter,
  testListEnter,
  testExtractContents,
  testPasteHTMLPreprocessing,
  testPasteTextPreprocessing,
  insertLink,
  deleteLink,
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
  markupMenuConfig,
} from "./setup/menu.js"

import {markupKeymapConfig} from "./setup/keymap.js"

import { 
  prependToolbar, 
  appendToolbar 
} from "./setup/index.js"

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
  undoCommand,
  redoCommand,
  testBlockquoteEnter,
  testListEnter,
  testExtractContents,
  testPasteHTMLPreprocessing,
  testPasteTextPreprocessing,
  insertLink,
  deleteLink,
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
  // Helpers to add items to the toolbar
  prependToolbar, 
  appendToolbar,
  // Config access
  markupMenuConfig,
  markupKeymapConfig,
}

/**
 * The MarkupEditor holds the properly set-up EditorView and any additional 
 * 
 * Note that `markupConfig` is a global that must already exist, but which can be undefined.
 * This is typically accomplished by setting it in the first script loaded into the view, 
 * something as simple as `<script>let markupConfig;</script>'. For an environment like VSCode, 
 * which has a rich configuration capability, it can be set using `vscode.getConfiguration()`.
 * 
 * If `markupConfig` is undefined, the "standard" config is supplied by `MenuConfig.standard()`.
 */
class MarkupEditor {
  constructor(target, html, config) {
    this.element = target ?? document.querySelector("#editor")
    this.html = html ?? emptyHTML()
    this.config = config ?? {}
    window.view = new EditorView(this.element, {
      state: EditorState.create({
        // For the MarkupEditor, we can just use the editor element. 
        // There is no need to use a separate content element.
        doc: DOMParser.fromSchema(schema).parse(this.element),
        plugins: markupSetup(schema, config)
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