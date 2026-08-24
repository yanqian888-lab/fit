const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'build-output.log');

try {
  const testContent = 'Test write at ' + new Date().toISOString();
  fs.writeFileSync(logFile, testContent, 'utf-8');
  console.log('Test file written successfully');
} catch (err) {
  console.error('Failed to write test file:', err.message);
}