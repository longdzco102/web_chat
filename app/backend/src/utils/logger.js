/**
 * utils/logger.js – Minimal coloured console logger
 */
const c = {
  reset: '\x1b[0m',
  cyan:  '\x1b[36m',
  green: '\x1b[32m',
  yellow:'\x1b[33m',
  red:   '\x1b[31m',
  grey:  '\x1b[90m',
};

function ts() {
  return new Date().toISOString().replace('T',' ').slice(0,19);
}

const logger = {
  info (...a) { console.log(`${c.grey}[${ts()}]${c.reset} ${c.cyan}INFO${c.reset}`, ...a); },
  ok   (...a) { console.log(`${c.grey}[${ts()}]${c.reset} ${c.green}OK  ${c.reset}`, ...a); },
  warn (...a) { console.warn(`${c.grey}[${ts()}]${c.reset} ${c.yellow}WARN${c.reset}`, ...a); },
  error(...a) { console.error(`${c.grey}[${ts()}]${c.reset} ${c.red}ERR ${c.reset}`, ...a); },
  http (method, url, status, ms) {
    const col = status >= 500 ? c.red : status >= 400 ? c.yellow : c.green;
    console.log(`${c.grey}[${ts()}]${c.reset} ${col}${status}${c.reset} ${method.padEnd(6)} ${url} (${ms}ms)`);
  },
};

module.exports = logger;
