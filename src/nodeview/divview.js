import {resetSelectedID, htmlFromFragment, fragmentFromNode, buttonClicked} from "../markup";
import {activeDocument} from "../registry";

/**
 * The NodeView to support divs, as installed in main.js.
 */
export class DivView {
    constructor(node) {
        const div = document.createElement('div');
        div.setAttribute('id', node.attrs.id);
        div.setAttribute('class', node.attrs.cssClass);
        // Note that the click is reported using createSelectionBetween on the EditorView.
        // Here we have access to the node id and can specialize for divs.
        // Because the contentDOM is not set for non-editable divs, the selection never gets 
        // set in them, but will be set to the first selectable node after.
        div.addEventListener('click', () => {
            resetSelectedID(node.attrs.id)
        })
        const htmlFragment = fragmentFromNode(node);
        if (node.attrs.editable) {
            div.innerHTML = htmlFromFragment(htmlFragment)
            this.dom = div
            this.contentDOM = this.dom
        } else {
            // For non-editable divs, we have to handle all the interaction, which only occurs for buttons.
            // Note ProseMirror does not render children inside of non-editable divs. We deal with this by 
            // supplying the entire content of the div in htmlContents, and when we need to change the div
            // (for example, adding and removing a button group), we must then update the htmlContents 
            // accordingly. This happens in addDiv and removeDiv.
            div.innerHTML = htmlFromFragment(htmlFragment);
            const buttons = Array.from(div.getElementsByTagName('button'));
            buttons.forEach( button => {
                button.addEventListener('click', () => {
                    // Report the button that was clicked and its location
                    buttonClicked(
                        JSON.stringify({
                            'messageType' : 'buttonClicked',
                            'id' : button.id,
                            'rect' : this._getButtonRect(button)
                        }, activeDocument())
                    )
                })
            })
            this.dom = div;
        }
    }

    /**
     * Return the rectangle of the button in a form that can be digested consistently.
     * @param {HTMLButton} button 
     * @returns {Object} The button's (origin) x, y, width, and height.
     */
    _getButtonRect(button) {
        const boundingRect = button.getBoundingClientRect();
        const buttonRect = {
            'x' : boundingRect.left,
            'y' : boundingRect.top,
            'width' : boundingRect.width,
            'height' : boundingRect.height
        };
        return buttonRect;
    };

}