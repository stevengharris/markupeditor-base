/**
 * `BehaviorConfig.standard()` is the default for the MarkupEditor. It can be overridden by 
 * passing a new BehaviorConfig by name using the `behavior` attribute of the <markup-editor> 
 * element. You can use the pre-defined static methods like `standard()` and customize what 
 * it returns, or you can use your own BehaviorConfig.
 * 
 * To customize the behavior config, for example, in a `userscript` named `mybehavior.js`:
 * 
 *      import {MU} from "src/markup-editor.js"
 *      let behaviorConfig = MU.BehaviorConfig.desktop()        // Use the desktop config as a baseline
 *      MU.registerConfig(behaviorConfig, "MyBehaviorConfig")   // Register the instance by name so we can reference it
 * 
 * Then, where you insert the <markup-editor> element, set the BehaviorConfig by name:
 * 
 *      <markup-editor userscript="mybehavior.js" behavior="MyBehaviorConfig">
 *    
 * BehaviorConfig lets you control whether the editor takes focus immediately or not, and
 * allows you to defer to the MarkupDelegate for insert options, so you can use your own 
 * (perhaps "native") dialogs for file selection, link insertion, and image insertion.
 */
export class BehaviorConfig {

    static _all() {                     // Needs to be a function not property for multiple editors
        return {
            "focusAfterLoad": true,     // Whether the editor should take focus after loading
            "selectImage": false,       // Whether to show a "Select..." button in the Insert Image dialog
            "insertLink": false,        // Whether to defer to the MarkupDelegate rather than use the default LinkDialog
            "insertImage": false,       // Whether to defer to the MarkupDelagate rather than use the default ImageDialog
        }
    }

    static fromJSON(string) {
        try {
            return JSON.parse(string)
        } catch {
            return null
        }
    }

    static standard() { 
        return this._all()
    }

    static desktop() { 
        let desktop = this._all()
        desktop.selectImage = true
        return desktop
    }

}