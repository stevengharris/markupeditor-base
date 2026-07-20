// The curated "common" bundle registers ~34 languages in one import, avoiding
// a hand-maintained per-language import/registerLanguage list.
import hljs from 'highlight.js/lib/common'

/**
 * Whether `name` matches a registered language or one of its aliases.
 * Delegates to hljs.getLanguage, which lowercases internally and checks
 * both registered names and aliases, so this is case-insensitive and
 * alias-aware.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isRecognizedLanguage(name) {
    return !!hljs.getLanguage((name ?? '').trim())
}

/**
 * Return the distinct `language` values present among `doc`'s code_block nodes,
 * alphabetically sorted. Recomputed from a fresh walk of the document on every
 * call — no cache or index is maintained, since callers only need this at the
 * point a language-picker UI is opened, not kept live in the background.
 *
 * Deduplicates case-insensitively (lowercased), since language names are stored
 * as whatever a user typed into the free-text dialog and "Python"/"python" are
 * the same language for display/matching purposes, matching isRecognizedLanguage's
 * own case-insensitivity.
 *
 * @param {Node} doc  A ProseMirror document node.
 * @returns {string[]}
 */
export function presentCodeLanguages(doc) {
    const languages = new Set()
    doc.descendants((node) => {
        if (node.type.name === 'code_block' && node.attrs.language) {
            languages.add(node.attrs.language.toLowerCase())
        }
    })
    return Array.from(languages).sort()
}

// hljs never has classPrefix reconfigured elsewhere in this codebase, so this
// matches its own default. No public getter exists to read it back instead.
const HLJS_CLASS_PREFIX = 'hljs-'

// Mirrors hljs's internal (unexported) scopeToCSSClass so class strings here
// match what hljs's own HTML renderer would produce for the same scope name.
function scopeToClass(name, prefix) {
    if (name.startsWith('language:')) return name.replace('language:', 'language-')
    if (name.includes('.')) {
        const pieces = name.split('.')
        return [`${prefix}${pieces.shift()}`, ...pieces.map((piece, i) => `${piece}${'_'.repeat(i + 1)}`)].join(' ')
    }
    return `${prefix}${name}`
}

// Implements hljs's documented Renderer contract (addText/openNode/closeNode)
// for TokenTree.walk, tracking span positions instead of building HTML.
class SpanWalker {
    constructor(prefix) {
        this.prefix = prefix
        this.position = 0
        this.stack = []
        this.spans = []
    }

    addText(text) {
        this.position += text.length
    }

    openNode(node) {
        if (node.scope) this.stack.push({ scope: node.scope, from: this.position })
    }

    closeNode(node) {
        if (!node.scope) return
        const { scope, from } = this.stack.pop()
        this.spans.push({ from, to: this.position, class: scopeToClass(scope, this.prefix) })
    }
}

/**
 * {from, to, class} spans for `code` highlighted as `language`, via hljs's
 * own already-built token tree (result._emitter.walk) — no DOM involved.
 */
export function highlightSpans(code, language) {
    try {
        const result = hljs.highlight(code, { language, ignoreIllegals: true })
        const walker = new SpanWalker(HLJS_CLASS_PREFIX)
        result._emitter.walk(walker)
        return walker.spans
    } catch {
        return []
    }
}

export { hljs }
