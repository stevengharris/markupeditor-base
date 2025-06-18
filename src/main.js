import {EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {DOMParser} from "prosemirror-model"
import {schema} from "./schema/index.js"
import {markupSetup} from "./setup/index.js"
import {MenuConfig} from "./menuconfig.js"

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
  clicked,
  stateChanged,
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
} from "./markup.js"

/**
 * The public MarkupEditor API callable from Swift as "MU.<function name>"
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
}

/**
 * Set the EditorView for the MarkupEditor.
 * 
 * Note that `markupConfig` is a global that must already exist, but which can be undefined.
 * This is typically accomplished by setting it in the first script loaded into the view, 
 * something as simple as `<script>let markupConfig;</script>'. For an environment like VSCode, 
 * which has a rich configuration capability, it can be set using `vscode.getConfiguration()`.
 * 
 * If `markupConfig` is undefined, the "standard" config is supplied by `MenuConfig.standard()`.
 */
window.view = new EditorView(document.querySelector("#editor"), {
  state: EditorState.create({
    // For the MarkupEditor, we can just use the editor element. 
    // There is no need to use a separate content element.
    doc: DOMParser.fromSchema(schema).parse(document.querySelector("#editor")),
    plugins: markupSetup({
      config: markupConfig ?? MenuConfig.standard(),
      schema: schema
    })
  }),
  nodeViews: {
    image(node, view, getPos) { return new ImageView(node, view, getPos) },
    div(node, view, getPos) { return new DivView(node, view, getPos) },
  },
  // All text input notifies Swift that the document state has changed.
  handleTextInput() {
    stateChanged();
    return false; // All the default behavior should occur
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
    clicked();
    return null;                        // Default behavior should occur
  }
})
