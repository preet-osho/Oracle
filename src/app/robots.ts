// ═══════════════════════════════════════
// ORACLE — Robots.txt Generator
// Allows crawling of public pages, blocks API routes and auth redirects
// ═══════════════════════════════════════

import type { MetadataRoute } from 'next';

const BASE_URL = 'https://oracle.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Block API routes and auth redirect routes (no unique content)
        disallow: ['/api/', '/auth/callback', '/auth/confirm'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
