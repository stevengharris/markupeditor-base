import mirrorStyle from "../styles/mirror.css" with { type: "css" }
import markupStyle from "../styles/markup.css" with { type: "css" }
import toolbarStyle from "../styles/toolbar.css" with { type: "css" }
import { MarkupEditor } from "./markupeditor.js"
import { getAugmentation } from "./registry.js"
import { appendToolbar, prependToolbar } from "./setup/index.js"
import { MU } from "./markupeditor.js"

/** The public MarkupEditor API callable as `MU.<function name>`. */
export { MU }

/**
 * A web component and API for WYSIWYG HTML editing. The element is available as `<markup-editor>`. The API is available using the element property `MU`.
 * 
 * @element markup-editor
 * 
 * @attr {string} placeholder - HTML that should be displayed when the editor is empty.
 * 
 * @attr {string} filename - An HTML file whose contents should be loaded for the initial contents of the editor. If you also supply HTML within the <markup-editor> itself (e.g., <markup-editor><p>Hello, world</p></markupeditor>), the content of filename will take precedence.
 * 
 * @attr {string} base - The relative path for image src attributes in the editor. By default, if `filename` is specified with a path, `base` will be set to the directory containing the file. For example, if filename is “demo/guide/guide.html”, `base` will be set to “demo/guide/” so that an image with `src=“myImage.png”` will load. If you want this image to load from the “resources” directory below "demo/guide", then set base to “demo/guide/resources/” (with a trailing slash).
 * 
 * @attr {string} userscript - A JavaScript file that should be loaded as a script within the <markup-editor> element. The script can reference the global MU for access to MarkupEditor functionality. For example, the script could contain code to create and register a MarkupDelegate to receive callbacks during editing, or define a custom ToolbarConfiguration. 
 * 
 * @attr {string} userstyle - A CSS file that should be linked within the <markup-editor> element to supplement the MarkupEditor base styling.
 * 
 * @attr {string} delegate - The name of a MarkupDelegate that has been registered. See the documentation on MarkupDelegates for details on implementation, usage, and registration.
 * 
 * @attr {string} handler - The name of a MessageHandler that has been registered. See the documemtation on MessageHandler for details.
 * 
 * @attr {string} toolbar - The name of a ToolbarConfig that has been registered. See the documentation on ToolbarConfig for details of customizing the toolbar configuration and registering configs.
 * 
 * @attr {string} keymap - The name of a KeymapConfig that has been registered. See the documentation on KeymapConfig for details of customizing the keymap configuration and registering configs.
 * 
 * @attr {string} behavior - The name of a BehaviorConfig that has been registered. See the documentation on BehaviorConfig for details of customizing the behavior configuration and registering configs.
 * 
 * @attr {string} prepend: The name of a toolbar that has been registered, whose `menuItems` will be placed before the MarkupToolbar. See the documentation on Extending the Toolbar for details.
 * 
 * @attr {string} append - The name of a toolbar that has been registered, whose `menuItems` will be placed after the MarkupToolbar. See the documentation on Extending the Toolbar for details.
 */
class MarkupEditorElement extends HTMLElement {

  /** 
   * Construct the MarkupEditorElement and set up the events to listen-to that 
   * drive loading of scripts, styles, configuration, and contents.
   */
  constructor() {
    super()   // Establish prototype chain

    /** The object whose methods comprise the MarkupEditor API. */
    this.MU

    /** The instance of MarkupEditor that holds onto configuration and a ProseMirror EditorView. 
     * @ignore 
     */
    this.editor

    /** The DIV that contains the editor in the shadow DOM.
     * @ignore
     */
    this.editorContainer

    /** The ShadowRoot for this element.
     * @ignore 
     */
    this.shadowRoot

    // Attach shadow tree and hold onto root reference
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow
    const shadow = this.attachShadow({ mode: 'open' })

    // Create a container for the markup-editor component
    this.editorContainer = document.createElement('div')
    // Add a class to the container for the sake of clarity
    this.editorContainer.classList.add('markup-editor')
    this.editorContainer.setAttribute('id', 'editor')

    // Have the `editorContainer` listen for callbacks from within the 
    // MarkupEditor base script, dispatched from `_callback`. The
    // `messageHandler` can be overridden (as it is for VSCode and 
    // Swift) so all document editing notifications can be dealt 
    // with in a custom way.
    // 
    // The first `muCallback` will be `loadedUserFiles`, which will 
    // cause the editor instance to be created before posting the 
    // message.
    this.editorContainer.addEventListener('muCallback', (e) => {
      if (!this.editor) this.createEditor()
      this.editor.messageHandler.postMessage(e.message)
    })

    // Append the container to the shadow DOM
    // The rest of the initialization happens in the `connectedCallback`
    shadow.appendChild(this.editorContainer)
  }

  /**
   * Fires after the MarkupEditorElement instance has been attached to the DOM.
   *  
   * If no MarkupEditorElement has yet been connected, we invoke `appendEditorScript`
   * to cause the MarkupEditor script, `markupeditor.umd.js`, to load at the end 
   * of `body`. This means the MarkupEditor script is loaded only once. When the 
   * MarkupEditorScript has loaded, it dispatches a `muCallback` event on each 
   * MarkupEditorElement in the `document`, which in turn creates a properly 
   * configured MarkupEditor instance.
   * 
   * @ignore
   */ 
  connectedCallback() {
    this.loadUserFiles()
  }

  /**
   * Fires when the MarkupEditorElement instance is removed from the DOM.
   * 
   * In the spirit of undoing what `connectedCallback` did, we have to destroy
   * the ProseMirror EditorView held by the MarkupEditor instance in `this.editor`
   * as well as remove it from the `window.viewRegistry`. The editor does this in 
   * its `destroy` method.
   * 
   * @ignore
   */
  disconnectedCallback() {
    this.editor.destroy();
	}

  /**
   * Load the CSS from `userstyle` and the script from `userscript`.
   * 
   * For the CSS, we append the CSSStyleSheet containing the fetched contents of the 
   * file specified in `userstyle` to the adoptedStyleSheets that along with
   * the three required styles already defined via import. Then we use the "standard" 
   * `MU.loadUserFiles` only specifying the `userScript`.
   * 
   * @ignore
   **/ 
  loadUserFiles() {
    const nonce = this.getAttribute('nonce')
    const userStyle = this.getAttribute('userstyle')
    if (userStyle) {
      fetch(userStyle)
        .then((response) => response.text())
        .then((text) => {
          // A fetch failure returns 'Cannot GET <filename with path>'
          let userSheet = new CSSStyleSheet()
          // replace all styles synchronously:
          userSheet.replaceSync(text)
          this.shadowRoot.adoptedStyleSheets = [mirrorStyle, markupStyle, toolbarStyle, userSheet]
        })
        .then(() => {
          const userScript = this.getAttribute('userscript')
          MU.loadUserFiles(userScript, null, this.editorContainer, nonce)
        })
        .catch((e) => {
          console.log(e)
        })
    } else {
      this.shadowRoot.adoptedStyleSheets = [mirrorStyle, markupStyle, toolbarStyle]
      const userScript = this.getAttribute('userscript')
      MU.loadUserFiles(userScript, null, this.editorContainer, nonce)
    }
  }

  /**
   * Create the MarkupEditor instance for this MarkupEditorElement.
   * 
   * Use the attributes from the <markup-editor> element to set up the 
   * configuration. Set the initial HTML based on the `innerHTML` for the 
   * <markup-editor> element, which will be overridden by `filename` contents 
   * if it is specified.
   * 
   * @ignore
   */
  createEditor() {
    const html = (this.innerHTML.length == 0) ? null : this.innerHTML
    const filename = this.getAttribute('filename')
    let base = this.getAttribute('base')
    // Set `base` based on `filename` automatically when `base` is null but `filename` 
    // is defined. The `filename` must include a "\" or "/", or `base` remains null.
    if (!base && filename && (filename.includes('/') || filename.includes('\\'))) {
      // Use a regex to match the last part (filename and extension) and replace 
      // it with an empty string, handline both forward and backward slashes.
      base = filename.replace(/[^/\\]*$/, '')
    }
    const config = { 
      id: this.getAttribute('id'),
      filename: filename, 
      html: html,
      base: base,
      placeholder: this.getAttribute('placeholder'), 
      delegate: this.getAttribute('delegate'),
      handler: this.getAttribute('handler'),
      toolbar: this.getAttribute('toolbar'),
      behavior: this.getAttribute('behavior'),
      keymap: this.getAttribute('keymap'),
      prepend: this.getAttribute('prepend'),
      append: this.getAttribute('append'),
    }

    // Create an editor instance and hold onto it here
    this.editor = new MarkupEditor(this.editorContainer, config)

    // Prepend and/or append any augmentations
    const prependItems = getAugmentation(config.prepend)?.menuItems
    if (prependItems) prependToolbar(prependItems)
    const appendItems = getAugmentation(config.append)?.menuItems
    if (appendItems) appendToolbar(appendItems)

    // Expose the MU API as a property of this element. In a well-behaved JavaScript 
    // modules world, we would not need to do this, but when using the web component 
    // in a Swift or Electron app, where we use IPC to invoke functionality via 
    // `executeJavaScript`, MU isn't properly importable. In this case, in a script, 
    // if we can locate the web component, then we can use its `MU` property to 
    // invoke MarkupEditor functionality. This is how a "native" menu in Electron 
    // and how a "native" SwiftUI toolbar in Swift invoke editing functionality.
    this.MU = MU
  }

}

// Let the browser know about the custom element
customElements.define('markup-editor', MarkupEditorElement)
