/* global describe, test, beforeAll */
const {setDocument, HtmlTestSuite, runHtmlTest} = require('./setup.js')

/**
 * Set up the document and MarkupEditor instance once. Precede with a 
 * workaround for using JSDom and accessing the client rect.
 */
beforeAll(setDocument)

// Note that HtmlTestSuite inserts a "SKIPPED... " notation at the front of the 
// description for each test that has `skip` set in its JSON.
let suite = new HtmlTestSuite('./test/format-selection.json')
describe(suite.description, () => {
    test.each(suite.htmlTests)('$description', runHtmlTest)
})