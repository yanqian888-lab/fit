const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'simple-test.txt');
fs.writeFileSync(logFile, 'Hello from node at ' + new Date().toISOString() + '\n');
console.log('File written successfully');