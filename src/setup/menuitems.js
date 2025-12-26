import crel from "crelt";
import { 
    prefix, 
    getToolbar, 
    getWrapper, 
    getToolbarMore, 
    getSearchbar, 
    addPromptShowing, 
    removePromptShowing,
    searchbarShowing, 
    searchbarHidden 
} from "../domaccess";
import {
    setClass, 
    translate, 
} from "../utilities"
import {
    setStyleCommand,
    insertTableCommand,
    getLinkAttributes, 
    selectFullLink, 
    getSelectionRect, 
    insertLinkCommand, 
    idForInternalLinkCommand,
    insertInternalLinkCommand,
    deleteLinkCommand,
    getImageAttributes, 
    insertImageCommand, 
    modifyImageCommand,
    searchForCommand, 
    cancelSearch,
    matchCase,
    matchCount,
    matchIndex,
    headers,
} from "../markup"
import { activeView, setActiveView } from "../registry"

function getIcon(root, icon) {
    let doc = (root.nodeType == 9 ? root : root.ownerDocument) || document;
    let node = doc.createElement("span");
    node.className = prefix + "-icon";
    node.innerHTML = icon;
    return node;
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
      if (!dom.classList.contains(prefix + "-disabled")) {
        let result = spec.run(view.state, view.dispatch, view, e);
        if (spec.callback) {
          spec.callback(result, dom)
        }
      }
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

export class ParagraphStyleItem {

  constructor(nodeType, style, options) {
    this.style = style
    this.label = options["label"] ?? "Unknown"  // It should always be specified
    this.keymap = options["keymap"]             // It may or may not exist
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
    let keymapElement = crel ('span', {class: prefix + '-stylelabel-keymap'}, this.keymap)
    // Add some space between the label and keymap, css uses whitespace: pre to preserve it
    let styledElement = crel(this.style, {class: prefix + '-stylelabel'}, this.label + '  ', keymapElement)
    dom.replaceChild(styledElement, dom.firstChild);
    return {dom, update}
  }
}

/**
 * DialogItem provides common functionality for MenuItems that present dialogs next to 
 * a selection, such as LinkItem and ImageItem. The shared functionality mainly deals 
 * with opening, closing, and positioning the dialog so it stays in view as much as possible.
 * Each of the subclasses defines its `dialogWidth` and `dialogHeight` and deals with its 
 * own content/layout.
 */
class DialogItem {

    constructor(config) {
        this.config = config;
        this.dialog = null;
        this.selectionDiv = null;
        this.selectionDivRect = null;
    }

    /**
     * Command to open the link dialog and show it modally.
     *
     * @param {EditorState} state 
     * @param {fn(tr: Transaction)} dispatch 
     * @param {EditorView} view 
     */
    openDialog(state, dispatch, view) {
      setActiveView(view)
        this.createDialog(view)
        this.dialog.show();
    }

    /**
     * Create and append a div that encloses the selection, with a class that displays it properly.
     */
    setSelectionDiv() {
        this.selectionDiv = crel('div', { id: prefix + '-selection', class: prefix + '-selection' })
        this.selectionDiv.style.top = this.selectionDivRect.top + 'px'
        this.selectionDiv.style.left = this.selectionDivRect.left + 'px'
        this.selectionDiv.style.width = this.selectionDivRect.width + 'px'
        this.selectionDiv.style.height = this.selectionDivRect.height + 'px'
        getWrapper(activeView()).appendChild(this.selectionDiv)
    }

    /**
     * Return an object with location and dimension properties for the selection rectangle.
     * @returns {Object}  The {top, left, right, width, height, bottom} of the selection.
     */
    getSelectionDivRect() {
        let wrapper = activeView().dom.parentElement;
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
        let view = activeView()
        let dialogHeight = this.dialogHeight;
        let dialogWidth = this.dialogWidth

        // selRect is the position within the document. So, doesn't change even if the document is scrolled.
        let selrect = this.selectionDivRect;

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
        let toolbarHeight = getToolbar(view).getBoundingClientRect().height;
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
     * Close the dialog, deleting the dialog and selectionDiv and clearing out state.
     */
    closeDialog() {
        removePromptShowing(activeView())
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
 * Represents the link MenuItem in the toolbar, which opens the link dialog and maintains its state.
 */
export class LinkItem extends DialogItem {

  constructor(config) {
    super(config);
    let keymap = this.config.keymap
    let icons = config.toolbar.icons
    let options = {
      enable: () => { return true }, // Always enabled because it is presented modally
      active: (state) => { return markActive(state, state.schema.marks.link) },
      title: 'Insert/edit link' + keyString('link', keymap),
      icon: icons.link
    };

    // If `behavior.insertLink` is true, the LinkItem just invokes the delegate's 
    // `markupInsertLink` method, passing the `state`, `dispatch`, and `view` like any 
    // other command. Otherwise, we use the default dialog.
    if ((this.config.behavior.insertLink) && (this.config.delegate?.markupInsertLink)) {
      this.command = this.config.delegate.markupInsertLink
    } else {
      this.command = this.openDialog.bind(this);
    }
    this.item = cmdItem(this.command, options);

    // We need the dialogHeight and width because we can only position the dialog top and left. 
    // You would think that an element could be positioned by specifying right and bottom, but 
    // apparently not. Even when width is fixed, specifying right doesn't work. The values below
    // are dependent on toolbar.css for .Markup-prompt-link.
    this.dialogHeight = 104;
    this.dialogWidth = 317;
  }

  /**
   * Create the dialog element for adding/modifying links. Append it to the wrapper after the toolbar.
   * 
   * @param {EditorView} view 
   */
  createDialog(view) {
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
    
    let wrapper = getWrapper(view);
    addPromptShowing(view);
    wrapper.appendChild(this.dialog);

    // Add an overlay so we can get a modal effect without using showModal
    // showModal puts the dialog in the top-layer, so it slides over the toolbar 
    // when scrolling and ignores z-order. Good article: https://bitsofco.de/accessible-modal-dialog/.
    // We also have to add a separate toolbarOverlay over the toolbar to prevent interaction with it, 
    // because it sits at a higher z-level than the prompt and overlay.
    this.overlay = crel('div', {class: prefix + '-prompt-overlay', tabindex: "-1", contenteditable: 'false'});
    this.overlay.addEventListener('click', () => {
      this.closeDialog()
    });
    wrapper.appendChild(this.overlay);

    this.toolbarOverlay = crel('div', {class: prefix + '-toolbar-overlay', tabindex: "-1", contenteditable: 'false'});
    if (getSearchbar(view)) {
      setClass(this.toolbarOverlay, searchbarShowing(), true);
    } else {
      setClass(this.toolbarOverlay, searchbarHidden(), true);
    }
    this.toolbarOverlay.addEventListener('click', () => {
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

    // Only insert the Remove button if we have a link selected
    if (this.isValid()) {
      let removeItem = cmdItem(this.deleteLink.bind(this), {
        class: prefix + '-menuitem',
        title: 'Remove',
        enable: () => { return true }
      })
      let {dom} = removeItem.render(view)
      buttonsDiv.appendChild(dom);
    }

    // Insert the dropdown to identify local links to headers
    let localRefDropdown = this.getLocalRefDropdown()
    if (localRefDropdown) {
      let {dom: localRefDom} = localRefDropdown.render(view)
      let itemWrapper = crel('span', {class: prefix + '-menuitem'}, localRefDom)
      buttonsDiv.appendChild(itemWrapper)
    } else {
      let spacer = crel('div', document.createTextNode('\u200b'))
      buttonsDiv.appendChild(spacer)
    }

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

  getLocalRefDropdown() {
    let localRefItems = this.getLocalRefItems()
    if (localRefItems.length == 0) { return null }
    return new Dropdown(localRefItems, {
      title: 'Insert link to header',
      label: 'H1-6'
      // Note: enable doesn't work for Dropdown
    })
  }

  getLocalRefItems() {
    let submenuItems = []
    let headersByLevel = headers(activeView().state)
    for (let i = 1; i < 7; i++) {
      let hTag = 'H' + i.toString()
      let menuItems = []
      let hNodes = headersByLevel[i]
      if (hNodes && hNodes.length > 0) {
        for (let j = 0; j < hNodes.length; j++) {
          // Add a MenuItem that invokes the insertInternalLinkCommand passing the hTag and the index into hElements
          menuItems.push(this.refMenuItem(hTag, j, hNodes[j].node.textContent))
        }
        submenuItems.push(new DropdownSubmenu(
          menuItems, {
          title: 'Link to ' + hTag,
          label: hTag,
          enable: () => { return menuItems.length > 0 }
        }
        ))
      }
    }
    return submenuItems
  }

  // Return a MenuItem with class `prefex + menuitem-clipped` because the text inside of a header is unlimited.
  // The `insertInternalLinkCommand` executes the callback providing a unique id for the header based on its 
  // contents, along with the tag and index into headers with that tag in the document being edited.
  refMenuItem(hTag, index, label) {
    let view = activeView()
    return cmdItem(
      idForInternalLinkCommand(hTag, index), 
      { 
        label: label, 
        class: prefix + '-menuitem-clipped',
        callback: (result) => { 
          if (result) {
            this.hTag = result.hTag
            this.index = result.index
            this.id = '#' + result.id
            this.hrefArea.value = this.id
            this.okUpdate(view.state)
            this.cancelUpdate(view.state)
          }
        }
      }
    )
  }

  // Return true if `hrefValue()` is a valid ID for a header or if the URL can be parsed.
  // A valid ID begins with # and has no whitespace in it.
  isValid() {
    let href = this.hrefValue()
    return (this.isInternalLink() && (href.indexOf(' ') == -1)) || URL.canParse(href)
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
    let command
    if (this.isInternalLink()) {
      // It could have been edited, not just inserted by selecting from H1-6
      if (this.hrefValue() == this.id) {
        // Id was set from H1=6 and nothing has changed. So, insert the link
        // based on the hTag and its index into headers with that hTag.
        command = insertInternalLinkCommand(this.hTag, this.index)
      } else {
        // Otherwise, just insert the link to an ID, which may not exist
        command = insertLinkCommand(this.hrefValue())
      }
    } else {
      command = insertLinkCommand(this.hrefValue());
    }
    let result = command(view.state, view.dispatch);
    if (result) this.closeDialog();
  }

  isInternalLink() {
    return this.hrefValue().startsWith('#')
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

}

/**
 * Represents the image MenuItem in the toolbar, which opens the image dialog and maintains its state.
 * Requires commands={getImageAttributes, insertImageCommand, modifyImageCommand, getSelectionRect}
 */
export class ImageItem extends DialogItem {

  constructor(config) {
    super(config)
    let icons = config.toolbar.icons
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
      this.command = this.openDialog.bind(this);
    }

    this.item = cmdItem(this.command, options);
    this.isValid = false;
    this.preview = null;

    // We need the dialogHeight and width because we can only position the dialog top and left. 
    // You would think that an element could be positioned by specifying right and bottom, but 
    // apparently not. Even when width is fixed, specifying right doesn't work. The values below
    // are dependent on toolbar.css for .Markup-prompt-image.
    this.dialogHeight = 134;
    this.dialogWidth = 317;
  }

  /**
   * Create the dialog element for adding/modifying images. Append it to the wrapper after the toolbar.
   * 
   * @param {EditorView} view 
   */
  createDialog(view) {
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

    let wrapper = getWrapper(view);
    addPromptShowing(view)
    wrapper.appendChild(this.dialog);

    // Add an overlay so we can get a modal effect without using showModal
    // showModal puts the dialog in the top-laver, so it slides over the toolbar 
    // when scrolling and ignores z-order. Good article: https://bitsofco.de/accessible-modal-dialog/.
    // We also have to add a separate toolbarOverlay over the toolbar to prevent interaction with it, 
    // because it sits at a higher z-level than the prompt and overlay.
    this.overlay = crel('div', {class: prefix + '-prompt-overlay', tabindex: "-1", contenteditable: 'false'});
    this.overlay.addEventListener('click', () => {
      this.closeDialog()
    });
    wrapper.appendChild(this.overlay);
    this.toolbarOverlay = crel('div', {class: prefix + '-toolbar-overlay', tabindex: "-1", contenteditable: 'false'});
    if (getSearchbar(view)) {
      setClass(this.toolbarOverlay, searchbarShowing(), true);
    } else {
      setClass(this.toolbarOverlay, searchbarHidden(), true);
    }
    this.toolbarOverlay.addEventListener('click', () => {
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
      let {dom} = selectItem.render(view);
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
    let view = activeView()
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
    preview.addEventListener('error', () => {
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
    dom.addEventListener('mouseover', () => {
      this.onMouseover(this.rows, this.cols)
    })
    return {dom, update}
  }

}

/**
  A submenu for creating a table, which contains many TableInsertItems each of which 
  will insert a table of a specific size. The items are bounded divs in a css grid 
  layout that highlight to show the size of the table being created, so we end up with 
  a compact way to display 24 TableInsertItems.
  */
export class TableCreateSubmenu {
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
    this.itemsUpdate(activeView().state)
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
 * Represents the search MenuItem in the toolbar, which hides/shows the search bar and maintains its state.
 */
export class SearchItem {

  constructor(config) {
    let keymap = config.keymap
    this.icons = config.toolbar.icons
    let options = {
      enable: () => { return true },
      active: () => { return this.showing() },
      title: 'Toggle search' + keyString('search', keymap),
      icon: this.icons.search,
      id: prefix + '-searchitem'
    };
    this.command = this.toggleSearch.bind(this);
    this.item = cmdItem(this.command, options);
    this.text = '';
    this.caseSensitive = false;
  }

  showing() {
    let view = activeView()
    return (typeof view != 'undefined') ? getSearchbar(view) != null : false
  }

  /**
   * Toggle the search bar on/off.
   * 
   * Note that this happens when pressing the search button in `view`, so we set the 
   * active `muId` rather than depend on it having been set from a focus event.
   * 
   * @param {EditorState} state 
   * @param {fn(tr: Transaction)} dispatch 
   * @param {EditorView} view 
   */
  toggleSearch(state, dispatch, view) {
    setActiveView(view)
    if (this.showing()) {
      this.hideSearchbar()
    } else {
      this.showSearchbar(state, dispatch, view);
    }
    this.update && this.update(state)
  }

  hideSearchbar() {
    let view = activeView()
    if (view) {
      let searchbar = getSearchbar(view);
      searchbar.parentElement.removeChild(searchbar);
      this.matchCaseDom = null;
      this.matchCaseItem = null;
      this.stopSearching();
    }
  }

  stopSearching(focus=true) {
    cancelSearch();
    this.setStatus();
    if (focus) activeView()?.focus();
  }

  showSearchbar(state, dispatch, view) {
    let toolbar = getToolbar(view);
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
    let beforeTarget = getToolbarMore(view) ? getToolbarMore(view).nextSibling : toolbar.nextSibling;
    toolbar.parentElement.insertBefore(searchbar, beforeTarget);
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
    let searchBackwardItem = cmdItem(searchBackward, {title: "Search backward", icon: this.icons.searchBackward});
    let searchBackwardDom = searchBackwardItem.render(view).dom;
    let searchBackwardSpan = crel("span", {class: prefix + "-menuitem"}, searchBackwardDom);
    let searchForward = this.searchForwardCommand.bind(this);
    let searchForwardItem = cmdItem(searchForward, {title: "Search forward", icon: this.icons.searchForward});
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
        icon: this.icons.matchCase,
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

/** A special item for showing a "more" button in the toolbar, which shows its `items` as a sub-toolbar */
export class MoreItem {

  constructor(items, config) {
    let icons = config.toolbar.icons
    let options = {
      enable: () => { return true },
      active: () => { return this.showing() },
      title: 'Show more',
      icon: icons.more
    };
    this.command = this.toggleMore.bind(this);
    this.item = cmdItem(this.command, options);
    this.items = items
  }

  showing() {
    return getToolbarMore(activeView()) != null;
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
    let toolbarMore = getToolbarMore(activeView());
    toolbarMore.parentElement.removeChild(toolbarMore);
  }

  showMore(state, dispatch, view) {
    let toolbar = getToolbar(view);
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

/** Return a span for a separator between groups of MenuItems */
export function separator() {
    return crel("span", { class: prefix + "-menuseparator" });
}

/**
 * Return whether the selection in state is within a mark of type `markType`.
 * @param {EditorState} state 
 * @param {MarkType} type 
 * @returns {boolean} True if the selection is within a mark of type `markType`
 */
export function markActive(state, type) {
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
export function keyString(itemName, keymap) {
  return ' (' + baseKeyString(itemName, keymap) + ')'
}

export function baseKeyString(itemName, keymap) {
  let keyString = keymap[itemName]
  if (!keyString) return ''
  if (keyString instanceof Array) keyString = keyString[0]  // Use the first if there are multiple
  // Clean up to something more understandable
  keyString = keyString.replaceAll('Mod', 'Cmd')
  keyString = keyString.replaceAll('Cmd', '\u2318')     // ⌘
  keyString = keyString.replaceAll('Ctrl', '\u2303')    // ⌃
  keyString = keyString.replaceAll('Shift', '\u21E7')   // ⇧
  keyString = keyString.replaceAll('Alt', '\u2325')     // ⌥
  keyString = keyString.replaceAll('-', '')
  return keyString
}

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

export function combineUpdates(updates, nodes) {
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