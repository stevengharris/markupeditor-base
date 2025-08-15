class DemoDelegate {

    markupReady() {
        demoToolbar.hideRaw()
    }

    markupInput() {
        demoToolbar.updateRaw()
    }

    /** Other messages the delegate could receive and act on... */
    /*

    markupInsertLink(state, dispatch, view) {
        console.log("Insert the link using your own dialog")
    }

    markupInsertImage(state, dispatch, view) {
        console.log("Insert the image using your own dialog")
    }

    markupUpdateHeight(height, editor) {
        console.log('DemoDelegate received updateHeight')
    }

    markupSelectionChanged(editor) {
        console.log('DemoDelegate received selectionChanged')
    }

    markupClicked(editor) {
        console.log('DemoDelegate received clicked')
    }

    markupSearched(editor) {
        console.log('DemoDelegate received searched')
    }

    markupImageAdded(editor, src, divId) {
        console.log('DemoDelegate received markupImageAdded')
    }
    */

}