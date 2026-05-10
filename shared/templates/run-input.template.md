# Run Input

## Site

- Site ID:
- Target domain:
- Primary keyword:
- Brief requirements:

## Pre-Agent2 required user inputs

These five fields are required before Agent 2. UI Reference and UX Reference do not require URLs. If no specific reference exists, explicitly write "no clear reference", "open exploration", or "follow tool-site best practices".

- Keyword / 关键词:
- Target Domain / 目标域名:
- UI Reference / UI 参考:
- UX Reference / UX 参考:
- Extra Ideas / Constraints / Mimic Points / 额外想法 / 限制 / 模仿点:

Before Agent 2 starts, copy `shared/templates/toolsite-spec.template.md` to `toolsite-spec.md`, complete the SPEC, get explicit user confirmation, then run:

```bash
npm run check:pre-agent2-spec -- --run-dir runs/<site-id> --write
```

## UI and UX references

Reference fields are required above, but reference URLs/assets are optional. Leave file paths blank when none are available; Agent 2.5 still runs in open-exploration mode after Agent 2.

### Reference 1

- Type: mood | component | layout | illustration | interaction
- Reference URL:
- Desktop screenshot path:
- Mobile screenshot path:
- Component/image path:
- What to borrow:
- What to avoid:
- Reference strength: mood | component | layout

### Additional references

- Add more references as needed.

## Constraints

- Language: English
- Site type: static frontend tool
- Backend: none
- Database: none
- Login: none
- API keys: none
- Analytics: Cloudflare Web Analytics
- Ads: disabled, reserve monetization slots only
- Development indexing: noindex
- Production indexing: index only after approval
