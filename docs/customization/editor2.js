import { MU } from "../src/markup-editor.js"

/**
 * A MarkupDelegate that will receive callbacks as the document state changes.
 */
class MyDelegate {
    markupInput() {
        console.log('Input received.')
    }
    
    // Other methods that will be invoked on the delegate if implemented here...
    // markupClicked() {}
    // markupDidFocus() {}
    // markupDidBlur() {}
    // markupError(code, message, info, alert) {}
    // markupReady() {}
    // markupImageAdded(src, divId) {}
    // markupInsertImage(state, dispatch, view) {}
    // markupInsertLink(state, dispatch, view) {}
    // markupSearched() {}
    // markupSelectionChanged() {}
    // markupSelectImage(state, dispatch, view) {}
    // markupUpdateHeight(height) {}

}

// Register the delegate so it can be looked up by name when the MarkupEditor instance is created.
MU.registerDelegate(new MyDelegate())

/**
 * A toolbar configuration based on modifications of `MU.ToolbarConfig.standard()`.
 */
class MyToolbarConfig {
    constructor() {
        Object.assign(this, MU.ToolbarConfig.standard())
        this.visibility.correctionBar = true    // Turn on undo/redo in the toolbar
        this.visibility.search = false          // Turn off search
        this.insertBar.tableMenu = false        // Turn off the ability to insert and edit tables
        this.insertBar.image = false            // Turn off the ability to insert images
        this.formatBar.underline = true         // Turn on underline formatting
    }
}

// Register an instance of MyToolbarConfig so it can be looked up by name when the MarkupEditor instance is created.
MU.registerConfig(new MyToolbarConfig())

/**
 * A behavior configuration based on modifications of `MU.BehaviorConfig.standard()`.
 */
class MyBehaviorConfig {
    constructor() {
        Object.assign(this, MU.BehaviorConfig.standard())
        this.focusAfterLoad = false
    }
}

// Register an instance of MyBehaviorConfig so it can be looked up by name when the MarkupEditor instance is created.
MU.registerConfig(new MyBehaviorConfig())