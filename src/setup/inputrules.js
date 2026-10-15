/* eslint no-cond-assign: 0 */
import {inputRules, wrappingInputRule, textblockTypeInputRule, InputRule} from "prosemirror-inputrules"
import {closeHistory} from "prosemirror-history"
import {Plugin} from "prosemirror-state"
import {Decoration, DecorationSet} from "prosemirror-view"

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

// : (EditorState, Schema, Object) → ?{$from: ResolvedPos, language: ?string}
// Returns the paragraph position and language when the selection is a cursor
// at the end of a paragraph that holds only three backticks and an optional
// language name, as plain text. Returns null otherwise, including when
// markdownShorthand is off.
function pendingCodeFence(state, schema, config) {
  if (!schema.nodes.code_block || config.behavior?.markdownShorthand === false) return null
  const { $from, empty } = state.selection
  const paragraph = $from.parent
  if (!empty || paragraph.type !== schema.nodes.paragraph || $from.parentOffset !== paragraph.content.size) return null
  if (!paragraph.children.every(child => child.isText && child.marks.length === 0)) return null
  const match = /^```([\w+#.-]*)$/.exec(paragraph.textContent)
  return match ? { $from, language: match[1] || null } : null
}

// : (Schema, Object) → Command
// Returns a command, meant to be chained after the Enter key's other
// handlers, that turns a paragraph holding only three backticks and an
// optional language name, with the cursor at its end, into an empty code
// block with that language. The block is created empty, so typing after it
// starts on the first line. It does nothing when markdownShorthand is off.
export function codeFenceCommand(schema, config = {}) {
  return (state, dispatch) => {
    const pending = pendingCodeFence(state, schema, config)
    if (!pending) return false
    if (dispatch) {
      const { $from, language } = pending
      const tr = state.tr.delete($from.start(), $from.end())
      tr.setNodeMarkup($from.before(), schema.nodes.code_block, { language })
      dispatch(closeHistory(tr).scrollIntoView())
    }
    return true
  }
}

// : (Schema, Object) → Plugin
// Returns a plugin that styles the text of a pending code fence like inline
// code while Return would turn it into a code block. It only decorates the
// view; the document is not changed.
export function codeFenceHintPlugin(schema, config = {}) {
  return new Plugin({
    props: {
      decorations(state) {
        const pending = pendingCodeFence(state, schema, config)
        if (!pending) return null
        const { $from } = pending
        return DecorationSet.create(state.doc, [Decoration.inline($from.start(), $from.end(), { class: "code-fence-pending" })])
      }
    }
  })
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
// heading, and markdown formatting shorthand (bold,
// italic, inline code, strikethrough). All nine rules are gated
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
