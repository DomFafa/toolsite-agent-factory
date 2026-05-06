import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const site = import.meta.env.PUBLIC_SITE_URL || 'https://chipotlenutritioncalculator.app';
  const indexSite = import.meta.env.PUBLIC_INDEX_SITE === 'true';
  const body = indexSite
    ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).toString()}\n`
    : `User-agent: *\nDisallow: /\n\nSitemap: ${new URL('/sitemap.xml', site).toString()}\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
