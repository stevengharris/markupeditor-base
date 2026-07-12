import fs from 'node:fs'
import path from 'node:path'
import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { schema } from '../src/schema/index.js'
import { codeLanguageOverlayInfo } from '../src/markup.js'

function loadFixture(filename) {
    let fullFilename = path.join(process.cwd(), filename)
    let data = fs.readFileSync(fullFilename, 'utf8')
    return JSON.parse(data)
}

/**
 * Build an EditorState from `html`, with the selection collapsed just inside
 * the first code_block found in document order, or at position 1 if there is
 * no code_block (matching the plain-paragraph "not in a code_block" case).
 */
function selectionState(html) {
    const parser = PMDOMParser.fromSchema(schema)
    const dom = document.createElement('div')
    dom.innerHTML = html
    const doc = parser.parse(dom)
    let selectionPos = null
    doc.descendants((node, pos) => {
        if (node.type.name === 'code_block' && selectionPos === null) selectionPos = pos + 1
    })
    const selection = TextSelection.create(doc, selectionPos ?? 1)
    return EditorState.create({ doc, schema, selection })
}

const fixture = loadFixture('./test/code-language-overlay.json')

describe(fixture.description, () => {
    test.each(fixture.tests)('$description', ({ html, expectedLabel }) => {
        const state = selectionState(html)
        const info = codeLanguageOverlayInfo(state)
        if (expectedLabel === null) {
            expect(info).toBeNull()
        } else {
            expect(info.label).toBe(expectedLabel)
        }
    })
})

/**
 * Position invariant, not part of the portable label matrix above:
 * codeLanguageOverlayInfo's returned pos must point just inside the code_block's
 * content, not at its start tag.
 */
describe('codeLanguageOverlayInfo — position', () => {

    test('pos points just inside the code_block\'s content, not at its start tag', () => {
        const state = selectionState('<pre><code class="language-swift">let x = 1</code></pre>')
        const info = codeLanguageOverlayInfo(state)
        // Position 0 is before the doc's first node; the code_block's own opening position is 0,
        // so content starts at 1 (the +1 in selectionState accounts for entering the node).
        expect(info.pos).toBe(1)
    })

})
