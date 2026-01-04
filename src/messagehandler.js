import { getHeight, setHTML } from "./markup.js";

/**
 * The MessageHandler receives `postMessage` from the MarkupEditor as the document state changes.
 * 
 * You can set the MessageHandler used by the MarkupEditor using `MU.setMessageHandler`. This is how 
 * the MarkupEditor is embedded in Swift and VSCode. If you don't set your own MessageHandler, then 
 * this is the default version that will be used. These other MessageHandlers will typically use the 
 * same MarkupDelegate pattern to route document state notifications to an app-specific delegate.
 * 
 * Although the default MessageHandler does some important work, like loading content when the view 
 * is ready, its primary job is to let your MarkupDelegate know of state changes in the document. 
 * This is so that your app that uses the MarkupEditor can take action if needed.
 * 
 * Note that delegate can be undefined, and any of `markup` methods invoked in it may also be 
 * undefined. This way, you only need to implement delegate methods that are useful in your app.
 * For example, if you want to track if any changes have occurred in the document, you would want 
 * to implement `markupInput` so you know some input/change has occurred. You could then do a kind 
 * of auto-save method within your app, for example.
 */
export class MessageHandler {

    static swift = window.webkit?.messageHandlers?.markup

    constructor(editor) {
        this.editor = editor
    }

    /**
     * Take action when messages we care about come in.
     * @param {string | JSON} message   The message passed from the MarkupEditor as the state changes. 
     */
    postMessage(message) {
        let config = this.editor.config
        let delegate = config.delegate
        if (message.startsWith('input')) {
            // Some input or change happened in the document, so let the delegate know immediately 
            // if it exists, and return. Input happens with every keystroke and editing operation, 
            // so generally delegate should be doing very little, except perhaps noting that the 
            // document has changed. However, what your delegate does is very application-specific.
            delegate?.markupInput && delegate?.markupInput(this.editor)
            return
        }
        switch (message) {
            // The editor posts `loadedUserFiles` when the markup-editor.js script and `userscript` 
            // (if any) are loaded, so we can set the HTML. After loading the contents into the 
            // editor, we let the `delegate`, if specified, know we are ready for editing.
            case 'loadedUserFiles':
                this.loadContents()
                delegate?.markupReady && delegate?.markupReady()
                return
            case 'focus':
                delegate?.markupDidFocus && delegate?.markupDidFocus()
                return
            case 'blur':
                delegate?.markupDidFocus && delegate?.markupDidBlur()
                return
            case "updateHeight":
                delegate?.markupUpdateHeight && delegate?.markupUpdateHeight(getHeight())
                return
            case "selectionChanged":
                delegate?.markupSelectionChanged && delegate?.markupSelectionChanged()
                return
            case "clicked":
                delegate?.markupClicked && delegate?.markupClicked()
                return
            case "searched":
                delegate?.markupSearched && delegate?.markupSearched()
                return
            default:
                // By default, try to process the message as a JSON object, and if it's not parseable, 
                // then log to the console so we know about it during development. Between the `postMessage` 
                // method and its companion `receivedMessageData`, every message received from the 
                // MarkupEditor should be handled, with no exceptions. Otherwise, something is going 
                // on over in the web view that we are ignoring, and while we might want to ignore it, 
                // we don't want anything to slip thru the cracks here.
                try {
                    const messageData = JSON.parse(message)
                    this.receivedMessageData(messageData)
                } catch {
                    console.log("Unhandled message: " + message)
                }
        }
    }

    /**
     * Examine the `messageData.messageType` and take appropriate action with the other 
     * data that is supplied in the `messageData`.
     * 
     * @param {Object} messageData The object obtained by parsing the JSON of a message.
     */
    receivedMessageData(messageData) {
        let config = this.editor.config
        let delegate = config.delegate
        let messageType = messageData.messageType
        switch (messageType) {
            case "log":
                console.log(messageData.log)
                return
            case "error": {
                let code = messageData.code
                let message = messageData.message
                if (!code || !message) {
                    console.log("Bad error message.")
                    return
                }
                let info = messageData.info
                let alert = messageData.alert ?? true
                delegate?.markupError && delegate?.markupError(code, message, info, alert)
                return
            }
            case "copyImage":
                console.log("fix copyImage " + messageData.src)
                return
            case "addedImage": {
                if (!delegate?.markupImageAdded) return;
                let divId = messageData.divId
                // Even if divid is identified, if it's empty or the editor element, then
                // use the old call without divid to maintain compatibility with earlier versions
                // that did not support multi-contenteditable divs.
                if ((divId.length == 0) || (divId == "editor")) {
                    delegate.markupImageAdded(messageData.src)
                } else if (!divId.length == 0) {
                    delegate.markupImageAdded(messageData.src, divId)
                } else {
                    console.log("Error: The div id for the image could not be decoded.")
                }
                return
            }
            case "deletedImage":
                console.log("fix deletedImage " + messageData.src)
                return
            case "buttonClicked":
                console.log("fix deletedImage " + messageData.src)
                return
            default:
                console.log(`Unknown message of type ${messageType}: ${messageData}.`)
        }
    }

    /** Load the contents from `filename`, or if not specified, from `html` */
    loadContents() {
        let config = this.editor.config
        let filename = config.filename
        let base = config.base
        let focusAfterLoad = config.behavior.focusAfterLoad
        if (filename) {
            fetch(filename)
                .then((response) => response.text())
                .then((text) => {
                    // A fetch failure returns 'Cannot GET <filename with path>'
                    setHTML(text, focusAfterLoad, base)
                })
                .catch(() => {
                    // But just in case, report a failure if needed.
                    setHTML(`<p>Failed to load ${filename}.</p>`, focusAfterLoad)
                })
        } else {
            let html = config.html ?? '<p></p>'
            setHTML(html, focusAfterLoad, base, this.editor.view)
        }
    }
}