const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

const fs = require('fs')

// Allow the relative references for css and scripts to work in index.html
app.use(express.static(`${__dirname}`))

// For parsing application/json
app.use(express.json())

// Load example-node.html when loading http://localhost:${port}
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'example-node.html'));
});

// Process posts from the web view
app.post('/', (req, res) => {
  console.log('Got a POST request: ' + JSON.stringify(req.body))
  let message = req.body;
  switch (message.type) {
    case 'getHTML': {
      let filename = path.join(__dirname, message.filename);
      try {
        const data = fs.readFileSync(filename, 'utf8');
        res.send(data)
      } catch (err) {
        res.send('Error reading file:', err);
      }
      break;
    }
  }
})

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});