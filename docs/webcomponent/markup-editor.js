/**
 * MarkupEditorElement is the Web Component for the MarkupEditor.
 * 
 * The lifecycle and resulting document structure is probably most interesting 
 * aspect of the MarkupEditor, especially when the HTML page can contain multiple 
 * MarkupEditorElements. The MarkupEditor "base" script should be loaded 
 * once in the `body` of the document that is using one or more MarkupEditorElements.
 * However, part of the beauty of Web Components is that they can hide the 
 * implementation details, and how/when to load the MarkupEditor base script
 * is definitely something the Web Component should shield users from.  f'input
 */
window.markupEditorScriptLoaded = window.markupEditorScriptLoaded || false; // Initialize if not already present

class MarkupEditorElement extends HTMLElement {

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

    // The `ready` event happens at a document level, and results in a
    // `muCallback` being dispatched to each MarkupEditorElement in the 
    // document. This MarkupEditorElement instance then calls `appendEditorStyle`
    // to load markupeditor.css, which has to be loaded for each instance 
    // of MarkupEditorElement, since the actual `editor` element (held as 
    // `this.editorContainer`) is in the shadow DOM.
    this.addEventListener('muCallback', (e) => {
      console.log(`muCallback(${e.message}) on MarkupEditorElement`)
      if (e.message == 'ready') {
        this.appendEditorStyle()
      } else {
        console.log(' Did nothing.')
      }
    })
    this.editorContainer.addEventListener('muCallback', (e) => {
      console.log(`muCallback(${e.message}) on editor`)
      if (e.message == 'loadedUserFiles') {
        this.createEditor()
      } else {
        console.log(' Did nothing.')
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
   * as well as remove it from the window.viewRegistry. The editor does this in 
   * its `destroy` method.
   */
  disconnectedCallback() {
    console.log("disconnectedCallback")
    this.editor.destroy();
	}

  /**
   * Append the MarkupEditor script to the body.
   * 
   * The MarkupEditor script will dispatch a muCallback('ready') to this instance 
   * that results in `appendEditorStyle` being called next. An `onload` listener 
   * for baseScript doesn't fire, so we have to use the one attached to `window` 
   * that exists in the MarkupEditor script itself.
   */
  appendEditorScript() {
    if (window.markupEditorScriptLoaded) return  // Only load it once
    window.markupEditorScriptLoaded = true
    console.log('appendEditorScript')
    const scriptPath = this.getAttribute('scriptpath')
    const baseScript = document.createElement('script')
    baseScript.setAttribute('src', `${scriptPath}/markupeditor.umd.js`)
    baseScript.addEventListener('load', this.loadedEditorScript.bind(this))
    document.body.appendChild(baseScript)
  }

  loadedEditorScript() {
    const webComponents = document.querySelectorAll('markup-editor')
    webComponents.forEach((element) => {
      this.dispatchMuCallback('ready', element)
    })
  }

  dispatchMuCallback(message, element) {
    const muCallback = new CustomEvent("muCallback")
    muCallback.message = message
    element.dispatchEvent(muCallback)
  }

  appendEditorStyle() {
    console.log('appendEditorStyle')
    const stylePath = this.getAttribute('stylepath')
    const link = document.createElement('link')
    link.setAttribute('href', `${stylePath}/markupeditor.css`)
    link.setAttribute('rel', 'stylesheet')
    const userCssFile = this.getAttribute('cssfile')
    link.onload = () => { MU.loadUserFiles(null, userCssFile, this.editorContainer) }
    this.editorContainer.appendChild(link)
  }

  async createEditor() {
    console.log('createEditor')
    const id = this.getAttribute('id')
    const html = this.getAttribute('html')
    const filename = this.getAttribute('filename')
    const placeholder = this.getAttribute('placeholder')
    const config = { id: id, html: html, filename: filename, placeholder: placeholder }
    this.editor = new MU.MarkupEditor(this.editorContainer, config)
    MU.setHTML(html, null, null, this.editor.view)
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}

class MessageHandler {
  postMessage(message) {
    console.log('Got message: ' + message)
  }
}

// Let the browser know about the custom element
customElements.define('markup-editor', MarkupEditorElement)
