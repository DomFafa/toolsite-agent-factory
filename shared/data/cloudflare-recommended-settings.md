# Cloudflare Recommended Settings

Use as a checklist during Agent 6. Confirm exact settings in Cloudflare before changing anything.

- SSL/TLS mode: Full or Full (strict), depending on setup
- Always Use HTTPS: enabled
- Automatic HTTPS Rewrites: enabled when safe
- Brotli: enabled
- HTTP/2 and HTTP/3: enabled where available
- Speed > Settings > Recommendations: required; click `Enable all available settings` or verify all available settings are already enabled
- Images > Transformations: required; enabled for the launched zone
- Cache static assets aggressively when filenames are hashed
- Cloudflare Web Analytics: required; create or reuse the per-domain Web Analytics site token, inject it into the production build, redeploy, and verify `beacon.min.js` on the live custom domain
- Email Routing catch-all: required; forward to `CLOUDFLARE_EMAIL_ROUTING_FORWARD_TO` in root `.env.local`
- WWW custom domain and redirect: required; `www.<domain>` must 301 to apex while preserving path and query
