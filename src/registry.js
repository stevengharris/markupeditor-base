/**
 * The registry used to hold delegates, configs, handlers, and
 * augmentations. Internally, the registry tracks the active `muId` 
 * (of which there can be only one, generally set by focus/blur but 
 * sometimes by toolbar actions). The `muId` is then used to identify 
 * the active view/editor/document.
 * 
 * The registry is a singleton but is only accessed via the methods exported 
 * here.
 * @ignore
 */
class Registry {
    constructor() {
        this._editors = new Map()
        this._delegates = new Map()
        this._configs = new Map()
        this._augmentations = new Map()
        this._handlers = new Map()
        this._activeMuId = null
    }

    /** 
     * Private method to set `activeMuId`. 
     */
    _setActiveMuId(muId) {
        this._activeMuId = muId
    }

    /**
     * Return the key that maps to the first value
     * 
     * @param {object}  value       The value we are 
     * @param {Map}     map         The Map we are doing the lookup in
     * @returns {string | null}     The key we found
     */
    _keyFor(value, map) {
        return [...map].find(([, val]) => value === val)[0]
    }

    /**
     * Add the `editor` to the registry.
     * 
     * When we register an editor, it becomes the active editor.
     * 
     * @param {MarkupEditor}  editor       The MarkupEditor to be added
     */
    registerEditor(editor) {
        this._editors.set(editor.muId, editor)
        this._setActiveMuId(editor.muId)
    }

    /** 
     * Remove the `editor` from the registry. 
     * 
     * @param {MarkupEditor}  editor       The MarkupEditor to be removed
     */
    unregisterEditor(editor) {
        delete this._editors.delete(editor.muId)
    }

    /** 
     * Return the active editor with `muId` of `this._activeMuId`. 
     */
    activeEditor() {
        return this._editors.get(this._activeMuId)
    }

    /** 
     * Add the `delegate` to the registry. 
     * If `name` is supplied, it is used to track it; else, 
     * the class of `delegate`, derived using `delegate.constructor.name`
     * is used.
     * 
     * @param {MarkupDelegate | object}     delegate    A MarkupDelegate or appropriate object.
     * @param {string}                      name        A name used to retrieve the `delegate`.
     */
    registerDelegate(delegate, name) {
        this._delegates.set(name ?? delegate.constructor.name, delegate)
    }

    /** 
     * Remove the `delegate` from the registry. 
     */
    unregisterDelegate(delegate, name) {
        const key = name ?? this._keyFor(delegate, this._delegates)
        this._delegates.delete(key)
    }

    /** Return the `delegate` with `name`. */
    getDelegate(name) {
        return this._delegates.get(name)
    }

    /** 
     * Add the `config` to the registry. 
     * If `name` is supplied, it is used to track it; else, 
     * the class of `config`, derived using `config.constructor.name`
     * is used.
     * 
     * @param {ToolbarConfig | KeymapConfig | BehaviorConfig | object}  config  One of the "configs" from the MarkupEditor API or appropriate object.
     * @param {string}                      name        A name used to retrieve the `config`.
     */
    registerConfig(config, name) {
        this._configs.set(name ?? config.constructor.name, config)
    }

    /** Remove the config from the registry. */
    unregisterConfig(config, name) {
        const key = name ?? this._keyFor(config, this._configs)
        this._configs.delete(key)
    }

    /** Return the `config` with `name`. */
    getConfig(name) {
        return this._configs.get(name)
    }

    /** 
     * Add the `handler` to the registry. 
     * If `name` is supplied, it is used to track it; else, 
     * the class of `handler`, derived using `handler.constructor.name`
     * is used.
     * 
     * @param {MessageHandler | object}  handler  An instance of MessageHandler or appropriate object.
     * @param {string}                   name     A name used to retrieve the `config`.
     */
    registerMessageHandler(handler, name) {
        this._handlers.set(name ?? handler.constructor.name, handler)
    }

    /** Remove the `handler` from the registry. */
    unregisterMessageHandler(handler, name) {
        const key = name ?? this._keyFor(handler, this._handlers)
        this._handlers.delete(key)
    }

    /** Return the `handler` with `name`. */
    getMessageHandler(name) {
        return this._handlers.get(name)
    }

    /** 
     * Add the `toolbar` to the registry.
     * A toolbar holds `cmdItems` that can either be prepended or appended to 
     * the normal MarkupEditor toolbar.
     * 
     * If `name` is supplied, it is used to track it; else, 
     * the class of `toolbar`, derived using `toolbar.constructor.name`
     * is used.
     * 
     * @param {object}  toolbar     A toolbar that holds `cmdItems`.
     * @param {string}  name        A name used to retrieve the `toolbar`.
     */
    registerAugmentation(toolbar, name) {
        this._augmentations.set(name ?? toolbar.constructor.name, toolbar)
    }

    /** Remove the `toolbar` augmentation from the registry. */
    unregisterAugmentation(toolbar, name) {
        const key = name ?? this._keyFor(toolbar, this._augmentations)
        this._augmentations.delete(key)
    }

    /**
     * Return the `toolbar` whose `menuItems` will be 
     * either prepended or appended to the normal MarkupEditor toolbar.
     */
    getAugmentation(name) {
        return this._augmentations.get(name)
    }

    /** Return the active editor's `view`. 
     * 
     * @returns {EditorView | null}    The ProseMirror Editor view that is currently active
     */
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

    /** Return the `editor` that is active (typically with focus).*/
    activeEditorElement() {
        return this.activeEditor()?.element
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

/** 
 * Define the global registry instance and export methods that provide access to it. 
 * Only the register* methods are part of the public MarkupEditor API.
 * 
 * @ignore
 */
const _registry = new Registry()

/** 
 * Return the active editor's configurations as one object keyed to the config type. 
 * 
 * @returns {object | null}    Object containing {"toolbar": ToolbarConfig, "keymap": KeymapConfig, "behavior": BehaviorConfig}.
 */
export function activeConfig() {_registry.activeConfig.bind(_registry)()}

/** 
 * Return the active editor's `view`. 
 * 
 * @returns {EditorView | null}    The ProseMirror EditorView that is currently active.
 */
export function activeView() {return _registry.activeView.bind(_registry)()}

/** 
 * Add the `toolbar` to the registry.
 * A toolbar holds `cmdItems` that can either be prepended or appended to 
 * the normal MarkupEditor toolbar.
 * 
 * If `name` is supplied, it is used to track it; else, 
 * the class of `toolbar`, derived using `toolbar.constructor.name`
 * is used.
 * 
 * @param {object}  toolbar     A toolbar that holds `cmdItems`.
 * @param {string}  name        A name used to retrieve the `toolbar`.
 */
export function registerAugmentation(toolbar, name) {_registry.registerAugmentation.bind(_registry)(toolbar, name)}

/** 
 * Add the `config` to the registry. 
 * If `name` is supplied, it is used to track it; else, 
 * the class of `config`, derived using `config.constructor.name`
 * is used.
 * 
 * @param {ToolbarConfig | KeymapConfig | BehaviorConfig | object}  config  One of the "configs" from the MarkupEditor API or appropriate object.
 * @param {string}                      name        A name used to retrieve the `config`.
 */
export function registerConfig(config, name) {_registry.registerConfig.bind(_registry)(config, name)}

/** 
 * Add the `delegate` to the registry. 
 * If `name` is supplied, it is used to track it; else, 
 * the class of `delegate`, derived using `delegate.constructor.name`
 * is used.
 * 
 * @param {MarkupDelegate | object}     delegate    A MarkupDelegate or appropriate object.
 * @param {string}                      name        A name used to retrieve the `delegate`.
 */
export function registerDelegate(delegate, name) {_registry.registerDelegate.bind(_registry)(delegate, name)}


/** 
 * Add the `handler` to the registry. 
 * If `name` is supplied, it is used to track it; else, 
 * the class of `handler`, derived using `handler.constructor.name`
 * is used.
 * 
 * @param {MessageHandler | object}  handler  An instance of MessageHandler or appropriate object.
 * @param {string}                   name     A name used to retrieve the `config`.
 */
export function registerMessageHandler(handler, name) {_registry.registerMessageHandler.bind(_registry)(handler, name)}

export const registerEditor = _registry.registerEditor.bind(_registry)
export const unregisterEditor = _registry.unregisterEditor.bind(_registry)
export const unregisterDelegate = _registry.unregisterDelegate.bind(_registry)
export const getDelegate = _registry.getDelegate.bind(_registry)
export const unregisterConfig = _registry.unregisterConfig.bind(_registry)
export const getConfig = _registry.getConfig.bind(_registry)
export const unregisterMessageHandler = _registry.unregisterMessageHandler.bind(_registry)
export const getMessageHandler = _registry.getMessageHandler.bind(_registry)
export const unregisterAugmentation = _registry.unregisterAugmentation.bind(_registry)
export const getAugmentation = _registry.getAugmentation.bind(_registry)
export const activeEditor = _registry.activeEditor.bind(_registry)
export const setActiveView = _registry.setActiveView.bind(_registry)
export const activeDocument = _registry.activeDocument.bind(_registry)
export const setActiveDocument = _registry.setActiveDocument.bind(_registry)
export const activeEditorElement = _registry.activeEditorElement.bind(_registry)
export const activeMessageHandler = _registry.activeMessageHandler.bind(_registry)
export const activeSearcher = _registry.activeSearcher.bind(_registry)
export const selectedID = _registry.selectedID.bind(_registry)
export const setSelectedID = _registry.setSelectedID.bind(_registry)