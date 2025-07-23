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
          let message = { type: 'getHTML', filename: filename }
          this.postToServer(message, (html) => { MU.setHTML(html), true })
        } else {
          MU.setHTML(markupEditor.html, true)
        }
    }
  }
}

postToServer(message, handler) {
    let json;
    if (message.type) {
      json = JSON.stringify(message)
    } else {
      json = JSON.stringify({type: message})
    }
    fetch("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: json,
    })
    .then((response) => response.text())
    .then((text) => {
      handler(text);
    })
  }
}