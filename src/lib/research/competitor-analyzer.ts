// ═══════════════════════════════════════
// ORACLE — Competitor Analysis Pipeline
// Website auditing · Tech stack detection · SWOT generation
// Uses cheerio for structured HTML parsing
// ═══════════════════════════════════════

import * as cheerio from 'cheerio';
import { fetchWithTimeout, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';
import { createLogger } from '@/lib/logger';
import { normalizeUrl, extractDomain, isPrivateHost } from './utils';
import type {
  CompetitorAnalysis,
  WebsiteStructure,
  SeoSignals,
  ContactInfo,
  ContentSignals,
  PricingInfo,
  TechStack,
} from './types';

const log = createLogger('CompetitorAnalyzer');

// ─── Main Analysis Function ───────────

/**
 * Analyze a competitor's website by fetching the homepage and extracting
 * structural, SEO, contact, content, pricing, and tech stack signals.
 *
 * Optionally fetches /pricing and /blog pages for deeper analysis.
 */
export async function analyzeCompetitor(
  url: string,
  options: { includeSubpages?: boolean; timeoutMs?: number } = {},
): Promise<CompetitorAnalysis> {
  const { includeSubpages = true, timeoutMs = TIMEOUT_MODERATE_MS } = options;
  const normalizedUrl = normalizeUrl(url);
  const domain = extractDomain(normalizedUrl);

  log.info(`Analyzing competitor: ${domain}`);

  // Fetch the homepage
  const homepageHtml = await fetchPage(normalizedUrl, timeoutMs);
  const $ = cheerio.load(homepageHtml);

  // Extract signals from homepage
  const structure = extractStructure($, normalizedUrl);
  const seo = extractSeoSignals($, normalizedUrl);
  const contact = extractContactInfo($);
  const content = extractContentSignals($);
  const pricing = extractPricingSignals($);
  const techStack = detectTechStack($, homepageHtml);

  // Optionally fetch subpages for deeper analysis
  if (includeSubpages) {
    const pricingUrl = findPricingUrl($, normalizedUrl);
    if (pricingUrl) {
      try {
        const pricingHtml = await fetchPage(pricingUrl, timeoutMs);
        const pricing$ = cheerio.load(pricingHtml);
        const subpagePricing = extractPricingDetails(pricing$);
        pricing.hasPricingPage = true;
        pricing.plans = subpagePricing.plans;
        pricing.pricingModel = subpagePricing.pricingModel;
      } catch (err) {
        log.warn(`Failed to fetch pricing page: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    const blogUrl = findBlogUrl($, normalizedUrl);
    if (blogUrl) {
      try {
        const blogHtml = await fetchPage(blogUrl, timeoutMs);
        const blog$ = cheerio.load(blogHtml);
        const blogPosts = countBlogPosts(blog$);
        content.blogPostCount = blogPosts.count;
        content.lastBlogDate = blogPosts.lastDate;
      } catch (err) {
        log.warn(`Failed to fetch blog page: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }
  }

  const analysis: CompetitorAnalysis = {
    url: normalizedUrl,
    domain,
    scrapedAt: Date.now(),
    structure,
    seo,
    contact,
    content,
    pricing,
    techStack,
  };

  log.info(`Analysis complete for ${domain}`, {
    h1Count: structure.h1Tags.length,
    hasPricing: pricing.hasPricingPage,
    emailCount: contact.emails.length,
    wordCount: content.wordCount,
  });

  return analysis;
}

// ─── SWOT Generation ──────────────────

export interface SwotAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  summary: string;
}

/**
 * Generate a SWOT analysis from a competitor's analysis data.
 * Uses heuristic rules based on the extracted signals.
 */
export function generateSwot(analysis: CompetitorAnalysis): SwotAnalysis {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const threats: string[] = [];

  // ── SEO Analysis ──
  if (analysis.seo.titleTag && analysis.seo.titleTag.length > 30) {
    strengths.push('Well-crafted title tag with good length');
  } else if (!analysis.seo.titleTag) {
    weaknesses.push('Missing title tag — basic SEO oversight');
    opportunities.push('Outrank them on SERPs with proper title optimization');
  }

  if (analysis.seo.metaDescription && analysis.seo.metaDescription.length > 100) {
    strengths.push('Detailed meta description for SERP click-through');
  } else if (!analysis.seo.metaDescription) {
    weaknesses.push('No meta description — lower SERP click-through rate');
  }

  if (analysis.seo.hasSchemaMarkup) {
    strengths.push('Structured data / schema markup implemented');
    threats.push('Rich snippets in search results from schema markup');
  } else {
    weaknesses.push('No structured data / schema markup');
    opportunities.push('Implement schema markup for rich snippet advantage');
  }

  if (analysis.seo.hasSitemap) {
    strengths.push('XML sitemap present for search engine crawling');
  } else {
    weaknesses.push('No XML sitemap detected');
  }

  if (analysis.seo.ogImage) {
    strengths.push('Open Graph image configured for social sharing');
  } else {
    weaknesses.push('No Open Graph image — poor social media appearance');
  }

  // ── Content Analysis ──
  if (analysis.content.wordCount > 5000) {
    strengths.push('Substantial content depth across the site');
  } else if (analysis.content.wordCount < 500) {
    weaknesses.push('Very thin content — low topical authority');
    opportunities.push('Create comprehensive content to surpass their depth');
  }

  if (analysis.content.contentFreshness === 'fresh') {
    strengths.push('Recently updated content — signals active maintenance');
  } else if (analysis.content.contentFreshness === 'stale' || analysis.content.contentFreshness === 'abandoned') {
    weaknesses.push(`${analysis.content.contentFreshness} content — signals neglect`);
    opportunities.push('Outpace them with fresh, regularly updated content');
  }

  if (analysis.content.blogPostCount > 10) {
    strengths.push(`Active blog with ${analysis.content.blogPostCount} posts`);
  } else if (analysis.content.blogPostCount === 0) {
    weaknesses.push('No blog or content marketing presence');
    opportunities.push('Content marketing gap — capture organic traffic they are missing');
  }

  // ── Structure Analysis ──
  if (analysis.structure.hasPricing) {
    strengths.push('Transparent pricing page');
  } else {
    weaknesses.push('No visible pricing — friction in buyer journey');
  }

  if (analysis.structure.hasTestimonials) {
    strengths.push('Social proof via testimonials');
    threats.push('Testimonials build trust and reduce prospect willingness to switch');
  } else {
    weaknesses.push('No testimonials or social proof visible');
  }

  if (analysis.structure.h1Tags.length === 0) {
    weaknesses.push('No H1 tags — poor heading hierarchy');
  } else if (analysis.structure.h1Tags.length > 1) {
    weaknesses.push('Multiple H1 tags — dilutes SEO signal per page');
  }

  if (analysis.structure.navigation.length > 8) {
    strengths.push('Rich site navigation with many sections');
  } else if (analysis.structure.navigation.length < 3) {
    weaknesses.push('Minimal navigation — limited discoverability of pages');
  }

  // ── Contact Analysis ──
  if (analysis.contact.emails.length === 0 && analysis.contact.phones.length === 0) {
    weaknesses.push('No visible contact information — hard to reach');
    opportunities.push('Their lack of accessibility makes you the easier choice');
  }

  if (Object.keys(analysis.contact.socialLinks).length >= 3) {
    strengths.push('Strong social media presence across multiple platforms');
    threats.push('Active social presence builds brand awareness and trust');
  } else if (Object.keys(analysis.contact.socialLinks).length === 0) {
    weaknesses.push('No social media links');
    opportunities.push('Social media gap — build presence where they have none');
  }

  // ── Tech Stack Analysis ──
  if (analysis.techStack.framework) {
    threats.push(`Built on ${analysis.techStack.framework} — may have fast iteration capability`);
  }

  if (analysis.techStack.analytics && analysis.techStack.analytics.length > 0) {
    threats.push('Data-driven with analytics tools — they track and optimize');
  }

  // ── Pricing Analysis ──
  if (analysis.pricing.hasPricingPage && analysis.pricing.plans.length > 0) {
    strengths.push(`${analysis.pricing.plans.length} pricing tiers visible`);
  }

  if (analysis.pricing.pricingModel === 'freemium') {
    threats.push('Freemium model lowers barrier to entry for prospects');
    opportunities.push('Differentiate on quality and service rather than price');
  }

  // ── Generate Summary ──
  const summaryParts: string[] = [];
  if (strengths.length > 0) {
    summaryParts.push(`${analysis.domain} has ${strengths.length} key strengths including ${strengths[0].toLowerCase()}`);
  }
  if (weaknesses.length > 0) {
    summaryParts.push(`${weaknesses.length} exploitable weaknesses such as ${weaknesses[0].toLowerCase()}`);
  }
  if (opportunities.length > 0) {
    summaryParts.push(`${opportunities.length} strategic opportunities including ${opportunities[0].toLowerCase()}`);
  }
  if (threats.length > 0) {
    summaryParts.push(`${threats.length} competitive threats like ${threats[0].toLowerCase()}`);
  }

  return {
    strengths,
    weaknesses,
    opportunities,
    threats,
    summary: summaryParts.join('. ') + '.',
  };
}

// ─── Comparison Report ────────────────

export interface CompetitorComparison {
  competitors: CompetitorAnalysis[];
  swotAnalyses: SwotAnalysis[];
  comparisonTable: ComparisonTable;
  generatedAt: number;
}

export interface ComparisonTable {
  headers: string[];
  rows: Array<{
    label: string;
    values: string[];
  }>;
}

/**
 * Analyze multiple competitors and generate a side-by-side comparison.
 */
export async function compareCompetitors(
  urls: string[],
  options: { includeSubpages?: boolean; timeoutMs?: number; concurrency?: number } = {},
): Promise<CompetitorComparison> {
  const { concurrency = 3, ...restOptions } = options;
  log.info(`Comparing ${urls.length} competitors (concurrency: ${concurrency})`);

  // Analyze competitors in batches to avoid unbounded parallel fetches
  const analyses: Array<{ url: string; status: 'fulfilled'; value: CompetitorAnalysis } | { url: string; status: 'rejected'; reason: unknown }> = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((url) => analyzeCompetitor(url, restOptions)),
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      analyses.push({
        url: batch[j],
        ...(result.status === 'fulfilled'
          ? { status: 'fulfilled' as const, value: result.value }
          : { status: 'rejected' as const, reason: result.reason }),
      });
    }
  }

  const competitors: CompetitorAnalysis[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  for (const entry of analyses) {
    if (entry.status === 'fulfilled') {
      competitors.push(entry.value);
    } else {
      errors.push({
        url: entry.url,
        error: entry.reason instanceof Error ? entry.reason.message : 'Analysis failed',
      });
    }
  }

  if (errors.length > 0) {
    log.warn(`${errors.length} competitor analyses failed`, { errors });
  }

  // Generate SWOT for each
  const swotAnalyses = competitors.map((c) => generateSwot(c));

  // Build comparison table
  const comparisonTable = buildComparisonTable(competitors);

  return {
    competitors,
    swotAnalyses,
    comparisonTable,
    generatedAt: Date.now(),
  };
}

// ─── HTML Parsing: Structure ──────────

function extractStructure($: cheerio.CheerioAPI, url: string): WebsiteStructure {
  // Title
  const title = $('title').first().text().trim() || '';

  // Meta description
  const description = $('meta[name="description"]').attr('content')?.trim() || '';

  // Heading tags
  const h1Tags = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h2Tags = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean);

  // Navigation links
  const navLinks = $('nav a, header a, [role="navigation"] a')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .filter((text: string) => text.length < 50);

  // Page links (internal)
  const baseUrl = extractDomain(url);
  const internalLinks = $('a[href]')
    .map((_, el) => $(el).attr('href') || '')
    .get()
    .filter((href: string) => {
      try {
        if (href.startsWith('/')) return true;
        const parsed = new URL(href, url);
        return parsed.hostname.includes(baseUrl);
      } catch {
        return false;
      }
    });

  const uniquePages = [...new Set(internalLinks.map((l: string) => {
    try {
      if (l.startsWith('/')) return l;
      return new URL(l).pathname;
    } catch {
      return l;
    }
  }))];

  // Page pattern detection
  const pageText = $('body').text().toLowerCase();
  const hasBlog = /blog|article|post|news|insight/i.test(pageText) ||
    internalLinks.some((l: string) => /blog|article|post|news/i.test(l));
  const hasPricing = /pricing|plan|tier|price/i.test(pageText) ||
    internalLinks.some((l: string) => /pric|plan|tier/i.test(l));
  const hasContact = /contact|reach|get.in.touch|enquir/i.test(pageText) ||
    internalLinks.some((l: string) => /contact|reach/i.test(l));
  const hasTestimonials = /testimonial|review|client.says|what.people|case.study/i.test(pageText);

  return {
    title,
    description,
    h1Tags,
    h2Tags,
    navigation: [...new Set(navLinks)].slice(0, 20),
    pages: uniquePages.slice(0, 30),
    hasBlog,
    hasPricing,
    hasContact,
    hasTestimonials,
  };
}

// ─── HTML Parsing: SEO ────────────────

function extractSeoSignals($: cheerio.CheerioAPI, url: string): SeoSignals {
  const titleTag = $('title').first().text().trim() || undefined;
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || undefined;

  const canonicalUrl = $('link[rel="canonical"]').attr('href')?.trim() || undefined;
  const robotsMeta = $('meta[name="robots"]').attr('content')?.trim() || undefined;
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || undefined;

  // Schema markup detection (JSON-LD)
  const hasSchemaMarkup = $('script[type="application/ld+json"]').length > 0 ||
    $('[itemscope]').length > 0;

  // Sitemap check (look for sitemap link in robots or common locations)
  const hasSitemap = $('link[rel="sitemap"]').length > 0 ||
    $('a[href*="sitemap"]').length > 0;

  return {
    titleTag,
    metaDescription,
    canonicalUrl,
    hasSchemaMarkup,
    robotsMeta,
    ogImage,
    hasSitemap,
  };
}

// ─── HTML Parsing: Contact ────────────

function extractContactInfo($: cheerio.CheerioAPI): ContactInfo {
  const pageText = $('body').text();
  const html = $.html();

  // Extract emails
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const emails = [...new Set((html.match(emailRegex) || []).filter((e: string) => {
    // Filter out image extensions and common false positives
    const lower = e.toLowerCase();
    return !lower.endsWith('.png') && !lower.endsWith('.jpg') &&
           !lower.endsWith('.gif') && !lower.endsWith('.svg') &&
           !lower.endsWith('.webp') && !lower.endsWith('.jpeg');
  }))].slice(0, 10);

  // Extract phone numbers (Indian and international formats)
  const phoneRegex = /(?:\+91[\s-]?)?\d{10}|\+\d{1,3}[\s-]?\d{4,14}|\(\d{3,4}\)[\s-]?\d{6,8}/g;
  const phones = [...new Set((pageText.match(phoneRegex) || []).filter((p: string) => {
    const digits = p.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }))].slice(0, 5);

  // Extract social links
  const socialPatterns: Record<string, RegExp> = {
    facebook: /facebook\.com\/([^/?\s"]+)/,
    instagram: /instagram\.com\/([^/?\s"]+)/,
    linkedin: /linkedin\.com\/(company|in)\/([^/?\s"]+)/,
    twitter: /(?:twitter\.com|x\.com)\/([^/?\s"]+)/,
    youtube: /youtube\.com\/(channel|@|c\/)([^/?\s"]+)/,
    github: /github\.com\/([^/?\s"]+)/,
  };

  const socialLinks: Record<string, string> = {};
  for (const [platform, regex] of Object.entries(socialPatterns)) {
    const match = html.match(regex);
    if (match) {
      socialLinks[platform] = match[0].replace(/["'<>]/g, '');
    }
  }

  return { emails, phones, socialLinks };
}

// ─── HTML Parsing: Content ────────────

function extractContentSignals($: cheerio.CheerioAPI): ContentSignals {
  // Word count from visible text
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(/\s+/).filter((w: string) => w.length > 0).length;

  // Blog detection and counting
  const blogLinks = $('a[href*="blog"], a[href*="article"], a[href*="post"]')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((text: string) => text.length > 5);
  const blogPostCount = blogLinks.length;

  // Content freshness from date patterns
  const datePatterns = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi;
  const dates = bodyText.match(datePatterns) || [];
  let lastBlogDate: string | undefined;
  if (dates.length > 0) {
    const parsedDates = dates
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());
    if (parsedDates.length > 0) {
      lastBlogDate = parsedDates[0].toISOString();
    }
  }

  // Content freshness classification
  let contentFreshness: ContentSignals['contentFreshness'] = 'abandoned';
  if (lastBlogDate) {
    const ageMs = Date.now() - new Date(lastBlogDate).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 30) contentFreshness = 'fresh';
    else if (ageDays < 90) contentFreshness = 'recent';
    else if (ageDays < 365) contentFreshness = 'stale';
  }

  // Top keywords from headings and prominent text
  const headings = $('h1, h2, h3').map((_, el) => $(el).text().trim()).get().join(' ');
  const topKeywords = extractTopKeywords(headings || bodyText);

  return {
    wordCount,
    blogPostCount,
    lastBlogDate,
    topKeywords,
    contentFreshness,
  };
}

// ─── HTML Parsing: Pricing ────────────

function extractPricingSignals($: cheerio.CheerioAPI): PricingInfo {
  const pageText = $('body').text();
  const hasPricingPage = /pricing|plans|tiers|packages/i.test(pageText);

  // Basic plan detection from pricing page content
  const plans: PricingInfo['plans'] = [];

  // Look for price patterns
  const priceRegex = /(?:₹|INR|Rs\.?|\$|USD)\s*[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:mo(?:nth)?|yr|year|annual))?/gi;
  const prices = pageText.match(priceRegex) || [];

  // Look for plan names
  const planNames = $('h2, h3, h4')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((text: string) => /basic|starter|pro|professional|enterprise|premium|standard|growth|scale/i.test(text));

  // Try to pair plan names with prices
  for (let i = 0; i < Math.min(planNames.length, prices.length, 5); i++) {
    plans.push({
      name: planNames[i],
      price: prices[i],
      features: [],
    });
  }

  // Detect pricing model
  let pricingModel: PricingInfo['pricingModel'];
  if (/freemium|free.plan|free.trial/i.test(pageText)) {
    pricingModel = 'freemium';
  } else if (/one.time|lifetime|per.project/i.test(pageText)) {
    pricingModel = 'one-time';
  } else if (/custom|contact.for|tailored/i.test(pageText)) {
    pricingModel = 'custom';
  } else if (prices.length > 0) {
    pricingModel = 'subscription';
  }

  return { hasPricingPage, plans, pricingModel };
}

// ─── HTML Parsing: Pricing Details ────

function extractPricingDetails($: cheerio.CheerioAPI): {
  plans: PricingInfo['plans'];
  pricingModel?: PricingInfo['pricingModel'];
} {
  const plans: PricingInfo['plans'] = [];
  const pageText = $('body').text();

  // Look for pricing cards/sections
  const pricingSections = $('[class*="pricing"], [class*="plan"], [class*="tier"], [data-pricing]');

  if (pricingSections.length > 0) {
    pricingSections.each((_, section) => {
      const $section = $(section);
      const name = $section.find('h2, h3, h4, [class*="name"], [class*="title"]').first().text().trim();
      const price = $section.find('[class*="price"], [class*="amount"], [class*="cost"]').first().text().trim();
      const features = $section.find('li, [class*="feature"]')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((f: string) => f.length > 3 && f.length < 100);

      if (name || price) {
        plans.push({ name: name || 'Plan', price: price || 'Contact', features: features.slice(0, 10) });
      }
    });
  }

  // Detect pricing model
  let pricingModel: PricingInfo['pricingModel'];
  if (/freemium|free.plan|free.trial/i.test(pageText)) pricingModel = 'freemium';
  else if (/one.time|lifetime/i.test(pageText)) pricingModel = 'one-time';
  else if (/custom|contact.for/i.test(pageText)) pricingModel = 'custom';
  else if (plans.length > 0) pricingModel = 'subscription';

  return { plans: plans.slice(0, 6), pricingModel };
}

// ─── Tech Stack Detection ─────────────

function detectTechStack($: cheerio.CheerioAPI, html: string): TechStack {
  // Framework detection
  let framework: string | undefined;
  if (html.includes('__next') || html.includes('_next/static')) framework = 'Next.js';
  else if (html.includes('__nuxt') || html.includes('_nuxt/')) framework = 'Nuxt.js';
  else if (html.includes('ng-version') || html.includes('ng-app')) framework = 'Angular';
  else if (html.includes('data-reactroot') || html.includes('reactroot')) framework = 'React';
  else if (html.includes('vue-') || html.includes('data-v-')) framework = 'Vue.js';
  else if (html.includes('gatsby') || html.includes('___gatsby')) framework = 'Gatsby';
  else if (html.includes('__static_portal') || html.includes('shopify')) framework = 'Shopify';
  else if (html.includes('wordpress') || html.includes('wp-content')) framework = 'WordPress';
  else if (html.includes('webflow')) framework = 'Webflow';
  else if (html.includes('framer-motion') || html.includes('framer.com')) framework = 'Framer';

  // Analytics detection
  const analytics: string[] = [];
  if (html.includes('google-analytics') || html.includes('gtag') || html.includes('GA_MEASUREMENT_ID')) analytics.push('Google Analytics');
  if (html.includes('googletagmanager')) analytics.push('Google Tag Manager');
  if (html.includes('hotjar')) analytics.push('Hotjar');
  if (html.includes('mixpanel')) analytics.push('Mixpanel');
  if (html.includes('amplitude')) analytics.push('Amplitude');
  if (html.includes('segment.com') || html.includes('analytics.js')) analytics.push('Segment');
  if (html.includes('plausible')) analytics.push('Plausible');
  if (html.includes('umami')) analytics.push('Umami');
  if (html.includes('facebook') && html.includes('pixel')) analytics.push('Facebook Pixel');
  if (html.includes('clarity.ms')) analytics.push('Microsoft Clarity');

  // CMS detection
  let cms: string | undefined;
  if (html.includes('wp-content') || html.includes('wordpress')) cms = 'WordPress';
  else if (html.includes('contentful')) cms = 'Contentful';
  else if (html.includes('sanity.io') || html.includes('sanity')) cms = 'Sanity';
  else if (html.includes('strapi')) cms = 'Strapi';
  else if (html.includes('webflow')) cms = 'Webflow';
  else if (html.includes('shopify')) cms = 'Shopify';
  else if (html.includes('squarespace')) cms = 'Squarespace';
  else if (html.includes('wix.com')) cms = 'Wix';

  // CDN detection
  let cdn: string | undefined;
  if (html.includes('cloudflare') || html.includes('cf-ray')) cdn = 'Cloudflare';
  else if (html.includes('cloudfront')) cdn = 'AWS CloudFront';
  else if (html.includes('fastly')) cdn = 'Fastly';
  else if (html.includes('akamai')) cdn = 'Akamai';
  else if (html.includes('vercel') || html.includes('_vercel')) cdn = 'Vercel';
  else if (html.includes('netlify')) cdn = 'Netlify';

  return { framework, analytics, cms, cdn };
}

// ─── Blog Page Helpers ────────────────

function countBlogPosts($: cheerio.CheerioAPI): { count: number; lastDate?: string } {
  const posts = $('article, [class*="post"], [class*="blog-item"], [class*="card"]')
    .filter((_, el) => {
      const text = $(el).text();
      return text.length > 50 && text.length < 5000;
    });

  // Try to find dates
  const dates = posts
    .find('time, [class*="date"], [datetime]')
    .map((_, el) => $(el).attr('datetime') || $(el).text().trim())
    .get()
    .map((d: string) => new Date(d))
    .filter((d: Date) => !isNaN(d.getTime()))
    .sort((a: Date, b: Date) => b.getTime() - a.getTime());

  return {
    count: posts.length,
    lastDate: dates.length > 0 ? dates[0].toISOString() : undefined,
  };
}

// ─── URL Helpers ──────────────────────

function findPricingUrl($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const links = $('a[href]')
    .map((_, el) => ({ href: $(el).attr('href') || '', text: $(el).text().trim().toLowerCase() }))
    .get()
    .filter((l: { href: string; text: string }) => /pric|plan|tier/i.test(l.text) || /pric|plan|tier/i.test(l.href));

  if (links.length === 0) return null;
  return resolveUrl(links[0].href, baseUrl);
}

function findBlogUrl($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const links = $('a[href]')
    .map((_, el) => ({ href: $(el).attr('href') || '', text: $(el).text().trim().toLowerCase() }))
    .get()
    .filter((l: { href: string; text: string }) => /blog|article|post|news/i.test(l.text) || /blog|article|news/i.test(l.href));

  if (links.length === 0) return null;
  return resolveUrl(links[0].href, baseUrl);
}

function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

// ─── Keyword Extraction ───────────────

function extractTopKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'it', 'its', 'we',
    'our', 'you', 'your', 'they', 'them', 'their', 'about', 'more', 'all',
    'any', 'if', 'up', 'out', 'just', 'also', 'than', 'so', 'no', 'not',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w: string) => w.length > 2 && !stopWords.has(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

// ─── Comparison Table Builder ─────────

function buildComparisonTable(competitors: CompetitorAnalysis[]): ComparisonTable {
  if (competitors.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = competitors.map((c) => c.domain);

  const rows = [
    {
      label: 'Title',
      values: competitors.map((c) => c.structure.title || '—'),
    },
    {
      label: 'H1 Tags',
      values: competitors.map((c) => c.structure.h1Tags.join(', ') || '—'),
    },
    {
      label: 'Word Count',
      values: competitors.map((c) => String(c.content.wordCount)),
    },
    {
      label: 'Blog Posts',
      values: competitors.map((c) => String(c.content.blogPostCount)),
    },
    {
      label: 'Content Freshness',
      values: competitors.map((c) => c.content.contentFreshness),
    },
    {
      label: 'Schema Markup',
      values: competitors.map((c) => c.seo.hasSchemaMarkup ? '✅' : '❌'),
    },
    {
      label: 'Sitemap',
      values: competitors.map((c) => c.seo.hasSitemap ? '✅' : '❌'),
    },
    {
      label: 'Pricing Page',
      values: competitors.map((c) => c.pricing.hasPricingPage ? '✅' : '❌'),
    },
    {
      label: 'Pricing Model',
      values: competitors.map((c) => c.pricing.pricingModel || '—'),
    },
    {
      label: 'Testimonials',
      values: competitors.map((c) => c.structure.hasTestimonials ? '✅' : '❌'),
    },
    {
      label: 'Contact Info',
      values: competitors.map((c) => {
        const parts: string[] = [];
        if (c.contact.emails.length > 0) parts.push(`${c.contact.emails.length} emails`);
        if (c.contact.phones.length > 0) parts.push(`${c.contact.phones.length} phones`);
        if (Object.keys(c.contact.socialLinks).length > 0) {
          parts.push(`${Object.keys(c.contact.socialLinks).length} social`);
        }
        return parts.join(', ') || '—';
      }),
    },
    {
      label: 'Framework',
      values: competitors.map((c) => c.techStack.framework || '—'),
    },
    {
      label: 'Analytics',
      values: competitors.map((c) => c.techStack.analytics?.join(', ') || '—'),
    },
    {
      label: 'CMS',
      values: competitors.map((c) => c.techStack.cms || '—'),
    },
    {
      label: 'CDN',
      values: competitors.map((c) => c.techStack.cdn || '—'),
    },
    {
      label: 'Navigation Items',
      values: competitors.map((c) => String(c.structure.navigation.length)),
    },
    {
      label: 'Pages Found',
      values: competitors.map((c) => String(c.structure.pages.length)),
    },
  ];

  return { headers, rows };
}

// ─── Report Generation ────────────────

/**
 * Generate a Markdown report from a competitor analysis.
 */
export function generateReport(analysis: CompetitorAnalysis, swot: SwotAnalysis): string {
  const lines: string[] = [];

  lines.push(`# Competitor Analysis: ${analysis.domain}`);
  lines.push(`*Generated: ${new Date(analysis.scrapedAt).toISOString()}*\n`);

  lines.push('## Website Structure');
  lines.push(`- **Title:** ${analysis.structure.title || '—'}`);
  lines.push(`- **Description:** ${analysis.structure.description || '—'}`);
  lines.push(`- **H1 Tags:** ${analysis.structure.h1Tags.length > 0 ? analysis.structure.h1Tags.join(', ') : '—'}`);
  lines.push(`- **Navigation Items:** ${analysis.structure.navigation.length}`);
  lines.push(`- **Pages Found:** ${analysis.structure.pages.length}`);
  lines.push(`- **Has Blog:** ${analysis.structure.hasBlog ? '✅' : '❌'}`);
  lines.push(`- **Has Pricing:** ${analysis.structure.hasPricing ? '✅' : '❌'}`);
  lines.push(`- **Has Contact:** ${analysis.structure.hasContact ? '✅' : '❌'}`);
  lines.push(`- **Has Testimonials:** ${analysis.structure.hasTestimonials ? '✅' : '❌'}\n`);

  lines.push('## SEO Signals');
  lines.push(`- **Title Tag:** ${analysis.seo.titleTag || '—'}`);
  lines.push(`- **Meta Description:** ${analysis.seo.metaDescription ? analysis.seo.metaDescription.slice(0, 100) + '...' : '—'}`);
  lines.push(`- **Canonical URL:** ${analysis.seo.canonicalUrl || '—'}`);
  lines.push(`- **Schema Markup:** ${analysis.seo.hasSchemaMarkup ? '✅' : '❌'}`);
  lines.push(`- **Sitemap:** ${analysis.seo.hasSitemap ? '✅' : '❌'}`);
  lines.push(`- **OG Image:** ${analysis.seo.ogImage ? '✅' : '❌'}`);
  lines.push(`- **Robots Meta:** ${analysis.seo.robotsMeta || '—'}\n`);

  lines.push('## Content Signals');
  lines.push(`- **Word Count:** ${analysis.content.wordCount.toLocaleString()}`);
  lines.push(`- **Blog Posts:** ${analysis.content.blogPostCount}`);
  lines.push(`- **Content Freshness:** ${analysis.content.contentFreshness}`);
  lines.push(`- **Top Keywords:** ${analysis.content.topKeywords.slice(0, 8).join(', ') || '—'}\n`);

  lines.push('## Contact Information');
  lines.push(`- **Emails:** ${analysis.contact.emails.join(', ') || '—'}`);
  lines.push(`- **Phones:** ${analysis.contact.phones.join(', ') || '—'}`);
  const socials = Object.entries(analysis.contact.socialLinks);
  if (socials.length > 0) {
    lines.push(`- **Social Links:** ${socials.map(([k, v]) => `${k}: ${v}`).join(', ')}`);
  }
  lines.push('');

  lines.push('## Pricing');
  lines.push(`- **Has Pricing Page:** ${analysis.pricing.hasPricingPage ? '✅' : '❌'}`);
  lines.push(`- **Pricing Model:** ${analysis.pricing.pricingModel || '—'}`);
  if (analysis.pricing.plans.length > 0) {
    lines.push('- **Plans:**');
    for (const plan of analysis.pricing.plans) {
      lines.push(`  - ${plan.name}: ${plan.price}`);
    }
  }
  lines.push('');

  lines.push('## Tech Stack');
  lines.push(`- **Framework:** ${analysis.techStack.framework || '—'}`);
  lines.push(`- **Analytics:** ${analysis.techStack.analytics?.join(', ') || '—'}`);
  lines.push(`- **CMS:** ${analysis.techStack.cms || '—'}`);
  lines.push(`- **CDN:** ${analysis.techStack.cdn || '—'}\n`);

  lines.push('## SWOT Analysis');
  lines.push(`### Strengths`);
  for (const s of swot.strengths) lines.push(`- ✅ ${s}`);
  lines.push(`### Weaknesses`);
  for (const w of swot.weaknesses) lines.push(`- ❌ ${w}`);
  lines.push(`### Opportunities`);
  for (const o of swot.opportunities) lines.push(`- 🎯 ${o}`);
  lines.push(`### Threats`);
  for (const t of swot.threats) lines.push(`- ⚠️ ${t}`);
  lines.push('');
  lines.push(`**Summary:** ${swot.summary}\n`);

  return lines.join('\n');
}

// ─── Helpers ──────────────────────────

async function fetchPage(url: string, timeoutMs: number): Promise<string> {
  // SSRF protection: block private/internal IPs
  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname;

  if (isPrivateHost(hostname)) {
    throw new Error(`SSRF blocked: cannot fetch internal/private address: ${hostname}`);
  }

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ORACLEBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    timeoutMs,
  });

  if (!response.ok) {
    throw new Error(`HTTP error (${response.status}) fetching ${url}`);
  }

  return response.text();
}
