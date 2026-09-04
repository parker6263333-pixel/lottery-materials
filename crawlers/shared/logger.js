function info(message, ...args) {
  console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
}

function error(message, ...args) {
  console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
}

function warn(message, ...args) {
  console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
}

module.exports = { info, error, warn };
