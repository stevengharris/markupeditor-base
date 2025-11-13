// Track a global indicating that the MarkupEditor base script was loaded
window.markupEditorScriptLoaded = window.markupEditorScriptLoaded || false; // Initialize if not already present

/**
 * MarkupEditorElement is the Web Component for the MarkupEditor.
 * 
 * The lifecycle and resulting document structure are probably most interesting 
 * aspects of the MarkupEditorElement, especially when the HTML page can contain  
 * multiple of them. The MarkupEditor "base" script should be loaded only
 * once in the first (or only) MarkupEditorElement. It defines the global `MU`
 * along with the global `muRegistry` with exported methods to access it.
 * 
 * We use the `connectedCallback`, which is called for each MarkupEditorElement, 
 * to trigger appending MarkupEditor base script only once. It's loaded into 
 * the first MarkupEditorElement, and produces the global MU the provides access
 * to all editor functionality regardless of where subsequent scripts are run.
 * When the base script finishes loading, we dispatch the `ready` `muCallback` 
 * event for each MarkupEditorElement instance in `document`. From that point, 
 * the MarkupEditor styling is appended for editor set up for each individual 
 * MarkupEditorElement instance. Any user-supplied script and styling are also 
 * appended. Once those are appended (and even if they are not specified), the 
 * `loadedUserFiles` `muCallback` is dispatched for the MarkupEditorElement 
 * instance, and we can finally `createEditor` for the element and set its HTML 
 * contents.
 */
class MarkupEditorElement extends HTMLElement {

  /** 
   * Construct the MarkupEditorElement and set up the events to listen-to that 
   * drive loading of scripts, styles, configuration, and contents.
   */
  constructor() {
    // Establish prototype chain
    super()

    // Attach shadow tree and hold onto root reference
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow
    const shadow = this.attachShadow({ mode: 'open' })

    // Create a container for the markup-editor component
    this.editorContainer = document.createElement('div')
    // Add a class to the container for the sake of clarity
    this.editorContainer.classList.add('markup-editor')
    this.editorContainer.setAttribute('id', 'editor')

    // The `muCallback` `ready` event is dispatched to *each* MarkupEditorElement 
    // in the document. Each MarkupEditorElement instance then calls 
    // `appendEditorStyle` to load `markupeditor.css`, which has to be loaded 
    // for each instance of MarkupEditorElement, since the actual `editor` 
    // element (i.e., `this.editorContainer`) is in the shadow DOM.

    // Have this MarkupEditorElement instance listen for the `ready` callback
    // that is dispatched from `loadedEditorScript`.
    this.addEventListener('muCallback', (e) => {
      console.log(`muCallback(${e.message}) on MarkupEditorElement`)
      switch (e.message) {
        case 'ready':
          this.appendEditorStyle()
          break
        default:
          console.log(' Did nothing.')
      }
    })

    // Have the `editorContainer` listen for callbacks from within the 
    // MarkupEditor base script, dispatched from `_callback`. Messages
    // other than `loadedUserFiles` are handled by the `messageHandler` 
    // for the `view`. This way a user can override `messageHandler` 
    this.editorContainer.addEventListener('muCallback', (e) => {
      console.log(`muCallback(${e.message}) on editorContainer`)
      switch (e.message) {
        case 'loadedUserFiles':
          this.createEditor()
          break
        default:
          this.editor.messageHandler.postMessage(e.message)
      }
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
    console.log("connectedCallback")
    this.appendEditorScript()
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
    console.log("disconnectedCallback")
    this.editor.destroy();
	}

  /**
   * Dispatch a `muCallback` event on `element`.
   * @param {String} message        The message (could be stringified JSON) to be dispatch to `element`
   * @param {HTMLElement} element   The HTMLElement that should be listening for `muCallback`.
   */
  dispatchMuCallback(message, element) {
    const muCallback = new CustomEvent("muCallback")
    muCallback.message = message
    element.dispatchEvent(muCallback)
  }

  /**
   * Append the MarkupEditor script to the body only once.
   * 
   * The MarkupEditor script will dispatch a muCallback('ready') to this instance 
   * that results in `appendEditorStyle` being called next.
   */
  appendEditorScript() {
    if (window.markupEditorScriptLoaded) return  // Only load it once
    window.markupEditorScriptLoaded = true
    console.log('appendEditorScript')
    const muScript = this.getAttribute('muScript') ?? './markupeditor.umd.js'
    const baseScript = document.createElement('script')
    baseScript.setAttribute('src', muScript)
    baseScript.addEventListener('load', this.loadedEditorScript.bind(this))
    this.editorContainer.appendChild(baseScript)
  }

  /**
   * The MarkupEditor base styling, markupeditor.css loaded.
   * 
   * Dispatch the `ready` `muCallback` to each MarkupEditorElement.
   * Called once after the MarkupEditor base script has loaded.
   */
  loadedEditorScript() {
    const webComponents = document.querySelectorAll('markup-editor')
    webComponents.forEach((element) => {
      this.dispatchMuCallback('ready', element)
    })
  }

  /**
   * Append the MarkupEditor styling to the `editorContainer`, because they should be styled independently 
   * of the document they are embedded in.
   * 
   * Upon loading, invoke `loadUserFiles` with any user-specified script and styling that will follow 
   * the MarkupEditor styling. The `loadUserFiles` results in a `loadedUserFiles` `muCallback` that 
   * (finally) creates the MarkupEditor and sets its HTML.
   */
  appendEditorStyle() {
    console.log('appendEditorStyle')
    const muStyle = this.getAttribute('mustyle') ?? './markupeditor.css'
    const link = document.createElement('link')
    link.setAttribute('href', muStyle)
    link.setAttribute('rel', 'stylesheet')
    const userStyle = this.getAttribute('userstyle')
    const userScript = this.getAttribute('userscript')
    link.onload = () => { MU.loadUserFiles(userScript, userStyle, this.editorContainer) }
    this.editorContainer.appendChild(link)
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
    console.log('createEditor')
    const config = { 
      filename: this.getAttribute('filename'), 
      placeholder: this.getAttribute('placeholder'), 
      delegate: this.getAttribute('delegate'),
      toolbar: this.getAttribute('toolbar'),
      behavior: this.getAttribute('behavior'),
      keymap: this.getAttribute('keymap')
     }
    this.editor = new MU.MarkupEditor(this.editorContainer, config)
    MU.setHTML(this.innerHTML, null, null, this.editor.view)
  }

}

// Let the browser know about the custom element
customElements.define('markup-editor', MarkupEditorElement)
