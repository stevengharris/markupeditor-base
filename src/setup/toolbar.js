
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

export function toolbar(config, schema) {
  let view = function view(editorView) {
    let toolbarView = new ToolbarView(editorView, config, schema)
      
    // Put the toolbar at the top of the editorView
    editorView.dom.parentNode.insertBefore(toolbarView.dom, editorView.dom);

    return toolbarView;
  }
  return new Plugin({view})
}

class ToolbarView {

  constructor(editorView, config, schema) {
    this.schema = schema;
    this.menuItems = this.itemGroups(config);
    this.editorView = editorView;
    this.dom = document.createElement("div")
    this.dom.style.display = "block";
    let {dom, update} = renderGrouped(editorView, this.menuItems);
    this.contentUpdate = update;
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
    if (bold) items.push(this.markItem(this.schema.marks.strong, {label: 'format_bold', class: 'material-symbols-outlined'}))
    if (italic) items.push(this.markItem(this.schema.marks.em, {label: 'format_italic', class: 'material-symbols-outlined'}))
    if (underline) items.push(this.markItem(this.schema.marks.u, {label: 'format_underline', class: 'material-symbols-outlined'}))
    return items;
  }

  markItem(markType, options) {
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
  styleItems(config) {
    let items = []
    let {p, h1, h2, h3, h4, h5, h6, codeblock} = config.styleMenu;
    if (p) items.push(blockTypeItem(this.schema.nodes.paragraph, {label: 'Normal'}))
    if (h1) items.push(blockTypeItem(this.schema.nodes.heading, {attrs: {level: 1}, label: 'Header 1'}))
    if (h2) items.push(blockTypeItem(this.schema.nodes.heading, {attrs: {level: 2}, label: 'Header 2'}))
    if (h3) items.push(blockTypeItem(this.schema.nodes.heading, {attrs: {level: 3}, label: 'Header 3'}))
    if (h4) items.push(blockTypeItem(this.schema.nodes.heading, {attrs: {level: 4}, label: 'Header 4'}))
    if (h5) items.push(blockTypeItem(this.schema.nodes.heading, {attrs: {level: 5}, label: 'Header 5'}))
    if (h6) items.push(blockTypeItem(this.schema.nodes.heading, {attrs: {level: 6}, label: 'Header 6'}))
    if (codeblock) items.push(blockTypeItem(this.schema.nodes.code_block, {label: 'Code'}))
    return [new Dropdown(items, {label: 'Style', title: 'Style'})]
  }

  update() {
    this.contentUpdate(this.editorView.state);
  }

  destroy() { this.dom.remove() }

}