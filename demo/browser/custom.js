/**
 * Return a user-provided array of MenuItems
 */

function buildMenuItems() {
    let newItem = MU.cmdItem(
        MU.emptyDocument, 
        {
            enable: () => { return true },
            title: 'New document',
            icon: icons.new
        }
    )
    let openItem = MU.cmdItem(
        openDocument, 
        {
            enable: () => { return true },
            title: 'Open document',
            icon: icons.open
        }
    )
    let htmlItem = MU.cmdItem(
        toggleHTML, 
        {
            enable: () => { return true },
            title: 'Show HTML',
            icon: icons.html
        }
    )
    return [newItem, openItem, htmlItem]
}

function openDocument() {
    let picker = document.getElementById('docpicker');
    picker.addEventListener('change', loadDocument);
    picker.showPicker();
}

function loadDocument() {
    let picker = document.getElementById('docpicker');
    picker.removeEventListener('change', loadDocument);
    let files = picker.files;
    if (files) {
        let file = files[0]
        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
            const text = event.target.result; // The file contents
            MU.setHTML(text)
            updateHTML()
        });
        reader.readAsText(file);
    }
}

function toggleHTML() {
    let htmldiv = document.getElementById('htmldiv')
    let width = htmldiv.style.width;
    let show = (width.length == 0) || (width == '0px')
    if (show) {
        updateHTML()
        htmldiv.style.width = '50%'
    } else {
        htmldiv.style.width = '0'
    }
}

function updateHTML() {
    let body = document.getElementById('htmldiv-body');
    let html = MU.getHTML()
    let text = document.createTextNode(html);
    let child = body.firstChild;
    if (child) {
        body.replaceChild(text, child)
    } else {
        body.appendChild(text)
    }
}

const icons = {
    new: {
        // <span class="material-symbols-outlined">note_add</span>
        svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M440-240h80v-120h120v-80H520v-120h-80v120H320v80h120v120ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/></svg>'
    },
    open: {
        // <span class="material-symbols-outlined">file_open</span>
        svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v240h-80v-200H520v-200H240v640h360v80H240Zm638 15L760-183v89h-80v-226h226v80h-90l118 118-56 57Zm-638-95v-640 640Z"/></svg>'
    },
    html: {
        // <span class="material-symbols-outlined">code</span>
        svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M0-360v-240h60v80h80v-80h60v240h-60v-100H60v100H0Zm310 0v-180h-70v-60h200v60h-70v180h-60Zm170 0v-200q0-17 11.5-28.5T520-600h180q17 0 28.5 11.5T740-560v200h-60v-180h-40v140h-60v-140h-40v180h-60Zm320 0v-240h60v180h100v60H800Z"/></svg>'
        //svg: '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M320-240 80-480l240-240 57 57-184 184 183 183-56 56Zm320 0-57-57 184-184-183-183 56-56 240 240-240 240Z"/></svg>'
    }
}

class MessageCoordinator {
    constructor() {}

    postMessage(message) {
        // If we triggered an input callback, update the HTML.
        // This is way too heavyweight for a real app, but it works nice in the demo to show changes.
        console.log('message: ' + message)
        if (message && (message.substring(0, 5) === 'input')) {
            updateHTML()
        }
    };   
}

MU.prependToolbar(buildMenuItems())
let messageCoordinator = new MessageCoordinator()
MU.setMessageHandler(messageCoordinator);
MU.setHTML(document.getElementById("content").innerHTML);