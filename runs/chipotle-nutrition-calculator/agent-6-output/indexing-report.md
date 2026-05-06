# Indexing Report

## Production Index State

The deployed Pages build was built with:

```bash
PUBLIC_INDEX_SITE=true
PUBLIC_SITE_URL=https://chipotlenutritioncalculator.app
```

Verified on the Pages URL:

- Meta robots: `index,follow`
- Robots.txt: `Allow: /`
- Sitemap exists

## Sitemap

The generated sitemap points at the intended production domain:

```txt
https://chipotlenutritioncalculator.app/
https://chipotlenutritioncalculator.app/privacy/
https://chipotlenutritioncalculator.app/terms/
```

## Custom Domain Status

The custom domain is live:

```txt
https://chipotlenutritioncalculator.app/
```

Verified:

- HTTP 200
- Meta robots: `index,follow`
- Robots.txt allows search indexing
- Sitemap available at `https://chipotlenutritioncalculator.app/sitemap.xml`

## Submission Status

Not submitted to search consoles yet.

Reason:

- Google Search Console and Bing Webmaster Tools credentials/connectors are not configured in this repository.
- IndexNow key file is not configured.

## Next Step

Submit:

- `https://chipotlenutritioncalculator.app/sitemap.xml`

Optional:

- Configure IndexNow key and submit the homepage after custom domain is live.
