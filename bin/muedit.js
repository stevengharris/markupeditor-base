#!/usr/bin/env node

/**
 * A script to run with node.js to open the MarkupEditor on an HTML file (or empty)
 */
import {argv} from 'node:process'
import {parseArgs} from 'node:util'
import path from 'node:path'
import {createMueditServer} from './static-server.js'

const __dirname = import.meta.dirname

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

  // The web component is always located relative to node's `__dirname`,
  // the location where muedit.js resides, which serving binDir statically
  // ensures is available no matter what `process.cwd()` is.
  const server = createMueditServer({
    distDir: path.join(__dirname, "../dist"), // Allow references to dist from bin to work, to load the web component
    binDir: __dirname,                        // Allow the userscript and userstyles to load
    cwd: process.cwd(),                       // Allow the relative references inside of the edited document to work
    filename,
  })

  server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`)
  })
}
