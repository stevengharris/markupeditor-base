class DemoDelegate {

    markupReady(markupEditor) {
        demoToolbar.hideRaw()
        let filename = markupEditor.config.filename;
        if (filename) {
            fetch(filename)
                .then((response) => response.text())
                .then((text) => {
                    MU.setHTML(text, true)
                })
                .catch(error => {
                    MU.setHTML(
                        `<p>
                            Failed to load ${filename}. 
                            You may be using the MarkupEditor in a browser but trying to load HTML from a local file.
                            You can still select a file to open from the <em>File toolbar</em>.
                        </p>`
                    )
                });
        }
    }

    markupInput() {
        demoToolbar.updateRaw()
    }
}