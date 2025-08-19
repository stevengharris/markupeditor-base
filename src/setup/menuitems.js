import crel from "crelt";
import { icons, getIcon } from "./icons";
import { 
    prefix, 
    setClass, 
    translate, 
    getToolbar, 
    getWrapper, 
    getToolbarMore, 
    getSearchbar, 
    addPromptShowing, 
    removePromptShowing,
    searchbarShowing, 
    searchbarHidden 
} from "./utilities";

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
 * Represents the search MenuItem in the toolbar, which hides/shows the search bar and maintains its state.
 */
export class SearchItem {

  constructor(config, commands) {
    let keymap = config.keymap
    this.commands = commands
    let options = {
      enable: (state) => { return true },
      active: (state) => { return this.showing() },
      title: 'Toggle search' + keyString('search', keymap),
      icon: icons.search,
      id: prefix + '-searchitem'
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
    this.commands.cancelSearch();
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
    let beforeTarget = getToolbarMore() ? getToolbarMore().nextSibling : toolbar.nextSibling;
    toolbar.parentElement.insertBefore(searchbar, beforeTarget);
  }

  setStatus() {
    let count = this.commands.matchCount();
    let index = this.commands.matchIndex();
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
    let command = this.commands.searchForCommand(this.text, "forward");
    command(state, dispatch, view);
    this.scrollToSelection(view);
    this.setStatus();
  }

  searchBackwardCommand(state, dispatch, view) {
    let command = this.commands.searchForCommand(this.text, "backward");
    command(state, dispatch, view);
    this.scrollToSelection(view);
    this.setStatus();
  }

  toggleMatchCaseCommand(state, dispatch, view) {
    this.caseSensitive = !this.caseSensitive;
    this.commands.matchCase(this.caseSensitive);
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
  let keyString = keymap[itemName]
  if (!keyString) return ''
  if (keyString instanceof Array) keyString = keyString[0]  // Use the first if there are multiple
  // Clean up to something more understandable
  keyString = keyString.replaceAll("Mod", "Cmd")
  keyString = keyString.replaceAll("-", "+")
  return ' (' + keyString + ')'
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

/**
 * Represents the link MenuItem in the toolbar, which opens the link dialog and maintains its state.
 * Requires commands={getLinkAttributes, selectFullLink, getSelectionRect, insertLinkCommand, deleteLinkCommand}
 */
export class LinkItem {

  constructor(config, commands) {
    let keymap = config.keymap
    this.commands = commands
    let options = {
      enable: () => { return true }, // Always enabled because it is presented modally
      active: (state) => { return markActive(state, state.schema.marks.link) },
      title: 'Insert/edit link' + keyString('link', keymap),
      icon: icons.link
    };

    // If `behavior.insertLink` is true, the LinkItem just invokes the delegate's 
    // `markupInsertLink` method, passing the `state`, `dispatch`, and `view` like any 
    // other command. Otherwise, we use the default dialog.
    if ((config.behavior.insertLink) && (config.delegate?.markupInsertLink)) {
      this.command = config.delegate.markupInsertLink
    } else {
      this.command = this.openLinkDialog.bind(this);
    }
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
    this.href = this.commands.getLinkAttributes().href;   // href is what is linked-to, undefined if there is no link at selection

    // Select the full link if the selection is in one, and then set selectionDivRect that surrounds it
    this.commands.selectFullLink(view);
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
    let selrect = this.commands.getSelectionRect();
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
    if (this.href) this.commands.deleteLinkCommand()(state, dispatch, view);
    let command = this.commands.insertLinkCommand(this.hrefValue());
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
    let command = this.commands.deleteLinkCommand();
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
 * Requires commands={getImageAttributes, insertImageCommand, modifyImageCommand, getSelectionRect}
 */
export class ImageItem {

  constructor(config, commands) {
    this.config = config
    this.commands = commands
    let options = {
      enable: () => { return true }, // Always enabled because it is presented modally
      active: (state) => { return this.commands.getImageAttributes(state).src  },
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
    let {src, alt} = this.commands.getImageAttributes(view.state);
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
    let selrect = this.commands.getSelectionRect();
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
    let command = (this.src) ? this.commands.modifyImageCommand(newSrc, newAlt) : this.commands.insertImageCommand(newSrc, newAlt);
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

export function separator() {
    return crel("span", { class: prefix + "-menuseparator" });
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