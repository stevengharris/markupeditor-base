import fs from 'node:fs'
import path from 'node:path'
import { describe, test, expect } from 'vitest'
import { hljs, isRecognizedLanguage } from '../src/highlighting.js'

function loadFixture(filename) {
    let fullFilename = path.join(process.cwd(), filename)
    let data = fs.readFileSync(fullFilename, 'utf8')
    return JSON.parse(data)
}

const fixture = loadFixture('./test/highlighting.json')

/**
 * Data-driven over test/highlighting.json: covers the recognized/alias/unrecognized
 * cases a language-entry dialog's live inline warning depends on (case-insensitive,
 * alias-aware, whitespace-trimmed matching). isRecognizedLanguage delegates directly
 * to hljs.getLanguage, so this matrix also proves the configured hljs instance has
 * the expected languages (plus their key aliases) statically registered.
 */
describe(fixture.description, () => {
    test.each(fixture.tests)('$description', ({ input, recognized }) => {
        expect(isRecognizedLanguage(input)).toBe(recognized)
    })
})

/**
 * Mechanism-level checks that aren't part of the portable recognition matrix above:
 * hljs API structure and JS-specific parameter handling.
 */
describe('highlighting — hljs mechanism', () => {

    test('html resolves via the xml language alias', () => {
        expect(hljs.getLanguage('html')).toBeDefined()
        expect(hljs.getLanguage('html').name).toBe(hljs.getLanguage('xml').name)
    })

    test('highlight() produces highlighted output for a registered language', () => {
        const result = hljs.highlight('const x = 1;', { language: 'javascript' })
        expect(result.value).toContain('hljs-')
    })

    test('null/undefined input is not recognized', () => {
        expect(isRecognizedLanguage(null)).toBe(false)
        expect(isRecognizedLanguage(undefined)).toBe(false)
    })

})
