import { describe, test, expect } from 'vitest'
import { cmdItem } from '../src/setup/menuitems.js'

describe('cmdItem: enable vs select derivation', () => {
    const cmd = () => true

    test('enable: true (explicit boolean) derives an enable check -- item greys out, stays visible', () => {
        const item = cmdItem(cmd, { title: 'x', enable: true })
        expect(typeof item.spec.enable).toBe('function')
        expect(item.spec.select).toBeUndefined()
    })

    test('enable omitted entirely derives a select check instead -- item is hidden, not greyed out', () => {
        const item = cmdItem(cmd, { title: 'x' })
        expect(item.spec.enable).toBeUndefined()
        expect(typeof item.spec.select).toBe('function')
    })

    test('an explicit enable function is preserved as-is, not overwritten', () => {
        const customEnable = () => false
        const item = cmdItem(cmd, { title: 'x', enable: customEnable })
        expect(item.spec.enable).toBe(customEnable)
    })

    test('an explicit select function is preserved as-is, not overwritten', () => {
        const customSelect = () => false
        const item = cmdItem(cmd, { title: 'x', select: customSelect })
        expect(item.spec.select).toBe(customSelect)
        expect(item.spec.enable).toBeUndefined()
    })
})
