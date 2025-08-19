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

import crel from "crelt"
import {
  setStyleCommand,
  indentCommand,
  outdentCommand,
  undoCommand,
  redoCommand,
  toggleFormatCommand,
  wrapInListCommand, 
  insertTableCommand,
  addRowCommand, 
  addColCommand, 
  addHeaderCommand, 
  deleteTableAreaCommand,
  setBorderCommand,
  searchForCommand,
  listTypeFor, 
  getListType, 
  isIndented,
  isTableSelected,
  tableHasHeader,
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
  modifyImageCommand
} from "../markup"
import { 
  icons, 
  getIcon 
} from "./icons";
import { 
  MenuItem, 
  MoreItem,
  SearchItem,
  LinkItem,
  ImageItem,
  cmdItem, 
  keyString,
  markActive,
  combineUpdates
} from "./menuitems";
import { 
  prefix,
  setClass, 
  translate,
} from "./utilities"

/**
A drop-down menu, displayed as a label with a downwards-pointing
triangle to the right of it.
*/
export class Dropdown {

  /**
  Create a dropdown wrapping the elements.
  */
  constructor(content, options = {}) {
    this.prefix = prefix + "-menu";
    this.options = options;
    if (this.options.indicator == undefined) this.options.indicator = true;
    this.content = Array.isArray(content) ? content : [content];
  }
  /**
  Render the dropdown menu and sub-items.
  */
  render(view) {
    let options = this.options;
    let content = renderDropdownItems(this.content, view);
    let win = view.dom.ownerDocument.defaultView || window;
    let indicator = crel("span", "\u25BE");
    setClass(indicator, this.prefix + "-dropdown-indicator", true);
    let label;
    if (this.options.icon) {
      label = getIcon(view.root, this.options.icon)
      if (options.indicator) label.appendChild(indicator)
      setClass(label, this.prefix + "-dropdown-icon", true)
    } else {
      label = crel("span", {
        class: this.prefix + "-dropdown",
        style: this.options.css
      });
      label.appendChild(crel("span", this.options.label))
      label.appendChild(indicator)
    }
    if (this.options.title)
      label.setAttribute("title", translate(view, this.options.title));
    if (this.options.labelClass)
      label.classList.add(this.options.labelClass)
    let enabled = true;
    if (this.options.enable) {
      enabled = this.options.enable(state) || false;
      setClass(dom, this.prefix + "-disabled", !enabled);
    }
    let iconWrapClass = this.options.indicator ? "-dropdown-icon-wrap" : "-dropdown-icon-wrap-noindicator"
    let wrapClass = (this.options.icon) ? this.prefix + iconWrapClass : this.prefix + "-dropdown-wrap"
    let wrap = crel("span", { class: wrapClass }, label);
    let open = null;
    let listeningOnClose = null;
    let close = () => {
      if (open && open.close()) {
        open = null;
        win.removeEventListener("mousedown", listeningOnClose);
      }
    };
    label.addEventListener("mousedown", e => {
      e.preventDefault();
      markMenuEvent(e);
      if (open) {
        close();
      }
      else {
        open = this.expand(wrap, content.dom);
        win.addEventListener("mousedown", listeningOnClose = () => {
          if (!isMenuEvent(wrap))
            close();
        });
      }
    });

    function update(state) {
      if (options.enable) {
        let enabled = options.enable(state) || false;
        setClass(label, this.prefix + "-disabled", !enabled);
      }
      if (options.titleUpdate) {
        let newTitle = options.titleUpdate(state);
        label.replaceChild(document.createTextNode(newTitle), label.firstChild)
      }
      let inner = content.update(state);
      wrap.style.display = inner ? "" : "none";
      return inner;
    }
    return { dom: wrap, update };
  }

  expand(dom, items) {
    let menuDOM = crel("div", { class: this.prefix + "-dropdown-menu" + (this.options.class || "") }, items);
    let done = false;
    function close() {
      if (done)
        return false;
      done = true;
      dom.removeChild(menuDOM);
      return true;
    }
    dom.appendChild(menuDOM);
    return { close, node: menuDOM };
  }
}

/**
Represents a submenu wrapping a group of elements that start
hidden and expand to the right when hovered over or tapped.
*/
export class DropdownSubmenu {

  /**
  Creates a submenu for the given group of menu elements. The
  following options are recognized:
  */
  constructor(content, options = {}) {
    this.prefix = prefix + "-menu"
    this.options = options;
    this.content = Array.isArray(content) ? content : [content];
  }

  /**
  Renders the submenu.
  */
  render(view) {
    let options = this.options;
    let items = renderDropdownItems(this.content, view);
    let win = view.dom.ownerDocument.defaultView || window;
    let label = crel("div", { class: this.prefix + "-submenu-label" }, translate(view, this.options.label || ""));
    let wrap = crel("div", { class: this.prefix + "-submenu-wrap" }, label, crel("div", { class: this.prefix + "-submenu" }, items.dom));
    let listeningOnClose = null;
    label.addEventListener("mousedown", e => {
      e.preventDefault();
      markMenuEvent(e);
      setClass(wrap, this.prefix + "-submenu-wrap-active", false);
      if (!listeningOnClose)
        win.addEventListener("mousedown", listeningOnClose = () => {
          if (!isMenuEvent(wrap)) {
            wrap.classList.remove(this.prefix + "-submenu-wrap-active");
            win.removeEventListener("mousedown", listeningOnClose);
            listeningOnClose = null;
          }
        });
    });
    function update(state) {
      let enabled = true;
      if (options.enable) {
        enabled = options.enable(state) || false;
        setClass(label, this.prefix + "-disabled", !enabled);
      }
      let inner = items.update(state);
      wrap.style.display = inner ? "" : "none";
      return inner;
    }
    return { dom: wrap, update };
  }
}

/**
  A submenu for creating a table, which contains many TableInsertItems each of which 
  will insert a table of a specific size. The items are bounded divs in a css grid 
  layout that highlight to show the size of the table being created, so we end up with 
  a compact way to display 24 TableInsertItems.
  */
class TableCreateSubmenu {
  constructor(options = {}) {
    this.prefix = prefix + "-menu"
    this.options = options;
    this.content = []
    this.maxRows = 6
    this.maxCols = 4
    this.rowSize = 0
    this.colSize = 0
    for (let row = 0; row < this.maxRows; row++) {
      for (let col = 0; col < this.maxCols; col++) {
        // If we want the MenuItem div to respond to keydown, it needs to contain something, 
        // in this case a non-breaking space. Just ' ' doesn't work.
        let options = {
          label: '\u00A0', 
          active: () => {
            return (row < this.rowSize) && (col < this.colSize)
          }
        }
        let insertItem = new TableInsertItem(row + 1, col + 1, this.onMouseover.bind(this), options)
        this.content.push(insertItem)
      }
    }
  }

  /**
   * Track rowSize and columnSize as we drag over an item in the `sizer`.
   * @param {number} rows 
   * @param {number} cols 
   */
  onMouseover(rows, cols) {
    this.rowSize = rows
    this.colSize = cols
    this.itemsUpdate(view.state)
  }

  resetSize() {
    this.rowSize = 0;
    this.colSize = 0;
  }

  /**
  Renders the submenu.
  */
  render(view) {
    let resetSize = this.resetSize.bind(this);
    let options = this.options;
    let items = renderDropdownItems(this.content, view);
    this.itemsUpdate = items.update;  // Track the update method so we can update as the mouse is over items
    let win = view.dom.ownerDocument.defaultView || window;
    let label = crel("div", { class: this.prefix + "-submenu-label" }, translate(view, this.options.label || ""));
    let sizer = crel("div", { class: this.prefix + "-tablesizer" }, items.dom);
    let wrap = crel("div", { class: this.prefix + "-submenu-wrap" }, label, sizer);
    let listeningOnClose = null;
    // Clear the sizer when the mouse moves outside of it
    // It's not enough to just resetSize, because it doesn't clear properly until the 
    // mouse is back over an item.
    sizer.addEventListener("mouseleave", () => {this.onMouseover.bind(this)(0, 0)})
    label.addEventListener("mousedown", e => {
      e.preventDefault();
      markMenuEvent(e);
      setClass(wrap, this.prefix + "-submenu-wrap-active", false);
      if (!listeningOnClose)
        win.addEventListener("mousedown", listeningOnClose = () => {
          if (!isMenuEvent(wrap)) {
            wrap.classList.remove(this.prefix + "-submenu-wrap-active");
            win.removeEventListener("mousedown", listeningOnClose);
            listeningOnClose = null;
          }
        });
    });
    function update(state) {
      resetSize();
      let enabled = true;
      if (options.enable) {
        enabled = options.enable(state) || false;
        setClass(label, this.prefix + "-disabled", !enabled);
      }
      let inner = items.update(state);
      wrap.style.display = inner ? "" : "none";
      return inner;
    }
    return { dom: wrap, update };
  }

}

/**
 * A MenuItem that inserts a table of size rows/cols and invokes `onMouseover` when 
 * the mouse is over it to communicate the size of table it will create when selected.
 */
export class TableInsertItem {

  constructor(rows, cols, onMouseover, options) {
    this.prefix = prefix + "-menuitem"
    this.rows = rows
    this.cols = cols
    this.onMouseover = onMouseover
    this.command = insertTableCommand(this.rows, this.cols)
    this.item = this.tableInsertItem(this.command, options)
  }

  tableInsertItem(command, options) {
    let passedOptions = {
      run: command,
      enable(state) { return command(state); },
    };
    for (let prop in options)
      passedOptions[prop] = options[prop];
    return new MenuItem(passedOptions);
  }

  render(view) {
    let {dom, update} = this.item.render(view);
    dom.addEventListener('mouseover', e => {
      this.onMouseover(this.rows, this.cols)
    })
    return {dom, update}
  }

}

class ParagraphStyleItem {

  constructor(nodeType, style, options) {
    this.style = style
    this.styleLabel = options["label"] ?? "Unknown" // It should always be specified
    this.item = this.paragraphStyleItem(nodeType, style, options)
  }

  paragraphStyleItem(nodeType, style, options) {
    let command = setStyleCommand(style)
    let passedOptions = {
        run: command,
        enable(state) { return command(state) },
        active(state) {
            let { $from, to, node } = state.selection;
            if (node)
                return node.hasMarkup(nodeType, options.attrs);
            return to <= $from.end() && $from.parent.hasMarkup(nodeType, options.attrs);
        }
    };
    for (let prop in options)
        passedOptions[prop] = options[prop];
    return new MenuItem(passedOptions);
  }

  render(view) {
    let {dom, update} = this.item.render(view);
    let styledElement = crel(this.style, this.styleLabel)
    dom.replaceChild(styledElement, dom.firstChild);
    return {dom, update}
  }
}

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
  let { correctionBar, insertBar, formatBar, styleMenu, styleBar, search } = config.toolbar.visibility;
  if (correctionBar) itemGroups.push(correctionBarItems(config));
  if (insertBar) itemGroups.push(insertBarItems(config, schema));
  if (styleMenu) itemGroups.push(styleMenuItems(config, schema));
  if (styleBar) itemGroups.push(styleBarItems(config, schema));
  if (formatBar) itemGroups.push(formatItems(config, schema));
  if (search) {
    let searchCommands = {searchForCommand, cancelSearch, matchCase, matchCount, matchIndex}
    itemGroups.push([new SearchItem(config, searchCommands)])
  }
  return itemGroups;
}

/**
 * Return whether a Node of `nodeType` can be inserted.
 * @param {EditorState} state
 * @param {NodeType} nodeType 
 * @returns {boolean} Whether a Node of `nodeType` can be inserted given the `state`.
 */
function canInsert(state, nodeType) {
  let $from = state.selection.$from
  for (let d = $from.depth; d >= 0; d--) {
    let index = $from.index(d)
    if ($from.node(d).canReplaceWith(index, index, nodeType)) return true
  }
  return false
}

/* Correction Bar (Undo, Redo) */

function correctionBarItems(config) {
  let keymap = config.keymap;
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
 * @param {Schema} schema 
 * @returns {[MenuItem]}  An array or MenuItems to be shown in the style bar
 */
function insertBarItems(config, schema) {
  let items = [];
  let { link, image, tableMenu } = config.toolbar.insertBar;
  if (link) {
    let linkCommands = {getLinkAttributes, selectFullLink, getSelectionRect, insertLinkCommand, deleteLinkCommand}
    items.push(new LinkItem(config, linkCommands))
  }
  if (image) {
    let imageCommands = {getImageAttributes, insertImageCommand, modifyImageCommand, getSelectionRect}
    items.push(new ImageItem(config, imageCommands))
  }
  if (tableMenu) items.push(tableMenuItems(config))
  return items;
}

function tableMenuItems(config, schema) {
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
    active(state) { return false }  // FIX
  };
  for (let prop in options)
    passedOptions[prop] = options[prop];
  return new MenuItem(passedOptions);
}

function tableBorderItem(command, options) {
  let passedOptions = {
    run: command,
    enable(state) { return command(state); },
    active(state) { return false }  // FIX
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
  let keymap = config.keymap;
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
  let items = []
  let { p, h1, h2, h3, h4, h5, h6, pre } = config.toolbar.styleMenu;
  if (p) items.push(new ParagraphStyleItem(schema.nodes.paragraph, 'P', { label: p }))
  if (h1) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H1', { label: h1, attrs: { level: 1 }}))
  if (h2) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H2', { label: h2, attrs: { level: 2 }}))
  if (h3) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H3', { label: h3, attrs: { level: 3 }}))
  if (h4) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H4', { label: h4, attrs: { level: 4 }}))
  if (h5) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H5', { label: h5, attrs: { level: 5 }}))
  if (h6) items.push(new ParagraphStyleItem(schema.nodes.heading, 'H6', { label: h6, attrs: { level: 6 }}))
  if (pre) items.push(new ParagraphStyleItem(schema.nodes.code_block, 'PRE', { label: pre }))
  return [new Dropdown(items, { title: 'Set paragraph style', icon: icons.paragraphStyle })]
}

/* Rendering support and utility functions for MenuItem, Dropdown */

export function renderDropdownItems(items, view) {
    let rendered = [], updates = [];
    for (let i = 0; i < items.length; i++) {
        let { dom, update } = items[i].render(view);
        rendered.push(crel("div", { class: prefix + "-menu-dropdown-item" }, dom));
        updates.push(update);
    };
    return { dom: rendered, update: combineUpdates(updates, rendered) };
}

let lastMenuEvent = { time: 0, node: null };

function markMenuEvent(e) {
    lastMenuEvent.time = Date.now();
    lastMenuEvent.node = e.target;
}

function isMenuEvent(wrapper) {
    return Date.now() - 100 < lastMenuEvent.time &&
        lastMenuEvent.node && wrapper.contains(lastMenuEvent.node);
}