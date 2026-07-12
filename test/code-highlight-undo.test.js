import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { history, undo } from 'prosemirror-history'
import { schema } from '../src/schema/index.js'
import { codeHighlightPlugin } from '../src/setup/index.js'
import { setCodeLanguageCommand } from '../src/markup.js'

function stateFromHtml(html) {
    const dom = document.createElement('div')
    dom.innerHTML = html
    const doc = PMDOMParser.fromSchema(schema).parse(dom)
    const selection = TextSelection.create(doc, 1)
    return EditorState.create({ doc, schema, selection, plugins: [history(), codeHighlightPlugin] })
}

describe('codeHighlightPlugin — undo', () => {

    test('converting a paragraph to a highlighted code_block produces decorations', () => {
        let state = stateFromHtml('<p>const x = 1;</p>')
        let dispatched
        setCodeLanguageCommand('javascript')(state, tr => { dispatched = tr })
        state = state.apply(dispatched)
        const decorations = codeHighlightPlugin.getState(state).find()
        expect(decorations.length).toBeGreaterThan(0)
    })

    test('undoing a paragraph->code_block conversion removes the highlight decorations', () => {
        let state = stateFromHtml('<p>const x = 1;</p>')
        let dispatched
        setCodeLanguageCommand('javascript')(state, tr => { dispatched = tr })
        state = state.apply(dispatched)
        expect(codeHighlightPlugin.getState(state).find().length).toBeGreaterThan(0)

        undo(state, tr => { dispatched = tr })
        state = state.apply(dispatched)

        let restoredIsParagraph = false
        state.doc.descendants((node) => { if (node.type.name === 'paragraph') restoredIsParagraph = true })
        expect(restoredIsParagraph).toBe(true)
        expect(codeHighlightPlugin.getState(state).find().length).toBe(0)
    })

})
