import {setClass} from "./utilities";
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

const _domAccess = new DOMAccess()
export const prefix = _domAccess.prefix
export const setPrefix = _domAccess.setPrefix.bind(_domAccess)
export const getToolbar = _domAccess.getToolbar.bind(_domAccess)
export const getSearchItem = _domAccess.getSearchItem.bind(_domAccess)
export const getSearchbar = _domAccess.getSearchbar.bind(_domAccess)
export const getToolbarMore = _domAccess.getToolbarMore.bind(_domAccess)
export const getWrapper = _domAccess.getWrapper.bind(_domAccess)
export const addPromptShowing = _domAccess.addPromptShowing.bind(_domAccess)
export const removePromptShowing = _domAccess.removePromptShowing.bind(_domAccess)
export const promptShowing = _domAccess.promptShowing.bind(_domAccess)
export const searchbarShowing = _domAccess.searchbarShowing.bind(_domAccess)
export const searchbarHidden = _domAccess.searchbarHidden.bind(_domAccess)