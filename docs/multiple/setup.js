class MyDelegate {
    markupInput(editor) {
        console.log('Input in ' + editor.muId)
    }
}

MU.registerDelegate(new MyDelegate())

class MyToolbarConfig {
    constructor() {
        Object.assign(this, MU.ToolbarConfig.standard())
        this.visibility.correctionBar = true
        this.visibility.search = false
        this.insertBar.tableMenu = false
        this.insertBar.image = false
        this.formatBar.underline = true
    }
}

MU.registerConfig(new MyToolbarConfig())