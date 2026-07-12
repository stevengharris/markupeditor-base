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

export { hljs }
