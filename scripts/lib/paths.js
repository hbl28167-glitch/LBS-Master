const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

function root(...parts) {
  return path.join(ROOT, ...parts);
}

module.exports = { ROOT, root };
