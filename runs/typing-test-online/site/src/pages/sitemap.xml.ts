import type { APIRoute } from 'astro';

const pages = [
  '/',
  '/practice/',
  '/guides/',
  '/faq/',
  '/about/',
  '/typing-speed-formula/',
  '/time-modes/',
  '/privacy/',
  '/terms/',
];

export const GET: APIRoute = () => {
  const site = import.meta.env.PUBLIC_SITE_URL || 'https://example.com';
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((path) => `  <url><loc>${new URL(path, site).toString()}</loc></url>`).join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};
