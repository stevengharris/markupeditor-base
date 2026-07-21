import { codeBlockAtSelection, setCodeLanguageCommand } from "../markup"
import { prefix, getToolbar } from "../domaccess.js"

// Approximate rendered height of the language overlay label (font-size 0.75rem +
// padding 2px 6px, styles/markup.css) — only used for the room-above check below,
// doesn't need to be pixel-exact.
const CODE_LANGUAGE_OVERLAY_HEIGHT = 24

/**
 * Whether there's room above `preDOM` (a code_block's own <pre> element) to show
 * the language overlay label there without it being pushed above the toolbar or
 * off-screen — if not, it should attach below instead. Read-only (getBoundingClientRect
 * only); must never write to preDOM.
 */
export function hasRoomAboveOverlay(view, preDOM) {
    if (!preDOM) return true
    const preRect = preDOM.getBoundingClientRect()
    const toolbarRect = getToolbar(view)?.getBoundingClientRect()
    const minTop = (toolbarRect?.bottom ?? 0) + CODE_LANGUAGE_OVERLAY_HEIGHT
    return preRect.top >= minTop
}

/**
 * NodeView for code_block. The language tab is a DOM sibling of contentDOM,
 * appended/removed by setActive. No selectNode/deselectNode — code_block
 * selection is a TextSelection inside its content, never a NodeSelection.
 *
 * Stores `view` directly rather than this codebase's activeView() lookup
 * (imageview.js): the tab's mousedown only ever fires from this view's own
 * DOM, so there's no cross-instance ambiguity to resolve.
 *
 * node.attrs.language only ever affects the tab's label and contentDOM's
 * class — never which code_block this applies to or how it's structured.
 */
export class CodeView {
    constructor(node, view, getPos, languageDialog) {
        this.view = view
        this.languageDialog = languageDialog
        this.dom = document.createElement('pre')
        this.contentDOM = document.createElement('code')
        this.dom.appendChild(this.contentDOM)
        // codeLanguageOverlayPlugin (setup/index.js) reads this via
        // view.nodeDOM(pos) to call setActive on the right instance — a plain
        // own-property, not a ProseMirror-internal one.
        this.dom.codeView = this
        this.syncLanguageClass(node)
        this.tab = this.buildTab()
        this.setTabLabel(node)
    }

    update(node) {
        if (node.type.name !== 'code_block') return false
        this.syncLanguageClass(node)
        this.setTabLabel(node)
        return true
    }

    // ProseMirror's default ignoreMutation is `!contentDOM && mutation.type !=
    // "selection"` — since code_block has a real contentDOM, that default
    // returns false for any mutation, including setActive's own
    // appendChild/removeChild of the tab (a dom child OUTSIDE contentDOM).
    // Without this override, that mutation reads as an unexpected external
    // change: the node gets marked dirty and rebuilt from scratch on the
    // next flush, destroying the tab it just added.
    ignoreMutation(mutation) {
        return mutation.type !== 'selection' && !this.contentDOM.contains(mutation.target)
    }

    // The tab sits outside contentDOM, a sibling in dom — mirrored by
    // ResizableImage.select()/deselect() inserting/removing resize-handle
    // spans in imageview.js. contentDOM's own rendered content is always
    // just the code text; appending or removing the tab never touches it.
    setActive(isActive) {
        if (isActive && !this.tab.isConnected) {
            this.tab.classList.toggle(prefix + '-code-language-overlay-below', !hasRoomAboveOverlay(this.view, this.dom))
            this.dom.appendChild(this.tab)
        } else if (!isActive && this.tab.isConnected) {
            this.dom.removeChild(this.tab)
        }
    }

    destroy() {
        this.dom.codeView = null
    }

    syncLanguageClass(node) {
        const language = node.attrs.language
        this.contentDOM.className = language ? `language-${language}` : ''
    }

    setTabLabel(node) {
        const language = node.attrs.language
        this.tab.textContent = language ? `Language: ${language.toLowerCase()}` : 'Language: none'
    }

    buildTab() {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = prefix + '-code-language-overlay'
        // Without this, the button is ambiguous to the browser's native cursor
        // placement as part of the code_block's editable text flow.
        button.contentEditable = 'false'
        button.addEventListener('mousedown', (e) => {
            e.preventDefault()
            const found = codeBlockAtSelection(this.view.state)
            this.languageDialog.open(this.view, found?.node.attrs.language ?? '', (entered) => {
                setCodeLanguageCommand(entered ? entered : null)(this.view.state, this.view.dispatch, this.view)
            })
        })
        return button
    }
}
