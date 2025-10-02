const fs = require('node:fs')
const path = require('path')

class HtmlTest {

    constructor(description, skipTest, skipSet, skipUndoRedo, sel, startHtml, endHtml, undoHtml, pasteString, action, arg) {
        this.description = description              // What we are testing
        this.skipTest = skipTest                    // Whether we skip the test
        this.skipSet = skipSet ?? false             // Whether we skip setting HTML from startHtml
        this.skipUndoRedo = skipUndoRedo ?? false   // Whether we skip the undo/redo on the action
        this.sel = sel                              // String indication selection point(s), default is |
        this.startHtml = startHtml                  // HTML to load into the document to start
        this.endHtml = endHtml ?? startHtml         // HTML we expect to see after performing the action
        this.undoHtml = undoHtml ?? startHtml       // HTML we expect to see after undoing the action
        this.pasteString = pasteString              // String we paste at the selection, sometimes overloaded in test
        this.action = action                        // String used with JavaScript Function method to create the function we execute
        this.arg = arg                              // String for the (one) argument passed in the action
    }

    static fromData(filename) {
        let fullFilename = path.join(process.cwd(), filename)
        let htmlTests = []
        try {
            let data = fs.readFileSync(fullFilename, 'utf8')
            let tests = JSON.parse(data)
            for (let test of tests) {
                let { description, skipTest, skipSet, skipUndoRedo, sel, startHtml, endHtml, undoHtml, pasteString, action, arg } = test
                // Use ANSI escape codes to show "SKIPPED..." in red, reset after
                if (skipTest) description = '\x1b[0m\x1b[31mSKIPPED... \x1b[0m' + description
                let htmlTest = new HtmlTest(description, skipTest, skipSet, skipUndoRedo, sel, startHtml, endHtml, undoHtml, pasteString, action, arg)
                htmlTests.push(htmlTest)
            }
        } catch (error) {
            console.log('Error reading test data:', error)
        }
        return htmlTests
    }
    
}

exports.HtmlTest = HtmlTest
