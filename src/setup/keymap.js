import { chainCommands } from "prosemirror-commands"
import { splitListItem } from "prosemirror-schema-list"
import { goToNextCell } from 'prosemirror-tables'
import { undoInputRule } from "prosemirror-inputrules"
import {
    indentCommand,
    outdentCommand,
    undoCommand,
    redoCommand,
    toggleFormatCommand,
    wrapInListCommand,
    handleDelete,
    handleEnter,
    handleShiftEnter,
} from "../markup"
import {
    LinkItem,
    ImageItem,
    TableInsertItem,
    SearchItem,
} from "./menu"

/**
 * `KeymapConfig.standard()` is the default for the MarkupEditor. It can be overridden by 
 * passing a new KeymapConfig when instantiating the MarkupEditor. You can use the pre-defined 
 * static methods like `standard()` or customize what it returns.
 * 
 * To customize the key mapping, for example, in your index.html:
 * 
 *    let keymapConfig = MU.KeymapConfig.standard();    // Grab the standard keymap config as a baseline
 *    keymapConfig.link = ["Ctrl-L", "Ctrl-l"];         // Use Control+L instead of Command+k
 *    const markupEditor = new MU.MarkupEditor(
 *      document.querySelector('#editor'),
 *      {
 *        html: '<h1>Hello, world!</h1>',
 *        keymap: keymapConfig,
 *      }
 *    )
 *    
 * Note that the key mapping will exist and work regardless of whether you disable a toolbar 
 * or a specific item in a menu. For example, undo/redo by default map to Mod-z/Shift-Mod-z even  
 * though the "correctionBar" is off by default in the MarkupEditor. You can remove a key mapping 
 * by setting its value to null or an empty string. 
 */
export class KeymapConfig {
    static all = {
        // Correction
        "undo": "Mod-z",
        "redo": "Shift-Mod-z",
        // Insert
        "link": ["Mod-K", "Mod-k"],
        "image": ["Mod-G", "Mod-g"],
        "table": ["Mod-T", "Mod-t"],
        // Stylebar
        "bullet": ["Ctrl-U", "Ctrl-u"],
        "number": ["Ctrl-O", "Ctrl-o"],
        "indent": ["Mod-]", "Ctrl-q"],
        "outdent": ["Mod-[", "Shift-Ctrl-q"],
        // Format
        "bold": ["Mod-B", "Mod-b"],
        "italic": ["Mod-I", "Mod-i"],
        "underline": ["Mod-U", "Mod-u"],
        "strikethrough": ["Ctrl-S", "Ctrl-s"],
        "code": "Mod-`",
        "subscript": "Ctrl-,",
        "superscript": "Ctrl-.",
        // Search
        "search": ["Ctrl-F", "Ctrl-f"],
    }

    static full() {
        return this.all
    }

    static standard() {
        return this.markdown()
    }

    static desktop() {
        return this.full()
    }

    static markdown() {
        let markdown = this.full()
        markdown.underline = null
        markdown.subscript = null
        markdown.superscript = null
        return markdown
    }
}

/**
 * Return a map of Commands that will be invoked when key combos are pressed.
 * 
 * @param {Object}  keymapConfig    The keymap configuration, KeymapConfig.standard() by default.
 * @param {Schema}  schema          The schema that holds node and mark types.
 * @returns [String : Command]      Commands bound to keys identified by strings (e.g., "Mod-b")
 */
export function buildKeymap(keymapConfig, schema) {
    let keymap = keymapConfig   // Shorthand
    let keys = {}

    /** Allow keyString to be a string or array of strings identify the map from keys to cmd */
    function bind(keyString, cmd) {
        if (keyString instanceof Array) {
            for (let key of keyString) { keys[key] = cmd }
        } else {
            if (keyString?.length > 0) {
                keys[keyString] = cmd
            } else {
                delete keys[keyString]
            }
        }
    }

    // MarkupEditor-specific
    // We need to know when Enter is pressed, so we can identify a change on the Swift side.
    // In ProseMirror, empty paragraphs don't change the doc until they contain something, 
    // so we don't get a notification until something is put in the paragraph. By chaining 
    // the handleEnter with splitListItem that is bound to Enter here, it always executes, 
    // but splitListItem will also execute, as will anything else beyond it in the chain 
    // if splitListItem returns false (i.e., it doesn't really split the list).
    bind("Enter", chainCommands(handleEnter, splitListItem(schema.nodes.list_item)))
    // The MarkupEditor handles Shift-Enter as searchBackward when search is active.
    bind("Shift-Enter", handleShiftEnter)
    // The MarkupEditor needs to be notified of state changes on Delete, like Backspace
    bind("Delete", handleDelete)
    // Table navigation by Tab/Shift-Tab
    bind('Tab', goToNextCell(1))
    bind('Shift-Tab', goToNextCell(-1))

    // Text formatting
    bind(keymap.bold, toggleFormatCommand('B'))
    bind(keymap.italic, toggleFormatCommand('I'))
    bind(keymap.underline, toggleFormatCommand('U'))
    bind(keymap.code, toggleFormatCommand('CODE'))
    bind(keymap.strikethrough, toggleFormatCommand('DEL'))
    bind(keymap.subscript, toggleFormatCommand('SUB'))
    bind(keymap.superscript, toggleFormatCommand('SUP'))
    // Correction (needs to be chained with stateChanged also)
    bind(keymap.undo, undoCommand())
    bind(keymap.redo, redoCommand())
    bind("Backspace", chainCommands(handleDelete, undoInputRule))
    // List types
    bind(keymap.bullet, wrapInListCommand(schema, schema.nodes.bullet_list))
    bind(keymap.number, wrapInListCommand(schema, schema.nodes.ordered_list))
    // Denting
    bind(keymap.indent, indentCommand())
    bind(keymap.outdent, outdentCommand())
    // Insert
    bind(keymap.link, new LinkItem(keymap).command)
    bind(keymap.image, new ImageItem(keymap).command)
    bind(keymap.table, new TableInsertItem().command) // TODO: Doesn't work properly
    // Search
    bind(keymap.search, new SearchItem(keymap).command)
    return keys
}