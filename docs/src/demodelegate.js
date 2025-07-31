class DemoDelegate {

    markupReady() {
        demoToolbar.hideRaw()
    }

    markupInput() {
        demoToolbar.updateRaw()
    }

    /** Other messages the delegate could receive and act on... */
    /*
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