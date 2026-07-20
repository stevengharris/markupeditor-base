import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { schema } from '../src/schema/index.js'
import { codeLanguageOverlayPlugin } from '../src/setup/index.js'

function stateFromHtml(html, selectionPos, plugins) {
    const dom = document.createElement('div')
    dom.innerHTML = html
    const doc = PMDOMParser.fromSchema(schema).parse(dom)
    const selection = TextSelection.create(doc, selectionPos)
    let state = EditorState.create({ doc, schema, selection, plugins })
    // Plugin decorations are only computed in apply(), not init() — see
    // code-language-overlay-widget.test.js's own note on this.
    state = state.apply(state.tr.setSelection(selection))
    return state
}

function fakeView(state) {
    const view = {
        state,
        dispatch(tr) { view.state = view.state.apply(tr) }
    }
    return view
}

const HTML = '<p>Hello world</p><pre><code>function foo() { return 1; }</code></pre>'
// paragraph content 1-12 ("Hello world"), code_block content starts at 14
// (13 is the block boundary) — the widget anchors at 14, before "function".
const PARAGRAPH_END = 12
const CODE_BLOCK_START = 14
const BETWEEN_F_AND_U = 15

describe('codeLanguageOverlayPlugin — widget-adjacent arrow-key navigation', () => {

    test('ArrowLeft one position left, while still inside the code_block, lands before "f" and stays handled', () => {
        const plugin = codeLanguageOverlayPlugin({})
        const view = fakeView(stateFromHtml(HTML, BETWEEN_F_AND_U, [plugin]))
        const handled = plugin.props.handleKeyDown(view, { key: 'ArrowLeft' })
        expect(handled).toBe(true)
        expect(view.state.selection.from).toBe(CODE_BLOCK_START)
        expect(plugin.getState(view.state).find().length).toBe(1)
    })

    test('a second ArrowLeft from the code_block start exits to the true end of the preceding paragraph', () => {
        const plugin = codeLanguageOverlayPlugin({})
        const view = fakeView(stateFromHtml(HTML, CODE_BLOCK_START, [plugin]))
        const handled = plugin.props.handleKeyDown(view, { key: 'ArrowLeft' })
        expect(handled).toBe(true)
        expect(view.state.selection.from).toBe(PARAGRAPH_END)
        expect(plugin.getState(view.state).find().length).toBe(0)
    })

    test('ArrowRight from the end of the paragraph re-enters the code_block, landing at its start', () => {
        const plugin = codeLanguageOverlayPlugin({})
        const view = fakeView(stateFromHtml(HTML, PARAGRAPH_END, [plugin]))
        const handled = plugin.props.handleKeyDown(view, { key: 'ArrowRight' })
        expect(handled).toBe(true)
        expect(view.state.selection.from).toBe(CODE_BLOCK_START)
        expect(plugin.getState(view.state).find().length).toBe(1)
    })

    test('Shift+ArrowLeft (selection extension) is left to native handling, not intercepted', () => {
        const plugin = codeLanguageOverlayPlugin({})
        const view = fakeView(stateFromHtml(HTML, CODE_BLOCK_START, [plugin]))
        const handled = plugin.props.handleKeyDown(view, { key: 'ArrowLeft', shiftKey: true })
        expect(handled).toBe(false)
        expect(view.state.selection.from).toBe(CODE_BLOCK_START)
    })

    test('does not intercept plain arrow keys in ordinary text, away from any code_block, leaving native RTL/bidi and grapheme-cluster handling in control', () => {
        const plugin = codeLanguageOverlayPlugin({})
        const view = fakeView(stateFromHtml(HTML, 6, [plugin])) // middle of "Hello world"
        const handled = plugin.props.handleKeyDown(view, { key: 'ArrowLeft' })
        expect(handled).toBe(false)
        expect(view.state.selection.from).toBe(6) // untouched — native handling owns this move
    })

    test('crosses correctly between two separate widget-bearing code_blocks, regardless of how many widgets exist', () => {
        // Not scoped to "is there a widget here" — plain model math for
        // every arrow press, so it holds for any number of widget-bearing
        // blocks, not just one.
        // positions: paragraph 1-2, code_block1 5-7 ("ab"), code_block2 9-11 ("cd")
        const html = '<p>Hi</p><pre><code>ab</code></pre><pre><code>cd</code></pre>'
        const plugin = codeLanguageOverlayPlugin({})
        const view = fakeView(stateFromHtml(html, 9, [plugin])) // start of code_block2, right after its own widget
        const handled = plugin.props.handleKeyDown(view, { key: 'ArrowLeft' })
        expect(handled).toBe(true)
        expect(view.state.selection.from).toBe(7) // true end of code_block1's "ab"
    })

})
