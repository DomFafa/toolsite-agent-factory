# Safety and Permissions

## Destructive operations

Agents must not delete existing projects, domains, Cloudflare zones, DNS records, or production files unless the current run explicitly owns them.

For Agent 6 Cloudflare Pages launches, replacing DNS records is allowed only when all of these are true:

- Agent 5 Final QA passed and `approval.md` authorizes production launch.
- The domain belongs to the current run.
- The Cloudflare zone is active.
- The existing DNS records directly conflict with the Pages custom domain binding.
- MX, TXT, DKIM, SPF, DMARC, and unrelated subdomain records are preserved, except for user-authorized legacy Google Workspace mail records and Squarespace records on the current launch domain.
- The changed records are listed in `agent-6-output/launch-report.md`.

## Email Routing safety

Agent 6 must configure Cloudflare Email Routing catch-all. `CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO` in root `.env.local` is required.

The user has authorized migration away from legacy Google Workspace and Squarespace DNS records for Agent 6 launches. Agent 6 may remove those records for the current launch domain and replace them with Cloudflare Pages and Cloudflare Email Routing records.

Do not overwrite non-Google-Workspace third-party mail provider DNS records automatically. Preserve Outlook, Zoho, Proton, custom MX, DMARC, ownership verification, and unrelated DNS records unless the user explicitly authorizes that migration. The launch report must list deleted records, created records, masked destination address, catch-all status, and public DNS verification.

## Cloudflare Speed safety

Agent 6 must complete `Enable all available settings` on Cloudflare Speed Settings, or verify that all available settings are already enabled. Do not upgrade the Cloudflare plan or enable paid-only features.

## Production launch gate

Production launch is blocked until `approval.md` contains explicit checked approval.

Required approval fields:

- QA passed
- Domain confirmed
- Cloudflare zone active
- Noindex removed only for production
- Sitemap ready
- Robots ready
- Final screenshots accepted
- Launch authorized

## Indexing safety

Development and preview environments must use `noindex`.

Production may use `index,follow` only after approval.

After production deploy and custom-domain verification, GSC and Bing Webmaster submission are mandatory Agent 6 launch gates. The user has authorized Agent 6 to operate the GSC and Bing login flows through `web-access`. Use existing sessions, saved accounts, passkeys, or OAuth prompts where available. Do not store, print, or request passwords in repository files. If user-only password or MFA input is required, pause for user input and keep the launch blocked until submission is complete.

## UI reference safety

Reference URLs and screenshots are used for inspiration only. Agent 2.5 and Agent 3 must not copy brand assets, exact layouts, copyrighted illustrations, trademarks, distinctive protected designs, or reference copywriting.

Agent 2.5 may send user-approved reference assets to the external design model through `web-access`, but must not send secrets, `.env.local`, Cloudflare tokens, destination emails, or private credentials.

## Credential safety

No secrets are stored in this repository. Use local environment variables for Cloudflare and any future services.
