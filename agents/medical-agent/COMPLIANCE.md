# Compliance configuration
```yaml
version: 1.0.0
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
```
