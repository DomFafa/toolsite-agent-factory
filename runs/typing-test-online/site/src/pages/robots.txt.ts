import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const site = import.meta.env.PUBLIC_SITE_URL || 'https://typing-test-online.com';
  const indexSite = import.meta.env.PUBLIC_INDEX_SITE === 'true';
  const body = indexSite
    ? `User-agent: *
Allow: /

Sitemap: ${new URL('/sitemap.xml', site).toString()}
`
    : `User-agent: *
Disallow: /

Sitemap: ${new URL('/sitemap.xml', site).toString()}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
