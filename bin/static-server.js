/**
 * Dependency-free static file serving on node:http, shared by muedit.js
 * (createMueditServer) and docs/index.js (createStaticServer). Previously
 * each had its own express-based server.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

export const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/vnd.microsoft.icon',
}

export function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Resolve `urlPath` against `root`, refusing to resolve outside of it.
 * Returns the absolute file path if a regular file is found, or null.
 */
export async function resolveStaticFile(root, urlPath, { index = true } = {}) {
  const resolvedRoot = path.resolve(root)
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  let candidate = path.resolve(resolvedRoot, '.' + decoded)
  if (candidate !== resolvedRoot && !candidate.startsWith(resolvedRoot + path.sep)) {
    return null
  }
  try {
    let stats = await stat(candidate)
    if (stats.isDirectory()) {
      if (!index) return null
      candidate = path.join(candidate, 'index.html')
      stats = await stat(candidate)
    }
    return stats.isFile() ? candidate : null
  } catch {
    return null
  }
}

export function renderIndexHtml({ filename, webcomponent }) {
  const filenameAttribute = filename ? `filename="${filename}"` : ''          // Empty for a new document
  // Note that `base` is set to the filename path automatically
  const placeholder = 'Edit document...'
  return `
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
}

/**
 * Serve `req`/`res` from the first matching root in `staticRoots`
 * (`[{root, index}]`, checked in order), 404 if none match. Shared by
 * createMueditServer and createStaticServer.
 */
async function serveFromRoots(staticRoots, req, res) {
  const urlPath = req.url.split('?')[0]

  for (const { root, index } of staticRoots) {
    const filePath = await resolveStaticFile(root, urlPath, { index })
    if (filePath) {
      try {
        const data = await readFile(filePath)
        res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) })
        res.end(req.method === 'HEAD' ? undefined : data)
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Internal Server Error')
      }
      return
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not Found')
}

/**
 * Build (but do not start) the muedit HTTP server. Static roots are checked
 * in the same priority order the previous express.static() chain used:
 * distDir (the built web component), binDir (userscript/userstyle pair),
 * then cwd (the edited document's own relative assets, no directory index).
 * `/` is special-cased ahead of the static chain to serve the dynamic,
 * templated editor shell instead of a file.
 */
export function createMueditServer({ distDir, binDir, cwd, filename, webcomponent = '/markup-editor.js' }) {
  const staticRoots = [
    { root: distDir, index: true },
    { root: binDir, index: true },
    { root: cwd, index: false },
  ]

  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' })
      res.end('Method Not Allowed')
      return
    }

    const urlPath = req.url.split('?')[0]

    if (urlPath === '/') {
      const body = renderIndexHtml({ filename, webcomponent })
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(req.method === 'HEAD' ? undefined : body)
      return
    }

    await serveFromRoots(staticRoots, req, res)
  })
}

/**
 * Build (but do not start) a plain single-root static file server, with the
 * default directory index (root/index.html served for `/`) -- what
 * docs/index.js needs, as distinct from createMueditServer's multi-root
 * chain and dynamic templated `/` shell.
 */
export function createStaticServer({ root }) {
  const staticRoots = [{ root, index: true }]

  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' })
      res.end('Method Not Allowed')
      return
    }

    await serveFromRoots(staticRoots, req, res)
  })
}
