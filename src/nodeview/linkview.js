import {nodeWithId, selectionChanged} from "../markup"
import {TextSelection} from "prosemirror-state"

export class LinkView {
    constructor(node, view) {
        let href = node.attrs.href
        let title = '\u2325+Click to follow\n' + href
        const link = document.createElement('a')
        link.setAttribute('href', href)
        link.setAttribute('title', title)
        link.addEventListener('click', (ev)=> {
            if (ev.altKey) {
                if (href.startsWith('#')) {
                    let id = href.substring(1)
                    let {pos} = nodeWithId(id, view.state)
                    if (pos) {
                        let resolvedPos = view.state.tr.doc.resolve(pos)
                        let selection = TextSelection.near(resolvedPos)
                        let transaction = view.state.tr
                            .setSelection(selection)
                            .scrollIntoView()
                        view.dispatch(transaction)
                        selectionChanged()
                    }
                } else {
                    window.open(href)
                }
            }
        })
        this.dom = link
        this.contentDOM = this.dom
    }
}