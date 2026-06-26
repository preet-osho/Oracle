// ═══════════════════════════════════════
// ORACLE — OG Redirect Page Helper
// Generates an HTML redirect page with embedded OG meta tags
// for social crawlers. Used by auth route handlers.
// ═══════════════════════════════════════

import { PAGE_METADATA } from '@/styles/design-tokens';

/** Page key in PAGE_METADATA for auth callback / confirm routes */
type AuthPageKey = 'auth-callback' | 'auth-confirm';

/**
 * Build an HTML redirect page with embedded OG meta tags.
 * Social crawlers see the metadata; browsers auto-redirect via
 * meta refresh + JS fallback.
 */
export function buildOgRedirectPage(
  destUrl: string,
  pageKey: AuthPageKey,
  /** Override page URL shown in OG tags (e.g. for error variants) */
  ogPageUrl?: string,
): Response {
  const meta = PAGE_METADATA[pageKey];
  const ogImageUrl = `https://oracle.app${meta.image}`;
  const pageUrl = ogPageUrl ?? `https://oracle.app/auth/${pageKey === 'auth-callback' ? 'callback' : 'confirm'}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${meta.title} | ORACLE</title>
  <meta name="description" content="${meta.description}" />
  <meta property="og:title" content="${meta.title} | ORACLE" />
  <meta property="og:description" content="${meta.description}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_IN" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:site_name" content="ORACLE" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${meta.title} | ORACLE" />
  <meta name="twitter:description" content="${meta.description}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
  <meta http-equiv="refresh" content="0;url=${destUrl}" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: #020711;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; color: #f8faff;
    }
    .splash { text-align: center; }
    .logo {
      width: 56px; height: 56px; border-radius: 14px; margin: 0 auto 20px;
      background: linear-gradient(135deg, #6366f1, #6366f1cc);
      display: flex; align-items: center; justify-content: center;
      font-size: 26px; box-shadow: 0 0 24px rgba(99,102,241,.3);
    }
    .brand {
      font-size: 22px; font-weight: 900; letter-spacing: -0.5px;
      background: linear-gradient(135deg, #6366f1, #a5b4fc);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .sub { font-size: 12px; color: #7080b0; margin-top: 4px; letter-spacing: 1px; }
    .spinner {
      width: 32px; height: 32px; margin: 28px auto 16px;
      border: 3px solid rgba(99,102,241,.15);
      border-top-color: #6366f1; border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    .status { font-size: 13px; color: #7080b0; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="splash">
    <div class="logo">⚡</div>
    <div class="brand">ORACLE</div>
    <div class="sub">UNIVERSAL AGENCY INTELLIGENCE</div>
    <div class="spinner"></div>
    ${meta.splashText ? `<div class="status">${meta.splashText}</div>` : ''}
  </div>
  <script>window.location.replace(${JSON.stringify(destUrl)});</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Prevent CDNs and social crawlers from caching auth state
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}
