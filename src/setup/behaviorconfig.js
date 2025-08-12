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

    static standard() { return {"selectImage": false} }

    static desktop() { return {"selectImage": true} }

}