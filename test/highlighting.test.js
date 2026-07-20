import fs from 'node:fs'
import path from 'node:path'
import { describe, test, expect } from 'vitest'
import { hljs, isRecognizedLanguage, highlightSpans } from '../src/highlighting.js'

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

/**
 * highlightSpans walks hljs's own token tree (no DOM). Values below were
 * captured from real hljs output for each snippet, not hand-computed.
 */
describe('highlighting — highlightSpans', () => {

    test('javascript: keyword and number spans', () => {
        expect(highlightSpans('const x = 1;', 'javascript')).toEqual([
            { from: 0, to: 5, class: 'hljs-keyword' },
            { from: 10, to: 11, class: 'hljs-number' },
        ])
    })

    test('css: comment, selector, and attribute spans', () => {
        expect(highlightSpans('/* hi */\na { color: red; }', 'css')).toEqual([
            { from: 0, to: 8, class: 'hljs-comment' },
            { from: 9, to: 10, class: 'hljs-selector-tag' },
            { from: 13, to: 18, class: 'hljs-attribute' },
        ])
    })

    test('xml with an embedded script sublanguage block needs no special-casing', () => {
        expect(highlightSpans('<script>var x = 1;</script>', 'xml')).toEqual([
            { from: 1, to: 7, class: 'hljs-name' },
            { from: 0, to: 8, class: 'hljs-tag' },
            { from: 8, to: 11, class: 'hljs-keyword' },
            { from: 16, to: 17, class: 'hljs-number' },
            { from: 8, to: 18, class: 'language-javascript' },
            { from: 20, to: 26, class: 'hljs-name' },
            { from: 18, to: 27, class: 'hljs-tag' },
        ])
    })

    test('unrecognized language produces no spans', () => {
        expect(highlightSpans('code', 'not-a-real-language')).toEqual([])
    })

})
