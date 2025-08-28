/**
 * `BehaviorConfig.standard()` is the default for the MarkupEditor. It can be overridden by 
 * passing a new BehaviorConfig when instantiating the MarkupEditor.
 * 
 * To customize the behavior config, for example, in your index.html:
 * 
 *    let behaviorConfig = MU.BehaviorConfig.desktop();    // Use the desktop editor config as a baseline
 *    const markupEditor = new MU.MarkupEditor(
 *      document.querySelector('#editor'),
 *      {
 *        html: '<h1>Hello, world!</h1>',
 *        behavior: behaviorConfig,
 *      }
 *    )
 */
export class BehaviorConfig {

    static all = {
        "focusAfterLoad": true,     // Whether the editor should take focus after loading
        "selectImage": false,       // Whether to show a "Select..." button in the Insert Image dialog
        "insertLink": false,        // Whether to defer to the MarkupDelegate rather than use the default LinkDialog
        "insertImage": false,       // Whether to defer to the MarkupDelagate rather than use the default ImageDialog
    }

    static standard() { 
        return this.all
    }

    static desktop() { 
        let desktop = this.all
        desktop.selectImage = true
        return desktop
    }

}