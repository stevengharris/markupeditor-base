/**
 * The ToolbarView contains the `content` that is passed to it. The content is an array (or nested arrays) of 
 * MenuItems, which the ToolbarView renders using `renderGrouped`. The contents passed to the
 * ToolbarView is defined in `menu.js` using `buildMenuItems` by passing the config that defines what is 
 * visible (the toolbar itself and the subtoolbars within it), and what MenuItems are added to each 
 * subtoolbar. Note that the ToolbarView uses a class and label to display each item, as defined in 
 * `menu.js`. The class and labels are specific to Google's Material Design (https://fonts.google.com/icons)
 * and the web page displaying the toolbar will need to load `material-icons-outlines.woff2`.
 * 
 * Right now the markupeditorjs holds its configuration in a global `markupconfig` which is referenced in 
 * `main.js`. This object needs to be set up before a MarkupEditor web page is launched, which I'm currently 
 * doing in a script that is loaded before markupeditor.js. You can't see that in markupeditorjs, but you 
 * can see it in markupeditorvs, the VSCode extension, in the webview panel set up done in markupCoordinator.js.
 * It's a bit odd that the JavaScript MarkupEditor package references something like `markupconfig` but itself
 * never defines it. I might have to do something about that in the future, but the intent is that something 
 * somewhere creates an actual web page that holds onto the MarkupEditor and loads all of its scripts. That 
 * thing is what controls and defines the config. In the VSCode extension, that is done via the standard 
 * VSCode extension settings mechanisms. In Swift, it is done in the Swift using the MarkupEditor settings.
 */

import crel from "crelt"
import {Plugin} from "prosemirror-state"
import {renderGrouped} from  "./menu"

const prefix = "Markup"

function isIOS() {
  if (typeof navigator == "undefined") return false
  let agent = navigator.userAgent
  return !/Edge\/\d/.test(agent) && /AppleWebKit/.test(agent) && /Mobile\/\w+/.test(agent)
}

export function toolbar(content) {
  let view = function view(editorView) {
    let toolbarView = new ToolbarView(editorView, content)
    return toolbarView;
  }
  return new Plugin({view})
}

class ToolbarView {

  constructor(editorView, content) {
    this.prefix = prefix + "-toolbar";
    this.editorView = editorView;
    this.content = content;
    this.spacer = null;
    this.maxHeight = 0;
    this.widthForMaxHeight = 0;
    this.floating = false;
    this.scrollHandler = null;
    this.root = editorView.root
    this.wrapper = crel("div", {class: this.prefix + "-wrapper"})
    this.menu = this.wrapper.appendChild(crel("div", {class: this.prefix}))
    this.menu.className = this.prefix

    if (editorView.dom.parentNode)
      editorView.dom.parentNode.replaceChild(this.wrapper, editorView.dom)
    this.wrapper.appendChild(editorView.dom)

    let {dom, update} = renderGrouped(editorView, content);
    this.contentUpdate = update;
    this.menu.appendChild(dom)
    this.update();
  }

  update() {
    if (this.editorView.root != this.root) {
      let { dom, update } = renderGrouped(this.editorView, this.content);
      this.contentUpdate = update;
      this.menu.replaceChild(dom, this.menu.firstChild);
      this.root = this.editorView.root;
    }
    if (!this.spacer) {
      let spacerHeight = this.menu.offsetHeight;
      this.spacer = crel("div", { class: this.prefix + "-spacer", style: `height: ${spacerHeight}px` });
      this.wrapper.insertBefore(this.spacer, this.menu);
    }
    this.contentUpdate(this.editorView.state);
  }

  destroy() {
    if (this.wrapper.parentNode)
      this.wrapper.parentNode.replaceChild(this.editorView.dom, this.wrapper)
  }

}