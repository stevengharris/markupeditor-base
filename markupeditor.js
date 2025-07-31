#!/usr/bin/env node

const {argv} = require('node:process');
const {parseArgs} = require('node:util');
const express = require('express');
const path = require('path');

const app = express();

const options = {
  'help': { 
    type: 'boolean',
    default: false,
    short: 'h'
  },
  'port': {
    type: 'string',
    default: '3000'
  }
}

try {
  var {values, positionals} = parseArgs({ argv, options, allowPositionals: true })
} catch {
  var values = {help: true}
}
if ((values.help) || (positionals.length != 1)) {
  console.log('Usage: markup [--port number] <filename.html>')
  return
}

filename = positionals[0] // We know the value exists, but may not load
const port = parseInt(values.port)

const cwd = process.cwd()
let config = {}
// base needs a trailing slash
config.base = path.relative(__dirname, cwd) + '/'
config.filename = filename

let markupeditorcss = 'styles/markupeditor.css'
let markupeditorscript = 'dist/markupeditor.umd.js'

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
          <base href="${config.base}"/>     <!-- So the relative references work-->
          <script>
            new MU.MarkupEditor(document.querySelector('#editor'), {
              filename: "${config.filename}",
              html: "${config.html}",
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