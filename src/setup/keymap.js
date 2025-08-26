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
    searchForCommand, 
    cancelSearch, 
    matchCase, 
    matchCount, 
    matchIndex,
    getLinkAttributes,
    selectFullLink, 
    getSelectionRect, 
    insertLinkCommand, 
    deleteLinkCommand,
    getImageAttributes, 
    insertImageCommand, 
    modifyImageCommand,
} from "../markup"
import { 
    SearchItem, 
    LinkItem, 
    ImageItem, 
    TableInsertItem 
} from "./menuitems"

/**
 * Return a map of Commands that will be invoked when key combos are pressed.
 * 
 * @param {Object}  config      The MarkupEditor.config
 * @param {Schema}  schema      The schema that holds node and mark types.
 * @returns [String : Command]  Commands bound to keys identified by strings (e.g., "Mod-b")
 */
export function buildKeymap(config, schema) {
    let keymap = config.keymap   // Shorthand
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
    bind(keymap.link, new LinkItem(config).command)
    bind(keymap.image, new ImageItem(config).command)
    bind(keymap.table, new TableInsertItem().command) // TODO: Doesn't work properly
    // Search
    bind(keymap.search, new SearchItem(config).command)
    return keys
}