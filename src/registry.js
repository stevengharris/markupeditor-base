/**
 * The global registry used to hold _editors, _delegates, _configs, 
 * _augmentations, and to track the active muId (of which there can be 
 * only one, generally set by focus/blur but sometimes by toolbar actions.
 * 
 * The registry is a singleton global but is only accessed via the methods exported 
 * here.
 */
class MURegistry {
    constructor() {
        this._editors = new Map()
        this._delegates = new Map()
        this._configs = new Map()
        this._augmentations = new Map()
        this._activeMuId = null
    }

    /** Private method to set `activeMuId`. */
    _setActiveMuId(muId) {
        this._activeMuId = muId
    }

    /**
     * Add the `editor` to the registry.
     * 
     * When we register an editor, it becomes the active editor, so 
     * `activeMuId` is always set initially.
     */
    registerEditor(editor) {
        this._editors.set(editor.muId, editor)
        this._setActiveMuId(editor.muId)
    }

    /** Remove the `editor` from the registry. */
    unregisterEditor(editor) {
        delete this._editors.delete(editor.muId)
    }
    
    /** Return the editor with `muId` of `this._activeMuId`. */
    activeEditor() {
        return this._editors.get(this._activeMuId)
    }

    /** Add the `delegate` to the registry. */
    registerDelegate(delegate) {
        this._delegates.set(delegate.constructor.name, delegate)
    }

    /** Remove the `delegate` from the registry. */
    unregisterDelegate(delegate) {
        this._delegates.delete(delegate.constructor.name)
    }

    /** Return the `delegate` with `name`. */
    getDelegate(name) {
        return this._delegates.get(name)
    }

    /** Add the `config` to the registry. */
    registerConfig(config) {
        this._configs.set(config.constructor.name, config)
    }

    /** Remove the config from the registry. */
    unregisterConfig(config) {
        this._configs.delete(config.constructor.name)
    }

    /** Return the `config` with `name`. */
    getConfig(name) {
        return this._configs.get(name)
    }

    /** 
     * Add the `augmentation` to the registry.
     * An augmentation is a toolbar that holds `cmdItems` that can 
     * either be prepended or appended to the normal MarkupEditor toolbar.
     */
    registerAugmentation(toolbar) {
        this._augmentations.set(toolbar.constructor.name, toolbar)
    }

    /** Remove the `augmentation` from the registry. */
    unregisterAugmentation(toolbar) {
        this._augmentations.delete(toolbar.constructor.name)
    }

    /**
     * Return the `augmentation` toolbar whose `menuItems` will be 
     * either prepended or appended to the normal MarkupEditor toolbar.
     */
    getAugmentation(name) {
        return this._augmentations.get(name)
    }

    /** Return the active editor's `view`. */
    activeView() {
        return this.activeEditor()?.view
    }

    /** Set `activeMuId` based on the `view` (whose root has `muId`). */
    setActiveView(view) {
        this.setActiveDocument(view?.root)
    }

    /** Return the active editor's `document` (could be the shadow root). */
    activeDocument() {
        return this.activeEditor()?.element.getRootNode()
    }

    /** Set `activeMuId` based on the `document` (could be shadow root). */
    setActiveDocument(document) {
        this._setActiveMuId(document?.muId)
    }

    /** Return the active editor's `messageHandler`. */
    activeMessageHandler() {
        return this.activeEditor()?.messageHandler
    }
    
    /** Return the active editor's instance of Searcher, `searcher`. */
    activeSearcher() {
        return this.activeEditor()?.searcher
    }

    /** Return the active editor's `config`. */
    activeConfig() {
        return this.activeEditor()?.config
    }

    /** Return the cached ID of the selected contentEditable element. */
    selectedID() {
        return this.activeEditor()?.selectedID
    }

    /** Set/cache the ID of the selected contentEditable element to `string`. */
    setSelectedID(string) {
        if (this.activeEditor()) this.activeEditor().selectedID = string
    }
}

/** Define the global _muRegistry instance and export methods that provide access to it. */
const _muRegistry = new MURegistry()
export const registerEditor = _muRegistry.registerEditor.bind(_muRegistry)
export const unregisterEditor = _muRegistry.unregisterEditor.bind(_muRegistry)
export const registerDelegate = _muRegistry.registerDelegate.bind(_muRegistry)
export const unregisterDelegate = _muRegistry.unregisterDelegate.bind(_muRegistry)
export const getDelegate = _muRegistry.getDelegate.bind(_muRegistry)
export const registerConfig = _muRegistry.registerConfig.bind(_muRegistry)
export const unregisterConfig = _muRegistry.unregisterConfig.bind(_muRegistry)
export const getConfig = _muRegistry.getConfig.bind(_muRegistry)
export const registerAugmentation = _muRegistry.registerAugmentation.bind(_muRegistry)
export const unregisterAugmentation = _muRegistry.unregisterAugmentation.bind(_muRegistry)
export const getAugmentation = _muRegistry.getAugmentation.bind(_muRegistry)
export const activeEditor = _muRegistry.activeEditor.bind(_muRegistry)
export const activeView = _muRegistry.activeView.bind(_muRegistry)
export const setActiveView = _muRegistry.setActiveView.bind(_muRegistry)
export const activeDocument = _muRegistry.activeDocument.bind(_muRegistry)
export const setActiveDocument = _muRegistry.setActiveDocument.bind(_muRegistry)
export const activeMessageHandler = _muRegistry.activeMessageHandler.bind(_muRegistry)
export const activeSearcher = _muRegistry.activeSearcher.bind(_muRegistry)
export const activeConfig = _muRegistry.activeConfig.bind(_muRegistry)
export const selectedID = _muRegistry.selectedID.bind(_muRegistry)
export const setSelectedID = _muRegistry.setSelectedID.bind(_muRegistry)