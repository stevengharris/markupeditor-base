#!/bin/bash

echo "Updating ./docs dependencies..."
set -v
cp -f ./dist/markupeditor.umd.js ./docs/src/markupeditor.umd.js
cp -f ./styles/markupeditor.css ./docs/styles/markupeditor.css
cp -f ./styles/markup.css ./docs/styles/markup.css
cp -f ./styles/mirror.css ./docs/styles/mirror.css
cp -f ./styles/toolbar.css ./docs/styles/toolbar.css