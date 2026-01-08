import { MU } from "/markup-editor.js"

/** A class holding the command items and functionality for a File toolbar that is prepended to the MarkupEditor toolbar */
class FileToolbar {
    constructor() {
        this.menuItems = this.buildMenuItems()
    }

    /** SVG defining icons by key, obtained from https://fonts.google.com/icons under https://openfontlicense.org license. */
    icons = {
        // <span class="material-symbols-outlined">note_add</span>
        new: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M440-240h80v-120h120v-80H520v-120h-80v120H320v80h120v120ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/></svg>',
        // <span class="material-symbols-outlined">file_open</span>
        open: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v240h-80v-200H520v-200H240v640h360v80H240Zm638 15L760-183v89h-80v-226h226v80h-90l118 118-56 57Zm-638-95v-640 640Z"/></svg>',
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
        let copyItem = MU.cmdItem(
            this.copyHTML.bind(this),
            {
                enable: () => { return true },
                title: 'Copy HTML',
                icon: this.icons.copy,
                // Use a callback to provide a "toast" indicating the copy worked
                callback: this.notifyCopy.bind(this)
            }
        )
        return [newItem, openItem, copyItem]
    }

    newDocument(state, dispatch, view) {
        MU.setActiveView(view)
        MU.emptyDocument()
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
     * the editor.
     * 
     * Note: Because we don't have access to an actual file picker or any way to determine what local 
     * directory the file resides in, there is no way to set "base" for the document. This means that 
     * local images will almost certainly not load and will generate 404s. Refer to the markupeditor-desktop
     * for an electron example that supports the file system natively.
     */
    loadDocument() {
        let picker = document.getElementById('docpicker');
        picker.removeEventListener('change', this.loadDocument.bind(this));
        let files = picker.files;
        if (files) {
            let file = files[0]
            const reader = new FileReader();
            reader.addEventListener('load', (event) => {
                const text = event.target.result; // The file contents
                MU.setHTML(text)
            });
            reader.readAsText(file);
        }
    }

    async copyHTML(state, dispatch, view) {
        MU.setActiveView(view)
        const text = MU.getHTML();
        try {
            await navigator.clipboard.writeText(text).then(() => { return })
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    }

    /**
     * Briefly add/remove `toast` class to the `menuItem` to display a "toast" notification.
     * 
     * The filetoolbar.css defines the CSS using `userstyle` set in muedit.js.
     * 
     * @param {HTMLSpanElement} menuItem 
     */
    notifyCopy(_ , menuItem) {
        const toast = document.createElement("div");
        toast.classList.add("toast");
        toast.innerText = "Copied HTML"

        menuItem.appendChild(toast);

        // Show the toast
        setTimeout(() => {
            toast.classList.add("show");
        }, 10); // Small delay to trigger CSS transition/animation

        // Automatically hide and remove the toast after a few seconds
        setTimeout(() => {
            toast.classList.remove("show");
            toast.remove();
        }, 1500); // Toast visible for 1.5 seconds
    }

}

/** By registering the augmentation, we can reference it by name in the <markup-editor> element toolbar attribute */
MU.registerAugmentation(new FileToolbar())