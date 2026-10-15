import { describe, test, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { schema } from '../src/schema/index.js'
import { codeHighlightPlugin } from '../src/setup/index.js'

/**
 * A code block is shown without syntax highlighting while the selection is in
 * it, so the system's inline predictions see the same DOM as in a plain block,
 * and is highlighted again when the selection leaves. The plugin's
 * decorations prop is evaluated directly against a bare EditorState.
 */
describe('code highlighting follows the selection', () => {

  const html = '<p>intro</p><pre><code class="language-javascript">let x = 1</code></pre>' +
               '<pre><code class="language-javascript">const y = 2</code></pre>'

  function stateWithCaretIn(textToFind) {
    const dom = document.createElement('div')
    dom.innerHTML = html
    const doc = PMDOMParser.fromSchema(schema).parse(dom)
    let pos = null
    doc.descendants((node, p) => {
      if (pos === null && node.isText && node.text.includes(textToFind)) pos = p + 1
    })
    const base = EditorState.create({ doc, plugins: [codeHighlightPlugin] })
    return base.apply(base.tr.setSelection(TextSelection.create(doc, pos)))
  }

  // Start offsets, in the document, of the code blocks that have highlight spans.
  function highlightedBlocks(state) {
    const set = codeHighlightPlugin.props.decorations(state)
    const starts = new Set()
    state.doc.forEach((node, offset) => {
      if (node.type.name === 'code_block' && set.find(offset, offset + node.nodeSize).length > 0) starts.add(node.textContent)
    })
    return starts
  }

  test('both code blocks are highlighted when the caret is in the paragraph', () => {
    expect(highlightedBlocks(stateWithCaretIn('intro'))).toEqual(new Set(['let x = 1', 'const y = 2']))
  })

  test('the block holding the caret is not highlighted', () => {
    expect(highlightedBlocks(stateWithCaretIn('let x'))).toEqual(new Set(['const y = 2']))
  })

  test('only the block holding the caret loses its highlighting', () => {
    expect(highlightedBlocks(stateWithCaretIn('const y'))).toEqual(new Set(['let x = 1']))
  })
})
