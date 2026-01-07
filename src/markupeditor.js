// Needed locally by MarkupEditor class, but not part of MU
import {
    callbackInput,
    blurred,
    clicked,
    handleEnter,
    outermostOfTypeAt,
    resetSelectedID,
    selectionChanged,
} from "./markup.js"
import { ToolbarConfig } from "./config/toolbarconfig.js"
import { KeymapConfig } from "./config/keymapconfig.js"
import { BehaviorConfig } from "./config/behaviorconfig.js"
import { EditorView } from "prosemirror-view"
import { EditorState } from "prosemirror-state"
import { DOMParser } from "prosemirror-model"
import { schema } from "./schema/index.js"
import { markupSetup } from "./setup/index.js"
import { LinkView } from "./nodeview/linkview.js"
import { ImageView } from "./nodeview/imageview.js"
import { DivView } from "./nodeview/divview.js"
import { MessageHandler } from "./messagehandler.js"
import { Searcher } from "./searcher.js"

// Also needed for export in MU
import {
    addButton,
    addCol,
    addDiv,
    addHeader,
    addRow,
    borderTable,
    cancelSearch,
    consoleLog,
    cutImage,
    deactivateSearch,
    deleteLink,
    deleteTableArea,
    doRedo,
    doUndo,
    emptyDocument,
    focus,
    focused,
    focusOn,
    getDataImages,
    getHTML,
    getHeight,
    getImageAttributes,
    getLinkAttributes,
    getSelectionState,
    getTestHTML,
    indent,
    insertImage,
    insertLink,
    insertTable,
    loadUserFiles,
    modifyImage,
    outdent,
    padBottom,
    pasteHTML,
    pasteText,
    removeAllDivs,
    removeButton,
    removeDiv,
    resetSelection,
    savedDataImage,
    searchFor,
    setHTML,
    setStyle,
    setTestHTML,
    setTopLevelAttributes,
    testBlockquoteEnter,
    testExtractContents,
    testListEnter,
    testPasteHTMLPreprocessing,
    testPasteTextPreprocessing,
    toggleBold,
    toggleCode,
    toggleItalic,
    toggleListItem,
    toggleUnderline,
    toggleStrike,
    toggleSubscript,
    toggleSuperscript,
} from "./markup.js"
import {
    registerEditor,
    unregisterEditor,
    registerDelegate,
    getDelegate,
    registerConfig,
    getConfig,
    registerMessageHandler,
    getMessageHandler,
    registerAugmentation,
    activeView,
} from "./registry.js"
import {
    MenuItem,
    Dropdown,
    DropdownSubmenu,
    cmdItem,
    renderGrouped,
    renderDropdownItems
} from "./setup/menuitems.js"
import {
    toggleSearch,
    openLinkDialog,
    openImageDialog
} from "./setup/index.js"

/**
 * The MarkupEditor holds the properly set-up EditorView and any additional configuration.
 * 
 * @param {HTMLElement} target  The div that will contain the editor.
 * @param {Object}      config  The configuration object. See the Developer's Guide.
 */
export class MarkupEditor {
    constructor(target, config) {

        // We will be creating an EditorView in the `target` element, which should be a DIV
        // with `id` set to "editor".
        this.element = target ?? document.querySelector("#editor")

        // Make sure config always contains `toolbar`, `keymap`, and `behavior`.
        // The three configurations can be specified by string name that is 
        // dereferenced to an instance using `getConfig`, or by parsing JSON, 
        // or as an instance modeled on ToolbarConfig, KeymapConfig, or BehaviorConfig.
        // Why all the options? Because access to ToolbarConfig, and the registry 
        // require access to MU, which may not yet be available. And for VSCode, we 
        // want the config to come from the workspace configuration.
        this.config = config ?? {}

        // Toolbar configuration
        let toolbarConfig = this.config.toolbar
        if (toolbarConfig) {
            if (typeof toolbarConfig === 'string') {
                // If the toolbarConfig is something that can't be found (e.g., 'none'),
                // then set toolbar.visibility to false, which avoids creating a 
                // toolbar at all.
                this.config.toolbar = getConfig(toolbarConfig) ?? ToolbarConfig.fromJSON(toolbarConfig) ?? ToolbarConfig.none()
            } else {
                this.config.toolbar = toolbarConfig
            }
        } else {
            this.config.toolbar = ToolbarConfig.standard()
        }

        // Keymap configuration
        let keymapConfig = this.config.keymap
        if (keymapConfig) {
            if (typeof keymapConfig === 'string') {
                this.config.keymap = getConfig(keymapConfig) ?? KeymapConfig.fromJSON(keymapConfig) ?? KeymapConfig.standard()
            } else {
                this.config.keymap = keymapConfig
            }
        } else {
            this.config.keymap = KeymapConfig.standard()
        }

        // Behavior configuration
        let behaviorConfig = this.config.behavior
        if (behaviorConfig) {
            if (typeof behaviorConfig === 'string') {
                this.config.behavior = getConfig(behaviorConfig) ?? BehaviorConfig.fromJSON(behaviorConfig) ?? BehaviorConfig.standard()
            } else {
                this.config.behavior = behaviorConfig
            }
        } else {
            this.config.behavior = BehaviorConfig.standard()
        }

        // If `delegate` is supplied as a string, then dereference it to get the class from the Registry.
        let delegate = this.config.delegate
        if (delegate && (typeof delegate === 'string')) {
            this.config.delegate = getDelegate(delegate)
        }

        // Create the EditorView for this MarkupEditor
        this.view = new EditorView(this.element, {
            state: EditorState.create({
                // For the MarkupEditor, we can just use the editor element. 
                // There is no need to use a separate content element.
                doc: DOMParser.fromSchema(schema).parse(this.element),
                plugins: markupSetup(this.config, schema)
            }),
            nodeViews: {
                link(node, view, getPos) { return new LinkView(node, view, getPos) },
                image(node, view, getPos) { return new ImageView(node, view, getPos) },
                div(node, view, getPos) { return new DivView(node, view, getPos) },
            },
            // All text input makes callbacks to indicate the document state has changed.
            // For history, used handleTextInput, but that fires *before* input happens.
            // Note the `setTimeout` hack is used to have the function called after the change
            // for things things other than the `input` event.
            handleDOMEvents: {
                'input': () => { callbackInput(target) },
                'focus': () => { setTimeout(() => focused(target)) },
                'blur': () => { setTimeout(() => blurred(target)) },
                'cut': () => { setTimeout(() => { callbackInput(target) }, 0) },
                'click': (view) => { setTimeout(() => { clicked(view, target) }, 0) },
                'delete': () => { setTimeout(() => { callbackInput(target) }, 0) },
            },
            handlePaste() {
                setTimeout(() => { callbackInput(target) }, 0)
                return false
            },
            handleKeyDown(view, event) {
                switch (event.key) {
                    case 'Enter':
                    case 'Delete':
                    case 'Backspace':
                        { setTimeout(() => { handleEnter() }, 0) }
                }
                return false
            },
            // Use createSelectionBetween to handle selection and click both.
            // We need access to `this.editor` for `selectionChanged`.
            // We use it guard against selecting across divs.
            createSelectionBetween: this.createSelectionBetween.bind(this)
        })

        // The `messageHandler` is specific to this `editor` and is accessible from 
        // `activeMessageHandler()` or directly from an editor instance. It can 
        // be passed-in as a string that is dereferenced from the registry using 
        // `getMessageHandler` by name, or as an instance. In any case, the 
        // expectation is that there will be a MessageHandler of some kind to 
        // receive `postMessage`.
        let handler = this.config.handler
        if (handler) {
            if (typeof handler === 'string') {
                if (handler === 'swift') {
                    this.messageHandler = MessageHandler.swift
                } else {
                    this.messageHandler = getMessageHandler(handler) ?? new MessageHandler(this)
                }
            } else {
                this.messageHandler = handler
            }
        } else {
            this.messageHandler = new MessageHandler(this)
        }

        // Assign a the web component id or a generated `muId` to the shadow root. We can get 
        // `muId` from the `view.root.muId` if we have `view`, or directly from the `editor`.
        // Note `muId` is the same as the web component id if that is set.
        this.muId = config.id ?? this.generateMuId()
        this.view.root.muId = this.muId

        // Track the Searcher instance for this editor, using the same muId
        this.searcher = new Searcher()

        // Track the ID of the selected contentEditable element (relevant when 
        // there is more than one; otherwise is `editor` or null)
        this.selectedID = null

        // Finally, track the editor in the Registry.
        registerEditor(this)
    }

    createSelectionBetween(view, $anchor, $head) {
        const divType = view.state.schema.nodes.div;
        const range = $anchor.blockRange($head);
        // Find the divs that the anchor and head reside in.
        // Both, one, or none can be null.
        const fromDiv = outermostOfTypeAt(divType, range.$from);
        const toDiv = outermostOfTypeAt(divType, range.$to);
        // If selection is all within one div, then default occurs; else return existing selection
        if ((fromDiv || toDiv) && !$anchor.sameParent($head)) {
            if (fromDiv != toDiv) {
                return view.state.selection;    // Return the existing selection
            }
        };
        resetSelectedID(fromDiv?.attrs.id ?? toDiv?.attrs.id ?? null)  // Set the selectedID to the div's id or null.
        selectionChanged(this.element);
        // clicked(); // TODO: Removed, but is it needed in Swift MarkupEditor?
        return null;                        // Default behavior should occur
    }

    /* Return a string ID we can use for this MarkupEditor */
    generateMuId() {
        const timestamp = Date.now().toString(36); // Convert timestamp to base36
        const randomPart = Math.random().toString(36).substring(2, 7); // Add a short random string
        return timestamp + randomPart;
    }

    /**
     * Destroy the EditorView we are holding onto and remove it from the `Registry`.
     */
    destroy() {
        unregisterEditor(this)
        this.view.destroy()
    }
}

/**
 * The public MarkupEditor API callable as "MU.<function name>"
 */
export const MU = {
    activeView,
    addButton,
    addCol,
    addDiv,
    addHeader,
    addRow,
    borderTable,
    cancelSearch,
    consoleLog,
    cutImage,
    deactivateSearch,
    deleteLink,
    deleteTableArea,
    doRedo,
    doUndo,
    emptyDocument,
    focus,
    focusOn,
    focused,
    getDataImages,
    getHTML,
    getHeight,
    getImageAttributes,
    getLinkAttributes,
    getSelectionState,
    getTestHTML,
    indent,
    insertImage,
    insertLink,
    insertTable,
    loadUserFiles,
    modifyImage,
    openImageDialog,
    openLinkDialog,
    outdent,
    padBottom,
    pasteHTML,
    pasteText,
    removeAllDivs,
    removeButton,
    removeDiv,
    resetSelection,
    savedDataImage,
    searchFor,
    setHTML,
    setStyle,
    setTestHTML,
    setTopLevelAttributes,
    testBlockquoteEnter,
    testExtractContents,
    testListEnter,
    testPasteHTMLPreprocessing,
    testPasteTextPreprocessing,
    toggleBold,
    toggleCode,
    toggleItalic,
    toggleListItem,
    toggleStrike,
    toggleSubscript,
    toggleSuperscript,
    toggleUnderline,
    // Helpers to create custom toolbar items
    MenuItem,
    Dropdown,
    DropdownSubmenu,
    cmdItem,
    renderGrouped,
    renderDropdownItems,
    toggleSearch,
    // Config access
    ToolbarConfig,
    KeymapConfig,
    BehaviorConfig,
    // Registry access
    registerAugmentation,
    registerConfig,
    registerDelegate,
    registerMessageHandler,
}