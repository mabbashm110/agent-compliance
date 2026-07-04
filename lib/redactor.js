const crypto = require('crypto');

// Standard high-precision regex patterns for PII/PHI detection
const PATTERNS = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  CREDIT_CARD: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  MRN: /\bMRN[-:\s]?\d{6,9}\b/ig, // Medical Record Number
  PHONE_NUMBER: /\b(?:\+?\d{1,3}[- .]?)?\(?\d{3}\)?[- .]?\d{3}[- .]?\d{4}\b|\b\d{3}[- .]?\d{4}\b/g,
};

/**
 * Computes SHA-256 hash of a string, truncated for clean visibility
 */
function hashString(str) {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

/**
 * Redacts PII and PHI from a text block.
 * @param {string} text - The input text to sanitize.
 * @param {string} mode - The redaction style: 'mask' | 'hash' | 'redact'.
 * @returns {string} The sanitized text.
 */
function redact(text, mode = 'mask') {
  if (!text || typeof text !== 'string') return text;

  let sanitized = text;

  for (let [label, regex] of Object.entries(PATTERNS)) {
    sanitized = sanitized.replace(regex, (match) => {
      if (mode === 'hash') {
        return `[${label}_HASH:${hashString(match)}]`;
      } else if (mode === 'redact') {
        return '[REDACTED]';
      } else {
        // Default to 'mask' style
        return `[${label}_REDACTED]`;
      }
    });
  }

  return sanitized;
}

/**
 * Checks if the text contains any unredacted PII or PHI.
 */
function containsPII(text) {
  if (!text || typeof text !== 'string') return false;
  
  for (let regex of Object.values(PATTERNS)) {
    // Reset regex index for safety
    regex.lastIndex = 0;
    if (regex.test(text)) {
      return true;
    }
  }
  return false;
}

module.exports = {
  redact,
  containsPII,
  PATTERNS
};
