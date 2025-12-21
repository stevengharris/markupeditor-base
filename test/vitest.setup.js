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
 * ProseMirror has some hacks to work around access to the Shadow DOM selection 
 * on Safari that use document.execCommand, but these are not relevant to the 
 * testing and can be no-ops.
 */
if (typeof document.execCommand === 'undefined') document.execCommand = ()=>{}