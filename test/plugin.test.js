import { describe, test, beforeAll, afterEach, expect, vi } from 'vitest'
import { setDocument, MU } from './setup.js'

beforeAll(setDocument)

describe('Plugin registry', () => {

    test('registerPlugin stores a plugin and getPluginManifest returns its public surface', () => {
        const plugin = {
            id: 'test-plugin',
            name: 'Test Plugin',
            extension: 'tp',
            export: async (content) => content,
            import: async (content) => content,
        }
        MU.registerPlugin(plugin, 'Test Plugin')
        const manifest = MU.getPluginManifest()
        const entry = manifest.find(m => m.id === 'test-plugin')
        expect(entry).toBeDefined()
        expect(entry.id).toBe('test-plugin')
        expect(entry.name).toBe('Test Plugin')
        expect(entry.extension).toBe('tp')
        expect(entry.export).toBeUndefined()
        expect(entry.import).toBeUndefined()
    })

    test('getPluginManifest returns only { id, name, extension } — no function references', () => {
        const manifest = MU.getPluginManifest()
        for (const entry of manifest) {
            expect(Object.keys(entry).sort()).toEqual(['extension', 'id', 'name'])
        }
    })

    test('invokePlugin dispatches to the named plugin action', async () => {
        const plugin = {
            id: 'action-plugin',
            name: 'Action Plugin',
            extension: 'ap',
            export: async (content) => `exported:${content}`,
            import: async (content) => `imported:${content}`,
        }
        MU.registerPlugin(plugin, 'Action Plugin')
        const result = await MU.invokePlugin('Action Plugin', 'export', 'hello')
        expect(result).toBe('exported:hello')
    })

    test('invokePlugin returns null for unknown plugin name', async () => {
        const result = await MU.invokePlugin('NoSuchPlugin', 'export', 'x')
        expect(result).toBeNull()
    })

    test('invokePlugin returns null when action is not defined on plugin', async () => {
        const plugin = {
            id: 'no-action-plugin',
            name: 'No Action Plugin',
            extension: 'nap',
        }
        MU.registerPlugin(plugin, 'No Action Plugin')
        const result = await MU.invokePlugin('No Action Plugin', 'export', 'x')
        expect(result).toBeNull()
    })

})

describe('loadPlugins', () => {

    afterEach(() => vi.restoreAllMocks())

    test('loadPlugins with no plugin paths is a no-op — delegate not called', async () => {
        const delegate = { markupPluginsDidLoad: vi.fn() }
        await MU.loadPlugins([], delegate, (path) => Promise.resolve())
        expect(delegate.markupPluginsDidLoad).not.toHaveBeenCalled()
    })

    test('loadPlugins with valid plugins calls markupPluginsDidLoad with loaded manifests', async () => {
        const delegate = { markupPluginsDidLoad: vi.fn() }
        // Mock importer: registers a plugin as a side effect (as a real plugin module would)
        const importFn = (path) => {
            MU.registerPlugin({
                id: 'load-test-plugin',
                name: 'Load Test Plugin',
                extension: 'ltp',
                export: async (c) => c,
            }, 'Load Test Plugin')
            return Promise.resolve({})
        }
        await MU.loadPlugins(['/plugins/load-test-plugin.js'], delegate, importFn)
        expect(delegate.markupPluginsDidLoad).toHaveBeenCalledOnce()
        const manifests = delegate.markupPluginsDidLoad.mock.calls[0][0]
        expect(Array.isArray(manifests)).toBe(true)
        const entry = manifests.find(m => m.id === 'load-test-plugin')
        expect(entry).toBeDefined()
        expect(entry.name).toBe('Load Test Plugin')
        expect(entry.extension).toBe('ltp')
    })

    test('loadPlugins with a failing import does not prevent markupPluginsDidLoad from firing', async () => {
        const delegate = { markupPluginsDidLoad: vi.fn() }
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const importFn = (path) => Promise.reject(new Error('module not found'))
        // Should resolve without throwing even though the import fails
        await expect(MU.loadPlugins(['/plugins/missing.js'], delegate, importFn)).resolves.toBeUndefined()
        // markupPluginsDidLoad fires with empty array (no successful plugins)
        expect(delegate.markupPluginsDidLoad).toHaveBeenCalledOnce()
        const manifests = delegate.markupPluginsDidLoad.mock.calls[0][0]
        expect(manifests).toEqual([])
    })

    test('loadPlugins calls markupPluginsDidLoad with only successful manifests when one plugin fails', async () => {
        const delegate = { markupPluginsDidLoad: vi.fn() }
        vi.spyOn(console, 'error').mockImplementation(() => {})
        let callCount = 0
        const importFn = (path) => {
            callCount++
            if (path.includes('good')) {
                MU.registerPlugin({
                    id: 'partial-good-plugin',
                    name: 'Partial Good Plugin',
                    extension: 'pgp',
                }, 'Partial Good Plugin')
                return Promise.resolve({})
            } else {
                return Promise.reject(new Error('bad plugin'))
            }
        }
        await MU.loadPlugins(['/plugins/good.js', '/plugins/bad.js'], delegate, importFn)
        expect(delegate.markupPluginsDidLoad).toHaveBeenCalledOnce()
        const manifests = delegate.markupPluginsDidLoad.mock.calls[0][0]
        const goodEntry = manifests.find(m => m.id === 'partial-good-plugin')
        expect(goodEntry).toBeDefined()
        // The bad plugin should not appear in the manifests
        const badEntry = manifests.find(m => m.id === 'bad-plugin')
        expect(badEntry).toBeUndefined()
    })

    test('loadPlugins with null delegate does not throw', async () => {
        const importFn = (path) => Promise.resolve({})
        await expect(MU.loadPlugins(['/plugins/x.js'], null, importFn)).resolves.toBeUndefined()
    })

})
