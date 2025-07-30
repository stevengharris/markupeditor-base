class MarkupDelegate {

    markupReady(markupEditor) {
        let filename = markupEditor.config.filename;
        let focusAfterLoad = markupEditor.config.focusAfterLoad;
        if (filename) {
            fetch(filename)
                .then((response) => response.text())
                .then((text) => {
                    // Note that a fetch failure will typically return a 'Cannot GET <filename with path>'
                    MU.setHTML(text, focusAfterLoad)
                })
                .catch(error => {
                    // But just in case, report a failure if needed.
                    MU.setHTML(`<p>Failed to load ${filename}.</p>`, focusAfterLoad)
                });
        }
    }
    
}