# Site Brief Schema

```yaml
site_id: string
domain: string
primary_keyword: string
secondary_keywords: string[]
search_intent: string
audience: string
positioning: string
unique_ui_direction: string
tool_definition:
  name: string
  user_inputs: string[]
  outputs: string[]
  edge_cases: string[]
seo:
  title: string
  meta_description: string
  h1: string
  canonical: string
  faq_items:
    - question: string
      answer: string
content_sections:
  - id: string
    purpose: string
    notes: string
monetization:
  enabled: false
  reserved_slots: string[]
indexing:
  development: noindex
  production_after_approval: index_follow
```
