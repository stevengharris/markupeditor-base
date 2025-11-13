/**
 * DOMAccess provides access to the MarkupToolbar and other well-known elements.
 */
class DOMAccess {

    constructor(prefix) {
        this.prefix = prefix ?? 'Markup'
    }

    setPrefix(prefix) {
        this.prefix = prefix
    }

    /**
     * Return the toolbar div in `view`
     * @param {EditorView} view 
     * @returns {HTMLDivElement}  The toolbar div in the view
     */
    getToolbar(view) {
        return view.dom.getRootNode().getElementById(this.prefix + "-toolbar");
    }

    getSearchItem(view) {
        return view.dom.getRootNode().getElementById(this.prefix + '-searchitem')
    }

    getSearchbar(view) {
        return view.dom.getRootNode().getElementById(this.prefix + "-searchbar");
    }

    getToolbarMore(view) {
        return view.dom.getRootNode().getElementById(this.prefix + "-toolbar-more")
    }

    getWrapper(view) {
        return this.getToolbar(view).parentElement;
    }

    /** Adding promptShowing class on wrapper lets us suppress scroll while the prompt is showing */
    addPromptShowing(view) {
        setClass(getWrapper(view), promptShowing(), true)
    }

    /** Removing promptShowing class on wrapper lets wrapper scroll again */
    removePromptShowing(view) {
        setClass(getWrapper(view), promptShowing(), false)
    }

    promptShowing() {
        return this.prefix + "-prompt-showing"
    }

    searchbarShowing() {
        return this.prefix + "-searchbar-showing"
    }

    searchbarHidden() {
        return this.prefix + "-searchbar-hidden"
    }

}

const domAccess = new DOMAccess()
export const prefix = domAccess.prefix
export const setPrefix = domAccess.setPrefix.bind(domAccess)
export const getToolbar = domAccess.getToolbar.bind(domAccess)
export const getSearchItem = domAccess.getSearchItem.bind(domAccess)
export const getSearchbar = domAccess.getSearchbar.bind(domAccess)
export const getToolbarMore = domAccess.getToolbarMore.bind(domAccess)
export const getWrapper = domAccess.getWrapper.bind(domAccess)
export const addPromptShowing = domAccess.addPromptShowing.bind(domAccess)
export const removePromptShowing = domAccess.removePromptShowing.bind(domAccess)
export const promptShowing = domAccess.promptShowing.bind(domAccess)
export const searchbarShowing = domAccess.searchbarShowing.bind(domAccess)
export const searchbarHidden = domAccess.searchbarHidden.bind(domAccess)

/* Use window.sessionStorage to get/set MarkupEditor.config */
export function getMarkupEditorConfig() {
  return JSON.parse(window.sessionStorage.getItem("markupEditorConfig"))
}

export function setMarkupEditorConfig(config) {
    window.sessionStorage.setItem("markupEditorConfig", JSON.stringify(config));
}

/**
 * 
 * @param {EditorView}  view
 * @param {string} text Text to be translated
 * @returns {string}    The translated text if the view supports it
 */
export function translate(view, text) {
    return view._props.translate ? view._props.translate(text) : text;
}
/**
 * Add or remove a class from the element.
 * 
 * Apparently a workaround for classList.toggle being broken in IE11
 * 
 * @param {HTMLElement}  dom 
 * @param {string}          cls The class name to add or remove
 * @param {boolean}         on  True to add the class name to the `classList`
 */
export function setClass(dom, cls, on) {
    if (on)
        dom.classList.add(cls);
    else
        dom.classList.remove(cls);
}