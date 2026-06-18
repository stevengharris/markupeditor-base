import mirrorStyle from "../styles/mirror.css" with { type: "css" }
import markupStyle from "../styles/markup.css" with { type: "css" }
import toolbarStyle from "../styles/toolbar.css" with { type: "css" }
import { MarkupEditor } from "./markupeditor.js"
import { getAugmentation } from "./registry.js"
import { appendToolbar, prependToolbar } from "./setup/index.js"
import { MU } from "./markupeditor.js"

/** The public MarkupEditor API callable as `MU.<function name>`. */
export { MU }

// Re-export prosemirror-model so plugins loaded alongside this bundle can
// import from it as an external rather than bundling their own copy. Sharing
// one instance matters because prosemirror uses instanceof checks internally —
// a Node created by one copy won't satisfy checks against another copy's class.
export * from 'prosemirror-model'

/**
 * Load plugins from an array of paths and notify the delegate on completion.
 *
 * Each plugin module is imported individually. A per-plugin import failure is caught
 * and logged; it does not abort the remaining loads or prevent `markupPluginsDidLoad`
 * from firing. When all imports have settled, `markupPluginsDidLoad` is called on the
 * delegate (if it defines that method) with an array of manifests for the plugins that
 * registered successfully. The function is a no-op (no delegate call) when `pluginPaths`
 * is empty.
 *
 * @param {string[]} pluginPaths  Resolved paths to plugin modules.
 * @param {object|null} delegate  A MarkupDelegate instance (may be null/undefined).
 * @param {function} [importFn]   Optional import function; defaults to the native dynamic
 *                                import. Provided for testing.
 * @returns {Promise<void>}
 */
export async function loadPlugins(pluginPaths, delegate, importFn = (path) => import(path)) {
  if (!pluginPaths || pluginPaths.length === 0) return
  const before = new Set(MU.getPluginManifest().map(m => m.name))
  await Promise.all(
    pluginPaths.map(path =>
      importFn(path).catch(err => {
        console.error('Plugin load failed:', path, err)
        return null
      })
    )
  )
  const after = MU.getPluginManifest()
  const newManifests = after.filter(m => !before.has(m.name))
  delegate?.markupPluginsDidLoad && delegate.markupPluginsDidLoad(newManifests)
}

// Expose loadPlugins on the MU namespace so it is accessible from tests and external callers.
MU.loadPlugins = loadPlugins

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
    this.editorContainer.addEventListener('muCallback', async (e) => {
      if (!this.editor) this.createEditor()
      if (e.message === 'loadedUserFiles') {
        const pluginsAttr = this.getAttribute('plugins')
        const pluginPaths = pluginsAttr ? JSON.parse(pluginsAttr) : []
        const delegate = this.editor.config?.delegate
        await loadPlugins(pluginPaths, delegate)
        const manifests = MU.getPluginManifest()
        if (manifests.length > 0) {
          this.editor.messageHandler.postMessage(
            JSON.stringify({ messageType: 'markupPluginsDidLoad', plugins: manifests })
          )
        }
      }
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

    // Apply toolbar appearance CSS custom properties if an appearance section is present
    const appearance = this.editor.config?.toolbar?.appearance
    if (appearance) {
      const colorPairs = {
        accentColor: '--Markup-accent-color',
        toolbarBg:   '--Markup-toolbar-bg',
        buttonBg:    '--Markup-button-bg',
        borderColor: '--Markup-border-color',
        hoverBg:     '--Markup-hover-bg',
      }
      const singleValues = {
        buttonSize: '--Markup-button-size',
        buttonFontSize: '--Markup-button-font-size',
      }
      const applyColors = (isDark) => {
        for (const [field, varName] of Object.entries(colorPairs)) {
          if (appearance[field] != null) {
            this.style.setProperty(varName, isDark ? appearance[field].dark : appearance[field].light)
          }
        }
      }
      for (const [field, varName] of Object.entries(singleValues)) {
        if (appearance[field] != null) {
          this.style.setProperty(varName, appearance[field])
        }
      }
      if (typeof window.matchMedia === 'function') {
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        applyColors(mq.matches)
        mq.addEventListener('change', (e) => applyColors(e.matches))
      } else {
        applyColors(false)
      }
    }

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
