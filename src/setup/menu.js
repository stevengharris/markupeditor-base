/**
 * Adapted, expanded, and copied-from prosemirror-menu under MIT license.
 * 
 * Adaptations:
 *  - Modify buildMenuItems to use a `config` object that specifies visibility and content
 *  - MenuItems returned from buildMenuItems use label and class options for Google material fonts
 * 
 * Expansions:
 *  - Added table support using MarkupEditor capabilities for table editing
 *  - Use MarkupEditor capabilities for list/denting across range
 *  - Use MarkupEditor capability for toggling and changing list types
 * 
 * Copied:
 *  - MenuItem
 *  - DropDown
 *  - Various "helper methods" returning MenuItems
 */

import crel from "crelt"
import {NodeSelection} from "prosemirror-state"
import {toggleMark, wrapIn, lift, setBlockType} from "prosemirror-commands"
import {
  wrapInListCommand, 
  insertTableCommand,
  addRowCommand, 
  addColCommand, 
  addHeaderCommand, 
  deleteTableAreaCommand,
  setBorderCommand,
  listTypeFor, 
  getListType, 
  isIndented,
  isTableSelected
} from "../markup"
import {TextField, openPrompt} from "./prompt"

const prefix = "ProseMirror-menu"

/**
An icon or label that, when clicked, executes a command.
*/
class MenuItem {
  /**
   * Create a menu item.
   * 
   * @param {*} spec The spec used to create this item.
  */
  constructor(spec) {
    this.spec = spec;
  }

  /**
  Renders the icon according to its [display
  spec](https://prosemirror.net/docs/ref/#menu.MenuItemSpec.display), and adds an event handler which
  executes the command when the representation is clicked.
  */
  render(view) {
    let spec = this.spec;
    let dom = spec.render ? spec.render(view)
      : spec.icon ? getIcon(view.root, spec.icon)
        : spec.label ? crel("div", null, translate(view, spec.label))
          : null;
    if (!dom)
      throw new RangeError("MenuItem without icon or label property");
    if (spec.title) {
      const title = (typeof spec.title === "function" ? spec.title(view.state) : spec.title);
      dom.setAttribute("title", translate(view, title));
    }
    if (spec.class)
      dom.classList.add(spec.class);
    if (spec.css)
      dom.style.cssText += spec.css;
    dom.addEventListener("mousedown", e => {
      e.preventDefault();
      if (!dom.classList.contains(prefix + "-disabled"))
        spec.run(view.state, view.dispatch, view, e);
    });
    function update(state) {
      if (spec.select) {
        let selected = spec.select(state);
        dom.style.display = selected ? "" : "none";
        if (!selected)
          return false;
      }
      let enabled = true;
      if (spec.enable) {
        enabled = spec.enable(state) || false;
        setClass(dom, prefix + "-disabled", !enabled);
      }
      if (spec.active) {
        let active = enabled && spec.active(state) || false;
        setClass(dom, prefix + "-active", active);
      }
      return true;
    }
    return { dom, update };
  }
}

/**
A drop-down menu, displayed as a label with a downwards-pointing
triangle to the right of it.
*/
class Dropdown {
  /**
  Create a dropdown wrapping the elements.
  */
  constructor(content, options = {}) {
    this.options = options;
    this.options = options || {};
    this.content = Array.isArray(content) ? content : [content];
  }
  /**
  Render the dropdown menu and sub-items.
  */
  render(view) {
    let options = this.options;
    let content = renderDropdownItems(this.content, view);
    let win = view.dom.ownerDocument.defaultView || window;
    let label = crel("div", {
      class: prefix + "-dropdown",
      style: this.options.css
    }, translate(view, this.options.label || ""));
    if (this.options.title)
      label.setAttribute("title", translate(view, this.options.title));
    if (this.options.labelClass)
      label.classList.add(this.options.labelClass)
    let enabled = true;
    if (this.options.enable) {
      enabled = this.options.enable(state) || false;
      setClass(dom, prefix + "-disabled", !enabled);
    }
    let wrap = crel("div", { class: prefix + "-dropdown-wrap" }, label);
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
        setClass(label, prefix + "-disabled", !enabled);
      }
      let inner = content.update(state);
      wrap.style.display = inner ? "" : "none";
      return inner;
    }
    return { dom: wrap, update };
  }

  expand(dom, items) {
    let menuDOM = crel("div", { class: prefix + "-dropdown-menu " + (this.options.class || "") }, items);
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
class DropdownSubmenu {
  /**
  Creates a submenu for the given group of menu elements. The
  following options are recognized:
  */
  constructor(content, options = {}) {
    this.options = options;
    this.content = Array.isArray(content) ? content : [content];
  }

  /**
  Renders the submenu.
  */
  render(view) {
    let options = this.options
    let items = renderDropdownItems(this.content, view);
    let win = view.dom.ownerDocument.defaultView || window;
    let label = crel("div", { class: prefix + "-submenu-label" }, translate(view, this.options.label || ""));
    let wrap = crel("div", { class: prefix + "-submenu-wrap" }, label, crel("div", { class: prefix + "-submenu" }, items.dom));
    let listeningOnClose = null;
    label.addEventListener("mousedown", e => {
      e.preventDefault();
      markMenuEvent(e);
      setClass(wrap, prefix + "-submenu-wrap-active", false);
      if (!listeningOnClose)
        win.addEventListener("mousedown", listeningOnClose = () => {
          if (!isMenuEvent(wrap)) {
            wrap.classList.remove(prefix + "-submenu-wrap-active");
            win.removeEventListener("mousedown", listeningOnClose);
            listeningOnClose = null;
          }
        });
    });
    function update(state) {
      let enabled = true;
      if (options.enable) {
        enabled = options.enable(state) || false;
        setClass(label, prefix + "-disabled", !enabled);
      }
      let inner = items.update(state);
      wrap.style.display = inner ? "" : "none";
      return inner;
    }
    return { dom: wrap, update };
  }
}

/**
 * Build an array of MenuItems and nested MenuItems that comprise the content of the Toolbar 
 * based on the `config` and `schema`.
 * 
 * @param {Object} config The configuration of the menu
 * @param {Schema} schema The schema that holds node and mark types
 * @returns [MenuItem]    The array of MenuItems or nested MenuItems used by `renderGrouped`.
 */
export function buildMenuItems(config, schema) {
  let itemGroups = [];
  let { insertBar, formatBar, styleMenu, styleBar } = config.visibility;
  if (insertBar) itemGroups.push(insertBarItems(config, schema));
  if (styleMenu) itemGroups.push(styleMenuItems(config, schema));
  if (styleBar) itemGroups.push(styleBarItems(config, schema));
  if (formatBar) itemGroups.push(formatItems(config, schema));
  return itemGroups;
}

/* Utility functions */

/**
 * 
 * @param {EditorView}  view
 * @param {string} text Text to be translated
 * @returns {string}    The translated text if the view supports it
 */
function translate(view, text) {
    return view._props.translate ? view._props.translate(text) : text;
}

/**
 * Add or remove a class from the element.
 * 
 * Apparently a workaround for classList.toggle being broken in IE11
 * 
 * @param {HTMLElement}  dom 
 * @param {string}          cls The class name to add or remove
 * @param {boolean}         on  True to add the class name to the `classList`
 */
function setClass(dom, cls, on) {
    if (on)
        dom.classList.add(cls);
    else
        dom.classList.remove(cls);
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

/**
 * Return whether the selection in state is within a mark of type `markType`.
 * @param {EditorState} state 
 * @param {MarkType} type 
 * @returns {boolean} True if the selection is within a mark of type `markType`
 */
function markActive(state, type) {
  let { from, $from, to, empty } = state.selection
  if (empty) return type.isInSet(state.storedMarks || $from.marks())
  else return state.doc.rangeHasMark(from, to, type)
}

/**
 * Return a MenuItem that runs the command when selected.
 * 
 * The label is the same as the title, and the MenuItem will be enabled/disabled based on 
 * what `cmd(state)` returns unless otherwise specified in `options`.
 * @param {Command}     cmd 
 * @param {*} options   The spec for the MenuItem
 * @returns {MenuItem}
 */
function cmdItem(cmd, options) {
  let passedOptions = {
    label: options.title,
    run: cmd
  }
  for (let prop in options) passedOptions[prop] = options[prop]
  if ((!options.enable || options.enable === true) && !options.select)
    passedOptions[options.enable ? "enable" : "select"] = state => cmd(state)

  return new MenuItem(passedOptions)
}

function renderDropdownItems(items, view) {
    let rendered = [], updates = [];
    for (let i = 0; i < items.length; i++) {
        let { dom, update } = items[i].render(view);
        rendered.push(crel("div", { class: prefix + "-dropdown-item" }, dom));
        updates.push(update);
    }
    return { dom: rendered, update: combineUpdates(updates, rendered) };
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
  let { link, image, table } = config.insertBar;
  if (link) items.push(linkItem(schema.marks.link))
  if (image) items.push(insertImageItem(schema.nodes.image))
  if (table) items.push(tableMenuItems(config, schema))
  return items;
}

/**
 * Return a MenuItem for image insertion
 * @param {NodeTyoe} nodeType 
 * @returns {MenuItem}  A MenuItem that can prompt for an image to insert
 */
function insertImageItem(nodeType) {
  return new MenuItem({
    title: "Insert image",
    label: 'image',
    class: 'material-symbols-outlined',
    enable(state) { return canInsert(state, nodeType) },
    run(state, _, view) {
      let {from, to} = state.selection, attrs = null
      if (state.selection instanceof NodeSelection && state.selection.node.type == nodeType)
        attrs = state.selection.node.attrs
      openPrompt({
        title: "Insert image",
        fields: {
          src: new TextField({label: "Location", required: true, value: attrs && attrs.src}),
          title: new TextField({label: "Title", value: attrs && attrs.title}),
          alt: new TextField({label: "Description",
                              value: attrs ? attrs.alt : state.doc.textBetween(from, to, " ")})
        },
        callback(attrs) {
          view.dispatch(view.state.tr.replaceSelectionWith(nodeType.createAndFill(attrs)))
          view.focus()
        }
      })
    }
  })
}

/**
 * Return a MenuItem for link insertion
 * @param {MarkType} markType 
 * @returns {MenuItem}        A MenuItem that can prompt for a link to insert
 */
function linkItem(markType) {
  return new MenuItem({
    title: "Add or remove link",
    label: 'link', 
    class: 'material-symbols-outlined',
    active(state) { return markActive(state, markType) },
    enable(state) { return !state.selection.empty },
    run(state, dispatch, view) {
      if (markActive(state, markType)) {
        toggleMark(markType)(state, dispatch)
        return true
      }
      openPrompt({
        title: "Create a link",
        fields: {
          href: new TextField({
            label: "Link target",
            required: true
          }),
          title: new TextField({label: "Title"})
        },
        callback(attrs) {
          toggleMark(markType, attrs)(view.state, view.dispatch)
          view.focus()
        }
      })
    }
  })
}

function tableMenuItems(config, schema) {
  let items = []
  let { header, border } = config.tableMenu;
  let createItems = []
  createItems.push(insertTableItem(1, 1, {label: '1 column'}))
  createItems.push(insertTableItem(1, 2, {label: '2 columns'}))
  createItems.push(insertTableItem(1, 3, {label: '3 columns'}))
  createItems.push(insertTableItem(1, 4, {label: '4 columns'}))
  items.push(new DropdownSubmenu(createItems, {title: 'Insert new table', label: 'Create'}))
  items.push(tableEditItem(addRowCommand('BEFORE'), {label: 'Add row above'}))
  items.push(tableEditItem(addRowCommand('AFTER'), {label: 'Add row below'}))
  items.push(tableEditItem(deleteTableAreaCommand('ROW'), {label: 'Delete row'}))
  items.push(tableEditItem(addColCommand('BEFORE'), {label: 'Add column before'}))
  items.push(tableEditItem(addColCommand('AFTER'), {label: 'Add column after'}))
  items.push(tableEditItem(deleteTableAreaCommand('COL'), {label: 'Delete column'}))
  items.push(tableEditItem(deleteTableAreaCommand('TABLE'), {label: 'Delete table'}))
  if (header) items.push(tableEditItem(addHeaderCommand(), {label: 'Add header'}))
  if (border) {
    let borderItems = []
    borderItems.push(tableBorderItem(setBorderCommand('cell'), {label: 'All'}))
    borderItems.push(tableBorderItem(setBorderCommand('outer'), {label: 'Outer'}))
    borderItems.push(tableBorderItem(setBorderCommand('header'), {label: 'Header'}))
    borderItems.push(tableBorderItem(setBorderCommand('none'), {label: 'None'}))
    let borderDropdown = new DropdownSubmenu(
      borderItems, {
        title: 'Set border', 
        label: 'Border',
        enable: (state) => { return isTableSelected(state) },
      })
    items.push(borderDropdown)
  }
  let table = String.fromCodePoint(0xe265)
  return new Dropdown(items, { title: 'Insert/edit table', label: table, labelClass: 'material-symbols-outlined' })
}

function insertTableItem(rows, cols, options) {
  let command = insertTableCommand(rows, cols)
  let passedOptions = {
    run: command,
    enable(state) { return command(state); },
    active(state) { return false }  // FIX
  };
  for (let prop in options)
    passedOptions[prop] = options[prop];
  return new MenuItem(passedOptions);
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
  let items = [];
  let { list, dent } = config.styleBar;
  if (list) {
    items.push(toggleListItem(schema, schema.nodes.ordered_list, { title: 'Toggle numbered list', label: 'format_list_numbered', class: 'material-symbols-outlined' }))
    items.push(toggleListItem(schema, schema.nodes.bullet_list, { title: 'Toggle bulleted list', label: 'format_list_bulleted', class: 'material-symbols-outlined' }))
  }
  if (dent) {
    items.push(indentItem(schema.nodes.blockquote, { title: 'Increase indent', label: 'format_indent_increase', class: 'material-symbols-outlined' }))
    items.push(outdentItem({ title: 'Decrease indent', label: 'format_indent_decrease', class: 'material-symbols-outlined' }))
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

function indentItem(nodeType, options) {
  let passedOptions = {
    active: (state) => { return isIndented(state) },
    enable: true
  }
  for (let prop in options) passedOptions[prop] = options[prop]
  return cmdItem(wrapIn(nodeType), passedOptions)
}

function outdentItem(options) {
  let passedOptions = {
    active: (state) => { return isIndented(state) },
    enable: true
  }
  for (let prop in options) passedOptions[prop] = options[prop]
  return cmdItem(lift, passedOptions)
}

/* Format Bar (B, I, U, etc) */

/**
 * Return the array of formatting MenuItems that should show per the config.
 * 
 * @param {Object} config   The markupConfig that is passed-in, with boolean values in config.formatBar.
 * @returns [MenuItem]      The array of MenuItems that show as passed in `config`
 */
function formatItems(config, schema) {
  let items = []
  let { bold, italic, underline, code, strikethrough, subscript, superscript } = config.formatBar;
  if (bold) items.push(formatItem(schema.marks.strong, { title: 'Toggle bold', label: 'format_bold', class: 'material-symbols-outlined' }))
  if (italic) items.push(formatItem(schema.marks.em, { title: 'Toggle italic', label: 'format_italic', class: 'material-symbols-outlined' }))
  if (underline) items.push(formatItem(schema.marks.u, { title: 'Toggle underline', label: 'format_underline', class: 'material-symbols-outlined' }))
  if (code) items.push(formatItem(schema.marks.code, { title: 'Toggle code', label: 'data_object', class: 'material-symbols-outlined' }))
  if (strikethrough) items.push(formatItem(schema.marks.s, { title: 'Toggle strikethrough', label: 'strikethrough_s', class: 'material-symbols-outlined' }))
  if (subscript) items.push(formatItem(schema.marks.sub, { title: 'Toggle subscript', label: 'subscript', class: 'material-symbols-outlined' }))
  if (superscript) items.push(formatItem(schema.marks.sup, { title: 'Toggle superscript', label: 'superscript', class: 'material-symbols-outlined' }))
  return items;
}

function formatItem(markType, options) {
  let passedOptions = {
    active: (state) => { return markActive(state, markType) },
    enable: true
  }
  for (let prop in options) passedOptions[prop] = options[prop]
  return cmdItem(toggleMark(markType), passedOptions)
}

/* Style DropDown (P, H1-H6, Code) */

/**
 * Return the Dropdown containing the styling MenuItems that should show per the config.
 * 
 * @param {*} config    The markupConfig that is passed-in, with boolean values in config.styleMenu.
 * @returns [Dropdown]  The array of MenuItems that show as passed in `config`
 */
function styleMenuItems(config, schema) {
  let items = []
  let { p, h1, h2, h3, h4, h5, h6, codeblock } = config.styleMenu;
  if (p) items.push(blockTypeItem(schema.nodes.paragraph, { label: 'Normal' }))
  if (h1) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 1 }, label: 'Header 1' }))
  if (h2) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 2 }, label: 'Header 2' }))
  if (h3) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 3 }, label: 'Header 3' }))
  if (h4) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 4 }, label: 'Header 4' }))
  if (h5) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 5 }, label: 'Header 5' }))
  if (h6) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 6 }, label: 'Header 6' }))
  if (codeblock) items.push(blockTypeItem(schema.nodes.code_block, { label: 'Code' }))
  return [new Dropdown(items, { title: 'Set paragraph style', label: 'Style' })]
}

/**
Build a menu item for changing the type of the textblock around the
selection to the given type. Provides `run`, `active`, and `select`
properties. Others must be given in `options`. `options.attrs` may
be an object to provide the attributes for the textblock node.
*/
function blockTypeItem(nodeType, options) {
    let command = setBlockType(nodeType, options.attrs);
    let passedOptions = {
        run: command,
        enable(state) { return command(state); },
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

/* Rendering support for MenuItems */

/**
 * Render the given, possibly nested, array of menu elements into a
 * document fragment, placing separators between them (and ensuring no
 * superfluous separators appear when some of the groups turn out to
 * be empty).
 * @param {EditorView} view 
 * @param {[MenuItem | [MenuItem]]} content 
 * @returns 
 */
export function renderGrouped(view, content) {
    let result = document.createDocumentFragment();
    let updates = [], separators = [];
    for (let i = 0; i < content.length; i++) {
        let items = content[i], localUpdates = [], localNodes = [];
        for (let j = 0; j < items.length; j++) {
            let { dom, update } = items[j].render(view);
            let span = crel("span", { class: prefix + "item" }, dom);
            result.appendChild(span);
            localNodes.push(span);
            localUpdates.push(update);
        }
        if (localUpdates.length) {
            updates.push(combineUpdates(localUpdates, localNodes));
            if (i < content.length - 1)
                separators.push(result.appendChild(separator()));
        }
    }
    function update(state) {
        let something = false, needSep = false;
        for (let i = 0; i < updates.length; i++) {
            let hasContent = updates[i](state);
            if (i)
                separators[i - 1].style.display = needSep && hasContent ? "" : "none";
            needSep = hasContent;
            if (hasContent)
                something = true;
        }
        return something;
    }
    return { dom: result, update };
}

function separator() {
    return crel("span", { class: prefix + "separator" });
}

function combineUpdates(updates, nodes) {
    return (state) => {
        let something = false;
        for (let i = 0; i < updates.length; i++) {
            let up = updates[i](state);
            nodes[i].style.display = up ? "" : "none";
            if (up)
                something = true;
        }
        return something;
    };
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