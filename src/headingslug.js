/**
 * Return the slug for a heading's `text` the way GitHub makes it: lowercase, keep alphabetic
 * characters, combining marks, decimal digits, connector punctuation (which includes `_`) and `-`,
 * and replace blanks with `-`. The slug is cut to 40 characters, counting characters rather than
 * UTF-16 units, just to avoid unwieldy IDs.
 *
 * @param {string} text     The text content of a heading
 * @returns {string}        The slug, which is empty if nothing in `text` is kept
 */
export function headingSlug(text) {
    const slug = text.toLowerCase()
        .replace(/[^\p{Alphabetic}\p{M}\p{Nd}\p{Pc} -]/gu, '')
        .replaceAll(' ', '-')
    return Array.from(slug).slice(0, 40).join('')
}

/**
 * Return the slugs for the headings with the `texts` given in document order, numbering repeats
 * the way GitHub does: the first heading with a slug gets it as-is, and later ones get `-1`, `-2`,
 * and so on. Every heading counts, whether or not anything links to it.
 *
 * @param {string[]} texts  The text content of every heading, in document order
 * @returns {string[]}      The slug for each of `texts`, in the same order
 */
export function headingSlugs(texts) {
    const seen = new Map()
    return texts.map(text => {
        const slug = headingSlug(text)
        const count = seen.get(slug) ?? 0
        seen.set(slug, count + 1)
        return count === 0 ? slug : slug + '-' + count.toString()
    })
}
