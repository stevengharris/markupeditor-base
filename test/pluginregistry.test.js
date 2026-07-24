import { describe, test, beforeAll } from 'vitest'
import { setDocument, HtmlTestSuite, runHtmlTest } from './setup.js'

/**
 * Set up the document and MarkupEditor instance once. Precede with a
 * workaround for using JSDom and accessing the client rect.
 */
beforeAll(setDocument)

// Synchronous registry tests driven from JSON so they can also be run
// as SwiftTest equivalents in MarkupEditor.
let suite = new HtmlTestSuite('./test/pluginregistry.json')
describe(suite.description, () => {
    test.each(suite.htmlTests)('$description', runHtmlTest)
})
