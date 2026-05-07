# QA Report Schema

```yaml
site_id: string
domain: string
qa_status: pass | fail
build:
  install: pass | fail
  build: pass | fail
seo:
  title: pass | fail
  meta_description: pass | fail
  canonical: pass | fail
  robots: pass | fail
  sitemap: pass | fail
  structured_data: pass | fail
ui:
  design_package_gate: pass | fail | not_run
  design_gate: pass | fail | not_run
  visual_restoration_gate: pass | fail | not_run
  visual_match_target: number
  desktop_visual_score: number
  mobile_visual_score: number
  selected_design_match: pass | fail
  desktop_match: pass | fail
  mobile_match: pass | fail
  responsive: pass | fail
tool_logic:
  normal_inputs: pass | fail
  edge_cases: pass | fail
accessibility:
  keyboard: pass | fail
  contrast_sanity: pass | fail
indexing:
  development_noindex: pass | fail
  production_gate: pass | fail
issues:
  - severity: blocker | major | minor
    owner_agent: agent-2 | agent-2.5 | agent-3 | agent-4 | agent-5 | agent-6
    description: string
```
