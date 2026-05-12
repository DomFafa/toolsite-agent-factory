# Checklist

Production runs are governed by `docs/production-run-master-contract.md`. If this file conflicts with the contract, the contract wins.
Agent 6 may deploy only a production run after Agent5/integrity pass, confirmed `pre_deploy_approval`, and the user's explicit `确认部署` reply.

- [ ] Standard flow reference read: `examples/typing-test-online/README.md` and `examples/typing-test-online/workflow-example.md`
- [ ] Run-start acknowledgement output before work: flow files read, current run phase, next agent, and current-phase forbidden actions
- [ ] Current chat contains explicit user launch approval: `批准上线`
- [ ] Approval completed
- [ ] QA passed
- [ ] Repo-local `web-access` preflight passed and wrote `gate-results/web-access-preflight.json`
- [ ] Zone ID discovered from target domain, not trusted from root `.env.local`
- [ ] Cloudflare zone active
- [ ] Pages project created or updated
- [ ] Apex domain bound
- [ ] WWW domain bound
- [ ] DNS records point to Pages
- [ ] WWW-to-apex 301 redirect configured
- [ ] DNS was completed through API/CLI or Dashboard DNS fallback
- [ ] SSL active
- [ ] Images Transformations enabled for the zone
- [ ] Email Routing catch-all configured to `.env.local` destination
- [ ] Legacy Google Workspace and Squarespace DNS records removed or confirmed absent
- [ ] Speed Settings `Enable all available settings` completed
- [ ] API-first path attempted for every Cloudflare operation
- [ ] Dashboard/web-access fallback completed for every Cloudflare operation that token API could not finish
- [ ] Cloudflare Web Analytics site token created or reused for the launch domain
- [ ] Cloudflare Web Analytics beacon injected into the production build
- [ ] Site redeployed after Web Analytics injection
- [ ] Live custom-domain HTML contains the Cloudflare Web Analytics beacon
- [ ] Production indexability verified on custom domain
- [ ] IndexNow key file generated or reused
- [ ] IndexNow key file deployed and publicly verified
- [ ] Live sitemap URLs submitted through IndexNow
- [ ] Google Search Console access confirmed or login completed through `web-access`
- [ ] Google Search Console domain property verified
- [ ] Google Search Console sitemap submitted
- [ ] Google homepage request-indexing confirmed through Search Console UI
- [ ] Bing Webmaster Tools access confirmed or login completed through `web-access`
- [ ] Bing Webmaster site imported from GSC or added directly
- [ ] Bing Webmaster sitemap submitted
- [ ] Bing URL Submission completed for sitemap URLs
- [ ] `npm run check:agent6-completion -- --run-dir runs/<site-id> --write` passed and wrote `gate-results/agent6-completion.json`
- [ ] Final status is exactly `full_launch_completed` only when all required launch gates are completed
- [ ] Final status is exactly `partial_launch_blocked` when any required launch gate has a hard blocker with evidence and next action
