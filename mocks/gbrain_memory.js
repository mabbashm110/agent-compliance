const fs = require('fs');
const path = require('path');
const { encrypt, decrypt } = require('../lib/encryption');
const { containsPII } = require('../lib/redactor');
const { execSync } = require('child_process');

const DB_PATH = path.resolve(__dirname, 'gbrain_db.json');
const COMPLIANCE_DIR = path.resolve(__dirname, '../');
const STATE_FILE = path.join(COMPLIANCE_DIR, 'compliance.json');
const CLI_PATH = path.join(COMPLIANCE_DIR, 'bin/compliance.js');

class GBrainMemoryMock {
  constructor() {
    this.initDb();
  }

  initDb() {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2), 'utf8');
    }
  }

  getKey() {
    if (!fs.existsSync(STATE_FILE)) {
      throw new Error("Compliance state file missing. Run compliance init first.");
    }
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return state.encryptionKey;
  }

  writePage(id, content, classification = 'public') {
    console.log(`\n--- [GBrain Memory] Writing Page '${id}' (Class: ${classification}) ---`);
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const key = this.getKey();

    let record = {
      id,
      classification,
      content: content,
      encrypted: false,
      timestamp: new Date().toISOString()
    };

    if (classification === 'phi' || classification === 'pii') {
      const encryptedData = encrypt(content, key);
      record.content = encryptedData.ciphertext;
      record.iv = encryptedData.iv;
      record.authTag = encryptedData.authTag;
      record.encrypted = true;
      console.log(`[GBrain Memory] Encrypted at rest using AES-256-GCM. Ciphertext: ${record.content.slice(0, 20)}...`);
    } else {
      console.log(`[GBrain Memory] Written in Plaintext.`);
    }

    db[id] = record;
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  }

  readPage(id, clientScopes = []) {
    console.log(`\n--- [GBrain Memory] Reading Page '${id}' (Client Scopes: ${clientScopes.join(', ') || 'none'}) ---`);
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const record = db[id];

    if (!record) {
      console.log(`[GBrain Memory] Page '${id}' not found.`);
      return null;
    }

    if (record.encrypted) {
      const requiredScope = `${record.classification}:read`;
      if (!clientScopes.includes(requiredScope)) {
        const masked = `[REDACTED: Scopes missing required permission: ${requiredScope}]`;
        console.log(`[GBrain Memory] Access DENIED. Returning masked payload.`);
        return masked;
      }

      try {
        const key = this.getKey();
        const plaintext = decrypt(record.content, record.iv, record.authTag, key);
        console.log(`[GBrain Memory] Access GRANTED. Decrypted plaintext successfully.`);
        return plaintext;
      } catch (e) {
        console.error(`[GBrain Memory] Decryption failed: ${e.message}`);
        return `[ERROR: Decryption Failed]`;
      }
    }

    console.log(`[GBrain Memory] Access GRANTED. Returning plaintext.`);
    return record.content;
  }

  /**
   * Simulates the 24/7 dream cycle background cron audit.
   * Scans pages to find plain text entries containing unredacted PII/PHI.
   */
  runDreamCycleAudit() {
    console.log(`\n--- [GBrain Dream Cycle Audit] Starting background compliance scan... ---`);
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    let violations = 0;

    for (let [id, record] of Object.entries(db)) {
      if (!record.encrypted && containsPII(record.content)) {
        console.warn(`[!] GBrain Dream Cycle Alert: Plaintext PII/PHI detected on public page '${id}'!`);
        violations++;

        // Log violation in compliance state using CLI
        try {
          execSync(`node "${CLI_PATH}" audit log-violation`, {
            input: JSON.stringify({
              reason: `Unencrypted PII/PHI leak detected in database page: ${id}`,
              source: 'gbrain_dream_cycle',
              pageId: id
            }),
            encoding: 'utf8'
          });
        } catch (e) {
          console.error("Failed to log dream cycle violation:", e.message);
        }
      }
    }

    console.log(`[GBrain Dream Cycle] Scan finished. Flagged ${violations} public violations.`);
    return violations;
  }
}

module.exports = GBrainMemoryMock;
