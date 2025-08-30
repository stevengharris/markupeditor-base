/**
 * `KeymapConfig.standard()` is the default for the MarkupEditor. It can be overridden by 
 * passing a new KeymapConfig when instantiating the MarkupEditor. You can use the pre-defined 
 * static methods like `standard()` or customize what it returns.
 * 
 * To customize the key mapping, for example, in your index.html:
 * 
 *    let keymapConfig = MU.KeymapConfig.standard();    // Grab the standard keymap config as a baseline
 *    keymapConfig.link = ["Ctrl-L", "Ctrl-l"];         // Use Control+L instead of Command+k
 *    const markupEditor = new MU.MarkupEditor(
 *      document.querySelector('#editor'),
 *      {
 *        html: '<h1>Hello, world!</h1>',
 *        keymap: keymapConfig,
 *      }
 *    )
 *    
 * Note that the key mapping will exist and work regardless of whether you disable a toolbar 
 * or a specific item in a menu. For example, undo/redo by default map to Mod-z/Shift-Mod-z even  
 * though the "correctionBar" is off by default in the MarkupEditor. You can remove a key mapping 
 * by setting its value to null or an empty string. 
 */
export class KeymapConfig {
    static all = {
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

    static full() {
        return this.all
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