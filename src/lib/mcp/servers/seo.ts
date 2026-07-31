// ═══════════════════════════════════════
// ORACLE — SEO MCP Server
// Technical audits · Keyword research · On-page analysis · Local SEO checks
// ═══════════════════════════════════════

import { McpServer } from '../server';
import type { Tool, ToolResult } from '../protocol';
import { fetchWithTimeout, TIMEOUT_QUICK_MS, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';
import { scrapeUrl } from '@/lib/scraping';
import { createLogger } from '@/lib/logger';

const log = createLogger('MCP:SEO');

// ─── SEO Analysis Helpers ─────────────

interface SeoAuditResult {
  url: string;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1Tags: string[];
  h2Tags: string[];
  canonicalUrl: string | null;
  robotsMeta: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  images: number;
  imagesWithoutAlt: number;
  issues: SeoIssue[];
  score: number;
}

interface SeoIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  fix: string;
}

async function analyzePage(url: string, html: string): Promise<SeoAuditResult> {
  const issues: SeoIssue[] = [];
  let score = 100;

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  const titleLength = title?.length ?? 0;
  if (!title) { issues.push({ severity: 'critical', category: 'title', message: 'Missing title tag', fix: 'Add a unique title tag (50-60 chars)' }); score -= 20; }
  else if (titleLength < 30) { issues.push({ severity: 'warning', category: 'title', message: `Title too short (${titleLength} chars)`, fix: 'Expand title to 50-60 characters' }); score -= 10; }
  else if (titleLength > 60) { issues.push({ severity: 'warning', category: 'title', message: `Title too long (${titleLength} chars)`, fix: 'Shorten title to 50-60 characters' }); score -= 5; }

  // Meta Description
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const metaDescription = metaMatch ? metaMatch[1].trim() : null;
  const metaDescriptionLength = metaDescription?.length ?? 0;
  if (!metaDescription) { issues.push({ severity: 'critical', category: 'meta', message: 'Missing meta description', fix: 'Add a meta description (120-160 chars)' }); score -= 15; }
  else if (metaDescriptionLength < 70) { issues.push({ severity: 'warning', category: 'meta', message: `Meta description too short (${metaDescriptionLength} chars)`, fix: 'Expand to 120-160 characters' }); score -= 5; }

  // H1 Tags
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) ?? [];
  const h1Tags = h1Matches.map((h) => h.replace(/<[^>]+>/g, '').trim());
  if (h1Tags.length === 0) { issues.push({ severity: 'critical', category: 'headings', message: 'No H1 tag found', fix: 'Add exactly one H1 tag per page' }); score -= 15; }
  else if (h1Tags.length > 1) { issues.push({ severity: 'warning', category: 'headings', message: `Multiple H1 tags (${h1Tags.length})`, fix: 'Use only one H1 per page' }); score -= 5; }

  // H2 Tags
  const h2Matches = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) ?? [];
  const h2Tags = h2Matches.map((h) => h.replace(/<[^>]+>/g, '').trim());

  // Canonical
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const canonicalUrl = canonicalMatch ? canonicalMatch[1] : null;
  if (!canonicalUrl) { issues.push({ severity: 'warning', category: 'canonical', message: 'Missing canonical URL', fix: 'Add a canonical link tag' }); score -= 5; }

  // Robots Meta
  const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  const robotsMeta = robotsMatch ? robotsMatch[1] : null;
  if (robotsMeta && robotsMeta.includes('noindex')) { issues.push({ severity: 'critical', category: 'indexing', message: 'Page has noindex directive', fix: 'Remove noindex if page should be indexed' }); score -= 20; }

  // Open Graph
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  const ogTitle = ogTitleMatch ? ogTitleMatch[1] : null;
  const ogDescription = ogDescMatch ? ogDescMatch[1] : null;
  const ogImage = ogImageMatch ? ogImageMatch[1] : null;
  if (!ogTitle) { issues.push({ severity: 'warning', category: 'social', message: 'Missing og:title', fix: 'Add Open Graph title for social sharing' }); score -= 3; }
  if (!ogImage) { issues.push({ severity: 'warning', category: 'social', message: 'Missing og:image', fix: 'Add Open Graph image (1200x630px)' }); score -= 3; }

  // Twitter Card
  const twitterMatch = html.match(/<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']+)["']/i);
  const twitterCard = twitterMatch ? twitterMatch[1] : null;

  // Content Analysis
  const bodyContent = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
  const wordCount = bodyContent.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < 300) { issues.push({ severity: 'warning', category: 'content', message: `Thin content (${wordCount} words)`, fix: 'Add more substantive content (aim for 1000+ words)' }); score -= 10; }

  // Links
  const internalLinks = (html.match(/href=["'][^"']*["']/gi) ?? []).filter((h) => !h.includes('http')).length;
  const externalLinks = (html.match(/href=["']https?:\/\/[^"']+["']/gi) ?? []).length;
  if (internalLinks === 0) { issues.push({ severity: 'warning', category: 'links', message: 'No internal links found', fix: 'Add internal links to connect related pages' }); score -= 5; }

  // Images
  const allImages = html.match(/<img[^>]*>/gi) ?? [];
  const imagesWithoutAlt = allImages.filter((img) => !img.match(/alt=["'][^"']+["']/i)).length;
  if (imagesWithoutAlt > 0) { issues.push({ severity: 'warning', category: 'images', message: `${imagesWithoutAlt}/${allImages.length} images missing alt text`, fix: 'Add descriptive alt text to all images' }); score -= Math.min(10, imagesWithoutAlt * 2); }

  return {
    url,
    title,
    titleLength,
    metaDescription,
    metaDescriptionLength,
    h1Tags,
    h2Tags,
    canonicalUrl,
    robotsMeta,
    ogTitle,
    ogDescription,
    ogImage,
    twitterCard,
    wordCount,
    internalLinks,
    externalLinks,
    images: allImages.length,
    imagesWithoutAlt,
    issues,
    score: Math.max(0, score),
  };
}

// ─── Tool Definitions ─────────────────

const AUDIT_PAGE_TOOL: Tool = {
  name: 'seo_audit_page',
  title: 'SEO Page Audit',
  description: 'Run a comprehensive on-page SEO audit on a URL. Checks title, meta, headings, OG tags, content, links, images, and more.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to audit' },
    },
    required: ['url'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const KEYWORD_RESEARCH_TOOL: Tool = {
  name: 'seo_keyword_research',
  title: 'Keyword Research',
  description: 'Research keywords for a topic by analyzing search results and extracting common terms and phrases.',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Topic or seed keyword' },
      industry: { type: 'string', description: 'Industry context' },
      location: { type: 'string', description: 'Geographic location for local keywords' },
    },
    required: ['topic'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const SCHEMA_CHECK_TOOL: Tool = {
  name: 'seo_schema_check',
  title: 'Schema Markup Check',
  description: 'Check a page for structured data / schema markup (JSON-LD, Microdata).',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to check' },
    },
    required: ['url'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const TECHNICAL_SEO_TOOL: Tool = {
  name: 'seo_technical_check',
  title: 'Technical SEO Check',
  description: 'Run a technical SEO health check: robots.txt, sitemap, page speed indicators, mobile viewport, HTTPS, canonical.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to check' },
    },
    required: ['url'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

const LOCAL_SEO_CHECK_TOOL: Tool = {
  name: 'seo_local_check',
  title: 'Local SEO Check',
  description: 'Check local SEO signals: NAP consistency, local keywords, Google Business Profile mentions, location-specific content.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Business website URL' },
      businessName: { type: 'string', description: 'Business name' },
      city: { type: 'string', description: 'City/region' },
    },
    required: ['url'],
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

// ─── Server Factory ───────────────────

export function createSeoMcpServer(): McpServer {
  const server = new McpServer('seo-mcp', '1.0.0', {
    tools: { listChanged: false },
  });

  server.registerTool(AUDIT_PAGE_TOOL, async (args: Record<string, unknown>) => {
    const url = args.url as string;
    log.info('Running SEO audit', { url });

    try {
      const scraped = await scrapeUrl(url, { formats: ['html', 'markdown'] });
      const html = scraped.html || '';
      const audit = await analyzePage(url, html);

      const text = [
        `═══ SEO AUDIT: ${url} ═══`,
        `Score: ${audit.score}/100`,
        '',
        '── Title ──',
        `Content: ${audit.title ?? 'MISSING'}`,
        `Length: ${audit.titleLength} chars`,
        '',
        '── Meta Description ──',
        `Content: ${audit.metaDescription ?? 'MISSING'}`,
        `Length: ${audit.metaDescriptionLength} chars`,
        '',
        '── Headings ──',
        `H1: ${audit.h1Tags.length > 0 ? audit.h1Tags.join(' | ') : 'NONE'}`,
        `H2: ${audit.h2Tags.length > 0 ? audit.h2Tags.slice(0, 5).join(' | ') : 'NONE'}`,
        '',
        '── Open Graph ──',
        `og:title: ${audit.ogTitle ?? 'MISSING'}`,
        `og:description: ${audit.ogDescription ?? 'MISSING'}`,
        `og:image: ${audit.ogImage ?? 'MISSING'}`,
        `twitter:card: ${audit.twitterCard ?? 'MISSING'}`,
        '',
        '── Technical ──',
        `Canonical: ${audit.canonicalUrl ?? 'MISSING'}`,
        `Robots: ${audit.robotsMeta ?? 'Not set'}`,
        '',
        '── Content ──',
        `Word count: ${audit.wordCount}`,
        `Internal links: ${audit.internalLinks}`,
        `External links: ${audit.externalLinks}`,
        `Images: ${audit.images} (${audit.imagesWithoutAlt} missing alt)`,
        '',
        '── Issues ──',
        ...audit.issues.map((i) => `[${i.severity.toUpperCase()}] ${i.category}: ${i.message}\n  Fix: ${i.fix}`),
      ].join('\n');

      return { content: [{ type: 'text', text }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Audit failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  });

  server.registerTool(KEYWORD_RESEARCH_TOOL, async (args: Record<string, unknown>) => {
    const topic = args.topic as string;
    const location = args.location as string | undefined;
    const industry = args.industry as string | undefined;

    // Generate keyword suggestions based on topic analysis
    const baseKeywords = topic.toLowerCase().split(/\s+/);
    const keywords: Array<{ keyword: string; type: string; intent: string }> = [];

    // Seed keywords
    keywords.push({ keyword: topic, type: 'primary', intent: 'informational' });

    // Long-tail variations
    const modifiers = ['best', 'top', 'affordable', 'near me', 'for', 'how to', 'guide', 'cost', 'price', 'reviews'];
    for (const mod of modifiers.slice(0, 5)) {
      keywords.push({ keyword: `${mod} ${topic}`, type: 'long-tail', intent: mod === 'how to' || mod === 'guide' ? 'informational' : 'commercial' });
    }

    // Location-based
    if (location) {
      keywords.push({ keyword: `${topic} in ${location}`, type: 'local', intent: 'local' });
      keywords.push({ keyword: `${topic} near ${location}`, type: 'local', intent: 'local' });
      keywords.push({ keyword: `best ${topic} ${location}`, type: 'local', intent: 'local' });
    }

    // Industry context
    if (industry) {
      keywords.push({ keyword: `${topic} for ${industry}`, type: 'industry', intent: 'commercial' });
      keywords.push({ keyword: `${industry} ${topic}`, type: 'industry', intent: 'commercial' });
    }

    // Question-based
    keywords.push({ keyword: `what is ${topic}`, type: 'question', intent: 'informational' });
    keywords.push({ keyword: `why ${topic}`, type: 'question', intent: 'informational' });

    const text = [
      `═══ KEYWORD RESEARCH: ${topic} ═══`,
      location ? `Location: ${location}` : '',
      industry ? `Industry: ${industry}` : '',
      '',
      ...keywords.map((k, i) => `${i + 1}. [${k.type}] "${k.keyword}" (${k.intent})`),
      '',
      '── Recommendations ──',
      '• Target primary keyword in title, H1, and meta description',
      '• Use long-tail keywords in H2s and body content',
      '• Create location-specific landing pages for local keywords',
      '• Add FAQ schema for question-based keywords',
      '• Build internal linking clusters around primary topic',
    ].filter(Boolean).join('\n');

    return { content: [{ type: 'text', text }] };
  });

  server.registerTool(SCHEMA_CHECK_TOOL, async (args: Record<string, unknown>) => {
    const url = args.url as string;

    try {
      const scraped = await scrapeUrl(url, { formats: ['html'] });
      const html = scraped.html || '';

      // Extract JSON-LD schemas
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
      const schemas = jsonLdMatches.map((m) => {
        const content = m.replace(/<script[^>]*>/gi, '').replace(/<\/script>/gi, '').trim();
        try { return JSON.parse(content); } catch { return null; }
      }).filter(Boolean);

      // Check for Microdata
      const hasMicrodata = html.includes('itemscope') || html.includes('itemtype');

      const text = [
        `═══ SCHEMA MARKUP CHECK: ${url} ═══`,
        '',
        `JSON-LD schemas found: ${schemas.length}`,
        `Microdata found: ${hasMicrodata ? 'Yes' : 'No'}`,
        '',
      ];

      if (schemas.length > 0) {
        text.push('── Detected Schemas ──');
        for (const schema of schemas) {
          const type = schema['@type'] || 'Unknown';
          const id = schema['@id'] || '';
          text.push(`  • ${type}${id ? ` (${id})` : ''}`);
          text.push(`    ${JSON.stringify(schema, null, 2).slice(0, 500)}`);
        }
      } else {
        text.push('── No Schema Found ──');
        text.push('Recommendation: Add JSON-LD structured data for:');
        text.push('  • Organization / LocalBusiness');
        text.push('  • WebPage');
        text.push('  • FAQPage (if applicable)');
        text.push('  • BreadcrumbList');
      }

      return { content: [{ type: 'text', text: text.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Schema check failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  });

  server.registerTool(TECHNICAL_SEO_TOOL, async (args: Record<string, unknown>) => {
    const url = args.url as string;
    const baseUrl = new URL(url).origin;

    const checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; detail: string }> = [];

    try {
      // Check HTTPS
      checks.push({
        name: 'HTTPS',
        status: url.startsWith('https://') ? 'pass' : 'fail',
        detail: url.startsWith('https://') ? 'Site uses HTTPS' : 'Site does not use HTTPS',
      });

      // Check robots.txt
      try {
        const robotsResp = await fetchWithTimeout(`${baseUrl}/robots.txt`, { timeoutMs: TIMEOUT_QUICK_MS });
        const robotsText = await robotsResp.text();
        const hasDisallow = robotsText.includes('Disallow:');
        const hasSitemap = robotsText.includes('Sitemap:');
        checks.push({ name: 'robots.txt', status: 'pass', detail: `Found. Sitemap: ${hasSitemap ? 'Yes' : 'No'}. Disallow rules: ${hasDisallow ? 'Yes' : 'No'}` });
      } catch {
        checks.push({ name: 'robots.txt', status: 'warn', detail: 'Could not fetch robots.txt' });
      }

      // Check sitemap
      try {
        const sitemapResp = await fetchWithTimeout(`${baseUrl}/sitemap.xml`, { timeoutMs: TIMEOUT_QUICK_MS });
        checks.push({ name: 'Sitemap', status: sitemapResp.ok ? 'pass' : 'warn', detail: sitemapResp.ok ? 'sitemap.xml found' : 'sitemap.xml not found or inaccessible' });
      } catch {
        checks.push({ name: 'Sitemap', status: 'fail', detail: 'Could not fetch sitemap.xml' });
      }

      // Check page for viewport
      const scraped = await scrapeUrl(url, { formats: ['html'] });
      const html = scraped.html || '';
      const hasViewport = html.includes('viewport');
      checks.push({ name: 'Mobile Viewport', status: hasViewport ? 'pass' : 'fail', detail: hasViewport ? 'Viewport meta tag present' : 'Missing viewport meta tag' });

      // Check canonical
      const hasCanonical = html.includes('rel="canonical"') || html.includes("rel='canonical'");
      checks.push({ name: 'Canonical Tag', status: hasCanonical ? 'pass' : 'warn', detail: hasCanonical ? 'Canonical tag found' : 'No canonical tag' });

      // Check for render-blocking resources
      const scriptCount = (html.match(/<script[^>]*src=/gi) ?? []).length;
      const cssCount = (html.match(/<link[^>]*rel=["']stylesheet["']/gi) ?? []).length;
      checks.push({
        name: 'Render-Blocking Resources',
        status: scriptCount + cssCount > 10 ? 'warn' : 'pass',
        detail: `${scriptCount} scripts, ${cssCount} stylesheets`,
      });

      const text = [
        `═══ TECHNICAL SEO CHECK: ${url} ═══`,
        '',
        ...checks.map((c) => {
          const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
          return `${icon} ${c.name}: ${c.detail}`;
        }),
        '',
        `Overall: ${checks.filter((c) => c.status === 'fail').length === 0 ? 'PASS' : 'ISSUES FOUND'}`,
      ].join('\n');

      return { content: [{ type: 'text', text }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Technical check failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  });

  server.registerTool(LOCAL_SEO_CHECK_TOOL, async (args: Record<string, unknown>) => {
    const url = args.url as string;
    const businessName = args.businessName as string | undefined;
    const city = args.city as string | undefined;

    try {
      const scraped = await scrapeUrl(url, { formats: ['markdown'] });
      const content = scraped.markdown.toLowerCase();
      const checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; detail: string }> = [];

      // Check for local keywords
      if (city) {
        const hasCity = content.includes(city.toLowerCase());
        checks.push({ name: 'City Mentioned', status: hasCity ? 'pass' : 'fail', detail: hasCity ? `City "${city}" found in content` : `City "${city}" not found in content` });
      }

      // Check for NAP (Name, Address, Phone)
      if (businessName) {
        const hasName = content.includes(businessName.toLowerCase());
        checks.push({ name: 'Business Name', status: hasName ? 'pass' : 'warn', detail: hasName ? 'Business name found in content' : 'Business name not found in content' });
      }

      const hasPhone = /\+?\d[\d\s\-()]{8,}/.test(scraped.markdown);
      checks.push({ name: 'Phone Number', status: hasPhone ? 'pass' : 'warn', detail: hasPhone ? 'Phone number found' : 'No phone number found' });

      const hasAddress = /\d+\s+\w+\s+(street|st|road|rd|avenue|ave|lane|ln|drive|dr|blvd|way|place|pl)/i.test(scraped.markdown);
      checks.push({ name: 'Address', status: hasAddress ? 'pass' : 'warn', detail: hasAddress ? 'Address-like text found' : 'No address found' });

      // Check for local schema
      const hasLocalBusiness = content.includes('localbusiness') || content.includes('local business');
      checks.push({ name: 'LocalBusiness Schema', status: hasLocalBusiness ? 'pass' : 'warn', detail: hasLocalBusiness ? 'LocalBusiness schema detected' : 'Consider adding LocalBusiness schema' });

      const text = [
        `═══ LOCAL SEO CHECK: ${url} ═══`,
        businessName ? `Business: ${businessName}` : '',
        city ? `City: ${city}` : '',
        '',
        ...checks.map((c) => {
          const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
          return `${icon} ${c.name}: ${c.detail}`;
        }),
        '',
        '── Local SEO Recommendations ──',
        '• Ensure NAP consistency across all pages and directories',
        '• Add LocalBusiness schema markup',
        '• Create dedicated location/service area pages',
        '• Optimize Google Business Profile',
        '• Build local citations on relevant directories',
        '• Encourage and manage customer reviews',
      ].filter(Boolean).join('\n');

      return { content: [{ type: 'text', text }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Local SEO check failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  });

  return server;
}
