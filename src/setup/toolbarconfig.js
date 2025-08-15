/**
 * `ToolbarConfig.standard()` is the default for the MarkupEditor and is designed to correspond 
 * to GitHub flavored markdown. It can be overridden by passing it a new config when instantiating
 * the MarkupEditor. You can use the pre-defined static methods like `full` or customize what they 
 * return. The predefined statics each allow you to turn on or off the `correctionBar` visibility.
 * The `correctionBar` visibility is off by default, because while it's useful for touch devices 
 * without a keyboard, undo/redo are mapped to the hotkeys most people have in muscle memory.
 * 
 * To customize the menu bar, for example, in your index.html:
 * 
 *    let toolbarConfig = MU.ToolbarConfig.full(true);  // Grab the full toolbar, including correction, as a baseline
 *    toolbarConfig.insertBar.table = false;               // Turn off table insert
 *    const markupEditor = new MU.MarkupEditor(
 *      document.querySelector('#editor'),
 *      {
 *        html: '<h1>Hello, world!</h1>',
 *        toolbar: toolbarConfig,
 *      }
 *    )
 *    
 * Turn off entire toolbars and menus using the "visibility" settings. Turn off specific items
 * within a toolbar or menu using the settings specific to that toolbar or menu.
 */
export class ToolbarConfig {

  static all = {
    "visibility": {             // Control the visibility of toolbars, etc
      "toolbar": true,          // Whether the toolbar is visible at all
      "correctionBar": true,    // Whether the correction bar (undo/redo) is visible
      "insertBar": true,        // Whether the insert bar (link, image, table) is visible
      "styleMenu": true,        // Whether the style menu (p, h1-h6, code) is visible
      "styleBar": true,         // Whether the style bar (bullet/numbered lists) is visible
      "formatBar": true,        // Whether the format bar (b, i, u, etc) is visible
      "tableMenu": true,        // Whether the table menu (create, add, delete, border) is visible
      "search": true,           // Whether the search menu item (hide/show search bar) is visible
    },
    "insertBar": {
      "link": true,             // Whether the link menu item is visible
      "image": true,            // Whether the image menu item is visible
      "table": true,            // Whether the table menu is visible
    },
    "formatBar": {
      "bold": true,             // Whether the bold menu item is visible
      "italic": true,           // Whether the italic menu item is visible
      "underline": true,        // Whether the underline menu item is visible
      "code": true,             // Whether the code menu item is visible
      "strikethrough": true,    // Whether the strikethrough menu item is visible
      "subscript": true,        // Whether the subscript menu item is visible
      "superscript": true,      // Whether the superscript menu item is visible
    },
    "styleMenu": {
      "p": "Body",              // The label in the menu for "P" style
      "h1": "H1",               // The label in the menu for "H1" style
      "h2": "H2",               // The label in the menu for "H2" style
      "h3": "H3",               // The label in the menu for "H3" style
      "h4": "H4",               // The label in the menu for "H4" style
      "h5": "H5",               // The label in the menu for "H5" style
      "h6": "H6",               // The label in the menu for "H6" style
      "pre": "Code",            // The label in the menu for "PRE" aka code_block style
    },
    "styleBar": {
      "list": true,             // Whether bullet and numbered list items are visible
      "dent": true,             // Whether indent and outdent items are visible
    },
    "tableMenu": {
      "header": true,           // Whether the "Header" item is visible in the "Table->Add" menu
      "border": true,           // Whether the "Border" item is visible in the "Table" menu
    },
  }

  static full(correction=false) {
    let full = this.all
    full.visibility.correctionBar = correction
    return full
  }

  static standard(correction=false) {
    return this.markdown(correction)
  }

  static desktop(correction=false) {
    return this.full(correction)
  }

  static markdown(correction=false) {
    let markdown = this.full(correction)
    markdown.formatBar.underline = false
    markdown.formatBar.subscript = false
    markdown.formatBar.superscript = false
    return markdown
  }
}