/**
 * The markupeditor-base holds its configuration in a global `markupConfig` which is referenced in 
 * `main.js`. This object needs to be set up before a MarkupEditor web page is launched. This needs to be  
 * done as a script before `dist/markupeditor.umd.js` is loaded. You can see this in the `demo/index.html`, and
 * in markupeditor-vs, the VSCode extension, in the webview panel setup done in `markupCoordinator.js`.
 * It's a bit odd that the markupeditor-base package references something like `markupConfig` but itself
 * never defines it. The intent is that something external creates an actual web page that holds onto the
 * MarkupEditor and loads all of its scripts - like `demo/index.html` does in the simplest case. That external
 * thing is what controls and defines the `markupConfig`. In the VSCode extension, that is done via the standard 
 * VSCode extension settings mechanisms. In Swift, it is done using the MarkupEditor settings. In the
 * markupeditor-base demo, the global `markupConfig` exists but is `undefined`, which results in `main.js` using
 * the value returned from `MenuConfig.standard()`.
 */

import crel from "crelt"
import {Plugin} from "prosemirror-state"
import {renderGrouped} from  "./menu"

export let toolbarView;

export function toolbar(prefix, content) {
  let view = function view(editorView) {
    toolbarView = new ToolbarView(editorView, prefix, content)
    return toolbarView;
  }
  return new Plugin({view})
}

class ToolbarView {

  constructor(editorView, prefix, content) {
    this.prefix = prefix + "-toolbar";
    this.editorView = editorView;
    this.content = content;
    this.root = editorView.root
    this.wrapper = crel("div", {class: this.prefix + "-wrapper"})
    this.menu = this.wrapper.appendChild(crel("div", {class: this.prefix, id: this.prefix}))
    this.menu.className = this.prefix
    if (editorView.dom.parentNode)
      editorView.dom.parentNode.replaceChild(this.wrapper, editorView.dom)
    this.wrapper.appendChild(editorView.dom)

    let {dom, update} = renderGrouped(editorView, this.content);
    this.contentUpdate = update;
    this.menu.appendChild(dom)
    this.update();
  }

  update() {
    if (this.editorView.root != this.root) {
      this.refresh()
      this.root = this.editorView.root;
    }
    return this.contentUpdate(this.editorView.state);
  }

  /**
   * Insert an array of MenuItems at the front of the toolbar
   * @param {[MenuItem]} items 
   */
  prepend(items) {
    this.content = [items].concat(this.content)
    this.refresh()
  }

  /**
   * Add an array of MenuItems at the end of the toolbar
   * @param {[MenuItem]} items 
   */
  append(items) {
    this.content = this.content.concat([items])
    this.refresh()
  }

  refresh() {
      let { dom, update } = renderGrouped(this.editorView, this.content);
      this.contentUpdate = update;
      // dom is an HTMLDocumentFragment and needs to replace all of menu
      this.menu.innerHTML = '';
      this.menu.appendChild(dom);
  }

  destroy() {
    if (this.wrapper.parentNode)
      this.wrapper.parentNode.replaceChild(this.editorView.dom, this.wrapper)
  }

}