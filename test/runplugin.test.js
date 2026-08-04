import { describe, test, expect, afterEach } from 'vitest'
import { registerPlugin, unregisterPlugin, runPlugin } from '../src/registry.js'
import { MU } from '../src/markupeditor.js'

// runPlugin is registry-level dispatch (not a document transform), so unlike most tests
// here it has no paired test/*.json fixture and no Swift Testing equivalent is expected.

describe('runPlugin', () => {

    const names = []
    afterEach(() => {
        while (names.length) unregisterPlugin(names.pop())
    })

    test('plugin registered with a run function: its resolved value is returned', async () => {
        const name = 'runplugin-test-with-run'
        names.push(name)
        registerPlugin({ name, type: 'exporter', run: async () => 'resolved-value' }, name)
        await expect(runPlugin(name)).resolves.toBe('resolved-value')
    })

    test('plugin registered without a run function: returns null', async () => {
        const name = 'runplugin-test-without-run'
        names.push(name)
        registerPlugin({ name, type: 'exporter' }, name)
        await expect(runPlugin(name)).resolves.toBeNull()
    })

    test('unknown name: returns null', async () => {
        await expect(runPlugin('runplugin-test-unknown-name')).resolves.toBeNull()
    })

    test('run() rejects: the rejection propagates, it is not swallowed into null', async () => {
        const name = 'runplugin-test-rejects'
        names.push(name)
        registerPlugin({ name, type: 'exporter', run: async () => { throw new Error('boom') } }, name)
        await expect(runPlugin(name)).rejects.toThrow('boom')
    })

    test('MU.runPlugin is reachable from the public API', () => {
        expect(typeof MU.runPlugin).toBe('function')
    })

})
