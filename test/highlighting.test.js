import { describe, test, expect } from 'vitest'
import { hljs } from '../src/highlighting.js'

/**
 * Confirms the configured hljs instance has the languages
 * (plus their key aliases) statically registered that code highlighting
 * depends on. This proves the import list actually registers before
 * a highlighting plugin relies on it.
 */
describe('highlighting — configured hljs instance', () => {

    const languages = [
        'javascript',
        'typescript',
        'python',
        'swift',
        'java',
        'xml',
        'css',
        'json',
        'bash',
        'markdown',
    ]

    test.each(languages)('%s is registered', (language) => {
        expect(hljs.getLanguage(language)).toBeDefined()
    })

    test('html resolves via the xml language alias', () => {
        expect(hljs.getLanguage('html')).toBeDefined()
        expect(hljs.getLanguage('html').name).toBe(hljs.getLanguage('xml').name)
    })

    test('an unregistered language is not resolved', () => {
        expect(hljs.getLanguage('ruby')).toBeUndefined()
    })

    test('highlight() produces highlighted output for a registered language', () => {
        const result = hljs.highlight('const x = 1;', { language: 'javascript' })
        expect(result.value).toContain('hljs-')
    })

})
