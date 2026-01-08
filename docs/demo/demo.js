import { MU } from "../src/markup-editor.js"

class DemoDelegate {

    markupReady(editor) {
        demoToolbar.hideRaw(editor)
    }

    markupInput(editor) {
        demoToolbar.updateRaw(editor)
    }

}

MU.registerDelegate(new DemoDelegate())

/** A class holding the command items and functionality for a File toolbar that is prepended to the MarkupEditor toolbar */
class DemoToolbar {
  constructor() { 
    this.menuItems = this.buildMenuItems()
  }

  /** SVG defining icons by key, obtained from https://fonts.google.com/icons under https://openfontlicense.org license. */
  icons = {
    // <span class="material-symbols-outlined">note_add</span>
    new: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M440-240h80v-120h120v-80H520v-120h-80v120H320v80h120v120ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/></svg>',
    // <span class="material-symbols-outlined">file_open</span>
    open: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v240h-80v-200H520v-200H240v640h360v80H240Zm638 15L760-183v89h-80v-226h226v80h-90l118 118-56 57Zm-638-95v-640 640Z"/></svg>',
    // <span class="material-symbols-outlined">html</span>
    html: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M0-360v-240h60v80h80v-80h60v240h-60v-100H60v100H0Zm310 0v-180h-70v-60h200v60h-70v180h-60Zm170 0v-200q0-17 11.5-28.5T520-600h180q17 0 28.5 11.5T740-560v200h-60v-180h-40v140h-60v-140h-40v180h-60Zm320 0v-240h60v180h100v60H800Z"/></svg>',
    // <span class="material-symbols-outlined">file_copy</span>
    copy: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M744-192H312q-29 0-50.5-21.5T240-264v-576q0-29 21.5-50.5T312-912h312l192 192v456q0 29-21.5 50.5T744-192ZM576-672v-168H312v576h432v-408H576ZM168-48q-29 0-50.5-21.5T96-120v-552h72v552h456v72H168Zm144-792v195-195 576-576Z"/></svg>'
  }

  /** Return an array of MenuItems */
  buildMenuItems() {
    let newItem = MU.cmdItem(
      this.newDocument.bind(this),
      {
        enable: () => { return true },
        title: 'New document',
        icon: this.icons.new
      }
    )
    let openItem = MU.cmdItem(
      this.openDocument.bind(this),
      {
        enable: () => { return true },
        title: 'Open document',
        icon: this.icons.open
      }
    )
    let htmlItem = MU.cmdItem(
      this.toggleRaw.bind(this),
      {
        enable: () => { return true },
        title: 'Show HTML',
        icon: this.icons.html
      }
    )
    let copyItem = MU.cmdItem(
      this.copyRaw.bind(this),
      {
        enable: () => { return true },
        title: 'Copy HTML',
        icon: this.icons.copy
      }
    )
    return [newItem, openItem, htmlItem, copyItem]
  }

  newDocument(state, dispatch, view) {
    MU.setActiveView(view)
    MU.emptyDocument()
    this.updateRaw()
  }

  /** Open the picker as listen for changes in the input element */
  openDocument(state, dispatch, view) {
    MU.setActiveView(view)
    let picker = document.getElementById('docpicker');
    picker.addEventListener('change', this.loadDocument.bind(this));
    picker.showPicker();
  }

  /** 
   * When the user selects an HTML file from the picker, get its contents, update the document in 
   * the editor and the raw HTML that shows in `htmldiv`.
   */
  loadDocument() {
    let picker = document.getElementById('docpicker');
    picker.removeEventListener('change', this.loadDocument.bind(this));
    let files = picker.files;
    if (files) {
      let file = files[0]
      const reader = new FileReader();
      reader.addEventListener('load', (event) => {
        this.hideRaw()
        const text = event.target.result; // The file contents
        MU.setHTML(text)
        this.updateRaw()
      });
      reader.readAsText(file);
    }
  }

  /** Hide/show the `htmldiv` that shows the underlying raw HTML in the document. */
  toggleRaw(state, dispatch, view) {
    MU.setActiveView(view)
    if (!this.isShowingRaw()) {
      this.showRaw()
    } else {
      this.hideRaw()
    }
  }

  isShowingRaw() {
    let htmldiv = document.getElementById('htmldiv')
    let flexGrow = htmldiv.style.flexGrow;
    return flexGrow && (flexGrow == '1')
  }

  showRaw() {
    this.updateRaw()
    let htmldiv = document.getElementById('htmldiv')
    htmldiv.style.flex = 'auto'
    htmldiv.style.minWidth = '50%'
    htmldiv.style.maxHeight = 'fit-content'
  }

  hideRaw() {
    let htmldiv = document.getElementById('htmldiv')
    htmldiv.style.flex = '0'
    htmldiv.style.minWidth = '0'
    htmldiv.style.maxHeight = '100vh'
    document.getElementById('markup-editor').style.flex = 'auto'
  }

  /** Get the HTML from the document in the editor and update the `htmldiv-body`. */
  updateRaw() {
    let html = MU.getHTML()
    this.updateRawBody(html)
  }

  /** Update the `htmldiv-body`. */
  updateRawBody(html) {
    let body = document.getElementById('htmldiv-body');
    let text = document.createTextNode(html);
    let child = body.firstChild;
    if (child) {
      body.replaceChild(text, child)
    } else {
      body.appendChild(text)
    }
  }

  copyRaw(state, dispatch, view) {
    MU.setActiveView(view)
    this.updateRaw();
    let body = document.getElementById('htmldiv-body');
    let selection = document.getSelection();
    if (!selection) return;
    // Track where selection started
    let oldRange = selection.getRangeAt(0);
    // Select the entire htmldiv-body
    let range = document.createRange();
    range.setStart(body, 0);
    range.setEnd(body, body.childNodes.length);
    selection.removeAllRanges();
    selection.addRange(range);
    // I hate using execCommand, but whaddyagonnado?
    document.execCommand('copy');
    // Restore the old range
    selection.removeAllRanges();
    selection.addRange(oldRange);
  }
}

const demoToolbar = new DemoToolbar()
MU.registerAugmentation(demoToolbar)