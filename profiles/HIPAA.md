# HIPAA Compliance Profile definition

```yaml
id: HIPAA
title: Health Insurance Portability and Accountability Act
version: 1.0.0
last_reviewed: 2026-07-04

controls:
  transmission_security:
    ssl_min_version: TLS-1.3
    allowed_cipher_suites:
      - TLS_AES_256_GCM_SHA384
      - TLS_CHACHA20_POLY1305_SHA256
  
  encryption_at_rest:
    required: true
    algorithm: AES-256-GCM
    key_rotation_days: 90

  audit_controls:
    required: true
    retention_period: 6y
    record_fields:
      - timestamp
      - user_id
      - agent_id
      - run_id
      - action_type
      - resource_id
      - integrity_hash

  tool_restrictions:
    blocked_tools:
      - web_search
      - web_extract
      - external_webhook
      - public_dns_resolve
    allowed_tools:
      - ehr_lookup
      - internal_vault_write
      - secure_email_dispatch
      - local_file_read

  data_classification:
    phi:
      required_encryption: true
      required_redaction_to_public: true
      audit_on_read: true
      audit_on_write: true
```

## 1. Overview
This profile defines the technical controls required to maintain HIPAA compliance for processing Protected Health Information (PHI) within the openarch platform.

## 2. Encryption Controls
* **At Rest:** All records with classification `phi` must be encrypted using `AES-256-GCM`. Decryption is only permitted for operations executing under a verified `phi:read` scope.
* **In Transit:** All connections must be secured via TLS 1.3.

## 3. Tool Restrictions
To prevent accidental leakage of PHI to unsecured external endpoints:
1. Direct web search tool access is disabled.
2. Web scraper engines are blocked.
3. Unverified HTTP callback webhooks are disabled.

## 4. Auditing
Every data access or mutation involving PHI must generate a cryptographic log in the audit trail, preserved for 6 years.
