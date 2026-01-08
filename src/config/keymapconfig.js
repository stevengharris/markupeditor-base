/**
 * KeymapConfig contains static utility methods to obtain a JavaScript object with properties 
 * that define the key mappingconfiguration of the MarkupEditor toolbar. The class makes it convenient 
 * to write and use the utility methods, but an instance of KeymapConfig itself is not meaningful.
 * 
 * `KeymapConfig.standard()` is the default for the MarkupEditor. It can be overridden by 
 * passing a new KeymapConfig by name using the `keymap` attribute of the `<markup-editor>` 
 * element. You can use the pre-defined static methods like `standard()` and customize what 
 * it returns, or you can use your own KeymapConfig.
 * 
 * To customize the key mapping, for example, in a `userscript` named `mykeymap.js`:
 * 
 * ```
 * import {MU} from "src/markup-editor.js"
 * let keymapConfig = MU.KeymapConfig.standard();    // Grab the standard keymap config as a baseline
 * keymapConfig.link = ["Ctrl-L", "Ctrl-l"];         // Use Control+L instead of Command+k
 * MU.registerConfig(keymapConfig, "MyKeymapConfig") // Register the instance by name so we can reference it
 * ```
 * 
 * Then, where you insert the `<markup-editor>` element, set the KeymapConfig by name:
 * 
 * ```
 * <markup-editor userscript="mykeymap.js" keymap="MyKeymapConfig">
 * ```
 *    
 * Note that the key mapping will exist and work regardless of whether you disable a toolbar 
 * or a specific item in a menu. For example, undo/redo by default map to Mod-z/Shift-Mod-z even  
 * though the "correctionBar" is off by default in the MarkupEditor. You can remove a key mapping 
 * by setting its value to null or an empty string. 
 * 
 * The following properties are supported:
 * 
 * ```
 * {
 *    // Correction
 *    "undo": "Mod-z",
 *    "redo": "Shift-Mod-z",
 *    // Insert
 *    "link": ["Mod-K", "Mod-k"],
 *    "image": ["Mod-G", "Mod-g"],
 *    //"table": ["Mod-T", "Mod-t"],  // Does not work
 *    // Stylemenu
 *    "p": "Ctrl-Shift-0",
 *    "h1": "Ctrl-Shift-1",
 *    "h2": "Ctrl-Shift-2",
 *    "h3": "Ctrl-Shift-3",
 *    "h4": "Ctrl-Shift-4",
 *    "h5": "Ctrl-Shift-5",
 *    "h6": "Ctrl-Shift-6",
 *    // Stylebar
 *    "bullet": ["Ctrl-U", "Ctrl-u"],
 *    "number": ["Ctrl-O", "Ctrl-o"],
 *    "indent": ["Mod-]", "Ctrl-q"],
 *    "outdent": ["Mod-[", "Shift-Ctrl-q"],
 *    // Format
 *    "bold": ["Mod-B", "Mod-b"],
 *    "italic": ["Mod-I", "Mod-i"],
 *    "underline": ["Mod-U", "Mod-u"],
 *    "strikethrough": ["Ctrl-S", "Ctrl-s"],
 *    "code": "Mod-`",
 *    "subscript": "Ctrl-Mod--",
 *    "superscript": "Ctrl-Mod-+",
 *    // Search
 *    "search": ["Ctrl-F", "Ctrl-f"],
 * }
 * ```
 */
export class KeymapConfig {

    /**
     * The private definition of all keymap config options used by the public static methods.
     * Needs to be a function not property for multiple editors.
     * 
     * If you add or modify these options, include those changes in the class doc above.
     * 
     * @ignore
     * @returns {object} A JavaScript object with all options enabled.
     */
    static _all() {
        return {
            // Correction
            "undo": "Mod-z",
            "redo": "Shift-Mod-z",
            // Insert
            "link": ["Mod-K", "Mod-k"],
            "image": ["Mod-G", "Mod-g"],
            //"table": ["Mod-T", "Mod-t"],  // Does not work
            // Stylemenu
            "p": "Ctrl-Shift-0",
            "h1": "Ctrl-Shift-1",
            "h2": "Ctrl-Shift-2",
            "h3": "Ctrl-Shift-3",
            "h4": "Ctrl-Shift-4",
            "h5": "Ctrl-Shift-5",
            "h6": "Ctrl-Shift-6",
            // Stylebar
            "bullet": ["Ctrl-U", "Ctrl-u"],
            "number": ["Ctrl-O", "Ctrl-o"],
            "indent": ["Mod-]", "Ctrl-q"],
            "outdent": ["Mod-[", "Shift-Ctrl-q"],
            // Format
            "bold": ["Mod-B", "Mod-b"],
            "italic": ["Mod-I", "Mod-i"],
            "underline": ["Mod-U", "Mod-u"],
            "strikethrough": ["Ctrl-S", "Ctrl-s"],
            "code": "Mod-`",
            "subscript": "Ctrl-Mod--",
            "superscript": "Ctrl-Mod-+",
            // Search
            "search": ["Ctrl-F", "Ctrl-f"],
        }
    }

    /**
     * Return a keymap configuration object, but defined from a stringified JSON object.
     * 
     * @param {string} string A stringified object, perhaps used as an external definition of a keymap configuration
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
     * Return a keymap configuration object with all options enabled.
     * 
     * @returns {object}     A JavaScript object with all options enabled.
     */
    static full() {
        return this._all()
    }

    /**
     * Return a default keymap configuration object, corresponding to Markdown.
     * 
     * @returns {object}     A JavaScript object with Markdown-oriented settings.
     */
    static standard() {
        return this.markdown()
    }

    /**
     * Return the desktop keymap configuration object. This is the same as `full()`.
     * 
     * @returns {object}     A JavaScript object with settings for desktop-style usage.
     */
    static desktop() {
        return this.full()
    }

    /**
     * Return the Markdown-oriented keymap configuration object.
     * This keymap excludes underline, and subscript/superscript.
     * 
     * @returns {object}     A keymap configuration object with Markdown-oriented settings.
     */
    static markdown() {
        let markdown = this.full()
        markdown.underline = null
        markdown.subscript = null
        markdown.superscript = null
        return markdown
    }
}