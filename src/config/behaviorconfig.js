/**
 * BehaviorConfig contains static utility methods to obtain a JavaScript object with properties 
 * that define the behavior configuration of the MarkupEditor. The class makes it convenient 
 * to write and use the utility methods, but an instance of BehaviorConfig itself is not meaningful.
 * 
 * `BehaviorConfig.standard()` is the default for the MarkupEditor. It can be overridden by 
 * passing a new BehaviorConfig by name using the `behavior` attribute of the `<markup-editor> `
 * element. You can use the pre-defined static methods like `standard()` and customize what 
 * it returns, or you can use your own BehaviorConfig.
 * 
 * To customize the behavior config, for example, in a `userscript` named `mybehavior.js`:
 * 
 * ```
 * import {MU} from "src/markup-editor.js"
 * let behaviorConfig = MU.BehaviorConfig.desktop()        // Use the desktop config as a baseline
 * MU.registerConfig(behaviorConfig, "MyBehaviorConfig")   // Register the instance by name so we can reference it
 * ```
 * 
 * Then, where you insert the `<markup-editor>` element, set the BehaviorConfig by name:
 * 
 * ```
 * <markup-editor userscript="mybehavior.js" behavior="MyBehaviorConfig">
 * ```
 *    
 * BehaviorConfig lets you control whether the editor takes focus immediately or not, and
 * allows you to defer to the MarkupDelegate for insert options, so you can use your own 
 * (perhaps "native") dialogs for file selection, link insertion, and image insertion.
 * 
 * The following properties are supported:
 * 
 * ```
 * {
 *    "focusAfterLoad": true,     // Whether the editor should take focus after loading
 *    "selectImage": false,       // Whether to show a "Select..." button in the Insert Image dialog
 *    "insertLink": false,        // Whether to defer to the MarkupDelegate rather than use the default LinkDialog
 *    "insertImage": false,       // Whether to defer to the MarkupDelagate rather than use the default ImageDialog
 * }
 * ```
 */
export class BehaviorConfig {

    /**
     * The private definition of all behavior config options used by the public static methods.
     * Needs to be a function not property for multiple editors.
     * 
     * If you add or modify these options, include those changes in the class doc above.
     * 
     * @ignore
     * @returns {object} A JavaScript object with all options enabled.
     */
    static _all() {
        return {
            "focusAfterLoad": true,     // Whether the editor should take focus after loading
            "selectImage": false,       // Whether to show a "Select..." button in the Insert Image dialog
            "insertLink": false,        // Whether to defer to the MarkupDelegate rather than use the default LinkDialog
            "insertImage": false,       // Whether to defer to the MarkupDelagate rather than use the default ImageDialog
        }
    }

    /**
     * Return a behavior configuration object, but defined from a stringified JSON object.
     * 
     * @param {string} string A stringified object, perhaps used as an external definition of a behavior configuration
     * @returns {object}      An object parsed from the JSON in `string`, should contain data for all properties
     */
    static fromJSON(string) {
        try {
            return JSON.parse(string)
        } catch {
            return null
        }
    }

    /**
     * Return a behavior configuration object with all options enabled.
     * 
     * @returns {object}     A JavaScript object with all options enabled.
     */
    static full() {
        return this._all()
    }

    /**
     * Return a default behavior configuration object.
     * 
     * @returns {object}     A JavaScript object with all settings.
     */
    static standard() { 
        return this._all()
    }

    /**
     * Return the desktop behavior configuration object. This is the same as `full()` but with `selectImage` enabled.
     * 
     * @returns {object}     A JavaScript object with settings for desktop-style usage.
     */
    static desktop() { 
        let desktop = this.full()
        desktop.selectImage = true
        return desktop
    }

}