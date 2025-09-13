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
  console.log('Usage: node markupeditor.js [--port number] [<filename.html>]')
} else {
  let port = parseInt(values.port)
  let filename = (positionals.length > 0) ? positionals[0] : null
  let config = 'placeholder: "Edit document..."'
  if (filename) {
    let fullFilename = path.join(process.cwd(), filename)
    let relativeFilename = path.relative(__dirname, fullFilename)
    let base = path.dirname(relativeFilename) + '/'
    config += `, filename: "${relativeFilename}", base: "${base}"`
  }

  // These files are always located relative to node's __dirname
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
          <title>${filename}</title>
          <meta name="viewport" charset="utf-8" content="width=device-width, initial-scale=1.0">
          <link href="${markupeditorcss}" rel="stylesheet">
        </head>
        <body>
          <div id="editor"></div>
          <script src="${markupeditorscript}"></script>
          <script>
            new MU.MarkupEditor(document.querySelector('#editor'), {${config}})
          </script>
        </body>
      </html>
    `
    )
  })

  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`)
  })
}