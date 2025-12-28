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
 * within a toolbar or menu using the settings specific to that toolbar or menu. Customize 
 * left-to-right ordering using the "ordering" settings.
 */
export class ToolbarConfig {

  static _all() {                 // Needs to be a function not property for multiple editors
    return {
      "visibility": {             // Control the visibility of toolbars, etc
        "toolbar": true,          // Whether the toolbar is visible at all
        "correctionBar": true,    // Whether the correction bar (undo/redo) is visible
        "insertBar": true,        // Whether the insert bar (link, image, table) is visible
        "styleMenu": true,        // Whether the style menu (p, h1-h6, code) is visible
        "styleBar": true,         // Whether the style bar (bullet/numbered lists) is visible
        "formatBar": true,        // Whether the format bar (b, i, u, etc) is visible
        "search": true,           // Whether the search item (hide/show search bar) is visible
      },
      "ordering": {               // Control the ordering of toolbars, etc, ascending left-to-right
        "correctionBar": 10,      // Correction bar order if it is visible
        "insertBar": 20,          // Insert bar (link, image, table) order if it is visible
        "styleMenu": 30,          // Style menu (p, h1-h6, code) order if it is visible
        "styleBar": 40,           // Style bar (bullet/numbered lists) order if it is visible
        "formatBar": 50,          // Format bar (b, i, u, etc) order if it is visible
        "search": 60,             // Search item (hide/show search bar) order if it is visible
      },
      "insertBar": {
        "link": true,             // Whether the link menu item is visible
        "image": true,            // Whether the image menu item is visible
        "tableMenu": true,        // Whether the table menu is visible
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
      "augmentation": {
        "prepend": null,          // Name of a registered array of cmdItems to prepend
        "append": null            // Name of a registered array of cmdItems to append
      },
      "icons": {
        // <span class="material-icons-outlined">undo</span>
        "undo": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>',
        // <span class="material-icons-outlined">redo</span>
        "redo": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>',
        // <span class="material-icons-outlined">format_bold</span>
        "strong": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>',
        // <span class="material-icons-outlined">format_italic</span>
        "em": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M200-200v-100h160l120-360H320v-100h400v100H580L460-300h140v100H200Z"/></svg>',
        // <span class="material-icons-outlined">format_underlined</span>
        "u": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M200-120v-80h560v80H200Zm280-160q-101 0-157-63t-56-167v-330h103v336q0 56 28 91t82 35q54 0 82-35t28-91v-336h103v330q0 104-56 167t-157 63Z"/></svg>',
        // <span class="material-icons-outlined">strikethrough_s</span>
        "s": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M486-160q-76 0-135-45t-85-123l88-38q14 48 48.5 79t85.5 31q42 0 76-20t34-64q0-18-7-33t-19-27h112q5 14 7.5 28.5T694-340q0 86-61.5 133T486-160ZM80-480v-80h800v80H80Zm402-326q66 0 115.5 32.5T674-674l-88 39q-9-29-33.5-52T484-710q-41 0-68 18.5T386-640h-96q2-69 54.5-117.5T482-806Z"/></svg>',
        // <span class="material-icons-outlined">data_object</span>
        "code": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M560-160v-80h120q17 0 28.5-11.5T720-280v-80q0-38 22-69t58-44v-14q-36-13-58-44t-22-69v-80q0-17-11.5-28.5T680-720H560v-80h120q50 0 85 35t35 85v80q0 17 11.5 28.5T840-560h40v160h-40q-17 0-28.5 11.5T800-360v80q0 50-35 85t-85 35H560Zm-280 0q-50 0-85-35t-35-85v-80q0-17-11.5-28.5T120-400H80v-160h40q17 0 28.5-11.5T160-600v-80q0-50 35-85t85-35h120v80H280q-17 0-28.5 11.5T240-680v80q0 38-22 69t-58 44v14q36 13 58 44t22 69v80q0 17 11.5 28.5T280-240h120v80H280Z"/></svg>',
        // <span class="material-icons-outlined">subscript</span>
        "sub": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M760-160v-80q0-17 11.5-28.5T800-280h80v-40H760v-40h120q17 0 28.5 11.5T920-320v40q0 17-11.5 28.5T880-240h-80v40h120v40H760Zm-525-80 185-291-172-269h106l124 200h4l123-200h107L539-531l186 291H618L482-457h-4L342-240H235Z"/></svg>',
        // <span class="material-icons-outlined">superscript</span>
        "sup": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M760-600v-80q0-17 11.5-28.5T800-720h80v-40H760v-40h120q17 0 28.5 11.5T920-760v40q0 17-11.5 28.5T880-680h-80v40h120v40H760ZM235-160l185-291-172-269h106l124 200h4l123-200h107L539-451l186 291H618L482-377h-4L342-160H235Z"/></svg>',
        // <span class="material-icons-outlined">link</span>
        "link": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"/></svg>',
        // <span class="material-icons-outlined">image</span>
        "image": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z"/></svg>',
        // <span class="material-icons-outlined">table</span>
        "table": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm240-240H200v160h240v-160Zm80 0v160h240v-160H520Zm-80-80v-160H200v160h240Zm80 0h240v-160H520v160ZM200-680h560v-80H200v80Z"/></svg>',
        // <span class="material-icons-outlined">format_list_bulleted</span>
        "bulletList": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M360-200v-80h480v80H360Zm0-240v-80h480v80H360Zm0-240v-80h480v80H360ZM200-160q-33 0-56.5-23.5T120-240q0-33 23.5-56.5T200-320q33 0 56.5 23.5T280-240q0 33-23.5 56.5T200-160Zm0-240q-33 0-56.5-23.5T120-480q0-33 23.5-56.5T200-560q33 0 56.5 23.5T280-480q0 33-23.5 56.5T200-400Zm0-240q-33 0-56.5-23.5T120-720q0-33 23.5-56.5T200-800q33 0 56.5 23.5T280-720q0 33-23.5 56.5T200-640Z"/></svg>',
        // <span class="material-icons-outlined">format_list_numbered</span>
        "orderedList": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M120-80v-60h100v-30h-60v-60h60v-30H120v-60h120q17 0 28.5 11.5T280-280v40q0 17-11.5 28.5T240-200q17 0 28.5 11.5T280-160v40q0 17-11.5 28.5T240-80H120Zm0-280v-110q0-17 11.5-28.5T160-510h60v-30H120v-60h120q17 0 28.5 11.5T280-560v70q0 17-11.5 28.5T240-450h-60v30h100v60H120Zm60-280v-180h-60v-60h120v240h-60Zm180 440v-80h480v80H360Zm0-240v-80h480v80H360Zm0-240v-80h480v80H360Z"/></svg>',
        // <span class="material-icons-outlined">format_indent_increase</span>
        "blockquote": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M120-120v-80h720v80H120Zm320-160v-80h400v80H440Zm0-160v-80h400v80H440Zm0-160v-80h400v80H440ZM120-760v-80h720v80H120Zm0 440v-320l160 160-160 160Z"/></svg>',
        // <span class="material-icons-outlined">format_indent_decrease</span>
        "lift": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"><path d="M120-120v-80h720v80H120Zm320-160v-80h400v80H440Zm0-160v-80h400v80H440Zm0-160v-80h400v80H440ZM120-760v-80h720v80H120Zm160 440L120-480l160-160v320Z"/></svg>',
        // <span class="material-symbols-outlined">search</span>
        "search": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg>',
        // <span class="material-symbols-outlined">chevron_forward</span>
        "searchForward": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>',
        // <span class="material-symbols-outlined">chevron_backward</span>
        "searchBackward": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/></svg>',
        // <span class="material-symbols-outlined">match_case</span>
        "matchCase": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m131-252 165-440h79l165 440h-76l-39-112H247l-40 112h-76Zm139-176h131l-64-182h-4l-63 182Zm395 186q-51 0-81-27.5T554-342q0-44 34.5-72.5T677-443q23 0 45 4t38 11v-12q0-29-20.5-47T685-505q-23 0-42 9.5T610-468l-47-35q24-29 54.5-43t68.5-14q69 0 103 32.5t34 97.5v178h-63v-37h-4q-14 23-38 35t-53 12Zm12-54q35 0 59.5-24t24.5-56q-14-8-33.5-12.5T689-393q-32 0-50 14t-18 37q0 20 16 33t40 13Z"/></svg>',
        // <span class="material-symbols-outlined">format_paragraph</span>
        "paragraphStyle": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M360-160v-240q-83 0-141.5-58.5T160-600q0-83 58.5-141.5T360-800h360v80h-80v560h-80v-560H440v560h-80Z"/></svg>',
        // <span class="material-symbols-outlined">more_horiz</span>
        "more": '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M240-400q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm240 0q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm240 0q-33 0-56.5-23.5T640-480q0-33 23.5-56.5T720-560q33 0 56.5 23.5T800-480q0 33-23.5 56.5T720-400Z"/></svg>'
      }
    }
  }

  static fromJSON(string) {
    try {
      return JSON.parse(string)
    } catch {
      return null
    }
  }

  static iconFor(string) {
    return this._all().icons[string]
  }

  static full(correction=false) {
    let full = this._all()
    full.visibility.correctionBar = correction
    return full
  }

  static standard(correction=false) {
    return this.markdown(correction)
  }

  static desktop(correction=false) {
    return this.full(correction)
  }

  static none() {
    let none = this._all()
    none.visibility.toolbar = false
    return none
  }

  static markdown(correction=false) {
    let markdown = this.full(correction)
    markdown.formatBar.underline = false
    markdown.formatBar.subscript = false
    markdown.formatBar.superscript = false
    return markdown
  }
}