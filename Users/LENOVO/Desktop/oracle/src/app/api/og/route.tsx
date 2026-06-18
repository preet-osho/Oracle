// ═══════════════════════════════════════
// ORACLE — Dynamic OG Image Generator
// Generates branded 1200×630 PNG images per tab using @vercel/og
// ═══════════════════════════════════════

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { TAB_METADATA, VALID_TAB_IDS, PAGE_METADATA, VALID_PAGE_IDS, type OracleTab } from '@/styles/design-tokens';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    return await generateOgImage(request);
  } catch (err) {
    console.error('[OG] Failed to generate image:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to generate OG image' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function generateOgImage(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawTab = searchParams.get('tab');
  const rawPage = searchParams.get('page');

  // Determine metadata: tab-based or page-based
  let title: string;
  let description: string;
  let etagKey: string;

  if (rawTab && VALID_TAB_IDS.has(rawTab)) {
    const meta = TAB_METADATA[rawTab as OracleTab];
    title = meta.title;
    description = meta.description;
    etagKey = rawTab;
  } else if (rawPage && VALID_PAGE_IDS.has(rawPage)) {
    const meta = PAGE_METADATA[rawPage];
    title = meta.title;
    description = meta.description;
    etagKey = rawPage;
  } else {
    // Default fallback
    const meta = TAB_METADATA['agent'];
    title = meta.title;
    description = meta.description;
    etagKey = 'agent';
  }

  // Fetch fonts with Edge Cache API preloading.
  // On first request: fetches from Google Fonts, stores in caches.default.
  // On subsequent requests: serves directly from Edge cache (no network hop).
  // Gracefully falls back to system fonts if everything fails.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const FONT_CACHE: Cache = (caches as any).default ?? caches.open('og-fonts').then((c) => c);
  const FONT_TTL = 24 * 60 * 60 * 1000; // 24 hours

  async function fetchFontCached(url: string): Promise<ArrayBuffer | null> {
    const cacheKey = new Request(url);
    try {
      // 1. Try Edge cache first
      const cached = await FONT_CACHE.match(cacheKey);
      if (cached) {
        const buf = await cached.arrayBuffer();
        if (buf.byteLength > 0) return buf;
      }
    } catch {
      // Cache API unavailable — fall through to fetch
    }

    try {
      // 2. Fetch from Google Fonts
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();

      // 3. Store in Edge cache for next time
      try {
        const responseToCache = new Response(buf, {
          headers: {
            'Content-Type': 'font/woff2',
            'Cache-Control': `public, max-age=${FONT_TTL / 1000}`,
          },
        });
        await FONT_CACHE.put(cacheKey, responseToCache);
      } catch {
        // Cache write failed — not critical
      }

      return buf;
    } catch {
      return null;
    }
  }

  const [interRegular, interBold, jetbrainsMono] = await Promise.all([
    fetchFontCached('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.woff2'),
    fetchFontCached('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjQ.woff2'),
    fetchFontCached('https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOV.woff2'),
  ]);

  // ETag: deterministic per-tab/page so browsers skip re-downloading unchanged images
  const etag = `\"og-${etagKey}-v1\"`;
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304 });
  }

  const ORANGE = '#6366f1';
  const DARK = '#020711';
  const SURFACE = '#0a1228';
  const TEXT_PRIMARY = '#f8faff';
  const TEXT_SECONDARY = '#7080b0';
  const BORDER = 'rgba(255,255,255,0.07)';

  const response = new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '80px',
          background: `linear-gradient(135deg, ${DARK} 0%, ${SURFACE} 50%, ${DARK} 100%)`,
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background gradient orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${ORANGE}33 0%, transparent 70%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-50px',
            left: '30%',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${ORANGE}22 0%, transparent 70%)`,
          }}
        />

        {/* Top bar — ORACLE branding */}
        <div
          style={{
            position: 'absolute',
            top: '40px',
            left: '80px',
            right: '80px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE}cc)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: 'white',
              }}
            >
              ⚡
            </div>
            <span
              style={{
                fontSize: '20px',
                fontWeight: 900,
                background: `linear-gradient(135deg, ${ORANGE}, #a5b4fc)`,
                backgroundClip: 'text',
                color: 'transparent',
                letterSpacing: '-0.5px',
              }}
            >
              ORACLE
            </span>
          </div>
          <span
            style={{
              fontSize: '13px',
              color: TEXT_SECONDARY,
              fontFamily: 'monospace',
              letterSpacing: '1px',
            }}
          >
            UNIVERSAL AGENCY INTELLIGENCE
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', zIndex: 1 }}>
          {/* Tab label pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 20px',
              background: `${ORANGE}15`,
              border: `1px solid ${ORANGE}33`,
              borderRadius: '999px',
              width: 'fit-content',
            }}
          >
            <span style={{ fontSize: '16px' }}>⚡</span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: `${ORANGE}cc`,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
              }}
            >
              {title}
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: '56px',
              fontWeight: 900,
              color: TEXT_PRIMARY,
              lineHeight: 1.1,
              margin: 0,
              maxWidth: '800px',
              letterSpacing: '-2px',
            }}
          >
            {title}
            <span style={{ color: ORANGE }}> for ORACLE</span>
          </h1>

          {/* Description */}
          <p
            style={{
              fontSize: '22px',
              color: TEXT_SECONDARY,
              lineHeight: 1.5,
              margin: 0,
              maxWidth: '700px',
            }}
          >
            {description}
          </p>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '80px',
            right: '80px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: `1px solid ${BORDER}`,
            paddingTop: '20px',
          }}
        >
          <span
            style={{
              fontSize: '14px',
              color: TEXT_SECONDARY,
            }}
          >
            oracle.app
          </span>
          <span
            style={{
              fontSize: '12px',
              color: TEXT_SECONDARY,
              fontFamily: 'monospace',
              opacity: 0.6,
            }}
          >
            AI-Powered Agency Platform • 40+ Domains • 10 Providers
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        ...(interRegular ? [{ name: 'Inter', data: interRegular, style: 'normal' as const, weight: 400 as const }] : []),
        ...(interBold ? [{ name: 'Inter', data: interBold, style: 'normal' as const, weight: 700 as const }] : []),
        ...(jetbrainsMono ? [{ name: 'JetBrains Mono', data: jetbrainsMono, style: 'normal' as const, weight: 400 as const }] : []),
      ],
    }
  );

  // Cache for 24 hours, serve stale for 7 days while revalidating
  response.headers.set(
    'Cache-Control',
    'public, max-age=86400, stale-while-revalidate=604800'
  );
  response.headers.set('ETag', etag);

  return response;
}
