/**
 * Adapted, expanded, and copied-from prosemirror-menu under MIT license.
 * Original prosemirror-menu at https://github.com/prosemirror/prosemirror-menu.
 * 
 * Adaptations:
 *  - Modify buildMenuItems to use a `config` object that specifies visibility and content
 *  - Use separate buildKeymap in keymap.js with a `config` object that specifies key mappings
 *  - Modify icons to use SVG from Google Material Fonts
 *  - Allow Dropdown menus to be icons, not just labels
 *  - Replace use of prompt with custom dialogs for links and images
 * 
 * Expansions:
 *  - Added table support using MarkupEditor capabilities for table editing
 *  - Use MarkupEditor capabilities for list/denting across range
 *  - Use MarkupEditor capability for toggling and changing list types
 *  - Added SearchItem, LinkItem, ImageItem
 *  - Added TableCreateSubmenu and TableInsertItem in support of table creation
 *  - Added ParagraphStyleItem to support showing font sizes for supported styles
 * 
 * Copied:
 *  - MenuItem
 *  - Dropdown
 *  - DropdownSubmenu
 *  - Various "helper methods" returning MenuItems
 */

import {
  indentCommand,
  outdentCommand,
  undoCommand,
  redoCommand,
  toggleFormatCommand,
  wrapInListCommand, 
  addRowCommand, 
  addColCommand, 
  addHeaderCommand, 
  deleteTableAreaCommand,
  setBorderCommand,
  listTypeFor, 
  getListType, 
  isIndented,
  isTableSelected,
  tableHasHeader,
  getSelectionRect,
  getImageAttributes, 
  insertImageCommand, 
  modifyImageCommand
} from "../markup"
import { 
  MenuItem,
  Dropdown,
  DropdownSubmenu,
  ParagraphStyleItem,
  LinkItem,
  ImageItem,
  TableCreateSubmenu,
  SearchItem,
  cmdItem,
  keyString,
  baseKeyString,
  markActive,
} from "./menuitems";

/**
 * Build an array of MenuItems and nested MenuItems that comprise the content of the Toolbar 
 * based on the `config` and `schema`.
 * 
 * This is the first entry point for menu that is called from `setup/index.js', returning the 
 * contents that `renderGrouped` can display. It also sets the prefix used locally.
 * 
 * @param {string}  basePrefix      The prefix used when building style strings, "Markup" by default.
 * @param {Object}  config          The MarkupEditor.config.
 * @param {Schema}  schema          The schema that holds node and mark types.
 * @returns [MenuItem]              The array of MenuItems or nested MenuItems used by `renderGrouped`.
 */
export function buildMenuItems(config, schema) {
  let itemGroups = [];
  let ordering = config.toolbar.ordering;
  let { correctionBar, insertBar, formatBar, styleMenu, styleBar, search } = config.toolbar.visibility;
  if (correctionBar) {
    itemGroups.push({item: correctionBarItems(config), order: ordering.correctionBar});
  }
  if (insertBar) {
    itemGroups.push({item: insertBarItems(config), order: ordering.insertBar});
  }
  if (styleMenu) {
    itemGroups.push({item: styleMenuItems(config, schema), order: ordering.styleMenu});
  }
  if (styleBar) {
    itemGroups.push({item: styleBarItems(config, schema), order: ordering.styleBar});
  }
  if (formatBar) {
    itemGroups.push({item: formatItems(config, schema), order: ordering.formatBar});
  }
  if (search) {
    itemGroups.push({item: [new SearchItem(config)], order: ordering.search});
  }
  itemGroups.sort((a, b) => a.order - b.order);
  return itemGroups.map((ordered) => ordered.item)
}

/* Correction Bar (Undo, Redo) */

function correctionBarItems(config) {
  let keymap = config.keymap;
  let icons = config.toolbar.icons
  let items = [];
  items.push(undoItem({ title: 'Undo' + keyString('undo', keymap), icon: icons.undo }));
  items.push(redoItem({ title: 'Redo' + keyString('redo', keymap), icon: icons.redo }));
  return items;
}

function undoItem(options) {
  let passedOptions = {
    enable: (state) => undoCommand()(state)
  }
  for (let prop in options)
    passedOptions[prop] = options[prop];
  return cmdItem(undoCommand(), passedOptions)
}

function redoItem(options) {
  let passedOptions = {
    enable: (state) => redoCommand()(state)
  }
  for (let prop in options)
    passedOptions[prop] = options[prop];
  return cmdItem(redoCommand(), passedOptions)
}

/* Insert Bar (Link, Image, Table) */

/**
 * Return the MenuItems for the style bar, as specified in `config`.
 * @param {Object} config The config object with booleans indicating whether list and denting items are included
 * @returns {[MenuItem]}  An array or MenuItems to be shown in the style bar
 */
function insertBarItems(config) {
  let items = [];
  let { link, image, tableMenu } = config.toolbar.insertBar;
  if (link) {
    items.push(new LinkItem(config))
  }
  if (image) {
    let imageCommands = {getImageAttributes, insertImageCommand, modifyImageCommand, getSelectionRect}
    items.push(new ImageItem(config, imageCommands))
  }
  if (tableMenu) items.push(tableMenuItems(config))
  return items;
}

function tableMenuItems(config) {
  let icons = config.toolbar.icons
  let items = []
  let { header, border } = config.toolbar.tableMenu;
  items.push(new TableCreateSubmenu({title: 'Insert table', label: 'Insert'}))
  let addItems = []
  addItems.push(tableEditItem(addRowCommand('BEFORE'), {label: 'Row above'}))
  addItems.push(tableEditItem(addRowCommand('AFTER'), {label: 'Row below'}))
  addItems.push(tableEditItem(addColCommand('BEFORE'), {label: 'Column before'}))
  addItems.push(tableEditItem(addColCommand('AFTER'), {label: 'Column after'}))
  if (header) addItems.push(
    tableEditItem(
      addHeaderCommand(), {
        label: 'Header',
        enable: (state) => { return isTableSelected(state) && !tableHasHeader(state) },
      }))
  items.push(new DropdownSubmenu(
    addItems, {
      title: 'Add row/column', 
      label: 'Add',
      enable: (state) => { return isTableSelected(state) }
    }))
  let deleteItems = []
  deleteItems.push(tableEditItem(deleteTableAreaCommand('ROW'), {label: 'Row'}))
  deleteItems.push(tableEditItem(deleteTableAreaCommand('COL'), {label: 'Column'}))
  deleteItems.push(tableEditItem(deleteTableAreaCommand('TABLE'), {label: 'Table'}))
  items.push(new DropdownSubmenu(
    deleteItems, {
      title: 'Delete row/column', 
      label: 'Delete',
      enable: (state) => { return isTableSelected(state) }
    }))
  if (border) {
    let borderItems = []
    borderItems.push(tableBorderItem(setBorderCommand('cell'), {label: 'All'}))
    borderItems.push(tableBorderItem(setBorderCommand('outer'), {label: 'Outer'}))
    borderItems.push(tableBorderItem(setBorderCommand('header'), {label: 'Header'}))
    borderItems.push(tableBorderItem(setBorderCommand('none'), {label: 'None'}))
    items.push(new DropdownSubmenu(
      borderItems, {
        title: 'Set border', 
        label: 'Border',
        enable: (state) => { return isTableSelected(state) }
      }))
  }
  return new Dropdown(items, { title: 'Insert/edit table', icon: icons.table })
}

function tableEditItem(command, options) {
  let passedOptions = {
    run: command,
    enable(state) { return command(state); },
    active() { return false }  // FIX
  };
  for (let prop in options)
    passedOptions[prop] = options[prop];
  return new MenuItem(passedOptions);
}

function tableBorderItem(command, options) {
  let passedOptions = {
    run: command,
    enable(state) { return command(state); },
    active() { return false }  // FIX
  };
  for (let prop in options)
    passedOptions[prop] = options[prop];
  return new MenuItem(passedOptions);
}

/* Style Bar (List, Indent, Outdent) */

/**
 * Return the MenuItems for the style bar, as specified in `config`.
 * @param {Object} config The config object with booleans indicating whether list and denting items are included
 * @param {Schema} schema 
 * @returns {[MenuItem]}  An array or MenuItems to be shown in the style bar
 */
function styleBarItems(config, schema) {
  let keymap = config.keymap
  let icons = config.toolbar.icons
  let items = []
  let { list, dent } = config.toolbar.styleBar
  if (list) {
    let bullet = toggleListItem(
      schema,
      schema.nodes.bullet_list,
      { title: 'Toggle bulleted list' + keyString('bullet', keymap), icon: icons.bulletList }
    )
    let number = toggleListItem(
      schema,
      schema.nodes.ordered_list,
      { title: 'Toggle numbered list' + keyString('number', keymap), icon: icons.orderedList }
    )
    items.push(bullet)
    items.push(number)
  }
  if (dent) {
    let indent = indentItem({ title: 'Increase indent' + keyString('indent', keymap), icon: icons.blockquote })
    let outdent = outdentItem({ title: 'Decrease indent' + keyString('outdent', keymap), icon: icons.lift })
    items.push(indent)
    items.push(outdent)
  }
  return items;
}

function toggleListItem(schema, nodeType, options) {
  let passedOptions = {
    active: (state) => { return listActive(state, nodeType) },
    enable: true
  }
  for (let prop in options) passedOptions[prop] = options[prop]
  return cmdItem(wrapInListCommand(schema, nodeType), passedOptions)
}

function listActive(state, nodeType) {
  let listType = getListType(state)
  return listType === listTypeFor(nodeType, state.schema)
}

function indentItem(options) {
  let passedOptions = {
    active: (state) => { return isIndented(state) },
    enable: true
  }
  for (let prop in options) passedOptions[prop] = options[prop]
  return cmdItem(indentCommand(), passedOptions)
}

function outdentItem(options) {
  let passedOptions = {
    active: (state) => { return isIndented(state) },
    enable: true
  }
  for (let prop in options) passedOptions[prop] = options[prop]
  return cmdItem(outdentCommand(), passedOptions)
}

/* Format Bar (B, I, U, etc) */

/**
 * Return the array of formatting MenuItems that should show per the config.
 * 
 * @param {Object} config   The MarkupEditor.config with boolean values in config.toolbar.formatBar.
 * @returns [MenuItem]      The array of MenuItems that show as passed in `config`
 */
function formatItems(config, schema) {
  let keymap = config.keymap
  let icons = config.toolbar.icons
  let items = []
  let { bold, italic, underline, code, strikethrough, subscript, superscript } = config.toolbar.formatBar;
  if (bold) items.push(formatItem(schema.marks.strong, 'B', { title: 'Toggle bold' + keyString('bold', keymap), icon: icons.strong }))
  if (italic) items.push(formatItem(schema.marks.em, 'I', { title: 'Toggle italic' + keyString('italic', keymap), icon: icons.em }))
  if (underline) items.push(formatItem(schema.marks.u, 'U', { title: 'Toggle underline' + keyString('underline', keymap), icon: icons.u }))
  if (code) items.push(formatItem(schema.marks.code, 'CODE', { title: 'Toggle code' + keyString('code', keymap), icon: icons.code }))
  if (strikethrough) items.push(formatItem(schema.marks.s, 'DEL', { title: 'Toggle strikethrough' + keyString('strikethrough', keymap), icon: icons.s }))
  if (subscript) items.push(formatItem(schema.marks.sub, 'SUB', { title: 'Toggle subscript' + keyString('subscript', keymap), icon: icons.sub }))
  if (superscript) items.push(formatItem(schema.marks.sup, 'SUP', { title: 'Toggle superscript' + keyString('superscript', keymap), icon: icons.sup }))
  return items;
}

function formatItem(markType, markName, options) {
  let passedOptions = {
    active: (state) => { return markActive(state, markType) },
    enable: (state) => { return toggleFormatCommand(markName)(state) }
  }
  for (let prop in options) passedOptions[prop] = options[prop]
  return cmdItem(toggleFormatCommand(markName), passedOptions)
}

/* Style DropDown (P, H1-H6, Code) */

/**
 * Return the Dropdown containing the styling MenuItems that should show per the config.
 * 
 * @param {Object}  config          The MarkupEditor.config.
 * @param {Schema}  schema          The schema that holds node and mark types.
 * @returns [Dropdown]  The array of MenuItems that show as passed in `config`
 */
function styleMenuItems(config, schema) {
  let keymap = config.keymap
  let icons = config.toolbar.icons
  let items = []
  let { p, h1, h2, h3, h4, h5, h6, pre } = config.toolbar.styleMenu;
  if (p) items.push(new ParagraphStyleItem(schema.nodes.paragraph, 'P', { label: p, keymap: baseKeyString('p', keymap) }))
  if (h1) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H1', { label: h1, keymap: baseKeyString('h1', keymap), attrs: { level: 1 }}))
  if (h2) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H2', { label: h2, keymap: baseKeyString('h2', keymap), attrs: { level: 2 }}))
  if (h3) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H3', { label: h3, keymap: baseKeyString('h3', keymap), attrs: { level: 3 }}))
  if (h4) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H4', { label: h4, keymap: baseKeyString('h4', keymap), attrs: { level: 4 }}))
  if (h5) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H5', { label: h5, keymap: baseKeyString('h5', keymap), attrs: { level: 5 }}))
  if (h6) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H6', { label: h6, keymap: baseKeyString('h6', keymap), attrs: { level: 6 }}))
  if (pre) items.push(new ParagraphStyleItem(schema.nodes.code_block, 'PRE', { label: pre }))
  return [new Dropdown(items, { title: 'Set paragraph style', icon: icons.paragraphStyle })]
}