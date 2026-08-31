import { describe, test, beforeAll } from 'vitest'
import { setDocument, HtmlTestSuite, runHtmlTest } from './setup.js'

beforeAll(setDocument)

let suite = new HtmlTestSuite('./test/justify-column.json')
describe(suite.description, () => {
    test.each(suite.htmlTests)('$description', runHtmlTest)
})
