const fs = require('node:fs')
const path = require('path')

class HtmlTest {

    constructor(skip, description, sel, startHtml, endHtml, undoHtml, pasteString, action) {
        this.skip = skip
        this.description = description
        this.sel = sel
        this.startHtml = startHtml
        this.endHtml = endHtml ?? startHtml
        this.undoHtml = undoHtml ?? startHtml
        this.pasteString = pasteString
        this.action = action
    }

    static fromData(filename) {
        let fullFilename = path.join(process.cwd(), filename)
        let htmlTests = []
        try {
            let data = fs.readFileSync(fullFilename, 'utf8')
            let tests = JSON.parse(data)
            for (let test of tests) {
                let { skip, description, sel, startHtml, endHtml, undoHtml, pasteString, action } = test
                // Use ANSI escape codes to show "SKIPPED..." in red, reset after
                if (skip) description = '\x1b[0m\x1b[31mSKIPPED... \x1b[0m' + description
                let htmlTest = new HtmlTest(skip, description, sel, startHtml, endHtml, undoHtml, pasteString, action)
                htmlTests.push(htmlTest)
            }
        } catch (error) {
            console.log('Error reading test data:', error)
        }
        return htmlTests
    }
    
}

exports.HtmlTest = HtmlTest
