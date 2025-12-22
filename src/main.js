import mirrorStyle from "../styles/mirror.css" with { type: "css" }
import markupStyle from "../styles/markup.css" with { type: "css" }
import toolbarStyle from "../styles/toolbar.css" with { type: "css" }
import { MU } from "./markupeditor.js"
export { MU }

/**
 * MarkupEditorElement is the Web Component for the MarkupEditor.
 * 
 * The lifecycle and resulting document structure are probably the most interesting 
 * aspects of the MarkupEditorElement, especially because the HTML page can   
 * contain multiple of them. The MarkupEditor "base" script should be loaded 
 * only once in the first (or only) MarkupEditorElement. It defines the global
 * `MU` along with the global `muRegistry` with exported methods to access it.
 * 
 * We use the `connectedCallback`, which is called for each MarkupEditorElement, 
 * to trigger appending the MarkupEditor base script only once. It's loaded into 
 * the first MarkupEditorElement, and produces the global `MU` that provides access
 * to all editor functionality regardless of where subsequent scripts are run.
 * When the base script finishes loading, we dispatch the `ready` `muCallback` 
 * event for each MarkupEditorElement instance in `document`. From that point, 
 * the MarkupEditor styling is appended to the `editor` set up for each individual 
 * MarkupEditorElement instance. Any user-supplied script and styling are also 
 * appended. Once those are appended (and even if they are not specified), the 
 * `loadedUserFiles` `muCallback` is dispatched for the `editorContainer`, and 
 * we can finally `createEditor` for the element and set its HTML contents.
 */
class MarkupEditorElement extends HTMLElement {

  /** 
   * Construct the MarkupEditorElement and set up the events to listen-to that 
   * drive loading of scripts, styles, configuration, and contents.
   */
  constructor() {
    super()   // Establish prototype chain

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
   * if it it specified and if the editor is running in an environment that 
   * has access to the file system (e.g., node.js, but not a browser).
   */
  createEditor() {
    const html = (this.innerHTML.length == 0) ? null : this.innerHTML
    const filename = this.getAttribute('filename')
    const config = { 
      id: this.getAttribute('id'),
      filename: filename, 
      html: html,
      base: this.getAttribute('base'),
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
    this.editor = new MU.MarkupEditor(this.editorContainer, config)
    
    // Let the delegate know the editor is ready
    //this.editor.config.delegate?.markupReady && this.editor.config.delegate?.markupReady()

    // Prepend and/or append any augmentations
    const prependItems = MU.getAugmentation(config.prepend)?.menuItems
    if (prependItems) MU.prependToolbar(prependItems)
    const appendItems = MU.getAugmentation(config.append)?.menuItems
    if (appendItems) MU.appendToolbar(appendItems)

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
