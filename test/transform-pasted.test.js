import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { schema } from '../src/schema/index.js'
import { transformPastedHTML, transformPastedText } from '../src/markup.js'

// transformPastedHTML/transformPastedText are ProseMirror EditorProps, run on every
// paste (real DOM paste and view.pasteHTML/pasteText alike) before the content is
// parsed into the document -- unlike handleCodeBlockPaste, which only intervenes for
// a code_block selection, these cover general prose paste.

function docFromHTML(html) {
    const dom = document.createElement('div')
    dom.innerHTML = html
    return PMDOMParser.fromSchema(schema).parse(dom)
}

// jsdom has no global ClipboardEvent; view.pasteHTML/pasteText default to `new
// ClipboardEvent(...)` when no event is passed, so supply a stub instead.
function clipboardEvent() {
    return { clipboardData: { getData: () => '' } }
}

function realView(html, selectionPos) {
    const doc = docFromHTML(html)
    const selection = TextSelection.create(doc, selectionPos)
    const state = EditorState.create({ doc, schema, selection })
    const container = document.body.appendChild(document.createElement('div'))
    const view = new EditorView(container, { state, transformPastedHTML, transformPastedText })
    return { view, container }
}

describe('transformPastedHTML', () => {
    test('normalizes smart quotes/apostrophes in the function itself', () => {
        expect(transformPastedHTML('<p>src=“x”</p>')).toBe('<p>src="x"</p>')
    })

    test('normalizes smart quotes when pasted into prose via view.pasteHTML', () => {
        const { view, container } = realView('<p></p>', 1)

        view.pasteHTML('it’s ‘quoted’', clipboardEvent())

        expect(view.state.doc.textContent).toBe("it's 'quoted'")

        view.destroy()
        container.remove()
    })
})

describe('transformPastedText', () => {
    test('normalizes smart quotes/apostrophes in the function itself', () => {
        expect(transformPastedText('it’s ‘quoted’')).toBe("it's 'quoted'")
    })

    test('normalizes smart quotes when pasted into prose via view.pasteText', () => {
        const { view, container } = realView('<p></p>', 1)

        view.pasteText('src=“x”', clipboardEvent())

        expect(view.state.doc.textContent).toBe('src="x"')

        view.destroy()
        container.remove()
    })
})
