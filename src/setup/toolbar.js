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

const prefix = "ProseMirror-menubar"

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
    this.editorView = editorView;
    this.content = content;
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

    let {dom, update} = renderGrouped(editorView, content);
    this.contentUpdate = update;
    this.menu.appendChild(dom)
    this.update();

    if (!isIOS()) { // The toolbar always stays at the top
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

  update() {
    if (this.editorView.root != this.root) {
      let { dom, update } = renderGrouped(this.editorView, this.content);
      this.contentUpdate = update;
      this.menu.replaceChild(dom, this.menu.firstChild);
      this.root = this.editorView.root;
    }
    this.contentUpdate(this.editorView.state);
    if (this.floating) {
      this.updateScrollCursor();
    } else {
      if (this.menu.offsetWidth != this.widthForMaxHeight) {
        this.widthForMaxHeight = this.menu.offsetWidth;
        this.maxHeight = 0;
      }
      if (this.menu.offsetHeight > this.maxHeight) {
        // Don't reset maxHeight because intermediate updates render as text, expanding height
        // this.maxHeight = this.menu.offsetHeight;
        //this.menu.style.minHeight = this.maxHeight + "px";
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
      if (editorRect.top >= top || editorRect.bottom < this.menu.offsetHeight + 12) {
        this.floating = false;
        this.menu.style.position = this.menu.style.left = this.menu.style.top = this.menu.style.width = "";
        this.menu.style.display = "";
        this.spacer.parentNode.removeChild(this.spacer);
        this.spacer = null;
      } else {
        let border = (parent.offsetWidth - parent.clientWidth) / 2;
        this.menu.style.left = (editorRect.left + border) + "px";
        this.menu.style.display = editorRect.top > (this.editorView.dom.ownerDocument.defaultView || window).innerHeight
          ? "none" : "";
        if (scrollAncestor)
          this.menu.style.top = top + "px";
      }
    } else {
      if (editorRect.top < top && editorRect.bottom >= this.menu.offsetHeight + 12) {
        this.floating = true;
        let menuRect = this.menu.getBoundingClientRect();
        let spacerHeight = this.menu.firstChild.getBoundingClientRect().height + 12;
        this.menu.style.left = menuRect.left + "px";
        this.menu.style.width = menuRect.width + "px";
        if (scrollAncestor)
          this.menu.style.top = top + "px";
        this.menu.style.position = "fixed";
        this.spacer = crel("div", { class: prefix + "-spacer", style: `height: ${spacerHeight}px` });
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