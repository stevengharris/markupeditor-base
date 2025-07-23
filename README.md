<p align="center">
    <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/073b1dcc-c81b-4e2d-a46c-2f819e5a0a44">
            <source media="(prefers-color-scheme: light)" srcset="https://github.com/user-attachments/assets/67104f81-055f-43f5-bf4f-b7655eecb2bb">
            <img alt="The MarkupEditor logo" src="https://github.com/user-attachments/assets/67104f81-055f-43f5-bf4f-b7655eecb2bb" width="104px" height="64px" >
    </picture>
</p>

# MarkupEditor

The MarkupEditor supports WYSIWYG editing in a web view. The "source of truth" for the MarkupEditor is standard HTML, styled using standard CSS.

The MarkupEditor aims to support the same functionality as [GitHub flavored Markdown](https://github.github.com/gfm/). However, instead of dealing with the distractions in Markdown-based text and the mysteries of how that text is translated to HTML and presented, the MarkupEditor always presents the HTML directly as you edit it.

The `markupeditor-base` project is primarily meant to be used as a dependency of a separate project that presents a web view. Along with the HTML content you're editing, web view must load the `markupeditor` JavaScript as a script along with the css styling to support editing. 

By cloning the `markupeditor-base` project and building it, you can exercise the WYSIWYG editing functionality by opening `explore/index.html` in a web browser. This makes debugging or reproducing issues completely self-contained in a browser environment, without requiring a web view being embedded in a larger project. You can also open `explore/index.js` in a node.js server to see and edit the same content.

There are currently two projects that use `markupeditor-base`:

* [MarkupEditor](https://github.com/stevengharris/MarkupEditor): WYSIWYG editing for SwiftUI and UIKit. This has been the primary driver for work on the base project.
* [markupeditor-vs](https://github.com/stevengharris/markupeditor-vs): WYSIWYG editing for VSCode. This project is under development. It is a VSCode extension.

This project is a work in progress under active development.