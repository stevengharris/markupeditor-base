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
import {EditorState, NodeSelection} from "prosemirror-state"
import {toggleMark, wrapIn, lift, setBlockType} from "prosemirror-commands"
import {undo, redo} from "prosemirror-history"
import {
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
  paragraphStyle,
  tableHasHeader,
  cancelSearch,
  matchCase,
  matchCount,
  matchIndex,
  getLinkAttributes,
  selectFullLink,
  getSelectionRect,
  insertLinkCommand,
  deleteLinkCommand
} from "../markup"
import {TextField, openPrompt} from "./prompt"
import { EditorView } from "prosemirror-view"

let prefix;

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
    this.prefix = prefix + "-menuitem"
    this.spec = spec;
  }

  /**
  Renders the icon according to its [display
  spec](https://prosemirror.net/docs/ref/#menu.MenuItemSpec.display), and adds an event handler which
  executes the command when the representation is clicked.
  */
  render(view) {
    let spec = this.spec;
    let prefix = this.prefix;
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
    this.prefix = prefix + "-menu";
    this.options = options;
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
      label.appendChild(indicator)
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
    let wrapClass = (this.options.icon) ? this.prefix + "-dropdown-icon-wrap" : this.prefix + "-dropdown-wrap"
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
class DropdownSubmenu {

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
 * Represents the search MenuItem in the toolbar, which hides/shows the search bar and maintains its state.
 */
class SearchItem {

  constructor() {
    let options = {
      enable: (state) => { return true },
      active: (state) => { return this.showing() },
      title: 'Open search',
      icon: icons.search
    };
    this.item = cmdItem(this.toggleSearch.bind(this), options);
    this.text = '';
    this.caseSensitive = false;
  }

  showing() {
    return getSearchbar() != null;
  }

  toggleSearch(state, dispatch, view) {
    if (this.showing()) {
      this.hideSearchbar()
    } else {
      this.showSearchbar(state, dispatch, view);
    }
    this.update(state);
  }

  hideSearchbar() {
    let searchbar = getSearchbar();
    searchbar.parentElement.removeChild(searchbar);
    setClass(getSpacer(), searchbarShowing(), false);
    this.matchCaseDom = null;
    this.matchCaseItem = null;
    this.stopSearching();
  }

  stopSearching(focus=true) {
    cancelSearch();
    this.setStatus();
    if (focus) view.focus();
  }

  showSearchbar(state, dispatch, view) {
    let toolbar = getToolbar();
    if (!toolbar) return;
    let input = crel('input', { type: 'search', placeholder: 'Search document...' });
    input.addEventListener('keydown', e => {   // Use keydown because 'input' isn't triggered for Enter
      if (e.key === 'Enter') {
        let direction = (e.shiftKey) ? 'backward' : 'forward';
        if (direction == 'forward') {
          this.searchForwardCommand(view.state, view.dispatch, view)
        } else {
          this.searchBackwardCommand(view.state, view.dispatch, view);
        }
      }
    });
    input.addEventListener('input', e => {    // Use input so e.target.value contains what was typed
      this.text = e.target.value;
      this.stopSearching(false);              // Stop searching but leave focus in the input field
    });
    let idClass = prefix + "-searchbar";
    let searchbar = crel("div", { class: idClass, id: idClass }, input);
    this.addSearchButtons(view, searchbar);
    toolbar.parentElement.insertBefore(searchbar, toolbar.nextSibling);
    setClass(getSpacer(), searchbarShowing(), true);
  }

  setStatus() {
    let count = matchCount();
    let index = matchIndex();
    if (this.status) this.status.innerHTML = this.statusString(count, index);
  }

  statusString(count, index) {
    if (count == null) {
      return "";
    } else if (count == 0) {
      return "No matches";
    };
    return `${index}/${count}`;
  }

  addSearchButtons(view, searchbar) {
    
    // Overlay the status (index/count) on the input field
    this.status = crel("span", {class: prefix + "-searchbar-status"});

    // The searchBackward and searchForward buttons don't need updating
    let searchBackward = this.searchBackwardCommand.bind(this);
    let searchBackwardItem = cmdItem(searchBackward, {title: "Search backward", icon: icons.searchBackward});
    let searchBackwardDom = searchBackwardItem.render(view).dom;
    let searchBackwardSpan = crel("span", {class: prefix + "-menuitem"}, searchBackwardDom);
    let searchForward = this.searchForwardCommand.bind(this);
    let searchForwardItem = cmdItem(searchForward, {title: "Search forward", icon: icons.searchForward});
    let searchForwardDom = searchForwardItem.render(view).dom;
    let searchForwardSpan = crel("span", {class: prefix + "-menuitem"}, searchForwardDom);
    let separator = crel("span", {class: prefix + "-menuseparator"})

    // The toggleCase button needs to indicate the state of `caseSensitive`. Because the MenuItems we use 
    // in the SearchBar are not in a separate Plugin, and they are not part of the toolbar content, 
    // we need to handle updating "manually" by tracking and replacing the MenuItem and the dom it 
    // produces using its `render` method.
    let toggleMatchCase = this.toggleMatchCaseCommand.bind(this);
    this.matchCaseItem = cmdItem(
      toggleMatchCase, {
        title: "Match case", 
        icon: icons.matchCase,
        enable: () => {return true},
        active: () => {return this.caseSensitive}
      }
    );
    let {dom, update} = this.matchCaseItem.render(view);
    this.matchCaseDom = dom;
    let matchCaseSpan = crel("span", {class: prefix + "-menuitem"}, this.matchCaseDom);

    // Add the divs holding the MenuItems
    searchbar.appendChild(this.status)
    searchbar.appendChild(searchBackwardSpan);
    searchbar.appendChild(searchForwardSpan);
    searchbar.appendChild(separator);
    searchbar.appendChild(matchCaseSpan);

    // Then update the matchCaseItem to indicate the current setting, which is held in this 
    // SearchItem.
    update(view.state)
  }

  searchForwardCommand(state, dispatch, view) {
    let command = searchForCommand(this.text, "forward");
    command(state, dispatch, view);
    this.scrollToSelection(view);
    this.setStatus();
  }

  searchBackwardCommand(state, dispatch, view) {
    let command = searchForCommand(this.text, "backward");
    command(state, dispatch, view);
    this.scrollToSelection(view);
    this.setStatus();
  }

  toggleMatchCaseCommand(state, dispatch, view) {
    this.caseSensitive = !this.caseSensitive;
    matchCase(this.caseSensitive);
    if (view) {
      this.stopSearching(false);
      let {dom, update} = this.matchCaseItem.render(view);
      this.matchCaseDom.parentElement.replaceChild(dom, this.matchCaseDom);
      this.matchCaseDom = dom;
      update(state);
    }
  }
  
  /**
   * Use the dom to scroll to the node at the selection. The scrollIntoView when setting the 
   * selection in prosemirror-search findCommand doesn't work, perhaps because the selection 
   * is set on state.doc instead of state.tr.doc. 
   * 
   * TODO: This method has some problems in that it can
   * scroll to a paragraph, and then the next element will be in a bold section within the 
   * paragraph, causing it to jump. It would be much better if the prosemirror-search 
   * scrollIntoView worked properly.
   * 
   * @param {EditorView} view 
   */
  scrollToSelection(view) {
    const { node } = view.domAtPos(view.state.selection.anchor);
    // In case node is a Node not an Element
    let element = (node instanceof Element) ? node : node.parentElement;
    element?.scrollIntoView(false);
  }

  render(view) {
    let {dom, update} = this.item.render(view);
    this.update = update;
    return {dom, update};
  }

}

/**
 * Represents the link MenuItem in the toolbar, which opens the link dialog and maintains its state.
 */
class LinkItem {

  constructor() {
    let options = {
      enable: () => { return true }, // Always enabled because it is presented modally
      active: (state) => { return markActive(state, state.schema.marks.link) },
      title: 'Add or modify link',
      icon: icons.link
    };
    this.item = cmdItem(this.openLinkDialog.bind(this), options);
    this.dialog = null;
    this.selectionDiv = null;
  }

  /**
   * Command to open the link dialog and show it modally.
   *
   * @param {EditorState} state 
   * @param {fn(tr: Transaction)} dispatch 
   * @param {EditorView} view 
   */
  openLinkDialog(state, dispatch, view) {
    this.createLinkDialog(view)
    this.dialog.showModal();
  }

  /**
   * Create the dialog element for adding/modifying links. Append it to the wrapper after the toolbar.
   * 
   * @param {EditorView} view 
   */
  createLinkDialog(view) {
    this.href = getLinkAttributes().href;;   // href is what is linked-to, undefined if there is no link at selection

    // Select the full link if the selection is in one, and then set selDivRect that surrounds it
    selectFullLink(view);
    this.selectionDivRect = this.getSelectionDivRect()

    // Show the selection, because the view is not focused, so it doesn't otherwise show up
    this.setSelectionDiv();

    // Create the dialog in the proper position
    this.dialog = crel('dialog', { id: prefix + '-linkdialog', class: prefix + '-prompt', contenteditable: 'false' });
    this.setDialogLocation()

    let title = crel('p', (this.href) ? 'Modify link' : 'Add link');
    this.dialog.appendChild(title)

    this.setUrlArea(view)
    this.setButtons(view)
    this.okUpdate(view.state);
    this.cancelUpdate(view.state);
    getWrapper().appendChild(this.dialog);
  }

  /**
   * Create and add the input element for the URL.
   * 
   * Capture Enter to perform the command of the active button, either OK or Cancel.
   * 
   * @param {*} view 
   */
  setUrlArea(view) {
    this.urlArea = crel('input', { type: 'text', placeholder: 'Enter url...' })
    this.urlArea.value = this.href ?? '';
    this.urlArea.addEventListener('input', () => {
      if (this.isValidURL()) {
        setClass(this.okDom, 'Markup-menuitem-disabled', false);
      } else {
        setClass(this.okDom, 'Markup-menuitem-disabled', true);
      };
      this.okUpdate(view.state);
      this.cancelUpdate(view.state);
    });
    this.urlArea.addEventListener('keydown', e => {   // Use keydown because 'input' isn't triggered for Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.isValidURL()) {
          this.insertLink(view.state, view.dispatch, view);
        } else {
          this.cancel()
        }
      }
    })
    this.dialog.appendChild(this.urlArea)
  }

  /**
   * Create and append the buttons in the `dialog`.
   * 
   * Track the `dom` and `update` properties for the OK and Cancel buttons so we can show when
   * they are active as a way to indicate the default action on Enter in the `urlArea`.
   * 
   * @param {EditorView} view 
   */
  setButtons(view) {
    let buttonsDiv = crel('div', { class: prefix + '-prompt-buttons' })
    this.dialog.appendChild(buttonsDiv)

    if (this.isValidURL()) {
      let removeItem = cmdItem(this.deleteLink.bind(this), {
        class: prefix + '-menuitem',
        title: 'Remove',
        enable: () => { return true }
      })
      let {dom} = removeItem.render(view)
      buttonsDiv.appendChild(dom);
    } else {
      let spacer = crel('div', {class: prefix + '-menuitem'})
      spacer.style.visibility = 'hidden';
      buttonsDiv.appendChild(spacer)
    };

    let group = crel('div', {class: prefix + '-prompt-buttongroup'});
    let okItem = cmdItem(this.insertLink.bind(this), {
      class: prefix + '-menuitem',
      title: 'OK',
      active: () => {
        return this.isValidURL()
      },
      enable: () => {
        return this.isValidURL()
      }
    })
    let {dom: okDom, update: okUpdate} = okItem.render(view)
    this.okDom = okDom;
    this.okUpdate = okUpdate;
    group.appendChild(this.okDom)

    let cancelItem = cmdItem(this.cancel.bind(this), {
      class: prefix + '-menuitem',
      title: 'Cancel',
      active: () => {
        return !this.isValidURL()
      },
      enable: () => {
        return true
      }
    })
    let {dom: cancelDom, update: cancelUpdate} = cancelItem.render(view)
    this.cancelDom = cancelDom;
    this.cancelUpdate = cancelUpdate;
    group.appendChild(this.cancelDom)

    buttonsDiv.appendChild(group);
  }

  /**
   * Create and append a div that encloses the selection, with a class that displays it properly.
   */
  setSelectionDiv() {
    this.selectionDiv = crel('div', {id: prefix + '-selection', class: prefix + '-selection'})
    this.selectionDiv.style.top = this.selectionDivRect.top + 'px'
    this.selectionDiv.style.left = this.selectionDivRect.left + 'px'
    this.selectionDiv.style.width = this.selectionDivRect.width + 'px'
    this.selectionDiv.style.height = this.selectionDivRect.height + 'px'
    getWrapper().appendChild(this.selectionDiv)
  }

  /**
   * Return an object with location and dimension properties for the selection rectangle.
   * @returns {Object}  The {top, left, right, width, height, bottom} of the selection.
   */
  getSelectionDivRect() {
    let selrect = getSelectionRect();
    let top = selrect.top + window.scrollY
    let left = selrect.left + window.scrollX
    let right = selrect.right;
    let width = selrect.right - selrect.left
    let height = selrect.bottom - selrect.top
    let bottom = selrect.bottom;
    return {top: top, left: left, right: right, width: width, height: height, bottom: bottom}
  }

  /**
   * Set the `dialog` location on the screen so it is adjacent to the selection.
   */
  setDialogLocation() {
    // selRect is the position within the document. So, doesn't change even if the document is scrolled.
    let selrect = this.selectionDivRect

    // We need the dialogHeight and width because we can only position the dialog top and left. 
    // You would think that an element could be positioned by specifying right and bottom, but 
    // apparently not. Even when width is fixed, specifying right doesn't work. The values below
    // are dependent on toolbar.css for .Markup-prompt.
    let dialogHeight = 104
    let dialogWidth = 317

    // The dialog needs to be positioned within the document regardless of scroll, too, but the position is
    // set based on the direction from selrect that has the most screen real-estate. We always prefer right 
    // or left of the selection if we can fit it in the visible area on either side. We can bias it as 
    // close as we can to the vertical center. If we can't fit it right or left, then we will put it above
    // or below, whichever fits, biasing alignment as close as we can to the horizontal center.
    // Generally speaking, the selection itself is on the screen, so we want the dialog to be adjacent to 
    // it with the best chance of showing the entire dialog.
    let style = this.dialog.style
    let toolbarHeight = getSpacer().getBoundingClientRect().height
    let minTop = toolbarHeight + scrollY + 4
    let maxTop = scrollY + innerHeight - dialogHeight - 4
    let minLeft = scrollX + 4;
    let maxLeft = innerWidth - dialogWidth - 4
    let fitsRight = window.innerWidth - selrect.right - window.scrollX > dialogWidth + 4
    let fitsLeft = selrect.left - window.scrollX > dialogWidth + 4
    let fitsTop = selrect.top - window.scrollY - toolbarHeight > dialogHeight + 4
    if (fitsRight) {           // Put dialog right of selection
      style.left = selrect.right + 4 + scrollX + 'px'
      style.top = Math.min(Math.max((selrect.top + (selrect.height / 2) - (dialogHeight / 2)), minTop), maxTop) + 'px';
    } else if (fitsLeft) {     // Put dialog left of selection
      style.left = selrect.left - dialogWidth - 4 + scrollX + 'px'
      style.top = Math.min(Math.max((selrect.top + (selrect.height / 2) - (dialogHeight / 2)), minTop), maxTop) + 'px';
    } else if (fitsTop) {     // Put dialog above selection
      style.left = Math.min(Math.max((selrect.left + (selrect.width / 2) - (dialogWidth / 2)), minLeft), maxLeft) + 'px';
      style.top = Math.min(Math.max((selrect.top - dialogHeight - 4), minTop), maxTop) + 'px'
    } else {                                          // Put dialog below selection, even if it's off the screen somewhat
      style.left = Math.min(Math.max((selrect.left + (selrect.width / 2) - (dialogWidth / 2)), minLeft), maxLeft) + 'px';
      style.top = Math.min((selrect.bottom + 4), maxTop) + 'px'
    }
  }

  isValidURL() {
    return URL.canParse(this.urlValue())
  }

  /**
   * Return the string from the `urlArea`.
   * @returns {string}
   */
  urlValue() {
    return this.urlArea.value
  }

  /**
   * Insert the link in the urlArea if it's valid, deleting any existing link first. Close if it worked.
   * 
   * @param {EditorState} state 
   * @param {fn(tr: Transaction)} dispatch 
   * @param {EditorView} view 
   */
  insertLink(state, dispatch, view) {
    if (!this.isValidURL()) return;
    if (this.href) deleteLinkCommand()(state, dispatch, view);
    let command = insertLinkCommand(this.urlValue());
    let result = command(view.state, view.dispatch);
    if (result) this.cancel();
  }

  /**
   * Close the link dialog without doing anything else.
   */
  cancel() {
    return this.closeLinkDialog()
  }

  /**
   * Delete the link at the selection. Close if it worked.
   * 
   * @param {EditorState} state 
   * @param {fn(tr: Transaction)} dispatch 
   * @param {EditorView} view 
   */
  deleteLink(state, dispatch, view) {
    let command = deleteLinkCommand();
    let result = command(state, dispatch, view);
    if (result) this.cancel();
  }

  /**
   * Close the link dialog, deleting the dialog and selectionDiv and clearing out state.
   */
  closeLinkDialog() {
    this.selectionDiv?.parentElement?.removeChild(this.selectionDiv)
    this.selectionDiv = null;
    this.dialog?.close()
    this.dialog?.parentElement?.removeChild(this.dialog)
    this.dialog = null;
    this.okUpdate = null;
    this.cancelUpdate = null;
  }

  /**
   * Show the MenuItem that LinkItem holds in its `item` property.
   * @param {EditorView} view 
   * @returns {Object}    The {dom, update} object for `item`.
   */
  render(view) {
    return this.item.render(view);
  }

}

/**
 * Build an array of MenuItems and nested MenuItems that comprise the content of the Toolbar 
 * based on the `config` and `schema`.
 * 
 * This is the first entry point for menu that is called from `setup/index.js', returning the 
 * contents that `renderGrouped` can display. It also sets the prefix used locally.
 * 
 * @param {string}  basePrefix  The prefix used when building style strings, "Markup" by default.
 * @param {Object}  config      The configuration of the menu.
 * @param {Schema}  schema      The schema that holds node and mark types.
 * @returns [MenuItem]    The array of MenuItems or nested MenuItems used by `renderGrouped`.
 */
export function buildMenuItems(basePrefix, config, schema) {
  prefix = basePrefix;
  let itemGroups = [];
  let { correctionBar, insertBar, formatBar, styleMenu, styleBar, search } = config.visibility;
  if (correctionBar) itemGroups.push(correctionBarItems());
  if (insertBar) itemGroups.push(insertBarItems(config, schema));
  if (styleMenu) itemGroups.push(styleMenuItems(config, schema));
  if (styleBar) itemGroups.push(styleBarItems(config, schema));
  if (formatBar) itemGroups.push(formatItems(config, schema));
  if (search) itemGroups.push([new SearchItem()])
  return itemGroups;
}

/* Utility functions */

/**
 * Return the toolbar div in `view`
 * @param {EditorView} view 
 * @returns {HTMLDivElement}  The toolbar div in the view
 */
function getToolbar() {
  return document.getElementById(prefix + "-toolbar");
}

function getSearchbar() {
  return document.getElementById(prefix + "-searchbar");
}

function getSpacer() {
  return document.getElementById(prefix + "-toolbar-spacer")
}

function getWrapper() {
  return getSpacer().parentElement;
}

function searchbarShowing() {
  return prefix + "-searchbar-showing"
}

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
        rendered.push(crel("div", { class: prefix + "-menu-dropdown-item" }, dom));
        updates.push(update);
    };
    return { dom: rendered, update: combineUpdates(updates, rendered) };
}

/* Correction Bar (Undo, Redo) */

function correctionBarItems() {
  let items = [];
  items.push(undoItem({ title: 'Undo', icon: icons.undo }));
  items.push(redoItem({ title: 'Redo', icon: icons.redo }));
  return items;
}

function undoItem(options) {
  let passedOptions = {
    enable: (state) => undo(state)
  }
  for (let prop in options)
    passedOptions[prop] = options[prop];
  return cmdItem(undo, passedOptions)
}

function redoItem(options) {
  let passedOptions = {
    enable: (state) => redo(state)
  }
  for (let prop in options)
    passedOptions[prop] = options[prop];
  return cmdItem(redo, passedOptions)
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
  if (link) items.push(new LinkItem())
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
    icon: icons.image,
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

function tableMenuItems(config, schema) {
  let items = []
  let { header, border } = config.tableMenu;
  let createItems = []
  createItems.push(insertTableItem(1, 1, {label: '1 column'}))
  createItems.push(insertTableItem(1, 2, {label: '2 columns'}))
  createItems.push(insertTableItem(1, 3, {label: '3 columns'}))
  createItems.push(insertTableItem(1, 4, {label: '4 columns'}))
  items.push(new DropdownSubmenu(createItems, {title: 'Insert new table', label: 'Create'}))
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
    items.push(toggleListItem(schema, schema.nodes.bullet_list, { title: 'Toggle bulleted list', icon: icons.bulletList }))
    items.push(toggleListItem(schema, schema.nodes.ordered_list, { title: 'Toggle numbered list', icon: icons.orderedList }))
  }
  if (dent) {
    items.push(indentItem(schema.nodes.blockquote, { title: 'Increase indent', icon: icons.blockquote }))
    items.push(outdentItem({ title: 'Decrease indent', icon: icons.lift }))
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
  if (bold) items.push(formatItem(schema.marks.strong, { title: 'Toggle bold', icon: icons.strong }))
  if (italic) items.push(formatItem(schema.marks.em, { title: 'Toggle italic', icon: icons.em }))
  if (underline) items.push(formatItem(schema.marks.u, { title: 'Toggle underline', icon: icons.u }))
  if (code) items.push(formatItem(schema.marks.code, { title: 'Toggle code', icon: icons.code }))
  if (strikethrough) items.push(formatItem(schema.marks.s, { title: 'Toggle strikethrough', icon: icons.s }))
  if (subscript) items.push(formatItem(schema.marks.sub, { title: 'Toggle subscript', icon: icons.sub }))
  if (superscript) items.push(formatItem(schema.marks.sup, { title: 'Toggle superscript', icon: icons.sup }))
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

const styleLabels = {
  'P': 'Normal',
  'H1': 'Header 1',
  'H2': 'Header 2',
  'H3': 'Header 3',
  'H4': 'Header 4',
  'H5': 'Header 5',
  'H6': 'Header 6',
  'PRE': 'Code'
}

/**
 * Return the Dropdown containing the styling MenuItems that should show per the config.
 * 
 * @param {*} config    The markupConfig that is passed-in, with boolean values in config.styleMenu.
 * @returns [Dropdown]  The array of MenuItems that show as passed in `config`
 */
function styleMenuItems(config, schema) {
  let items = []
  let { p, h1, h2, h3, h4, h5, h6, codeblock } = config.styleMenu;
  if (p) items.push(blockTypeItem(schema.nodes.paragraph, { label: styleLabels['P'] }))
  if (h1) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 1 }, label: styleLabels['H1'] }))
  if (h2) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 2 }, label: styleLabels['H2'] }))
  if (h3) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 3 }, label: styleLabels['H3'] }))
  if (h4) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 4 }, label: styleLabels['H4'] }))
  if (h5) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 5 }, label: styleLabels['H5'] }))
  if (h6) items.push(blockTypeItem(schema.nodes.heading, { attrs: { level: 6 }, label: styleLabels['H6'] }))
  if (codeblock) items.push(blockTypeItem(schema.nodes.code_block, { label: styleLabels['PRE'] }))
  let titleUpdate = (state) => {
    let style = paragraphStyle(state) ?? 'Style'
    return styleLabels[style] ?? style
  }
  return [new Dropdown(items, { title: 'Set paragraph style', label: 'Style', titleUpdate: titleUpdate })]
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
            let span = crel("span", { class: prefix + "-menuitem" }, dom);
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
    return crel("span", { class: prefix + "-menuseparator" });
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

/**
 *  A set of MarkupEditor icons. Used to identify the icon for a 
 * `MenuItem` by specifying the `svg`. The `svg` value was obtained from
 * https://fonts.google.com/icons for the icons identified in the comment,
 * with the `fill` attribute removed so it can be set in css.
 */
export const icons = {
  undo: {
    // <span class="material-icons-outlined">undo</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>'
  },
  redo: {
    // <span class="material-icons-outlined">redo</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>'
  },
  strong: {
    // <span class="material-icons-outlined">format_bold</span>
    svg: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>`
  },
  em: {
    // <span class="material-icons-outlined">format_italic</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M200-200v-100h160l120-360H320v-100h400v100H580L460-300h140v100H200Z"/></svg>'
  },
  u: {
    // <span class="material-icons-outlined">format_underlined</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M200-120v-80h560v80H200Zm280-160q-101 0-157-63t-56-167v-330h103v336q0 56 28 91t82 35q54 0 82-35t28-91v-336h103v330q0 104-56 167t-157 63Z"/></svg>'
  },
  s: {
    // <span class="material-icons-outlined">strikethrough_s</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M486-160q-76 0-135-45t-85-123l88-38q14 48 48.5 79t85.5 31q42 0 76-20t34-64q0-18-7-33t-19-27h112q5 14 7.5 28.5T694-340q0 86-61.5 133T486-160ZM80-480v-80h800v80H80Zm402-326q66 0 115.5 32.5T674-674l-88 39q-9-29-33.5-52T484-710q-41 0-68 18.5T386-640h-96q2-69 54.5-117.5T482-806Z"/></svg>'
  },
  code: {
    // <span class="material-icons-outlined">data_object</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M560-160v-80h120q17 0 28.5-11.5T720-280v-80q0-38 22-69t58-44v-14q-36-13-58-44t-22-69v-80q0-17-11.5-28.5T680-720H560v-80h120q50 0 85 35t35 85v80q0 17 11.5 28.5T840-560h40v160h-40q-17 0-28.5 11.5T800-360v80q0 50-35 85t-85 35H560Zm-280 0q-50 0-85-35t-35-85v-80q0-17-11.5-28.5T120-400H80v-160h40q17 0 28.5-11.5T160-600v-80q0-50 35-85t85-35h120v80H280q-17 0-28.5 11.5T240-680v80q0 38-22 69t-58 44v14q36 13 58 44t22 69v80q0 17 11.5 28.5T280-240h120v80H280Z"/></svg>'
  },
  sub: {
    // <span class="material-icons-outlined">subscript</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M760-160v-80q0-17 11.5-28.5T800-280h80v-40H760v-40h120q17 0 28.5 11.5T920-320v40q0 17-11.5 28.5T880-240h-80v40h120v40H760Zm-525-80 185-291-172-269h106l124 200h4l123-200h107L539-531l186 291H618L482-457h-4L342-240H235Z"/></svg>'
  },
  sup: {
    // <span class="material-icons-outlined">superscript</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M760-600v-80q0-17 11.5-28.5T800-720h80v-40H760v-40h120q17 0 28.5 11.5T920-760v40q0 17-11.5 28.5T880-680h-80v40h120v40H760ZM235-160l185-291-172-269h106l124 200h4l123-200h107L539-451l186 291H618L482-377h-4L342-160H235Z"/></svg>'
  },
  link: {
    // <span class="material-icons-outlined">link</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"/></svg>',
  },
  image: {
    // <span class="material-icons-outlined">image</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z"/></svg>'
  },
  table: {
    // <span class="material-icons-outlined">table</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm240-240H200v160h240v-160Zm80 0v160h240v-160H520Zm-80-80v-160H200v160h240Zm80 0h240v-160H520v160ZM200-680h560v-80H200v80Z"/></svg>'
  },
  bulletList: {
    // <span class="material-icons-outlined">format_list_bulleted</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M360-200v-80h480v80H360Zm0-240v-80h480v80H360Zm0-240v-80h480v80H360ZM200-160q-33 0-56.5-23.5T120-240q0-33 23.5-56.5T200-320q33 0 56.5 23.5T280-240q0 33-23.5 56.5T200-160Zm0-240q-33 0-56.5-23.5T120-480q0-33 23.5-56.5T200-560q33 0 56.5 23.5T280-480q0 33-23.5 56.5T200-400Zm0-240q-33 0-56.5-23.5T120-720q0-33 23.5-56.5T200-800q33 0 56.5 23.5T280-720q0 33-23.5 56.5T200-640Z"/></svg>'
  },
  orderedList: {
    // <span class="material-icons-outlined">format_list_numbered</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M120-80v-60h100v-30h-60v-60h60v-30H120v-60h120q17 0 28.5 11.5T280-280v40q0 17-11.5 28.5T240-200q17 0 28.5 11.5T280-160v40q0 17-11.5 28.5T240-80H120Zm0-280v-110q0-17 11.5-28.5T160-510h60v-30H120v-60h120q17 0 28.5 11.5T280-560v70q0 17-11.5 28.5T240-450h-60v30h100v60H120Zm60-280v-180h-60v-60h120v240h-60Zm180 440v-80h480v80H360Zm0-240v-80h480v80H360Zm0-240v-80h480v80H360Z"/></svg>'
  },
  blockquote: {
    // <span class="material-icons-outlined">format_indent_increase</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M120-120v-80h720v80H120Zm320-160v-80h400v80H440Zm0-160v-80h400v80H440Zm0-160v-80h400v80H440ZM120-760v-80h720v80H120Zm0 440v-320l160 160-160 160Z"/></svg>'
  },
  lift: {
    // <span class="material-icons-outlined">format_indent_decrease</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M120-120v-80h720v80H120Zm320-160v-80h400v80H440Zm0-160v-80h400v80H440Zm0-160v-80h400v80H440ZM120-760v-80h720v80H120Zm160 440L120-480l160-160v320Z"/></svg>'
  },
  search: {
    // <span class="material-symbols-outlined">search</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg>'
  },
  searchForward: {
    // <span class="material-symbols-outlined">chevron_forward</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>'
  },
  searchBackward: {
    // <span class="material-symbols-outlined">chevron_backward</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/></svg>'
  },
  matchCase: {
    // <span class="material-symbols-outlined">match_case</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m131-252 165-440h79l165 440h-76l-39-112H247l-40 112h-76Zm139-176h131l-64-182h-4l-63 182Zm395 186q-51 0-81-27.5T554-342q0-44 34.5-72.5T677-443q23 0 45 4t38 11v-12q0-29-20.5-47T685-505q-23 0-42 9.5T610-468l-47-35q24-29 54.5-43t68.5-14q69 0 103 32.5t34 97.5v178h-63v-37h-4q-14 23-38 35t-53 12Zm12-54q35 0 59.5-24t24.5-56q-14-8-33.5-12.5T689-393q-32 0-50 14t-18 37q0 20 16 33t40 13Z"/></svg>'
  }
}

function getIcon(root, icon) {
    let doc = (root.nodeType == 9 ? root : root.ownerDocument) || document;
    let node = doc.createElement("span");
    node.className = prefix + "-icon";
    node.innerHTML = icon.svg;
    return node;
}