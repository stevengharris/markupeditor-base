#!/bin/bash

echo "Updating ./docs dependencies..."
set -v
cp -f ./markupeditor.esm.js ./docs/src/markupeditor.esm.js
cp -f ./markup-editor.js ./docs/src/markup-editor.js
cp -f ./styles/markupeditor.css ./docs/styles/markupeditor.css
cp -f ./styles/markup.css ./docs/styles/markup.css
cp -f ./styles/mirror.css ./docs/styles/mirror.css
cp -f ./styles/toolbar.css ./docs/styles/toolbar.css