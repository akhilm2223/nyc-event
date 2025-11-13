/**
 * Cache Logger Service
 * Provides logging functionality for the query cache system
 */

import fs from 'fs';

let fileLoggingEnabled = false;
let consoleLoggingEnabled = true;
let logFilePath = './cache.log';

// Log startup message to confirm logging is active
console.log('\n🔧 [CACHE LOGGER] Console logging ENABLED - all cache operations will be printed to terminal');

/**
 * Log a message to console and/or file
 * @param {string} message - Message to log
 */
export function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  if (consoleLoggingEnabled) {
    console.log(logMessage);
  }
  
  if (fileLoggingEnabled) {
    try {
      fs.appendFileSync(logFilePath, logMessage + '\n', 'utf8');
    } catch (error) {
      // Silently fail if file logging fails to avoid breaking the cache
      if (consoleLoggingEnabled) {
        console.error('Failed to write to log file:', error.message);
      }
    }
  }
}

/**
 * Enable or disable file logging
 * @param {boolean} enabled - Whether to enable file logging
 * @param {string} filePath - Optional file path (default: './cache.log')
 */
export function setFileLogging(enabled, filePath = './cache.log') {
  fileLoggingEnabled = enabled;
  logFilePath = filePath;
  if (enabled) {
    console.log(`File logging ENABLED (file: ${filePath})`);
  } else {
    console.log('File logging DISABLED');
  }
}

/**
 * Enable or disable console logging
 * @param {boolean} enabled - Whether to enable console logging
 */
export function setConsoleLogging(enabled) {
  consoleLoggingEnabled = enabled;
  console.log(`Console logging ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

/**
 * Get current logging configuration
 * @returns {Object} - Logging configuration
 */
export function getLoggingConfig() {
  return {
    fileLogging: fileLoggingEnabled,
    consoleLogging: consoleLoggingEnabled,
    logFilePath: logFilePath
  };
}

/**
 * Clear the log file
 */
export function clearLogFile() {
  if (fileLoggingEnabled) {
    try {
      fs.writeFileSync(logFilePath, '', 'utf8');
      console.log('Log file cleared');
    } catch (error) {
      console.error('Failed to clear log file:', error.message);
    }
  }
}

