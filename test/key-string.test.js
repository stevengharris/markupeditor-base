import { describe, test, expect } from 'vitest'
import { baseKeyString, keyString } from '../src/setup/menuitems.js'

describe('key hint text', () => {

  test('a letter key is shown in capitals', () => {
    expect(baseKeyString('bold', { bold: 'Mod-b' })).toBe('\u2318B')
    expect(baseKeyString('redo', { redo: 'Mod-Shift-z' })).toBe('\u2318\u21E7Z')
    expect(baseKeyString('x', { x: 'Ctrl-Alt-t' })).toBe('\u2303\u2325T')
  })

  test('a key that is not a single letter is left as written', () => {
    expect(baseKeyString('indent', { indent: 'Mod->' })).toBe('\u2318>')
    expect(baseKeyString('h1', { h1: 'Ctrl-Shift-3' })).toBe('\u2303\u21E73')
    expect(baseKeyString('x', { x: 'Mod-Backspace' })).toBe('\u2318Backspace')
  })

  test('the first of several bindings is used', () => {
    expect(baseKeyString('indent', { indent: ['Mod-]', 'Mod->'] })).toBe('\u2318]')
  })

  test('an unbound item has no hint', () => {
    expect(keyString('bold', {})).toBe('')
    expect(keyString('bold', { bold: 'Mod-b' })).toBe(' (\u2318B)')
  })
})
