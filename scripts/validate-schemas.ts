#!/usr/bin/env node
// ═══════════════════════════════════════
// ORACLE — JSON-LD Schema Validation Script
// Validates all exported schemas against Google Rich Results requirements
// and exports them as JSON-LD files for manual testing.
//
// Usage: npx tsx scripts/validate-schemas.ts
// ═══════════════════════════════════════

import * as fs from 'fs';
import * as path from 'path';
import {
  ORACLE_APP_SCHEMA,
  ORACLE_ORG_SCHEMA,
  ORACLE_FAQ_SCHEMA,
  ORACLE_PRODUCT_SCHEMA,
  ORACLE_IOS_APP_SCHEMA,
  ORACLE_ANDROID_APP_SCHEMA,
  oracleEventSchema,
  oracleVideoSchema,
  oracleCourseSchema,
  oracleHowToSchema,
  oracleReviewSchema,
  oracleAggregateRatingSchema,
  oracleLocalBusinessSchema,
  oracleServiceSchema,
  oracleItemListSchema,
  oracleWebPageSchema,
  authBreadcrumbSchema,
} from '../src/components/ui/json-ld/schemas';

// ─── Validation Helpers ────────────────

type Schema = Record<string, unknown>;

interface ValidationResult {
  schema: string;
  type: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

const results: ValidationResult[] = [];

function validate(name: string, schema: Schema, checks: ((s: Schema) => string[])[]) {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const check of checks) {
    const issues = check(schema);
    for (const issue of issues) {
      if (issue.startsWith('WARN:')) {
        warnings.push(issue.slice(5).trim());
      } else {
        errors.push(issue);
      }
    }
  }

  results.push({
    schema: name,
    type: (schema['@type'] as string) || 'unknown',
    passed: errors.length === 0,
    errors,
    warnings,
  });
}

function expectContext(s: Schema): string[] {
  if (s['@context'] !== 'https://schema.org') return ['Missing or invalid @context (expected "https://schema.org")'];
  return [];
}

function expectType(s: Schema, type: string): string[] {
  if (s['@type'] !== type) return [`Missing or wrong @type (expected "${type}", got "${s['@type']}")`];
  return [];
}

function expectUrl(s: Schema, field = 'url'): string[] {
  const val = s[field] as string | undefined;
  if (!val) return [];
  if (!/^https?:\/\//.test(val)) return [`"${field}" is not a valid URL: ${val}`];
  return [];
}

function expectNonEmpty(s: Schema, field: string): string[] {
  const val = s[field];
  if (val === undefined || val === null) return [];
  if (typeof val === 'string' && val.trim().length === 0) return [`"${field}" is empty`];
  return [];
}

function expectPositiveNumber(s: Schema, field: string): string[] {
  const val = s[field];
  if (val === undefined) return [];
  if (typeof val !== 'number' || val <= 0) return [`"${field}" must be a positive number`];
  return [];
}

function expectIsoDate(s: Schema, field: string): string[] {
  const val = s[field] as string | undefined;
  if (!val) return [];
  try {
    new Date(val);
  } catch {
    return [`WARN: "${field}" may not be a valid ISO date: ${val}`];
  }
  return [];
}

function expectEnum(s: Schema, field: string, allowed: string[]): string[] {
  const val = s[field] as string | undefined;
  if (!val) return [];
  if (!allowed.includes(val)) return [`"${field}" value "${val}" is not in allowed values: ${allowed.join(', ')}`];
  return [];
}

function expectArrayMinLength(s: Schema, field: string, min: number): string[] {
  const val = s[field];
  if (!Array.isArray(val) || val.length < min) return [`"${field}" must have at least ${min} items`];
  return [];
}

// ─── Schema Validators ─────────────────

// WebApplication
validate('ORACLE_APP_SCHEMA', ORACLE_APP_SCHEMA as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'WebApplication'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'description'),
  (s) => expectUrl(s, 'url'),
  (s) => expectNonEmpty(s, 'applicationCategory'),
  (s) => expectNonEmpty(s, 'operatingSystem'),
]);

// Organization
validate('ORACLE_ORG_SCHEMA', ORACLE_ORG_SCHEMA as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'Organization'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectUrl(s, 'url'),
  (s) => {
    const logo = s['logo'] as Record<string, unknown> | undefined;
    if (logo) {
      if (typeof logo.url !== 'string' || !logo.url.startsWith('http')) return ['Logo URL is invalid'];
      if (typeof logo.width !== 'number' || typeof logo.height !== 'number') return ['Logo dimensions missing'];
    }
    return [];
  },
  (s) => {
    const cp = s['contactPoint'] as Record<string, unknown> | undefined;
    if (cp) {
      if (!cp.contactType) return ['contactPoint.contactType missing'];
      if (typeof cp.email === 'string' && !cp.email.includes('@')) return ['contactPoint.email is invalid'];
    }
    return [];
  },
]);

// FAQPage
validate('ORACLE_FAQ_SCHEMA', ORACLE_FAQ_SCHEMA as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'FAQPage'),
  (s) => expectArrayMinLength(s, 'mainEntity', 1),
  (s) => {
    const entities = s['mainEntity'] as Record<string, unknown>[] | undefined;
    if (!entities) return [];
    const issues: string[] = [];
    for (let i = 0; i < entities.length; i++) {
      const q = entities[i];
      if (q['@type'] !== 'Question') issues.push(`mainEntity[${i}].@type is not "Question"`);
      if (!q.name || (typeof q.name === 'string' && !q.name.trim())) issues.push(`mainEntity[${i}].name is empty`);
      const answer = q['acceptedAnswer'] as Record<string, unknown> | undefined;
      if (!answer) {
        issues.push(`mainEntity[${i}].acceptedAnswer missing`);
      } else {
        if (answer['@type'] !== 'Answer') issues.push(`mainEntity[${i}].acceptedAnswer.@type is not "Answer"`);
        if (!answer.text || (typeof answer.text === 'string' && !answer.text.trim())) issues.push(`mainEntity[${i}].acceptedAnswer.text is empty`);
      }
    }
    return issues;
  },
]);

// Product
validate('ORACLE_PRODUCT_SCHEMA', ORACLE_PRODUCT_SCHEMA as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'Product'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'description'),
  (s) => expectUrl(s, 'url'),
  (s) => {
    const offers = s['offers'] as Record<string, unknown> | undefined;
    if (!offers) return ['Product.offers missing'];
    const issues: string[] = [];
    if (offers['@type'] !== 'Offer') issues.push('offers.@type is not "Offer"');
    if (offers.price === undefined) issues.push('offers.price missing');
    if (!offers.priceCurrency) issues.push('offers.priceCurrency missing');
    if (offers.availability && typeof offers.availability === 'string' && !offers.availability.startsWith('https://schema.org/')) {
      issues.push('WARN: offers.availability should be a full Schema.org URL');
    }
    return issues;
  },
]);

// SoftwareApplication (iOS)
validate('ORACLE_IOS_APP_SCHEMA', ORACLE_IOS_APP_SCHEMA as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'SoftwareApplication'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'description'),
  (s) => expectUrl(s, 'url'),
  (s) => expectNonEmpty(s, 'applicationCategory'),
  (s) => expectNonEmpty(s, 'operatingSystem'),
]);

// SoftwareApplication (Android)
validate('ORACLE_ANDROID_APP_SCHEMA', ORACLE_ANDROID_APP_SCHEMA as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'SoftwareApplication'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'description'),
  (s) => expectUrl(s, 'url'),
  (s) => expectNonEmpty(s, 'applicationCategory'),
  (s) => expectNonEmpty(s, 'operatingSystem'),
]);

// Event (sample)
const sampleEvent = oracleEventSchema({
  name: 'ORACLE Launch Webinar',
  description: 'Join us for the ORACLE platform launch',
  url: 'https://oracle.app/events/launch',
  startDate: '2026-07-15T10:00:00+05:30',
  endDate: '2026-07-15T11:30:00+05:30',
});

validate('oracleEventSchema (sample)', sampleEvent as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'Event'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'description'),
  (s) => expectUrl(s, 'url'),
  (s) => expectIsoDate(s, 'startDate'),
  (s) => expectIsoDate(s, 'endDate'),
  (s) => expectEnum(s, 'eventStatus', [
    'https://schema.org/EventScheduled',
    'https://schema.org/EventCancelled',
    'https://schema.org/EventPostponed',
    'https://schema.org/EventRescheduled',
  ]),
  (s) => expectEnum(s, 'eventAttendanceMode', [
    'https://schema.org/OnlineEventAttendanceMode',
    'https://schema.org/OfflineEventAttendanceMode',
    'https://schema.org/MixedEventAttendanceMode',
  ]),
]);

// VideoObject (sample)
const sampleVideo = oracleVideoSchema({
  name: 'ORACLE Getting Started',
  description: 'Learn how to set up ORACLE for your agency',
  thumbnailUrl: 'https://oracle.app/videos/getting-started.jpg',
  uploadDate: '2026-06-01',
});

validate('oracleVideoSchema (sample)', sampleVideo as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'VideoObject'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'description'),
  (s) => expectUrl(s, 'thumbnailUrl'),
  (s) => expectIsoDate(s, 'uploadDate'),
]);

// Course (sample)
const sampleCourse = oracleCourseSchema({
  name: 'ORACLE SEO Mastery',
  description: 'Learn SEO best practices for agency clients',
  url: 'https://oracle.app/courses/seo-mastery',
});

validate('oracleCourseSchema (sample)', sampleCourse as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'Course'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'description'),
  (s) => expectUrl(s, 'url'),
]);

// HowTo (sample)
const sampleHowTo = oracleHowToSchema({
  name: 'How to set up ORACLE for your agency',
  description: 'A step-by-step guide to configure ORACLE',
  url: 'https://oracle.app/guides/setup',
  step: [
    { name: 'Create account', text: 'Sign up at oracle.app' },
    { name: 'Configure providers', text: 'Add API keys' },
  ],
});

validate('oracleHowToSchema (sample)', sampleHowTo as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'HowTo'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'description'),
  (s) => expectUrl(s, 'url'),
  (s) => expectArrayMinLength(s, 'step', 2),
]);

// Review (sample)
const sampleReview = oracleReviewSchema({
  name: 'ORACLE transformed our workflow',
  reviewBody: 'Saved 10+ hours per week with AI routing.',
  datePublished: '2026-05-15',
  authorName: 'Priya Sharma',
  ratingValue: 5,
});

validate('oracleReviewSchema (sample)', sampleReview as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'Review'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'reviewBody'),
  (s) => expectIsoDate(s, 'datePublished'),
  (s) => expectPositiveNumber(s, 'ratingValue'),
]);

// AggregateRating (sample)
const sampleRating = oracleAggregateRatingSchema({ ratingValue: 4.8, ratingCount: 120 });

validate('oracleAggregateRatingSchema (sample)', sampleRating as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'AggregateRating'),
  (s) => expectPositiveNumber(s, 'ratingValue'),
  (s) => expectPositiveNumber(s, 'ratingCount'),
]);

// LocalBusiness (sample)
const sampleBiz = oracleLocalBusinessSchema({
  name: 'WebCraft Digital Agency',
  description: 'Full-service digital agency specialising in SEO',
  url: 'https://webcraft.in',
  address: { addressLocality: 'Mumbai', addressCountry: 'IN' },
});

validate('oracleLocalBusinessSchema (sample)', sampleBiz as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'LocalBusiness'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'description'),
  (s) => expectUrl(s, 'url'),
]);

// Service (sample)
const sampleService = oracleServiceSchema({
  name: 'SEO Optimisation',
  description: 'Comprehensive SEO strategy for agency clients',
  url: 'https://oracle.app/services/seo',
  serviceType: 'SearchEngineOptimization',
});

validate('oracleServiceSchema (sample)', sampleService as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'Service'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'description'),
  (s) => expectUrl(s, 'url'),
]);

// ItemList (sample)
const sampleItemList = oracleItemListSchema({
  name: 'ORACLE Service Domains',
  description: '40+ AI-powered service domains',
  url: 'https://oracle.app/services',
  items: [
    { name: 'SEO', url: 'https://oracle.app/services/seo' },
    { name: 'Google Ads', url: 'https://oracle.app/services/google-ads' },
    { name: 'Meta Ads', url: 'https://oracle.app/services/meta-ads' },
  ],
});

validate('oracleItemListSchema (sample)', sampleItemList as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'ItemList'),
  (s) => expectArrayMinLength(s, 'itemListElement', 1),
]);

// WebPage (sample)
const sampleWebPage = oracleWebPageSchema({
  name: 'ORACLE SEO Services',
  description: 'AI-powered SEO optimisation for digital agencies',
  url: 'https://oracle.app/services/seo',
});

validate('oracleWebPageSchema (sample)', sampleWebPage as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'WebPage'),
  (s) => expectNonEmpty(s, 'name'),
  (s) => expectNonEmpty(s, 'description'),
  (s) => expectUrl(s, 'url'),
]);

// BreadcrumbList (sample)
const sampleBreadcrumb = authBreadcrumbSchema([
  { name: 'ORACLE', url: '/' },
  { name: 'Sign In', url: '/login' },
]);

validate('authBreadcrumbSchema (sample)', sampleBreadcrumb as unknown as Schema, [
  (s) => expectContext(s),
  (s) => expectType(s, 'BreadcrumbList'),
  (s) => expectArrayMinLength(s, 'itemListElement', 1),
]);

// ─── Export JSON-LD files ──────────────

const outputDir = path.resolve(__dirname, '../json-ld-output');

function exportSchema(name: string, schema: Schema) {
  const filePath = path.join(outputDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(schema, null, 2));
}

// ─── Run ───────────────────────────────

console.log('\n═══════════════════════════════════════');
console.log('  ORACLE — JSON-LD Schema Validator');
console.log('═══════════════════════════════════════\n');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Export all schemas
const allSchemas: [string, Schema][] = [
  ['01-oracle-webapp', ORACLE_APP_SCHEMA as unknown as Schema],
  ['02-oracle-organization', ORACLE_ORG_SCHEMA as unknown as Schema],
  ['03-oracle-faq', ORACLE_FAQ_SCHEMA as unknown as Schema],
  ['04-oracle-product', ORACLE_PRODUCT_SCHEMA as unknown as Schema],
  ['05-oracle-ios-app', ORACLE_IOS_APP_SCHEMA as unknown as Schema],
  ['06-oracle-android-app', ORACLE_ANDROID_APP_SCHEMA as unknown as Schema],
  ['07-oracle-event', sampleEvent as unknown as Schema],
  ['08-oracle-video', sampleVideo as unknown as Schema],
  ['09-oracle-course', sampleCourse as unknown as Schema],
  ['10-oracle-howto', sampleHowTo as unknown as Schema],
  ['11-oracle-review', sampleReview as unknown as Schema],
  ['12-oracle-aggregaterating', sampleRating as unknown as Schema],
  ['13-oracle-localbusiness', sampleBiz as unknown as Schema],
  ['14-oracle-service', sampleService as unknown as Schema],
  ['15-oracle-itemlist', sampleItemList as unknown as Schema],
  ['17-oracle-webpage', sampleWebPage as unknown as Schema],
  ['18-oracle-breadcrumb', sampleBreadcrumb as unknown as Schema],
];

console.log(`Exporting ${allSchemas.length} schemas to ${outputDir}/\n`);

for (const [name, schema] of allSchemas) {
  exportSchema(name, schema);
  console.log(`  ✓ ${name}.json`);
}

console.log('');

// Print validation results
let totalPassed = 0;
let totalFailed = 0;
let totalWarnings = 0;

for (const r of results) {
  const icon = r.passed ? '✅' : '❌';
  console.log(`${icon} ${r.schema} (${r.type})`);

  for (const e of r.errors) {
    console.log(`   ❌ ERROR: ${e}`);
  }
  for (const w of r.warnings) {
    console.log(`   ⚠️  WARN: ${w}`);
  }

  if (r.passed) totalPassed++;
  else totalFailed++;
  totalWarnings += r.warnings.length;
}

console.log('\n═══════════════════════════════════════');
console.log(`  Results: ${totalPassed} passed, ${totalFailed} failed, ${totalWarnings} warnings`);
console.log('═══════════════════════════════════════\n');

if (totalFailed > 0) {
  console.log('❌ Validation failed. Fix the errors above.\n');
  process.exit(1);
} else {
  console.log('✅ All schemas pass Google Rich Results requirements.\n');
  console.log('Next steps:');
  console.log('  1. Paste any .json file into https://search.google.com/test/rich-results');
  console.log('  2. Or validate at https://validator.schema.org/\n');
  process.exit(0);
}
