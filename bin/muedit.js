#!/usr/bin/env node

/**
 * A script to run with node.js to open the MarkupEditor on an HTML file (or empty)
 */
import {argv} from 'node:process'
import {parseArgs} from 'node:util'
import express from 'express'
import path from 'node:path'

const __dirname = import.meta.dirname

const app = express()

const options = {
  'port': {
    type: 'string',
    default: '3000'
  }
}

try {
  var { values, positionals } = parseArgs({ argv, options, allowPositionals: true })
} catch {
  values = []
  positionals = []
}

if ((values.length > 1) || (!values.port) || (positionals.length > 1)) {
  console.log('Usage: muedit [--port number] [<filename>]')
} else {
  let port = parseInt(values.port)
  let filename = (positionals.length > 0) ? positionals[0] : null
  let filenameAttribute = (filename) ? `filename="${filename}"` : ''          // Empty for a new document
  // Note that `base` is set to the filename path automatically
  let placeholder = 'Edit document...'

  // The web component is always located relative to node's `__dirname`,
  // the location where muedit.js resides, which `app.use(express.static(__dirname))` 
  // ensures is available no matter what `process.cwd()` is.
  let webcomponent = `/markup-editor.js`
  
  // Allow references to dist from bin to work in index.html, to load the web component
  app.use(express.static(path.join(__dirname, "../dist")))

  // Allow the userscript and userstyles to load
  app.use(express.static(__dirname))

  // Allow the relative references inside of the edited document to work
  app.use(express.static(`${process.cwd()}/`, {index: false}))

  // For parsing application/json
  app.use(express.json())

  // Load when loading http://localhost:${port}
  app.get('/', (req, res) => {
    res.send(
      `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>${filename ?? "MarkupEditor"}</title>
          <meta name="viewport" charset="utf-8" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <markup-editor
            placeholder="${placeholder}"
            ${filenameAttribute}
            userscript="/filetoolbar.js"
            userstyle="/filetoolbar.css"
            prepend="FileToolbar"
          >
          </markup-editor>
          <input id="docpicker" type="file" accept=".html" style="display: none">
          <script src="${webcomponent}" type="module"></script>
        </body>
      </html>
    `
    )
  })

  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`)
  })
}