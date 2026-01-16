const fs = require('fs');
const path = require('path');

let debugMode = false;
let logStream = null;
let currentLogFile = null;

/**
 * Format a log message with timestamp
 */
function formatMessage(message, ...args) {
    const timestamp = new Date().toISOString();
    const fullMessage = args.length > 0
        ? `${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}`
        : message;
    return `[${timestamp}] ${fullMessage}`;
}

/**
 * Log a message to console and optionally to file
 */
function log(message, ...args) {
    console.log(message, ...args);

    if (debugMode && logStream) {
        const formattedMessage = formatMessage(message, ...args);
        logStream.write(formattedMessage + '\n');
    }
}

/**
 * Log an error message to console and optionally to file
 */
function error(message, ...args) {
    console.error(message, ...args);

    if (debugMode && logStream) {
        const formattedMessage = formatMessage('[ERROR]', message, ...args);
        logStream.write(formattedMessage + '\n');
    }
}

/**
 * Enable debug mode and create log file
 */
function enableDebugMode() {
    if (debugMode) {
        log('Debug mode already enabled');
        return;
    }

    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create timestamped log file
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const logFileName = `debug-${timestamp}.log`;
    currentLogFile = path.join(logsDir, logFileName);

    // Open file stream
    logStream = fs.createWriteStream(currentLogFile, { flags: 'a' });
    debugMode = true;

    log('Debug mode enabled. Logging to:', currentLogFile);
}

/**
 * Disable debug mode and close log file
 */
function disableDebugMode() {
    if (!debugMode) {
        return;
    }

    log('Debug mode disabled');

    if (logStream) {
        logStream.end();
        logStream = null;
    }

    debugMode = false;
    currentLogFile = null;
}

/**
 * Get the current log file path
 */
function getLogFilePath() {
    return currentLogFile;
}

/**
 * Check if debug mode is currently enabled
 */
function isDebugEnabled() {
    return debugMode;
}

module.exports = {
    log,
    error,
    enableDebugMode,
    disableDebugMode,
    getLogFilePath,
    isDebugEnabled
};
