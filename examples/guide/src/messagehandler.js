import * as fs from 'fs';

/**
 * The instance that will receive `postMessage` from the MarkupEditor as the document state changes.
 */
export class MessageHandler {

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
        let file = markupEditor.file
        let html
        if (file && fs) {
          fs.readFile(file, 'utf8', (err, data) => {
            if (err) {
              html = 'Error reading file ' + file + ': ' + err
            } else {
              html = data
            }
            MU.setHTML(html, true)
          })
        } else {
          MU.setHTML(markupEditor.html, true)
        }
        return;
      }
    }
  }
}
