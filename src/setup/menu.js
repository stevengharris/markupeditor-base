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
  modifyImageCommand,
} from "../markup"

let prefix;

/**
 * The `markupMenuConfig` is the default for the MarkupEditor. It can be overridden
 * by modifying it before you instantiate the MarkupEditor.
 * 
 * To customize the menu bar, for example, in your index.html:
 * 
 *    let menuConfig = MU.markupMenuConfig;         // Grab the standard menu config as a baseline
 *    menuConfig.visibility.correctionBar = true;   // Turn on undo/redo
 *    const markupEditor = new MU.MarkupEditor(
 *      document.querySelector('#editor'),
 *      '<h1>Hello, world!</h1>'
 *    )
 *    
 * Turn off entire toolbars and menus using the "visibility" settings. Turn off specific items
 * within a toolbar or menu using the settings specific to that toolbar or menu.
 */
export const markupMenuConfig = {
  "visibility": {             // Control the visibility of toolbars, etc
    "toolbar": true,          // Whether the toolbar is visible at all
    "correctionBar": false,   // Whether the correction bar (undo/redo) is visible
    "insertBar": true,        // Whether the insert bar (link, image, table) is visible
    "styleMenu": true,        // Whether the style menu (p, h1-h6, code) is visible
    "styleBar": true,         // Whether the style bar (bullet/numbered lists) is visible
    "formatBar": true,        // Whether the format bar (b, i, u, etc) is visible
    "tableMenu": true,        // Whether the table menu (create, add, delete, border) is visible
    "search": true,           // Whether the search menu item (hide/show search bar) is visible
  }, 
  "insertBar": { 
    "link": true,             // Whether the link menu item is visible
    "image": true,            // Whether the image menu item is visible
    "table": true,            // Whether the table menu is visible
  }, 
  "formatBar": { 
    "bold": true,             // Whether the bold menu item is visible
    "italic": true,           // Whether the italic menu item is visible
    "underline": false,       // Whether the underline menu item is visible
    "code": true,             // Whether the code menu item is visible
    "strikethrough": true,    // Whether the strikethrough menu item is visible
    "subscript": false,       // Whether the subscript menu item is visible
    "superscript": false,     // Whether the superscript menu item is visible
  }, 
  "styleMenu": { 
    "p": "Body",              // The label in the menu for "P" style
    "h1": "H1",               // The label in the menu for "H1" style
    "h2": "H2",               // The label in the menu for "H2" style
    "h3": "H3",               // The label in the menu for "H3" style
    "h4": "H4",               // The label in the menu for "H4" style
    "h5": "H5",               // The label in the menu for "H5" style
    "h6": "H6",               // The label in the menu for "H6" style
    "pre": "Code" ,           // The label in the menu for "PRE" aka code_block style
  }, 
  "styleBar": { 
    "list": true,             // Whether bullet and numbered list items are visible
    "dent": true,             // Whether indent and outdent items are visible
  }, 
  "tableMenu": { 
    "header": true,           // Whether the "Header" item is visible in the "Table->Add" menu
    "border": true,           // Whether the "Border" item is visible in the "Table" menu
  },
}

/**
An icon or label that, when clicked, executes a command.
*/
export class MenuItem {

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
 * Represents the search MenuItem in the toolbar, which hides/shows the search bar and maintains its state.
 */
export class SearchItem {

  constructor(keymap) {
    let options = {
      enable: (state) => { return true },
      active: (state) => { return this.showing() },
      title: 'Toggle search' + keyString('search', keymap),
      icon: icons.search
    };
    this.command = this.toggleSearch.bind(this);
    this.item = cmdItem(this.command, options);
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
    this.update && this.update(state)
  }

  hideSearchbar() {
    let searchbar = getSearchbar();
    searchbar.parentElement.removeChild(searchbar);
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
export class LinkItem {

  constructor(keymap) {
    let options = {
      enable: () => { return true }, // Always enabled because it is presented modally
      active: (state) => { return markActive(state, state.schema.marks.link) },
      title: 'Insert/edit link' + keyString('link', keymap),
      icon: icons.link
    };
    this.command = this.openLinkDialog.bind(this);
    this.item = cmdItem(this.command, options);
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
    this.dialog.show();
  }

  /**
   * Create the dialog element for adding/modifying links. Append it to the wrapper after the toolbar.
   * 
   * @param {EditorView} view 
   */
  createLinkDialog(view) {
    this.href = getLinkAttributes().href;   // href is what is linked-to, undefined if there is no link at selection

    // Select the full link if the selection is in one, and then set selectionDivRect that surrounds it
    selectFullLink(view);
    this.selectionDivRect = this.getSelectionDivRect()

    // Show the selection, because the view is not focused, so it doesn't otherwise show up
    this.setSelectionDiv();

    // Create the dialog in the proper position
    this.dialog = crel('dialog', { class: prefix + '-prompt', contenteditable: 'false' });
    setClass(this.dialog, prefix + '-prompt-link', true);
    this.setDialogLocation()

    let title = crel('p', (this.href) ? 'Edit link' : 'Insert link');
    this.dialog.appendChild(title)

    this.setInputArea(view)
    this.setButtons(view)
    this.okUpdate(view.state);
    this.cancelUpdate(view.state);
    
    let wrapper = getWrapper();
    addPromptShowing();
    wrapper.appendChild(this.dialog);

    // Add an overlay so we can get a modal effect without using showModal
    // showModal puts the dialog in the top-layer, so it slides over the toolbar 
    // when scrolling and ignores z-order. Good article: https://bitsofco.de/accessible-modal-dialog/.
    // We also have to add a separate toolbarOverlay over the toolbar to prevent interaction with it, 
    // because it sits at a higher z-level than the prompt and overlay.
    this.overlay = crel('div', {class: prefix + '-prompt-overlay', tabindex: "-1", contenteditable: 'false'});
    this.overlay.addEventListener('click', e => {
      this.closeDialog()
    });
    wrapper.appendChild(this.overlay);

    this.toolbarOverlay = crel('div', {class: prefix + '-toolbar-overlay', tabindex: "-1", contenteditable: 'false'});
    if (getSearchbar()) {
      setClass(this.toolbarOverlay, searchbarShowing(), true);
    } else {
      setClass(this.toolbarOverlay, searchbarHidden(), true);
    }
    this.toolbarOverlay.addEventListener('click', e => {
      this.closeDialog()
    });
    wrapper.appendChild(this.toolbarOverlay)
  }

  /**
   * Create and add the input element for the URL.
   * 
   * Capture Enter to perform the command of the active button, either OK or Cancel.
   * 
   * @param {*} view 
   */
  setInputArea(view) {
    this.hrefArea = crel('input', { type: 'text', placeholder: 'Enter url...' })
    this.hrefArea.value = this.href ?? '';
    this.hrefArea.addEventListener('input', () => {
      if (this.isValid()) {
        setClass(this.okDom, 'Markup-menuitem-disabled', false);
      } else {
        setClass(this.okDom, 'Markup-menuitem-disabled', true);
      };
      this.okUpdate(view.state);
      this.cancelUpdate(view.state);
    });
    this.hrefArea.addEventListener('keydown', e => {   // Use keydown because 'input' isn't triggered for Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.isValid()) {
          this.insertLink(view.state, view.dispatch, view);
        } else {
          this.closeDialog()
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
      } else if (e.key === 'Escape') {
        this.closeDialog()
      }
    })
    this.dialog.appendChild(this.hrefArea)
  }

  /**
   * Create and append the buttons in the `dialog`.
   * 
   * Track the `dom` and `update` properties for the OK and Cancel buttons so we can show when
   * they are active as a way to indicate the default action on Enter in the `hrefArea`.
   * 
   * @param {EditorView} view 
   */
  setButtons(view) {
    let buttonsDiv = crel('div', { class: prefix + '-prompt-buttons' })
    this.dialog.appendChild(buttonsDiv)

    if (this.isValid()) {
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
        return this.isValid()
      },
      enable: () => {
        return this.isValid()
      }
    })
    let {dom: okDom, update: okUpdate} = okItem.render(view)
    this.okDom = okDom;
    this.okUpdate = okUpdate;
    group.appendChild(this.okDom)

    let cancelItem = cmdItem(this.closeDialog.bind(this), {
      class: prefix + '-menuitem',
      title: 'Cancel',
      active: () => {
        return !this.isValid()
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
    let wrapper = view.dom.parentElement;
    let originY = wrapper.getBoundingClientRect().top;
    let originX = wrapper.getBoundingClientRect().left;
    let scrollY = wrapper.scrollTop;   // The editor scrolls within its wrapper
    let scrollX = window.scrollX;      // The editor doesn't scroll horizontally
    let selrect = getSelectionRect();
    let top = selrect.top + scrollY - originY;
    let left = selrect.left + scrollX - originX;
    let right = selrect.right;
    let width = selrect.right - selrect.left;
    let height = selrect.bottom - selrect.top;
    let bottom = selrect.bottom;
    return { top: top, left: left, right: right, width: width, height: height, bottom: bottom }
  }

  /**
   * Set the `dialog` location on the screen so it is adjacent to the selection.
   */

  setDialogLocation() {
    // selRect is the position within the document. So, doesn't change even if the document is scrolled.
    let selrect = this.selectionDivRect;

    // We need the dialogHeight and width because we can only position the dialog top and left. 
    // You would think that an element could be positioned by specifying right and bottom, but 
    // apparently not. Even when width is fixed, specifying right doesn't work. The values below
    // are dependent on toolbar.css for .Markup-prompt-link.
    let dialogHeight = 104;
    let dialogWidth = 317;

    // The dialog needs to be positioned within the document regardless of scroll, too, but the position is
    // set based on the direction from selrect that has the most screen real-estate. We always prefer right 
    // or left of the selection if we can fit it in the visible area on either side. We can bias it as 
    // close as we can to the vertical center. If we can't fit it right or left, then we will put it above
    // or below, whichever fits, biasing alignment as close as we can to the horizontal center.
    // Generally speaking, the selection itself is on the screen, so we want the dialog to be adjacent to 
    // it with the best chance of showing the entire dialog.
    let wrapper = view.dom.parentElement;
    let originX = wrapper.getBoundingClientRect().left;
    let scrollY = wrapper.scrollTop;   // The editor scrolls within its wrapper
    let scrollX = window.scrollX;      // The editor doesn't scroll horizontally
    let style = this.dialog.style;
    let toolbarHeight = getToolbar().getBoundingClientRect().height;
    let minTop = toolbarHeight + scrollY + 4;
    let maxTop = scrollY + innerHeight - dialogHeight - 4;
    let minLeft = scrollX + 4;
    let maxLeft = innerWidth - dialogWidth - 4;
    let fitsRight = window.innerWidth - selrect.right - scrollX > dialogWidth + 4;
    let fitsLeft = selrect.left - scrollX > dialogWidth + 4;
    let fitsTop = selrect.top - scrollY - toolbarHeight > dialogHeight + 4;
    if (fitsRight) {           // Put dialog right of selection
      style.left = selrect.right + 4 + scrollX - originX + 'px';
      style.top = Math.min(Math.max((selrect.top + (selrect.height / 2) - (dialogHeight / 2)), minTop), maxTop) + 'px';
    } else if (fitsLeft) {     // Put dialog left of selection
      style.left = selrect.left - dialogWidth - 4 + scrollX - originX + 'px';
      style.top = Math.min(Math.max((selrect.top + (selrect.height / 2) - (dialogHeight / 2)), minTop), maxTop) + 'px';
    } else if (fitsTop) {     // Put dialog above selection
      style.left = Math.min(Math.max((selrect.left + (selrect.width / 2) - (dialogWidth / 2)), minLeft), maxLeft) + 'px';
      style.top = Math.min(Math.max((selrect.top - dialogHeight - 4), minTop), maxTop) + 'px';
    } else {                                          // Put dialog below selection, even if it's off the screen somewhat
      style.left = Math.min(Math.max((selrect.left + (selrect.width / 2) - (dialogWidth / 2)), minLeft), maxLeft) + 'px';
      style.top = Math.min((selrect.bottom + 4), maxTop) + 'px';
    }
  }

  isValid() {
    return URL.canParse(this.hrefValue())
  }

  /**
   * Return the string from the `hrefArea`.
   * @returns {string}
   */
  hrefValue() {
    return this.hrefArea.value
  }

  /**
   * Insert the link provided in the hrefArea if it's valid, deleting any existing link first. Close if it worked.
   * 
   * @param {EditorState} state 
   * @param {fn(tr: Transaction)} dispatch 
   * @param {EditorView} view 
   */
  insertLink(state, dispatch, view) {
    if (!this.isValid()) return;
    if (this.href) deleteLinkCommand()(state, dispatch, view);
    let command = insertLinkCommand(this.hrefValue());
    let result = command(view.state, view.dispatch);
    if (result) this.closeDialog();
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
    if (result) this.closeDialog();
  }

  /**
   * Close the dialog, deleting the dialog and selectionDiv and clearing out state.
   */
  closeDialog() {
    removePromptShowing()
    this.toolbarOverlay?.parentElement?.removeChild(this.toolbarOverlay)
    this.overlay?.parentElement?.removeChild(this.overlay)
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
 * Represents the image MenuItem in the toolbar, which opens the image dialog and maintains its state.
 */
export class ImageItem {

  constructor(keymap) {
    let options = {
      enable: () => { return true }, // Always enabled because it is presented modally
      active: (state) => { return getImageAttributes(state).src  },
      title: 'Insert/edit image' + keyString('image', keymap),
      icon: icons.image
    };
    this.command = this.openImageDialog.bind(this);
    this.item = cmdItem(this.command, options);
    this.dialog = null;
    this.selectionDiv = null;
    this.isValid = false;
  }

  /**
   * Command to open the image dialog and show it modally.
   *
   * @param {EditorState} state 
   * @param {fn(tr: Transaction)} dispatch 
   * @param {EditorView} view 
   */
  openImageDialog(state, dispatch, view) {
    this.createImageDialog(view)
    this.dialog.show();
  }

  /**
   * Create the dialog element for adding/modifying images. Append it to the wrapper after the toolbar.
   * 
   * @param {EditorView} view 
   */
  createImageDialog(view) {
    let {src, alt} = getImageAttributes(view.state);
    this.src = src   // src for the selected image, undefined if there is no image at selection
    this.alt = alt

    // Set selectionDivRect that surrounds the selection
    this.selectionDivRect = this.getSelectionDivRect()

    // Show the selection, because the view is not focused, so it doesn't otherwise show up
    this.setSelectionDiv();

    // Create the dialog in the proper position
    this.dialog = crel('dialog', { class: prefix + '-prompt', contenteditable: 'false' });
    setClass(this.dialog, prefix + '-prompt-image', true);
    this.setDialogLocation()

    let title = crel('p', (this.src) ? 'Edit image' : 'Insert image');
    this.dialog.appendChild(title)

    this.setInputArea(view)
    this.setButtons(view)
    this.updateSrc()

    let wrapper = getWrapper();
    addPromptShowing()
    wrapper.appendChild(this.dialog);

    // Add an overlay so we can get a modal effect without using showModal
    // showModal puts the dialog in the top-laver, so it slides over the toolbar 
    // when scrolling and ignores z-order. Good article: https://bitsofco.de/accessible-modal-dialog/.
    // We also have to add a separate toolbarOverlay over the toolbar to prevent interaction with it, 
    // because it sits at a higher z-level than the prompt and overlay.
    this.overlay = crel('div', {class: prefix + '-prompt-overlay', tabindex: "-1", contenteditable: 'false'});
    this.overlay.addEventListener('click', e => {
      this.closeDialog()
    });
    wrapper.appendChild(this.overlay);
    this.toolbarOverlay = crel('div', {class: prefix + '-toolbar-overlay', tabindex: "-1", contenteditable: 'false'});
    if (getSearchbar()) {
      setClass(this.toolbarOverlay, searchbarShowing(), true);
    } else {
      setClass(this.toolbarOverlay, searchbarHidden(), true);
    }
    this.toolbarOverlay.addEventListener('click', e => {
      this.closeDialog()
    });
    wrapper.appendChild(this.toolbarOverlay);
  }

  /**
   * Create and add the input elements.
   * 
   * Capture Enter to perform the command of the active button, either OK or Cancel.
   * 
   * @param {*} view 
   */
  setInputArea(view) {
    this.srcArea = crel('input', { type: 'text', placeholder: 'Enter url...' })
    this.srcArea.value = this.src ?? '';
    this.srcArea.addEventListener('input', () => {
      // Update the img src as we type, which will cause this.preview to load, which may result in 
      // "Not allowed to load local resource" at every keystroke until the image loads properly.
      this.updateSrc()
    });
    this.srcArea.addEventListener('keydown', e => {   // Use keydown because 'input' isn't triggered for Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.isValid) {
          this.insertImage(view.state, view.dispatch, view);
        } else {
          this.closeDialog()
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.altArea.focus();
      } else if (e.key === 'Escape') {
        this.closeDialog()
      }
    })
    this.dialog.appendChild(this.srcArea)

    this.altArea = crel('input', { type: 'text', placeholder: 'Enter description...' })
    this.altArea.value = this.alt ?? '';
    this.altArea.addEventListener('keydown', e => {   // Use keydown because 'input' isn't triggered for Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.isValid) {
          this.insertImage(view.state, view.dispatch, view);
        } else {
          this.closeDialog()
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.srcArea.focus();
      } else if (e.key === 'Escape') {
        this.closeDialog()
      }
    })
    this.dialog.appendChild(this.altArea)
  }

  /**
   * Create and append the buttons in the `dialog`.
   * 
   * Track the `dom` and `update` properties for the OK and Cancel buttons so we can show when
   * they are active as a way to indicate the default action on Enter in the input areas.
   * 
   * @param {EditorView} view 
   */
  setButtons(view) {
    let buttonsDiv = crel('div', { class: prefix + '-prompt-buttons' })
    this.dialog.appendChild(buttonsDiv)

    // TODO: When local images are allowed, we should insert a "Select..." button  
    // somewhere that will bring up a file chooser. For it to really work for editing, the 
    // choosing has to be followed by copying from the selection into the current working 
    // dieectory or a "resources" type of directory below. In Swift, this is all handled 
    // by the app itself, which is notified of the UUID file that is placed in the temp 
    // directory, so the app can do what it wants with it.

    this.preview = this.getPreview()
    buttonsDiv.appendChild(this.preview)

    let group = crel('div', {class: prefix + '-prompt-buttongroup'});
    let okItem = cmdItem(this.insertImage.bind(this), {
      class: prefix + '-menuitem',
      title: 'OK',
      active: () => {
        return this.isValid
      },
      enable: () => {
        // We enable the OK button to allow saving even invalid src values. For example, 
        // maybe you are offline and can't reach a URL or you will later put the image 
        // file into place. However, pressing Enter will result in `closeDialog` being 
        // executed unless the OK button is active; i.e., only if `srcValue()` is valid.
        return this.srcValue().length > 0
      }
    })
    let {dom: okDom, update: okUpdate} = okItem.render(view)
    this.okDom = okDom;
    this.okUpdate = okUpdate;
    group.appendChild(this.okDom)

    let cancelItem = cmdItem(this.closeDialog.bind(this), {
      class: prefix + '-menuitem',
      title: 'Cancel',
      active: () => {
        return !this.isValid
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

  getPreview() {
    let preview = crel('img')
    preview.style.visibility = 'hidden';
    preview.addEventListener('load', () => {
      this.isValid = true
      preview.style.visibility = 'visible'
      setClass(this.okDom, 'Markup-menuitem-disabled', false)
      setClass(this.srcArea, 'invalid', false)
      this.okUpdate(view.state)
      this.cancelUpdate(view.state)
    })
    preview.addEventListener('error', (e) => {
      this.isValid = false
      preview.style.visibility = 'hidden'
      setClass(this.okDom, 'Markup-menuitem-disabled', true)
      setClass(this.srcArea, 'invalid', true)
      this.okUpdate(view.state)
      this.cancelUpdate(view.state)
    })
    return preview
  }

  updateSrc() {
    this.preview.src = this.srcValue()
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
    let wrapper = view.dom.parentElement;
    let originY = wrapper.getBoundingClientRect().top;
    let originX = wrapper.getBoundingClientRect().left;
    let scrollY = wrapper.scrollTop;   // The editor scrolls within its wrapper
    let scrollX = window.scrollX;      // The editor doesn't scroll horizontally
    let selrect = getSelectionRect();
    let top = selrect.top + scrollY - originY;
    let left = selrect.left + scrollX - originX;
    let right = selrect.right;
    let width = selrect.right - selrect.left;
    let height = selrect.bottom - selrect.top;
    let bottom = selrect.bottom;
    return { top: top, left: left, right: right, width: width, height: height, bottom: bottom }
  }

  /**
   * Set the `dialog` location on the screen so it is adjacent to the selection.
   */
  setDialogLocation() {
    // selRect is the position within the document. So, doesn't change even if the document is scrolled.
    let selrect = this.selectionDivRect;

    // We need the dialogHeight and width because we can only position the dialog top and left. 
    // You would think that an element could be positioned by specifying right and bottom, but 
    // apparently not. Even when width is fixed, specifying right doesn't work. The values below
    // are dependent on toolbar.css for .Markup-prompt-image.
    let dialogHeight = 134;
    let dialogWidth = 317;

    // The dialog needs to be positioned within the document regardless of scroll, too, but the position is
    // set based on the direction from selrect that has the most screen real-estate. We always prefer right 
    // or left of the selection if we can fit it in the visible area on either side. We can bias it as 
    // close as we can to the vertical center. If we can't fit it right or left, then we will put it above
    // or below, whichever fits, biasing alignment as close as we can to the horizontal center.
    // Generally speaking, the selection itself is on the screen, so we want the dialog to be adjacent to 
    // it with the best chance of showing the entire dialog.
    let wrapper = view.dom.parentElement;
    let originX = wrapper.getBoundingClientRect().left;
    let scrollY = wrapper.scrollTop;   // The editor scrolls within its wrapper
    let scrollX = window.scrollX;      // The editor doesn't scroll horizontally
    let style = this.dialog.style;
    let toolbarHeight = getToolbar().getBoundingClientRect().height;
    let minTop = toolbarHeight + scrollY + 4;
    let maxTop = scrollY + innerHeight - dialogHeight - 4;
    let minLeft = scrollX + 4;
    let maxLeft = innerWidth - dialogWidth - 4;
    let fitsRight = window.innerWidth - selrect.right - scrollX > dialogWidth + 4;
    let fitsLeft = selrect.left - scrollX > dialogWidth + 4;
    let fitsTop = selrect.top - scrollY - toolbarHeight > dialogHeight + 4;
    if (fitsRight) {           // Put dialog right of selection
      style.left = selrect.right + 4 + scrollX - originX + 'px';
      style.top = Math.min(Math.max((selrect.top + (selrect.height / 2) - (dialogHeight / 2)), minTop), maxTop) + 'px';
    } else if (fitsLeft) {     // Put dialog left of selection
      style.left = selrect.left - dialogWidth - 4 + scrollX - originX + 'px';
      style.top = Math.min(Math.max((selrect.top + (selrect.height / 2) - (dialogHeight / 2)), minTop), maxTop) + 'px';
    } else if (fitsTop) {     // Put dialog above selection
      style.left = Math.min(Math.max((selrect.left + (selrect.width / 2) - (dialogWidth / 2)), minLeft), maxLeft) + 'px';
      style.top = Math.min(Math.max((selrect.top - dialogHeight - 4), minTop), maxTop) + 'px';
    } else {                                          // Put dialog below selection, even if it's off the screen somewhat
      style.left = Math.min(Math.max((selrect.left + (selrect.width / 2) - (dialogWidth / 2)), minLeft), maxLeft) + 'px';
      style.top = Math.min((selrect.bottom + 4), maxTop) + 'px';
    }
  }

  /**
   * Return the string from the `srcArea`.
   * @returns {string}
   */
  srcValue() {
    return this.srcArea.value
  }

  /**
   * Return the string from the `altArea`.
   * @returns {string}
   */
  altValue() {
    return this.altArea.value
  }

  /**
   * Insert the image provided in the srcArea if it's valid, modifying image if it exists. Close if it worked.
   * Note that the image that is saved might be not exist or be properly formed.
   * 
   * @param {EditorState} state 
   * @param {fn(tr: Transaction)} dispatch 
   * @param {EditorView} view 
   */
  insertImage(state, dispatch, view) {
    let newSrc = this.srcValue();
    let newAlt = this.altValue();
    let command = (this.src) ? modifyImageCommand(newSrc, newAlt) : insertImageCommand(newSrc, newAlt);
    let result = command(view.state, view.dispatch, view);
    if (result) this.closeDialog();
  }

  /**
   * Close the dialog, deleting the dialog and selectionDiv and clearing out state.
   */
  closeDialog() {
    removePromptShowing()
    this.toolbarOverlay?.parentElement?.removeChild(this.toolbarOverlay)
    this.overlay?.parentElement?.removeChild(this.overlay)
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
 * @param {string}  basePrefix  The prefix used when building style strings, "Markup" by default.
 * @param {Object}  config      The configuration of the menu.
 * @param {Schema}  schema      The schema that holds node and mark types.
 * @returns [MenuItem]    The array of MenuItems or nested MenuItems used by `renderGrouped`.
 */
export function buildMenuItems(basePrefix, menuConfig, keymap, schema) {
  prefix = basePrefix;
  let itemGroups = [];
  let { correctionBar, insertBar, formatBar, styleMenu, styleBar, search } = menuConfig.visibility;
  if (correctionBar) itemGroups.push(correctionBarItems(keymap));
  if (insertBar) itemGroups.push(insertBarItems(menuConfig, keymap, schema));
  if (styleMenu) itemGroups.push(styleMenuItems(menuConfig, keymap, schema));
  if (styleBar) itemGroups.push(styleBarItems(menuConfig, keymap, schema));
  if (formatBar) itemGroups.push(formatItems(menuConfig, keymap, schema));
  if (search) itemGroups.push([new SearchItem(keymap)])
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

function getWrapper() {
  return getToolbar().parentElement;
}

/** Adding promptShowing class on wrapper lets us suppress scroll while the prompt is showing */
function addPromptShowing() {
  setClass(getWrapper(), promptShowing(), true)
}

/** Removing promptShowing class on wrapper lets wrapper scroll again */
function removePromptShowing() {
  setClass(getWrapper(), promptShowing(), false)
}

function promptShowing() {
  return prefix + "-prompt-showing"
}

function searchbarShowing() {
  return prefix + "-searchbar-showing"
}

function searchbarHidden() {
  return prefix + "-searchbar-hidden"
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
 * Return a string intended for the user to see showing the first key mapping for `itemName`.
 * @param {string} itemName           The name of the item in the keymap
 * @param {[string : string]} keymap  The mapping between item names and hotkeys
 * @returns string
 */
function keyString(itemName, keymap) {
  let keyString = keymap[itemName]
  if (!keyString) return ''
  if (keyString instanceof Array) keyString = keyString[0]  // Use the first if there are multiple
  // Clean up to something more understandable
  keyString = keyString.replaceAll("Mod", "Cmd")
  keyString = keyString.replaceAll("-", "+")
  return ' (' + keyString + ')'
}

/* Correction Bar (Undo, Redo) */

function correctionBarItems(keymap) {
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
function insertBarItems(menuConfig, keymap, schema) {
  let items = [];
  let { link, image, table } = menuConfig.insertBar;
  if (link) items.push(new LinkItem(keymap))
  if (image) items.push(new ImageItem(keymap))
  if (table) items.push(tableMenuItems(menuConfig, keymap, schema))
  return items;
}

function tableMenuItems(menuConfig, keymap, schema) {
  let items = []
  let { header, border } = menuConfig.tableMenu;
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
function styleBarItems(menuConfig, keymap, schema) {
  let items = []
  let { list, dent } = menuConfig.styleBar
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
 * @param {Object} config   The markupConfig that is passed-in, with boolean values in config.formatBar.
 * @returns [MenuItem]      The array of MenuItems that show as passed in `config`
 */
function formatItems(menuConfig, keymap, schema) {
  let items = []
  let { bold, italic, underline, code, strikethrough, subscript, superscript } = menuConfig.formatBar;
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
 * @param {*} config    The markupConfig that is passed-in, with boolean values in config.styleMenu.
 * @returns [Dropdown]  The array of MenuItems that show as passed in `config`
 */
function styleMenuItems(menuConfig, keymap, schema) {
  let items = []
  let { p, h1, h2, h3, h4, h5, h6, pre } = menuConfig.styleMenu;
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

export function renderGroupedFit(view, content, wrapAtIndex) {
  let result = document.createDocumentFragment();
  let updates = [], separators = [];
  let itemIndex = 0;
  let moreItems = [];
  for (let i = 0; i < content.length; i++) {
    let items = content[i], localUpdates = [], localNodes = [];
    for (let j = 0; j < items.length; j++) {
      if (itemIndex >= wrapAtIndex) {
        // Track the items to be later rendered in the "more" dropdown
        moreItems.push(items[j]);
      } else {
        let { dom, update } = items[j].render(view);
        let span = crel("span", { class: prefix + "-menuitem" }, dom);
        result.appendChild(span);
        localNodes.push(span);
        localUpdates.push(update);
      }
      itemIndex++;
    }
    if (localUpdates.length) {
      updates.push(combineUpdates(localUpdates, localNodes));
      if (i < content.length - 1)
        separators.push(result.appendChild(separator()));
    }
  }
  if (moreItems.length > 0) {
    let more = new Dropdown(moreItems, { title: 'More...', icon: icons.more, indicator: false })
    let {dom, update} = more.render(view);
    let span = crel("span", { class: prefix + "-menuitem" }, dom);
    result.appendChild(span);
    updates.push(update);
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

/**
 * Return a MenuItem that runs the command when selected.
 * 
 * The label is the same as the title, and the MenuItem will be enabled/disabled based on 
 * what `cmd(state)` returns unless otherwise specified in `options`.
 * @param {Command}     cmd 
 * @param {*} options   The spec for the MenuItem
 * @returns {MenuItem}
 */
export function cmdItem(cmd, options) {
  let passedOptions = {
    label: options.title,
    run: cmd
  }
  for (let prop in options) passedOptions[prop] = options[prop]
  if ((!options.enable || options.enable === true) && !options.select)
    passedOptions[options.enable ? "enable" : "select"] = state => cmd(state)

  return new MenuItem(passedOptions)
}

export function renderDropdownItems(items, view) {
    let rendered = [], updates = [];
    for (let i = 0; i < items.length; i++) {
        let { dom, update } = items[i].render(view);
        rendered.push(crel("div", { class: prefix + "-menu-dropdown-item" }, dom));
        updates.push(update);
    };
    return { dom: rendered, update: combineUpdates(updates, rendered) };
}

export function separator() {
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
  },
  paragraphStyle: {
    // <span class="material-symbols-outlined">format_paragraph</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M360-160v-240q-83 0-141.5-58.5T160-600q0-83 58.5-141.5T360-800h360v80h-80v560h-80v-560H440v560h-80Z"/></svg>'
  },
  more: {
    // <span class="material-symbols-outlined">more_horiz</span>
    svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M240-400q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm240 0q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm240 0q-33 0-56.5-23.5T640-480q0-33 23.5-56.5T720-560q33 0 56.5 23.5T800-480q0 33-23.5 56.5T720-400Z"/></svg>'
  }
}

function getIcon(root, icon) {
    let doc = (root.nodeType == 9 ? root : root.ownerDocument) || document;
    let node = doc.createElement("span");
    node.className = prefix + "-icon";
    node.innerHTML = icon.svg;
    return node;
}