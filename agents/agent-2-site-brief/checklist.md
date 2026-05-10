# Checklist

- [ ] `toolsite-spec.md` exists before Agent 2 starts
- [ ] `gate-results/pre-agent2-toolsite-spec.json` passed before Agent 2 starts
- [ ] User confirmed the Toolsite SPEC before Agent 2 starts
- [ ] Domain and site ID are consistent
- [ ] Search intent is explicit
- [ ] Tool behavior is defined
- [ ] SEO metadata is drafted
- [ ] UI reference and UX reference fields from the Toolsite SPEC are organized, or explicit open-exploration/tool-site-best-practice wording is preserved
- [ ] `ui-reference-dossier.md` is written
- [ ] `design-generation-input.md` is written for Agent 2.5
- [ ] Toolsite Page Plan table is written in `page-plan.md` or `content-plan.md`
- [ ] Page Plan includes required rows for `/`, `/privacy`, `/terms`, `/sitemap.xml`, and `/robots.txt`
- [ ] Page Plan statuses are only `required`, `optional-recommended`, `optional-not-needed`, or `rejected`
- [ ] Optional pages have Agent 2 reasons
- [ ] Forbidden-by-default pages are rejected unless the user explicitly requested them
- [ ] `npm run check:page-plan -- --run-dir runs/<site-id> --write` passed and wrote `gate-results/page-plan.json`
- [ ] Agent 2.5, Agent 3, and Agent 4 handoffs are clear
