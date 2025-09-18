const fs = require('node:fs')
const path = require('path')

class HtmlTest {

    constructor(description, startHtml, endHtml, undoHtml, pasteString) {
        this.description = description
        this.startHtml = startHtml
        this.endHtml = endHtml ?? startHtml
        this.undoHtml = undoHtml ?? startHtml
        this.pasteString = pasteString
    }

    static fromData(filename) {
        let fullFilename = path.join(process.cwd(), filename)
        let htmlTests = []
        try {
            let data = fs.readFileSync(fullFilename, 'utf8')
            let tests = JSON.parse(data)
            for (let test of tests) {
                let { description, startHtml, endHtml, undoHtml, pasteString } = test
                let htmlTest = new HtmlTest(description, startHtml, endHtml, undoHtml, pasteString)
                htmlTests.push(htmlTest)
            }
        } catch (error) {
            console.log('Error reading test data:', error)
        }
        return htmlTests
    }
    
}

exports.HtmlTest = HtmlTest
