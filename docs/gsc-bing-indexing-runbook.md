# Automatic Indexing Runbook

## Purpose

Agent 6 must make every launched tool site discoverable with the least manual work:

1. Verify the live site is indexable.
2. Deploy an IndexNow key file.
3. Submit the live sitemap URLs through IndexNow automatically.
4. Complete Google Search Console setup, sitemap submission, and homepage request-indexing.
5. Complete Bing Webmaster Tools setup/import, sitemap submission, and URL Submission.
6. Use `web-access` for console UI flows that do not have a practical local API credential.

GSC and Bing are required post-deploy launch gates. Do not mark Agent 6 `launched` until both are completed and verified.

## Required Inputs

No per-site indexing token should be stored in root `.env.local`.

IndexNow uses a public per-site key file generated into:

```txt
runs/<site-id>/site/public/<indexnow-key>.txt
```

The key file is public by design and must be deployed at:

```txt
https://<domain>/<indexnow-key>.txt
```

## Indexability Gate

Before any submission, verify the production custom domain:

```bash
curl -sS https://<domain>/ | rg 'index,follow|canonical'
curl -sS https://<domain>/robots.txt
curl -sS https://<domain>/sitemap.xml
```

Required final state:

- Homepage returns HTTP 200.
- Meta robots is `index,follow`.
- `robots.txt` allows crawling.
- `robots.txt` references the production sitemap.
- Sitemap URLs use the custom production domain, not `pages.dev`.
- `www.<domain>` returns 301 to apex and is not submitted as the canonical URL.

## IndexNow Automation

IndexNow is the default automatic submission path for Bing and other participating engines.

Prepare the key before the final production build:

```bash
node scripts/deploy/indexnow-submit.mjs prepare \
  --domain <domain> \
  --site-dir runs/<site-id>/site
```

Then rebuild and redeploy the site so the key file is live.

After deployment, submit all URLs from the live sitemap:

```bash
node scripts/deploy/indexnow-submit.mjs submit \
  --domain <domain> \
  --site-dir runs/<site-id>/site \
  --sitemap-url https://<domain>/sitemap.xml
```

The script:

- Reuses an existing valid key file when present.
- Fails if the live key file is missing or mismatched.
- Extracts URLs from the sitemap.
- Submits a JSON payload to `https://api.indexnow.org/indexnow`.
- Treats HTTP 200 and 202 as accepted.
- Masks the key in output.

## Google Search Console

Google does not provide a general-purpose URL indexing submission API for normal tool pages. The reliable automation path is:

1. Submit the sitemap.
2. Use the Search Console URL Inspection UI to request indexing for the homepage.

If the browser is not logged in to the required Google account, Agent 6 must start and complete the login flow through `web-access`. Use existing browser sessions, saved accounts, passkeys, or OAuth prompts when available. If password or MFA input is required and cannot be completed by the agent, pause for user input and keep the launch blocked until GSC is complete.

Preferred order:

1. If a Search Console API credential is available, use the Sitemaps API to submit:

```txt
PUT /webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}
```

2. If API credentials are not available, use `web-access`:
   - Open `https://search.google.com/search-console`.
   - If signed out, complete sign-in before continuing.
   - Add or open the domain property for `<domain>`.
   - If the property is unverified and Search Console offers Cloudflare DNS provider verification, click through the Cloudflare Domain Connect flow. Confirm it only adds the `google-site-verification` TXT record, authorize the one-time DNS change, and wait for Search Console to report ownership verified.
   - Submit `https://<domain>/sitemap.xml` in Sitemaps.
   - Inspect `https://<domain>/` and click `Request indexing` when the button is available.

Record quota, verification, login, or UI blockers. Do not claim Google indexing was requested if the UI did not confirm it. Preserve the Google verification TXT record after verification.

## Bing Webmaster Tools

IndexNow submission is required, but it does not replace Bing Webmaster Tools. The Bing console step is also a required launch gate.

If the browser is not logged in to Bing Webmaster Tools, Agent 6 must start and complete the Microsoft/Bing login flow through `web-access`. Use existing browser sessions, saved accounts, passkeys, OAuth account prompts, or Google import OAuth when available. If password or MFA input is required and cannot be completed by the agent, pause for user input and keep the launch blocked until Bing setup and submission are complete.

Agent 6 must:

1. Open `https://www.bing.com/webmasters`.
   - If signed out, complete sign-in before continuing.
2. Prefer `Import from Google Search Console` when the domain has already been verified in GSC:
   - Continue through the Google OAuth consent flow with view-only Search Console access.
   - On the import selection screen, select only the target site for `https://<domain>/` or `https://<domain>`.
   - Explicitly deselect unrelated GSC properties before importing.
   - After import, open `https://www.bing.com/webmasters?siteUrl=https%3A%2F%2F<domain>%2F` and verify the selected site is active in Bing Webmaster Tools.
3. If the GSC import path is unavailable, add or open the site for `https://<domain>/` through Bing Webmaster Tools and complete any ownership verification requested by the UI.
4. Submit `https://<domain>/sitemap.xml` in Sitemaps.
5. Open URL Submission and submit the canonical sitemap URLs, up to the daily quota. At minimum, submit the homepage.
6. Save evidence screenshots for the sitemap submission and URL Submission success state.

If the Bing Webmaster API key is configured in a future workflow, API submission can replace the UI flow. Until then, use `web-access` for the console step.

## Hard Blockers

GSC or Bing can be marked blocked only for a hard external blocker, such as service outage, account suspension, repeated MFA requirement that needs user interaction, quota exhaustion, or a console error that prevents submission after retry. A missing login session is not a blocker by itself; Agent 6 must attempt login first.

## Reporting Requirements

`agent-6-output/indexing-report.md` must record:

- Production indexability evidence.
- Sitemap URL and parsed URL count.
- IndexNow key file path, with key masked.
- IndexNow key live URL.
- IndexNow endpoint, HTTP status, and accepted/rejected result.
- Google Search Console login/access method, property verification method, sitemap submission method, and result.
- Google URL Inspection / Request indexing result for the homepage.
- Bing Webmaster Tools login/access method and GSC import or site-add method and result.
- Bing sitemap submission method and result.
- Bing URL Submission submitted URL count and result.
- Bing IndexNow verification result.
- Any hard blocker, with evidence and next required user action.

## Official References

- IndexNow protocol: `https://www.indexnow.org/documentation.html`
- Google Search Console Sitemaps API: `https://developers.google.com/webmaster-tools/v1/sitemaps/submit`
- Google URL Inspection help: `https://support.google.com/webmasters/answer/9012289`
- Bing Webmaster API overview: `https://learn.microsoft.com/bingwebmaster/`
