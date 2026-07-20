import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { schema } from '../src/schema/index.js'
import { emptyCodeBlockPlaceholderPlugin, EMPTY_CODE_BLOCK_PLACEHOLDER, codeLanguageOverlayPlugin } from '../src/setup/index.js'

function docFromHTML(html) {
    const dom = document.createElement('div')
    dom.innerHTML = html
    return PMDOMParser.fromSchema(schema).parse(dom)
}

describe('emptyCodeBlockPlaceholderPlugin', () => {

    test('inserts the placeholder into a code_block that is genuinely empty from the start', () => {
        const doc = docFromHTML('<p>Hello</p><pre><code></code></pre>')
        // appendTransaction only fires on a real transaction, not init() — dispatch a
        // no-op selection-only transaction to trigger it, matching this codebase's own
        // convention elsewhere for plugins whose state/behavior depends on apply().
        let state = EditorState.create({ doc, schema, plugins: [emptyCodeBlockPlaceholderPlugin] })
        state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1)))
        const codeBlock = state.doc.lastChild
        expect(codeBlock.textContent).toBe(EMPTY_CODE_BLOCK_PLACEHOLDER)
    })

    test('inserts the placeholder when the user backspaces a code_block back to empty', () => {
        const doc = docFromHTML('<p>Hello</p><pre><code>x</code></pre>')
        let state = EditorState.create({ doc, schema, plugins: [emptyCodeBlockPlaceholderPlugin] })
        const codeBlockPos = state.doc.firstChild.nodeSize
        // Delete the single "x" character.
        state = state.apply(state.tr.delete(codeBlockPos + 1, codeBlockPos + 2))
        const codeBlock = state.doc.lastChild
        expect(codeBlock.textContent).toBe(EMPTY_CODE_BLOCK_PLACEHOLDER)
    })

    test('strips the placeholder the moment real content is typed, leaving only the real content', () => {
        const doc = docFromHTML('<p>Hello</p><pre><code></code></pre>')
        let state = EditorState.create({ doc, schema, plugins: [emptyCodeBlockPlaceholderPlugin] })
        state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1)))
        const codeBlockPos = state.doc.firstChild.nodeSize
        expect(state.doc.lastChild.textContent).toBe(EMPTY_CODE_BLOCK_PLACEHOLDER)

        // Type "x" at the start of the placeholder-only content, matching where a
        // freshly-focused cursor actually lands (before the placeholder character).
        state = state.apply(state.tr.insertText('x', codeBlockPos + 1))
        expect(state.doc.lastChild.textContent).toBe('x')
    })

    test('never touches a pre-existing, unrelated code_block that legitimately contains spaces, even when an edit elsewhere in the doc triggers appendTransaction', () => {
        const doc = docFromHTML('<p>Hello</p><pre><code>function foo() {}</code></pre>')
        let state = EditorState.create({ doc, schema, plugins: [emptyCodeBlockPlaceholderPlugin] })
        const originalCodeText = state.doc.lastChild.textContent
        expect(originalCodeText).toBe('function foo() {}')

        // Edit inside "Hello", nowhere near the code_block.
        state = state.apply(state.tr.insertText('!', 1, 1))

        expect(state.doc.lastChild.textContent).toBe(originalCodeText)
    })

    test('does not fire at all for a selection-only transaction with no doc change', () => {
        const doc = docFromHTML('<p>Hello</p><pre><code>real code</code></pre>')
        let state = EditorState.create({ doc, schema, plugins: [emptyCodeBlockPlaceholderPlugin] })
        const before = state.doc.lastChild.textContent
        state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1)))
        expect(state.doc.lastChild.textContent).toBe(before)
    })

    test('handles two code_blocks needing a fixup in the same transaction, mapping the second position correctly after the first fixup shifts it', () => {
        const doc = docFromHTML('<p>Hello</p><pre><code></code></pre><pre><code></code></pre>')
        let state = EditorState.create({ doc, schema, plugins: [emptyCodeBlockPlaceholderPlugin] })
        state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1)))
        const codeBlocks = []
        state.doc.descendants((node) => { if (node.type.name === 'code_block') codeBlocks.push(node) })
        expect(codeBlocks).toHaveLength(2)
        expect(codeBlocks[0].textContent).toBe(EMPTY_CODE_BLOCK_PLACEHOLDER)
        expect(codeBlocks[1].textContent).toBe(EMPTY_CODE_BLOCK_PLACEHOLDER)
    })

    test('places selection at the START of the placeholder (before it), not after it — insertText\'s own default cursor-follows-insertion mapping would otherwise leave it past the placeholder, which reads as the caret sitting to the right of a blank space for no reason', () => {
        const doc = docFromHTML('<p>Hello</p><pre><code></code></pre>')
        let state = EditorState.create({ doc, schema, plugins: [emptyCodeBlockPlaceholderPlugin] })
        const codeBlockPos = state.doc.firstChild.nodeSize
        // Selection already at the insertion point BEFORE the fixup runs — matching a
        // real conversion command that maps a pre-existing (already-empty) selection
        // straight through, unchanged, to the same position.
        state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, codeBlockPos + 1)))
        expect(state.selection.from).toBe(codeBlockPos + 1) // the START of the placeholder, not codeBlockPos + 2
        expect(state.doc.lastChild.textContent).toBe(EMPTY_CODE_BLOCK_PLACEHOLDER)
    })

    test('does not corrupt pasted content that itself contains a space, inserted before the placeholder', () => {
        const doc = docFromHTML('<p>Hello</p><pre><code></code></pre>')
        let state = EditorState.create({ doc, schema, plugins: [emptyCodeBlockPlaceholderPlugin] })
        state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1)))
        const codeBlockPos = state.doc.firstChild.nodeSize
        expect(state.doc.lastChild.textContent).toBe(EMPTY_CODE_BLOCK_PLACEHOLDER)

        // Paste "graph TD" at the start of the placeholder-only content, matching where a
        // freshly-focused cursor actually lands (before the placeholder character, per the
        // "places selection at the START" test above). The placeholder character itself is
        // pushed to the end, not consumed by the paste — stripping it must not touch the
        // space that's actually part of the pasted text.
        state = state.apply(state.tr.insertText('graph TD', codeBlockPos + 1))
        expect(state.doc.lastChild.textContent).toBe('graph TD')
    })

    test('does not steal selection into an unrelated empty code_block elsewhere in the document that the user is not actually interacting with', () => {
        const doc = docFromHTML('<p>Hello</p><pre><code></code></pre>')
        let state = EditorState.create({ doc, schema, plugins: [emptyCodeBlockPlaceholderPlugin] })
        // Selection stays in "Hello", nowhere near the code_block, the whole time.
        state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1)))
        expect(state.selection.from).toBe(1)
        expect(state.doc.lastChild.textContent).toBe(EMPTY_CODE_BLOCK_PLACEHOLDER) // still gets the placeholder
    })

    // Real EditorView + real DOM required: this is specifically about where
    // domFromPos itself writes the native selection, invisible to a
    // decorations/model-only test. No deferred fixup involved any more — the
    // Language tab widget's side: -1 (see codeLanguageOverlayPlugin) is what
    // keeps domFromPos out of the back-stepping path that used to land this
    // wrong, confirmed via real Safari testing.
    describe('native caret placement', () => {
        function realView(doc, plugins) {
            const state = EditorState.create({ doc, schema, plugins })
            const container = document.body.appendChild(document.createElement('div'))
            const view = new EditorView(container, { state })
            return { view, container }
        }

        test('places the native caret on the placeholder text node at offset 0', () => {
            const doc = docFromHTML('<p>Hello</p><pre><code class="language-swift"></code></pre>')
            const { view, container } = realView(doc, [emptyCodeBlockPlaceholderPlugin, codeLanguageOverlayPlugin({})])
            const codeBlockPos = view.state.doc.firstChild.nodeSize

            // selectionToDOM only writes the native selection when the view
            // "owns" it (editorOwnsSelection, in prosemirror-view's own
            // selection.ts) — an unfocused view skips the DOM write entirely.
            view.focus()
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, codeBlockPos + 1)))
            expect(view.state.selection.from).toBe(codeBlockPos + 1)

            const domSel = view.root.getSelection()
            expect(domSel.focusNode?.nodeType).toBe(Node.TEXT_NODE)
            expect(domSel.focusNode.textContent).toBe(EMPTY_CODE_BLOCK_PLACEHOLDER)
            expect(domSel.focusOffset).toBe(0)

            view.destroy()
            container.remove()
        })
    })
})
