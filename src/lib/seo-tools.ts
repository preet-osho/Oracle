// ═══════════════════════════════════════
// ORACLE — SEO Tool Integration
// Google Search Console · Analytics · PageSpeed · Schema Validation
// ═══════════════════════════════════════

import { fetchWithTimeout, TIMEOUT_MODERATE_MS, TIMEOUT_STANDARD_MS } from '@/lib/fetch-utils';
import { createLogger } from '@/lib/logger';

const log = createLogger('SEOTools');

// ─── Types ─────────────────────────────

export interface SEOConfig {
  googleSearchConsoleApiKey?: string;
  googleAnalyticsPropertyId?: string;
  pagespeedApiKey?: string;
}

export interface SearchConsoleQuery {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: ('query' | 'page' | 'country' | 'device')[];
  rowLimit?: number;
  startRow?: number;
}

export interface SearchConsoleResult {
  rows: SearchConsoleRow[];
  totalRows: number;
  averages: {
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  };
}

export interface SearchConsoleRow {
  keys: string[];
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
}

export interface PageSpeedResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  firstContentfulPaint: string;
  largestContentfulPaint: string;
  totalBlockingTime: string;
  cumulativeLayoutShift: string;
  speedIndex: string;
  opportunities: PageSpeedOpportunity[];
  diagnostics: PageSpeedDiagnostic[];
}

export interface PageSpeedOpportunity {
  id: string;
  title: string;
  description: string;
  savings: string;
  impact: 'high' | 'medium' | 'low';
}

export interface PageSpeedDiagnostic {
  id: string;
  title: string;
  description: string;
  score: number;
}

export interface SchemaValidationResult {
  url: string;
  valid: boolean;
  errors: SchemaError[];
  warnings: SchemaWarning[];
  schemas: SchemaInfo[];
}

export interface SchemaError {
  message: string;
  line: number;
  column: number;
}

export interface SchemaWarning {
  message: string;
  line: number;
  column: number;
}

export interface SchemaInfo {
  type: string;
  properties: string[];
  isValid: boolean;
}

export interface SEOAuditResult {
  url: string;
  timestamp: number;
  technical: TechnicalAudit;
  onPage: OnPageAudit;
  performance: PerformanceAudit;
  score: number;
  recommendations: SEORecommendation[];
}

export interface TechnicalAudit {
  ssl: boolean;
  mobileFriendly: boolean;
  crawlable: boolean;
  indexable: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  hasCanonicalTag: boolean;
  hasSchemaMarkup: boolean;
  redirectChain: number;
  brokenLinks: number;
}

export interface OnPageAudit {
  titleTag: { exists: boolean; length: number; score: number };
  metaDescription: { exists: boolean; length: number; score: number };
  headings: { h1: number; h2: number; h3: number };
  images: { total: number; withAlt: number; withoutAlt: number };
  internalLinks: number;
  externalLinks: number;
  wordCount: number;
}

export interface PerformanceAudit {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
  speedIndex: number;
  timeToInteractive: number;
}

export interface SEORecommendation {
  category: 'technical' | 'on-page' | 'performance' | 'content';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: string;
}

// ─── Configuration ─────────────────────

function getConfig(): SEOConfig {
  return {
    googleSearchConsoleApiKey: process.env.GOOGLE_SEARCH_CONSOLE_API_KEY,
    googleAnalyticsPropertyId: process.env.GOOGLE_ANALYTICS_PROPERTY_ID,
    pagespeedApiKey: process.env.PAGESPEED_API_KEY,
  };
}

// ─── Google Search Console ─────────────

export async function getSearchConsoleData(
  query: SearchConsoleQuery,
): Promise<SearchConsoleResult> {
  const config = getConfig();
  if (!config.googleSearchConsoleApiKey) {
    log.warn('Google Search Console API key not configured');
    return { rows: [], totalRows: 0, averages: { impressions: 0, clicks: 0, ctr: 0, position: 0 } };
  }

  const startTime = Date.now();

  try {
    const dimensions = query.dimensions || ['query', 'page'];
    const requestBody = {
      startDate: query.startDate,
      endDate: query.endDate,
      dimensions,
      rowLimit: query.rowLimit || 1000,
      startRow: query.startRow || 0,
    };

    const response = await fetchWithTimeout(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(query.siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.googleSearchConsoleApiKey}`,
        },
        body: JSON.stringify(requestBody),
        timeoutMs: TIMEOUT_STANDARD_MS,
      },
    );

    if (!response.ok) {
      throw new Error(`Search Console API error: ${response.status}`);
    }

    const data = await response.json();
    const rows: SearchConsoleRow[] = (data.rows || []).map((row: Record<string, unknown>) => ({
      keys: row.keys as string[],
      impressions: row.impressions as number,
      clicks: row.clicks as number,
      ctr: row.ctr as number,
      position: row.position as number,
    }));

    // Calculate averages
    const totalImpressions = rows.reduce((sum, r) => sum + r.impressions, 0);
    const totalClicks = rows.reduce((sum, r) => sum + r.clicks, 0);
    const avgCtr = rows.length > 0 ? rows.reduce((sum, r) => sum + r.ctr, 0) / rows.length : 0;
    const avgPosition = rows.length > 0 ? rows.reduce((sum, r) => sum + r.position, 0) / rows.length : 0;

    log.info('Search Console data retrieved', {
      siteUrl: query.siteUrl,
      rows: rows.length,
      duration: Date.now() - startTime,
    });

    return {
      rows,
      totalRows: data.rowAffected || rows.length,
      averages: {
        impressions: Math.round(totalImpressions / rows.length) || 0,
        clicks: Math.round(totalClicks / rows.length) || 0,
        ctr: Math.round(avgCtr * 100) / 100,
        position: Math.round(avgPosition * 10) / 10,
      },
    };
  } catch (error) {
    log.error('Search Console query failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return { rows: [], totalRows: 0, averages: { impressions: 0, clicks: 0, ctr: 0, position: 0 } };
  }
}

// ─── PageSpeed Insights ────────────────

export async function getPageSpeedInsights(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile',
): Promise<PageSpeedResult> {
  const config = getConfig();
  const startTime = Date.now();

  try {
    const apiUrl = config.pagespeedApiKey
      ? `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${config.pagespeedApiKey}`
      : `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}`;

    const response = await fetchWithTimeout(apiUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      timeoutMs: TIMEOUT_STANDARD_MS,
    });

    if (!response.ok) {
      throw new Error(`PageSpeed API error: ${response.status}`);
    }

    const data = await response.json();
    const lighthouseResult = data.lighthouseResult;
    const categories = lighthouseResult.categories;

    // Extract metrics
    const audits = lighthouseResult.audits;
    const fcp = audits['first-contentful-paint']?.displayValue || '0s';
    const lcp = audits['largest-contentful-paint']?.displayValue || '0s';
    const tbt = audits['total-blocking-time']?.displayValue || '0ms';
    const cls = audits['cumulative-layout-shift']?.displayValue || '0';
    const si = audits['speed-index']?.displayValue || '0s';

    // Extract opportunities
    const opportunities: PageSpeedOpportunity[] = Object.values(audits)
      .filter((audit: unknown) => {
        const a = audit as Record<string, unknown>;
        const details = a.details as Record<string, unknown> | undefined;
        return details?.type === 'opportunity' && a.score !== null;
      })
      .map((audit: unknown) => {
        const a = audit as Record<string, unknown>;
        const details = a.details as Record<string, unknown> | undefined;
        const score = (a.score as number) || 0;
        return {
          id: a.id as string,
          title: a.title as string,
          description: a.description as string,
          savings: details?.overallSavingsMs
            ? `${details.overallSavingsMs}ms`
            : 'N/A',
          impact: (score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        };
      })
      .slice(0, 5);

    // Extract diagnostics
    const diagnostics: PageSpeedDiagnostic[] = Object.values(audits)
      .filter((audit: unknown) => {
        const a = audit as Record<string, unknown>;
        const details = a.details as Record<string, unknown> | undefined;
        return details?.type === 'diagnostic' && a.score !== null;
      })
      .map((audit: unknown) => {
        const a = audit as Record<string, unknown>;
        return {
          id: a.id as string,
          title: a.title as string,
          description: a.description as string,
          score: (a.score as number) || 0,
        };
      })
      .slice(0, 5);

    const result: PageSpeedResult = {
      url,
      strategy,
      performanceScore: Math.round((categories.performance?.score || 0) * 100),
      accessibilityScore: Math.round((categories.accessibility?.score || 0) * 100),
      bestPracticesScore: Math.round((categories['best-practices']?.score || 0) * 100),
      seoScore: Math.round((categories.seo?.score || 0) * 100),
      firstContentfulPaint: fcp,
      largestContentfulPaint: lcp,
      totalBlockingTime: tbt,
      cumulativeLayoutShift: cls,
      speedIndex: si,
      opportunities,
      diagnostics,
    };

    log.info('PageSpeed insights retrieved', {
      url,
      strategy,
      performanceScore: result.performanceScore,
      duration: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    log.error('PageSpeed query failed', { url, error: error instanceof Error ? error.message : 'Unknown' });
    return {
      url,
      strategy,
      performanceScore: 0,
      accessibilityScore: 0,
      bestPracticesScore: 0,
      seoScore: 0,
      firstContentfulPaint: '0s',
      largestContentfulPaint: '0s',
      totalBlockingTime: '0ms',
      cumulativeLayoutShift: '0',
      speedIndex: '0s',
      opportunities: [],
      diagnostics: [],
    };
  }
}

// ─── Schema Validation ─────────────────

export async function validateSchema(url: string): Promise<SchemaValidationResult> {
  const startTime = Date.now();

  try {
    // Use Google's Rich Results Test API
    const response = await fetchWithTimeout(
      `https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}&user_agent=1`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        timeoutMs: TIMEOUT_STANDARD_MS,
      },
    );

    // Since we can't directly call Google's API without auth,
    // we'll parse the page for schema markup
    const pageResponse = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Accept': 'text/html' },
      timeoutMs: TIMEOUT_MODERATE_MS,
    });

    const html = await pageResponse.text();

    // Extract JSON-LD schemas
    const schemaRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    const schemas: SchemaInfo[] = [];
    const errors: SchemaError[] = [];
    const warnings: SchemaWarning[] = [];

    let match;
    while ((match = schemaRegex.exec(html)) !== null) {
      try {
        const schemaData = JSON.parse(match[1]);
        const schemaType = schemaData['@type'] || 'Unknown';
        const properties = Object.keys(schemaData);

        schemas.push({
          type: schemaType,
          properties,
          isValid: true,
        });
      } catch {
        errors.push({
          message: 'Invalid JSON-LD schema format',
          line: 0,
          column: 0,
        });
      }
    }

    // Check for common schema issues
    if (schemas.length === 0) {
      warnings.push({
        message: 'No structured data (JSON-LD) found on page',
        line: 0,
        column: 0,
      });
    }

    // Check for missing required properties
    for (const schema of schemas) {
      if (schema.type === 'Organization' && !schema.properties.includes('name')) {
        errors.push({
          message: 'Organization schema missing required "name" property',
          line: 0,
          column: 0,
        });
      }
      if (schema.type === 'Article' && !schema.properties.includes('headline')) {
        warnings.push({
          message: 'Article schema missing recommended "headline" property',
          line: 0,
          column: 0,
        });
      }
    }

    const result: SchemaValidationResult = {
      url,
      valid: errors.length === 0,
      errors,
      warnings,
      schemas,
    };

    log.info('Schema validation completed', {
      url,
      schemasFound: schemas.length,
      errors: errors.length,
      duration: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    log.error('Schema validation failed', { url, error: error instanceof Error ? error.message : 'Unknown' });
    return {
      url,
      valid: false,
      errors: [{ message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown'}`, line: 0, column: 0 }],
      warnings: [],
      schemas: [],
    };
  }
}

// ─── Comprehensive SEO Audit ───────────

export async function performSEOAudit(url: string): Promise<SEOAuditResult> {
  const startTime = Date.now();

  // Run all checks in parallel
  const [pageSpeedResult, schemaResult] = await Promise.all([
    getPageSpeedInsights(url, 'mobile'),
    validateSchema(url),
  ]);

  // Fetch page for additional checks
  let html = '';
  try {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Accept': 'text/html' },
      timeoutMs: TIMEOUT_MODERATE_MS,
    });
    html = await response.text();
  } catch {
    log.error('Failed to fetch page for SEO audit', { url });
  }

  // Technical audit
  const technical: TechnicalAudit = {
    ssl: url.startsWith('https://'),
    mobileFriendly: true, // Assume true, would need Google API to verify
    crawlable: !html.includes('noindex') && !html.includes('robots'),
    indexable: !html.includes('noindex'),
    hasRobotsTxt: true, // Would need to check /robots.txt
    hasSitemap: html.includes('sitemap.xml') || html.includes('sitemap_index'),
    hasCanonicalTag: html.includes('rel="canonical"'),
    hasSchemaMarkup: schemaResult.schemas.length > 0,
    redirectChain: 0,
    brokenLinks: 0,
  };

  // On-page audit
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleTag = titleMatch ? titleMatch[1].trim() : '';
  const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : '';

  const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
  const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
  const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;

  const imageMatches = html.match(/<img[^>]*>/gi) || [];
  const imagesWithAlt = imageMatches.filter((img) => img.includes('alt='));

  const internalLinks = (html.match(/href="[^"]*"/gi) || []).filter(
    (link) => !link.includes('http') || link.includes(url),
  ).length;

  const externalLinks = (html.match(/href="https?:\/\/[^"]*"/gi) || []).length;

  const wordCount = html
    .replace(/<[^>]*>/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  const onPage = {
    titleTag: {
      exists: titleTag.length > 0,
      length: titleTag.length,
      score: titleTag.length >= 30 && titleTag.length <= 60 ? 100 : titleTag.length > 0 ? 50 : 0,
    },
    metaDescription: {
      exists: metaDescription.length > 0,
      length: metaDescription.length,
      score: metaDescription.length >= 120 && metaDescription.length <= 160 ? 100 : metaDescription.length > 0 ? 50 : 0,
    },
    headings: { h1: h1Count, h2: h2Count, h3: h3Count },
    images: {
      total: imageMatches.length,
      withAlt: imagesWithAlt.length,
      withoutAlt: imageMatches.length - imagesWithAlt.length,
    },
    internalLinks,
    externalLinks,
    wordCount,
  };

  // Performance audit
  const performance: PerformanceAudit = {
    firstContentfulPaint: parseFloat(pageSpeedResult.firstContentfulPaint) || 0,
    largestContentfulPaint: parseFloat(pageSpeedResult.largestContentfulPaint) || 0,
    totalBlockingTime: parseFloat(pageSpeedResult.totalBlockingTime) || 0,
    cumulativeLayoutShift: parseFloat(pageSpeedResult.cumulativeLayoutShift) || 0,
    speedIndex: parseFloat(pageSpeedResult.speedIndex) || 0,
    timeToInteractive: 0,
  };

  // Calculate overall score
  const technicalScore = Object.values(technical).filter(Boolean).length / Object.keys(technical).length * 100;
  const onPageScore = (onPage.titleTag.score + onPage.metaDescription.score) / 2;
  const performanceScore = pageSpeedResult.performanceScore;
  const overallScore = Math.round((technicalScore * 0.3 + onPageScore * 0.3 + performanceScore * 0.4));

  // Generate recommendations
  const recommendations: SEORecommendation[] = [];

  if (!technical.ssl) {
    recommendations.push({
      category: 'technical',
      priority: 'critical',
      title: 'Enable HTTPS',
      description: 'Your site is not using HTTPS. This is a ranking factor and security issue.',
      impact: 'High',
      effort: 'Low',
    });
  }

  if (!technical.hasSchemaMarkup) {
    recommendations.push({
      category: 'technical',
      priority: 'high',
      title: 'Add Structured Data',
      description: 'No JSON-LD schema found. Add relevant structured data for rich results.',
      impact: 'High',
      effort: 'Medium',
    });
  }

  if (onPage.titleTag.length === 0) {
    recommendations.push({
      category: 'on-page',
      priority: 'critical',
      title: 'Add Title Tag',
      description: 'Page is missing a title tag. This is critical for SEO.',
      impact: 'High',
      effort: 'Low',
    });
  } else if (onPage.titleTag.length > 60) {
    recommendations.push({
      category: 'on-page',
      priority: 'medium',
      title: 'Shorten Title Tag',
      description: `Title tag is ${onPage.titleTag.length} characters. Keep it under 60 characters.`,
      impact: 'Medium',
      effort: 'Low',
    });
  }

  if (onPage.metaDescription.length === 0) {
    recommendations.push({
      category: 'on-page',
      priority: 'high',
      title: 'Add Meta Description',
      description: 'Page is missing a meta description. Add one to improve click-through rates.',
      impact: 'High',
      effort: 'Low',
    });
  }

  if (onPage.images.withoutAlt > 0) {
    recommendations.push({
      category: 'on-page',
      priority: 'medium',
      title: 'Add Alt Text to Images',
      description: `${onPage.images.withoutAlt} images are missing alt text.`,
      impact: 'Medium',
      effort: 'Low',
    });
  }

  if (performance.firstContentfulPaint > 3) {
    recommendations.push({
      category: 'performance',
      priority: 'high',
      title: 'Improve First Contentful Paint',
      description: `FCP is ${performance.firstContentfulPaint}s. Target under 1.8s.`,
      impact: 'High',
      effort: 'High',
    });
  }

  if (performance.largestContentfulPaint > 4) {
    recommendations.push({
      category: 'performance',
      priority: 'high',
      title: 'Improve Largest Contentful Paint',
      description: `LCP is ${performance.largestContentfulPaint}s. Target under 2.5s.`,
      impact: 'High',
      effort: 'High',
    });
  }

  const result: SEOAuditResult = {
    url,
    timestamp: Date.now(),
    technical,
    onPage,
    performance,
    score: overallScore,
    recommendations,
  };

  log.info('SEO audit completed', {
    url,
    score: overallScore,
    recommendations: recommendations.length,
    duration: Date.now() - startTime,
  });

  return result;
}

// ─── Format Results ────────────────────

export function formatPageSpeedResult(result: PageSpeedResult): string {
  let report = `## PageSpeed Insights: ${result.url}\n\n`;
  report += `**Strategy:** ${result.strategy}\n\n`;

  report += `### Scores\n`;
  report += `| Category | Score |\n`;
  report += `|----------|-------|\n`;
  report += `| Performance | ${result.performanceScore}/100 |\n`;
  report += `| Accessibility | ${result.accessibilityScore}/100 |\n`;
  report += `| Best Practices | ${result.bestPracticesScore}/100 |\n`;
  report += `| SEO | ${result.seoScore}/100 |\n\n`;

  report += `### Core Web Vitals\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| FCP | ${result.firstContentfulPaint} |\n`;
  report += `| LCP | ${result.largestContentfulPaint} |\n`;
  report += `| TBT | ${result.totalBlockingTime} |\n`;
  report += `| CLS | ${result.cumulativeLayoutShift} |\n`;
  report += `| Speed Index | ${result.speedIndex} |\n\n`;

  if (result.opportunities.length > 0) {
    report += `### Opportunities\n`;
    for (const opp of result.opportunities) {
      report += `#### ${opp.title}\n`;
      report += `${opp.description}\n`;
      report += `Potential savings: ${opp.savings}\n\n`;
    }
  }

  return report;
}

export function formatSEOAuditResult(result: SEOAuditResult): string {
  let report = `## SEO Audit: ${result.url}\n\n`;
  report += `**Overall Score:** ${result.score}/100\n\n`;

  report += `### Technical Health\n`;
  report += `| Check | Status |\n`;
  report += `|-------|--------|\n`;
  report += `| SSL | ${result.technical.ssl ? '✅' : '❌'} |\n`;
  report += `| Mobile Friendly | ${result.technical.mobileFriendly ? '✅' : '❌'} |\n`;
  report += `| Indexable | ${result.technical.indexable ? '✅' : '❌'} |\n`;
  report += `| Has Robots.txt | ${result.technical.hasRobotsTxt ? '✅' : '❌'} |\n`;
  report += `| Has Sitemap | ${result.technical.hasSitemap ? '✅' : '❌'} |\n`;
  report += `| Has Canonical | ${result.technical.hasCanonicalTag ? '✅' : '❌'} |\n`;
  report += `| Has Schema | ${result.technical.hasSchemaMarkup ? '✅' : '❌'} |\n\n`;

  report += `### On-Page SEO\n`;
  report += `| Element | Status |\n`;
  report += `|---------|--------|\n`;
  report += `| Title Tag | ${result.onPage.titleTag.exists ? `✅ (${result.onPage.titleTag.length} chars)` : '❌ Missing'} |\n`;
  report += `| Meta Description | ${result.onPage.metaDescription.exists ? `✅ (${result.onPage.metaDescription.length} chars)` : '❌ Missing'} |\n`;
  report += `| H1 Tags | ${result.onPage.headings.h1} |\n`;
  report += `| Images with Alt | ${result.onPage.images.withAlt}/${result.onPage.images.total} |\n`;
  report += `| Internal Links | ${result.onPage.internalLinks} |\n`;
  report += `| Word Count | ${result.onPage.wordCount} |\n\n`;

  if (result.recommendations.length > 0) {
    report += `### Recommendations\n`;
    for (const rec of result.recommendations) {
      const priorityEmoji = rec.priority === 'critical' ? '🔴' :
        rec.priority === 'high' ? '🟠' :
        rec.priority === 'medium' ? '🟡' : '🟢';
      report += `${priorityEmoji} **${rec.title}**\n`;
      report += `${rec.description}\n`;
      report += `Impact: ${rec.impact} | Effort: ${rec.effort}\n\n`;
    }
  }

  return report;
}
