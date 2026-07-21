import { describe, test, expect } from 'vitest'
import { MarkupEditor } from '../src/markupeditor.js'

// No other test constructs the full MarkupEditor class directly (existing
// tests build EditorState/EditorView by hand) — this is the one place
// confirming markupeditor.js's own nodeViews wiring actually works end-to-end,
// not just CodeView in isolation (test/codeview.test.js).
describe('MarkupEditor construction registers CodeView for code_block', () => {

    test('constructs without throwing; a code_block gets a CodeView with the right language class', () => {
        const container = document.body.appendChild(document.createElement('div'))
        container.innerHTML = '<pre><code class="language-swift">let x = 1</code></pre>'
        const editor = new MarkupEditor(container, {})

        const preDOM = editor.view.nodeDOM(0)
        expect(preDOM.tagName).toBe('PRE')
        expect(preDOM.codeView).toBeDefined()
        expect(preDOM.codeView.contentDOM.className).toBe('language-swift')

        editor.view.destroy()
        container.remove()
    })

    test('two MarkupEditor instances each get their own languageDialog, not a shared one', () => {
        const container1 = document.body.appendChild(document.createElement('div'))
        container1.innerHTML = '<pre><code>x</code></pre>'
        const editor1 = new MarkupEditor(container1, {})

        const container2 = document.body.appendChild(document.createElement('div'))
        container2.innerHTML = '<pre><code>y</code></pre>'
        const editor2 = new MarkupEditor(container2, {})

        const dialog1 = editor1.view.nodeDOM(0).codeView.languageDialog
        const dialog2 = editor2.view.nodeDOM(0).codeView.languageDialog
        expect(dialog1).not.toBe(dialog2)

        editor1.view.destroy(); container1.remove()
        editor2.view.destroy(); container2.remove()
    })

})
