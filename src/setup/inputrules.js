/* eslint no-cond-assign: 0 */
import {inputRules, wrappingInputRule, textblockTypeInputRule, InputRule} from "prosemirror-inputrules"

// : (NodeType) → InputRule
// Given a blockquote node type, returns an input rule that turns `"> "`
// at the start of a textblock into a blockquote.
export function blockQuoteRule(nodeType) {
  return wrappingInputRule(/^\s*>\s$/, nodeType)
}

// : (NodeType) → InputRule
// Given a list node type, returns an input rule that turns a number
// followed by a dot at the start of a textblock into an ordered list.
export function orderedListRule(nodeType) {
  return wrappingInputRule(/^(\d+)\.\s$/, nodeType, match => ({order: +match[1]}),
                           (match, node) => node.childCount + node.attrs.order == +match[1])
}

// : (NodeType) → InputRule
// Given a list node type, returns an input rule that turns a bullet
// (dash, plush, or asterisk) at the start of a textblock into a
// bullet list.
export function bulletListRule(nodeType) {
  return wrappingInputRule(/^\s*([-+*])\s$/, nodeType)
}

// : (NodeType) → InputRule
// Given a code block node type, returns an input rule that turns a
// textblock starting with three backticks into a code block.
export function codeBlockRule(nodeType) {
  return textblockTypeInputRule(/^```$/, nodeType)
}

// : (NodeType, number) → InputRule
// Given a node type and a maximum level, creates an input rule that
// turns up to that number of `#` characters followed by a space at
// the start of a textblock into a heading whose level corresponds to
// the number of `#` signs.
export function headingRule(nodeType, maxLevel) {
  return textblockTypeInputRule(new RegExp("^(#{1," + maxLevel + "})\\s$"),
                                nodeType, match => ({level: match[1].length}))
}

// : (RegExp, MarkType, number, number) → InputRule
// Given a regexp matching a markdown emphasis pattern ending at the
// cursor, a mark type, and the lengths of the opening and closing
// delimiters, returns an input rule that deletes only the
// delimiters -- never the content between them -- and applies the
// mark over the untouched range. This preserves any marks (links,
// nested emphasis, etc.) already present in the converted range
// instead of flattening it to plain text.
//
// prosemirror-inputrules invokes this handler from handleTextInput,
// before the browser's pending keystroke has actually been applied
// to the document -- match[0] (built from existing text plus the
// not-yet-inserted text) can therefore be longer than end - start.
// That trailing slice is inserted first so the full matched range
// genuinely exists in the document before the delimiter surgery
// below operates on it. Suppressed when the cursor already sits
// inside a code mark, since markdown shorthand characters are meant
// to stay literal there. Clears the mark from stored marks afterward
// so text typed immediately after the conversion does not inherit
// it.
//
// The leading delimiter is deleted before the trailing one, so the
// transaction's last content-shifting step is the trailing-delimiter
// delete, ending at the cursor -- prosemirror-history's grouping
// heuristic only looks at that step's range when deciding whether
// the next keystroke belongs to the same undo group (addMark's own
// step contributes no range there), so ending at the cursor is what
// keeps immediately-following typing (e.g. "**foo**bar") merged with
// the conversion into a single undo.
function markInputRule(regexp, markType, openLen, closeLen) {
  return new InputRule(regexp, (state, match, start, end) => {
    const codeType = state.schema.marks.code
    if (codeType && state.doc.resolve(start).marks().some(mark => mark.type === codeType)) return null
    const tr = state.tr
    const fullEnd = start + match[0].length
    if (fullEnd > end) tr.insertText(match[0].slice(end - start), end)
    tr.delete(start, start + openLen)
    const closeStart = fullEnd - openLen - closeLen
    tr.delete(closeStart, closeStart + closeLen)
    tr.addMark(start, closeStart, markType.create())
    tr.removeStoredMark(markType)
    return tr
  })
}

// : (MarkType) → InputRule
// Given the strong mark type, returns an input rule that converts
// `**text**` at the cursor into bold.
export function strongRule(markType) {
  return markInputRule(/\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, markType, 2, 2)
}

// : (MarkType) → InputRule
// Given the em mark type, returns an input rule that converts
// `*text*` at the cursor into italic. The negative lookbehind on the
// opening `*` defers matching until a preceding, still-unconsumed
// `*` is no longer in the way, so this rule does not fire on a
// partially typed `**text**` before bold's closing marker
// completes.
export function emStarRule(markType) {
  return markInputRule(/(?<!\*)\*([^*\s](?:[^*]*[^*\s])?)\*$/, markType, 1, 1)
}

// : (MarkType) → InputRule
// Given the em mark type, returns an input rule that converts
// `_text_` at the cursor into italic. The negative lookbehind on the
// opening `_` blocks intraword underscores (`\w` includes `_`), per
// CommonMark's flanking rule for `_` emphasis -- unlike `*`, `_`
// emphasis must not fire inside a word, so identifiers like
// `snake_case_name` stay literal.
export function emUnderscoreRule(markType) {
  return markInputRule(/(?<!\w)_([^_\s](?:[^_]*[^_\s])?)_$/, markType, 1, 1)
}

// : (MarkType) → InputRule
// Given the code mark type, returns an input rule that converts a
// backtick-delimited `text` at the cursor into inline code.
export function codeRule(markType) {
  return markInputRule(/(?<!`)`([^`\s](?:[^`]*[^`\s])?)`$/, markType, 1, 1)
}

// : (MarkType) → InputRule
// Given the s (strikethrough) mark type, returns an input rule that
// converts `~~text~~` at the cursor into strikethrough. No
// self-referential lookbehind, matching strongRule -- both are
// double-delimiter patterns with no single-character sibling rule to
// defer against, unlike emStarRule's genuine need to defer to bold.
export function strikethroughRule(markType) {
  return markInputRule(/~~([^~\s](?:[^~]*[^~\s])?)~~$/, markType, 2, 2)
}

// : (Schema, object) → Plugin
// A set of input rules for creating the basic block quotes, lists,
// code blocks, heading, and markdown formatting shorthand (bold,
// italic, inline code, strikethrough). All ten rules are gated
// together by config.behavior.markdownShorthand. config defaults to
// {}, so markdownShorthand defaults to enabled (only an explicit
// `false` turns it off) when buildInputRules is called without a
// config, matching BehaviorConfig's default.
export function buildInputRules(schema, config = {}) {
  let rules = [], type
  const markdownShorthand = config.behavior?.markdownShorthand !== false
  if (markdownShorthand) {
    if (type = schema.nodes.blockquote) rules.push(blockQuoteRule(type))
    if (type = schema.nodes.ordered_list) rules.push(orderedListRule(type))
    if (type = schema.nodes.bullet_list) rules.push(bulletListRule(type))
    if (type = schema.nodes.code_block) rules.push(codeBlockRule(type))
    if (type = schema.nodes.heading) rules.push(headingRule(type, 6))
    if (type = schema.marks.strong) rules.push(strongRule(type))
    if (type = schema.marks.em) {
      rules.push(emStarRule(type))
      rules.push(emUnderscoreRule(type))
    }
    if (type = schema.marks.code) rules.push(codeRule(type))
    if (type = schema.marks.s) rules.push(strikethroughRule(type))
  }
  return inputRules({rules})
}
