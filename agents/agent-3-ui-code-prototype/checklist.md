# Checklist

Production runs are governed by `docs/production-run-master-contract.md`. If this file conflicts with the contract, the contract wins.
Agent 3 must use only the user-selected Option A/B/C and must not change the selected design direction.

- [ ] Agent 2.5 selected design exists
- [ ] Agent 2.5 selected target images, specs, tokens, asset plan, and restoration rules exist
- [ ] Agent 2.5 usability contract, dynamic data fit notes, and UX self-audit exist
- [ ] Local visual assets are copied or referenced when required by the selected design
- [ ] Local visual assets satisfy the asset-quality contract and are not tiny screenshots stretched into large UI slots
- [ ] `node scripts/design/asset-quality-gate.mjs --run-dir runs/<site-id>` passes when the prototype references local UI assets
- [ ] Static visual shell is implemented before calculator functionality
- [ ] SEO sections, FAQ, schema, sitemap, production indexing, and deployment are not added in this agent
- [ ] Selected design visual system is preserved
- [ ] Approved usability constraints are preserved
- [ ] Numeric overflow, unreadable text, dirty thumbnails, cropped images, or unusable controls are not introduced as part of restoration
- [ ] Generated code is cleaned or recreated without redesigning
- [ ] Desktop screenshot exists
- [ ] Mobile screenshot exists
- [ ] Screenshots come from real rendered code
- [ ] Visual diff report compares Agent 3 screenshots to Agent 2.5 target images
- [ ] Desktop visual match is at least 90%, or a hard blocker is recorded
- [ ] Mobile visual match is at least 90%, or a hard blocker is recorded
- [ ] `node scripts/qa/check-visual-restoration-similarity.mjs --run-dir runs/<site-id> --write` passes before Agent 4 handoff
- [ ] Visual lock report is written before any functionality handoff
- [ ] Agent 5 Visual Restoration Gate handoff is specific
