# Developer Extension Guide: Extending the Compliance Framework

This guide explains how developers can extend the compliance engine to support new frameworks, custom redaction rules, advanced verification subcommands, and enterprise encryption proxies.

---

## 1. Adding a New Compliance Profile

Compliance profiles are defined in markdown files containing a YAML block. To add a new framework (e.g., **GDPR** or **PCI-DSS**):

### Step 1: Create the Profile File
Add a new markdown file under `compliance/profiles/` (e.g., `compliance/profiles/GDPR.md`).

### Step 2: Define Core Frontmatter Controls
Ensure your markdown file begins with a YAML code block defining the ID, Title, Controls, and Tool restrictions.

Example GDPR Profile (`compliance/profiles/GDPR.md`):
```yaml
id: GDPR
title: General Data Protection Regulation
version: 1.0.0

controls:
  data_residency:
    allowed_regions:
      - eu-west-1
      - eu-central-1
  retention:
    session_expiry_days: 30
    auto_delete_unreferenced: true

tool_restrictions:
  GDPR:
    blocked_tools:
      - external_analytics_dispatch
    allowed_tools:
      - secure_vault_write
```

### Step 3: Verify the Profile
Run the check subcommand to lint and validate the syntax:
```bash
compliance check compliance/profiles/GDPR.md
```

---

## 2. Extending the Redaction & Data Classification Engine

The redaction engine uses regex-based mapping in `lib/redactor.js`. You can extend this with custom patterns or external API classifiers.

### Extending Patterns in `lib/redactor.js`
Open [lib/redactor.js](../lib/redactor.js) and add your custom classification keys to the `PATTERNS` object.

For example, to detect Canadian Social Insurance Numbers (SIN):
```javascript
const PATTERNS = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // ...
  SIN: /\b\d{3}-\d{3}-\d{3}\b/g, // Canadian SIN
  MRN: /\bMRN[-:\s]?\d{6,9}\b/ig
};
```
*Note: Make sure to place more specific identifiers (like MRNs or SINs) BEFORE generic patterns (like phone numbers) to prevent collision masking.*

### Integrating External NER Classifiers
To use an external NLP model (such as a local spaCy endpoint or HuggingFace NER service) for complex semantic entities like human names or hospital locations, update `redact()` inside `lib/redactor.js`:

```javascript
async function redactWithNER(text) {
  // 1. Run regex-based redaction first
  let redacted = redact(text, 'mask');

  // 2. Query external NER service for names and locations
  try {
    const response = await fetch('http://localhost:8080/ner', {
      method: 'POST',
      body: JSON.stringify({ text: redacted }),
      headers: { 'Content-Type': 'application/json' }
    });
    const entities = await response.json();
    
    // Replace detected entities (e.g. Person, Location)
    for (let ent of entities) {
      redacted = redacted.replace(ent.text, `[${ent.label.toUpperCase()}_REDACTED]`);
    }
  } catch (e) {
    console.error("NER classifier offline, falling back to regex-only.");
  }

  return redacted;
}
```

---

## 3. Creating Custom Verification Modes

The `compliance verify` command determines if operations should be allowed or blocked. You can add new modes (e.g. `--mode sandbox` or `--mode cost`) by updating [compliance.js](../bin/compliance.js).

### Step 1: Register Subcommand options
Inside the `handleVerify()` block:
```javascript
if (!mode || !['tool', 'a2a', 'a2p', 'sandbox'].includes(mode)) {
  console.error("Usage: compliance verify --mode <tool|a2a|a2p|sandbox>");
  process.exit(1);
}
```

### Step 2: Implement Sandbox Validation
Add logic to inspect execution configurations:
```javascript
if (mode === 'sandbox') {
  const { environment, allow_networking } = payload;
  
  // Enforce that under SOC2, non-sandboxed bash tools cannot access the internet
  if (environment === 'local' && allow_networking === true) {
    decision = 'BLOCK';
    reason = 'SOC2 Control Integrity Violation: Internet access from local bash execution is disabled.';
  }
}
```

---

## 4. Customizing GBrain Database Encryption & Key Management

By default, [gbrain_memory.js](../mocks/gbrain_memory.js) uses local file keys stored in `compliance.json`. In production, you can replace this with cloud-managed key management systems (KMS).

### Integrating AWS KMS
Inside [lib/encryption.js](../lib/encryption.js), you can update the cipher hooks to use the AWS SDK:

```javascript
const { KMSClient, EncryptCommand, DecryptCommand } = require("@aws-sdk/client-kms");

const kms = new KMSClient({ region: "us-east-1" });
const KEY_ID = "arn:aws:kms:us-east-1:123456789012:key/your-key-uuid";

async function encryptKMS(text) {
  const command = new EncryptCommand({
    KeyId: KEY_ID,
    Plaintext: Buffer.from(text, 'utf-8')
  });
  const response = await kms.send(command);
  return response.CiphertextBlob.toString('base64');
}

async function decryptKMS(ciphertextBase64) {
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertextBase64, 'base64')
  });
  const response = await kms.send(command);
  return response.Plaintext.toString('utf-8');
}
```
Using KMS ensures that decryption keys are never stored in memory configurations, aligning with **SOC2 Confidentiality** controls.
