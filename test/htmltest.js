const fs = require('node:fs')
const path = require('path')

class HtmlTest {

    constructor(description, skip, actionOnly, sel, startHtml, endHtml, undoHtml, pasteString, action, arg) {
        this.description = description
        this.skip = skip                            // Whether we skip the test
        this.actionOnly = actionOnly ?? false       // Whether we only execute the action, not set or undo/redo
        this.sel = sel
        this.startHtml = startHtml
        this.endHtml = endHtml ?? startHtml
        this.undoHtml = undoHtml ?? startHtml
        this.pasteString = pasteString
        this.action = action
        this.arg = arg
    }

    static fromData(filename) {
        let fullFilename = path.join(process.cwd(), filename)
        let htmlTests = []
        try {
            let data = fs.readFileSync(fullFilename, 'utf8')
            let tests = JSON.parse(data)
            for (let test of tests) {
                let { description, skip, actionOnly, sel, startHtml, endHtml, undoHtml, pasteString, action, arg } = test
                // Use ANSI escape codes to show "SKIPPED..." in red, reset after
                if (skip) description = '\x1b[0m\x1b[31mSKIPPED... \x1b[0m' + description
                let htmlTest = new HtmlTest(description, skip, actionOnly, sel, startHtml, endHtml, undoHtml, pasteString, action, arg)
                htmlTests.push(htmlTest)
            }
        } catch (error) {
            console.log('Error reading test data:', error)
        }
        return htmlTests
    }
    
}

exports.HtmlTest = HtmlTest
