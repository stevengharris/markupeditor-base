import { describe, test, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { schema } from '../src/schema/index.js'
import { buildInputRules } from '../src/setup/inputrules.js'

/**
 * markdown-shorthand.json's HtmlTestSuite harness sets up a single shared
 * <markup-editor> instance in beforeAll (see test/setup.js), so BehaviorConfig
 * cannot be varied per test case there. These tests instead exercise
 * buildInputRules directly against a bare ProseMirror EditorState to prove
 * that config.behavior.markdownShorthand gates all nine rules together: the
 * five markdown shorthand marks (bold, italic x2, inline code, strikethrough)
 * and the four pre-existing block rules (blockquote, lists, heading).
 */
describe('markdownShorthand BehaviorConfig gate', () => {

  function docWithParagraph(text) {
    const dom = document.createElement('div')
    dom.innerHTML = `<p>${text}</p>`
    return PMDOMParser.fromSchema(schema).parse(dom)
  }

  // Simulates typing the last character of fullText: the paragraph already
  // contains fullText minus its last character, and the final character is
  // passed as the not-yet-inserted `text` argument to handleTextInput, which
  // mirrors how ProseMirror's EditorView actually invokes it (the typed
  // character is offered to input rules before it lands in the doc).
  function simulateTyping(plugin, fullText) {
    const priorText = fullText.slice(0, -1)
    const lastChar = fullText.slice(-1)
    const doc = docWithParagraph(priorText)
    const pos = doc.content.size - 1
    const state = EditorState.create({ doc, plugins: [plugin], selection: TextSelection.create(doc, pos) })
    const fakeView = { state, dispatch: () => {}, composing: false }
    return plugin.props.handleTextInput(fakeView, pos, pos, lastChar)
  }

  test('markdownShorthand defaults to enabled when config is omitted', () => {
    const plugin = buildInputRules(schema)
    expect(simulateTyping(plugin, '> ')).toBe(true)        // blockquote
    expect(simulateTyping(plugin, '1. ')).toBe(true)       // ordered list
    expect(simulateTyping(plugin, '- ')).toBe(true)        // bullet list
    expect(simulateTyping(plugin, '# ')).toBe(true)        // heading
    expect(simulateTyping(plugin, '**foo**')).toBe(true)   // strong
    expect(simulateTyping(plugin, '*foo*')).toBe(true)     // em (star)
    expect(simulateTyping(plugin, '_foo_')).toBe(true)     // em (underscore)
    expect(simulateTyping(plugin, '`foo`')).toBe(true)     // code
    expect(simulateTyping(plugin, '~~foo~~')).toBe(true)   // strikethrough
  })

  test('markdownShorthand: false suppresses all five markdown shorthand rules', () => {
    const plugin = buildInputRules(schema, { behavior: { markdownShorthand: false } })
    expect(simulateTyping(plugin, '**foo**')).toBe(false)   // strong
    expect(simulateTyping(plugin, '*foo*')).toBe(false)     // em (star)
    expect(simulateTyping(plugin, '_foo_')).toBe(false)     // em (underscore)
    expect(simulateTyping(plugin, '`foo`')).toBe(false)     // code
    expect(simulateTyping(plugin, '~~foo~~')).toBe(false)   // strikethrough
  })

  test('markdownShorthand: false also suppresses the pre-existing block rules', () => {
    const plugin = buildInputRules(schema, { behavior: { markdownShorthand: false } })
    expect(simulateTyping(plugin, '> ')).toBe(false)   // blockquote
    expect(simulateTyping(plugin, '1. ')).toBe(false)  // ordered list
    expect(simulateTyping(plugin, '- ')).toBe(false)   // bullet list
    expect(simulateTyping(plugin, '# ')).toBe(false)   // heading
  })
})
