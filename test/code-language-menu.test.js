import fs from 'node:fs'
import path from 'node:path'
import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, TextSelection, NodeSelection } from 'prosemirror-state'
import { schema } from '../src/schema/index.js'
import { presentCodeLanguages } from '../src/highlighting.js'
import { setCodeLanguageCommand } from '../src/markup.js'

function loadFixture(filename) {
    let fullFilename = path.join(process.cwd(), filename)
    let data = fs.readFileSync(fullFilename, 'utf8')
    return JSON.parse(data)
}

/**
 * Build an EditorState from `html`, with the selection collapsed inside the
 * `blockIndex`-th code_block found in document order (default: the first).
 */
function stateWithSelectionInCodeBlock(html, blockIndex = 0) {
    const parser = PMDOMParser.fromSchema(schema)
    const dom = document.createElement('div')
    dom.innerHTML = html
    const doc = parser.parse(dom)
    let seen = 0, selectionPos = null
    doc.descendants((node, pos) => {
        if (node.type.name !== 'code_block') return
        if (seen === blockIndex) selectionPos = pos + 1
        seen++
    })
    const selection = TextSelection.create(doc, selectionPos)
    return EditorState.create({ doc, schema, selection })
}

const fixture = loadFixture('./test/code-language-menu.json')

describe(fixture.description, () => {
    test.each(fixture.tests)('$description', ({ html, expected }) => {
        const dom = document.createElement('div')
        dom.innerHTML = html
        const doc = PMDOMParser.fromSchema(schema).parse(dom)
        expect(presentCodeLanguages(doc)).toEqual(expected)
    })
})

describe('setCodeLanguageCommand', () => {

    test('sets the language attr of the code_block at the selection', () => {
        const state = stateWithSelectionInCodeBlock('<pre><code>let x = 1</code></pre>')
        let dispatched
        const result = setCodeLanguageCommand('swift')(state, tr => { dispatched = tr })
        expect(result).toBe(true)
        const newState = state.apply(dispatched)
        let language
        newState.doc.descendants(node => { if (node.type.name === 'code_block') language = node.attrs.language })
        expect(language).toBe('swift')
    })

    test('clears the language attr back to null for a falsy value', () => {
        const state = stateWithSelectionInCodeBlock('<pre><code class="language-swift">let x = 1</code></pre>')
        let dispatched
        setCodeLanguageCommand(null)(state, tr => { dispatched = tr })
        const newState = state.apply(dispatched)
        let language
        newState.doc.descendants(node => { if (node.type.name === 'code_block') language = node.attrs.language })
        expect(language).toBeNull()
    })

    test('sets an unrecognized language name just the same as a recognized one', () => {
        const state = stateWithSelectionInCodeBlock('<pre><code>let x = 1</code></pre>')
        let dispatched
        setCodeLanguageCommand('cobol')(state, tr => { dispatched = tr })
        const newState = state.apply(dispatched)
        let language
        newState.doc.descendants(node => { if (node.type.name === 'code_block') language = node.attrs.language })
        expect(language).toBe('cobol')
    })

    test('converts a plain paragraph to a code_block with the given language, matching the old plain Code style behavior for "no language"', () => {
        const dom = document.createElement('div')
        dom.innerHTML = '<p>let x = 1</p>'
        const doc = PMDOMParser.fromSchema(schema).parse(dom)
        const state = EditorState.create({ doc, schema, selection: TextSelection.create(doc, 1) })
        let dispatched
        const result = setCodeLanguageCommand(null)(state, tr => { dispatched = tr })
        expect(result).toBe(true)
        const newState = state.apply(dispatched)
        let found
        newState.doc.descendants(node => { if (node.type.name === 'code_block') found = node })
        expect(found).toBeDefined()
        expect(found.attrs.language).toBeNull()
        expect(found.textContent).toBe('let x = 1')
    })

    test('converts a plain paragraph directly to a code_block with a specific language in one step', () => {
        const dom = document.createElement('div')
        dom.innerHTML = '<p>let x = 1</p>'
        const doc = PMDOMParser.fromSchema(schema).parse(dom)
        const state = EditorState.create({ doc, schema, selection: TextSelection.create(doc, 1) })
        let dispatched
        setCodeLanguageCommand('swift')(state, tr => { dispatched = tr })
        const newState = state.apply(dispatched)
        let found
        newState.doc.descendants(node => { if (node.type.name === 'code_block') found = node })
        expect(found.attrs.language).toBe('swift')
    })

    test('returns false and does not dispatch when nothing in the selection can become a code_block', () => {
        const dom = document.createElement('div')
        dom.innerHTML = '<p>before</p><hr/><p>after</p>'
        const doc = PMDOMParser.fromSchema(schema).parse(dom)
        // Select only the horizontal_rule node itself (isBlock, but not inlineContent, no children).
        let hrPos
        doc.descendants((node, pos) => { if (node.type.name === 'horizontal_rule') hrPos = pos })
        const state = EditorState.create({ doc, schema, selection: NodeSelection.create(doc, hrPos) })
        let dispatched = false
        const result = setCodeLanguageCommand('swift')(state, () => { dispatched = true })
        expect(result).toBe(false)
        expect(dispatched).toBe(false)
    })

    test('used as an enable/select check with only state (no dispatch), reports applicability without side effects', () => {
        const inCodeBlock = stateWithSelectionInCodeBlock('<pre><code>let x = 1</code></pre>')
        expect(setCodeLanguageCommand('swift')(inCodeBlock)).toBe(true)

        const dom = document.createElement('div')
        dom.innerHTML = '<p>Just a paragraph</p>'
        const doc = PMDOMParser.fromSchema(schema).parse(dom)
        const paragraphState = EditorState.create({ doc, schema, selection: TextSelection.create(doc, 1) })
        expect(setCodeLanguageCommand('swift')(paragraphState)).toBe(true)
    })

})
