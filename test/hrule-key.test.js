import { describe, test, expect } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { schema } from '../src/schema/index.js'
import { buildKeymap } from '../src/setup/keymap.js'
import { buildMenuItems } from '../src/setup/menu.js'

describe('horizontal rule key', () => {

  function keysFor(keymap) {
    return buildKeymap({ keymap, behavior: {}, toolbar: { icons: {}, help: {} } }, schema)
  }

  test('the hrule binding inserts a horizontal rule', () => {
    const dom = document.createElement('div')
    dom.innerHTML = '<p>text</p>'
    const doc = PMDOMParser.fromSchema(schema).parse(dom)
    const state = EditorState.create({ doc, schema, selection: TextSelection.create(doc, 2) })
    const command = keysFor({ hrule: 'Ctrl-Shift-r' })['Ctrl-Shift-r']
    expect(command).toBeTypeOf('function')
    let next = state
    expect(command(state, (tr) => { next = state.apply(tr) }, null)).toBe(true)
    let found = false
    next.doc.descendants((node) => { if (node.type === schema.nodes.horizontal_rule) found = true })
    expect(found).toBe(true)
  })

  test('nothing is bound when the keymap has no hrule entry', () => {
    expect(keysFor({})['Ctrl-Shift-r']).toBeUndefined()
  })
})

describe('horizontal rule tooltip', () => {

  function tooltipFor(keymap) {
    const config = {
      keymap,
      toolbar: {
        visibility: { insertBar: true },
        ordering: { insertBar: 1 },
        insertBar: { hRule: true },
        icons: { hRule: '<svg/>' },
        help: { hRule: 'Insert horizontal rule' }
      }
    }
    const [group] = buildMenuItems(config, schema)
    return group[0].spec.title
  }

  test('the hint shows the hrule binding', () => {
    expect(tooltipFor({ hrule: 'Ctrl-Shift-r' })).toBe('Insert horizontal rule (⌃⇧R)')
  })

  test('there is no hint without a binding', () => {
    expect(tooltipFor({})).toBe('Insert horizontal rule')
  })
})
