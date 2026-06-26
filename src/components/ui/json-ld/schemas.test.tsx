import { describe, it, expect } from 'vitest';
import type { TypedSchema } from './schemas';
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
} from './schemas';

// ─── Shared Validators ─────────────────

function expectSchemaBase(schema: TypedSchema) {
  expect(schema['@context']).toBe('https://schema.org');
  expect(typeof schema['@type']).toBe('string');
  expect((schema['@type'] as string).length).toBeGreaterThan(0);
}

function expectNonEmptyString(value: unknown, field: string) {
  expect(typeof value, `${field} should be a string`).toBe('string');
  expect((value as string).length, `${field} should not be empty`).toBeGreaterThan(0);
}

// ─── Schema Validation Tests ───────────

describe('ORACLE_APP_SCHEMA', () => {
  it('has valid Schema.org base fields', () => {
    expectSchemaBase(ORACLE_APP_SCHEMA);
    expect(ORACLE_APP_SCHEMA['@type']).toBe('WebApplication');
  });

  it('has required WebApplication fields', () => {
    expectNonEmptyString(ORACLE_APP_SCHEMA.name, 'name');
    expectNonEmptyString(ORACLE_APP_SCHEMA.description, 'description');
    expectNonEmptyString(ORACLE_APP_SCHEMA.url, 'url');
    expect(ORACLE_APP_SCHEMA.url).toMatch(/^https?:\/\//);
  });

  it('has valid @id', () => {
    expect(ORACLE_APP_SCHEMA['@id']).toMatch(/^https:\/\/oracle\.app\/#/);
  });

  it('has valid offers', () => {
    expect(ORACLE_APP_SCHEMA.offers).toBeDefined();
    expect(ORACLE_APP_SCHEMA.offers?.['@type']).toBe('Offer');
    expect(typeof ORACLE_APP_SCHEMA.offers?.price).toBe('string');
    expect(typeof ORACLE_APP_SCHEMA.offers?.priceCurrency).toBe('string');
  });

  it('has valid author', () => {
    expect(ORACLE_APP_SCHEMA.author).toBeDefined();
    expect(ORACLE_APP_SCHEMA.author?.name).toBeTruthy();
    expect(ORACLE_APP_SCHEMA.author?.url).toMatch(/^https?:\/\//);
  });
});

describe('ORACLE_ORG_SCHEMA', () => {
  it('has valid Schema.org base fields', () => {
    expectSchemaBase(ORACLE_ORG_SCHEMA);
    expect(ORACLE_ORG_SCHEMA['@type']).toBe('Organization');
  });

  it('has required Organization fields', () => {
    expectNonEmptyString(ORACLE_ORG_SCHEMA.name, 'name');
    expectNonEmptyString(ORACLE_ORG_SCHEMA.url, 'url');
    expect(ORACLE_ORG_SCHEMA.url).toMatch(/^https?:\/\//);
  });

  it('has valid logo', () => {
    expect(ORACLE_ORG_SCHEMA.logo).toBeDefined();
    expect(ORACLE_ORG_SCHEMA.logo?.['@type']).toBe('ImageObject');
    expect(ORACLE_ORG_SCHEMA.logo?.url).toMatch(/^https?:\/\//);
    expect(ORACLE_ORG_SCHEMA.logo?.width).toBeGreaterThan(0);
    expect(ORACLE_ORG_SCHEMA.logo?.height).toBeGreaterThan(0);
  });

  it('has valid contactPoint', () => {
    expect(ORACLE_ORG_SCHEMA.contactPoint).toBeDefined();
    expect(ORACLE_ORG_SCHEMA.contactPoint?.contactType).toBeTruthy();
    expect(ORACLE_ORG_SCHEMA.contactPoint?.email).toContain('@');
    expect(ORACLE_ORG_SCHEMA.contactPoint?.availableLanguage).toBeInstanceOf(Array);
    expect(ORACLE_ORG_SCHEMA.contactPoint?.availableLanguage?.length).toBeGreaterThan(0);
  });

  it('has valid foundingDate', () => {
    expect(ORACLE_ORG_SCHEMA.foundingDate).toMatch(/^\d{4}$/);
  });
});

describe('ORACLE_FAQ_SCHEMA', () => {
  it('has valid Schema.org base fields', () => {
    expectSchemaBase(ORACLE_FAQ_SCHEMA);
    expect(ORACLE_FAQ_SCHEMA['@type']).toBe('FAQPage');
  });

  it('has non-empty mainEntity array', () => {
    expect(ORACLE_FAQ_SCHEMA.mainEntity).toBeInstanceOf(Array);
    expect(ORACLE_FAQ_SCHEMA.mainEntity.length).toBeGreaterThan(0);
  });

  it('each question has valid structure', () => {
    for (const question of ORACLE_FAQ_SCHEMA.mainEntity) {
      expect(question['@type']).toBe('Question');
      expectNonEmptyString(question.name, 'question.name');
      expect(question.acceptedAnswer).toBeDefined();
      expect(question.acceptedAnswer['@type']).toBe('Answer');
      expectNonEmptyString(question.acceptedAnswer.text, 'acceptedAnswer.text');
    }
  });

  it('no question has empty name or answer', () => {
    for (const q of ORACLE_FAQ_SCHEMA.mainEntity) {
      expect(q.name.trim().length).toBeGreaterThan(0);
      expect(q.acceptedAnswer.text.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('ORACLE_PRODUCT_SCHEMA', () => {
  it('has valid Schema.org base fields', () => {
    expectSchemaBase(ORACLE_PRODUCT_SCHEMA);
    expect(ORACLE_PRODUCT_SCHEMA['@type']).toBe('Product');
  });

  it('has required Product fields', () => {
    expectNonEmptyString(ORACLE_PRODUCT_SCHEMA.name, 'name');
    expectNonEmptyString(ORACLE_PRODUCT_SCHEMA.description, 'description');
    expectNonEmptyString(ORACLE_PRODUCT_SCHEMA.url, 'url');
  });

  it('has valid offers with INR pricing', () => {
    expect(ORACLE_PRODUCT_SCHEMA.offers).toBeDefined();
    expect(ORACLE_PRODUCT_SCHEMA.offers?.price).toBe('0');
    expect(ORACLE_PRODUCT_SCHEMA.offers?.priceCurrency).toBe('INR');
    expect(ORACLE_PRODUCT_SCHEMA.offers?.availability).toBe('https://schema.org/InStock');
  });

  it('has valid brand', () => {
    expect(ORACLE_PRODUCT_SCHEMA.brand).toBeDefined();
    expect(ORACLE_PRODUCT_SCHEMA.brand?.['@type']).toBe('Brand');
    expect(ORACLE_PRODUCT_SCHEMA.brand?.name).toBeTruthy();
  });
});

describe('ORACLE_IOS_APP_SCHEMA', () => {
  it('has valid Schema.org base fields', () => {
    expectSchemaBase(ORACLE_IOS_APP_SCHEMA);
    expect(ORACLE_IOS_APP_SCHEMA['@type']).toBe('SoftwareApplication');
  });

  it('has required SoftwareApplication fields', () => {
    expectNonEmptyString(ORACLE_IOS_APP_SCHEMA.name, 'name');
    expectNonEmptyString(ORACLE_IOS_APP_SCHEMA.description, 'description');
    expectNonEmptyString(ORACLE_IOS_APP_SCHEMA.url, 'url');
    expect(ORACLE_IOS_APP_SCHEMA.url).toMatch(/^https?:\/\//);
  });

  it('has valid offers', () => {
    expect(ORACLE_IOS_APP_SCHEMA.offers).toBeDefined();
    expect(ORACLE_IOS_APP_SCHEMA.offers?.price).toBe('0');
    expect(ORACLE_IOS_APP_SCHEMA.offers?.priceCurrency).toBe('INR');
  });
});

describe('ORACLE_ANDROID_APP_SCHEMA', () => {
  it('has valid Schema.org base fields', () => {
    expectSchemaBase(ORACLE_ANDROID_APP_SCHEMA);
    expect(ORACLE_ANDROID_APP_SCHEMA['@type']).toBe('SoftwareApplication');
  });

  it('has required SoftwareApplication fields', () => {
    expectNonEmptyString(ORACLE_ANDROID_APP_SCHEMA.name, 'name');
    expectNonEmptyString(ORACLE_ANDROID_APP_SCHEMA.description, 'description');
    expectNonEmptyString(ORACLE_ANDROID_APP_SCHEMA.url, 'url');
    expect(ORACLE_ANDROID_APP_SCHEMA.url).toMatch(/^https?:\/\//);
  });

  it('has valid offers', () => {
    expect(ORACLE_ANDROID_APP_SCHEMA.offers).toBeDefined();
    expect(ORACLE_ANDROID_APP_SCHEMA.offers?.price).toBe('0');
    expect(ORACLE_ANDROID_APP_SCHEMA.offers?.priceCurrency).toBe('INR');
  });
});

describe('oracleEventSchema()', () => {
  it('creates a valid Event schema with defaults', () => {
    const schema = oracleEventSchema({
      name: 'ORACLE Launch Webinar',
      description: 'Join us for the ORACLE platform launch',
      url: 'https://oracle.app/events/launch',
      startDate: '2026-07-15T10:00:00+05:30',
      endDate: '2026-07-15T11:30:00+05:30',
    });

    expectSchemaBase(schema);
    expect(schema['@type']).toBe('Event');
    expect(schema.name).toBe('ORACLE Launch Webinar');
    expect(schema.startDate).toBe('2026-07-15T10:00:00+05:30');
    expect(schema.endDate).toBe('2026-07-15T11:30:00+05:30');
    expect(schema.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(schema.eventAttendanceMode).toBe('https://schema.org/OnlineEventAttendanceMode');
    expect(schema.organizer?.['@type']).toBe('Organization');
    expect(schema.organizer?.name).toBe('ORACLE');
  });

  it('allows overriding defaults', () => {
    const schema = oracleEventSchema({
      name: 'Agency Meetup',
      description: 'In-person meetup',
      url: 'https://oracle.app/events/meetup',
      startDate: '2026-08-01T18:00:00+05:30',
      endDate: '2026-08-01T20:00:00+05:30',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    });

    expect(schema.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
  });
});

describe('oracleVideoSchema()', () => {
  it('creates a valid VideoObject schema with author and publication', () => {
    const schema = oracleVideoSchema({
      name: 'ORACLE Getting Started',
      description: 'Learn how to set up ORACLE for your agency',
      thumbnailUrl: 'https://oracle.app/videos/getting-started.jpg',
      uploadDate: '2026-06-01',
    });

    expectSchemaBase(schema);
    expect(schema['@type']).toBe('VideoObject');
    expect(schema.name).toBe('ORACLE Getting Started');
    expect(schema.thumbnailUrl).toMatch(/^https?:\/\//);
    expect(schema.uploadDate).toBe('2026-06-01');
    expect(schema.author?.['@type']).toBe('Organization');
    expect(schema.author?.name).toBe('ORACLE');
    expect(schema.publication?.['@type']).toBe('PublicationEvent');
  });
});

describe('authBreadcrumbSchema()', () => {
  it('creates a valid BreadcrumbList schema', () => {
    const schema = authBreadcrumbSchema([
      { name: 'ORACLE', url: '/' },
      { name: 'Sign In', url: '/login' },
    ]);

    expectSchemaBase(schema);
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toBeInstanceOf(Array);
    expect(schema.itemListElement).toHaveLength(2);
  });

  it('each item has correct position and structure', () => {
    const schema = authBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Login', url: '/login' },
      { name: 'Reset', url: '/auth/reset-password' },
    ]);

    for (let i = 0; i < schema.itemListElement.length; i++) {
      const item = schema.itemListElement[i];
      expect(item['@type']).toBe('ListItem');
      expect(item.position).toBe(i + 1);
      expect(item.name).toBeTruthy();
      expect(item.item).toMatch(/^https:\/\/oracle\.app/);
    }
  });
});

describe('oracleCourseSchema()', () => {
  it('creates a valid Course schema with defaults', () => {
    const schema = oracleCourseSchema({
      name: 'ORACLE SEO Mastery',
      description: 'Learn SEO best practices for agency clients',
      url: 'https://oracle.app/courses/seo-mastery',
    });

    expectSchemaBase(schema);
    expect(schema['@type']).toBe('Course');
    expect(schema.name).toBe('ORACLE SEO Mastery');
    expect(schema.provider?.['@type']).toBe('Organization');
    expect(schema.provider?.name).toBe('ORACLE');
    expect(schema.inLanguage).toBe('en');
    expect(schema.isAccessibleForFree).toBe(true);
  });

  it('allows overriding defaults', () => {
    const schema = oracleCourseSchema({
      name: 'Advanced AI Workflows',
      description: 'Deep dive into multi-agent orchestration',
      url: 'https://oracle.app/courses/ai-workflows',
      isAccessibleForFree: false,
      educationalLevel: 'Advanced',
    });

    expect(schema.isAccessibleForFree).toBe(false);
    expect(schema.educationalLevel).toBe('Advanced');
  });
});

describe('oracleHowToSchema()', () => {
  it('creates a valid HowTo schema with required fields', () => {
    const schema = oracleHowToSchema({
      name: 'How to set up ORACLE for your agency',
      description: 'A step-by-step guide to configure ORACLE for your digital agency',
      url: 'https://oracle.app/guides/setup',
      step: [
        { name: 'Create your account', text: 'Sign up at oracle.app and verify your email' },
        { name: 'Configure AI providers', text: 'Add your API keys for OpenAI, Claude, or Gemini' },
        { name: 'Set up service domains', text: 'Select the service domains relevant to your agency' },
      ],
    });

    expectSchemaBase(schema);
    expect(schema['@type']).toBe('HowTo');
    expect(schema.name).toBe('How to set up ORACLE for your agency');
    expectNonEmptyString(schema.description, 'description');
    expect(schema.step).toBeInstanceOf(Array);
    expect(schema.step).toHaveLength(3);

    for (const step of schema.step) {
      expect(step['@type']).toBe('HowToStep');
      expectNonEmptyString(step.name, 'step.name');
      expectNonEmptyString(step.text, 'step.text');
    }
  });

  it('supports optional totalTime, tools, and supplies', () => {
    const schema = oracleHowToSchema({
      name: 'Set up WhatsApp campaigns',
      description: 'Configure WhatsApp Business API campaigns in ORACLE',
      url: 'https://oracle.app/guides/whatsapp',
      totalTime: 'PT30M',
      tool: [{ name: 'ORACLE Dashboard' }, { name: 'WhatsApp Business Account' }],
      supply: [{ name: 'Client contact list' }],
      step: [
        { name: 'Connect WhatsApp', text: 'Link your WhatsApp Business API via the integrations tab' },
        { name: 'Create campaign', text: 'Set up broadcast sequences and message templates' },
      ],
    });

    expect(schema.totalTime).toBe('PT30M');
    expect(schema.tool).toHaveLength(2);
    expect(schema.tool?.[0]['@type']).toBe('HowToTool');
    expect(schema.supply).toHaveLength(1);
    expect(schema.supply?.[0]['@type']).toBe('HowToSupply');
  });

  it('supports nested step directions', () => {
    const schema = oracleHowToSchema({
      name: 'Configure voice AI agent',
      description: 'Set up a VAPI voice agent for client support',
      url: 'https://oracle.app/guides/voice-agent',
      step: [
        {
          name: 'Select provider',
          text: 'Choose VAPI as your voice provider',
          itemListElement: [
            { text: 'Navigate to Config tab' },
            { text: 'Select VAPI from provider list' },
            { text: 'Enter your VAPI API key' },
          ],
        },
      ],
    });

    expect(schema.step[0].itemListElement).toHaveLength(3);
    expect(schema.step[0].itemListElement?.[0]['@type']).toBe('HowToDirection');
  });
});

describe('oracleReviewSchema()', () => {
  it('creates a valid Review schema with required fields', () => {
    const schema = oracleReviewSchema({
      name: 'ORACLE transformed our agency workflow',
      reviewBody: 'We switched from manual reporting to ORACLE and saved 10+ hours per week. The AI routing is incredible.',
      datePublished: '2026-05-15',
      authorName: 'Priya Sharma',
      ratingValue: 5,
    });

    expectSchemaBase(schema);
    expect(schema['@type']).toBe('Review');
    expect(schema.name).toBe('ORACLE transformed our agency workflow');
    expectNonEmptyString(schema.reviewBody, 'reviewBody');
    expect(schema.datePublished).toBe('2026-05-15');
    expect(schema.author['@type']).toBe('Person');
    expect(schema.author.name).toBe('Priya Sharma');
    expect(schema.reviewRating['@type']).toBe('Rating');
    expect(schema.reviewRating.ratingValue).toBe(5);
    expect(schema.reviewRating.bestRating).toBe(5);
    expect(schema.reviewRating.worstRating).toBe(1);
  });

  it('supports custom bestRating and itemReviewed', () => {
    const schema = oracleReviewSchema({
      name: 'Great for SEO clients',
      reviewBody: 'ORACLE handles our SEO reporting seamlessly.',
      datePublished: '2026-06-01',
      authorName: 'Rahul Mehta',
      ratingValue: 4,
      bestRating: 10,
      itemReviewed: {
        '@type': 'SoftwareApplication',
        name: 'ORACLE',
        url: 'https://oracle.app',
      },
    });

    expect(schema.reviewRating.bestRating).toBe(10);
    expect(schema.itemReviewed).toBeDefined();
    expect(schema.itemReviewed?.['@type']).toBe('SoftwareApplication');
  });

  it('omits itemReviewed when not provided', () => {
    const schema = oracleReviewSchema({
      name: 'Excellent support',
      reviewBody: 'The team is responsive and helpful.',
      datePublished: '2026-04-10',
      authorName: 'Aisha Khan',
      ratingValue: 5,
    });

    expect(schema.itemReviewed).toBeUndefined();
  });
});

describe('oracleAggregateRatingSchema()', () => {
  it('creates a valid AggregateRating schema with defaults', () => {
    const schema = oracleAggregateRatingSchema({
      ratingValue: 4.8,
      ratingCount: 120,
    });

    expectSchemaBase(schema);
    expect(schema['@type']).toBe('AggregateRating');
    expect(schema.ratingValue).toBe(4.8);
    expect(schema.ratingCount).toBe(120);
    expect(schema.bestRating).toBe(5);
    expect(schema.worstRating).toBe(1);
  });

  it('supports custom bestRating', () => {
    const schema = oracleAggregateRatingSchema({
      ratingValue: 8.5,
      ratingCount: 50,
      bestRating: 10,
    });

    expect(schema.bestRating).toBe(10);
  });
});

describe('oracleLocalBusinessSchema()', () => {
  it('creates a valid LocalBusiness schema with required fields', () => {
    const schema = oracleLocalBusinessSchema({
      name: 'WebCraft Digital Agency',
      description: 'Full-service digital agency specialising in SEO and web development',
      url: 'https://webcraft.in',
      address: {
        addressLocality: 'Mumbai',
        addressCountry: 'IN',
      },
    });

    expectSchemaBase(schema);
    expect(schema['@type']).toBe('LocalBusiness');
    expect(schema.name).toBe('WebCraft Digital Agency');
    expectNonEmptyString(schema.description, 'description');
    expect(schema.address).toBeDefined();
    expect(schema.address?.['@type']).toBe('PostalAddress');
    expect(schema.address?.addressLocality).toBe('Mumbai');
    expect(schema.address?.addressCountry).toBe('IN');
  });

  it('supports geo coordinates, telephone, and opening hours', () => {
    const schema = oracleLocalBusinessSchema({
      name: 'PixelPerfect Agency',
      description: 'Creative agency for UI/UX and branding',
      url: 'https://pixelperfect.in',
      telephone: '+91-22-1234-5678',
      email: 'hello@pixelperfect.in',
      address: {
        streetAddress: '42 MG Road',
        addressLocality: 'Bangalore',
        addressRegion: 'Karnataka',
        postalCode: '560001',
        addressCountry: 'IN',
      },
      geo: { latitude: 12.9716, longitude: 77.5946 },
      openingHoursSpecification: [
        { dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '18:00' },
        { dayOfWeek: 'Saturday', opens: '10:00', closes: '14:00' },
      ],
      priceRange: '$$',
      sameAs: ['https://facebook.com/pixelperfect', 'https://linkedin.com/company/pixelperfect'],
    });

    expect(schema.telephone).toBe('+91-22-1234-5678');
    expect(schema.email).toBe('hello@pixelperfect.in');
    expect(schema.geo?.['@type']).toBe('GeoCoordinates');
    expect(schema.geo?.latitude).toBe(12.9716);
    expect(schema.geo?.longitude).toBe(77.5946);
    expect(schema.openingHoursSpecification).toHaveLength(2);
    expect(schema.openingHoursSpecification?.[0]['@type']).toBe('OpeningHoursSpecification');
    expect(schema.priceRange).toBe('$$');
    expect(schema.sameAs).toHaveLength(2);
  });

  it('supports aggregateRating', () => {
    const rating = { '@context': 'https://schema.org', '@type': 'AggregateRating' as const, ratingValue: 4.8, ratingCount: 120, bestRating: 5, worstRating: 1 };
    const schema = oracleLocalBusinessSchema({
      name: 'TopRank Agency',
      description: 'Award-winning digital agency',
      url: 'https://toprank.in',
      aggregateRating: rating,
    });

    expect(schema.aggregateRating).toBeDefined();
    expect(schema.aggregateRating?.['@type']).toBe('AggregateRating');
    expect(schema.aggregateRating?.ratingValue).toBe(4.8);
  });
});

describe('oracleServiceSchema()', () => {
  it('creates a valid Service schema with required fields', () => {
    const schema = oracleServiceSchema({
      name: 'SEO Optimisation',
      description: 'Comprehensive SEO strategy including keyword research, on-page optimisation, and link building for agency clients',
      url: 'https://oracle.app/services/seo',
      serviceType: 'SearchEngineOptimization',
    });

    expectSchemaBase(schema);
    expect(schema['@type']).toBe('Service');
    expect(schema.name).toBe('SEO Optimisation');
    expectNonEmptyString(schema.description, 'description');
    expect(schema.provider?.['@type']).toBe('Organization');
    expect(schema.provider?.name).toBe('ORACLE');
  });

  it('supports areaServed, serviceOutput, and offers', () => {
    const schema = oracleServiceSchema({
      name: 'Google Ads Management',
      description: 'End-to-end Google Ads campaign management for clients',
      url: 'https://oracle.app/services/google-ads',
      serviceType: 'PPC',
      areaServed: [{ '@type': 'Place', name: 'India' }, { '@type': 'Place', name: 'UAE' }],
      serviceOutput: [{ name: 'Monthly performance report' }, { name: 'ROI analysis' }],
      offers: { '@type': 'Offer', price: 'Custom', priceCurrency: 'INR' },
    });

    expect(schema.areaServed).toHaveLength(2);
    expect(schema.serviceOutput).toHaveLength(2);
    expect(schema.serviceOutput?.[0]['@type']).toBe('DefinedTerm');
    expect(schema.offers).toBeDefined();
  });

  it('supports string areaServed and aggregateRating', () => {
    const rating = { '@context': 'https://schema.org', '@type': 'AggregateRating' as const, ratingValue: 4.9, ratingCount: 80, bestRating: 5, worstRating: 1 };
    const schema = oracleServiceSchema({
      name: 'Meta Ads Management',
      description: 'Facebook and Instagram ads for lead generation',
      url: 'https://oracle.app/services/meta-ads',
      areaServed: 'Mumbai, India',
      aggregateRating: rating,
    });

    expect(schema.areaServed).toBe('Mumbai, India');
    expect(schema.aggregateRating?.ratingValue).toBe(4.9);
  });
});

describe('oracleItemListSchema()', () => {
  it('creates a valid ItemList schema with required fields', () => {
    const schema = oracleItemListSchema({
      name: 'ORACLE Service Domains',
      description: '40+ AI-powered service domains for digital agencies',
      url: 'https://oracle.app/services',
      items: [
        { name: 'SEO', url: 'https://oracle.app/services/seo', description: 'Search engine optimisation' },
        { name: 'Google Ads', url: 'https://oracle.app/services/google-ads', description: 'PPC campaign management' },
        { name: 'Meta Ads', url: 'https://oracle.app/services/meta-ads', description: 'Social media advertising' },
      ],
    });

    expectSchemaBase(schema);
    expect(schema['@type']).toBe('ItemList');
    expect(schema.name).toBe('ORACLE Service Domains');
    expect(schema.numberOfItems).toBe(3);
    expect(schema.itemListOrder).toBe('https://schema.org/ItemListUnordered');
    expect(schema.itemListElement).toHaveLength(3);

    for (const item of schema.itemListElement) {
      expect(item['@type']).toBe('ListItem');
      expect(item.position).toBeGreaterThan(0);
      expectNonEmptyString(item.name, 'item.name');
    }
  });

  it('supports custom itemListOrder and rich items', () => {
    const schema = oracleItemListSchema({
      name: 'AI Providers',
      itemListOrder: 'https://schema.org/ItemListOrdered',
      items: [
        { name: 'OpenAI', description: 'GPT-4 and DALL-E models', url: 'https://openai.com', image: 'https://openai.com/logo.png' },
        { name: 'Anthropic Claude', description: 'Claude 3.5 Sonnet', url: 'https://anthropic.com' },
      ],
    });

    expect(schema.itemListOrder).toBe('https://schema.org/ItemListOrdered');
    expect(schema.itemListElement[0].item).toBeDefined();
    expect(schema.itemListElement[0].item?.['@type']).toBe('Thing');
    expect(schema.itemListElement[0].item?.description).toBe('GPT-4 and DALL-E models');
  });

  it('omits item when no description provided', () => {
    const schema = oracleItemListSchema({
      items: [
        { name: 'Basic service' },
      ],
    });

    expect(schema.itemListElement[0].item).toBeUndefined();
  });
});

describe('oracleWebPageSchema()', () => {
  it('creates a valid WebPage schema with required fields', () => {
    const schema = oracleWebPageSchema({
      name: 'ORACLE SEO Services',
      description: 'AI-powered SEO optimisation for digital agencies',
      url: 'https://oracle.app/services/seo',
    });

    expectSchemaBase(schema);
    expect(schema['@type']).toBe('WebPage');
    expect(schema.name).toBe('ORACLE SEO Services');
    expectNonEmptyString(schema.description, 'description');
    expect(schema.url).toMatch(/^https?:\/\//);
    expect(schema.author?.['@type']).toBe('Organization');
    expect(schema.author?.name).toBe('ORACLE');
    expect(schema.publisher?.['@type']).toBe('Organization');
    expect(schema.publisher?.logo).toBeDefined();
    expect(schema.inLanguage).toBe('en');
    expect(schema.isPartOf?.['@type']).toBe('WebSite');
  });

  it('supports pageType, breadcrumb, and dates', () => {
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList' as const,
      itemListElement: [
        { '@type': 'ListItem' as const, position: 1, name: 'Home', item: 'https://oracle.app' },
        { '@type': 'ListItem' as const, position: 2, name: 'SEO', item: 'https://oracle.app/services/seo' },
      ],
    };
    const schema = oracleWebPageSchema({
      name: 'SEO Services',
      description: 'SEO optimisation',
      url: 'https://oracle.app/services/seo',
      pageType: 'AboutPage',
      datePublished: '2026-01-15',
      dateModified: '2026-06-14',
      breadcrumb,
    });

    expect(schema['@type']).toBe('AboutPage');
    expect(schema.datePublished).toBe('2026-01-15');
    expect(schema.dateModified).toBe('2026-06-14');
    expect(schema.breadcrumb).toBeDefined();
    expect(schema.breadcrumb?.['@type']).toBe('BreadcrumbList');
  });

  it('supports hasPart and potentialAction', () => {
    const schema = oracleWebPageSchema({
      name: 'Services Hub',
      description: 'All ORACLE services',
      url: 'https://oracle.app/services',
      hasPart: [
        { name: 'SEO', url: 'https://oracle.app/services/seo' },
        { name: 'PPC', url: 'https://oracle.app/services/ppc' },
      ],
      potentialAction: [{
        '@type': 'SearchAction',
        target: 'https://oracle.app/search?q={search-term}',
        'query-input': 'required name=search-term',
      }],
    });

    expect(schema.hasPart).toHaveLength(2);
    expect(schema.hasPart?.[0]['@type']).toBe('WebPage');
    expect(schema.potentialAction).toHaveLength(1);
    expect(schema.potentialAction?.[0]['@type']).toBe('SearchAction');
  });
});

describe('Schema JSON serialisation', () => {
  it('all schemas produce valid JSON without circular references', () => {
    const schemas = [
      ORACLE_APP_SCHEMA,
      ORACLE_ORG_SCHEMA,
      ORACLE_FAQ_SCHEMA,
      ORACLE_PRODUCT_SCHEMA,
      ORACLE_IOS_APP_SCHEMA,
      ORACLE_ANDROID_APP_SCHEMA,
      oracleEventSchema({
        name: 'Test Event',
        description: 'Test',
        url: 'https://oracle.app/events/test',
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-01-01T01:00:00Z',
      }),
      oracleVideoSchema({
        name: 'Test Video',
        description: 'Test',
        thumbnailUrl: 'https://oracle.app/thumb.jpg',
        uploadDate: '2026-01-01',
      }),
      authBreadcrumbSchema([{ name: 'Home', url: '/' }]),
      oracleCourseSchema({
        name: 'Test Course',
        description: 'Test',
        url: 'https://oracle.app/courses/test',
      }),
      oracleHowToSchema({
        name: 'Test HowTo',
        description: 'Test',
        url: 'https://oracle.app/guides/test',
        step: [{ name: 'Step 1', text: 'Do something' }],
      }),
      oracleReviewSchema({
        name: 'Test Review',
        reviewBody: 'Great product',
        datePublished: '2026-01-01',
        authorName: 'Test User',
        ratingValue: 5,
      }),
      oracleAggregateRatingSchema({
        ratingValue: 4.5,
        ratingCount: 100,
      }),
      oracleLocalBusinessSchema({
        name: 'Test Agency',
        description: 'Test',
        url: 'https://test.in',
        address: { addressLocality: 'Delhi', addressCountry: 'IN' },
      }),
      oracleServiceSchema({
        name: 'Test Service',
        description: 'Test',
        url: 'https://oracle.app/services/test',
      }),
      oracleItemListSchema({
        name: 'Test List',
        items: [{ name: 'Item 1' }, { name: 'Item 2' }],
      }),
      oracleWebPageSchema({
        name: 'Test Page',
        description: 'Test',
        url: 'https://oracle.app/test',
      }),
    ];

    for (const schema of schemas) {
      const json = JSON.stringify(schema);
      expect(json.length).toBeGreaterThan(0);

      const parsed = JSON.parse(json);
      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@type']).toBeTruthy();
    }
  });
});
