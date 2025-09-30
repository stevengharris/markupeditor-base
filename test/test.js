/* global describe, test, expect, beforeAll */
const MU = require('../dist/markupeditor.umd.js')
const HtmlTest = require('./htmltest.js').HtmlTest;
let suites = [
    {description: 'Ensure baseline behavior works as expected.', filename: 'baseline.json'},
    {description: 'Simple toggle-on of formatting.', filename: 'format-on.json'},
    {description: 'Simple toggle-off of formatting.', filename: 'format-off.json'},
    {description: 'Formatting of selections across nested formats.', filename: 'format-multi.json'},
    {description: 'Selection state is proper for format selections.', filename: 'format-selection.json'},
    {description: 'Replace existing styles with new ones.', filename: 'style.json'},
    {description: 'Style change  with selections spanning multiple elements.', filename: 'style-multi.json'},
    {description: 'Increasing and decreasing block levels.', filename: 'denting.json'},
    {description: 'Indent/outdent with selections spanning multiple elements.', filename: 'denting-multi.json'},
    {description: 'List operations, changing types, outdenting.', filename: 'list.json'},
    {description: 'List operations with selections spanning multiple elements.', filename: 'list-multi.json'},
    {description: 'Enter at collapsed selection in a list.', filename: 'listenter-collapsed.json'},
    {description: 'Enter at range selection in a list.', filename: 'listenter-range.json'},
    {description: 'Insert a table at various locations.', filename: 'table-insert.json'}
]

/**
 * Set up the document and MarkupEditor instance once. Precede with a 
 * workaround for using JSDom and accessing the client rect.
 */
beforeAll(async () => {

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
})

for (let suite of suites) {
    describe(suite.description, () => {
        // Note that `fromData` inserts a "SKIPPED... " notation at the front of the 
        // description for each test that has `skip` set in its JSON.
        let htmlTests = HtmlTest.fromData('test/'+ suite.filename)
        test.each(htmlTests)('$description', (htmlTest) => {
            let { skip, sel, startHtml, endHtml, undoHtml, action } = htmlTest
            // For some reason, there is no Jest facility to skip tests within .each, 
            // so we modify the titles for tests marked `skip` and show success.
            if (skip) return
            sel = sel ?? '|'    // Set in the json for non-default or to see it next to the HTML
            MU.setTestHTML(startHtml, sel)
            let html = MU.getTestHTML(sel)
            expect(html).toBe(startHtml)
            // Note that some test suites (namely "baseline") have no action.
            // In this case, we just bypass executing an action and check 
            // that endHtml is as expected, and then return.
            // However, the normal case is that there is some action to be 
            // executed. In this case, we pass MU to the function defined 
            // in the HtmlTest.action, and if it produces the expected endHtml, 
            // then we undo and redo, checking those work properly as well.
            if (htmlTest.action) {
                let f = new Function("MU", action)
                f(MU)
            }
            let result = MU.getTestHTML(sel)
            expect(result).toBe(endHtml)
            if (htmlTest.action) {
                MU.doUndo()
                let undoResult = MU.getTestHTML(sel)
                expect(undoResult).toBe(undoHtml)
                MU.doRedo()
                let redoResult = MU.getTestHTML(sel)
                expect(redoResult).toBe(endHtml)
            }
        })
    })
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
