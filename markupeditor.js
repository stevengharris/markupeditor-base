#!/usr/bin/env node

const {argv} = require('node:process');
const {parseArgs} = require('node:util');
const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

const options = {
  'help': { 
    type: 'boolean',
    default: false,
    short: 'h'
  },
}

try {
  var {values, positionals} = parseArgs({ argv, options, allowPositionals: true })
} catch {
  var values = {help: true}
}
if ((values.help) || (positionals.length != 1)) {
  console.log('Usage: markup <filename.html>')
  return
}

filename = positionals[0]

const cwd = process.cwd()
let config = {}
if (filename) {
  // base needs a trailing slash
  config.base = path.relative(__dirname, cwd) + '/'
  config.filename = filename
  config.html = '<p>Loading...</p>'
} else {
  config.html = '<p>No file was specified.</p>'
}

let markupeditorcss = 'styles/markupeditor.css'
let markupeditorscript = 'dist/markupeditor.umd.js'
let markupdelegatescript = 'src/markupdelegate.js'

// Allow the relative references for css and scripts to work in index.html
app.use(express.static(`${__dirname}`))

// For parsing application/json
app.use(express.json())

// Load when loading http://localhost:${port}
app.get('/', (req, res) => {
  res.send(
    `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>MarkupEditor</title>
          <meta name="viewport" charset="utf-8" content="width=device-width, initial-scale=1.0">
          <link href="${markupeditorcss}" rel="stylesheet">
        </head>
        <body>
          <div id="editor"></div>
          <script src="${markupeditorscript}"></script>
          <script src="${markupdelegatescript}"></script>
          <base href="${config.base}"/>     <!-- So the relative references work-->
          <script>
            new MU.MarkupEditor(document.querySelector('#editor'), {
              filename: "${config.filename}",
              base: "${config.base}",
              html: "${config.html}",
              delegate: new MarkupDelegate()
            })
          </script>
        </body>
      </html>
    `
  )
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});