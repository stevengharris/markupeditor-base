/* eslint-disable */

/**
 * A class you define and register with the MarkupEditor, whose methods the MessageHandler
 * invokes if the delegate exists and the method exists. The MarkupDelegate is not part of 
 * the MarkupEditor web component. You would typically implement a MarkupDelegate (could be 
 * any name) and register it in a `userscript`.
 * 
 * This class is part of the MarkupEditor API documentation because without using TypeScript, 
 * there isn't a proper way to declare an interface.
 */
class MarkupDelegate {

    constructor() {}
    
    /**
     * A click event was received in the editor.
     */
    markupClicked() {}

    /**
     * A focus event was received in the editor.
     */
    markupDidFocus() {}

    /**
     * A blur event was received in the editor.
     */
    markupDidBlur() {}

    /**
     * An error occurred.
     * @param {string} code     A MarkupEditor error code.
     * @param {string} message  The error message.
     * @param {string} info     Additional information about the error.
     * @param {boolean} alert   True if the user should be alerted; false if not.
     */
    markupError(code, message, info, alert) {}

    /**
     * The editor is ready to be used. Scripts and styling have loaded and `MU` is available.
     */
    markupReady() {}
    
    /**
     * An image was loaded in the editor. The same image may be present at multiple locations, but
     * `markupImageAdded` will only be called once. The callback is useful when you are need to 
     * deal with local image insertion at the time it happens in your application environment, 
     * for example in response to someone pasting an image in.
     * 
     * @param {string} src      The img src attribute.
     * @param {string} divId    The DIV that the image is in, typically 'editor'.
     */
    markupImageAdded(src, divId) {}

    /**
     * The editor received input of some kind, so the contents changed. This could be because of typing 
     * or image resizing, or pasting, or formatting, etc.
     */
    markupInput() {}
    
    /**
     * Invoked when the "Insert Image" button is pressed in the toolbar. 
     * The default behavior is `ImageItem.openDialog` in `src/setup/menuitems.js`.
     * 
     * @param {EditorState} state 
     * @param {Function(Transaction)} dispatch 
     * @param {EditorView} view 
     */
    markupInsertImage(state, dispatch, view) {}

    /**
     * Invoked when the "Insert Link" button is pressed in the toolbar. 
     * The default behavior is `LinkItem.openDialog` in `src/setup/menuitems.js`.
     * 
     * @param {EditorState} state 
     * @param {Function(Transaction)} dispatch 
     * @param {EditorView} view 
     */
    markupInsertLink(state, dispatch, view) {}
    
    /**
     * Search was invoked in the editor.
     */
    markupSearched() {}
    
    /**
     * The selection in the editor changed.
     */
    markupSelectionChanged() {}

    /**
     * Invoked when the "Select..." button is pressed in the standard "Insert Image" dialog.
     * There is no default behavior. Instead, the "Select..." button is not shown by default.
     * 
     * @param {EditorState} state 
     * @param {Function(Transaction)} dispatch 
     * @param {EditorView} view 
     */
    markupSelectImage(state, dispatch, view) {}
    
    /**
     * The height of the editor changed to `height`.
     * 
     * @param {number} height 
     */
    markupUpdateHeight(height) {}

}
