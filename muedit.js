/**
 * A script to run with node.js to open the MarkupEditor on an HTML file (or empty)
 */
const {argv} = require('node:process')
const {parseArgs} = require('node:util')
const express = require('express')
const path = require('path')

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
  positionals = []
}

if ((values.length > 1) || (positionals.length > 1)) {
  console.log('Usage: node muedit.js [--port number] [<filename>]')
} else {
  let port = parseInt(values.port)
  let filename = (positionals.length > 0) ? positionals[0] : null
  let filenameString, baseString
  if (filename) {
    let fullFilename = path.join(process.cwd(), filename)
    let relativeFilename = path.relative(__dirname, fullFilename)
    filenameString = `filename="${relativeFilename}"`
    let base = path.dirname(relativeFilename) + '/'
    baseString = `base="${base}"`
  }
  let placeholder = 'Edit document...'

  // These files are always located relative to node's __dirname
  let muscript = 'dist/markupeditor.umd.js'
  let mustyle = 'styles/markupeditor.css'
  let webcomponent = 'webcomponent/markup-editor.js'

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
          <title>${filename}</title>
          <meta name="viewport" charset="utf-8" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <markup-editor
            muscript="${muscript}"
            mustyle="${mustyle}"
            placeholder="${placeholder}"
            ${filenameString ?? ""}
            ${baseString ?? ""}
          >
          </markup-editor>
          <script src="${webcomponent}"></script>
        </body>
      </html>
    `
    )
  })

  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`)
  })
}