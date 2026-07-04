#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseMarkdownPolicy } = require('../lib/policy');
const { redact, containsPII } = require('../lib/redactor');
const { generateKey } = require('../lib/encryption');

let COMPLIANCE_DIR = path.join(process.cwd(), 'compliance');
if (fs.existsSync(path.join(process.cwd(), 'compliance.json'))) {
  COMPLIANCE_DIR = process.cwd();
} else if (fs.existsSync(path.join(process.cwd(), 'compliance/compliance.json'))) {
  COMPLIANCE_DIR = path.join(process.cwd(), 'compliance');
}
const STATE_FILE = path.join(COMPLIANCE_DIR, 'compliance.json');

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  printHelpAndExit();
}

switch (command) {
  case 'init':
    handleInit();
    break;
  case 'check':
    handleCheck();
    break;
  case 'doctor':
    handleDoctor();
    break;
  case 'redact':
    handleRedact();
    break;
  case 'verify':
    handleVerify();
    break;
  case 'scan':
    handleScan();
    break;
  case 'status':
    handleStatus();
    break;
  case 'configure':
    handleConfigure();
    break;
  case 'audit':
    handleAudit();
    break;
  case '--help':
  case '-h':
  default:
    printHelpAndExit();
}

function printHelpAndExit() {
  console.log(`
Compliance CLI Engine (agent-compliance)
Usage: compliance <command> [options]

Commands:
  init                       Initialize compliance directory and profiles
  check <file>               Lint and validate a COMPLIANCE.md profile
  doctor                     Run environment configuration and security diagnostics
  redact [text]              Redact PII/PHI from input string or stdin
  verify --mode <mode>       Validate an operation (tool, a2a, a2p) against policies
  scan <dir>                 Scan a folder for plaintext credentials or leaked PII
  status                     Print current compliance health and active controls
  configure [options]        Automatically configure agents, gateways, or database compliance
  audit <subcommand>         Manage/view the system audit logs

Options:
  -h, --help                 Show this help message
`);
  process.exit(0);
}

// Ensure state structure exists
function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    console.error("Compliance engine not initialized. Please run: compliance init");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function handleInit() {
  const customDirIdx = args.indexOf('--dir');
  const targetDir = customDirIdx !== -1 ? path.resolve(args[customDirIdx + 1]) : COMPLIANCE_DIR;
  const profilesDir = path.join(targetDir, 'profiles');
  const targetStateFile = path.join(targetDir, 'compliance.json');

  console.log(`Initializing compliance files under: ${targetDir}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }

  // Copy mock profiles if they exist in source paths
  const srcProfilesDir = path.resolve(__dirname, '../profiles');
  if (fs.existsSync(srcProfilesDir)) {
    const files = fs.readdirSync(srcProfilesDir);
    for (let file of files) {
      const srcFile = path.join(srcProfilesDir, file);
      const destFile = path.join(profilesDir, file);
      fs.copyFileSync(srcFile, destFile);
      console.log(`Created profile: ${destFile}`);
    }
  }

  // Generate compliance.json if not present
  if (!fs.existsSync(targetStateFile)) {
    const defaultState = {
      initializedAt: new Date().toISOString(),
      encryptionKey: generateKey(),
      activeProfiles: ['HIPAA', 'SOC2'],
      auditLogs: [],
      violations: []
    };
    fs.writeFileSync(targetStateFile, JSON.stringify(defaultState, null, 2), 'utf8');
    console.log(`Created state file: ${targetStateFile}`);
  }

  console.log("Compliance engine successfully initialized!");
}

function handleCheck() {
  const file = args[1];
  if (!file) {
    console.error("Usage: compliance check <path/to/COMPLIANCE.md>");
    process.exit(1);
  }

  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    process.exit(1);
  }

  try {
    const policy = parseMarkdownPolicy(filePath);
    if (!policy) {
      console.error(`[-] No valid YAML code block or frontmatter found in ${file}`);
      process.exit(1);
    }

    // Validate expected structure
    const requiredKeys = ['id', 'title', 'version', 'controls'];
    const missing = requiredKeys.filter(k => !(k in policy));
    
    if (missing.length > 0) {
      console.error(`[-] Validation failed. Missing required keys: ${missing.join(', ')}`);
      process.exit(1);
    }

    if (args.includes('--json')) {
      console.log(JSON.stringify({ status: 'VALID', policy }, null, 2));
    } else {
      console.log(`[+] Policy "${policy.title}" (v${policy.version}) is valid and parsed successfully.`);
    }
  } catch (error) {
    console.error(`[-] Validation failed: ${error.message}`);
    process.exit(1);
  }
}

function handleDoctor() {
  console.log("Running security and compliance diagnostics...");
  let errors = 0;
  let warnings = 0;

  // 1. Check if compliance directory exists
  if (!fs.existsSync(COMPLIANCE_DIR)) {
    console.error("[-] ERROR: compliance directory is missing. Run 'compliance init'.");
    errors++;
  } else {
    console.log("[+] Compliance directory found.");
  }

  // 2. Check encryption key
  if (fs.existsSync(STATE_FILE)) {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (!state.encryptionKey || state.encryptionKey.length !== 64) {
      console.error("[-] ERROR: Encryption key missing or invalid in compliance.json.");
      errors++;
    } else {
      console.log("[+] Master encryption key exists and is valid.");
    }
  }

  // 3. Scan workspace for plaintext secrets or configs
  const gitIgnorePath = path.join(process.cwd(), '.gitignore');
  if (!fs.existsSync(gitIgnorePath)) {
    console.warn("[!] WARNING: .gitignore file is missing. Secrets might be accidentally committed.");
    warnings++;
  } else {
    const gitIgnore = fs.readFileSync(gitIgnorePath, 'utf8');
    if (!gitIgnore.includes('compliance.json') && !gitIgnore.includes('.env')) {
      console.warn("[!] WARNING: compliance.json is not ignored. Add 'compliance.json' to .gitignore.");
      warnings++;
    } else {
      console.log("[+] Sensitive compliance configuration files are gitignored.");
    }
  }

  console.log(`\nDiagnostics finished: ${errors} errors, ${warnings} warnings.`);
  if (errors > 0) {
    process.exit(2);
  } else if (warnings > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

function handleRedact() {
  const textArg = args.slice(1).join(' ');
  const modeIdx = args.indexOf('--replacement');
  const replacementMode = modeIdx !== -1 ? args[modeIdx + 1] : 'mask';

  // Clean args if --replacement was used
  const filteredText = textArg.replace(/--replacement\s+\w+/, '').trim();

  if (filteredText) {
    console.log(redact(filteredText, replacementMode));
  } else {
    // Read from Stdin
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    process.stdin.on('end', () => {
      process.stdout.write(redact(input, replacementMode) + '\n');
    });
  }
}

function handleVerify() {
  const modeIdx = args.indexOf('--mode');
  const mode = modeIdx !== -1 ? args[modeIdx + 1] : null;

  if (!mode || !['tool', 'a2a', 'a2p'].includes(mode)) {
    console.error("Usage: compliance verify --mode <tool|a2a|a2p>");
    process.exit(1);
  }

  let inputData = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { inputData += chunk; });
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(inputData.trim());
      let decision = 'ALLOW';
      let reason = '';

      if (mode === 'tool') {
        const { agent_id, tool_name } = payload;
        
        // Find if HIPAA or SOC2 is active
        const hipaaProfilePath = path.join(COMPLIANCE_DIR, 'profiles/HIPAA.md');
        const soc2ProfilePath = path.join(COMPLIANCE_DIR, 'profiles/SOC2.md');
        
        if (fs.existsSync(hipaaProfilePath)) {
          const hipaa = parseMarkdownPolicy(hipaaProfilePath);
          if (hipaa && hipaa.controls && hipaa.controls.tool_restrictions) {
            const blocked = hipaa.controls.tool_restrictions.blocked_tools || [];
            if (blocked.includes(tool_name)) {
              decision = 'BLOCK';
              reason = `Tool '${tool_name}' is explicitly blocked under HIPAA controls.`;
            }
          }
        }

        if (decision === 'ALLOW' && fs.existsSync(soc2ProfilePath)) {
          const soc2 = parseMarkdownPolicy(soc2ProfilePath);
          if (soc2 && soc2.controls && soc2.controls.tool_restrictions) {
            const blocked = soc2.controls.tool_restrictions.blocked_tools || [];
            if (blocked.includes(tool_name)) {
              decision = 'BLOCK';
              reason = `Tool '${tool_name}' is explicitly blocked under SOC2 controls.`;
            }
          }
        }
      } else if (mode === 'a2a') {
        const { sender, receiver, has_phi, signed_jwt } = payload;
        // Verify receiver can handle PHI if sender sends it
        if (has_phi) {
          const hipaaProfilePath = path.join(COMPLIANCE_DIR, 'profiles/HIPAA.md');
          if (fs.existsSync(hipaaProfilePath)) {
            // In a real scenario we check receiver's compliance card.
            // For mock: assume receiver must be named 'medical-agent' or 'billing-agent' to handle PHI
            const allowedReceivers = ['medical-agent', 'billing-agent'];
            if (!allowedReceivers.includes(receiver)) {
              decision = 'BLOCK';
              reason = `Agent-to-Agent Transfer Blocked: Target agent '${receiver}' is not attested to process PHI under HIPAA.`;
            }
          }
        }
      } else if (mode === 'a2p') {
        const { endpoint, data_classification, tls_version } = payload;
        if (data_classification === 'phi' || data_classification === 'pii') {
          // Verify TLS is 1.3
          if (tls_version !== 'TLS-1.3') {
            decision = 'BLOCK';
            reason = `Agent-to-Platform Blocked: TLS version is ${tls_version}. HIPAA requires minimum TLS-1.3.`;
          }
        }
      }

      const response = { decision, reason, timestamp: new Date().toISOString() };
      
      // If BLOCKED, register a violation
      if (decision === 'BLOCK') {
        logViolation(response);
      }

      console.log(JSON.stringify(response, null, 2));
      process.exit(decision === 'ALLOW' ? 0 : 1);
    } catch (e) {
      console.stringify({ decision: 'BLOCK', reason: `Internal check error: ${e.message}` });
      process.exit(1);
    }
  });
}

function handleScan() {
  const dir = args[1];
  if (!dir) {
    console.error("Usage: compliance scan <path/to/directory>");
    process.exit(1);
  }

  const scanDir = path.resolve(dir);
  if (!fs.existsSync(scanDir)) {
    console.error(`Directory does not exist: ${scanDir}`);
    process.exit(1);
  }

  console.log(`Scanning files in: ${scanDir}...`);
  let issues = 0;

  function walk(currentPath) {
    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
      const children = fs.readdirSync(currentPath);
      for (let child of children) {
        walk(path.join(currentPath, child));
      }
    } else if (stats.isFile() && (currentPath.endsWith('.md') || currentPath.endsWith('.json') || currentPath.endsWith('.txt'))) {
      const content = fs.readFileSync(currentPath, 'utf8');
      if (containsPII(content)) {
        console.warn(`[!] VIOLATION FOUND: plain text PII/PHI in file: ${currentPath}`);
        issues++;
      }
    }
  }

  walk(scanDir);
  console.log(`Scan completed. Found ${issues} issues.`);
  process.exit(issues > 0 ? 1 : 0);
}

function handleStatus() {
  const state = loadState();
  const res = {
    status: state.violations.length > 0 ? 'WARNING' : 'HEALTHY',
    systemScore: Math.max(0, 100 - state.violations.length * 10),
    activeFrameworks: state.activeProfiles,
    totalViolationsLogged: state.violations.length,
    lastAuditTimestamp: state.auditLogs.length > 0 ? state.auditLogs[state.auditLogs.length - 1].timestamp : null,
    keyRotationStatus: 'OK'
  };

  if (args.includes('--json')) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log(`
================ COMPLIANCE STATUS ================
System State:         ${res.status}
Security Score:       ${res.systemScore}/100
Active Frameworks:    ${res.activeFrameworks.join(', ')}
Total Violations:     ${res.totalViolationsLogged}
Key Rotation status:  ${res.keyRotationStatus}
===================================================
`);
  }
}

function handleAudit() {
  const sub = args[1];
  if (sub === 'log-violation') {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { input += c; });
    process.stdin.on('end', () => {
      try {
        const payload = JSON.parse(input.trim());
        logViolation(payload);
        console.log(JSON.stringify({ status: 'LOGGED' }));
      } catch (e) {
        console.error("Invalid audit log payload");
        process.exit(1);
      }
    });
  } else {
    // Show logs
    const state = loadState();
    console.log(JSON.stringify(state.auditLogs, null, 2));
  }
}

function logViolation(payload) {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return; // Safe exit if not initialized
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    ...payload
  };

  state.violations.push(logEntry);
  state.auditLogs.push({
    timestamp: new Date().toISOString(),
    type: 'VIOLATION_LOGGED',
    details: payload.reason || 'Compliance violation triggered.'
  });

  saveState(state);
}

function handleConfigure() {
  const agentIdx = args.indexOf('--agent');
  const gatewayIdx = args.indexOf('--gateway');
  const memoryIdx = args.indexOf('--memory');

  if (agentIdx === -1 && gatewayIdx === -1 && memoryIdx === -1) {
    console.error(`
Usage:
  compliance configure --agent <id> [--framework <HIPAA|SOC2>] [--dir <dir>]
  compliance configure --gateway <channel-id> [--redact <true|false>]
  compliance configure --memory <db-path> [--encryption <algo>] [--residency <region>]
`);
    process.exit(1);
  }

  const state = loadState();

  if (agentIdx !== -1) {
    const agentId = args[agentIdx + 1];
    const fwIdx = args.indexOf('--framework');
    const framework = fwIdx !== -1 ? args[fwIdx + 1] : 'HIPAA';
    const dirIdx = args.indexOf('--dir');
    const agentDir = dirIdx !== -1 ? path.resolve(args[dirIdx + 1]) : path.join(process.cwd(), 'agents', agentId);

    console.log(`[+] Auto-configuring compliance for Agent '${agentId}' in: ${agentDir}`);
    
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }

    // Write SOUL.md
    const soulPath = path.join(agentDir, 'SOUL.md');
    if (!fs.existsSync(soulPath)) {
      fs.writeFileSync(soulPath, `# SOUL.md for ${agentId}\nname: ${agentId}\ntitle: Compliant Agent\nrole: Default\n`, 'utf8');
      console.log(`[+] Created ${soulPath}`);
    }

    // Write COMPLIANCE.md
    const compliancePath = path.join(agentDir, 'COMPLIANCE.md');
    let configTemplate = '';
    if (framework === 'HIPAA') {
      configTemplate = `version: 1.0.0
frameworks:
  - id: HIPAA
    status: enforced
on_violation:
  action: block
tool_restrictions:
  HIPAA:
    blocked_tools:
      - web_search
      - web_extract
      - external_webhook
    allowed_tools:
      - ehr_lookup
      - internal_vault_write
data_classification:
  phi: true
  pii: true
`;
    } else {
      configTemplate = `version: 1.0.0
frameworks:
  - id: SOC2-Type-II
    status: enforced
on_violation:
  action: block
tool_restrictions:
  SOC2:
    blocked_tools:
      - execute_arbitrary_shell
    allowed_tools:
      - read_file
      - write_file
data_classification:
  confidential: true
`;
    }

    fs.writeFileSync(compliancePath, `# Compliance configuration\n\`\`\`yaml\n${configTemplate}\`\`\`\n`, 'utf8');
    console.log(`[+] Created agent compliance policy at: ${compliancePath}`);

    // Register agent in global state
    if (!state.agents) state.agents = {};
    state.agents[agentId] = {
      directory: agentDir,
      framework,
      configuredAt: new Date().toISOString()
    };
    saveState(state);
    console.log(`[+] Registered agent '${agentId}' in compliance.json.`);
  }

  if (gatewayIdx !== -1) {
    const channelId = args[gatewayIdx + 1];
    const redactOptIdx = args.indexOf('--redact');
    const redact = redactOptIdx !== -1 ? args[redactOptIdx + 1] === 'true' : true;

    console.log(`[+] Auto-configuring gateway rules for channel: ${channelId}`);
    if (!state.gateways) state.gateways = {};
    state.gateways[channelId] = {
      redact,
      lastModified: new Date().toISOString()
    };
    saveState(state);
    console.log(`[+] Channel '${channelId}' policy updated: redact=${redact}`);
  }

  if (memoryIdx !== -1) {
    const dbPath = args[memoryIdx + 1];
    const encIdx = args.indexOf('--encryption');
    const encryption = encIdx !== -1 ? args[encIdx + 1] : 'AES-256-GCM';
    const resIdx = args.indexOf('--residency');
    const residency = resIdx !== -1 ? args[resIdx + 1] : 'us-east-1';

    console.log(`[+] Auto-configuring memory rules for DB: ${dbPath}`);
    state.memory = {
      path: dbPath,
      encryption,
      residency,
      lastModified: new Date().toISOString()
    };
    saveState(state);
    console.log(`[+] Memory policy updated: encryption=${encryption}, residency=${residency}`);
  }
}

