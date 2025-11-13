class MyDelegate {
    markupInput(editor) {
        console.log('Input in ' + editor.muId)
    }
}

MU.registerDelegate(new MyDelegate())

class MyToolbarConfig {
    constructor() {
        Object.assign(this, MU.ToolbarConfig.standard())
        this.insertBar.tableMenu = false
    }
}

MU.registerConfig(new MyToolbarConfig())