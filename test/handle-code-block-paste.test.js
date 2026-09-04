import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { schema } from '../src/schema/index.js'
import { handleCodeBlockPaste } from '../src/markup.js'

// Exercises the REAL DOM-paste path (a plain browser Cmd+V), independent of pasteCode
// (tested separately in paste-code.test.js). Constructs a real EditorView directly,
// mirroring codeview.test.js's own realView() helper -- handleCodeBlockPaste was
// extracted specifically so it's testable without markupeditor.js's full
// MarkupEditor/target closure.

function docFromHTML(html) {
    const dom = document.createElement('div')
    dom.innerHTML = html
    return PMDOMParser.fromSchema(schema).parse(dom)
}

function realView(html, selectionPos) {
    const doc = docFromHTML(html)
    const selection = TextSelection.create(doc, selectionPos)
    const state = EditorState.create({ doc, schema, selection })
    const container = document.body.appendChild(document.createElement('div'))
    const view = new EditorView(container, { state })
    return { view, container }
}

function clipboardEvent(text) {
    return { clipboardData: { getData: (type) => (type === 'text/plain' ? text : '') } }
}

describe('handleCodeBlockPaste', () => {
    test('normalizes smart quotes/apostrophes when pasting into a code block', () => {
        const { view, container } = realView('<pre><code></code></pre>', 1)

        const handled = handleCodeBlockPaste(view, clipboardEvent('src=“x”'))

        expect(handled).toBe(true)
        expect(view.state.doc.textBetween(1, view.state.doc.content.size - 1)).toBe('src="x"')

        view.destroy()
        container.remove()
    })

    test('leaves plain text (no smart punctuation) unchanged', () => {
        const { view, container } = realView('<pre><code></code></pre>', 1)

        handleCodeBlockPaste(view, clipboardEvent('plain text'))

        expect(view.state.doc.textBetween(1, view.state.doc.content.size - 1)).toBe('plain text')

        view.destroy()
        container.remove()
    })

    test('does not handle paste outside a code block, letting default paste behavior take over', () => {
        const { view, container } = realView('<p></p>', 1)

        const handled = handleCodeBlockPaste(view, clipboardEvent('src=“x”'))

        expect(handled).toBe(false)
        // Nothing dispatched -- the smart quote is untouched because this function
        // deliberately leaves non-code-block paste alone.
        expect(view.state.doc.textContent).toBe('')

        view.destroy()
        container.remove()
    })

    test('returns false and does not dispatch when clipboardData carries no text/plain data', () => {
        const { view, container } = realView('<pre><code></code></pre>', 1)

        const handled = handleCodeBlockPaste(view, { clipboardData: { getData: () => '' } })

        expect(handled).toBe(false)
        expect(view.state.doc.textContent).toBe('')

        view.destroy()
        container.remove()
    })
})
