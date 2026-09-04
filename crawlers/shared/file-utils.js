const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveToFile(filepath, data) {
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(filepath, content, 'utf8');
}

function readFromFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(content);
}

module.exports = {
  ensureDir,
  saveToFile,
  readFromFile
};
