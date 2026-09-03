import { describe, test, expect, afterEach } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, TextSelection } from 'prosemirror-state'
import { schema } from '../src/schema/index.js'
import { setStyleCommand, wrapInListCommand, setCodeLanguageCommand, indentCommand, outdentCommand, insertHRuleCommand } from '../src/markup.js'
import { registerEditor, unregisterEditor } from '../src/registry.js'

/**
 * Build an EditorState from `html`, with the selection collapsed at the first
 * text position found in document order.
 */
function stateWithCollapsedSelection(html) {
    const dom = document.createElement('div')
    dom.innerHTML = html
    const doc = PMDOMParser.fromSchema(schema).parse(dom)
    let selectionPos = null
    doc.descendants((node, pos) => {
        if (selectionPos !== null) return false
        if (node.isText) selectionPos = pos
        return true
    })
    const selection = TextSelection.create(doc, selectionPos)
    return EditorState.create({ doc, schema, selection })
}

const IN_TABLE_HTML = '<table><tr><td>cell text</td></tr></table>'
const NOT_IN_TABLE_HTML = '<p>plain paragraph</p>'
const EXISTING_CODE_BLOCK_IN_TABLE_HTML = '<table><tr><td><pre><code>let x = 1</code></pre></td></tr></table>'
const BLOCKQUOTE_IN_TABLE_HTML = '<table><tr><td><blockquote><p>cell text</p></blockquote></td></tr></table>'
const BLOCKQUOTE_NOT_IN_TABLE_HTML = '<blockquote><p>plain paragraph</p></blockquote>'

// registerEditor makes its argument the active editor, which is how the
// commands under test reach a delegate via activeConfig()?.delegate --
// unregister after each test so it doesn't leak into the next.
let registered
function registerTestDelegate(delegate) {
    registered = { muId: 'set-style-restriction-test', config: { delegate } }
    registerEditor(registered)
}
afterEach(() => {
    if (registered) unregisterEditor(registered)
    registered = undefined
})

// setStyleCommand branches on `view`, not `dispatch`, to decide whether to
// apply -- state+dispatch alone (no view) hits its dry-run branch instead, the
// same call ParagraphStyleItem.enable(state) already uses in menu.js. These
// tests use that dry-run path rather than constructing a view.
describe('setStyleCommand consults an optional delegate.canStyle(inTable) before applying', () => {
    test('no delegate registered: unaffected, reports applicable as before', () => {
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        expect(setStyleCommand('H1')(state)).toBe(true)
    })

    test('a delegate with no canStyle method: unaffected, reports applicable as before', () => {
        registerTestDelegate({ someOtherMethod() { return true } })
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        expect(setStyleCommand('H1')(state)).toBe(true)
    })

    test('delegate.canStyle(true) returning false reports not applicable inside a table', () => {
        registerTestDelegate({ canStyle: (inTable) => !inTable })
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        expect(setStyleCommand('H1')(state)).toBe(false)
    })

    test('delegate.canStyle(false) returning true still reports applicable outside a table', () => {
        registerTestDelegate({ canStyle: (inTable) => !inTable })
        const state = stateWithCollapsedSelection(NOT_IN_TABLE_HTML)
        expect(setStyleCommand('H1')(state)).toBe(true)
    })

    test('canStyle is called with the actual isTableSelected(state) value, not a hardcoded assumption', () => {
        const seen = []
        registerTestDelegate({ canStyle: (inTable) => { seen.push(inTable); return true } })
        setStyleCommand('H1')(stateWithCollapsedSelection(IN_TABLE_HTML))
        setStyleCommand('H1')(stateWithCollapsedSelection(NOT_IN_TABLE_HTML))
        expect(seen).toEqual([true, false])
    })
})

describe('setCodeLanguageCommand consults an optional delegate.canStyle(inTable) before converting a plain block to a new code_block', () => {
    test('no delegate registered: unaffected, reports applicable as before', () => {
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        expect(setCodeLanguageCommand('swift')(state)).toBe(true)
    })

    test('a delegate with no canStyle method: unaffected, reports applicable as before', () => {
        registerTestDelegate({ someOtherMethod() { return true } })
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        expect(setCodeLanguageCommand('swift')(state)).toBe(true)
    })

    test('delegate.canStyle(true) returning false reports not applicable inside a table', () => {
        registerTestDelegate({ canStyle: (inTable) => !inTable })
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        expect(setCodeLanguageCommand('swift')(state)).toBe(false)
    })

    test('delegate.canStyle(false) returning true still reports applicable outside a table', () => {
        registerTestDelegate({ canStyle: (inTable) => !inTable })
        const state = stateWithCollapsedSelection(NOT_IN_TABLE_HTML)
        expect(setCodeLanguageCommand('swift')(state)).toBe(true)
    })

    test('a delegate vetoing canStyle does NOT block changing the language of a code_block already in a table cell', () => {
        registerTestDelegate({ canStyle: (inTable) => !inTable })
        const state = stateWithCollapsedSelection(EXISTING_CODE_BLOCK_IN_TABLE_HTML)
        let dispatched = false
        const result = setCodeLanguageCommand('swift')(state, () => { dispatched = true })
        expect(result).toBe(true)
        expect(dispatched).toBe(true)
    })
})

describe('wrapInListCommand consults an optional delegate.canList(inTable) before applying', () => {
    test('no delegate registered: unaffected, applies as before', () => {
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        let dispatched = false
        const result = wrapInListCommand(schema, schema.nodes.bullet_list)(state, () => { dispatched = true })
        expect(result).toBe(true)
        expect(dispatched).toBe(true)
    })

    test('a delegate with no canList method: unaffected, applies as before', () => {
        registerTestDelegate({ someOtherMethod() { return true } })
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        let dispatched = false
        const result = wrapInListCommand(schema, schema.nodes.bullet_list)(state, () => { dispatched = true })
        expect(result).toBe(true)
        expect(dispatched).toBe(true)
    })

    test('delegate.canList(true) returning false blocks the command inside a table, without dispatching', () => {
        registerTestDelegate({ canList: (inTable) => !inTable })
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        let dispatched = false
        const result = wrapInListCommand(schema, schema.nodes.bullet_list)(state, () => { dispatched = true })
        expect(result).toBe(false)
        expect(dispatched).toBe(false)
    })

    test('delegate.canList(false) returning true still allows the command outside a table', () => {
        registerTestDelegate({ canList: (inTable) => !inTable })
        const state = stateWithCollapsedSelection(NOT_IN_TABLE_HTML)
        let dispatched = false
        const result = wrapInListCommand(schema, schema.nodes.bullet_list)(state, () => { dispatched = true })
        expect(result).toBe(true)
        expect(dispatched).toBe(true)
    })

    test('canList is called with the actual isTableSelected(state) value, not a hardcoded assumption', () => {
        const seen = []
        registerTestDelegate({ canList: (inTable) => { seen.push(inTable); return true } })
        wrapInListCommand(schema, schema.nodes.bullet_list)(stateWithCollapsedSelection(IN_TABLE_HTML), () => {})
        wrapInListCommand(schema, schema.nodes.bullet_list)(stateWithCollapsedSelection(NOT_IN_TABLE_HTML), () => {})
        expect(seen).toEqual([true, false])
    })

    test('used as an enable/select check with only state (no dispatch), the delegate veto is honored without side effects', () => {
        registerTestDelegate({ canList: (inTable) => !inTable })
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        expect(wrapInListCommand(schema, schema.nodes.bullet_list)(state)).toBe(false)
    })
})

describe('indentCommand and outdentCommand are unconditionally prohibited inside a table', () => {
    test('indentCommand still wraps a plain paragraph in a blockquote outside a table', () => {
        const state = stateWithCollapsedSelection(NOT_IN_TABLE_HTML)
        expect(indentCommand()(state)).toBe(true)
    })

    test('indentCommand reports not applicable for a paragraph inside a table cell, even though the schema would structurally allow wrapping it', () => {
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        expect(indentCommand()(state)).toBe(false)
    })

    test('outdentCommand still lifts an existing blockquote outside a table', () => {
        const state = stateWithCollapsedSelection(BLOCKQUOTE_NOT_IN_TABLE_HTML)
        expect(outdentCommand()(state)).toBe(true)
    })

    test('outdentCommand reports not applicable for a blockquote inside a table cell, even though it would otherwise lift', () => {
        const state = stateWithCollapsedSelection(BLOCKQUOTE_IN_TABLE_HTML)
        expect(outdentCommand()(state)).toBe(false)
    })
})

// The dry run also drives hRuleItem's auto-derived enabled state in menu.js.
describe('insertHRuleCommand consults an optional delegate.canInsertHRule(inTable) before applying', () => {
    test('no delegate registered: dry run (state only, no dispatch) reports applicable without throwing', () => {
        const state = stateWithCollapsedSelection(NOT_IN_TABLE_HTML)
        expect(insertHRuleCommand()(state)).toBe(true)
    })

    test('no delegate registered: real dispatch still inserts the rule as before', () => {
        const state = stateWithCollapsedSelection(NOT_IN_TABLE_HTML)
        let dispatched = false
        const result = insertHRuleCommand()(state, () => { dispatched = true })
        expect(result).toBe(true)
        expect(dispatched).toBe(true)
    })

    test('a delegate with no canInsertHRule method: unaffected, applies as before', () => {
        registerTestDelegate({ someOtherMethod() { return true } })
        const state = stateWithCollapsedSelection(NOT_IN_TABLE_HTML)
        let dispatched = false
        const result = insertHRuleCommand()(state, () => { dispatched = true })
        expect(result).toBe(true)
        expect(dispatched).toBe(true)
    })

    test('delegate.canInsertHRule(true) returning false blocks the command inside a table, without dispatching', () => {
        registerTestDelegate({ canInsertHRule: (inTable) => !inTable })
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        let dispatched = false
        const result = insertHRuleCommand()(state, () => { dispatched = true })
        expect(result).toBe(false)
        expect(dispatched).toBe(false)
    })

    test('delegate.canInsertHRule(false) returning true still allows the command outside a table', () => {
        registerTestDelegate({ canInsertHRule: (inTable) => !inTable })
        const state = stateWithCollapsedSelection(NOT_IN_TABLE_HTML)
        let dispatched = false
        const result = insertHRuleCommand()(state, () => { dispatched = true })
        expect(result).toBe(true)
        expect(dispatched).toBe(true)
    })

    test('canInsertHRule is called with the actual isTableSelected(state) value, not a hardcoded assumption', () => {
        const seen = []
        registerTestDelegate({ canInsertHRule: (inTable) => { seen.push(inTable); return true } })
        insertHRuleCommand()(stateWithCollapsedSelection(IN_TABLE_HTML), () => {})
        insertHRuleCommand()(stateWithCollapsedSelection(NOT_IN_TABLE_HTML), () => {})
        expect(seen).toEqual([true, false])
    })

    test('used as an enable/select check with only state (no dispatch), the delegate veto is honored without side effects', () => {
        registerTestDelegate({ canInsertHRule: (inTable) => !inTable })
        const state = stateWithCollapsedSelection(IN_TABLE_HTML)
        expect(insertHRuleCommand()(state)).toBe(false)
    })
})
