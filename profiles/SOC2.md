# SOC2 Type II Compliance Profile definition

```yaml
id: SOC2
title: System and Organization Controls (Security, Confidentiality & Privacy)
version: 1.0.0
last_reviewed: 2026-07-04

controls:
  access_control:
    mfa_required: true
    session_timeout_seconds: 3600
    allowed_auth_protocols:
      - OAuth-2.1-PKCE
      - OpenID-Connect

  system_integrity:
    record_agent_trajectories: true
    integrity_check_configs: true
    prevent_arbitrary_eval: true

  confidentiality:
    restrict_plaintext_secrets: true
    secure_vault_only: true
    mask_inbound_credentials: true

  tool_restrictions:
    blocked_tools:
      - execute_arbitrary_shell
      - download_unverified_file
    allowed_tools:
      - read_file
      - write_file
      - git_commit

  audit_controls:
    required: true
    retention_period: 1y
    log_severity_threshold: info
```

## 1. Overview
This profile defines the technical controls required to satisfy SOC2 Trust Services Criteria (TSC) for Security, Confidentiality, and Processing Integrity.

## 2. Authentication and Access control
* **MFA:** Enforced globally for all administration, gateway, and dashboard sessions.
* **Session Limiting:** Interactive developer and client sessions must timeout and prompt for re-auth after 60 minutes of inactivity.

## 3. Configuration Integrity
* Any mutation of active configurations, agents (`SOUL.md`), or skills must be recorded alongside human or parent agent identifiers.

## 4. Secrets Scoping
* Standard API keys and authorization tokens must never be written in plain text in code repository directories or memory storage pages.
* Access must be resolved dynamically at runtime through scoped environment variable injection.
