/**
 * Mock `CSSStyleSheet.replaceSync` for JSDOM testing
 */
if (!('replaceSync' in CSSStyleSheet.prototype)) {
  Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', {
    value(cssText) {
      this.cssText = cssText;
      return cssText;
    },
  });
}

/**
 * Mock `CSSStyleSheet.media` for JSDOM testing. JSDOM doesn't implement it at
 * all (accessing it returns undefined), so code that scopes a stylesheet to
 * a media query via `sheet.media.mediaText = '...'` throws under JSDOM even
 * though it works normally in real browsers.
 */
if (typeof new CSSStyleSheet().media === 'undefined') {
  Object.defineProperty(CSSStyleSheet.prototype, 'media', {
    get() {
      if (!this._media) this._media = { mediaText: '' };
      return this._media;
    },
  });
}

/**
 * ProseMirror has some hacks to work around access to the Shadow DOM selection 
 * on Safari that use document.execCommand, but these are not relevant to the 
 * testing and can be no-ops.
 */
if (typeof document.execCommand === 'undefined') document.execCommand = ()=>{}