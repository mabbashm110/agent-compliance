# End-to-End Compliance Verification Guide for AI Agents with OpenClaw, Hermes and GBrain

🛡️ **Open-Source Enterprise-Grade Governance & Policy Enforcement for Autonomous Agent Swarms**

**Version:** v0.1 | **Published Date:** 2026-07-04 | ⭐ **Star us on GitHub:** [mabbashm110/agent-compliance](https://github.com/mabbashm110/agent-compliance)

Implementing AI agents (Hermes, OpenClaw, and GBrain databases) in regulated industries—such as healthcare, banking, and insurance—demands strict alignment with compliance frameworks like **HIPAA** and **SOC2**.

`agent-compliance` is a lightweight, zero-dependency, and high-performance policy engine designed specifically to protect sensitive data at every point of the AI execution pipeline: from gateway messages to agent trajectories and database memory layers. It provides the security boundaries required to transition AI agent deployments from experimental sandboxes to fully certified enterprise production workloads.

---

## 📋 Table of Contents
- [1. Enterprise Value Proposition](#-enterprise-value-proposition)
- [2. Directory Layout](#-directory-layout)
- [3. Installation & Local Setup](#3-installation--local-setup)
- [4. E2E Testing Scenarios](#4-e2e-testing-scenarios)
- [5. Integration Connection Models](#5-integration-connection-models)
- [6. Configuring Agents for Compliance](#6-configuring-agents-for-compliance)
- [7. Manual CLI Diagnostics & Commands](#7-manual-cli-diagnostics--commands)
- [8. How to Contribute](#-how-to-contribute)

---

## 🛡️ Enterprise Value Proposition
* **Zero Trust Trajectory Monitoring**: Automatically intercepts and blocks non-compliant agent tools (e.g., preventing public search access when parsing Patient Health Information).
* **Deterministic Input/Output Redaction**: Custom high-speed regular expression engine to automatically scrub credentials, MRNs, SSNs, credit cards, and emails before they reach LLM prompts.
* **Scope-Gated AES-256-GCM Storage**: Integrates directly with memory modules (like GBrain) to encrypt sensitive nodes at rest and restrict decryption privileges based on JWT authentication scopes.
* **Continuous System Audits**: Built-in "Dream Cycle" background scanners sweep databases to capture plaintext leaks and register audit logs to satisfy compliance officer requirements.

---

## 📂 Directory Layout

This directory contains a standalone, zero-dependency implementation of the **Compliance CLI (`compliance`)** and integration shims/mocks representing the gateway, agent, and memory layers.

```
compliance/
├── bin/compliance.js           # The core executable CLI
├── lib/                        # CLI internal libraries (policy, redactor, encryption)
├── profiles/                   # Active compliance profiles (HIPAA.md, SOC2.md)
├── mocks/                      # Interceptor mock modules (OpenClaw, Hermes, GBrain)
├── docs/                       # Scenarios, templates, and extendability guidelines
│   ├── README.md               # Setup and testing instructions (This document)
│   ├── extend.md               # Guide for developers to add new frameworks/rules
│   └── COMPLIANCE_DEFAULT.md   # Default HIPAA/SOC2 compliance profile template
├── package.json                # npm package configuration
└── compliance.json             # Global CLI state (audit logs, keys, violations)
```

---

## 1. Installation & Local Setup

The package is packaged as a local NPM project. You can link and run commands globally.

### Step 1: Install Dependencies (None Required) & Link CLI
Run the following commands inside the `compliance/` folder to install the package and link the binary globally:
```bash
cd compliance
npm link
```
*Note: This exposes the `compliance` command globally on your terminal path. If permissions are restricted, you can run it via `node bin/compliance.js`.*

### Step 2: Initialize Compliance files
Initialize the workspace to copy baseline HIPAA/SOC2 profiles and generate the master encryption key:
```bash
compliance init
```
This generates the `./compliance/compliance.json` state configuration holding the secure master key.

### Step 3: Run the Verification Tests
You can verify the CLI modules and mocks by executing the test command:
```bash
npm test
```

---

## 2. Integration Connection Models

The compliance engine acts as a unified gatekeeper. Depending on your database topography, it connects in one of two configurations:

### Configuration A: Gateway + Agent (Without GBrain)
In this layout, compliance rules are enforced purely at the communication entry gate (OpenClaw) and the tool dispatch loop (Hermes). Memory is ephemeral or scoped to local files.

```
[ Slack / messaging channel ]
             │
             ▼ (OpenClaw Gateway)
   [ Gateway Interceptor ] ───► queries: `compliance redact`
             │
             ▼ (Hermes Agent Runtime)
   [ Agent Tool Dispatcher] ──► queries: `compliance verify --mode tool`
```

1. **Gate Input Sanitization**: OpenClaw Gateway receives user messages and pipes text to `compliance redact` via local shell process calls before parsing parameters to the agent.
2. **Tool Security**: The Hermes agent parses tool requests (e.g. `web_search`) and executes `compliance verify --mode tool` checks. Forbidden commands are blocked, raising local agent exceptions.

---

### Configuration B: Gateway + Agent + DB (With GBrain)
In this layout, the compliance engine extends down to the database layers, actively managing field-level key rotations, role-based scopes on read queries, and background audit sweeps.

```
[ Slack / messaging channel ]
             │
             ▼ (OpenClaw Gateway)
   [ Gateway Interceptor ] ───► `compliance redact`
             │
             ▼ (Hermes Agent Runtime)
   [ Agent Tool Dispatcher] ──► `compliance verify --mode tool`
             │
             ▼ (GBrain DB Proxy)
   [ Vector / Graph Store ] ──► Encrypts PII/PHI at rest using state master key.
                              └── Decrypts ONLY if query has matching JWT scopes.
             │
             ▼ (24/7 background cron)
   [ GBrain Dream Cycle ] ───► Runs `compliance scan` to flag plain text leaks.
```

1. **AES-256-GCM Storage**: Sensitive pages written by Hermes to GBrain classified as `phi` or `pii` are encrypted before SQL/vector insertion.
2. **Scope Gates**: Reading pages requires a matching JWT scope validation check (e.g., `phi:read`).
3. **Dream Cycle sweeps**: A background cron runs `compliance scan` across database records overnight to identify plain text PII leakage or credential configurations.

---

## 3. Configuring Agents for Compliance

To make agents compliant, developers and users configure active controls in markdown definitions.

### How to Configure an Agent
1. **Create/Update agent `COMPLIANCE.md`**: Create a `COMPLIANCE.md` file in the agent's work directory (or copy [COMPLIANCE_DEFAULT.md](./COMPLIANCE_DEFAULT.md)):
   ```yaml
   version: 1.0.0
   frameworks:
     - id: HIPAA
       status: enforced
   on_violation:
     action: block
   ```
2. **Define Agent Tool Rules**: Map the allowed/blocked tools for that agent role:
   ```yaml
   tool_restrictions:
     HIPAA:
       blocked_tools:
         - web_search
       allowed_tools:
         - local_file_read
   ```
3. **Verify Configuration**: Run the checker on the configuration:
   ```bash
   compliance check path/to/agent/COMPLIANCE.md
   ```
4. **Deploy Gateway Middleware**: Ensure the OpenClaw gateway config references this agent scope, triggering redaction and JWT generation with corresponding scopes (`phi:read`) when authorized users interact.

---

## 4. Manual CLI Diagnostics & Commands

Once installed, use these commands for manual checking and debugging:

### Check System Configurations
Verify that your encryption keys are set up and sensitive state files are gitignored:
```bash
compliance doctor
```
**Expected Output:**
```text
Running security and compliance diagnostics...
[+] Compliance directory found.
[+] Master encryption key exists and is valid.
[+] Sensitive compliance configuration files are gitignored.

Diagnostics finished: 0 errors, 0 warnings.
```

### Manual Redaction Checks
Check how specific strings get redacted:
```bash
compliance redact "Patient SSN is 123-45-6789 and email is doctor@hospital.org"
```
**Expected Output:**
```text
Patient SSN is [SSN_REDACTED] and email is [EMAIL_REDACTED]
```

### Fetch Compliance Dashboard Info
Retrieve compliance score and health levels for dashboards:
```bash
compliance status
```
**Expected Output:**
```text
================ COMPLIANCE STATUS ================
System State:         HEALTHY
Security Score:       100/100
Active Frameworks:    HIPAA, SOC2
Total Violations:     0
Key Rotation status:  OK
===================================================
```

Or retrieve raw JSON details for UI display integrations:
```bash
compliance status --json
```
**Expected Output:**
```json
{
  "status": "HEALTHY",
  "systemScore": 100,
  "activeFrameworks": [
    "HIPAA",
    "SOC2"
  ],
  "totalViolationsLogged": 0,
  "lastAuditTimestamp": null,
  "keyRotationStatus": "OK"
}
```

### Lint a Compliance markdown file
```bash
compliance check profiles/HIPAA.md
```
**Expected Output:**
```text
[+] Policy "Health Insurance Portability and Accountability Act" (v1.0.0) is valid and parsed successfully.
```

### Auto-Configure Entities (Agents, Gateways, Memories)
Automatically set up and register compliant environments for agent runtimes and data:
```bash
# Auto-configure a Hermes agent folder with default HIPAA rules
compliance configure --agent medical-agent --framework HIPAA
```
**Expected Output:**
```text
[+] Auto-configuring compliance for Agent 'medical-agent' in: /path/to/agents/medical-agent
[+] Created /path/to/agents/medical-agent/SOUL.md
[+] Created agent compliance policy at: /path/to/agents/medical-agent/COMPLIANCE.md
[+] Registered agent 'medical-agent' in compliance.json.
```
```bash
# Register gateway redaction policies for an OpenClaw channel
compliance configure --gateway slack-dev-channel --redact true
```
**Expected Output:**
```text
[+] Auto-configuring gateway rules for channel: slack-dev-channel
[+] Channel 'slack-dev-channel' policy updated: redact=true
```
```bash
# Configure data residency and encryption parameters for a GBrain database
compliance configure --memory mocks/gbrain_db.json --residency us-east-1
```
**Expected Output:**
```text
[+] Auto-configuring memory rules for DB: mocks/gbrain_db.json
[+] Memory policy updated: encryption=AES-256-GCM, residency=us-east-1
```

---

## 🤝 How to Contribute

We welcome contributions to expand our regulatory coverage and enhance agent runtime security boundaries.

### Contribution Workflow:
1. **Fork & Branch**: Create a feature branch off main (`git checkout -b feature/your-compliance-rule`).
2. **Implement Checks**: Add new rules to `lib/redactor.js` or write a new profile in `profiles/` (following the [extend.md](./extend.md) developer guidelines).
3. **Run Tests**: Ensure all existing E2E tests pass by running:
   ```bash
   npm test
   ```
4. **Lint and Check Policy**: Run `compliance check` on any new profiles to guarantee frontmatter validity:
   ```bash
   compliance check profiles/YOUR_PROFILE.md
   ```
5. **Submit a Pull Request**: Open a PR against the main repository explaining the business control or framework your change implements.

---

## 🚀 Roadmap (Coming Soon)

We are actively expanding the features and frameworks supported by `agent-compliance`:
* **Additional Compliance Frameworks**: Out-of-the-box support for **GDPR** (General Data Protection Regulation) and **PCI-DSS** (Payment Card Industry Data Security Standard).
* **Enterprise KMS Integrations**: Direct adapters for cloud Key Management Systems (AWS KMS, GCP Cloud KMS, HashiCorp Vault) for production deployments.
* **Active Session Auditing**: Dynamic tracing of agent conversations to detect behavioral shifts or alignment anomalies in real-time.
* **Compliance Dashboard UI**: A local dashboard web interface to monitor active agent violations, security scores, and audit trails.

---

## 📄 License & Author

* **Author**: [mabbashm110](https://github.com/mabbashm110)
* **License**: MIT License (Open Source)

