import { describe, test, expect } from 'vitest'
import { hasRoomAboveOverlay } from '../src/nodeview/codeview.js'
import { prefix } from '../src/domaccess.js'

function rect({ top = 0, bottom = 0 } = {}) {
    return { top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON() { return this } }
}

// Covers hasRoomAboveOverlay only. CodeView's own tab rendering and language
// sync are covered in test/codeview.test.js; tab activation on selection
// change is covered in test/code-language-overlay-active-tab.test.js.

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
