const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

// Allow the relative references for css and scripts to work index.html
app.use(express.static(`${__dirname}`))

// Load index.html when loading http://localhost:${port}
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});