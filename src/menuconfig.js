export class MenuConfig {
  constructor(visibility, insertBar, formatBar, styleMenu, styleBar, tableMenu) {
    this.visibility = visibility
    this.insertBar = insertBar
    this.formatBar = formatBar
    this.styleMenu = styleMenu
    this.styleBar = styleBar
    this.tableMenu = tableMenu
  }

  static standard() {
    return new MenuConfig(
      VisibilityConfig.standard(),
      InsertBarConfig.standard(),
      FormatBarConfig.standard(),
      StyleMenuConfig.standard(),
      StyleBarConfig.standard(),
      TableMenuConfig.standard()
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
    return new VisibilityConfig(true, false, true, true, true, true, true, true)
  }
}

class InsertBarConfig {
  constructor(link, image, table) {
    this.link = link
    this.image = image
    this.table = table
  }

  static standard() {
    return new InsertBarConfig(true, true, true)
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
    return new FormatBarConfig(true, true, true, true, true, false, false)
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
    return new StyleMenuConfig(true, true, true, true, true, true, true, true)
  }
}

class StyleBarConfig {
  constructor(list, dent) {
    this.list = list
    this.dent = dent
  }

  static standard() {
    return new StyleBarConfig(true, true)
  }
}

class TableMenuConfig {
  constructor(border, header) {
    this.border = border
    this.header = header
  }

  static standard() {
    return new TableMenuConfig(true, true)
  }
}
