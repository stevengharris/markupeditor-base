import { describe, test, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { schema } from '../src/schema/index.js'
import { codeFenceHintPlugin } from '../src/setup/inputrules.js'

/**
 * The pending-fence hint is a decoration, so it is checked against a bare
 * EditorState: the plugin's decorations prop is evaluated directly and the
 * ranges and class it returns are compared.
 */
describe('code fence hint decoration', () => {

  function stateWith(html, caretOffset, config) {
    const dom = document.createElement('div')
    dom.innerHTML = html
    const doc = PMDOMParser.fromSchema(schema).parse(dom)
    const plugin = codeFenceHintPlugin(schema, config)
    const base = EditorState.create({ doc, plugins: [plugin] })
    // Paragraph content starts at position 1 in these single-paragraph documents.
    const pos = caretOffset === undefined ? doc.content.size - 1 : 1 + caretOffset
    const state = base.apply(base.tr.setSelection(TextSelection.create(doc, pos)))
    return { state, plugin }
  }

  function hints({ state, plugin }) {
    const set = plugin.props.decorations(state)
    return set ? set.find().map(d => ({ from: d.from, to: d.to, class: d.type.attrs.class })) : []
  }

  test('three backticks at the end of a paragraph are marked', () => {
    expect(hints(stateWith('<p>```</p>'))).toEqual([{ from: 1, to: 4, class: 'code-fence-pending' }])
  })

  test('backticks and a language are marked together', () => {
    expect(hints(stateWith('<p>```bash</p>'))).toEqual([{ from: 1, to: 8, class: 'code-fence-pending' }])
  })

  test('a language with punctuation is marked', () => {
    expect(hints(stateWith('<p>```c++</p>'))).toEqual([{ from: 1, to: 7, class: 'code-fence-pending' }])
  })

  test('nothing is marked while the fence is incomplete', () => {
    expect(hints(stateWith('<p>``</p>'))).toEqual([])
  })

  test('nothing is marked when the caret is not at the end of the paragraph', () => {
    expect(hints(stateWith('<p>```bash</p>', 4))).toEqual([])
  })

  test('nothing is marked when other text precedes the fence', () => {
    expect(hints(stateWith('<p>x```bash</p>'))).toEqual([])
  })

  test('nothing is marked when a space follows the backticks', () => {
    expect(hints(stateWith('<p>``` bash</p>'))).toEqual([])
  })

  test('nothing is marked when the paragraph holds a mark', () => {
    expect(hints(stateWith('<p>```<strong>bash</strong></p>'))).toEqual([])
  })

  test('nothing is marked in a heading', () => {
    expect(hints(stateWith('<h1>```bash</h1>'))).toEqual([])
  })

  test('nothing is marked when markdownShorthand is off', () => {
    expect(hints(stateWith('<p>```bash</p>', undefined, { behavior: { markdownShorthand: false } }))).toEqual([])
  })
})
