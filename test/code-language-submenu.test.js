import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { EditorState, NodeSelection, TextSelection } from 'prosemirror-state'
import { schema } from '../src/schema/index.js'
import { codeLanguageSubmenu } from '../src/setup/menuitems.js'
import { prefix } from '../src/domaccess.js'

function stateWithSelectionOnHr() {
    const dom = document.createElement('div')
    dom.innerHTML = '<p>before</p><hr/><p>after</p>'
    const doc = PMDOMParser.fromSchema(schema).parse(dom)
    let hrPos
    doc.descendants((node, pos) => { if (node.type.name === 'horizontal_rule') hrPos = pos })
    return EditorState.create({ doc, schema, selection: NodeSelection.create(doc, hrPos) })
}

function stateWithSelectionInFormattedParagraph() {
    const dom = document.createElement('div')
    dom.innerHTML = '<p><strong>bold text</strong></p>'
    const doc = PMDOMParser.fromSchema(schema).parse(dom)
    return EditorState.create({ doc, schema, selection: TextSelection.create(doc, 1) })
}

function stateWithSelectionInParagraph() {
    const dom = document.createElement('div')
    dom.innerHTML = '<p>hello</p>'
    const doc = PMDOMParser.fromSchema(schema).parse(dom)
    return EditorState.create({ doc, schema, selection: TextSelection.create(doc, 1) })
}

const disabledClass = prefix + '-menuitem-disabled'

describe('CodeLanguageSubmenu — enable state', () => {

    test('disabled (NodeSelection that cannot become a code_block)', () => {
        const view = { dom: document.createElement('div') }
        const { dom, update } = codeLanguageSubmenu({}, 'Code').render(view)
        update(stateWithSelectionOnHr())
        const label = dom.querySelector('.' + prefix + '-menu-submenu-label')
        expect(label.classList.contains(disabledClass)).toBe(true)
    })

    test('disabled (paragraph with formatted/marked text, matching setCodeLanguageCommand returning false)', () => {
        const view = { dom: document.createElement('div') }
        const { dom, update } = codeLanguageSubmenu({}, 'Code').render(view)
        update(stateWithSelectionInFormattedParagraph())
        const label = dom.querySelector('.' + prefix + '-menu-submenu-label')
        expect(label.classList.contains(disabledClass)).toBe(true)
    })

    test('enabled (plain unformatted paragraph)', () => {
        const view = { dom: document.createElement('div') }
        const { dom, update } = codeLanguageSubmenu({}, 'Code').render(view)
        update(stateWithSelectionInParagraph())
        const label = dom.querySelector('.' + prefix + '-menu-submenu-label')
        expect(label.classList.contains(disabledClass)).toBe(false)
    })

    test('disabled: clicking the label does not open the submenu', () => {
        const view = { dom: document.createElement('div') }
        const { dom, update } = codeLanguageSubmenu({}, 'Code').render(view)
        update(stateWithSelectionOnHr())
        const label = dom.querySelector('.' + prefix + '-menu-submenu-label')
        label.dispatchEvent(new window.Event('mousedown', { bubbles: true, cancelable: true }))
        const wrap = dom
        expect(wrap.classList.contains(prefix + '-menu-submenu-wrap-active')).toBe(false)
    })

    test('disabled: hovering does not populate the submenu items', () => {
        const view = { dom: document.createElement('div') }
        const { dom, update } = codeLanguageSubmenu({}, 'Code').render(view)
        update(stateWithSelectionOnHr())
        dom.dispatchEvent(new window.Event('mouseenter', { bubbles: false, cancelable: true }))
        const submenu = dom.querySelector('.' + prefix + '-menu-submenu')
        expect(submenu.children.length).toBe(0)
    })

    test('disabled: submenu is force-hidden via inline style, not left to CSS :hover alone', () => {
        // toolbar.css reveals .Markup-menu-submenu purely via
        // .Markup-menu-submenu-wrap:hover — a CSS rule the mouseenter/mousedown JS
        // guards can't stop. Only an inline display:none (which wins on specificity)
        // actually prevents the submenu from showing on hover while disabled.
        const view = { dom: document.createElement('div') }
        const { dom, update } = codeLanguageSubmenu({}, 'Code').render(view)
        update(stateWithSelectionOnHr())
        const submenu = dom.querySelector('.' + prefix + '-menu-submenu')
        expect(submenu.style.display).toBe('none')
    })

    test('previously-populated submenu (from an earlier enabled state) is still force-hidden once disabled', () => {
        const view = { dom: document.createElement('div') }
        const { dom, update } = codeLanguageSubmenu({}, 'Code').render(view)
        update(stateWithSelectionInParagraph())   // enabled
        const submenu = dom.querySelector('.' + prefix + '-menu-submenu')
        expect(submenu.style.display).toBe('')
        // Simulate stale content left over from an earlier successful rebuild() while
        // enabled, without going through rebuild() itself (it needs a real EditorView).
        submenu.appendChild(document.createElement('div'))
        update(stateWithSelectionOnHr())   // now disabled, stale items still in submenu.children
        expect(submenu.children.length).toBeGreaterThan(0)
        expect(submenu.style.display).toBe('none')
    })

})
