/* global test, expect, beforeAll */
const MU = require('../dist/markupeditor.umd.js')
const HtmlTest = require('./htmltest.js').HtmlTest;
let htmlTests = HtmlTest.fromData('test/baseline.json')

beforeAll(() => {

    // When testing using JSDOM, we see 
    //      TypeError: target.getClientRects is not a function
    // when using MU.getSelectionState, because the selection state 
    // includes the selection rectangle.
    // The following workaround is per https://github.com/jsdom/jsdom/issues/3729
    document.elementFromPoint = () => null;
    HTMLElement.prototype.getBoundingClientRect = getBoundingClientRect;
    HTMLElement.prototype.getClientRects = () => new FakeDOMRectList();
    Range.prototype.getBoundingClientRect = getBoundingClientRect;
    Range.prototype.getClientRects = () => new FakeDOMRectList();

    document.body.innerHTML = `<!DOCTYPE html><html><body><div id="editor"></div></body></html>`
    new MU.MarkupEditor(document.querySelector('#editor'))
});

test.each(htmlTests)(
    '$description', (htmlTest) => {
        MU.setTestHTML(htmlTest.startHtml, '|')
        let html = MU.getTestHTML('|')
        expect(html).toBe(htmlTest.startHtml)
        let stateJSON = MU.getSelectionState()
        let state = JSON.parse(stateJSON)
        expect(state).not.toBeNull()
})

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
