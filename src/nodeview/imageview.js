import {selectionChanged} from "../markup"
import {activeView, activeDocument} from "../registry"
import {NodeSelection} from "prosemirror-state"

/**
 * The NodeView to support resizable images and callbacks, as installed in main.js.
 * 
 * The ResizableImage instance holds onto the actual HTMLImageElement and deals with the styling,
 * event listeners, and resizing work.
 * 
 * Many thanks to contributors to this thread: https://discuss.prosemirror.net/t/image-resize/1489
 * and the accompanying Glitch project https://glitch.com/edit/#!/toothsome-shoemaker
 */
export class ImageView {
    constructor(node, view, getPos) {
        this.resizableImage = new ResizableImage(node, getPos())
        this.dom = this.resizableImage.imageContainer
    }
    
    selectNode() {
        this.resizableImage.imageElement.classList.add("ProseMirror-selectednode")
        this.resizableImage.select()
        selectionChanged()
    }
  
    deselectNode() {
        this.resizableImage.imageElement.classList.remove("ProseMirror-selectednode")
        this.resizableImage.deselect()
        selectionChanged()
    }

}

/**
 * A ResizableImage tracks a specific image element, and the imageContainer it is
 * contained in. The style of the container and its handles is handled in markup.css.
 *
 * As a resizing handle is dragged, the image size is adjusted. The underlying image
 * is never actually resized or changed.
 *
 * The approach of setting spans in the HTML and styling them in CSS to show the selected
 * ResizableImage, and dealing with mouseup/down/move was inspired by
 * https://tympanus.net/codrops/2014/10/30/resizing-cropping-images-canvas/
 */
class ResizableImage {
    
    constructor(node, pos) {
        this._pos = pos;                    // How to find node in view.state.doc
        this._minImageSize = 18             // Large enough for visibility and for the handles to display properly
        this._imageElement = this.imageElementFrom(node);
        this._imageContainer = this.containerFor(this.imageElement);
        this._startDimensions = this.dimensionsFrom(this.imageElement);
        this._startEvent = null;            // The ev that was passed to startResize
        this._startDx = -1;                 // Delta x between the two touches for pinching; -1 = not pinching
        this._startDy = -1;                 // Delta y between the two touches for pinching; -1 = not pinching
        this._touchCache = [];              // Touches that are active, max 2, min 0
        this._touchStartCache = [];         // Touches at the start of a pinch gesture, max 2, min 0
    }
    
    get imageElement() {
        return this._imageElement;
    };

    get imageContainer() {
        return this._imageContainer;
    };
    
    /**
     * The startDimensions are the width/height before resizing
     */
    get startDimensions() {
        return this._startDimensions;
    };
    
    /**
     * Reset the start dimensions for the next resizing
     */
    set startDimensions(startDimensions) {
        this._startDimensions = startDimensions;
    };
    
    /*
     * Return the width and height of the image element
     */
    get currentDimensions() {
        const width = parseInt(this._imageElement.getAttribute('width'));
        const height = parseInt(this._imageElement.getAttribute('height'));
        return {width: width, height: height};
    };

    /**
     * Dispatch a transaction to the view, using its metadata to pass the src
     * of the image that just loaded. This method executes when the load 
     * or error event is triggered for the image element. The image plugin 
     * can hold state to avoid taking actions multiple times when the same 
     * image loads.
     * @param {string} src   The src attribute for the imageElement.
     */
    imageLoaded(src) {
        let view = activeView()
        const transaction = view.state.tr
            .setMeta("imageLoaded", {'src': src})
        view.dispatch(transaction);
    };

    /**
     * Update the image size for the node in a transaction so that the resizing 
     * can be undone.
     * 
     * Note that after the transaction is dispatched, the ImageView is recreated, 
     * and `imageLoaded` gets called again.
     */
    imageResized() {
        const view = activeView()
        const {width, height} = this.currentDimensions
        const transaction = view.state.tr
            .setNodeAttribute(this._pos, 'width', width)
            .setNodeAttribute(this._pos, 'height', height)
        // Reselect the node again, so it ends like it started - selected
        transaction.setSelection(new NodeSelection(transaction.doc.resolve(this._pos)))
        view.dispatch(transaction);
    };

    /**
     * Return the HTML Image Element displayed in the ImageView
     * @param {Node} node 
     * @returns HTMLImageElement
     */
    imageElementFrom(node) {
        const img = document.createElement('img');
        const src = node.attrs.src

        // If the img node does not have both width and height attr, get them from naturalWidth 
        // after loading. Use => style function to reference this.
        img.addEventListener('load', e => {
            if (node.attrs.width && node.attrs.height) {
                img.setAttribute('width', node.attrs.width)
                img.setAttribute('height', node.attrs.height)
            } else {
                // naturalWidth and naturalHeight will be zero if not known
                let width = Math.max(e.target.naturalWidth, this._minImageSize)
                node.attrs.width = width
                img.setAttribute('width', width)
                let height = Math.max(e.target.naturalHeight, this._minImageSize)
                node.attrs.height = height
                img.setAttribute('height', height)
            }
            this.imageLoaded(src)
        })

        // Display a broken image background and notify of any errors.
        img.addEventListener('error', () => {
            // https://fonts.google.com/icons?selected=Material+Symbols+Outlined:broken_image:FILL@0;wght@400;GRAD@0;opsz@20&icon.query=missing&icon.size=18&icon.color=%231f1f1f
            const imageSvg = '<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#1f1f1f"><path d="M216-144q-29 0-50.5-21.5T144-216v-528q0-29.7 21.5-50.85Q187-816 216-816h528q29.7 0 50.85 21.15Q816-773.7 816-744v528q0 29-21.15 50.5T744-144H216Zm48-303 144-144 144 144 144-144 48 48v-201H216v249l48 48Zm-48 231h528v-225l-48-48-144 144-144-144-144 144-48-48v177Zm0 0v-240 63-351 528Z"/></svg>';
            const image64 = btoa(imageSvg);
            const imageUrl = `url("data:image/svg+xml;base64,${image64}")`
            img.style.background = "lightgray"  // So we can see it in light or dark mode
            img.style.backgroundImage = imageUrl
            img.setAttribute('width', this._minImageSize)
            img.setAttribute('height', this._minImageSize)
            this.imageLoaded(src)
        });
        
        img.setAttribute("src", src)

        return img
    }

    /**
     * Return the HTML Content Span element that contains the imageElement.
     * 
     * Note that the resizing handles, which are themselves spans, are inserted 
     * before and after the imageElement at selection time, and removed at 
     * deselect time.
     * 
     * @param {HTMLImageElement} imageElement 
     * @returns HTML Content Span element
     */
    containerFor(imageElement) {
        const imageContainer = document.createElement('span');
        imageContainer.appendChild(imageElement);
        return imageContainer
    }

    /**
     * Set the attributes for the imageContainer and populate the spans that show the 
     * resizing handles. Add the mousedown event listener to initiate resizing.
     */
    select() {
        this.imageContainer.setAttribute('class', 'resize-container');
        const nwHandle = document.createElement('span');
        nwHandle.setAttribute('class', 'resize-handle resize-handle-nw');
        this.imageContainer.insertBefore(nwHandle, this.imageElement);
        const neHandle = document.createElement('span');
        neHandle.setAttribute('class', 'resize-handle resize-handle-ne');
        this.imageContainer.insertBefore(neHandle, this.imageElement);
        const swHandle = document.createElement('span');
        swHandle.setAttribute('class', 'resize-handle resize-handle-sw');
        this.imageContainer.insertBefore(swHandle, null);
        const seHandle = document.createElement('span');
        seHandle.setAttribute('class', 'resize-handle resize-handle-se');
        this.imageContainer.insertBefore(seHandle, null);
        this.imageContainer.addEventListener('mousedown', this.startResize = this.startResize.bind(this));
        this.addPinchGestureEvents();
    }

    /**
     * Remove the attributes for the imageContainer and the spans that show the 
     * resizing handles. Remove the mousedown event listener.
     */
    deselect() {
        this.removePinchGestureEvents();
        this.imageContainer.removeEventListener('mousedown', this.startResize);
        const handles = this.imageContainer.querySelectorAll('span');
        handles.forEach((handle) => {this.imageContainer.removeChild(handle)});
        this.imageContainer.removeAttribute('class');
    }

    /**
     * Return an object containing the width and height of imageElement as integers.
     * @param {HTMLImageElement} imageElement 
     * @returns An object with Int width and height.
     */
    dimensionsFrom(imageElement) {
        const width = parseInt(imageElement.getAttribute('width'));
        const height = parseInt(imageElement.getAttribute('height'));
        return {width: width, height: height};
    };
    
    /**
     * Add touch event listeners to support pinch resizing.
     *
     * Listeners are added when the resizableImage is selected.
     */
    addPinchGestureEvents() {
        activeDocument().addEventListener('touchstart', this.handleTouchStart = this.handleTouchStart.bind(this));
        activeDocument().addEventListener('touchmove', this.handleTouchMove = this.handleTouchMove.bind(this));
        activeDocument().addEventListener('touchend', this.handleTouchEnd = this.handleTouchEnd.bind(this));
        activeDocument().addEventListener('touchcancel', this.handleTouchEnd = this.handleTouchEnd.bind(this));
    };
    
    /**
     * Remove event listeners supporting pinch resizing.
     *
     * Listeners are removed when the resizableImage is deselected.
     */
    removePinchGestureEvents() {
        activeDocument().removeEventListener('touchstart', this.handleTouchStart);
        activeDocument().removeEventListener('touchmove', this.handleTouchMove);
        activeDocument().removeEventListener('touchend', this.handleTouchEnd);
        activeDocument().removeEventListener('touchcancel', this.handleTouchEnd);
    };

    /**
     * Start resize on a mousedown event.
     * @param {Event} ev    The mousedown Event.
     */
    startResize(ev) {
        ev.preventDefault();
        // The event can trigger on imageContainer and its contents, including spans and imageElement.
        if (this._startEvent) return;   // We are already resizing
        this._startEvent = ev;          // Track the event that kicked things off

        //TODO: Avoid selecting text while resizing.
        // Setting webkitUserSelect to 'none' used to help when the style could be applied to 
        // the actual HTML document being edited, but it doesn't seem to work when applied to 
        // view.dom. Leaving a record here for now.
        // view.state.tr.style.webkitUserSelect = 'none';  // Prevent selection of text as mouse moves

        // Use document to receive events even when cursor goes outside of the imageContainer
        activeDocument().addEventListener('mousemove', this.resizing = this.resizing.bind(this));
        activeDocument().addEventListener('mouseup', this.endResize = this.endResize.bind(this));
        this._startDimensions = this.dimensionsFrom(this.imageElement);
    };
    
    /**
     * End resizing on a mouseup event.
     * @param {Event} ev    The mouseup Event.
     */
    endResize(ev) {
        ev.preventDefault();
        this._startEvent = null;

        //TODO: Restore selecting text when done resizing.
        // Setting webkitUserSelect to 'text' used to help when the style could be applied to 
        // the actual HTML document being edited, but it doesn't seem to work when applied to 
        // view.dom. Leaving a record here for now.
        //view.dom.style.webkitUserSelect = 'text';  // Restore selection of text now that we are done

        activeDocument().removeEventListener('mousemove', this.resizing);
        activeDocument().removeEventListener('mouseup', this.endResize);
        this._startDimensions = this.currentDimensions;
        this.imageResized();
    };
    
    /**
     * Continuously resize the imageElement as the mouse moves.
     * @param {Event} ev    The mousemove Event.
     */
    resizing(ev) {
        ev.preventDefault();
        const ev0 = this._startEvent;
        // FYI: x increases to the right, y increases down
        const x = ev.clientX;
        const y = ev.clientY;
        const x0 = ev0.clientX;
        const y0 = ev0.clientY;
        const classList = ev0.target.classList;
        let dx, dy;
        if (classList.contains('resize-handle-nw')) {
            dx = x0 - x;
            dy = y0 - y;
        } else if (classList.contains('resize-handle-ne')) {
            dx = x - x0;
            dy = y0 - y;
        } else if (classList.contains('resize-handle-sw')) {
            dx = x0 - x;
            dy = y - y0;
        } else if (classList.contains('resize-handle-se')) {
            dx = x - x0;
            dy = y - y0;
        } else {
            // If not in a handle, treat movement like resize-handle-ne (upper right)
            dx = x - x0;
            dy = y0 - y;
        }
        const scaleH = Math.abs(dy) > Math.abs(dx);
        const w0 = this._startDimensions.width;
        const h0 = this._startDimensions.height;
        const ratio = w0 / h0;
        let width, height;
        if (scaleH) {
            height = Math.max(h0 + dy, this._minImageSize);
            width = Math.floor(height * ratio);
        } else {
            width = Math.max(w0 + dx, this._minImageSize);
            height = Math.floor(width / ratio);
        };
        this._imageElement.setAttribute('width', width);
        this._imageElement.setAttribute('height', height);
    };
    
    /**
     * A touch started while the resizableImage was selected.
     * Cache the touch to support 2-finger gestures only.
     */
    handleTouchStart(ev) {
        ev.preventDefault();
        if (this._touchCache.length < 2) {
            const touch = ev.changedTouches.length > 0 ? ev.changedTouches[0] : null;
            if (touch) {
                this._touchCache.push(touch);
                this._touchStartCache.push(touch);
            };
        };
    };
    
    /**
     * A touch moved while the resizableImage was selected.
     *
     * If this is a touch we are tracking already, then replace it in the touchCache.
     *
     * If we only have one finger down, the update the startCache for it, since we are
     * moving a finger but haven't start pinching.
     *
     * Otherwise, we are pinching and need to resize.
     */
    handleTouchMove(ev) {
        ev.preventDefault();
        const touch = this.touchMatching(ev);
        if (touch) {
            // Replace the touch in the touchCache with this touch
            this.replaceTouch(touch, this._touchCache)
            if (this._touchCache.length < 2) {
                // If we are only touching a single place, then replace it in the touchStartCache as it moves
                this.replaceTouch(touch, this._touchStartCache);
            } else {
                // Otherwise, we are touching two places and are pinching
                this.startPinch();   // A no-op if we have already started
                this.pinch();
            };
        }
    };
    
    /**
     * A touch ended while the resizableImage was selected.
     *
     * Remove the touch from the caches, and end the pinch operation.
     * We might still have a touch point down when one ends, but the pinch operation
     * itself ends at that time.
     */
    handleTouchEnd(ev) {
        const touch = this.touchMatching(ev);
        if (touch) {
            const touchIndex = this.indexOfTouch(touch, this._touchCache);
            if (touchIndex !== null) {
                this._touchCache.splice(touchIndex, 1);
                this._touchStartCache.splice(touchIndex, 1);
                this.endPinch();
            };
        };
    };
    
    /**
     * Return the touch in ev.changedTouches that matches what's in the touchCache, or null if it isn't there
     */
    touchMatching(ev) {
        const changedTouches = ev.changedTouches;
        const touchCache = this._touchCache;
        for (let i = 0; i < touchCache.length; i++) {
            for (let j = 0; j < changedTouches.length; j++) {
                if (touchCache[i].identifier === changedTouches[j].identifier) {
                    return changedTouches[j];
                };
            };
        };
        return null;
    };
    
    /**
     * Return the index into touchArray of touch based on identifier, or null if not found
     *
     * Note: Due to JavaScript idiocy, must always check return value against null, because
     * indices of 1 and 0 are true and false, too. Fun!
     */
    indexOfTouch(touch, touchArray) {
        for (let i = 0; i < touchArray.length; i++) {
            if (touch.identifier === touchArray[i].identifier) {
                return i;
            };
        };
        return null;
    };
    
    /**
     * Replace the touch in touchArray if it has the same identifier, else do nothing
     */
    replaceTouch(touch, touchArray) {
        const i = this.indexOfTouch(touch, touchArray);
        if (i !== null) { touchArray[i] = touch }
    };
    
    /**
     * We received the touchmove event and need to initialize things for pinching.
     *
     * If the resizableImage._startDx is -1, then we need to initialize; otherwise,
     * a call to startPinch is a no-op.
     *
     * The initialization captures a new startDx and startDy that track the distance
     * between the two touch points when pinching starts. We also track the startDimensions,
     * because scaling is done relative to it.
     */
    startPinch() {
        if (this._startDx === -1) {
            const touchStartCache = this._touchStartCache;
            this._startDx = Math.abs(touchStartCache[0].pageX - touchStartCache[1].pageX);
            this._startDy = Math.abs(touchStartCache[0].pageY - touchStartCache[1].pageY);
            this._startDimensions = this.dimensionsFrom(this._imageElement);
        };
    };

    /**
     * Pinch the resizableImage based on the information in the touchCache and the startDx/startDy
     * we captured when pinching started. The touchCache has the two touches that are active.
     */
    pinch() {
        // Here currentDx and currentDx are the current distance between the two
        // pointers, which have to be compared to the start distances to determine
        // if we are zooming in or out
        const touchCache = this._touchCache;
        const x0 = touchCache[0].pageX
        const y0 = touchCache[0].pageY
        const x1 = touchCache[1].pageX
        const y1 = touchCache[1].pageY
        const currentDx = Math.abs(x1 - x0);
        const currentDy = Math.abs(y1 - y0);
        const dx = currentDx - this._startDx;
        const dy = currentDy - this._startDy;
        const scaleH = Math.abs(dy) > Math.abs(dx);
        const w0 = this._startDimensions.width;
        const h0 = this._startDimensions.height;
        const ratio = w0 / h0;
        let width, height;
        if (scaleH) {
            height = Math.max(h0 + dy, this._minImageSize);
            width = Math.floor(height * ratio);
        } else {
            width = Math.max(w0 + dx, this._minImageSize);
            height = Math.floor(width / ratio);
        };
        this._imageElement.setAttribute('width', width);
        this._imageElement.setAttribute('height', height);
    };
    
    /**
     * The pinch operation has ended because we stopped touching one of the two touch points.
     *
     * If we are only touching one point, then endPinch is a no-op. For example, if the
     * resizableImage is selected and you touch and release at a point, endPinch gets called
     * but does nothing. Similarly for lifting the second touch point after releasing the first.
     */
    endPinch() {
        if (this._touchCache.length === 1) {
            this._startDx = -1;
            this._startDy = -1;
            this._startDimensions = this.currentDimensions;
            this.imageResized();
        };
    };
   
    /**
     * Callback with the resizableImage data that allows us to put an image
     * in the clipboard without all the browser shenanigans.
     */
    //copyToClipboard() {
    //    const image = this._imageElement;
    //    if (!image) { return };
    //    const messageDict = {
    //        'messageType' : 'copyImage',
    //        'src' : image.src,
    //        'alt' : image.alt,
    //        'dimensions' : this._startDimensions
    //    };
    //    _callback(JSON.stringify(messageDict), _document());
    //};
    
};
