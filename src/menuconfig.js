export class MenuConfig {
  constructor(visibility, insertBar, formatBar, styleMenu, styleBar, tableMenu, keymap) {
    this.visibility = visibility
    this.insertBar = insertBar
    this.formatBar = formatBar
    this.styleMenu = styleMenu
    this.styleBar = styleBar
    this.tableMenu = tableMenu
    this.keymap = keymap
  }

  static standard() {
    return new MenuConfig(
      VisibilityConfig.standard(),
      InsertBarConfig.standard(),
      FormatBarConfig.standard(),
      StyleMenuConfig.standard(),
      StyleBarConfig.standard(),
      TableMenuConfig.standard(),
      KeymapConfig.standard()
    )
  }
}

class VisibilityConfig {
  constructor(toolbar, correctionBar, insertBar, styleMenu, styleBar, formatBar, tableMenu, search) {
    this.toolbar = toolbar
    this.correctionBar = correctionBar
    this.insertBar = insertBar
    this.styleMenu = styleMenu
    this.styleBar = styleBar
    this.formatBar = formatBar
    this.tableMenu = tableMenu
    this.search = search
  }

  /**
   * Return the standard VisibilityConfig, which shows everything except undo/redo and search.
   * @returns {VisibilityConfig}
   */
  static standard() {
    return new VisibilityConfig(
      true,   // toolbar overall
      false,  // correctionBar
      true,   // insertBar
      true,   // styleMenu
      true,   // styleBar
      true,   // formatBar
      true,   // tableMenu
      true    // search
    )
  }
}

class InsertBarConfig {
  constructor(link, image, table) {
    this.link = link
    this.image = image
    this.table = table
  }

  static standard() {
    return new InsertBarConfig(
      true,   // link
      true,   // image
      true    // table
    )
  }
}

class FormatBarConfig {
  constructor(bold, italic, underline, code, strikethrough, subscript, superscript) {
    this.bold = bold
    this.italic = italic
    this.underline = underline
    this.code = code
    this.strikethrough = strikethrough
    this.subscript = subscript
    this.superscript = superscript
  }

  static standard() {
    return new FormatBarConfig(
      true,   // bold
      true,   // italic
      true,   // underline
      true,   // code
      true,   // strikethrough
      false,  // subscript
      false   // superscript
    )
  }
}

class StyleMenuConfig {
  constructor (p, h1, h2, h3, h4, h5, h6, codeblock) {
    this.p = p
    this.h1 = h1
    this.h2 = h2
    this.h3 = h3
    this.h4 = h4
    this.h5 = h5
    this.h6 = h6
    this.codeblock = codeblock
  }

  static standard() {
    return new StyleMenuConfig(
      true,   // P
      true,   // H1
      true,   // H2
      true,   // H3
      true,   // H4
      true,   // H5
      true,   // H6
      true    // CODE
    )
  }
}

class StyleBarConfig {
  constructor(list, dent) {
    this.list = list
    this.dent = dent
  }

  static standard() {
    return new StyleBarConfig(
      true,   // list
      true    // dent
    )
  }
}

class TableMenuConfig {
  constructor(border, header) {
    this.border = border
    this.header = header
  }

  static standard() {
    return new TableMenuConfig(
      true,   // border
      true    // header
    )
  }
}

class KeymapConfig {
  constructor() {
    // Formatting
    this.bold = ["Mod-b", "Mod-B"]
    this.italic = ["Mod-i", "Mod-I"]
    this.underline = ["Mod-u", "Mod-U"]
    this.code = "Mod-`"
    this.strikethrough = "Ctrl-Mod-x"
    this.subscript = "Ctrl-Mod--"
    this.superscript = "Ctrl-Mod-+"
    // Correction
    this.undo = "Mod-z"
    this.redo = "Shift-Mod-z"
    // List types
    this.bullet = "Mod-."
    this.number = "Shift-Mod-."
    // Denting
    this.indent = ["Mod-]", "Mod->"]
    this.outdent = ["Mod-[", "Mod-<"]
    // Insert
    this.link = ["Mod-k", "Mod-K"]
    this.image = ""
    this.table = "" // TODO: If this is going to map to a key, the table sizer has to work independently
    // Search
    this.search = "Shift-Mod-F" // "Mod-f" in a browser also brings up the browser search function
  }

  static standard() {
    return new KeymapConfig()
  }
}
