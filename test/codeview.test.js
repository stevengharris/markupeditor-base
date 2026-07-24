import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { schema } from '../src/schema/index.js'
import { CodeView } from '../src/nodeview/codeview.js'
import { prefix } from '../src/domaccess.js'

function docFromHTML(html) {
    const dom = document.createElement('div')
    dom.innerHTML = html
    return PMDOMParser.fromSchema(schema).parse(dom)
}

function realView(html, languageDialog = {}) {
    const doc = docFromHTML(html)
    const selection = TextSelection.create(doc, 1)
    const state = EditorState.create({ doc, schema, selection })
    const container = document.body.appendChild(document.createElement('div'))
    let codeView
    const view = new EditorView(container, {
        state,
        nodeViews: { code_block: (node, view, getPos) => (codeView = new CodeView(node, view, getPos, languageDialog)) }
    })
    return { view, container, codeView }
}

describe('CodeView', () => {

    test('renders <pre><code class="language-X">, tab not yet connected', () => {
        const { view, container, codeView } = realView('<pre><code class="language-swift">let x = 1</code></pre>')
        const preDOM = view.nodeDOM(0)
        expect(preDOM.tagName).toBe('PRE')
        expect(preDOM.firstChild).toBe(codeView.contentDOM)
        expect(codeView.contentDOM.className).toBe('language-swift')
        expect(codeView.tab.isConnected).toBe(false)

        view.destroy()
        container.remove()
    })

    test('setActive(true)/setActive(false) append/remove the tab, idempotently', () => {
        const { view, container, codeView } = realView('<pre><code>x</code></pre>')

        codeView.setActive(true)
        expect(codeView.tab.isConnected).toBe(true)
        codeView.setActive(true)
        expect(codeView.dom.querySelectorAll('button').length).toBe(1)

        codeView.setActive(false)
        expect(codeView.tab.isConnected).toBe(false)
        codeView.setActive(false)
        expect(codeView.dom.querySelectorAll('button').length).toBe(0)

        view.destroy()
        container.remove()
    })

    // setActive's own appendChild/removeChild is a real DOM mutation the view
    // notices asynchronously (a MutationObserver callback, not synchronous
    // with dispatch). Without ignoreMutation, that mutation gets treated as
    // an unexpected external change and the whole node is rebuilt from
    // scratch on the next flush, destroying the tab it just added — invisible
    // to any test asserting only synchronously after setActive/dispatch,
    // which is why this needs a real awaited tick.
    test('setActive survives the DOMObserver flush — same instance, tab still connected', async () => {
        const { view, container, codeView } = realView('<pre><code>x</code></pre>')

        codeView.setActive(true)
        await new Promise((resolve) => setTimeout(resolve, 20))

        expect(view.nodeDOM(0)).toBe(codeView.dom) // not rebuilt into a new instance
        expect(codeView.dom.isConnected).toBe(true)
        expect(codeView.tab.isConnected).toBe(true)

        view.destroy()
        container.remove()
    })

    test('tab label reflects language, including "Language: none" when unset', () => {
        const { view: withLang, container: c1, codeView: cv1 } = realView('<pre><code class="language-python">x</code></pre>')
        expect(cv1.tab.textContent).toBe('Language: python')
        withLang.destroy(); c1.remove()

        const { view: noLang, container: c2, codeView: cv2 } = realView('<pre><code>x</code></pre>')
        expect(cv2.tab.textContent).toBe('Language: none')
        noLang.destroy(); c2.remove()
    })

    test('tab label and contentDOM class update live when language changes', () => {
        const { view, container, codeView } = realView('<pre><code>x</code></pre>')
        expect(codeView.tab.textContent).toBe('Language: none')
        expect(codeView.contentDOM.className).toBe('')

        const node = view.state.doc.firstChild
        view.dispatch(view.state.tr.setNodeMarkup(0, undefined, { ...node.attrs, language: 'javascript' }))

        expect(view.nodeDOM(0)).toBe(codeView.dom) // same instance, not recreated
        expect(codeView.tab.textContent).toBe('Language: javascript')
        expect(codeView.contentDOM.className).toBe('language-javascript')

        view.destroy()
        container.remove()
    })

    test('mousedown on the tab opens the dialog with the current language and commits via setCodeLanguageCommand', () => {
        let openedWithLanguage = 'unset'
        const languageDialog = {
            open(view, currentLanguage, onSubmit) {
                openedWithLanguage = currentLanguage
                onSubmit('rust')
            }
        }
        const { view, container, codeView } = realView('<pre><code class="language-python">x</code></pre>', languageDialog)

        codeView.tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

        expect(openedWithLanguage).toBe('python')
        expect(view.state.doc.firstChild.attrs.language).toBe('rust')

        view.destroy()
        container.remove()
    })

    describe('setActive applies the -below class per hasRoomAbove', () => {

        function rect({ top = 0, bottom = 0 } = {}) {
            return { top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON() { return this } }
        }

        function withToolbar(bottom) {
            const toolbarEl = document.body.appendChild(document.createElement('div'))
            toolbarEl.id = prefix + '-toolbar'
            toolbarEl.getBoundingClientRect = () => rect({ top: 0, bottom })
            return toolbarEl
        }

        test('no -below class when there is room above', () => {
            const toolbarEl = withToolbar(40)
            const { view, container, codeView } = realView('<pre><code>x</code></pre>')
            codeView.dom.getBoundingClientRect = () => rect({ top: 200, bottom: 220 })

            codeView.setActive(true)
            expect(codeView.tab.classList.contains(prefix + '-code-language-tab-below')).toBe(false)

            view.destroy(); container.remove(); toolbarEl.remove()
        })

        test('-below class applied when the block is too close to the toolbar', () => {
            const toolbarEl = withToolbar(40)
            const { view, container, codeView } = realView('<pre><code>x</code></pre>')
            codeView.dom.getBoundingClientRect = () => rect({ top: 45, bottom: 65 })

            codeView.setActive(true)
            expect(codeView.tab.classList.contains(prefix + '-code-language-tab-below')).toBe(true)

            view.destroy(); container.remove(); toolbarEl.remove()
        })

    })

    // The tab lives outside contentDOM (setActive's own comment), so it can
    // never become contentDOM's lastChild — a genuinely empty code_block with
    // the tab active must still get ProseMirror's normal empty-textblock
    // handling (a trailing <br>), never the selection-blocking separator a
    // widget-as-lastChild would trigger.
    test('a genuinely empty code_block with the tab active still gets correct native caret placement, no separator', () => {
        const doc = docFromHTML('<p>Hello</p><pre><code class="language-swift"></code></pre>')
        expect(doc.lastChild.content.size).toBe(0)
        const state = EditorState.create({ doc, schema, selection: TextSelection.create(doc, 1) })
        const container = document.body.appendChild(document.createElement('div'))
        let codeView
        const view = new EditorView(container, {
            state,
            nodeViews: { code_block: (node, view, getPos) => (codeView = new CodeView(node, view, getPos, {})) }
        })
        codeView.setActive(true)
        view.focus()

        const codeBlockPos = view.state.doc.firstChild.nodeSize
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, codeBlockPos + 1)))

        const domSel = view.root.getSelection()
        expect(domSel.focusNode?.nodeName).toBe('CODE')
        expect(domSel.focusOffset).toBe(0)
        expect(codeView.contentDOM.innerHTML).toBe('<br class="ProseMirror-trailingBreak">')
        expect(view.dom.querySelector('.ProseMirror-separator')).toBeNull()

        view.dispatch(view.state.tr.insertText('x', view.state.selection.from))
        expect(view.state.doc.lastChild.textContent).toBe('x')

        view.destroy()
        container.remove()
    })

})
