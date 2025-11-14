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

