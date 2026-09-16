import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { request as httpRequest } from 'node:http'
import path from 'node:path'
import {
  contentTypeFor,
  resolveStaticFile,
  renderIndexHtml,
  createMueditServer,
  createStaticServer,
} from '../bin/static-server.js'

/**
 * Send a GET with `rawPath` used verbatim as the request-target, bypassing
 * fetch()/the WHATWG URL parser's own dot-segment normalization (which
 * treats a percent-encoded "%2e%2e" as equivalent to ".." and collapses it
 * client-side before a real request would ever reach the wire). This is
 * needed to actually exercise the server's own decode-then-guard logic
 * rather than a client that already sanitized the traversal away.
 */
function rawGet(port, rawPath) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: 'localhost', port, path: rawPath, method: 'GET' }, (res) => {
      resolve(res)
      res.resume()
    })
    req.on('error', reject)
    req.end()
  })
}

describe('contentTypeFor', () => {
  it('maps known extensions', () => {
    expect(contentTypeFor('/a/b.js')).toBe('text/javascript; charset=utf-8')
    expect(contentTypeFor('/a/b.css')).toBe('text/css; charset=utf-8')
    expect(contentTypeFor('/a/b.html')).toBe('text/html; charset=utf-8')
    expect(contentTypeFor('/a/b.png')).toBe('image/png')
    expect(contentTypeFor('/a/b.SVG')).toBe('image/svg+xml')
    // Verified against a real express@5.1.0 install, not assumed: express
    // (via mime-db) sends 'image/vnd.microsoft.icon' for .ico, not the
    // older/legacy 'image/x-icon' this map originally had.
    expect(contentTypeFor('/a/b.ico')).toBe('image/vnd.microsoft.icon')
  })

  it('falls back to application/octet-stream for unknown extensions', () => {
    expect(contentTypeFor('/a/b.xyz')).toBe('application/octet-stream')
    expect(contentTypeFor('/a/b')).toBe('application/octet-stream')
  })
})

describe('resolveStaticFile', () => {
  let parent, root

  beforeEach(async () => {
    // `root` is nested one level inside `parent`, with a known secret file
    // sitting just outside `root`. This makes the traversal distance exact
    // (one `..`) regardless of how deeply nested the OS tmpdir itself is --
    // escaping toward a fixed absolute path like /etc/passwd is unreliable
    // since the number of `..` segments needed depends on tmpdir's depth.
    parent = await mkdtemp(path.join(tmpdir(), 'muedit-static-'))
    root = path.join(parent, 'served')
    await mkdir(root)
    await writeFile(path.join(parent, 'secret.txt'), 'should never be served')
    await writeFile(path.join(root, 'present.txt'), 'hi')
    await mkdir(path.join(root, 'sub'))
    await writeFile(path.join(root, 'sub', 'index.html'), '<p>index</p>')
  })

  afterEach(async () => {
    await rm(parent, { recursive: true, force: true })
  })

  it('resolves an existing file', async () => {
    const resolved = await resolveStaticFile(root, '/present.txt')
    expect(resolved).toBe(path.join(root, 'present.txt'))
  })

  it('returns null for a missing file', async () => {
    expect(await resolveStaticFile(root, '/nope.txt')).toBeNull()
  })

  it('serves a directory index when index is allowed', async () => {
    const resolved = await resolveStaticFile(root, '/sub', { index: true })
    expect(resolved).toBe(path.join(root, 'sub', 'index.html'))
    const resolvedTrailingSlash = await resolveStaticFile(root, '/sub/', { index: true })
    expect(resolvedTrailingSlash).toBe(path.join(root, 'sub', 'index.html'))
  })

  it('refuses to serve a directory index when index is disabled', async () => {
    expect(await resolveStaticFile(root, '/sub', { index: false })).toBeNull()
  })

  it('refuses to escape the root via path traversal', async () => {
    // Sanity check that the target is real and reachable one level up --
    // otherwise a missing guard could pass this test for the wrong reason
    // (ENOENT instead of the traversal actually being blocked).
    expect(await readFile(path.join(parent, 'secret.txt'), 'utf8')).toBe('should never be served')

    expect(await resolveStaticFile(root, '/../secret.txt')).toBeNull()
    expect(await resolveStaticFile(root, '/%2e%2e/secret.txt')).toBeNull()
  })

  it('ignores a query string when resolving the path', async () => {
    const resolved = await resolveStaticFile(root, '/present.txt?x=1')
    expect(resolved).toBe(path.join(root, 'present.txt'))
  })
})

describe('renderIndexHtml', () => {
  it('includes the filename attribute and title when a filename is given', () => {
    const html = renderIndexHtml({ filename: 'doc.html', webcomponent: '/markup-editor.js' })
    expect(html).toContain('filename="doc.html"')
    expect(html).toContain('<title>doc.html</title>')
    expect(html).toContain('<script src="/markup-editor.js" type="module"></script>')
  })

  it('omits the filename attribute and titles as MarkupEditor when no filename is given', () => {
    const html = renderIndexHtml({ filename: null, webcomponent: '/markup-editor.js' })
    expect(html).not.toContain('filename=')
    expect(html).toContain('<title>MarkupEditor</title>')
  })
})

describe('createMueditServer', () => {
  let distDir, binDir, cwdParent, cwdDir, server, baseUrl

  beforeAll(async () => {
    distDir = await mkdtemp(path.join(tmpdir(), 'muedit-dist-'))
    await writeFile(path.join(distDir, 'markup-editor.js'), '// fake web component bundle')

    binDir = await mkdtemp(path.join(tmpdir(), 'muedit-bin-'))
    await writeFile(path.join(binDir, 'filetoolbar.js'), '// fake toolbar script')
    await writeFile(path.join(binDir, 'filetoolbar.css'), '/* fake toolbar style */')

    // cwdDir is nested one level inside cwdParent, with a secret file
    // sitting just outside it -- see resolveStaticFile's traversal test for
    // why the escape target needs to be exactly one level up, not a fixed
    // absolute path like /etc/passwd.
    cwdParent = await mkdtemp(path.join(tmpdir(), 'muedit-cwd-'))
    cwdDir = path.join(cwdParent, 'served')
    await mkdir(cwdDir)
    await writeFile(path.join(cwdParent, 'secret.txt'), 'should never be served')
    await writeFile(path.join(cwdDir, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    // A cwd-local index.html must NOT be served for a bare `/` request --
    // that route is reserved for the generated editor shell.
    await writeFile(path.join(cwdDir, 'index.html'), '<p>should not be served for /</p>')

    server = createMueditServer({
      distDir,
      binDir,
      cwd: cwdDir,
      filename: 'notes.html',
    })
    await new Promise((resolve) => server.listen(0, resolve))
    baseUrl = `http://localhost:${server.address().port}`
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
    await Promise.all([distDir, binDir, cwdParent].map((d) => rm(d, { recursive: true, force: true })))
  })

  it('serves the generated editor shell at /', async () => {
    const res = await fetch(`${baseUrl}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    const body = await res.text()
    expect(body).toContain('filename="notes.html"')
    expect(body).toContain('<markup-editor')
  })

  it('serves the web component bundle from distDir', async () => {
    const res = await fetch(`${baseUrl}/markup-editor.js`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect(await res.text()).toBe('// fake web component bundle')
  })

  it('serves the userscript/userstyle pair from binDir', async () => {
    const js = await fetch(`${baseUrl}/filetoolbar.js`)
    expect(js.status).toBe(200)
    expect(await js.text()).toBe('// fake toolbar script')

    const css = await fetch(`${baseUrl}/filetoolbar.css`)
    expect(css.status).toBe(200)
    expect(css.headers.get('content-type')).toBe('text/css; charset=utf-8')
  })

  it('serves the edited document\'s local assets from cwd', async () => {
    const res = await fetch(`${baseUrl}/image.png`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
  })

  it('does not let a cwd index.html hijack the / route', async () => {
    const res = await fetch(`${baseUrl}/`)
    const body = await res.text()
    expect(body).not.toContain('should not be served for /')
  })

  it('404s for a file that exists nowhere in the search chain', async () => {
    const res = await fetch(`${baseUrl}/does-not-exist.txt`)
    expect(res.status).toBe(404)
  })

  it('404s rather than escape cwd via path traversal', async () => {
    // Sanity check the target is real -- see resolveStaticFile's traversal
    // test for why. Uses rawGet, not fetch(): fetch()/the WHATWG URL parser
    // treats a percent-encoded "%2e%2e" as equivalent to ".." and collapses
    // it client-side before a request would ever reach the wire, so a
    // fetch()-based version of this test would pass even with the server's
    // guard removed (verified empirically while writing this test).
    expect(await readFile(path.join(cwdParent, 'secret.txt'), 'utf8')).toBe('should never be served')

    const res = await rawGet(server.address().port, '/%2e%2e/secret.txt')
    expect(res.statusCode).toBe(404)
  })

  it('rejects non-GET/HEAD methods', async () => {
    const res = await fetch(`${baseUrl}/`, { method: 'POST' })
    expect(res.status).toBe(405)
  })
})

describe('createStaticServer', () => {
  // Plain single-root static file serving with default directory-index
  // behavior -- what docs/index.js needs, distinct from createMueditServer's
  // multi-root chain and dynamic templated `/` shell.
  let parent, root, server, baseUrl

  beforeAll(async () => {
    parent = await mkdtemp(path.join(tmpdir(), 'static-server-'))
    root = path.join(parent, 'served')
    await mkdir(root)
    await writeFile(path.join(root, 'index.html'), '<p>docs home</p>')
    await writeFile(path.join(root, 'style.css'), '/* docs style */')
    await writeFile(path.join(parent, 'secret.txt'), 'should never be served')

    server = createStaticServer({ root })
    await new Promise((resolve) => server.listen(0, resolve))
    baseUrl = `http://localhost:${server.address().port}`
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
    await rm(parent, { recursive: true, force: true })
  })

  it('serves index.html for / via the default directory index', async () => {
    const res = await fetch(`${baseUrl}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await res.text()).toBe('<p>docs home</p>')
  })

  it('serves other files from the root', async () => {
    const res = await fetch(`${baseUrl}/style.css`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/css; charset=utf-8')
  })

  it('404s for a missing file', async () => {
    const res = await fetch(`${baseUrl}/nope.txt`)
    expect(res.status).toBe(404)
  })

  it('404s rather than escape root via path traversal', async () => {
    expect(await readFile(path.join(parent, 'secret.txt'), 'utf8')).toBe('should never be served')
    const res = await rawGet(server.address().port, '/%2e%2e/secret.txt')
    expect(res.statusCode).toBe(404)
  })
})
