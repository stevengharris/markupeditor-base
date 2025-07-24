/**
 * The instance that will receive `postMessage` from the MarkupEditor as the document state changes.
 */
class MessageHandler {

    /**
     * Take action when messages we care about come in.
     * @param {string | JSON} message   The message passed from the MarkupEditor as the state changes. 
     */
    postMessage(message) {
        if (message.startsWith('input')) {
            // Some input or change happened in the document, so update the raw HTML in the `htmldiv`.
            // Generally, it will be too heavyweight for a real app to pull back the full HTML contents
            // at every keystroke (or do much of anything), but it works nicely in the demo to show changes.
            fileToolbar.updateRaw()
            return;
        }
        switch (message) {
            // The editor posts `ready` when all scripts are loaded, so we can set the HTML.
            case 'ready': {
                fileToolbar.hideRaw()
                let filename = markupEditor.config.filename;
                if (filename) {
                    fetch(filename)
                    .then((response) => response.text())
                    .then((text) => {
                        MU.setHTML(text, true)
                    })
                }
                return
            }
        }
    }
}