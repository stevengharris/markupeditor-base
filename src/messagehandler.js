import { setHTML } from "./markup";

/**
 * The instance that will receive `postMessage` from the MarkupEditor as the document state changes.
 */
export class MessageHandler {
  constructor(markupEditor) {
    this.markupEditor = markupEditor;
  }

  /**
   * Take action when messages we care about come in.
   * @param {string | JSON} message   The message passed from the MarkupEditor as the state changes. 
   */
  postMessage(message) {
    let config = this.markupEditor.config;
    let delegate = config.delegate
    switch (message) {
      case (message.startsWith('input')): {
        // Some input or change happened in the document, so let the delegate know immediately 
        // if it exists, and return. Input happens with every keystroke and editing operation, 
        // so generally delegate should be doing very little, except perhaps noting that the 
        // document has changed. However, what your delegate does is very application-specific.
        delegate?.markupInput(message)
        return
      }
      // The editor posts `ready` when all scripts are loaded, so we can set the HTML. If HTML
      // is an empty document, then the config.placeholder will be shown.
      case 'ready': {
        setHTML(config.html, config.focusAfterLoad ?? true)
        delegate?.markupReady(this.markupEditor)
        return
      }
    }
  }
}