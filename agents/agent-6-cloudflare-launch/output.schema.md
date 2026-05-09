# Output Schema

Required outputs:

- `launch-report.md`
- `cloudflare-checklist.md`
- `indexing-report.md`

`launch-report.md` must include this fixed required launch gates table before final status:

```md
| gate | status | evidence | hard blocker | next action |
| --- | --- | --- | --- | --- |
```

Rows are required for:

- Pages deployment
- apex custom domain
- www custom domain
- DNS switched to Cloudflare Pages
- Email Routing catch-all
- Cloudflare Speed Settings
- Cloudflare Images Transformations
- Cloudflare Web Analytics
- IndexNow
- Google Search Console
- Bing Webmaster Tools
- API-first fallback

Allowed final status values:

- `full_launch_completed`
- `partial_launch_blocked`

`full_launch_completed` is allowed only after `gate-results/agent6-completion.json` passes with every required launch gate `completed`. If any gate has a hard blocker, the final status must be `partial_launch_blocked` and the row must include evidence plus next action.

Each output should include decisions, assumptions, and next-agent handoff notes.

Indexing outputs must record:

- Production homepage HTTP status and `index,follow` evidence
- Robots.txt crawl policy and sitemap reference
- Sitemap URL and parsed URL count
- IndexNow key file path and masked key
- Live IndexNow key URL verification
- IndexNow submission endpoint, status code, accepted/rejected result, and submitted URL count
- Google Search Console login/access method, property verification method, sitemap submission method, and result
- Google URL Inspection request-indexing confirmation for the homepage
- Bing Webmaster Tools login/access method and GSC import/site-add method and result
- Bing Webmaster Tools sitemap submission method and result
- Bing URL Submission submitted URL count and result
- Bing IndexNow verification result
- Any hard GSC/Bing blocker, with screenshot/log evidence and next required user action

If Dashboard DNS fallback is used, outputs must also record:

- Why API/CLI DNS mutation failed
- Which conflicting DNS records were changed
- Which DNS records were intentionally preserved
- Final Pages custom domain verification status
- Final HTTP/HTTPS verification evidence for the custom domain

Every Cloudflare operation must record:

- Token API endpoint attempted, or why no public token API exists for that Dashboard action
- Token API result
- Fallback method when token API cannot complete the operation
- Final verification evidence

Zone discovery outputs must record:

- Target apex domain
- Whether `CLOUDFLARE_ZONE_ID` was absent or ignored as an untrusted cache
- Zone lookup endpoint attempted
- Whether token API or Dashboard same-origin API was used
- Final zone name and status
- Final zone ID, preferably masked in user-facing reports
- Blocker if no active zone matched the target domain

WWW redirect outputs must record:

- Whether `www.<domain>` was added as a Pages custom domain
- The `www` DNS record and proxy status
- Redirect rule expression, action, and status code
- HTTP evidence that `www` returns 301 to apex while preserving path and query
- Whether token API succeeded or Dashboard fallback was used

Email Routing outputs must record:

- Whether `CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO` was set
- Destination email address redacted or partially masked
- Whether the destination address was already verified or still needs inbox confirmation
- Catch-all routing status
- Mail DNS records changed or preserved
- Confirmation that legacy Google Workspace and Squarespace DNS records were removed or absent

Cloudflare Speed Settings outputs must record:

- Whether the Dashboard `Enable all available settings` action was available
- Whether it was clicked successfully
- Whether all available settings were already enabled
- Which visible recommendations became enabled
- Which recommendations were skipped because they required a paid plan or were unavailable

Images Transformations outputs must record:

- Previous setting value
- Final setting value
- Method used: token API, Dashboard same-origin API, or manual Dashboard UI
- Whether fallback was required
- Any permission issue that caused fallback

Cloudflare Web Analytics outputs must record:

- Token API endpoint attempted and result
- Whether Dashboard same-origin API or manual Dashboard UI fallback was required
- Whether the Web Analytics site was created or an existing site was reused
- Domain/host associated with the Web Analytics site
- Site token masked, never printed in full
- Whether `PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` was injected into the production build
- Redeploy evidence after token injection
- Live custom-domain HTML evidence for `beacon.min.js` and `data-cf-beacon`
- HTTP evidence that the production custom domain still returns 200 after redeploy
