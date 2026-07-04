# Default Team Compliance Settings Template

```yaml
version: 1.0.0
frameworks:
  - id: HIPAA
    status: enforced
  - id: SOC2-Type-II
    status: enforced

on_violation:
  action: block
  notify: security-alerts@openarch.local
  log_severity: critical

tool_restrictions:
  HIPAA:
    blocked_tools:
      - web_search
      - web_extract
      - external_webhook
    allowed_tools:
      - ehr_lookup
      - internal_vault_write
  SOC2:
    blocked_tools:
      - execute_arbitrary_shell
      - download_unverified_file
    allowed_tools:
      - read_file
      - write_file

data_classification:
  phi: true
  pii: true
  confidential: true
  public: false
```

## How to use this template
Copy this file into your workspace configuration folder as `COMPLIANCE.md` (e.g. `compliance/COMPLIANCE.md` or under your agent's directory) and run:
```bash
compliance check compliance/COMPLIANCE.md
```
The compliance CLI will validate the syntax and load active rules into the running environment filters.
