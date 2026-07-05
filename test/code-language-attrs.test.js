import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { schema } from '../src/schema/index.js'

/**
 * The HtmlTestSuite/runHtmlTest harness in code-language.test.js only ever
 * compares serialized HTML strings. That is not sufficient to distinguish
 * `language: null` from `language: ""`, since code_block's toDOM branches on
 * truthiness and both produce the identical `<pre><code>...</code></pre>`
 * markup. The no-language case must be strictly `null`, so these tests parse
 * HTML directly with ProseMirror's DOMParser and inspect the resulting node's
 * `attrs.language` value (not just its serialized form).
 */
describe('code_block language attr identity (not just HTML round-trip)', () => {
    const parser = PMDOMParser.fromSchema(schema)

    function parseCodeBlock(html) {
        const dom = document.createElement('div')
        dom.innerHTML = html
        const docNode = parser.parse(dom)
        let codeBlockNode
        docNode.descendants((node) => {
            if (node.type.name === 'code_block') codeBlockNode = node
        })
        return codeBlockNode
    }

    test('no language class parses to strictly null, not empty string', () => {
        const codeBlockNode = parseCodeBlock('<pre><code>let x = 1</code></pre>')
        expect(codeBlockNode).toBeDefined()
        expect(codeBlockNode.attrs.language).toBeNull()
        expect(codeBlockNode.attrs.language).not.toBe('')
    })

    test('a single language-xxx class parses to the language string', () => {
        const codeBlockNode = parseCodeBlock('<pre><code class="language-swift">let x = 1</code></pre>')
        expect(codeBlockNode.attrs.language).toBe('swift')
    })

    test('a bare "language-" class (empty suffix) falls back to null, not empty string', () => {
        const codeBlockNode = parseCodeBlock('<pre><code class="language-">let x = 1</code></pre>')
        expect(codeBlockNode.attrs.language).toBeNull()
        expect(codeBlockNode.attrs.language).not.toBe('')
    })
})
