import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { schema } from '../src/schema/index.js'
import { codeLanguageOverlayPlugin, hasRoomAboveOverlay } from '../src/setup/index.js'
import { prefix } from '../src/domaccess.js'

function rect({ top = 0, bottom = 0 } = {}) {
    return { top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON() { return this } }
}

describe('codeLanguageOverlayPlugin — widget button', () => {

    test('the language overlay widget is present, non-editable, and relaxedSide for a selected code_block', () => {
        const dom = document.createElement('div')
        dom.innerHTML = '<pre><code class="language-swift">let x = 1</code></pre>'
        const doc = PMDOMParser.fromSchema(schema).parse(dom)
        const selection = TextSelection.create(doc, 1)
        const plugin = codeLanguageOverlayPlugin({})
        let state = EditorState.create({ doc, schema, selection, plugins: [plugin] })
        // The plugin's state only computes decorations in apply(), not init() — dispatch
        // a no-op transaction (re-asserting the same selection) to trigger it.
        state = state.apply(state.tr.setSelection(selection))
        const decorations = plugin.getState(state).find()
        expect(decorations.length).toBe(1)
        expect(decorations[0].type.side).toBe(1)
        // relaxedSide lets the DOM selection land on either side of the widget instead
        // of being strictly pinned — without it, cursor motion can't reach the
        // code_block's start (prosemirror-view's own docs: "keyboard cursor motion will
        // not, without further custom handling, visit both sides of the widget").
        expect(decorations[0].type.spec.relaxedSide).toBe(true)
        // nodeDOM: () => null makes hasRoomAboveOverlay short-circuit to "room available"
        // without needing a full fake view (getToolbar) — covered separately below.
        const button = decorations[0].type.toDOM({ nodeDOM: () => null })
        expect(button.contentEditable).toBe('false')
        expect(button.classList.contains(prefix + '-code-language-overlay-below')).toBe(false)
    })

    test('no overlay widget for an empty code_block — the contentEditable=false button would be its only content, a known-fragile browser/ProseMirror combination', () => {
        const dom = document.createElement('div')
        dom.innerHTML = '<pre><code class="language-swift"></code></pre>'
        const doc = PMDOMParser.fromSchema(schema).parse(dom)
        const selection = TextSelection.create(doc, 1)
        const plugin = codeLanguageOverlayPlugin({})
        let state = EditorState.create({ doc, schema, selection, plugins: [plugin] })
        state = state.apply(state.tr.setSelection(selection))
        const decorations = plugin.getState(state).find()
        expect(decorations.length).toBe(0)
    })

})

describe('hasRoomAboveOverlay', () => {

    // getToolbar(view) walks view.dom.getRootNode().getElementById(...), so the fake
    // view needs a real, connected .dom — a bare {nodeDOM} object isn't enough once
    // preDOM is truthy (the toolbar lookup only gets skipped when preDOM is falsy).
    function fakeView({ toolbarRect } = {}) {
        const container = document.createElement('div')
        const toolbarEl = document.createElement('div')
        toolbarEl.id = prefix + '-toolbar'
        toolbarEl.getBoundingClientRect = () => rect(toolbarRect ?? {})
        const dom = document.createElement('div')
        container.append(toolbarEl, dom)
        document.body.appendChild(container)
        return { dom }
    }

    test('true when the code_block is well below the toolbar', () => {
        const view = fakeView({ toolbarRect: { top: 0, bottom: 40 } })
        const preDOM = { getBoundingClientRect: () => rect({ top: 200, bottom: 220 }) }
        expect(hasRoomAboveOverlay(view, preDOM)).toBe(true)
    })

    test('false when the code_block is right below the toolbar — no room for the label above it', () => {
        const view = fakeView({ toolbarRect: { top: 0, bottom: 40 } })
        const preDOM = { getBoundingClientRect: () => rect({ top: 45, bottom: 65 }) }
        expect(hasRoomAboveOverlay(view, preDOM)).toBe(false)
    })

    test('true when preDOM is missing (defensive default)', () => {
        const view = fakeView()
        expect(hasRoomAboveOverlay(view, null)).toBe(true)
    })

})
