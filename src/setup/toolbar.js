import crel from "crelt"
import {Plugin} from "prosemirror-state"
import {prefix} from "../domaccess";
import {renderGrouped, renderGroupedFit, separator} from "./menuitems"

/**
 * The instance of ToolbarView in the editor.
 * 
 * @ignore
 */
export let toolbarView;

export function toolbar(content) {
  let view = function view(editorView) {
    toolbarView = new ToolbarView(editorView, content)
    return toolbarView;
  }
  return new Plugin({view})
}

class ToolbarView {

  constructor(editorView, content) {
    this.prefix = prefix + "-toolbar";
    this.editorView = editorView;
    this.content = content;
    this.root = editorView.root

    // Embed the toolbar and editorView in a wrapper.
    this.wrapper = crel("div", {class: this.prefix + "-wrapper"})
    this.toolbar = this.wrapper.appendChild(crel("div", {class: this.prefix, id: this.prefix}))
    // Since the menu adjusts to fit using a `MoreItem` for contents that doesn't fit, 
    // we need to refresh how it is rendered when resizing takes place.
    window.addEventListener('resize', ()=>{ this.refresh() })
    this.toolbar.className = this.prefix
    if (editorView.dom.parentNode)
      editorView.dom.parentNode.replaceChild(this.wrapper, editorView.dom)
    this.wrapper.appendChild(editorView.dom)

    let {dom, update} = renderGrouped(editorView, this.content);
    this.contentUpdate = update;
    this.toolbar.appendChild(dom)
  }

  update() {
    if (this.editorView.root != this.root) {
      this.refreshFit()
      this.root = this.editorView.root;
    }
    // Returning this.fitToolbar() will return this.contentUpdate(this.editorView.state) for 
    // the menu that fits in the width.
    return this.fitToolbar();
  }

  /**
   * Insert an array of MenuItems at the front of the toolbar
   * @param {Array<MenuItem>} items 
   */
  prepend(items) {
    this.content = [items].concat(this.content)
    this.refreshFit()
  }

  /**
   * Add an array of MenuItems at the end of the toolbar
   * @param {Array<MenuItem>} items 
   */
  append(items) {
    this.content = this.content.concat([items])
    this.refreshFit()
  }

  /** Refresh the toolbar, wrapping at the item at `wrapAtIndex` */
  refreshFit(wrapAtIndex) {
    let { dom, update } = renderGroupedFit(this.editorView, this.content, wrapAtIndex);
    this.contentUpdate = update;
    // dom is an HTMLDocumentFragment and needs to replace all of menu
    this.toolbar.innerHTML = '';
    this.toolbar.appendChild(dom);
  }

  /** 
   * Refresh the toolbar with all items and then fit it. 
   * We need to do this because when resize makes the toolbar wider, we don't want to keep 
   * the same `MoreItem` in place if more fits in the toolbar itself.
   */
  refresh() {
    let { dom, update } = renderGrouped(this.editorView, this.content);
    this.contentUpdate = update;
    this.toolbar.innerHTML = '';
    this.toolbar.appendChild(dom);
    this.fitToolbar()
  }

  /**
   * Fit the items in the toolbar into the toolbar width,
   * 
   * If the toolbar as currently rendered does not fit in the width, then execute `refreshFit`,
   * identifying the item to be replaced by a "more" button. That button will be a MoreItem
   * that toggles a sub-toolbar containing the items starting with the one at wrapAtIndex.
   */
  fitToolbar() {
    let items = this.toolbar.children;
    let menuRect = this.toolbar.getBoundingClientRect();
    let menuRight = menuRect.right;
    let separatorHTML = separator().outerHTML
    let wrapAtIndex = -1; // Track the last non-separator (i.e., content) item that was fully in-width
    for (let i = 0; i < items.length; i++) {
      let item = items[i]
      let itemRight = item.getBoundingClientRect().right
      if (item.outerHTML != separatorHTML) {
        if (itemRight > menuRight) {
          wrapAtIndex = Math.max(wrapAtIndex, 0);
          this.refreshFit(wrapAtIndex, 0); // Wrap starting at the item before this one, so the new DropDown fits
          return this.contentUpdate(this.editorView.state);;
        }
        wrapAtIndex++;  // Only count items that are not separators
      } 
    }
    return this.contentUpdate(this.editorView.state);
  }

  destroy() {
    if (this.wrapper.parentNode)
      this.wrapper.parentNode.replaceChild(this.editorView.dom, this.wrapper)
  }

}