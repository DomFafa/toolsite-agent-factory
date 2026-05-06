# Launch Approval Schema

```yaml
site_id: string
domain: string
approved_by: string
approved_at: string
checks:
  qa_passed: boolean
  final_ui_accepted: boolean
  production_metadata_accepted: boolean
  cloudflare_zone_active: boolean
  domain_confirmed: boolean
  noindex_removal_approved: boolean
  launch_authorized: boolean
notes: string
```
