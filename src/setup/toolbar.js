
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

import {Plugin} from "prosemirror-state"
import {toggleMark} from "prosemirror-commands"
import {MenuItem, Dropdown, renderGrouped, blockTypeItem} from "prosemirror-menu"
import {schema} from "../schema"

export function toolbar(key, config, schema) {
  let view = function view(editorView) {
    let toolbarView = new ToolbarView(editorView, config, schema)
      
    // Put the toolbar at the top of the editorView
    editorView.dom.parentNode.insertBefore(toolbarView.dom, editorView.dom);

    return toolbarView;
  }
  return new Plugin({key: key, view})
}

class ToolbarView {

  constructor(editorView, config, schema) {
    console.log("Show format bar: " + config.visibility.formatBar)
    console.log("Show style menu: " + config.visibility.styleMenu)
    this.menuItems = this.itemGroups(config);
    this.editorView = editorView;
    this.dom = document.createElement("div")
    this.dom.style.display = "block";
    let {dom, update} = renderGrouped(editorView, this.menuItems);
    //this.contentUpdate = update
    this.dom.appendChild(dom);
  }

  itemGroups(config) {
    let itemGroups = [];
    let {formatBar, styleMenu} = config.visibility;
    if (formatBar) itemGroups.push(this.markItems(config));
    if (styleMenu) itemGroups.push(this.styleItems(config));
    return itemGroups;
  }

  /** Format Bar */

  /**
   * Return the array of formatting MenuItems that should show per the config.
   * 
   * @param {*} config    The markupConfig that is passed-in, with boolean values in config.formatBar.
   * @returns [MenuItem]  The array of MenuItems that show as passed in `config`
   */
  markItems(config) {
    let items = []
    let {bold, italic, underline} = config.formatBar;
    if (bold) items.push(this.markItem(schema.marks.strong, {label: 'format_bold', class: 'material-symbols-outlined'}))
    if (italic) items.push(this.markItem(schema.marks.em, {label: 'format_italic', class: 'material-symbols-outlined'}))
    if (underline) items.push(this.markItem(schema.marks.u, {label: 'format_underline', class: 'material-symbols-outlined'}))
    return items;
  }

  markItem(markType, options) {
    let passedOptions = {
      active(state) { return this.markActive(state, markType) },
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

  styleItems(config) {
    let items = []
    let {p, h1, h2, h3, h4, h5, h6} = config.styleMenu;
    if (p) items.push(blockTypeItem(schema.nodes.paragraph, {label: 'P'}))
    if (h1) items.push(blockTypeItem(schema.nodes.heading, {attrs: {level: 1}, label: 'H1'}))
    if (h2) items.push(blockTypeItem(schema.nodes.heading, {attrs: {level: 2}, label: 'H2'}))
    if (h3) items.push(blockTypeItem(schema.nodes.heading, {attrs: {level: 3}, label: 'H3'}))
    if (h4) items.push(blockTypeItem(schema.nodes.heading, {attrs: {level: 4}, label: 'H4'}))
    if (h5) items.push(blockTypeItem(schema.nodes.heading, {attrs: {level: 5}, label: 'H5'}))
    if (h6) items.push(blockTypeItem(schema.nodes.heading, {attrs: {level: 6}, label: 'H6'}))
    return [new Dropdown(items, {label: 'Style', title: 'Style'})]
  }

  //addToolbar(toolbarButtons, editorView) {
  //  // Create div containing button
  //  this.dom = document.createElement("div")
  //  this.dom.style.display = "block";
  //  toolbarButtons.forEach(({ dom }) => this.dom.appendChild(dom));
//
  //  this.dom.addEventListener("mousedown", e => {
  //    e.preventDefault()
  //    editorView.focus()
  //    toolbarButtons.forEach(({ command, dom }) => {
  //      if (dom.contains(e.target))
  //        command(editorView.state, editorView.dispatch, editorView)
  //    })
  //  })
  //}

  update() {
    console.log("update")
  }
  //update(view, lastState) {
  //  console.log("update")
  //  // Update if popup should show or not.
  //  //this.selectionUpdate(view, lastState);
//
  //  // If clicked on a toolbox button, make an update on that:
  //  this.buttons.forEach(({ command, dom }) => {
  //    let active = command(this.editorView.state, null, this.editorView)
  //    //dom.style.display = active ? "" : "none"
  //  })
  //}

  selectionUpdate(view, lastState) {
    console.log("selectionUpdate")
    let state = view.state
    // Don't do anything if the document/selection didn't change
    if (lastState && lastState.doc.eq(state.doc) &&
      lastState.selection.eq(state.selection)) return

    // Hide the tooltip if the selection is empty
    //if (state.selection.empty) {
    //	this.dom.style.display = "none"
    //  	return
    //}

    // Otherwise, reposition it and update its content
    this.dom.style.display = ""
    let { from, to } = state.selection
    // These are in screen coordinates
    let start = view.coordsAtPos(from), end = view.coordsAtPos(to)
    // The box in which the tooltip is positioned, to use as base
    let box = this.dom.offsetParent.getBoundingClientRect()
    // Find a center-ish x position from the selection endpoints (when
    // crossing lines, end may be more to the left)
    let left = Math.max((start.left + end.left) / 2, start.left + 3)
    this.dom.style.left = (left - box.left) - 425 + "px"
    this.dom.style.bottom = (box.bottom - start.top) + "px"
    //this.tooltip.textContent = to - from
  }

  destroy() { this.dom.remove() }
}

//function heading(level) {
//  return {
//    command: setBlockType(schema.nodes.heading, { level }),
//    dom: toolbarButton("H" + level, null)
//  }
//}

//function toolbarButton(text, name) {
//  let div = document.createElement("div");
//  div.className = "material-symbols-outlined";
//  div.textContent = name ?? text;
//  return div;
//}

// Buttons in toolbar. They have a command assignment (command), and DOM representation description (dom).
//let toolbarButtons = [
//  { command: toggleMark(schema.marks.strong), dom: toolbarButton(null, "format_indent_increase") },
//  { command: toggleMark(schema.marks.em), dom: toolbarButton(null, "format_italic") },
//  { command: wrapIn(schema.nodes.blockquote), dom: toolbarButton(null, "format_bold") },
//  { command: wrapIn(schema.nodes.blockquote), dom: toolbarButton(null, "format_indent_decrease") }
//];

/*
import crel from "crel"



import {renderGrouped} from "prosemirror-menu"

import styles from '@material-design-icons/font/outlined.css';

const prefix = "ProseMirror-menubar"

function isIOS() {
  if (typeof navigator == "undefined") return false
  let agent = navigator.userAgent
  return !/Edge\/\d/.test(agent) && /AppleWebKit/.test(agent) && /Mobile\/\w+/.test(agent)
}

// :: (Object) → Plugin
// A plugin that will place a menu bar above the editor. Note that
// this involves wrapping the editor in an additional `<div>`.
//
//   options::-
//   Supports the following options:
//
//     content:: [[MenuElement]]
//     Provides the content of the menu, as a nested array to be
//     passed to `renderGrouped`.
//
//     floating:: ?bool
//     Determines whether the menu floats, i.e. whether it sticks to
//     the top of the viewport when the editor is partially scrolled
//     out of view.
export function toolbar(options) {
  return new Plugin({
    view(editorView) { return new ToolbarView(editorView, options) }
  })
}

class ToolbarView {
  constructor(editorView, options) {
    this.editorView = editorView
    this.options = options

    this.wrapper = crel("div", {class: prefix + "-wrapper"})
    this.menu = this.wrapper.appendChild(crel("div", {class: prefix}))
    this.menu.className = prefix
    this.spacer = null

    editorView.dom.parentNode.replaceChild(this.wrapper, editorView.dom)
    this.wrapper.appendChild(editorView.dom)

    this.maxHeight = 0
    this.widthForMaxHeight = 0
    this.floating = false

    let {dom, update} = renderGrouped(this.editorView, this.options.content)
    this.contentUpdate = update
    this.menu.appendChild(dom)
    this.update()

    if (options.floating && !isIOS()) {
      this.updateFloat()
      let potentialScrollers = getAllWrapping(this.wrapper)
      this.scrollFunc = (e) => {
        let root = this.editorView.root
        if (!(root.body || root).contains(this.wrapper)) {
            potentialScrollers.forEach(el => el.removeEventListener("scroll", this.scrollFunc))
        } else {
            this.updateFloat(e.target.getBoundingClientRect && e.target)
        }
      }
      potentialScrollers.forEach(el => el.addEventListener('scroll', this.scrollFunc))
    }
  }

  update() {
    this.contentUpdate(this.editorView.state)

    if (this.floating) {
      this.updateScrollCursor()
    } else {
      if (this.menu.offsetWidth != this.widthForMaxHeight) {
        this.widthForMaxHeight = this.menu.offsetWidth
        this.maxHeight = 0
      }
      if (this.menu.offsetHeight > this.maxHeight) {
        this.maxHeight = this.menu.offsetHeight
        this.menu.style.minHeight = this.maxHeight + "px"
      }
    }
  }

  updateScrollCursor() {
    let selection = this.editorView.root.getSelection()
    if (!selection.focusNode) return
    let rects = selection.getRangeAt(0).getClientRects()
    let selRect = rects[selectionIsInverted(selection) ? 0 : rects.length - 1]
    if (!selRect) return
    let menuRect = this.menu.getBoundingClientRect()
    if (selRect.top < menuRect.bottom && selRect.bottom > menuRect.top) {
      let scrollable = findWrappingScrollable(this.wrapper)
      if (scrollable) scrollable.scrollTop -= (menuRect.bottom - selRect.top)
    }
  }

  updateFloat(scrollAncestor) {
    let parent = this.wrapper, editorRect = parent.getBoundingClientRect(),
        top = scrollAncestor ? Math.max(0, scrollAncestor.getBoundingClientRect().top) : 0

    if (this.floating) {
      if (editorRect.top >= top || editorRect.bottom < this.menu.offsetHeight + 10) {
        this.floating = false
        this.menu.style.position = this.menu.style.left = this.menu.style.top = this.menu.style.width = ""
        this.menu.style.display = ""
        this.spacer.parentNode.removeChild(this.spacer)
        this.spacer = null
      } else {
        let border = (parent.offsetWidth - parent.clientWidth) / 2
        this.menu.style.left = (editorRect.left + border) + "px"
        this.menu.style.display = (editorRect.top > window.innerHeight ? "none" : "")
        if (scrollAncestor) this.menu.style.top = top + "px"
      }
    } else {
      if (editorRect.top < top && editorRect.bottom >= this.menu.offsetHeight + 10) {
        this.floating = true
        let menuRect = this.menu.getBoundingClientRect()
        this.menu.style.left = menuRect.left + "px"
        this.menu.style.width = menuRect.width + "px"
        if (scrollAncestor) this.menu.style.top = top + "px"
        this.menu.style.position = "fixed"
        this.spacer = crel("div", {class: prefix + "-spacer", style: `height: ${menuRect.height}px`})
        parent.insertBefore(this.spacer, this.menu)
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
  if (selection.anchorNode == selection.focusNode) return selection.anchorOffset > selection.focusOffset
  return selection.anchorNode.compareDocumentPosition(selection.focusNode) == Node.DOCUMENT_POSITION_FOLLOWING
}

function findWrappingScrollable(node) {
  for (let cur = node.parentNode; cur; cur = cur.parentNode)
    if (cur.scrollHeight > cur.clientHeight) return cur
}

function getAllWrapping(node) {
    let res = [window]
    for (let cur = node.parentNode; cur; cur = cur.parentNode)
        res.push(cur)
    return res
}
*/