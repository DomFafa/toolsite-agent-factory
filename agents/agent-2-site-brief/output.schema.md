# Output Schema

Required outputs:

- `site-brief.md`
- `seo-plan.md`
- `tool-spec.md`
- `content-plan.md`
- `page-plan.md` preferred, or a Toolsite Page Plan table inside `content-plan.md`
- `ui-reference-dossier.md`
- `design-generation-input.md`

Each output should include decisions, assumptions, and next-agent handoff notes.

The Toolsite Page Plan table must use this header:

```md
| page | type | status | reason | implementation owner |
| --- | --- | --- | --- | --- |
```

Allowed status values:

- `required`
- `optional-recommended`
- `optional-not-needed`
- `rejected`

Required rows for every formal tool site:

- `/`
- `/privacy`
- `/terms`
- `/sitemap.xml`
- `/robots.txt`

Forbidden unless explicitly requested by the user:

- `/login`
- `/dashboard`
- `/account`
- `/pricing`
- `/leaderboard`
- `/api`
- `/blog`
