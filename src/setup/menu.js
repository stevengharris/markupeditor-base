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
import { 
  icons, 
  getIcon 
} from "./icons";
import { 
  MenuItem, 
  cmdItem, 
  SearchItem,
  LinkItem,
  keyString,
  markActive
} from "./menuitems";
import { 
  prefix,
  setClass, 
  getWrapper, 
  getToolbar, 
  getToolbarMore, 
  getSearchbar, 
  searchbarHidden,
  searchbarShowing,
  addPromptShowing, 
  removePromptShowing,
  translate
} from "./utilities"

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

/** A special item for showing a "more" button in the toolbar, which shows its `items` as a sub-toolbar */
export class MoreItem {

  constructor(items) {
    let options = {
      enable: (state) => { return true },
      active: (state) => { return this.showing() },
      title: 'Show more',
      icon: icons.more
    };
    this.command = this.toggleMore.bind(this);
    this.item = cmdItem(this.command, options);
    this.items = items
  }

  showing() {
    return getToolbarMore() != null;
  }

  toggleMore(state, dispatch, view) {
    if (this.showing()) {
      this.hideMore()
    } else {
      this.showMore(state, dispatch, view);
    }
    this.update && this.update(state)
  }

  hideMore() {
    let toolbarMore = getToolbarMore();
    toolbarMore.parentElement.removeChild(toolbarMore);
  }

  showMore(state, dispatch, view) {
    let toolbar = getToolbar();
    if (!toolbar) return;
    let idClass = prefix + "-toolbar-more";
    let toolbarMore = crel('div', { class: idClass, id: idClass } )
    let {dom, update} = renderGrouped(view, [this.items]);
    toolbarMore.appendChild(dom)
    toolbar.parentElement.insertBefore(toolbarMore, toolbar.nextSibling);
    // Then update the moreItem to show it's active
    update(view.state)
  }

  render(view) {
    let {dom, update} = this.item.render(view);
    this.update = update;
    return {dom, update};
  }

}

/**
 * Represents the image MenuItem in the toolbar, which opens the image dialog and maintains its state.
 */
export class ImageItem {

  constructor(config) {
    this.config = config
    let options = {
      enable: () => { return true }, // Always enabled because it is presented modally
      active: (state) => { return getImageAttributes(state).src  },
      title: 'Insert/edit image' + keyString('image', config.keymap),
      icon: icons.image
    };

    // If `behavior.insertImage` is true, the ImageItem just invokes the delegate's 
    // `markupInsertImage` method, passing the `state`, `dispatch`, and `view` like any 
    // other command. Otherwise, we use the default dialog.
    if ((config.behavior.insertImage) && (config.delegate?.markupInsertImage)) {
      this.command = config.delegate.markupInsertImage
    } else {
      this.command = this.openImageDialog.bind(this);
    }

    this.item = cmdItem(this.command, options);
    this.dialog = null;
    this.selectionDiv = null;
    this.isValid = false;
    this.preview = null;
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
    this.updatePreview()

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
      this.updatePreview()
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

    // When local images are allowed, we insert a "Select..." button that will bring up a 
    // file chooser. However, the MarkupEditor can't do that itself, so it invokes the 
    // delegate's `markupSelectImage` method if it exists. Thus, when `selectImage` is 
    // true in BehaviorConfig, that method should exist. It should bring up a file chooser
    // and then invoke `MU.insertImage`.
    if (this.config.behavior.selectImage) {
      this.preview = null;
      let selectItem = cmdItem(this.selectImage.bind(this), {
        class: prefix + '-menuitem',
        title: 'Select...',
        active: () => { return false },
        enable: () => { return true }
      })
      let {dom, update} = selectItem.render(view);
      buttonsDiv.appendChild(dom)
    } else {
      // If there is no Select button, we insert a tiny preview to help.
      this.preview = this.getPreview()
      buttonsDiv.appendChild(this.preview)
    }

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

  updatePreview() {
    if (this.preview) this.preview.src = this.srcValue()
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

  /** Tell the delegate to select an image to insert, because we don't know how to do that */
  selectImage(state, dispatch, view) {
    this.closeDialog()
    if (this.config.delegate?.markupSelectImage) this.config.delegate?.markupSelectImage(view)
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
 * @param {string}  basePrefix      The prefix used when building style strings, "Markup" by default.
 * @param {Object}  config          The MarkupEditor.config.
 * @param {Schema}  schema          The schema that holds node and mark types.
 * @returns [MenuItem]              The array of MenuItems or nested MenuItems used by `renderGrouped`.
 */
export function buildMenuItems(config, schema) {
  let itemGroups = [];
  let { correctionBar, insertBar, formatBar, styleMenu, styleBar, search } = config.toolbar.visibility;
  if (correctionBar) itemGroups.push(correctionBarItems(config));
  if (insertBar) itemGroups.push(insertBarItems(config, schema));
  if (styleMenu) itemGroups.push(styleMenuItems(config, schema));
  if (styleBar) itemGroups.push(styleBarItems(config, schema));
  if (formatBar) itemGroups.push(formatItems(config, schema));
  if (search) {
    let searchCommands = {searchForCommand, cancelSearch, matchCase, matchCount, matchIndex}
    itemGroups.push([new SearchItem(config, searchCommands)])
  }
  return itemGroups;
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

/* Correction Bar (Undo, Redo) */

function correctionBarItems(config) {
  let keymap = config.keymap;
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
function insertBarItems(config, schema) {
  let items = [];
  let { link, image, tableMenu } = config.toolbar.insertBar;
  if (link) {
    let linkCommands = {getLinkAttributes, selectFullLink, getSelectionRect, insertLinkCommand, deleteLinkCommand}
    items.push(new LinkItem(config, linkCommands))
  }
  if (image) items.push(new ImageItem(config))
  if (tableMenu) items.push(tableMenuItems(config))
  return items;
}

function tableMenuItems(config, schema) {
  let items = []
  let { header, border } = config.toolbar.tableMenu;
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
function styleBarItems(config, schema) {
  let keymap = config.keymap
  let items = []
  let { list, dent } = config.toolbar.styleBar
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
 * @param {Object} config   The MarkupEditor.config with boolean values in config.toolbar.formatBar.
 * @returns [MenuItem]      The array of MenuItems that show as passed in `config`
 */
function formatItems(config, schema) {
  let keymap = config.keymap;
  let items = []
  let { bold, italic, underline, code, strikethrough, subscript, superscript } = config.toolbar.formatBar;
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
 * @param {Object}  config          The MarkupEditor.config.
 * @param {Schema}  schema          The schema that holds node and mark types.
 * @returns [Dropdown]  The array of MenuItems that show as passed in `config`
 */
function styleMenuItems(config, schema) {
  let items = []
  let { p, h1, h2, h3, h4, h5, h6, pre } = config.toolbar.styleMenu;
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

/**
 * Like `renderGrouped`, but at `wrapIndex` in the `content`, place a `MoreItem` that 
 * will display a subtoolbar of `content` items starting at `wrapIndex` when it is 
 * pressed. The `MoreItem` renders using `renderGrouped`, not `renderGroupedFit`. Let's 
 * face it, if you need to wrap a toolbar into more than two lines, you need to think
 * through your life choices.
 * 
 * @param {EditorView} view 
 * @param {[MenuItem | [MenuItem]]} content 
 * @param {number}  wrapAtIndex             The index in  content` to wrap in another toolbar
 * @returns 
 */
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
    let more = new MoreItem(moreItems)
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