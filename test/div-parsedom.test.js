import { describe, test, expect } from 'vitest'
import { DOMParser as PMDOMParser } from 'prosemirror-model'
import { schema } from '../src/schema/index.js'

// The div node's parseDOM rule only runs when markup-editor.js constructs the
// initial EditorState from the <markup-editor> element's own light-DOM
// content (DOMParser.fromSchema(schema).parse(this.element)). setHTML/paste
// strip all divs before parsing regardless of this rule, so this test
// exercises the parser directly rather than through the vitest htmlTest
// fixture harness, which cannot reach this code path.
function parse(html) {
    const container = document.createElement('div')
    container.innerHTML = html
    return PMDOMParser.fromSchema(schema).parse(container)
}

describe('div node parseDOM', () => {
    test('a div with id, class, and parentId parses as a div node', () => {
        const doc = parse('<div id="section1" class="myclass" parentId="editor"><p>Hello world</p></div>')
        let divNode
        doc.descendants((node) => { if (node.type.name === 'div') divNode = node })
        expect(divNode).toBeDefined()
        expect(divNode.attrs.id).toBe('section1')
        expect(divNode.attrs.cssClass).toBe('myclass')
        expect(divNode.attrs.parentId).toBe('editor')
    })

    test('a div missing parentId does not parse as a div node', () => {
        const doc = parse('<div id="section1" class="myclass"><p>Hello world</p></div>')
        let divNode
        doc.descendants((node) => { if (node.type.name === 'div') divNode = node })
        expect(divNode).toBeUndefined()
    })
})
