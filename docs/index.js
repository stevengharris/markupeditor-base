import { createStaticServer } from '../bin/static-server.js'

const __dirname = import.meta.dirname
const port = 3000

// Serves index.html for / via the default directory index, and the
// relative css/script references inside it, from this same directory.
const server = createStaticServer({ root: __dirname })

server.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});