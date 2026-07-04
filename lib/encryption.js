const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a string using AES-256-GCM
 * @param {string} text - The plaintext to encrypt
 * @param {string} keyHex - The 32-byte encryption key in hex format (64 chars)
 * @returns {object} { ciphertext, iv, authTag } as hex strings
 */
function encrypt(text, keyHex) {
  if (!text) return null;
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be a 32-byte hex string (64 characters).');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let ciphertext = cipher.update(text, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag
  };
}

/**
 * Decrypts a ciphertext object using AES-256-GCM
 * @param {string} ciphertext - Hex ciphertext
 * @param {string} iv - Hex IV
 * @param {string} authTag - Hex authentication tag
 * @param {string} keyHex - The 32-byte encryption key in hex format
 * @returns {string} Plaintext
 */
function decrypt(ciphertext, iv, authTag, keyHex) {
  if (!ciphertext || !iv || !authTag) return null;
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Decryption key must be a 32-byte hex string (64 characters).');
  }

  const ivBuf = Buffer.from(iv, 'hex');
  const authTagBuf = Buffer.from(authTag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(authTagBuf);

  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Generates a random 32-byte key in hex format
 */
function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  encrypt,
  decrypt,
  generateKey
};
