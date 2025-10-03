/* global expect */
const MU = require('../dist/markupeditor.umd.js')
const HtmlTestSuite = require('./htmltest.js').HtmlTestSuite

async function setDocument() {

    // When testing using JSDOM, we see 
    //      TypeError: target.getClientRects is not a function
    // when using MU.getSelectionState, because the selection state 
    // includes the selection rectangle. We use getSelectionState frequently
    // during testing, so this is a problem, although having an accurate 
    // client rect is not tested-for.
    // The following workaround is per https://github.com/jsdom/jsdom/issues/3729
    document.elementFromPoint = () => null;
    HTMLElement.prototype.getBoundingClientRect = getBoundingClientRect;
    HTMLElement.prototype.getClientRects = () => new FakeDOMRectList();
    Range.prototype.getBoundingClientRect = getBoundingClientRect;
    Range.prototype.getClientRects = () => new FakeDOMRectList();

    document.body.innerHTML = `<!DOCTYPE html><html><body><div id="editor"></div></body></html>`
    new MU.MarkupEditor(document.querySelector('#editor'))
}

// See comments in beforeAll()
function getBoundingClientRect() {
    const rec = {
        x: 0,
        y: 0,
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
    };
    return { ...rec, toJSON: () => rec };
}

// See comments in beforeAll()
class FakeDOMRectList extends Array {
    item(index) {
        return this[index];
    }
}

function runHtmlTest(htmlTest) {
    let { skipTest, skipSet, skipUndoRedo, sel, startHtml, endHtml, undoHtml, pasteString, action, arg } = htmlTest
    // For some reason, there is no Jest facility to skip tests within .each, 
    // so we modify the titles for tests marked `skip` and show success.
    if (skipTest) return
    sel = sel ?? '|'    // Set in the json for non-default or to see it next to the HTML if you prefer
    // For some tests (e.g., testing paste preprocessing), we want to skip setting/verifying the HTML
    if (!skipSet) {
        MU.setTestHTML(startHtml, sel)
        let html = MU.getTestHTML(sel)
        expect(html).toBe(startHtml)
    }
    // Note that some test suites (namely "baseline") have no action.
    // In this case, we just bypass executing an action and check 
    // that endHtml is as expected, and then return.
    // However, the normal case is that there is some action to be 
    // executed. In this case, we pass MU to the function defined 
    // in the HtmlTest.action, and if it produces the expected endHtml, 
    // then we undo and redo, checking those work properly as well.
    // We can skip doing undo/redo if we want (e.g., for search)
    if (action) {
        if (arg) {
            let f = new Function("MU", arg, action)
            let argValue
            switch (arg) {
                case "startHtml":
                    argValue = startHtml
                    break
                case "pasteString":
                    argValue = pasteString
                    break
            }
            // In some cases, the function returns the HTML, but in others, 
            // we have to `getTestHTML` to determine the result.
            let result = f(MU, argValue)
            if (result) {
                expect(result).toBe(endHtml)
            } else {
                let html = MU.getTestHTML(sel)
                expect(html).toBe(endHtml)
            }
        } else {
            let f = new Function("MU", action)
            f(MU)
            let result = MU.getTestHTML(sel)
            expect(result).toBe(endHtml)
        }
    }
    // If we dwfined an action and we're not explicitly skipping it, then
    // execute undo/redo and make sure they're working properly.
    if (action && !skipUndoRedo) {
        MU.doUndo()
        let undoResult = MU.getTestHTML(sel)
        expect(undoResult).toBe(undoHtml)
        MU.doRedo()
        let redoResult = MU.getTestHTML(sel)
        expect(redoResult).toBe(endHtml)
    }
}

exports.setDocument = setDocument
exports.MU = MU
exports.HtmlTestSuite = HtmlTestSuite
exports.runHtmlTest = runHtmlTest