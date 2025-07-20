<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://github.com/stevengharris/markupeditor-base/blob/264c007e23d4e9d14642b2acccd099a01c9b3195/markup-mark-solid.svg">
        <source media="(prefers-color-scheme: light)" srcset="https://github.com/stevengharris/markupeditor-base/blob/264c007e23d4e9d14642b2acccd099a01c9b3195/markup-mark.svg">
        <img alt="The MarkupEditor logo" src="https://github.com/stevengharris/markupeditor-base/blob/264c007e23d4e9d14642b2acccd099a01c9b3195/markup-mark.svg" width="104px" height="64px" >
    </picture>
</p>

# MarkupEditor

The MarkupEditor base provides the functionality for WYSIWYG editing in a web browser. It is primarily meant to be used as a dependency of a larger project that contains a web view that loads this project's JavaScript as a script along with the css styling to support editing. However, by cloning the standalone markupeditor-base project, you can exercise the WYSIWYG editing functionality by opening `demo/index.html` in a web browser. This makes debugging or reproducing issues completely self-contained to a browser environment, without requiring a web view being embedded in a larger project.

There are currently two projects that use markupeditor-base:

* [MarkupEditor](https://github.com/stevengharris/MarkupEditor): A WYSIWYG editing for SwiftUI and UIKit. This has been the primary driver for work on the base project.
* [markupeditor-vs](https://github.com/stevengharris/): A WYSIWYG editing for VSCode. This project is under development. It is a VSCode extension.

This is a work in progress and the README is mainly a placeholder.