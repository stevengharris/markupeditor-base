/**
 * Define a `customMenuConfig` object that controls which toolbars and menus are visible in the 
 * MarkupEditor, and the contents of each one. The `customMenuConfig` provided below shows all 
 * menu bars and options, whereas the `standardMenuBar` in `setup/index.j`s suppresses some elements. 
 * To customize the menu bar, load this file as a script before the rolled-up MarkupEditor script.
 * For example, in your index.html:
 * 
 *   <script src="menuconfig.js"></script>
 *   <script src="markupeditor.umd.js"></script>
 * 
 * Turn off entire toolbars and menus using the "visibility" settings. Turn off specific items
 * within a toolbar or menu using the settings specific to that toolbar or menu. Change the 
 * hotkey mappings for the various menu items using "keymap". Note that the key mapping will 
 * exist and work regardless of whether you disable a toolbar or a specific item. For example, 
 * undo/redo by default map to Mod-z/Shift-Mod-z even though the "correctionBar" is off by 
 * default in the MarkupEditor. You can remove a key mapping by settings its value to an empty
 * string.
 */
const customMenuConfig = {
  "visibility": {             // Control the visibility of toolbars, etc
    "toolbar": true,          // Whether the toolbar is visible at all
    "correctionBar": true,    // Whether the correction bar (undo/redo) is visible
    "insertBar": true,        // Whether the insert bar (link, image, table) is visible
    "styleMenu": true,        // Whether the style menu (p, h1-h6, code) is visible
    "styleBar": true,         // Whether the style bar (bullet/numbered lists) is visible
    "formatBar": true,        // Whether the format bar (b, i, u, etc) is visible
    "tableMenu": true,        // Whether the table menu (create, add, delete, border) is visible
    "search": true            // Whether the search menu item (hide/show search bar) is visible
  }, 
  "insertBar": { 
    "link": true,             // Whether the link menu item is visible
    "image": true,            // Whether the image menu item is visible
    "table": true             // Whether the table menu is visible
  }, 
  "formatBar": { 
    "bold": true,             // Whether the bold menu item is visible
    "italic": true,           // Whether the italic menu item is visible
    "underline": true,        // Whether the underline menu item is visible
    "code": true,             // Whether the code menu item is visible
    "strikethrough": true,    // Whether the strikethrough menu item is visible
    "subscript": true,        // Whether the subscript menu item is visible
    "superscript": true       // Whether the superscript menu item is visible
  }, 
  "styleMenu": { 
    "p": true, 
    "h1": true, 
    "h2": true, 
    "h3": true, 
    "h4": true, 
    "h5": true, 
    "h6": true, 
    "codeblock": true 
  }, 
  "styleBar": { 
    "list": true, 
    "dent": true 
  }, 
  "tableMenu": { 
    "border": true, 
    "header": true 
  }, 
  "keymap": { 
    "bold": ["Mod-b", "Mod-B"], 
    "italic": ["Mod-i", "Mod-I"], 
    "underline": ["Mod-u", "Mod-U"], 
    "code": "Mod-`", 
    "strikethrough": "Ctrl-Mod-x", 
    "subscript": "Ctrl-Mod--", 
    "superscript": "Ctrl-Mod-+", 
    "undo": "Mod-z", 
    "redo": "Shift-Mod-z", 
    "bullet": "Mod-.", 
    "number": "Shift-Mod-.", 
    "indent": ["Mod-]", "Mod->"], 
    "outdent": ["Mod-[", "Mod-<"], 
    "link": ["Mod-k", "Mod-K"], 
    "image": "", 
    "table": "", 
    "search": "Shift-Mod-F" 
  }
}
