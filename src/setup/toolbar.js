
/**
 * Making some notes as I work on the toolbar some. The ToolbarView used in the plugin is adapted from 
 * the prosemirror-menu. One of my goals was to produce a toolbar that can be defined without any actual 
 * icons within the MarkupEditor. My idea is that the web page that is displaying the toolbar can use its 
 * own CSS and icons, while the MarkupEditor itself holds a kind of model for the toolbar. The MarkupEditor 
 * has a specific set of editing capabilities represented in the toolbar, so it doesn't need the generality 
 * of the prosemirror-menu. I also want the toolbar contents to remain the same as it is used, not suddenly 
 * show or remove buttons. At the same time, I want the window or app that displays the toolbar to be able 
 * to control its contents within limits, somewhat like the Swift MarkupEditor can do in ToolbarConfiguration.
 * 
 * Right now the markupeditorjs holds its configuration in a global `markupconfig` which is referenced in 
 * `main.js`. This object needs to be set up before a MarkupEditor web page is launched, which I'm currently 
 * doing in a script that is loaded before markupeditor.js. You can't see that in markupeditorjs, but you 
 * can see it in markupeditorvs, the VSCode extension, in the webview panel set up done in markupCoordinator.js.
 * It's a bit odd that the JavaScript MarkupEditor package references something like `markupconfig` but itself
 * never defines it. I might have to do something about that in the future, but the intent is that something 
 * somewhere creates an actual web page that holds onto the MarkupEditor and loads all of its scripts. That 
 * thing is what controls and defines the config. In the VSCode extension, you want that to be done via 
 * the standard VSCode extension settings mechanisms. In Swift, you want that to be done in the Swift 
 * MarkupEditor settings.
 */
import crel from "crelt"
import {Plugin} from "prosemirror-state"
import {toggleMark, wrapIn, lift} from "prosemirror-commands"
import {MenuItem, Dropdown, renderGrouped, blockTypeItem} from "prosemirror-menu"

import {multiWrapInList} from "../markup"

const prefix = "ProseMirror-menubar"

function isIOS() {
  if (typeof navigator == "undefined") return false
  let agent = navigator.userAgent
  return !/Edge\/\d/.test(agent) && /AppleWebKit/.test(agent) && /Mobile\/\w+/.test(agent)
}

export function toolbar(config, schema) {
  let view = function view(editorView) {
    let toolbarView = new ToolbarView(editorView, config, schema)
    return toolbarView;
  }
  return new Plugin({view})
}

class ToolbarView {

  constructor(editorView, config, schema) {
    this.editorView = editorView;
    this.config = config;
    this.nodes = schema.nodes;
    this.marks = schema.marks;
    this.spacer = null;
    this.maxHeight = 0;
    this.widthForMaxHeight = 0;
    this.floating = false;
    this.scrollHandler = null;
    this.root = editorView.root
    this.wrapper = crel("div", {class: prefix + "-wrapper"})
    this.menu = this.wrapper.appendChild(crel("div", {class: prefix}))
    this.menu.className = prefix

    if (editorView.dom.parentNode)
      editorView.dom.parentNode.replaceChild(this.wrapper, editorView.dom)
    this.wrapper.appendChild(editorView.dom)

    let {dom, update} = renderGrouped(editorView, this.itemGroups(config));
    this.contentUpdate = update; // (state) => { return true };
    this.menu.appendChild(dom)
    this.update();

    if (!isIOS()) { // The toolbar floats at the top
      this.updateFloat();
      let potentialScrollers = getAllWrapping(this.wrapper);
      this.scrollHandler = (e) => {
        let root = this.editorView.root;
        if (!(root.body || root).contains(this.wrapper))
          potentialScrollers.forEach(el => el.removeEventListener("scroll", this.scrollHandler));
        else
          this.updateFloat(e.target.getBoundingClientRect ? e.target : undefined);
      };
      potentialScrollers.forEach(el => el.addEventListener('scroll', this.scrollHandler));
    }

  }

  itemGroups(config) {
    let itemGroups = [];
    let {formatBar, styleMenu, styleBar} = config.visibility;
    if (styleMenu) itemGroups.push(this.styleMenuItems(config));
    if (styleBar) itemGroups.push(this.styleBarItems(config));
    if (formatBar) itemGroups.push(this.formatItems(config));
    return itemGroups;
  }

  /** Style Bar (List, Indent, Outdent) */

  styleBarItems(config) {
    let items = [];
    let {number, bullet, indent, outdent} = config.styleBar;
    if (number) items.push(this.toggleListItem(this.nodes.ordered_list, {label: 'format_list_numbered', class: 'material-symbols-outlined'}))
    if (bullet) items.push(this.toggleListItem(this.nodes.bullet_list, {label: 'format_list_bulleted', class: 'material-symbols-outlined'}))
    if (indent) items.push(this.wrapItem(this.nodes.blockquote, {label: 'format_indent_increase', class: 'material-symbols-outlined'}))
    if (outdent) items.push(this.liftItem({label: 'format_indent_decrease', class: 'material-symbols-outlined'}))
    return items;
  }

  toggleListItem(nodeType, options) {
    let passedOptions = {
      active: () => { return false },  // FIX
      enable: true
    }
    for (let prop in options) passedOptions[prop] = options[prop]
    return this.cmdItem(multiWrapInList(this.editorView, nodeType), passedOptions)
  }

  wrapItem(nodeType, options) {
    let passedOptions = {
      active: () => { return false },  // FIX
      enable: true
    }
    for (let prop in options) passedOptions[prop] = options[prop]
    return this.cmdItem(wrapIn(nodeType), passedOptions)
  }

  liftItem(options) {
    let passedOptions = {
      active: () => { return false },  // FIX
      enable: true
    }
    for (let prop in options) passedOptions[prop] = options[prop]
    return this.cmdItem(lift, passedOptions)
  }

  /** Format Bar */

  /**
   * Return the array of formatting MenuItems that should show per the config.
   * 
   * @param {*} config    The markupConfig that is passed-in, with boolean values in config.formatBar.
   * @returns [MenuItem]  The array of MenuItems that show as passed in `config`
   */
  formatItems(config) {
    let items = []
    let {bold, italic, underline, code, strikethrough, subscript, superscript} = config.formatBar;
    if (bold) items.push(this.formatItem(this.marks.strong, {label: 'format_bold', class: 'material-symbols-outlined'}))
    if (italic) items.push(this.formatItem(this.marks.em, {label: 'format_italic', class: 'material-symbols-outlined'}))
    if (underline) items.push(this.formatItem(this.marks.u, {label: 'format_underline', class: 'material-symbols-outlined'}))
    if (code) items.push(this.formatItem(this.marks.code, {label: 'data_object', class: 'material-symbols-outlined'}))
    if (strikethrough) items.push(this.formatItem(this.marks.s, {label: 'strikethrough_s', class: 'material-symbols-outlined'}))
    if (subscript) items.push(this.formatItem(this.marks.sub, {label: 'subscript', class: 'material-symbols-outlined'}))
    if (superscript) items.push(this.formatItem(this.marks.sup, {label: 'superscript', class: 'material-symbols-outlined'}))
    return items;
  }

  formatItem(markType, options) {
    let passedOptions = {
      active: (state) => { return this.markActive(state, markType) },
      enable: true
    }
    for (let prop in options) passedOptions[prop] = options[prop]
    return this.cmdItem(toggleMark(markType), passedOptions)
  }

  markActive(state, type) {
    let { from, $from, to, empty } = state.selection
    if (empty) return type.isInSet(state.storedMarks || $from.marks())
    else return state.doc.rangeHasMark(from, to, type)
  }

  cmdItem(cmd, options) {
    let passedOptions = {
      label: options.title,
      run: cmd
    }
    for (let prop in options) passedOptions[prop] = options[prop]
    if ((!options.enable || options.enable === true) && !options.select)
      passedOptions[options.enable ? "enable" : "select"] = state => cmd(state)

    return new MenuItem(passedOptions)
  }

  /** Style DropDown */

  /**
   * Return the Dropdown containing the styling MenuItems that should show per the config.
   * 
   * @param {*} config    The markupConfig that is passed-in, with boolean values in config.styleMenu.
   * @returns [Dropdown]  The array of MenuItems that show as passed in `config`
   */
  styleMenuItems(config) {
    let items = []
    let {p, h1, h2, h3, h4, h5, h6, codeblock} = config.styleMenu;
    if (p) items.push(blockTypeItem(this.nodes.paragraph, {label: 'Normal'}))
    if (h1) items.push(blockTypeItem(this.nodes.heading, {attrs: {level: 1}, label: 'Header 1'}))
    if (h2) items.push(blockTypeItem(this.nodes.heading, {attrs: {level: 2}, label: 'Header 2'}))
    if (h3) items.push(blockTypeItem(this.nodes.heading, {attrs: {level: 3}, label: 'Header 3'}))
    if (h4) items.push(blockTypeItem(this.nodes.heading, {attrs: {level: 4}, label: 'Header 4'}))
    if (h5) items.push(blockTypeItem(this.nodes.heading, {attrs: {level: 5}, label: 'Header 5'}))
    if (h6) items.push(blockTypeItem(this.nodes.heading, {attrs: {level: 6}, label: 'Header 6'}))
    if (codeblock) items.push(blockTypeItem(this.nodes.code_block, {label: 'Code'}))
    return [new Dropdown(items, {label: 'Style', title: 'Style'})]
  }

  update() {
    if (this.editorView.root != this.root) {
      let { dom, update } = renderGrouped(this.editorView, this.itemGroups(this.config));
      this.contentUpdate = update;
      this.menu.replaceChild(dom, this.menu.firstChild);
      this.root = this.editorView.root;
    }
    this.contentUpdate(this.editorView.state);
    if (this.floating) {
      this.updateScrollCursor();
    }
    else {
      if (this.menu.offsetWidth != this.widthForMaxHeight) {
        this.widthForMaxHeight = this.menu.offsetWidth;
        this.maxHeight = 0;
      }
      if (this.menu.offsetHeight > this.maxHeight) {
        this.maxHeight = this.menu.offsetHeight;
        this.menu.style.minHeight = this.maxHeight + "px";
      }
    }
  }

  updateScrollCursor() {
    let selection = this.editorView.root.getSelection();
    if (!selection.focusNode)
      return;
    let rects = selection.getRangeAt(0).getClientRects();
    let selRect = rects[selectionIsInverted(selection) ? 0 : rects.length - 1];
    if (!selRect)
      return;
    let menuRect = this.menu.getBoundingClientRect();
    if (selRect.top < menuRect.bottom && selRect.bottom > menuRect.top) {
      let scrollable = findWrappingScrollable(this.wrapper);
      if (scrollable)
        scrollable.scrollTop -= (menuRect.bottom - selRect.top);
    }
  }

  updateFloat(scrollAncestor) {
    let parent = this.wrapper, editorRect = parent.getBoundingClientRect(), top = scrollAncestor ? Math.max(0, scrollAncestor.getBoundingClientRect().top) : 0;
    if (this.floating) {
      if (editorRect.top >= top || editorRect.bottom < this.menu.offsetHeight + 10) {
        this.floating = false;
        this.menu.style.position = this.menu.style.left = this.menu.style.top = this.menu.style.width = "";
        this.menu.style.display = "";
        this.spacer.parentNode.removeChild(this.spacer);
        this.spacer = null;
      }
      else {
        let border = (parent.offsetWidth - parent.clientWidth) / 2;
        this.menu.style.left = (editorRect.left + border) + "px";
        this.menu.style.display = editorRect.top > (this.editorView.dom.ownerDocument.defaultView || window).innerHeight
          ? "none" : "";
        if (scrollAncestor)
          this.menu.style.top = top + "px";
      }
    }
    else {
      if (editorRect.top < top && editorRect.bottom >= this.menu.offsetHeight + 10) {
        this.floating = true;
        let menuRect = this.menu.getBoundingClientRect();
        this.menu.style.left = menuRect.left + "px";
        this.menu.style.width = menuRect.width + "px";
        if (scrollAncestor)
          this.menu.style.top = top + "px";
        this.menu.style.position = "fixed";
        this.spacer = crel("div", { class: prefix + "-spacer", style: `height: ${menuRect.height}px` });
        parent.insertBefore(this.spacer, this.menu);
      }
    }
  }

  destroy() {
    if (this.wrapper.parentNode)
      this.wrapper.parentNode.replaceChild(this.editorView.dom, this.wrapper)
  }

}

// Not precise, but close enough
function selectionIsInverted(selection) {
    if (selection.anchorNode == selection.focusNode)
        return selection.anchorOffset > selection.focusOffset;
    return selection.anchorNode.compareDocumentPosition(selection.focusNode) == Node.DOCUMENT_POSITION_FOLLOWING;
}

function findWrappingScrollable(node) {
    for (let cur = node.parentNode; cur; cur = cur.parentNode)
        if (cur.scrollHeight > cur.clientHeight)
            return cur;
}

function getAllWrapping(node) {
    let res = [node.ownerDocument.defaultView || window];
    for (let cur = node.parentNode; cur; cur = cur.parentNode)
        res.push(cur);
    return res;
}