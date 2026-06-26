// ═══════════════════════════════════════
// ORACLE — Sitemap Generator
// Generates sitemap.xml with landing page, app tabs, and page routes
// ═══════════════════════════════════════

import type { MetadataRoute } from 'next';
import { TAB_METADATA, PAGE_METADATA } from '@/styles/design-tokens';

const BASE_URL = 'https://oracle.app';
const NOW = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  // ─── App tab routes (now under /app/) ──
  const tabUrls: MetadataRoute.Sitemap = Object.keys(TAB_METADATA).map((tab) => ({
    url: `${BASE_URL}/app/?tab=${tab}`,
    lastModified: NOW,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // ─── Page routes ────────────────────────
  const PAGE_PRIORITIES: Record<string, { priority: number; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'] }> = {
    login:            { priority: 0.9, changeFrequency: 'monthly' },
    'forgot-password': { priority: 0.5, changeFrequency: 'monthly' },
    'reset-password':  { priority: 0.5, changeFrequency: 'monthly' },
    'not-found':       { priority: 0.3, changeFrequency: 'yearly' },
    'auth-confirm':    { priority: 0.3, changeFrequency: 'yearly' },
    'auth-callback':   { priority: 0.3, changeFrequency: 'yearly' },
  };

  const PAGE_PATHS: Record<string, string> = {
    login: '/login',
    'forgot-password': '/auth/forgot-password',
    'reset-password': '/auth/reset-password',
    'not-found': '/not-found',
    'auth-confirm': '/auth/confirm',
    'auth-callback': '/auth/callback',
  };

  const pageUrls: MetadataRoute.Sitemap = Object.keys(PAGE_METADATA).map((page) => {
    const config = PAGE_PRIORITIES[page] ?? { priority: 0.5, changeFrequency: 'monthly' as const };
    return {
      url: `${BASE_URL}${PAGE_PATHS[page] ?? `/${page}`}`,
      lastModified: NOW,
      changeFrequency: config.changeFrequency,
      priority: config.priority,
    };
  });

  return [
    // Homepage (landing page) gets highest priority
    {
      url: BASE_URL,
      lastModified: NOW,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...tabUrls,
    ...pageUrls,
  ];
}
