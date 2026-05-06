# Fix Routing

## Issues Found

### Invalid nested buttons in prototype

Browser behavior split nested portion buttons out of ingredient buttons, causing broken desktop and mobile layout.

Resolution:

- Replaced ingredient buttons with `ingredient-card` containers.
- Kept the ingredient toggle and portion controls as sibling buttons.

### Default preset bug

Missing query parameter was parsed as `Number(null)`, which equals `0`. That caused the first preset to load on the homepage by default.

Resolution:

- Check `URLSearchParams.has("preset")` before applying a preset.

### Canonical fallback

Base layout fallback URL was still `https://example.com`, producing wrong canonical URLs when `PUBLIC_SITE_URL` was absent.

Resolution:

- Updated fallback to `https://chipotlenutritioncalculator.app`.

## Retry Needed

No further implementation retry is required. Agent 6 can proceed once credentials and approval are ready.
