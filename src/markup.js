import {
    activeView, 
    activeDocument, 
    setActiveDocument, 
    activeSearcher, 
    selectedID,             // `selectedID` is the id of the contentEditable DIV containing the currently selected element
    setSelectedID,
    activeEditorElement,
} from './registry'
import {MUError} from './muerror.js'
import {schema} from "./schema/index.js"
import {AllSelection, TextSelection, NodeSelection, EditorState} from 'prosemirror-state'
import {DOMParser, DOMSerializer} from 'prosemirror-model'
import {toggleMark} from 'prosemirror-commands'
import {findWrapping, liftTarget} from 'prosemirror-transform'
import {undo, redo} from 'prosemirror-history'
import {wrapInList, liftListItem, splitListItem, wrapRangeInList} from 'prosemirror-schema-list'
import {
    addRowBefore, 
    addRowAfter, 
    addColumnBefore, 
    addColumnAfter, 
    deleteRow, 
    deleteColumn, 
    deleteTable, 
    CellSelection, 
    mergeCells,
    toggleHeaderRow,
} from 'prosemirror-tables'

/**
 * Define various arrays of tags used to represent MarkupEditor-specific concepts.
 *
 * For example, "Paragraph Style" is a MarkupEditor concept that doesn't map directly to HTML or CSS.
 * @private
 */
const _formatTags = ['B', 'STRONG', 'I', 'EM', 'U', 'DEL', 'SUB', 'SUP', 'CODE'];       // All possible (nestable) formats

const _minimalStyleTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE'];           // Convert to 'P' for pasteText

const _voidTags = ['BR', 'IMG', 'AREA', 'COL', 'EMBED', 'HR', 'INPUT', 'LINK', 'META', 'PARAM'] // Tags that are self-closing

/**
 * The searcher is the singleton that handles finding ranges that
 * contain a search string within editor.
 * 
 * @private
 */
export function searchIsActive() { return activeSearcher().isActive }

/**
 * Handle pressing Enter.
 * 
 * Where Enter is bound in keymap.js, we chain `handleEnter` with `splitListItem`.
 * 
 * The logic for handling Enter is entirely MarkupEditor-specific, so is exported from here but imported in keymap.js.
 * We only need to report stateChanged when not in search mode.
 * 
 * @private
 * @returns {boolean}    Value is false if subsequent commands (like splitListItem) should execute;
 *                  else true if execution should stop here (like when search is active)
 */
export function handleEnter() {
    const view = activeView()
    if (activeSearcher()?.isActive) {
        activeSearcher()?.searchForward();
        return true;
    }
    stateChanged(view)
    return false;
}

/**
 * Handle pressing Shift-Enter.
 * 
 * The logic for handling Shift-Enter is entirely MarkupEditor-specific, so is exported from here but imported in keymap.js.
 * We only need to report stateChanged when not in search mode.
 * 
 * @private
 * @returns {boolean}    Value is false if subsequent commands should execute;
 *                  else true if execution should stop here (like when search is active)
 */
export function handleShiftEnter() {
    const view = activeView()
    if (activeSearcher()?.isActive) {
        activeSearcher()?.searchBackward();
        return true;
    }
    stateChanged(view)
    return false;
}

/**
 * Handle pressing Delete.
 * 
 * Notify about deleted images if one was selected, but always notify state changed and return false.
 * 
 * @private
 * @returns {boolean}    Value is false if subsequent commands should execute;
 *                      else true if execution should stop here.
 */
export function handleDelete() {
    const view = activeView()
    const imageAttributes = _getImageAttributes()
    if (imageAttributes.src) {
        let messageDict = { 'messageType': 'deletedImage', 'src': imageAttributes.src, 'divId': (selectedID() ?? '') }
        _callback(JSON.stringify(messageDict))
    }
    stateChanged(view)
    return false
}

/**
 * Called to set attributes to the editor div, typically to ,
 * set spellcheck and autocorrect. Note that contenteditable 
 * should not be set for the editor element, even if it is 
 * included in the jsonString attributes. The same attributes
 * are used for contenteditable divs, and the attribute is 
 * relevant in that case.
 * 
 * @param {string}  jsonString  The stringified object containing the attributes to set for the editor
 */
export function setTopLevelAttributes(jsonString) {
    const attributes = JSON.parse(jsonString);
    const editor = activeDocument().getElementById('editor');
    if (editor && attributes) {   
        for (const [key, value] of Object.entries(attributes)) {
            if (key !== 'contenteditable') editor.setAttribute(key, value);
        };
    };
};

/**
 * Called to load user script and CSS before loading html.
 *
 * The scriptFile and cssFile are loaded in sequence, with the single 'loadedUserFiles'
 * callback only happening after their load events trigger. If neither scriptFile
 * nor cssFile are specified, then the 'loadedUserFiles' callback happens anyway,
 * since this ends up driving the loading process further.
 * 
 * @param   {string}    scriptFile  The filename for a script that should be loaded
 * @param   {string}    cssFile     The filename for a CSS style that should be linked
 * @param   {string}    target      The first element found with tag `target` will have the script or link added to it; default "body" for script, "head" for CSS
 * @param   {string}    nonce       The "nonce" attribute to be applied
 */
export function loadUserFiles(scriptFile, cssFile, target=null, nonce=null) {
    if (scriptFile) {
        if (cssFile) {
            _loadUserScriptFile(scriptFile, nonce, function() { _loadUserCSSFile(cssFile, target) }, target);
        } else {
            _loadUserScriptFile(scriptFile, nonce, function() { _loadedUserFiles(target) }, target);
        }
    } else if (cssFile) {
        _loadUserCSSFile(cssFile, target);
    } else {
        _loadedUserFiles(target);
    }
};

/**
 * Callback to the global `messageHandler` using `postMessage` or to the 
 * `element` that is listening for a `muCallback`
 * 
 * The global messageHandler is only used here when *not* using MarkupEditorElements, 
 * the Markup Editor web component. When using web components, callbacks are 
 * invoked by dispatching an `muCallback` CustomEvent to the `element` provided.
 * In this case, the `element` will end up invoking `postMessage` on the 
 * `messageHandler` for most callbacks.
 * 
 * The `element` is commonly the `editor` div. 
 * 
 * When not using MarkupEditorElements, the `messageHandler` will be defined, 
 * and callbacks are handled by invoking `postMessage` on it.
 * 
 * In Swift, the `messageHandler` is a WKScriptMessageHandler, 
 * the MarkupCoordinator, and the userContentController(_ userContentController:didReceive:)
 * function receives message as a WKScriptMessage.
 * 
 * In VSCode, the `messageHandler` is `vscode`.
 *
 * @private
 * @param {string}      message     The message, which might be a JSONified string
 * @param {HTMLElement} element     An element that should be listening for a `muMessage`.
 */
function _callback(message, element) {
    _dispatchMuCallback(message, element ?? activeEditorElement())
};

function _dispatchMuCallback(message, element) {
    const muCallback = new CustomEvent("muCallback")
    muCallback.message = message
    element.dispatchEvent(muCallback)
}

/**
 * Called to load user script before loading html.
 * @private
 */
function _loadUserScriptFile(file, nonce, callback, target) {
    let scriptTarget = target ?? document.getElementsByTagName('body')[0];
    let script = document.createElement('script');
    script.type = 'module';
    script.addEventListener('load', callback);
    if (nonce) script.setAttribute('nonce', nonce)
    script.setAttribute('src', file);
    scriptTarget.appendChild(script);
};

/**
 * Called to load user CSS before loading html if userCSSFile has been defined for this MarkupWKWebView
 * @private
 */
function _loadUserCSSFile(file, target) {
    let cssTarget = target ?? document.getElementsByTagName('head')[0];
    let link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.addEventListener('load', function() { _loadedUserFiles(target) });
    link.href = file;
    cssTarget.appendChild(link);
};

if (typeof window != 'undefined') {

    //
    //For history, the 'ready' callback used to indicate that the editor and this js is properly
    //loaded, which in turn triggered loading of user script and style, which in turn informed 
    //the MarkupDelegate that things were really in a "ready" state. However when using a 
    //web component and loading modules, the `connectedCallback` triggers loading of user 
    //script and style. In summary, there we no longer use an event listener on load to 
    //do a "ready" callback.
    //

    /**
     * Capture all unexpected runtime errors in this script, report for debugging.
     *
     * There is not any useful debug information for users, but as a developer,
     * you can place a break in this method to examine the call stack.
     * Please file issues for any errors captured by this function,
     * with the call stack and reproduction instructions if at all possible.
     */
    window.addEventListener('error', function (e) {
        const muError = new MUError('Internal', e.message);
        _callbackError(muError)
    });

    /**
     * If the window is resized, call back so that the holder can adjust its height tracking if needed.
     */
    window.addEventListener('resize', function () {
        _callback('updateHeight', activeDocument());
    });
}

/********************************************************************************
 * Search
 */
//MARK: Search

/**
 * Search for `text` in `direction`.
 * 
 * When text is empty, search is canceled.
 *
 * CAUTION: When `activate` is "true", search must be cancelled once started, or Enter 
 * will be intercepted to mean searcher.searchForward()/searchBackward()
 * 
 * @param {string}              text        The string to search for in a case-insensitive manner.
 * @param {string}              direction   Search direction, either `forward ` or `backward`.
 * @param {"true" | "false"}    activate    Set to "true" to activate "search mode", where Enter/Shift-Enter = Search forward/backward.
 * @returns {object}                        The {to: number, from: number} location of the match.
 */
export function searchFor(text, direction, activate) {
    const view = activeView()
    const searchOnEnter = activate === 'true';
    let command = searchForCommand(text, direction, searchOnEnter);
    return command(view.state, view.dispatch, view);
};

/**
 * Return the command that will execute search for `text` in `direction when provided with the 
 * view.state, view.dispatch, and view.
 *
 * @private
 * @param {string}              text        The string to search for in a case-insensitive manner
 * @param {string}              direction   Search direction, either `forward ` or `backward`.
 * @param {"true" | "false"}    activate    Set to "true" to activate "search mode", where Enter/Shift-Enter = Search forward/backward.
 * @returns {Command}                       The command that can be executed to return the location of the match.
 */
export function searchForCommand(text, direction, activate) {
    return activeSearcher()?.searchForCommand(text, direction, activate);
}

/**
 * Deactivate search mode, stop intercepting Enter to search.
 * 
 * @param   {EditorView | null}    view    The view whose activeSearcher should be deactivated.
 */
export function deactivateSearch(view=null) {
    activeSearcher()?.deactivate(view);
};

/**
 * Cancel searching, resetting search state.
 */
export function cancelSearch() {
    activeSearcher()?.cancel()
}

/**
 * Set whether searches will be case sensitive or not.
 * 
 * @private
 * @param {boolean} caseSensitive 
 */
export function matchCase(caseSensitive) {
    let searcher = activeSearcher()
    if (searcher) searcher.caseSensitive = caseSensitive;
}

/**
 * Return the number of matches in the current search or null if search has not yet been initiated.
 * 
 * @private
 * @returns {number | null}
 */
export function matchCount() {
    return activeSearcher()?.matchCount;
}

/**
 * Return the index of the match in the current search, starting at the first match which began 
 * at the selection point, or null if search has not yet been initiated.
 * 
 * @private
 * @returns {number | null}
 */
export function matchIndex() {
    return activeSearcher()?.matchIndex;
}

/********************************************************************************
 * Paste
 */
//MARK: Paste

/**
 * Paste html at the selection, replacing the selection as-needed.
 * 
 * @param   {string}                html    The HTML to be pasted
 * @param   {ClipboardEvent | bull} event   A mocked ClipboardEvent for testing
 */
export function pasteHTML(html, event) {
    const view = activeView()
    view.pasteHTML(html, event);
    stateChanged(view);
};

/**
 * Do a custom paste operation of "text only", which we will extract from the html
 * ourselves. First we get a node that conforms to the schema, which by definition 
 * only includes elements in a form we recognize, no spans, styles, etc.
 * The trick here is that we want to use the same code to paste text as we do for
 * HTML, but we want to paste something that is the MarkupEditor-equivalent of
 * unformatted text.
 *  
 * @param   {string}                html    The HTML to be pasted
 * @param   {ClipboardEvent | bull} event   A mocked ClipboardEvent for testing
 */
export function pasteText(html, event) {
    const node = _nodeFromHTML(html);
    const htmlFragment = fragmentFromNode(node);
    const minimalHTML = _minimalHTML(htmlFragment); // Reduce to MarkupEditor-equivalent of "plain" text
    pasteHTML(minimalHTML, event);
};

/**
 * Return a minimal "unformatted equivalent" version of the HTML that is in fragment.
 *
 * This equivalent is derived by making all top-level nodes into <P> and removing
 * formatting and links. However, we leave TABLE, UL, and OL alone, so they still
 * come in as tables and lists, but with formatting removed.
 * @private
 */
function _minimalHTML(fragment) {
    // Create a div to hold fragment so that we can getElementsByTagName on it
    const div = document.createElement('div');
    div.appendChild(fragment);
    // Then run thru the various minimization steps on the div
    _minimalStyle(div);
    _minimalFormat(div);
    _minimalLink(div);
    return div.innerHTML;
};

/**
 * Replace all styles in the div with 'P'.
 * @private
 */
function _minimalStyle(div) {
    _minimalStyleTags.forEach(tag => {
        // Reset elements using getElementsByTagName as we go along or the
        // replaceWith potentially messes the up loop over elements.
        let elements = div.getElementsByTagName(tag);
        let element = (elements.length > 0) ? elements[0] : null;
        while (element) {
            let newElement = document.createElement('P');
            newElement.innerHTML = element.innerHTML;
            element.replaceWith(newElement);
            elements = div.getElementsByTagName(tag);
            element = (elements.length > 0) ? elements[0] : null;
        };
    });
};

/**
 * Replace all formats in the div with unformatted text
 * @private
 */
function _minimalFormat(div) {
    _formatTags.forEach(tag => {
        // Reset elements using getElementsByTagName as we go along or the
        // replaceWith potentially messes the up loop over elements.
        let elements = div.getElementsByTagName(tag);
        let element = (elements.length > 0) ? elements[0] : null;
        while (element) {
            let template = document.createElement('template');
            template.innerHTML = element.innerHTML;
            const newElement = template.content;
            element.replaceWith(newElement);
            elements = div.getElementsByTagName(tag);
            element = (elements.length > 0) ? elements[0] : null;
        };
    });
};

/**
 * Replace all links with their text only
 * @private
 */
function _minimalLink(div) {
    // Reset elements using getElementsByTagName as we go along or the
    // replaceWith potentially messes the up loop over elements.
    let elements = div.getElementsByTagName('A');
    let element = (elements.length > 0) ? elements[0] : null;
    while (element) {
        if (element.getAttribute('href')) {
            element.replaceWith(document.createTextNode(element.text));
        } else {
            // This link has no href and is therefore not allowed
            element.parentNode.removeChild(element);
        };
        elements = div.getElementsByTagName('A');
        element = (elements.length > 0) ? elements[0] : null;
    };
};

/********************************************************************************
 * Getting and setting document contents
 */
//MARK: Getting and Setting Document Contents

/**
 * Clean out the document and replace it with an empty paragraph
 */
export function emptyDocument() {
    setSelectedID(null)
    setHTML(emptyHTML())
}

/** Return the HTML that is contained in an empty document. 
 * @returns {string} An empty paragraph
 */
export function emptyHTML() {
    return '<p></p>'
}

/**
 * Set the `selectedID` to `id`, a byproduct of clicking or otherwise iteractively
 * changing the selection, triggered by `createSelectionBetween`.
 * 
 * @private
 * @param {string} id 
 */
export function resetSelectedID(id) { 
    setSelectedID(id)
}

/**
 * Return an array of `src` attributes for images that are encoded as data, empty if there are none.
 * 
 * @returns {Array<string>}
 */
export function getDataImages() {
    let images = Array.from(activeEditorElement().getElementsByTagName('img'))
    let dataImages = []
    for (let img of images) {
        let src = img.getAttribute('src');
        if (src && src.startsWith('data')) dataImages.push(src)
    }
    return dataImages
}

/**
 * We saved an image at a new location or translated it from data to a file reference, 
 * so we need to update the document to reflect it.
 * 
 * @param {string} oldSrc Some or all of the original src for the image
 * @param {string} newSrc The src that should replace the old src
 */
export function savedDataImage(oldSrc, newSrc) {
    const view = activeView()
    let images = Array.from(activeEditorElement().getElementsByTagName('img'));
    for (let img of images) {
        let src = img.getAttribute('src');
        if (src && src.startsWith(oldSrc)) {
            let imgPos = view.posAtDOM(img, 0)
            const transaction = view.state.tr.setNodeAttribute(imgPos, 'src', newSrc)
            view.dispatch(transaction)
        }
    }
}

/**
 * Get the contents of the div with id `divID` or of the full doc.
 *
 * Note: Clean is needed to avoid the selected ResizableImage from being
 * passed-back with spans around it, which is what are used internally to
 * represent the resizing handles and box around the selected image.
 * However, this content of the DOM is only for visualization within the
 * MarkupEditor and should not be included with the HTML contents. It is
 * available here with clean !== true as an option in case it's needed 
 * for debugging.
 * 
 * @param   {string}    pretty  Set to "true" to format nicely for reading.
 * @param   {string}    clean   Set to "true" to remove spans and empty text nodes first.
 * @param   {string}    divID   The ID for the DIV to return HTML from.
 * @returns  {string}    The HTML for the div with id `divID` or of the full doc.
 */
export function getHTML(pretty='true', clean='true', divID) {
    const view = activeView()
    const prettyHTML = pretty === 'true';
    const cleanHTML = clean === 'true';
    const divNode = (divID) ? _getNode(divID)?.node : view.state.doc;
    if (!divNode) {
        _callbackError(MUError.NoDiv)
        return "";
    }
    const editor = DOMSerializer.fromSchema(schema).serializeFragment(divNode.content);
    let text;
    if (cleanHTML) {
        _cleanUpDivsWithin(editor);
        _cleanUpSpansWithin(editor);
    };
	if (prettyHTML) {
        text = _allPrettyHTML(editor);
    } else {
        const div = document.createElement('div');
        div.appendChild(editor);
        text = div.innerHTML;
    };
    return text;
};

/**
 * Return a pretty version of editor contents.
 *
 * Insert a newline between each top-level element so they are distinct
 * visually and each top-level element is in a contiguous text block vertically.
 *
 * @private
 * @returns {string}     A string showing the raw HTML with tags, etc.
 */
function _allPrettyHTML(fragment) {
    let text = '';
    const childNodes = fragment.childNodes;
    const childNodesLength = childNodes.length;
    for (let i = 0; i < childNodesLength; i++) {
        let topLevelNode = childNodes[i];
        text += _prettyHTML(topLevelNode, '', '', i === 0);
        if (i < childNodesLength - 1) { text += '\n' };
    }
    return text;
};

/**
 * Return a decently formatted/indented version of node's HTML.
 *
 * The inlined parameter forces whether to put a newline at the beginning
 * of the text. By passing it in rather than computing it from node, we
 * can avoid putting a newline in front of the first element in _allPrettyHTML.
 * @private
 */
function _prettyHTML(node, indent, text, inlined) {
    const nodeName = node.nodeName.toLowerCase();
    const nodeIsText = _isTextNode(node);
    const nodeIsElement = _isElementNode(node);
    const nodeIsInlined = inlined || _isInlined(node);  // allow inlined to force it
    const nodeHasTerminator = !_isVoidNode(node);
    const nodeIsEmptyElement = nodeIsElement && (node.childNodes.length === 0);
    if (nodeIsText) {
        text += _replaceAngles(node.textContent);
    } else if (nodeIsElement) {
        const terminatorIsInlined = nodeIsEmptyElement || (_isInlined(node.firstChild) && _isInlined(node.lastChild));
        if (!nodeIsInlined) { text += '\n' + indent };
        text += '<' + nodeName;
        const attributes = node.attributes;
        for (let i = 0; i < attributes.length; i++) {
            const attribute = attributes[i];
            text += ' ' + attribute.name + '="' + attribute.value + '"';
        };
        text += '>';
        node.childNodes.forEach(childNode => {
            text = _prettyHTML(childNode, indent + '    ', text, _isInlined(childNode));
        });
        if (nodeHasTerminator) {
            if (!terminatorIsInlined) { text += '\n' + indent };
            text += '</' + nodeName + '>';
        };
        if (!nodeIsInlined && !terminatorIsInlined) {
            indent = indent.slice(0, -4);
        };
    };
    return text;
};

/**
 * Return a new string that has all < replaced with &lt; and all > replaced with &gt;
 * @private
 */
function _replaceAngles(textContent) {
    return textContent.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
};

/**
 * Return whether node should be inlined during the prettyHTML assembly. An inlined node
 * like <I> in a <P> ends up looking like <P>This is an <I>italic</I> node</P>.
 * @private
 */
function _isInlined(node) {
    return _isTextNode(node) || _isFormatElement(node) || _isLinkNode(node) || _isVoidNode(node)
};

/** 
 * Set the base element for the body to `string`. 
 * 
 * Used so relative hrefs and srcs work. 
 * If `string` is undefined, then the base element is removed if it exists.
 * @private
 */
function _setBase(string) {
    let base = document.getElementsByTagName('base')[0]
    if (string) {
        if (!base) {
            base = document.createElement('base')
            document.body.insertBefore(base, document.body.firstChild)
        }
        base.setAttribute('href', string)
    } else {
        if (base) {
            base.parentElement.removeChild(base)
        }
    }
}

/**
 * Set the contents of the editor.
 * 
 * The exported placeholderText is set after setting the contents.
 *
 * @param {string}      contents            The HTML for the editor
 * @param {boolean}     focusAfterLoad      Whether we should focus after load
 * @param {string}      base                Value for base element for resolving relative src and hrefs
 * @param {EditorView}  editorView          The EditorView to set HTML for, `activeView()` default
 */
export function setHTML(contents, focusAfterLoad=true, base, editorView) {
    // If defined, set base; else remove base if it exists. This way, when setHTML is used to,
    // say, create a new empty document, base will be reset.
    _setBase(base)
    const htmlView = (editorView) ? editorView : activeView()
    const state = htmlView.state;
    const doc = state.doc;
    const tr = state.tr;
    const node = _nodeFromHTML(contents);
    const selection = new AllSelection(doc);
    let transaction = tr
        .setSelection(selection)
        .replaceSelectionWith(node, false)
        .setMeta("addToHistory", false);    // History begins here!
    const $pos = transaction.doc.resolve(0);
    transaction
        .setSelection(TextSelection.near($pos))
        .scrollIntoView();
    htmlView.dispatch(transaction);
    if (focusAfterLoad) htmlView.focus();
};

/**
 * Return the height of the editor element that encloses the text.
 *
 * The padding-block is set in CSS to allow touch selection outside of text on iOS.
 * An unfortunate side-effect of that setting is that getBoundingClientRect() returns
 * a height that has nothing to do with the actual text, because it's been padded.
 * A workaround for this is to get the computed style for editor using
 * window.getComputedStyle(editor, null), and then asking that for the height. It does
 * not include padding. This kind of works, except that I found the height changed as
 * soon as I add a single character to the text. So, for example, it shows 21px when it
 * opens with just a single `<p>Foo</p>`, but once you add a character to the text, the
 * height shows up as 36px. If you remove padding-block, then the behavior goes away.
 * To work around the problem, we set the padding block to 0 before getting height, and
 * then set it back afterward. With this change, both the touch-outside-of-text works
 * and the height is reported accurately. Height needs to be reported accurately for
 * auto-sizing of a WKWebView based on its contents.
 */
export function getHeight() {
   const editor = activeDocument().getElementById('editor');
   const paddingBlockStart = editor.style.getPropertyValue('padding-block-start');
   const paddingBlockEnd = editor.style.getPropertyValue('padding-block-end');
   editor.style['padding-block-start'] = '0px';
   editor.style['padding-block-end'] = '0px';
   // TODO: Check this works on iOS or is even still needed
   const height = activeView().dom.getBoundingClientRect().height;
   editor.style['padding-block-start'] = paddingBlockStart;
   editor.style['padding-block-end'] = paddingBlockEnd;
   return height;
};

/**
 * Pad the bottom of the text in editor to fill fullHeight.
 *
 * Setting padBottom pads the editor all the way to the bottom, so that the
 * focus area occupies the entire view. This allows long-press on iOS to bring up the
 * context menu anywhere on the screen, even when text only occupies a small portion
 * of the screen.
 * 
 * @param   {string}    fullHeight  The full height of the screen to be padded-to
 */
export function padBottom(fullHeight) {
    const editor = activeDocument().getElementById('editor');
    const padHeight = fullHeight - getHeight();
    if (padHeight > 0) {
        editor.style.setProperty('--padBottom', padHeight+'px');
    } else {
        editor.style.setProperty('--padBottom', '0');
    };
};

/**
 * Focus immediately, leaving range alone.
 */
export function focus() {
    activeView().focus()
};

/**
 * Reset the selection to the beginning of the document.
 */
export function resetSelection() {
    const view = activeView()
    const {node, pos} = _firstEditableTextNode();
    const doc = view.state.doc;
    const selection = (node) ? new TextSelection(doc.resolve(pos)) : new AllSelection(doc);
    const transaction = view.state.tr.setSelection(selection);
    view.dispatch(transaction);
};

/**
 * Return the node and position of the first editable text; i.e., 
 * a text node inside of a contentEditable div.
 * @private
 */
function _firstEditableTextNode() {
    const view = activeView()
    const divNodeType = schema.nodes.div;
    const fromPos = TextSelection.atStart(view.state.doc).from
    const toPos = TextSelection.atEnd(view.state.doc).to
    let nodePos = {};
    let foundNode = false;
    view.state.doc.nodesBetween(fromPos, toPos, (node, pos) => {
        if ((node.type === divNodeType) && !foundNode) {
            return node.attrs.editable;
        } else if (node.isText && !foundNode) {
            nodePos = {node: node, pos: pos};
            foundNode = true;
            return false;
        } else {
            return node.isBlock && !foundNode;
        };
    });
    return nodePos;
}

/**
 * Add a div with id to parentId.
 * 
 * Note that divs that contain a static button group are created in a single call that includes 
 * the buttonGroupJSON. However, button groups can also be added and removed dynamically.
 * In that case, a button group div is added to a parent div using this call, and the parent has to 
 * already exist so that we can find it.
 * 
 * @param   {string}    id          The id of the dive to add
 * @param   {string}    parentId    The id of the parent for this div
 * @param   {string}    cssClass    The class to assign to this div
 * @param   {string}    attributesJSON  A stringified object containing the editable attributes
 * @param   {string}    buttonGroupJSON A stringified object containing a group of buttons in this div
 * @param   {string}    htmlContents    The inner HTML to place in this div
 */
export function addDiv(id, parentId, cssClass, attributesJSON, buttonGroupJSON, htmlContents) {
    const view = activeView()
    const divNodeType = schema.nodes.div;
    const editableAttributes = (attributesJSON && JSON.parse(attributesJSON)) ?? {};
    const editable = editableAttributes.contenteditable === true;
    const buttonGroupDiv = _buttonGroupDiv(buttonGroupJSON);
    // When adding a button group div dynamically to an existing div, it will be 
    // non-editable, the htmlContent will be null, and the div will contain only buttons
    let div;
    if (buttonGroupDiv && !htmlContents && !editable) {
        div = buttonGroupDiv;
    } else {
        div = document.createElement('div');
        div.innerHTML = (htmlContents?.length > 0) ? htmlContents : emptyHTML();
        if (buttonGroupDiv) div.appendChild(buttonGroupDiv);
    }
    const divSlice = _sliceFromHTML(div.innerHTML);
    const startedEmpty = (div.childNodes.length == 1) && (div.firstChild.nodeName == 'P') && (div.firstChild.textContent == "");
    const divNode = divNodeType.create({id, parentId, cssClass, editable, startedEmpty}, divSlice.content);
    divNode.editable = editable;
    const transaction = view.state.tr;
    if (parentId && (parentId !== 'editor')) {
        // This path is only executed when adding a dynamic button group
        // Find the div that is the parent of the one we are adding
        const {node, pos} = _getNode(parentId, transaction.doc)
        if (node) {
            // Insert the div inside of its parent as a new child of the existing div
            const divPos = pos + node.nodeSize - 1;
            transaction.insert(divPos, divNode)
            // Now we have to update the htmlContent markup of the parent
            const $divPos = transaction.doc.resolve(divPos);
            const parent = $divPos.node();
            const htmlContents = htmlFromFragment(fragmentFromNode(parent));
            transaction.setNodeAttribute(pos, "htmlContents", htmlContents);
            view.dispatch(transaction);
        }
    } else {
        // This is the "normal" path when building a doc from the MarkupDivStructure.
        // If we are starting with an empty doc (i.e., <p><p>), then replace the single 
        // empty paragraph with this div. Otherwise, just append this div to the end 
        // of the doc.
        const emptyDoc = (view.state.doc.childCount == 1) && (view.state.doc.textContent == "")
        if (emptyDoc) {
            const nodeSelection = NodeSelection.atEnd(transaction.doc);
            nodeSelection.replaceWith(transaction, divNode);
        } else {
            const divPos = transaction.doc.content.size;
            transaction.insert(divPos, divNode);
        }
        view.dispatch(transaction);
    };
};

/**
 * @private
 * @param {string} buttonGroupJSON A JSON string describing the button group
 * @returns {HTMLDivElement}
 */
function _buttonGroupDiv(buttonGroupJSON) {
    if (buttonGroupJSON) {
        const buttonGroup = JSON.parse(buttonGroupJSON);
        if (buttonGroup) {
            const buttonGroupDiv = document.createElement('div');
            buttonGroupDiv.setAttribute('id', buttonGroup.id);
            buttonGroupDiv.setAttribute('parentId', buttonGroup.parentId);
            buttonGroupDiv.setAttribute('class', buttonGroup.cssClass);
            buttonGroupDiv.setAttribute('editable', "false");   // Hardcode
            buttonGroup.buttons.forEach( buttonAttributes => {
                let button = document.createElement('button');
                button.appendChild(document.createTextNode(buttonAttributes.label));
                button.setAttribute('label', buttonAttributes.label)
                button.setAttribute('type', 'button')
                button.setAttribute('id', buttonAttributes.id);
                button.setAttribute('class', buttonAttributes.cssClass);
                buttonGroupDiv.appendChild(button);
            })
            return buttonGroupDiv; 
        }
    }
    return null;
};

/**
 * Remove the div with the given id, and restore the selection to what it was before it is removed.
 * @param {string} id   The id of the div to remove
 */
export function removeDiv(id) {
    const view = activeView()
    const divNodeType = schema.nodes.div;
    const {node, pos} = _getNode(id)
    if (divNodeType === node?.type) {
        const $pos = view.state.doc.resolve(pos);
        const selection = view.state.selection;
        const nodeSelection = new NodeSelection($pos);
        // Once we deleteSelection (i.e., remove te div node), then our selection has to be adjusted if it was 
        // after the div we are removing.
        const newFrom = (selection.from > nodeSelection.to) ? selection.from - node.nodeSize : selection.from;
        const newTo = (selection.to > nodeSelection.to) ? selection.to - node.nodeSize : selection.to;
        const transaction = view.state.tr
            .setSelection(nodeSelection)
            .deleteSelection();
        const newSelection = TextSelection.create(transaction.doc, newFrom, newTo);
        transaction.setSelection(newSelection);
        const isButtonGroup = (node.attrs.editable == false) && (node.attrs.parentId !== 'editor') && ($pos.parent.type == divNodeType);
        if (isButtonGroup) {
            // Now we have to update the htmlContents attribute of the parent
            const parent = _getNode(node.attrs.parentId, transaction.doc);
            const htmlContents = htmlFromFragment(fragmentFromNode(parent.node));
            transaction.setNodeAttribute(parent.pos, "htmlContents", htmlContents);
        }
        view.dispatch(transaction);
    };
};

/**
 * 
 * @param {string} id           The element ID of the button that will be added.
 * @param {string} parentId     The element ID of the parent DIV to place the button in.
 * @param {string} cssClass     The CSS class of the button.
 * @param {string} label        The label for the button.
 */
export function addButton(id, parentId, cssClass, label) {
    const view = activeView()
    const buttonNodeType = schema.nodes.button;
    const button = document.createElement('button');
    button.setAttribute('id', id);
    button.setAttribute('parentId', parentId);
    button.setAttribute('class', cssClass);
    button.setAttribute('type', 'button');
    button.appendChild(document.createTextNode(label));
    const buttonSlice = _sliceFromElement(button);
    const buttonNode = buttonNodeType.create({id, parentId, cssClass, label}, buttonSlice.content);
    const transaction = view.state.tr;
    if (parentId && (parentId !== 'editor')) {
        // Find the div that is the parent of the button we are adding
        const {node, pos} = _getNode(parentId, transaction.doc)
        if (node) {   // Will always be a buttonGroup div that might be empty
            // Insert the div inside of its parent as a new child of the existing div
            const divPos = pos + node.nodeSize - 1;
            transaction.insert(divPos, buttonNode);
            // Now we have to update the htmlContent markup of the parent
            const $divPos = transaction.doc.resolve(divPos);
            const parent = $divPos.node();
            const htmlContents = htmlFromFragment(fragmentFromNode(parent));
            transaction.setNodeAttribute(pos, "htmlContents", htmlContents);
            view.dispatch(transaction);
        }
    }
};

/**
 * Remove the HTMLButton element with the given `id`.
 * 
 * @param {string} id   The ID of the button to be removed.
 */
export function removeButton(id) {
    const view = activeView()
    const {node, pos} = _getNode(id)
    if (schema.nodes.button === node?.type) {
        const nodeSelection = new NodeSelection(view.state.doc.resolve(pos));
        const transaction = view.state.tr
            .setSelection(nodeSelection)
            .deleteSelection()
        view.dispatch(transaction);
    };
};

/**
 * Focus on the DIV with `id`.
 * 
 * @param {string} id   The ID of the DIV to focus on.
 */
export function focusOn(id) {
    const view = activeView()
    const {node, pos} = _getNode(id);
    if (node && (node.attrs.id !== selectedID())) {
        const selection = new TextSelection(view.state.doc.resolve(pos));
        const transaction = view.state.tr.setSelection(selection).scrollIntoView();
        view.dispatch(transaction);
    };
};

/**
 * Remove all divs in the document.
 */
export function removeAllDivs() {
    const view = activeView()
    const allSelection = new AllSelection(view.state.doc);
    const transaction = view.state.tr.delete(allSelection.from, allSelection.to);
    view.dispatch(transaction);
};

/**
 * Return the node and position of a node with note.attrs of `id`
 * across the view.state.doc from position `from` to position `to`. 
 * If `from` or `to` are unspecified, they default to the beginning 
 * and end of view.state.doc.
 * @private
 * @param {string} id           The attrs.id of the node we are looking for.
 * @param {number} from         The position in the document to search from.
 * @param {number} to           The position in the document to search to.
 * @returns {object}            The node and position that matched the search.
 */
function _getNode(id, doc, from, to) {
    const view = activeView()
    const source = doc ?? view.state.doc;
    const fromPos = from ?? TextSelection.atStart(source).from;
    const toPos = to ?? TextSelection.atEnd(source).to;
    let foundNode, foundPos;
    source.nodesBetween(fromPos, toPos, (node, pos) => {
        if (node.attrs.id === id) {
            foundNode = node;
            foundPos = pos;
            return false;
        }
        // Only iterate over top-level nodes and drill in if a block
        return (!foundNode) && node.isBlock;
    });
    return {node: foundNode, pos: foundPos};
}


/********************************************************************************
 * Formatting
 * 1. Formats (B, I, U, DEL, CODE, SUB, SUP) are toggled off and on
 * 2. Formats can be nested, but not inside themselves; e.g., B cannot be within B
 */
//MARK: Formatting

/**
 * Toggle the selection to/from bold.
 */
export function toggleBold() {
    _toggleFormat('B');
};

/**
 * Toggle the selection to/from italic.
 */
export function toggleItalic() {
    _toggleFormat('I');
};

/**
 * Toggle the selection to/from underline.
 */
export function toggleUnderline() {
    _toggleFormat('U');
};

/**
 * Toggle the selection to/from strikethrough.
 */
export function toggleStrike() {
    _toggleFormat('DEL');
};

/**
 * Toggle the selection to/from code.
 */
export function toggleCode() {
    _toggleFormat('CODE');
};

/**
 * Toggle the selection to/from subscript.
 */
export function toggleSubscript() {
    _toggleFormat('SUB');
};

/**
 * Toggle the selection to/from superscript.
 */
export function toggleSuperscript() {
    _toggleFormat('SUP');
};

/**
 * Turn the format tag off and on for selection.
 * 
 * Although the HTML will contain <STRONG>, <EM>, and <S>, the types
 * passed here are <B>, <I>, and <DEL> for compatibility reasons.
 *
 * @private
 * @param {string} type     The *uppercase* type to be toggled at the selection.
 */
function _toggleFormat(type) {
    const view = activeView()
    let command = toggleFormatCommand(type)
    return command(view.state, view.dispatch, view)
};

export function toggleFormatCommand(type) {
    let commandAdapter = (viewState, dispatch, view) => {
        let state = view?.state ?? viewState;
        let toggle;
        switch (type) {
            case 'B':
                toggle = toggleMark(state.schema.marks.strong);
                break;
            case 'I':
                toggle = toggleMark(state.schema.marks.em);
                break;
            case 'U':
                toggle = toggleMark(state.schema.marks.u);
                break;
            case 'CODE':
                toggle = toggleMark(state.schema.marks.code);
                break;
            case 'DEL':
                toggle = toggleMark(state.schema.marks.s);
                break;
            case 'SUB':
                toggle = toggleMark(state.schema.marks.sub);
                break;
            case 'SUP':
                toggle = toggleMark(state.schema.marks.sup);
                break;
        };
        if (toggle && view) {
            toggle(state, view.dispatch);
            stateChanged(view)
        } else {
            return toggle
        }
    }
    return commandAdapter
}

/********************************************************************************
 * Styling
 * 1. Styles (P, H1-H6) are applied to blocks
 * 2. Unlike formats, styles are never nested (so toggling makes no sense)
 * 3. Every block should have some style
 */
//MARK: Styling


/**
 * Set the paragraph style at the selection to `style` 
 * 
 * @param {string}  style    One of the styles P or H1-H6 to set the selection to.
 */
export function setStyle(style) {
    const view = activeView()
    let command = setStyleCommand(style)
    let result = command(view.state, view.dispatch, view)
    return result
};

/**
 * Return a Command that sets the paragraph style at the selection to `style` 
 * 
 * @private
 * @param {string}  style    One of the styles P or H1-H6 to set the selection to.
 */
export function setStyleCommand(style) {
    let commandAdapter = (viewState, dispatch, view) => {
        let state = view?.state ?? viewState;
        const protonode = _nodeFor(style, state.schema);
        const doc = state.doc;
        const selection = state.selection;
        const tr = state.tr;
        let transaction, error;
        doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (node.type === state.schema.nodes.div) { 
                return true;
            } else if (node.isBlock) {
                if (node.type.inlineContent) {
                    try {
                        transaction = tr.setNodeMarkup(pos, protonode.type, protonode.attrs);
                    } catch(e) {
                        // We might hit multiple errors across the selection, but we will only return one MUError.Style
                        error = MUError.Style;
                        if ((e instanceof RangeError) && (protonode.type == state.schema.nodes.code_block)) {
                            // This is so non-obvious when people encounter it, it needs some explanation
                            error.info = ('Code style can only be applied to unformatted text.')
                        }
                    }
                } else {    // Keep searching if in blockquote or other than p, h1-h6
                    return true;
                }
            };
            return false;   // We only need top-level nodes within doc
        });
        if (error) {
            //error.alert = true
            //_callbackError(error)
            return false
        } else if (view) {
            const newState = view.state.apply(transaction);
            view.updateState(newState);
            stateChanged(view);
        } else {    // When checking if active based on state, return true only if different
            return paragraphStyle(state) != style;
        }
    }
    return commandAdapter
}

/**
 * Return a ProseMirror Node that corresponds to the MarkupEditor paragraph style.
 * @private
 * @param {string} paragraphStyle   One of the paragraph styles supported by the MarkupEditor.
 * @returns {Node | null}           A ProseMirror Node of the specified type or null if unknown.
 */
function _nodeFor(paragraphStyle, schema) {
    const nodeTypes = schema.nodes;
    let node;
    switch (paragraphStyle) {
        case 'P':
            node = nodeTypes.paragraph.create();
            break;
        case 'H1':
            node = nodeTypes.heading.create({level: 1})
            break;
        case 'H2':
            node = nodeTypes.heading.create({level: 2})
            break;
        case 'H3':
            node = nodeTypes.heading.create({level: 3})
            break;
        case 'H4':
            node = nodeTypes.heading.create({level: 4})
            break;
        case 'H5':
            node = nodeTypes.heading.create({level: 5})
            break;
        case 'H6':
            node = nodeTypes.heading.create({level: 6})
            break;
        case 'PRE':
            node = nodeTypes.code_block.create()
            break;
    };
    return node;
};

/********************************************************************************
 * Lists
 */
//MARK: Lists

/**
 * Turn the list tag on and off for the selection, doing the right thing
 * for different cases of selection.
 * 
 * If the selection is in a list of type `listType`, then outdent the 
 * items in the selection.
 * 
 * If the selection is in a list type that is different than `listType`,
 * then wrap it in a new list.
 * 
 * We use a single command returned by `multiWrapInList` because the command 
 * can be assigned to a single button in JavaScript.
 * 
 * @param {string}  listType     The kind of list we want the list item to be in if we are turning it on or changing it.
 */
export function toggleListItem(listType) {
    const view = activeView()
    const targetListType = nodeTypeFor(listType, schema);
    if (targetListType !== null) {
        const command = wrapInListCommand(schema, targetListType);
        command(view.state, (transaction) => {
            const newState = view.state.apply(transaction);
            view.updateState(newState);
        });
    };
};

/**
 * Return the type of list the selection is in, else null.
 * 
 * If a list type is returned, then it will be able to be outdented. Visually, 
 * the MarkupToolbar will show filled-in (aka selected), and pressing that button 
 * will outdent the list, an operation that can be repeated until the selection 
 * no longer contains a list. Similarly, if the list returned here is null, then  
 * the selection can be set to a list.
 * 
 * @private
 * @returns { 'UL' | 'OL' | null }
 */
export function getListType(state) {
    const selection = state.selection;
    const ul = state.schema.nodes.bullet_list;
    const ol = state.schema.nodes.ordered_list;
    let hasUl = false;
    let hasOl = false;
    state.doc.nodesBetween(selection.from, selection.to, node => {
        if (node.isBlock) {
            hasUl = hasUl || (node.type === ul);
            hasOl = hasOl || (node.type === ol);
            return true;  // Lists can nest, so we need to recurse
        }
        return false; 
    });
    // If selection contains no lists or multiple list types, return null; else return the one list type
    const hasType = hasUl ? (hasOl ? null : ul) : (hasOl ? ol : null)
    return listTypeFor(hasType, state.schema);
}

function _getListType() {
    const view = activeView()
    return getListType(view.state);
};

/**
 * Return the NodeType corresponding to `listType`, else null.
 * 
 * @private
 * @param {"UL" | "OL" | string} listType The String corresponding to the NodeType
 * @returns {NodeType | null}
 */
export function nodeTypeFor(listType, schema) {
    if (listType === 'UL') {
        return schema.nodes.bullet_list;
    } else if (listType === 'OL') {
        return schema.nodes.ordered_list;
    } else {
        return null;
    };
}

/**
 * Return the String corresponding to `nodeType`, else null.
 * 
 * @private
 * @param {NodeType} nodeType The NodeType corresponding to the String
 * @returns {'UL' | 'OL' | null}
 */
export function listTypeFor(nodeType, schema) {
    if (nodeType === schema.nodes.bullet_list) {
        return 'UL';
    } else if (nodeType === schema.nodes.ordered_list) {
        return 'OL';
    } else {
        return null;
    };
};

/**
 * Return a command that performs `wrapInList` or `liftListItem` depending on whether the selection 
 * is in the `targetNodeType` or not. In the former case, it does the `listLiftItem`, basically 
 * unwrapping the list. If `wrapInList` or `liftListItem` fails, it does the command across the 
 * selection. This is done by finding the common list node for the selection and then recursively 
 * replacing existing list nodes among its descendants that are not of the `targetNodeType`. So, the 
 * every descendant is made into `targetNodeType`, but not the common list node or its siblings. Note 
 * that when the selection includes a mixture of list nodes and non-list nodes (e.g., begins in a 
 * top-level <p> and ends in a list), the wrapping might be done by `wrapInList`, which doesn't follow 
 * quite the same rules in that it leaves existing sub-lists untouched. The wrapping can also just 
 * fail entirely (e.g., selection starting in a sublist and going outside of the list).
 * 
 * It seems a little silly to be passing `listTypes` and `listItemTypes` to the functions called from here, but it 
 * does avoid those methods from knowing about state or schema.
 * 
 * Adapted from code in https://discuss.prosemirror.net/t/changing-the-node-type-of-a-list/4996.
 * 
 * @private
 * @param {Schema}          schema              The schema holding the list and list item node types.
 * @param {NodeType}        targetNodeType      One of state.schema.nodes.bullet_list or ordered_list to change selection to.
 * @param {Attrs | null}    attrs               Attributes of the new list items.
 * @returns {Command}                           A command to wrap the selection in a list.
 */
export function wrapInListCommand(schema, targetNodeType, attrs) {
    const listTypes = [schema.nodes.bullet_list, schema.nodes.ordered_list];
    const targetListItemType = schema.nodes.list_item;
    const listItemTypes = [targetListItemType];

    const commandAdapter = (state, dispatch, view) => {
        const inTargetNodeType = getListType(state) === listTypeFor(targetNodeType, state.schema)
        const command = inTargetNodeType ? liftListItem(state.schema.nodes.list_item) : wrapInList(targetNodeType, attrs);
        if (command(state)) {
            let result = command(state, dispatch);
            if (dispatch) stateChanged(view)
            return result;
        }

        const commonListNode = _findCommonListNode(state, listTypes);
        if (!commonListNode) return false;

        if (dispatch) {
            const updatedNode = updateNode(
                commonListNode.node,
                targetNodeType,
                targetListItemType,
                listTypes,
                listItemTypes
            );

            let tr = state.tr;

            tr = tr.replaceRangeWith(
                commonListNode.from,
                commonListNode.to,
                updatedNode
            );

            tr = tr.setSelection(
                new TextSelection(
                    tr.doc.resolve(state.selection.from),
                    tr.doc.resolve(state.selection.to)
                )
            );

            dispatch(tr);
            stateChanged(view);
        }
        return true;
    };

    return commandAdapter;
};

/**
 * Return the common list node in the selection that is one of the `listTypes` if one exists.
 * 
 * @private
 * @param {EditorState}     state       The EditorState containing the selection.
 * @param {Array<NodeType>} listTypes   The list types we're looking for.
 * @returns {object}                    {node: Node, from: number, to: number}
 */
function _findCommonListNode(state, listTypes) {

    const range = state.selection.$from.blockRange(state.selection.$to);
    if (!range) return null;

    const node = range.$from.node(-2);
    if (!node || !listTypes.find((item) => item === node.type)) return null;

    const from = range.$from.posAtIndex(0, -2);
    return { node, from, to: from + node.nodeSize - 1 };
};

/**
 * Return a Fragment with its children replaced by ones that are of `targetListType` or `targetListItemType`.
 * 
 * @private
 * @param {Fragment}        content             The ProseMirror Fragment taken from the selection.
 * @param {NodeType}        targetListType      The bullet_list or ordered_list NodeType we are changing children to.
 * @param {NodeType}        targetListItemType  The list_item NodeType we are changing children to.
 * @param {Array<NodeType>} listTypes           The list types we're looking for.
 * @param {Array<NodeType>} listItemTypes       The list item types we're looking for.
 * @returns {Fragment}  A ProseMirror Fragment with the changed nodes.
 */
function updateContent(content, targetListType, targetListItemType, listTypes, listItemTypes) {
    let newContent = content;

    for (let i = 0; i < content.childCount; i++) {
        newContent = newContent.replaceChild(
            i,
            updateNode(
                newContent.child(i),
                targetListType,
                targetListItemType,
                listTypes,
                listItemTypes
            )
        );
    }

    return newContent;
};

/**
 * Return the `target` node type if the type of `node` is one of the `options`.
 * 
 * @private
 * @param {Node}            node 
 * @param {NodeType}        target 
 * @param {Array<NodeType>} options 
 * @returns {NodeType | null}
 */
function getReplacementType(node, target, options) {
    return options.find((item) => item === node.type) ? target : null;
};

/**
 * Return a new Node with one of the target types.
 * 
 * @private
 * @param {Node}            node                The node to change to targetListType or targetListItemType.
 * @param {NodeType}        targetListType      The list type we want to change `node` to.
 * @param {NodeType}        targetListItemType  The list item types we want to change `node` to.
 * @param {Array<NodeType>} listTypes           The list types we're looking for.
 * @param {Array<NodeType>} listItemTypes       The list item types we're looking for.
 * @returns {Node}
 */
function updateNode(node, targetListType, targetListItemType, listTypes, listItemTypes) {
    const newContent = updateContent(
        node.content,
        targetListType,
        targetListItemType,
        listTypes,
        listItemTypes
    );

    const replacementType = 
        getReplacementType(node, targetListType, listTypes) ||
        getReplacementType(node, targetListItemType, listItemTypes);

    if (replacementType) {
        return replacementType.create(node.attrs, newContent, node.marks);
    } else {
        return node.copy(newContent);
    };
};

/********************************************************************************
 * Indenting and Outdenting
 */
//MARK: Indenting and Outdenting

/**
 * Do a context-sensitive indent.
 *
 * If in a list, indent the item to a more nested level in the list if appropriate.
 * If in a blockquote, add another blockquote to indent further.
 * Else, put into a blockquote to indent.
 *
 */
export function indent() {
    const view = activeView()
    let command = indentCommand();
    return command(view.state, view.dispatch, view)
};

export function indentCommand() {
    let commandAdapter = (viewState, dispatch, view) => {
        let state = view?.state ?? viewState;
        let blockquote = state.schema.nodes.blockquote
        let li = state.schema.nodes.list_item
        let ul = state.schema.nodes.bullet_list
        let ol = state.schema.nodes.ordered_list
        const { $from, $to } = state.selection;
        let tr = state.tr;
        let willWrap = false
        let nodePos = []
        state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
            if (node.isBlock) {
                const $start = tr.doc.resolve(pos);
                const $end = tr.doc.resolve(pos + node.nodeSize);
                const range = $start.blockRange($end);
                if ((range) && (node.type != li)) { // We will never wrap an li
                    // Later we will check if the range is valid for wrapping
                    nodePos.push({node: node, pos: pos})
                }
                return true
            } else {
                return false
            }
        });

        let newState
        let skipParents = []
        if (nodePos.length > 0) {
            for (let { node, pos } of nodePos.sort((a, b) => b.pos - a.pos)) {
                if (skipParents.filter((np) => {return (node === np.node)}).length > 0) continue
                let $start = tr.doc.resolve(pos)
                let $end = tr.doc.resolve(pos + node.nodeSize)
                let range = $start.blockRange($end) // We know range will be defined
                // We need to determine what we will wrap in
                let nodeIsList = (node.type == ul) || (node.type == ol)
                if (!nodeIsList && ($start.parent.type == li)) {
                    // We are going to try to wrap the list in a sublist, but if we 
                    // cannot, then we will try to wrap the list in a blockquote
                    let list = $start.node($start.depth - 1)
                    let willWrapInList = wrapRangeInList(null, range, list.type, list.attrs)
                    willWrap = willWrap || willWrapInList
                    if (willWrapInList) {
                        // If we are wrapping this <li><p></p></li>, then skip all of its parents
                        skipParents.push(...parents($start, null, 1))
                    }
                    if (dispatch && willWrapInList) {
                        wrapRangeInList(tr, range, list.type, list.attrs)
                        newState = state.apply(tr)
                    }
                } else {
                    // We are going to try tp wrap in a blockquote
                    let wrappers = findWrapping(range, blockquote, node.attrs)
                    if (wrappers) {
                        willWrap = true
                        let parentsInSelection = []
                        let allParents = parents($start, null, 1)
                        // If we are wrapping a list, then track parents to skip
                        if (nodeIsList) {
                            // Find the parents to skip as we try to indent ones above us
                            parentsInSelection = allParents.filter((np) => {
                                let npNode = np.node
                                let npIsList = (npNode.type == ul) || (npNode.type == ol) 
                                if (!npIsList) return false                 // We are only skipping lists
                                if (npNode.type != node.type) return false  // We are only skipping parent lists of same type
                                // And only lists outside of the original selection
                                return (np.start < $from.pos) && (np.end > $to.pos)
                            })
                            skipParents.push(...parentsInSelection)
                        } else {
                            parentsInSelection = allParents.filter((np) => {
                                let npNode = np.node
                                let npIsBlockquote = (npNode.type == blockquote)
                                if (!npIsBlockquote) return false                 // We are only skipping blockquotes
                                // And only blockquotes outside of the original selection
                                return (np.start < $from.pos) && (np.end > $to.pos)
                            })
                        }
                        skipParents.push(...parentsInSelection)
                        if (dispatch) {
                            newState = state.apply(tr.wrap(range, wrappers))
                        }
                    }
                }
            }
        }

        if (dispatch && willWrap && newState) view.updateState(newState)
        return willWrap

    };
    return commandAdapter
}

/**
 * Do a context-sensitive outdent.
 *
 * If in a list, outdent the item to a less nested level in the list if appropriate.
 * If in a blockquote, remove a blockquote to outdent further.
 * Else, do nothing.
 * 
 * Note that outdenting of a top-level list with a sublist doesn't work. TBH, I'm not sure why, 
 * but liftTarget returns null at the top-level in that case. As a result, the outdenting has 
 * to be done at least twice, the first of which splits the sublist from the top level. When this 
 * happens, we should probably just do the equivalent of toggleListType.
 *
 */
export function outdent() {
    const view = activeView()
    let command = outdentCommand()
    return command(view.state, view.dispatch, view)
};

export function outdentCommand() {
    let commandAdapter = (viewState, dispatch, view) => {
        let state = view?.state ?? viewState;
        const { $from, $to } = state.selection;
        let tr = state.tr;
        let willLift = false
        let nodePos = []
        state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
            if (node.isBlock) {
                const $start = tr.doc.resolve(pos);
                const $end = tr.doc.resolve(pos + node.nodeSize);
                const range = $start.blockRange($end);
                if (range) {
                    const target = liftTarget(range);
                    if ((target !== null) && (target >= 0)) {
                        nodePos.push({node: node, pos: pos})
                    }
                }
                return true
            } else {
                return false
            }
        });

        if (nodePos.length > 0) {
            let skipParents = []
            for (let {node, pos} of nodePos.sort((a, b) => b.pos - a.pos)) {
                // The problem we have here is that when we lift node within
                // a blockquote and it has no siblings, the lift operation removes 
                // the parent (see https://discuss.prosemirror.net/t/lifting-and-parent-nodes/1332).
                // In particular, we don't want to resolve the pos of node after 
                // its only child has been lifted, because it doesn't exist any more.
                // In fact, we need to skip lifting of all the ancestors when this happens.
                if (skipParents.filter((np) => {return (node === np.node)}).length > 0) continue
                let $start = tr.doc.resolve(pos)
                if ($start.parent.children.length == 1) {
                    // Then this node, when lifted will remove 
                    // the parent. Therefore, track the parent 
                    // and don't lift it if we encounter it later
                    // in the iteration over nodePos.
                    skipParents.push(...parents($start, null, 1))
                }
                let $end = tr.doc.resolve(pos + node.nodeSize)
                let range = $start.blockRange($end)
                if (range) { 
                    let target = liftTarget(range)
                    if ((target !== null) && (target >= 0)) {
                        willLift = true
                        if (dispatch) tr.lift(range, target)
                    }
                }
            }
        }

        if (dispatch && willLift) dispatch(tr)
        return willLift

    };
    return commandAdapter
}

function parents($pos, start, end) {
    //$pos.node($pos.depth) is the same as $pos.parent.
    let startDepth = start ?? $pos.depth    // start at immediate parent by default
    let endDepth = end ?? 0                 // end at the top-level by default (i.e., include 'doc')
    let parents = []
    for (let depth = startDepth; depth >= endDepth; depth--) {
        let node = $pos.node(depth)
        let start = $pos.start(depth)
        let end = $pos.end(depth)
        parents.push({node: node, start: start, end: end})
    }
    return parents
}

/********************************************************************************
 * Clean up to avoid ugly HTML
 */
//MARK: Clean Up

/**
 * Remove all children with names in node.
 * @private
 * @param {string[]} names 
 * @param {HTMLElement} node 
 */
function _cleanUpTypesWithin(names, node) {
    const ucNames = names.map((name) => name.toUpperCase());
    const childNodes = node.childNodes;
    for (let i=0; i < childNodes.length; i++) {
        const child = childNodes[i];
        if (ucNames.includes(child.nodeName)) {
            node.removeChild(child);
            i--;    // Because we just removed one
        } else if (child.childNodes.length > 0) {
            _cleanUpTypesWithin(names, child);
        };
    };
};

/**
 * Do a depth-first traversal from node, removing spans starting at the leaf nodes.
 * 
 * @private
 * @returns {number}    The number of spans removed
 */
function _cleanUpSpansWithin(node, spansRemoved) {
    return _cleanUpSpansDivsWithin(node, 'SPAN', spansRemoved);
};

/**
 * Do a depth-first traversal from node, removing divs starting at the leaf nodes.
 * 
 * @private
 * @returns {number}    The number of divs removed
 */
function _cleanUpDivsWithin(node, divsRemoved) {
    return _cleanUpSpansDivsWithin(node, 'DIV', divsRemoved);
}

/**
 * Do a depth-first traversal from node, removing divs/spans starting at the leaf nodes.
 * 
 * @private
 * @returns {number}    The number of divs/spans removed
 */
function _cleanUpSpansDivsWithin(node, type, removed) {
    removed = removed ?? 0;
    // Nested span/divs show up as children of a span/div.
    const children = node.children;
    let child = (children.length > 0) ? children[0] : null;
    while (child) {
        let nextChild = child.nextElementSibling;
        removed = _cleanUpSpansDivsWithin(child, type, removed);
        child = nextChild;
    };
    if (node.nodeName === type) {
        removed++;
        if (node.childNodes.length > 0) {   // Use childNodes because we need text nodes
            const template = document.createElement('template');
            template.innerHTML = node.innerHTML;
            const newElement = template.content;
            node.replaceWith(newElement);
        } else {
            node.parentNode.removeChild(node);
        };
    };
    return removed;
};

/********************************************************************************
 * Selection
 */
//MARK: Selection

/**
 * Populate a dictionary of properties about the current selection
 * and return it in a JSON form. This is the primary means that the
 * find out what the selection is in the document, so we
 * can tell if the selection is in a bolded word or a list or a table, etc.
 *
 * @returns {string}      The stringified dictionary of selectionState.
 */
export function getSelectionState() {
    const state = _getSelectionState();
    return JSON.stringify(state);
};

/**
 * Populate a dictionary of properties about the current selection and return it.
 * 
 * @private
 * @returns {object}     The string-keyed dictionary of properties describing the selection
 */
function _getSelectionState() {
    const state = {};
    // When we have multiple contentEditable elements within editor, we need to
    // make sure we selected something that is editable. If we didn't
    // then just return state, which will be invalid but have the enclosing div ID.
    // Note: callbackInput() uses a cached value of the *editable* div ID
    // because it is called at every keystroke and change, whereas here we take
    // the time to find the enclosing div ID from the selection so we are sure it
    // absolutely reflects the selection state at the time of the call regardless
    // of whether it is editable or not.
    const contentEditable = _getContentEditable();
    state['divid'] = contentEditable.id;            // Will be 'editor' or a div ID
    state['valid'] = contentEditable.editable;      // Valid means the selection is in something editable
    if (!contentEditable.editable) return state;    // No need to do more with state if it's not editable

    // Selected text
    state['selection'] = _getSelectionText();
    // The selrect tells us where the selection can be found
    const selrect = getSelectionRect();
    const selrectDict = {
        'x' : selrect.left,
        'y' : selrect.top,
        'width' : selrect.right - selrect.left,
        'height' : selrect.bottom - selrect.top
    };
    state['selrect'] = selrectDict;
    // Link
    const linkAttributes = getLinkAttributes();
    state['href'] = linkAttributes['href'];
    state['link'] = linkAttributes['link'];
    // Image
    const imageAttributes = _getImageAttributes();
    state['src'] = imageAttributes['src'];
    state['alt'] = imageAttributes['alt'];
    state['width'] = imageAttributes['width'];
    state['height'] = imageAttributes['height'];
    state['scale'] = imageAttributes['scale'];
    //// Table
    const tableAttributes = _getTableAttributes();
    state['table'] = tableAttributes.table;
    state['thead'] = tableAttributes.thead;
    state['tbody'] = tableAttributes.tbody;
    state['header'] = tableAttributes.header;
    state['colspan'] = tableAttributes.colspan;
    state['rows'] = tableAttributes.rows;
    state['cols'] = tableAttributes.cols;
    state['row'] = tableAttributes.row;
    state['col'] = tableAttributes.col;
    state['border'] = tableAttributes.border
    //// Style
    state['style'] = _getParagraphStyle();
    state['list'] = _getListType();
    state['li'] = state['list'] !== null;   // We are always in a li by definition for ProseMirror, right?
    state['quote'] = isIndented();
    // Format
    const markTypes = _getMarkTypes();
    state['bold'] = markTypes.has(schema.marks.strong);
    state['italic'] = markTypes.has(schema.marks.em);
    state['underline'] = markTypes.has(schema.marks.u);
    state['strike'] = markTypes.has(schema.marks.s);
    state['sub'] = markTypes.has(schema.marks.sub);
    state['sup'] = markTypes.has(schema.marks.sup);
    state['code'] = markTypes.has(schema.marks.code);
    return state;
};

/**
 * Return the id and editable state of the selection.
 * 
 * We look at the outermost div from the selection anchor, so if the 
 * selection extends between divs (which should not happen), or we have 
 * a div embedding a div where the editable attribute is different (which 
 * should not happen), then the return might be unexpected (haha, which 
 * should not happen, of course!).
 * 
 * @private
 * @returns {object} The id and editable state that is selected.
 */
function _getContentEditable() {
    const view = activeView()
    const anchor = view.state.selection.$anchor;
    const divNode = outermostOfTypeAt(schema.nodes.div, anchor);
    if (divNode) {
        return {id: divNode.attrs.id, editable: divNode.attrs.editable ?? false};
    } else {
        return {id: 'editor', editable: true};
    }
}

/**
 * Return the text at the selection.
 * 
 * @private
 * @returns {string | null} The text that is selected.
 */
function _getSelectionText() {
    const view = activeView()
    const doc = view.state.doc;
    const selection = view.state.selection;
    if (selection.empty) return '';
    const fragment =  doc.cut(selection.from, selection.to).content;
    let text = '';
    fragment.nodesBetween(0, fragment.size, (node) => {
        if (node.isText) {
            text += node.text;
            return false;
        }
        return true;
    })
    return (text.length === 0) ? null : text;
};

/**
 * Return the rectangle that encloses the selection.
 * 
 * @private
 * @returns {object} The selection rectangle's top, bottom, left, right.
 */
export function getSelectionRect() {
    const view = activeView()
    const selection = view.state.selection;
    const fromCoords = view.coordsAtPos(selection.from);
    if (selection.empty) return fromCoords;
    // TODO: If selection spans lines, then left should be zero and right should be view width
    const toCoords = view.coordsAtPos(selection.to);
    const top = Math.min(fromCoords.top, toCoords.top);
    const bottom = Math.max(fromCoords.bottom, toCoords.bottom);
    const left = Math.min(fromCoords.left, toCoords.left);
    const right = Math.max(fromCoords.right, toCoords.right);
    return {top: top, bottom: bottom, left: left, right: right};
};

/**
 * Return the MarkTypes that exist at the selection.
 * 
 * @private
 * @returns {Set<MarkType>}   The set of MarkTypes at the selection.
 */
function _getMarkTypes() {
    const view = activeView()
    const state = view.state;
    const {from, $from, to, empty} = state.selection;
    if (empty) {
        const marks = state.storedMarks || $from.marks();
        const markTypes = marks.map(mark => { return mark.type });
        return new Set(markTypes);
    } else {
        const markTypes = new Set();
        state.doc.nodesBetween(from, to, node => {
            node.marks.forEach(mark => markTypes.add(mark.type));
        });
        return markTypes;
    }
};

/**
 * Return the link attributes at the selection.
 * 
 * @returns {object}   An Object whose properties are the link attributes (like href, link) at the selection.
 */
export function getLinkAttributes() {
    const view = activeView()
    const selection = view.state.selection;
    const selectedNodes = [];
    view.state.doc.nodesBetween(selection.from, selection.to, node => {
        if (node.isText) selectedNodes.push(node);
    });
    const selectedNode = (selectedNodes.length === 1) && selectedNodes[0];
    if (selectedNode) {
        const linkMarks = selectedNode.marks.filter(mark => mark.type === schema.marks.link)
        if (linkMarks.length === 1) {
            return {href: linkMarks[0].attrs.href, link: selectedNode.text};
        };
    };
    return {};
};

function _getImageAttributes() {
    const view = activeView()
    return getImageAttributes(view.state)
}

/**
 * Return the image attributes at the selection
 * @returns {object}   An Object whose properties are the image attributes (like src, alt, width, height, scale) at the selection.
 */
export function getImageAttributes(state) {
    const selection = state.selection;
    const selectedNodes = [];
    state.doc.nodesBetween(selection.from, selection.to, node => {
        if (node.type === state.schema.nodes.image)  {
            selectedNodes.push(node);
            return false;
        };
        return true;
    });
    const selectedNode = (selectedNodes.length === 1) && selectedNodes[0];
    return selectedNode ? selectedNode.attrs : {};
};

/**
 * If the selection is inside a table, populate attributes with the information
 * about the table and what is selected in it.
 * 
 * In the MarkupEditor, if there is a header, it is always colspanned across the number 
 * of columns, and normal rows are never colspanned.
 *
 * @private
 * @returns {object}   An object with properties populated.
 */
function _getTableAttributes(state) {
    const view = activeView()
    const viewState = state ?? view.state;
    const selection = viewState.selection;
    const nodeTypes = viewState.schema.nodes;
    const attributes = {};
    viewState.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
        let $pos = viewState.doc.resolve(pos);
        switch (node.type) {
            case nodeTypes.table:
                attributes.table = true;
                attributes.from = pos;
                attributes.to = pos + node.nodeSize;
                // Determine the shape of the table. Altho the selection is within a table, 
                // the node.type switching above won't include a table_header unless the 
                // selection is within the header itself. For this reason, we need to look 
                // for the table_header by looking at nodesBetween from and to.
                attributes.rows = node.childCount;
                attributes.cols = 0;
                viewState.doc.nodesBetween(attributes.from, attributes.to, (node) => {
                    switch (node.type) {
                        case nodeTypes.table_header:
                            attributes.header = true;
                            attributes.colspan = node.attrs.colspan;
                            if (attributes.colspan) {
                                attributes.cols = Math.max(attributes.cols, attributes.colspan);
                            } else {
                                attributes.cols = Math.max(attributes.cols, node.childCount);
                            };
                            return false;
                        case nodeTypes.table_row:
                            attributes.cols = Math.max(attributes.cols, node.childCount);
                            return true;
                    };
                    return true;
                });
                // And its border settings
                attributes.border = _getBorder(node);
                return true;
            case nodeTypes.table_header:
                attributes.thead = true;                        // We selected the header
                attributes.tbody = false;
                attributes.row = $pos.index() + 1;              // The row will be 1 by definition
                attributes.col = 1;                             // Headers are always colspanned, so col=1
                return true;
            case nodeTypes.table_row:
                attributes.row = $pos.index() + 1;              // We are in some row, but could be the header row
                return true;
            case nodeTypes.table_cell:
                attributes.tbody = true;                        // We selected the body
                attributes.thead = false;
                attributes.col = $pos.index() + 1;              // We selected a body cell
                return false;
        };
        return true;
    });
   return attributes;
}

/**
 * Return the paragraph style at the selection.
 * 
 * @private
 * @returns {string}   {Tag name | 'Multiple'} that represents the selected paragraph style.
 */
function _getParagraphStyle() {
    const view = activeView()
    return paragraphStyle(view.state)
};

export function paragraphStyle(state) {
    const selection = state.selection;
    const nodeTypes = new Set();
    state.doc.nodesBetween(selection.from, selection.to, node => {
        if (node.isBlock) { 
            nodeTypes.add(node.type)
        };
        return false;   // We only need top-level nodes
    });
    return (nodeTypes.size <= 1) ? _paragraphStyleFor(selection.$anchor.parent) : 'Multiple';
}

/**
 * Given a ProseMirror Node, return the HTML tag it corresponds to in the MarkupEditor.
 * 
 * @private
 * @param {Node} node The node we want the paragraph style for
 * @returns { "P" | "H1" | "H2" | "H3" | "H4" | "H5" | "H6" | "PRE" | null }
 */
function _paragraphStyleFor(node) {
    var style;
    switch (node.type.name) {
        case 'paragraph':
            style = "P";
            break;
        case 'heading':
            style = "H" + node.attrs.level;
            break;
        case 'code_block':
            style = "PRE";
            break;
    };
    return style;
};

export function isIndented(activeState) {
    const view = activeView()
    let state = activeState ? activeState : view.state;
    return _getIndented(state); 
}

/**
 * Return whether the selection is indented.
 * 
 * @private
 * @returns {boolean}   Whether the selection is in a blockquote.
 */
function _getIndented(state) {
    const selection = state.selection;
    let indented = false;
    state.doc.nodesBetween(selection.from, selection.to, node => {
        if (node.type == state.schema.nodes.blockquote) { 
            indented = true;
        };
        return false;   // We only need top-level nodes
    });
    return indented;
};

//MARK: Callbacks

/**
 * Callback to signal that input came-in, passing along the DIV ID
 * that the input occurred-in if known. If DIV ID is not known, the raw 'input'
 * callback means the change happened in the 'editor' div.
 * 
 * @private
 */
export function callbackInput(element) {
    _callback('input' + (selectedID() ?? ''), element)
};

/**
 * Callback to signal that user-provided CSS and/or script files have
 * been loaded.
 * 
 * @private
 */
function _loadedUserFiles(target) {
    _callback('loadedUserFiles', target ?? activeDocument());
};

/**
 * Callback to signal that an error occurred.
 * 
 * @private
 * @param {MUError} error 
 */
function _callbackError(error) {
    _callback(error.messageDict())
}

/**
 * Report a selection change.
 * 
 * @private
 */
export function selectionChanged(element) {
    _callback('selectionChanged', element)
}

/**
 * Report a click.
 * 
 * @private
 */
export function clicked(view, element) {
    deactivateSearch(view)
    _callback('clicked', element)
}

/**
 * Report a button click.
 * 
 * @private
 */
export function buttonClicked(message, element) {
    _callback(message, element)
}

/// Search-related callbacks

export function searchedCallback(element) {
    _callback('searched', element)
}

export function activateSearchCallback(element) {
    _callback('activateSearch', element)
}

export function deactivateSearchCallback(element) {
    _callback('deactivateSearch', element)
}

/**
 * Set the active document and report focus.
 * 
 * @param {HTMLElement} element The HTML element whose root node should become active
 */
export function focused(element) {
    setActiveDocument(element.getRootNode())
    _callback('focus', element)
}

/**
 * Report blur. Note we don't reset active `muId` because elements 
 * lose focus (e.g., during user interaction like search) and we 
 * still want to use the same root node `muId`.
 * @private
 */
export function blurred(element) {
    _callback('blur', element)
}

/**
 * Report a change in the ProseMirror document state. The 
 * change might be from typing or formatting or styling, etc.
 * and triggers both a `selectionChanged` and `input` callback.
 * 
 * @private
 * @returns {boolean}    Return false so we can use in chainCommands directly
 */
export function stateChanged(view) {
    if (!view) return
    deactivateSearch(view)
    selectionChanged(_editor(view))
    callbackInput(_editor(view))
    return false;
}

function _editor(view) {
    return view.dom.getRootNode().firstChild
}

/**
 * Post a message to the message handler.
 * 
 * Refer to MarkupCoordinator.swift source for message types and contents that are supported in Swift.
 * 
 * @private
 * @param {string | object} message  A JSON-serializable JavaScript object.
 */
export function postMessage(message) {
    _callback(JSON.stringify(message))
}

/********************************************************************************
 * Testing support
 */
//MARK: Testing Support

/**
 * Set the HTML `contents` and select the text identified by `sel`, removing the 
 * `sel` markers in the process.
 * 
 * Note that because we run multiple tests against a given view, and we use setTestHTML
 * to set the contents, we need to reset the view state completely each time. Otherwise, 
 * the history can be left in a state where an undo will work because the previous test
 * executed redo.
 * 
 * @param {string} contents  The HTML for the editor
 * @param {string} sel       An embedded character in contents marking selection point(s)
 */
export function setTestHTML(contents, sel) {
    const view = activeView()
    // Start by resetting the view state.
    let state = EditorState.create({schema: schema, doc: view.state.doc, plugins: view.state.plugins});
    view.updateState(state);

    // Then set the HTML, which won't contain any sel markers.
    setHTML(contents, false);   // Do a normal setting of HTML
    if (!sel) return;           // Don't do any selection if we don't know what marks it

    // We need to clear the search state because we use it to find sel markers.
    activeSearcher()?.cancel();

    // It's important that deleting the sel markers is not part of history, because 
    // otherwise undoing later will put them back.
    const selFrom = activeSearcher()?.searchFor(sel).from;   // Find the first marker
    if (selFrom) {              // Delete the 1st sel
        const transaction = view.state.tr
            .deleteSelection()
            .setMeta("addToHistory", false);
        view.dispatch(transaction);
    } else {
        return;                 // There was no marker to find
    }

    let selTo = activeSearcher()?.searchFor(sel).to;         // May be the same if only one marker
    if (selTo != selFrom) {     // Delete the 2nd sel if there is one; if not, they are the same
        const transaction = view.state.tr
            .deleteSelection()
            .setMeta("addToHistory", false);
        view.dispatch(transaction);
        selTo = selTo - sel.length;
    }

    // Set the selection based on where we found the sel markers. This should be part of 
    // history, because we need it to be set back on undo.
    const $from = view.state.doc.resolve(selFrom);
    const $to = view.state.doc.resolve(selTo)
    const transaction = view.state.tr.setSelection(new TextSelection($from, $to))
    view.dispatch(transaction);
};

/**
 * Get the HTML contents and mark the selection from/to using the text identified by `sel`.
 * 
 * @param {string} sel       An embedded character in contents indicating selection point(s)
 */
export function getTestHTML(sel) {
    if (!sel) return getHTML(false);   // Return the compressed/unformatted HTML if no sel
    const view = activeView()
    let state = view.state;
    const selection = state.selection;
    const selFrom = selection.from;
    const selTo = selection.to;
    // Note that we never dispatch the transaction, so the view is not changed and
    // history is not affected.
    let transaction = state.tr.insertText(sel, selFrom)
    if (selFrom != selTo) transaction = transaction.insertText(sel, selTo + sel.length);
    const htmlElement = DOMSerializer.fromSchema(state.schema).serializeFragment(transaction.doc.content);
    const div = document.createElement('div');
    div.appendChild(htmlElement);
    return div.innerHTML;
};

/** Undo the previous action. */
export function doUndo() {
    const view = activeView()
    let command = undoCommand();
    let result = command(view.state, view.dispatch, view);
    return result
}

/**
 * Return a command to undo and do the proper callbacks.
 * 
 * @private
 */
export function undoCommand() {
    let commandAdapter = (state, dispatch, view) => {
        let result = undo(state, dispatch);
        if (result && dispatch) {
            stateChanged(view)
        }
        return result
    }
    return commandAdapter
};

/** Redo the previously undone action. */
export function doRedo() {
    const view = activeView()
    let command = redoCommand();
    let result = command(view.state, view.dispatch, view);
    return result
}

/**
 * Return a command to redo and do the proper callbacks.
 * 
 * @private
 */
export function redoCommand() {
    let commandAdapter = (state, dispatch, view) => {
        let result = redo(state, dispatch, view);
        if (result && dispatch) {
            stateChanged(view)
        }
        return result
    }
    return commandAdapter
};

/**
 * For testing purposes, invoke _doBlockquoteEnter programmatically.
 * 
 * TODO: Implement
 */
export function testBlockquoteEnter() {
};

/**
 * For testing purposes, invoke the splitCommand programmatically.
 */
export function testListEnter() {
    const view = activeView()
    const splitCommand = splitListItem(schema.nodes.list_item);
    splitCommand(view.state, view.dispatch);
};

/**
 * For testing purposes, invoke extractContents() on the selected range
 * to make sure the selection is as expected.
 * 
 * TODO: Implement
 */
export function testExtractContents() {
};

/**
 * For testing purposes, create a ProseMirror Node that conforms to the 
 * MarkupEditor schema and return the resulting html as a string. 
 * Testing in this way lets us do simple pasteHTML tests with
 * clean HTML and test the effect of schema-conformance on HTML contents
 * separately. The html passed here is (typically) obtained from the paste 
 * buffer.
 * 
 * @param {string}  html    The HTML to paste
 */
export function testPasteHTMLPreprocessing(html) {
    const node = _nodeFromHTML(html);
    const fragment = fragmentFromNode(node);
    return htmlFromFragment(fragment);
};

/**
 * Use the same approach as testPasteHTMLPreprocessing, but augment with 
 * _minimalHTML to get a MarkupEditor-equivalent of unformatted text.
 * 
 * @param {string}  html    The HTML to paste
 */
export function testPasteTextPreprocessing(html) {
    const node = _nodeFromHTML(html);
    const fragment = fragmentFromNode(node);
    const minimalHTML = _minimalHTML(fragment);
    return minimalHTML;
};

/********************************************************************************
 * Links
 */
//MARK: Links

/**
 * Insert a link to url. When the selection is collapsed, the url is inserted
 * at the selection point as a link.
 *
 * When done, leave the link selected.
 *
 * @param {string}  url             The url/href to use for the link
 */
export function insertLink(url) {
    const view = activeView()
    let command = insertLinkCommand(url);
    let result = command(view.state, view.dispatch, view);
    return result
};

export function insertLinkCommand(url) {
    const commandAdapter = (state, dispatch, view) => {
        const selection = state.selection;
        const linkMark = state.schema.marks.link.create({ href: url });
        if (selection.empty) {
            const textNode = state.schema.text(url).mark([linkMark]);
            const transaction = state.tr.replaceSelectionWith(textNode, false);
            const linkSelection = TextSelection.create(transaction.doc, selection.from, selection.from + textNode.nodeSize);
            transaction.setSelection(linkSelection);
            dispatch(transaction);
            stateChanged(view);
        } else {
            const toggle = toggleMark(linkMark.type, linkMark.attrs);
            if (toggle) {
                toggle(state, dispatch);
                stateChanged(view);
            }
        };

        return true;
    };
    return commandAdapter;
}

export function insertInternalLinkCommand(hTag, index) {
    const commandAdapter = (state, dispatch, view) => {
        // Find the node matching hTag that is index into the nodes matching hTag
        let {node} = headerMatching(hTag, index, state)
        if (!node) return false
        // Get the unique id for this header, which is may or may not already have.
        let id = idForHeader(node, state)
        let attrs = node.attrs
        attrs.id = id
        // Insert the mark (id is always referenced with # at front) and set (or reset) the 
        // id in the header itself. We don't care if it's the same, but we want these changes 
        // to be made in a single transaction so we can undo them if needed.
        const selection = state.selection;
        const linkMark = state.schema.marks.link.create({ href: '#' + id });
        if (selection.empty) {
            // In case of an empty selection, insert the textContent of the header and then use 
            // that to link-to the header
            const textNode = state.schema.text(node.textContent, [linkMark]);
            let transaction = state.tr.replaceSelectionWith(textNode, false);
            dispatch(transaction);
            stateChanged(view);
            return true;
        } else {
            const toggle = toggleMark(linkMark.type, linkMark.attrs);
            if (toggle) {
                toggle(state, dispatch)
                stateChanged(view);
                return true;
            } else {
                return false;
            }
        }
    };
    return commandAdapter;
}

/**
 * Unlike other commands, this one returns an object identifying the id for the header with hTag. 
 * Other commands return true or false. This command also never does anything with the view or state.
 * 
 * @private
 * @param {string} hTag     One of the strings `H1`-`H6`
 * @param {number} index    Within existing elements with tag `hTag`, this is the index into them that is identified
 * @returns {Function(EditorState): object} A function that contains hTag, index, id, and whether the if already exists
 */
export function idForInternalLinkCommand(hTag, index) {
    const commandAdapter = (state) => {
        let {node} = headerMatching(hTag, index, state)
        if (!node) return false;
        return {hTag: hTag, index: index, id: idForHeader(node, state), exists: node.attrs.id != null}
    }
    return commandAdapter;
}

/**
 * Return a unique identifier for the heading `node` by lowercasing its trimmed textContent
 * and replacing blanks with `-`, then appending a number until its unique if required.
 * If the heading `node` has an id, then just return it.
 * 
 * Since the `node.textContent` can be arbitrarily large, we limit the id to 40 characters 
 * just to avoid unwieldy IDs.
 * 
 * @private
 * @param {Node}        node    A ProseMirror Node that is of heading type
 * @param {EditorState} state     
 * @returns {string}            A unique ID that is used by `node` or that can be assigned to `node`
 */
function idForHeader(node, state) {
    if (node.attrs.id) return node.attrs.id
    let id = node.textContent.toLowerCase().substring(0, 40)
    id = id.replaceAll(' ', '-')
    let {node: idNode} = nodeWithId(id, state)
    let index = 0;
    while (idNode) {
        index++
        id = id + index.toString()
        let {node} = nodeWithId(id, state)
        idNode = node
    }
    return id
}

/**
 * Return the node and its position that has an attrs.id matching `id`.
 * 
 * @private
 * @param {string} id           The id attr of a Node we are trying to match
 * @param {EditorState} state   The state of the ProseMirror editor
 * @returns {object}            The `node` and its `pos` in the `state.doc`
 */
export function nodeWithId(id, state) {
    let idNode, idPos
    state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
        if (!idNode && (node.attrs.id == id)) {
            idNode = node
            idPos = pos
            return false
        }
        return !idNode  // Keep traversing unless we found a matching id
    })
    return {node: idNode, pos: idPos}
}

function headerMatching(hTag, index, state) {
    let header = {node: null, pos: null}
    let hLevel = parseInt(hTag.substring(1))
    let headersAtLevel = headers(state)[hLevel]
    if (!headersAtLevel) {
        return header
    } else {
        return headersAtLevel[index]
    }
}

/**
 * Return all the headers that exist in `state.doc` as arrays keyed by level.
 * 
 * @private
 * @param {EditorState} state   The state of the ProseMirror editor
 */ 
export function headers(state) {
    let headers = {}
    let hType = state.schema.nodes.heading
    let pType = state.schema.nodes.paragraph
    let cType = state.schema.nodes.code_block
    state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
        let nodeType = node.type
        if (nodeType == hType) {
            let level = node.attrs.level
            if (!headers[level]) headers[level] = []
            headers[level].push({node: node, pos: pos})
            return false
        } else if ((nodeType == pType) || (nodeType == cType)) {
            // We don't need to keep traversing a <H1-6>, <P>, or <PRE><CODE> because 
            // they can't contain other headers
            return false
        }
        // However, the remaining block nodes like table cells and lists can contain them
        return true
    })
    return headers
}

/**
 * Remove the link at the selection, maintaining the same selection.
 * 
 * The selection can be at any point within the link or contain the full link, but cannot include 
 * areas outside of the link.
 */
export function deleteLink() {
    const view = activeView()
    // Make sure the selection is in a single text node with a linkType Mark and 
    // that the full link is selected in the view.
    selectFullLink(view)

    // Then execute the deleteLinkCommand, which removes the link and leaves the 
    // full text of what was linked selected.
    let command = deleteLinkCommand()
    return command(view.state, view.dispatch, view)
};

export function deleteLinkCommand() {
    const commandAdapter = (state, dispatch, view) => {
        const linkType = view.state.schema.marks.link;
        const selection = view.state.selection;
        const toggle = toggleMark(linkType);
        if (toggle) {
            return toggle(view.state, (tr) => {
                let newState = view.state.apply(tr);   // Toggle the link off
                const textSelection = TextSelection.create(newState.doc, selection.from, selection.to);
                tr.setSelection(textSelection);
                view.dispatch(tr);
                stateChanged(view);
            });
        } else {
            return false;
        }
    };
    return commandAdapter;
}

export function selectFullLink(view) {
    const linkType = view.state.schema.marks.link;
    const selection = view.state.selection;

    // Make sure the selection is in a single text node with a linkType Mark
    const nodePos = [];
    view.state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
        if (node.isText) {
            nodePos.push({node: node, pos: pos});
            return false;
        };
        return true;
    });
    if (nodePos.length !== 1) return;
    const selectedNode = nodePos[0].node;
    const selectedPos = nodePos[0].pos;
    const linkMarks = selectedNode && selectedNode.marks.filter(mark => mark.type === linkType);
    if (linkMarks.length !== 1) return;

    // Select the entire text of selectedNode
    const anchor = selectedPos;
    const head = anchor + selectedNode.nodeSize;
    const linkSelection = TextSelection.create(view.state.doc, anchor, head);
    const transaction = view.state.tr.setSelection(linkSelection);
    view.dispatch(transaction);
}

/********************************************************************************
 * Images
 */
//MARK: Images

/**
 * Insert the image at src with alt text, signaling state changed when done loading.
 * We leave the selection after the inserted image.
 *
 * @param {string}              src         The url of the image.
 * @param {string}              alt         The alt text describing the image.
 */
export function insertImage(src, alt) {
    const view = activeView()
    let command = insertImageCommand(src, alt)
    return command(view.state, view.dispatch, view)
};

export function insertImageCommand(src, alt) {
    const commandAdapter = (state, dispatch, view) => {
        const imageNode = view.state.schema.nodes.image.create({src: src, alt: alt})
        const transaction = view.state.tr.replaceSelectionWith(imageNode, true)
        view.dispatch(transaction);
        stateChanged(view);
        return true;
    }

    return commandAdapter
}

/**
 * Modify the attributes of the image at selection.
 *
 * @param {string}              src         The url of the image.
 * @param {string}              alt         The alt text describing the image.
 */
export function modifyImage(src, alt) {
    const view = activeView()
    let command = modifyImageCommand(src, alt);
    return command(view.state, view.dispatch, view)
};

export function modifyImageCommand(src, alt) {
    const commandAdapter = (state, dispatch, view) => {
        const selection = view.state.selection
        const imageNode = selection.node;
        if (imageNode?.type !== view.state.schema.nodes.image) return false;
        let imagePos;
        view.state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (node === imageNode) {
                imagePos = pos;
                return false;
            }
            return true;
        })
        if (imagePos) {
            const transaction = view.state.tr
                .setNodeAttribute(imagePos, 'src', src)
                .setNodeAttribute(imagePos, 'alt', alt)
            view.dispatch(transaction)
            return true
        } else {
            return false
        }
    }

    return commandAdapter
}

/**
 * Cut the selected image from the document.
 * 
 * Copy before deleting the image is done via a callback, which avoids
 * potential CORS issues. Similarly, copying of an image (e.g., Ctrl-C) is all done 
 * by the side holding the copy buffer, not via JavaScript.
 */
export function cutImage() {
    const view = activeView()
    const selection = view.state.selection
    const imageNode = selection.node;
    if (imageNode?.type === schema.nodes.image) {
        _copyImage(imageNode);
        const transaction = view.state.tr.deleteSelection();
        view.dispatch(transaction);
        stateChanged(view);
    };
};

/**
 * Post a message with src, alt, and dimensions, so the image contents can be put into the clipboard.
 * 
 * @private
 * @param {Node} node   A ProseMirror image node
 */
function _copyImage(node) {
    const messageDict = {
        'messageType' : 'copyImage',
        'src' : node.attrs.src,
        'alt' : node.attrs.alt,
        'dimensions' : {width: node.attrs.width, height: node.attrs.height}
    };
    _callback(JSON.stringify(messageDict));
};

/********************************************************************************
 * Tables
 */
//MARK: Tables

/**
 * Insert an empty table with the specified number of rows and cols.
 *
 * @param   {number}                 rows        The number of rows in the table to be created.
 * @param   {number}                 cols        The number of columns in the table to be created.
 */
export function insertTable(rows, cols) {
    const view = activeView()
    if ((rows < 1) || (cols < 1)) return;
    let command = insertTableCommand(rows, cols);
    let result = command(view.state, view.dispatch, view);
    return result;
};

export function insertTableCommand(rows, cols) {
    const commandAdapter = (viewState, dispatch, view) => {
        let state = view?.state ?? viewState;
        const nodeTypes = state.schema.nodes;
        const table_rows = []
        for (let j = 0; j < rows; j++) {
            const table_cells = [];
            for (let i = 0; i < cols; i++) {
                const paragraph = state.schema.node('paragraph');
                table_cells.push(nodeTypes.table_cell.create(null, paragraph));
            }
            table_rows.push(nodeTypes.table_row.create(null, table_cells));
        }
        const table = nodeTypes.table.create(null, table_rows);
        if (!table) return false;     // Something went wrong, like we tried to insert it at a disallowed spot
        if (dispatch) {
            // Replace the existing selection and track the transaction
            let transaction = view.state.tr.replaceSelectionWith(table, false);
            // Locate the table we just inserted in the transaction's doc.
            // Note that because pPos can be 0 or 1, we really need to check 
            // explicityly on undefined to terminate nodesBetween traversal.
            let pPos;
            let from = transaction.selection.from;
            let to = transaction.selection.to;
            transaction.doc.nodesBetween(from, to, (node, pos) => {
                if (node === table) {
                    pPos = pos;
                };
                return (pPos == undefined);    // Keep going if pPos hasn't been defined
            });
            // After we replace the selection with the table, you would think that 
            // the transaction.selection.from and to would encompass the table, but 
            // they do not necessarily. IOW if you do transaction.doc.nodesBetween 
            // on from and to, you should find the table, right? Not always, so if 
            // we didn't emerge with pPos defined, just look for the thing across 
            // the entire doc as a backup.
            if (pPos == undefined) {
                transaction.doc.nodesBetween(0, transaction.doc.content.size, (node, pos) => {
                    if (node === table) {
                        pPos = pos;
                    };
                    return (pPos == undefined);    // Keep going if pPos hasn't been defined
                });
            }
            // Set the selection in the first cell, apply it to the state and the view.
            // We have to special-case for empty documents to get selection in the 1st cell.
            let empty = (view.state.doc.textContent.length == 0)
            let textSelection;
            if (empty) {
                textSelection = TextSelection.near(transaction.doc.resolve(pPos), -1)
            } else {
                textSelection = TextSelection.near(transaction.doc.resolve(pPos))
            }
            transaction = transaction.setSelection(textSelection);
            state = state.apply(transaction);
            view.updateState(state);
            view.focus();
            stateChanged(view);
        }
        
        return true;
    };

    return commandAdapter;
}

/**
 * Add a row before or after the current selection, whether it's in the header or body.
 * For rows, AFTER = below; otherwise above.
 *
 * @param {string}  direction   Either 'BEFORE' or 'AFTER' to identify where the new row goes relative to the selection.
 */
export function addRow(direction) {
    const view = activeView()
    if (!_tableSelected()) return;
    let command = addRowCommand(direction);
    let result = command(view.state, view.dispatch, view)
    view.focus();
    stateChanged(view);
    return result;
};

export function addRowCommand(direction) {
    const commandAdapter = (state, dispatch, view) => {
        if (direction === 'BEFORE') {
            return addRowBefore(state, dispatch, view);
        } else {
            return addRowAfter(state, dispatch, view);
        };
    };

    return commandAdapter;
}

/**
 * Add a column before or after the current selection, whether it's in the header or body.
 * 
 * In MarkupEditor, the header is always colspanned fully, so we need to merge the headers if adding 
 * a column in created a new element in the header row.
 *
 * @param {string}  direction   Either 'BEFORE' or 'AFTER' to identify where the new column goes relative to the selection.
 */
export function addCol(direction) {
    const view = activeView()
    if (!_tableSelected()) return;
    let command = addColCommand(direction);
    let result = command(view.state, view.dispatch, view);
    view.focus();
    stateChanged(view);
    return result;
};

export function addColCommand(direction) {
    const commandAdapter = (viewState, dispatch, view) => {
        let state = view?.state ?? viewState;
        if (!isTableSelected(state)) return false;
        const startSelection = new TextSelection(state.selection.$anchor, state.selection.$head)
        let offset = 0;
        if (direction === 'BEFORE') {
            addColumnBefore(state, (tr) => { state = state.apply(tr) });
            offset = 4  // An empty cell
        } else {
            addColumnAfter(state, (tr) => { state = state.apply(tr) });
        };
        _mergeHeaders(state, (tr) => { state = state.apply(tr) });

        if (dispatch) {
            const $anchor = state.tr.doc.resolve(startSelection.from + offset);
            const $head = state.tr.doc.resolve(startSelection.to + offset);
            const selection = new TextSelection($anchor, $head);
            const transaction = state.tr.setSelection(selection);
            state = state.apply(transaction);
            view.updateState(state);
        }

        return true;
    };

    return commandAdapter;
}

/**
 * Add a header to the table at the selection.
 *
 * @param {boolean} colspan     Whether the header should span all columns of the table or not.
 */
export function addHeader(colspan=true) {
    const view = activeView()
    let tableAttributes = _getTableAttributes();
    if (!tableAttributes.table || tableAttributes.header) return;   // We're not in a table or we are but it has a header already
    let command = addHeaderCommand(colspan);
    let result = command(view.state, view.dispatch, view);
    view.focus();
    stateChanged(view);
    return result;
};

export function addHeaderCommand(colspan = true) {
    const commandAdapter = (viewState, dispatch, view) => {
        let state = view?.state ?? viewState;
        if (!isTableSelected(state)) return false;
        const nodeTypes = state.schema.nodes
        const startSelection = new TextSelection(state.selection.$anchor, state.selection.$head)
        _selectInFirstCell(state, (tr) => { state = state.apply(tr) });
        addRowBefore(state, (tr) => { state = state.apply(tr) });
        _selectInFirstCell(state, (tr) => { state = state.apply(tr) });
        toggleHeaderRow(state, (tr) => { state = state.apply(tr) });
        if (colspan) {
            _mergeHeaders(state, (tr) => { state = state.apply(tr) });
        };

        if (dispatch) {
            // At this point, the state.selection is in the new header row we just added. By definition, 
            // the header is placed before the original selection, so we can add its size to the 
            // selection to restore the selection to where it was before.
            let tableAttributes = _getTableAttributes(state);
            let headerSize;
            state.tr.doc.nodesBetween(tableAttributes.from, tableAttributes.to, (node) => {
                if (!headerSize && (node.type == nodeTypes.table_row)) {
                    headerSize = node.nodeSize;
                    return false;
                }
                return (node.type == nodeTypes.table);  // We only want to recurse over table
            })
            const $anchor = state.tr.doc.resolve(startSelection.from + headerSize);
            const $head = state.tr.doc.resolve(startSelection.to + headerSize);
            const selection = new TextSelection($anchor, $head);
            const transaction = state.tr.setSelection(selection);
            state = state.apply(transaction);
            view.updateState(state);
        }

        return true;
    };

    return commandAdapter;
}

/**
 * Delete the area at the table selection, either the row, col, or the entire table.
 * @param {'ROW' | 'COL' | 'TABLE'} area The area of the table to be deleted.
 */
export function deleteTableArea(area) {
    if (!_tableSelected()) return;
    const view = activeView()
    let command = deleteTableAreaCommand(area);
    let result = command(view.state, view.dispatch, view);
    view.focus();
    stateChanged(view);
    return result;
};

export function deleteTableAreaCommand(area) {
    const commandAdapter = (state, dispatch, view) => {
        switch (area) {
            case 'ROW':
                return deleteRow(state, dispatch, view);
            case 'COL':
                return deleteColumn(state, dispatch, view);
            case 'TABLE':
                return deleteTable(state, dispatch, view);
        };
        return false;
    };

    return commandAdapter;
}

/**
 * Set the class of the table to style it using CSS.
 * The default draws a border around everything.
 * 
 * @param {'outer' | 'header' | 'cell' | 'none'} border Set the class of the table to correspond to caller's notion of border, so it displays properly.
 */
export function borderTable(border) {
    if (_tableSelected()) {
        const view = activeView()
        let command = setBorderCommand(border);
        let result = command(view.state, view.dispatch, view);
        stateChanged(view);
        view.focus();
        return result;
    }
};

/**
 * Return whether the selection is within a table.
 * 
 * @private
 * @returns {boolean} True if the selection is within a table
 */
function _tableSelected() {
    return _getTableAttributes().table;
};

function _selectInFirstCell(state, dispatch) {
    const tableAttributes = _getTableAttributes(state);
    if (!tableAttributes.table) return;
    const nodeTypes = state.schema.nodes; 
    // Find the position of the first paragraph in the table
    let pPos;
    state.doc.nodesBetween(tableAttributes.from, tableAttributes.to, (node, pos) => {
        if ((!pPos) && (node.type === nodeTypes.paragraph)) {
            pPos = pos;
            return false;
        }
        return true;
    });
    if (!pPos) return;
    // Set the selection in the first paragraph in the first cell
    const $pos = state.doc.resolve(pPos);
    // When the first cell is an empty colspanned header, the $pos resolves to a table_cell,
    // so we need to use NodeSelection in that case.
    let selection = TextSelection.between($pos, $pos);
    const transaction = state.tr.setSelection(selection);
    state.apply(transaction);
    if (dispatch) {
        dispatch(transaction);
    }
};

/**
 * Merge any extra headers created after inserting a column or adding a header.
 * 
 * When inserting at the left or right column of a table, the addColumnBefore and 
 * addColumnAfter also insert a new cell/td within the header row. Since in 
 * the MarkupEditor, the row is always colspanned across all columns, we need to 
 * merge the cells together when this happens. The operations that insert internal 
 * columns don't cause the header row to have a new cell.
 * 
 * @private
 */
function _mergeHeaders(state, dispatch) {
    const nodeTypes = state.schema.nodes;
    const headers = [];
    let tableAttributes = _getTableAttributes(state);
    state.tr.doc.nodesBetween(tableAttributes.from, tableAttributes.to, (node, pos) => {
        if (node.type == nodeTypes.table_header) {
            headers.push(pos)
            return false;
        }
        return true;
    });
    if (headers.length > 1) {
        const firstHeaderPos = headers[0];
        const lastHeaderPos = headers[headers.length - 1];
        const rowSelection = CellSelection.create(state.tr.doc, firstHeaderPos, lastHeaderPos);
        const transaction = state.tr.setSelection(rowSelection);
        const newState = state.apply(transaction);
        mergeCells(newState, dispatch)
    };
};

export function isTableSelected(state) {
    let tableSelected = false;
    state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
        if (node.type === state.schema.nodes.table) {
            tableSelected = true;
            return false;
        };
        return false;
    });
    return tableSelected
}

export function tableHasHeader(state) {
    if (!isTableSelected) return false
    return _getTableAttributes(state).header === true
}

export function setBorderCommand(border) {
    const commandAdapter = (viewState, dispatch, view) => {
        let state = view?.state ?? viewState;
        const selection = state.selection;
        let table, fromPos, toPos;
        state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (node.type === state.schema.nodes.table) {
                table = node;
                fromPos = pos;
                toPos = pos + node.nodeSize;
                return false;
            };
            return false;
        });
        if (!table) return false;
        if (dispatch) {
            switch (border) {
                case 'outer':
                    table.attrs.class = 'bordered-table-outer';
                    break;
                case 'header':
                    table.attrs.class = 'bordered-table-header';
                    break;
                case 'cell':
                    table.attrs.class = 'bordered-table-cell';
                    break;
                case 'none':
                    table.attrs.class = 'bordered-table-none';
                    break;
                default:
                    table.attrs.class = 'bordered-table-cell';
                    break;
            };
            // At this point, the state.selection is in the new header row we just added. By definition, 
            // the header is placed before the original selection, so we can add its size to the 
            // selection to restore the selection to where it was before.
             const transaction = view.state.tr
                .setMeta("bordered-table", {border: border, fromPos: fromPos, toPos: toPos})
                .setNodeMarkup(fromPos, table.type, table.attrs)
            view.dispatch(transaction);
        }

        return true;
    };

    return commandAdapter;
}

/**
 * Get the border around and within the cell.
 * 
 * @private
 * @returns {'outer' | 'header' | 'cell' | 'none'} The type of table border known on the view holder's side.
 */
function _getBorder(table) {
    let border;
    switch (table.attrs.class) {
        case 'bordered-table-outer':
            border = 'outer';
            break;
        case 'bordered-table-header':
            border = 'header';
            break;
        case 'bordered-table-cell':
            border = 'cell';
            break;
        case 'bordered-table-none':
            border = 'none';
            break;
        default:
            border = 'cell';
            break;
    };
    return border;
};

/**
 * Return the first node starting at depth 0 (the top) that is of type `type`.
 * 
 * @private
 * @param {NodeType}    type The NodeType we are looking for that contains $pos.
 * @param {ResolvedPos} $pos A resolved position within a document node.
 * @returns {Node | null}
 */
export function outermostOfTypeAt(type, $pos) {
    const depth = $pos.depth;
    for (let i = 0; i < depth; i++) {
      if ($pos.node(i).type == type) return $pos.node(i);
    };
    return null;
}

/********************************************************************************
 * Common private functions
 */
//MARK: Common Private Functions

/**
 * Return a ProseMirror Node derived from HTML text.
 * 
 * Since the schema for the MarkupEditor accepts div and buttons, clean them from the 
 * html before deriving a Node. Cleaning up means retaining the div contents while removing
 * the divs, and removing buttons.
 * 
 * @private
 * @param {string} html 
 * @returns {Node}
 */
function _nodeFromHTML(html) {
    const fragment = _fragmentFromHTML(html);
    const body = fragment.body ?? fragment;
    _cleanUpDivsWithin(body);
    _cleanUpTypesWithin(['button'], body);
    return _nodeFromElement(body);
};

/**
 * Return a ProseMirror Node derived from an HTMLElement.
 * 
 * @private
 * @param {HTMLElement} htmlElement 
 * @returns {Node}
 */
function _nodeFromElement(htmlElement) {
    return DOMParser.fromSchema(schema).parse(htmlElement, { preserveWhiteSpace: true });
}

/**
 * Return an HTML DocumentFragment derived from a ProseMirror node.
 * 
 * @private
 * @param {Node} node 
 * @returns {DocumentFragment}
 */
export function fragmentFromNode(node) {
    return DOMSerializer.fromSchema(schema).serializeFragment(node.content);
};

/**
 * Return the innerHTML string contained in a DocumentFragment.
 * 
 * @private
 * @param {DocumentFragment} fragment 
 * @returns {string}
 */
export function htmlFromFragment(fragment) {
    const div = document.createElement('div');
    div.appendChild(fragment);
    return div.innerHTML;
};

/**
 * Return an HTML DocumentFragment derived from HTML text.
 * 
 * @private
 * @param {string} html 
 * @returns {DocumentFragment}
 */
function _fragmentFromHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
};

/**
 * Return a ProseMirror Slice derived from HTML text.
 * 
 * @private
 * @param {string} html 
 * @returns {Slice}
 */
function _sliceFromHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html ?? "";
    return _sliceFromElement(div);
};

/**
 * Return a ProseMirror Slice derived from an HTMLElement.
 * 
 * @private
 * @param {HTMLElement} htmlElement 
 * @returns {Slice}
 */
function _sliceFromElement(htmlElement) {
    return DOMParser.fromSchema(schema).parseSlice(htmlElement, { preserveWhiteSpace: true });
}

/**
 * Return whether node is a textNode or not
 * 
 * @private
 */
function _isTextNode(node) {
    return node && (node.nodeType === Node.TEXT_NODE);
};

/**
 * Return whether node is an ELEMENT_NODE or not
 * 
 * @private
 */
function _isElementNode(node) {
    return node && (node.nodeType === Node.ELEMENT_NODE);
};

/**
 * Return whether node is a format element; i.e., its nodeName is in _formatTags
 * 
 * @private
 */
function _isFormatElement(node) {
    return _isElementNode(node) && _formatTags.includes(node.nodeName);
};

/**
 * Return whether node has a void tag (i.e., does not need a terminator)
 * 
 * @private
 */
function _isVoidNode(node) {
    return node && (_voidTags.includes(node.nodeName));
};

/**
 * Return whether node is a link
 * 
 * @private
 */
function _isLinkNode(node) {
    return node && (node.nodeName === 'A');
};

/**
 * Callback to show a string in the console, like console.log(), but for environments like Xcode.
 * 
 * @param {string}  string  The string to package up as a console log message in a callback
 */
export function consoleLog(string) {
    let messageDict = {
        'messageType' : 'log',
        'log' : string
    }
    _callback(JSON.stringify(messageDict));
};
