/**
 * `KeymapConfig.standard()` is the default for the MarkupEditor. It can be overridden by 
 * passing a new KeymapConfig by name using the `keymap` attribute of the <markup-editor> 
 * element. You can use the pre-defined static methods like `standard()` and customize what 
 * it returns, or you can use your own KeymapConfig.
 * 
 * To customize the key mapping, for example, in a `userscript` named `mykeymap.js`:
 * 
 *      import {MU} from "src/markup-editor.js"
 *      let keymapConfig = MU.KeymapConfig.standard();    // Grab the standard keymap config as a baseline
 *      keymapConfig.link = ["Ctrl-L", "Ctrl-l"];         // Use Control+L instead of Command+k
 *      MU.registerConfig(keymapConfig, "MyKeymapConfig") // Register the instance by name so we can reference it
 * 
 * Then, where you insert the <markup-editor> element, set the KeymapConfig by name:
 * 
 *      <markup-editor userscript="mykeymap.js" keymap="MyKeymapConfig">
 *    
 * Note that the key mapping will exist and work regardless of whether you disable a toolbar 
 * or a specific item in a menu. For example, undo/redo by default map to Mod-z/Shift-Mod-z even  
 * though the "correctionBar" is off by default in the MarkupEditor. You can remove a key mapping 
 * by setting its value to null or an empty string. 
 */
export class KeymapConfig {
    static _all() {                 // Needs to be a function not property for multiple editors
        return {
            // Correction
            "undo": "Mod-z",
            "redo": "Shift-Mod-z",
            // Insert
            "link": ["Mod-K", "Mod-k"],
            "image": ["Mod-G", "Mod-g"],
            //"table": ["Mod-T", "Mod-t"],  // Does not work anyway
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

    static fromJSON(string) {
        try {
            return JSON.parse(string)
        } catch {
            return null
        }
    }

    static full() {
        return this._all()
    }

    static standard() {
        return this.markdown()
    }

    static desktop() {
        return this.full()
    }

    static markdown() {
        let markdown = this.full()
        markdown.underline = null
        markdown.subscript = null
        markdown.superscript = null
        return markdown
    }
}