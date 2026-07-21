import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { schema } from '../src/schema/index.js'
import { CodeView } from '../src/nodeview/codeview.js'
import { codeLanguageOverlayPlugin } from '../src/setup/index.js'

function docFromHTML(html) {
    const dom = document.createElement('div')
    dom.innerHTML = html
    return PMDOMParser.fromSchema(schema).parse(dom)
}

function realView(html, selectionPos) {
    const doc = docFromHTML(html)
    const selection = TextSelection.create(doc, selectionPos)
    const state = EditorState.create({ doc, schema, selection, plugins: [codeLanguageOverlayPlugin()] })
    const container = document.body.appendChild(document.createElement('div'))
    const view = new EditorView(container, {
        state,
        nodeViews: { code_block: (node, view, getPos) => new CodeView(node, view, getPos, {}) }
    })
    return { view, container }
}

// codeLanguageOverlayPlugin's view() hook toggles CodeView.setActive directly
// via view.nodeDOM(pos) on every state update, including selection-only ones
// where a NodeView's own update() isn't reliably called.
describe('codeLanguageOverlayPlugin activates only the selected code_block\'s tab', () => {

    const HTML = '<p>Hello</p><pre><code>a</code></pre><pre><code>b</code></pre>'
    // paragraph "Hello" occupies 0-7; code_block1 ("a") occupies 7-10, own
    // pos 7, content start 8; code_block2 ("b") occupies 10-13, own pos 10,
    // content start 11.
    const BLOCK1_START = 8
    const BLOCK2_START = 11

    test('the tab for the code_block containing the initial selection is active; the other is not', () => {
        const { view, container } = realView(HTML, BLOCK1_START)
        expect(view.nodeDOM(7).codeView.tab.isConnected).toBe(true)
        expect(view.nodeDOM(10).codeView.tab.isConnected).toBe(false)

        view.destroy()
        container.remove()
    })

    test('moving the selection to the other code_block swaps which tab is active', () => {
        const { view, container } = realView(HTML, BLOCK1_START)

        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, BLOCK2_START)))

        expect(view.nodeDOM(7).codeView.tab.isConnected).toBe(false)
        expect(view.nodeDOM(10).codeView.tab.isConnected).toBe(true)

        view.destroy()
        container.remove()
    })

    test('moving the selection out of any code_block deactivates both tabs', () => {
        const { view, container } = realView(HTML, BLOCK1_START)

        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)))

        expect(view.nodeDOM(7).codeView.tab.isConnected).toBe(false)
        expect(view.nodeDOM(10).codeView.tab.isConnected).toBe(false)

        view.destroy()
        container.remove()
    })

    // A single transaction that both shifts a code_block's position (an edit
    // earlier in the doc) AND moves selection out of it at the same time.
    // Tracking the deactivation target by a captured position (rather than
    // the CodeView instance itself) would go stale here: the position from
    // before the transaction no longer points at the same block afterward.
    test('deactivates correctly when one transaction both shifts positions and moves selection away', () => {
        const { view, container } = realView(HTML, BLOCK2_START)
        expect(view.nodeDOM(10).codeView.tab.isConnected).toBe(true)

        let tr = view.state.tr.insertText('XXXXX', 1, 1)
        tr.setSelection(TextSelection.create(tr.doc, 1))
        view.dispatch(tr)

        const shiftedBlock2Pos = 10 + 5 // "XXXXX" shifted block2's own pos by 5
        expect(view.nodeDOM(shiftedBlock2Pos).codeView.tab.isConnected).toBe(false)

        view.destroy()
        container.remove()
    })

})
