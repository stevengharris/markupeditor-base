<p align="center">
    <img alt="The MarkupEditor logo" src="https://github.com/user-attachments/assets/c67b6aa0-2576-4a0b-81d0-229ee501b59d" width="96px" height="96px" >
</p>

# MarkupEditor

The MarkupEditor supports WYSIWYG editing in a web view. The "source of truth" for the MarkupEditor is standard HTML, styled using standard CSS.
The MarkupEditor comes with a toolbar and hot key bindings to access its editing functionality. The toolbar visibility and contents, 
as well as the key bindings, are configurable and extensible.

### Why

You or the consumers of your application need to edit more than just plain text. You want to be able to format and organize a document with 
headers, lists, links, images, and perhaps tables, but you do not want to do that using Markdown or require that the consumers of your app 
know anything about Markdown or HTML.  The MarkupEditor is the solution. It can be used in any environment that supports a web view, from a 
browser to a mobile or desktop app.

Like Markdown, the MarkupEditor keeps the focus on what you're writing, with a minimum of distractions. Like Markdown, it supports just enough 
functionality to help you organize and format your writing to get your points across effectively. Unlike Markdown, the MarkupEditor's WYSIWYG 
approach means you always see what you're writing presented properly as you write it, instead of dealing with the distractions of composing 
text with embedded notations and the uncertainty of how that text is later translated to HTML and presented.

## Features

The MarkupEditor's standard editing features are generally limited to what 
[Github Flavored Markdown](https://github.github.com/gfm/) supports. It does, however, have support 
for some functionality beyond that baseline. As a WYSIWYG editor, it supports the kind of functionality that 
even non-developers expect when they edit a document, like image resizing and search.

* Customizable and extensible toolbar providing access to all editing features, auto-sized to width.
* Customizable key mappings for hot-key access to editing features.
* Paragraph styles corresponding to P, H1-H6, and `CODE`.
* Bold, italic, underline, strikethrough, subscript, superscript, and code text formatting.
* Insert and edit links, images (local and https src), and tables.
* Bulleted and numbered lists.
* Indent/outdent.
* Comprehensive undo/redo.
* Search.
* Image resizing using gestures.
* Table editing: visually select table size, add/remove row/column/header, border options.

## Try

You can try the MarkupEditor out right from the [project web site](https://stevengharris.github.io/markupeditor-base/). The web site has all 
the information you need to use the MarkupEditor in your application.

## Install

Clone the repository.

```
git clone https://github.com/stevengharris/markupeditor-base.git
```

You need node/npm installed. Install the dependencies.

```
$ cd markupeditor-base/
$ npm install

added 126 packages, and audited 127 packages in 5s

18 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
$ 
```

Build the project.

```
$ npm run build

> markupeditor-base@0.8.0 build
> rollup -c


src/main.js → dist/markupeditor.umd.js...
created dist/markupeditor.umd.js in 321ms

src/main.js → dist/markupeditor.cjs.js, dist/markupeditor.esm.js...
created dist/markupeditor.cjs.js, dist/markupeditor.esm.js in 60ms
$ 
```

Open the editor on a doc using node.js. You can use the demo.html file that is part of the docs:

```
$ node markupeditor.js docs/demo/demo.html 
Server listening at http://localhost:3000
```

Then open http://localhost:3000 in your browser. The port can be passed to node as `--port <number>`.

You can also use the web site docs to test:

```
$ npm run docs

> markupeditor-base@0.8.0 predocs
> sh predocs.sh

Updating ./docs dependencies...
cp -f ./dist/markupeditor.umd.js ./docs/src/markupeditor.umd.js
cp -f ./styles/markupeditor.css ./docs/styles/markupeditor.css
cp -f ./styles/markup.css ./docs/styles/markup.css
cp -f ./styles/mirror.css ./docs/styles/mirror.css
cp -f ./styles/toolbar.css ./docs/styles/toolbar.css

> markupeditor-base@0.8.0 docs
> node ./docs/index.js

Server listening at http://localhost:3000
```

What http://localhost:3000 shows now is the contents hosted at https://stevengharris.github.io/markupeditor-base.

## Resources

Refer to the [Resources](https://stevengharris.github.io/markupeditor-base/#resources) section of the [project web site](https://stevengharris.github.io/markupeditor-base/)
for links to documentation, demos, and other projects using the MarkupEditor.

## Acknowledgements

This project was originally delivered as a single JavaScript file within the [Swift MarkupEditor](https://github.com/stevengharris/MarkupEditor), 
a project that provides WYSIWYG editing functionality to Swift UIKIt and iOS SwiftUI developers. Eventually, the Swift project moved to using the 
excellent [ProseMirror](https://prosemirror.net) project for all of the heavy lifting of WYSIWYG editing in its web view backend. With the formalization 
of this MarkupEditor base project, the Swift project now depends on `markupeditor-base` which in turn depends on ProseMirror. The MarkupEditor base 
project can then be re-used, within a [desktop editing app](https://github.com/stevengharris/markupeditor-desktop) or 
[VSCode extension](https://github.com/stevengharris/markupeditor-vs).

To quote from the ProseMirror site:

> ProseMirror is [open source](https://github.com/ProseMirror/prosemirror/blob/master/LICENSE), and you are legally free to use it commercially. Yet, writing, maintaining, supporting, and setting up infrastructure for such a project takes a lot of work and energy. Therefore...

> **If you are using ProseMirror to make profit, there is a social expectation that you help fund its maintenance. [Start here](http://marijnhaverbeke.nl/fund/).**

I encourage MarkupEditor users to take these statements to heart and support ProseMirror directly if you use the MarkupEditor to make a profit.


