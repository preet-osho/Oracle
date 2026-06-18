// ═══════════════════════════════════════
// ORACLE — JSON-LD Structured Data Component
// Renders Schema.org structured data for search engines
// ═══════════════════════════════════════

// ─── Typed Schema Interfaces ──────────

/** Base shape shared by all Schema.org JSON-LD objects */
interface SchemaBase {
  '@context': string;
  '@type': string;
  '@id'?: string;
}

/** All supported @type literal values — use as a discriminant in switch/if statements */
export type SchemaType = 'WebApplication' | 'Organization' | 'FAQPage' | 'BreadcrumbList' | 'Product' | 'SoftwareApplication' | 'Event' | 'VideoObject' | 'Course' | 'HowTo' | 'AggregateRating' | 'Review' | 'LocalBusiness' | 'Service' | 'ItemList' | 'WebPage';

/** WebApplication schema (Schema.org) */
export interface WebApplicationSchema extends SchemaBase {
  '@type': 'WebApplication';
  name: string;
  description: string;
  url: string;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: {
    '@type': string;
    price: string;
    priceCurrency: string;
  };
  author?: {
    '@type': string;
    '@id'?: string;
    name: string;
    url: string;
  };
}

/** Organization schema (Schema.org) */
export interface OrganizationSchema extends SchemaBase {
  '@type': 'Organization';
  name: string;
  url: string;
  logo?: {
    '@type': string;
    url: string;
    width: number;
    height: number;
  };
  contactPoint?: {
    '@type': string;
    contactType: string;
    email?: string;
    availableLanguage?: string[];
  };
  foundingDate?: string;
  description?: string;
}

/** FAQPage schema (Schema.org) */
export interface FAQPageSchema extends SchemaBase {
  '@type': 'FAQPage';
  mainEntity: {
    '@type': 'Question';
    name: string;
    acceptedAnswer: {
      '@type': 'Answer';
      text: string;
    };
  }[];
}

/** BreadcrumbList schema (Schema.org) */
export interface BreadcrumbListSchema extends SchemaBase {
  '@type': 'BreadcrumbList';
  itemListElement: {
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }[];
}

/** Product schema (Schema.org) */
export interface ProductSchema extends SchemaBase {
  '@type': 'Product';
  name: string;
  description: string;
  url: string;
  image?: string;
  brand?: {
    '@type': string;
    name: string;
  };
  offers?: {
    '@type': string;
    price: string;
    priceCurrency: string;
    availability?: string;
    priceValidUntil?: string;
  };
  category?: string;
}

/** SoftwareApplication schema (Schema.org) — for App Store / Play Store listings */
export interface SoftwareApplicationSchema extends SchemaBase {
  '@type': 'SoftwareApplication';
  name: string;
  description: string;
  url: string;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: {
    '@type': string;
    price: string;
    priceCurrency: string;
  };
  author?: {
    '@type': string;
    name: string;
    url?: string;
  };
  screenshot?: string;
  softwareVersion?: string;
  fileSize?: string;
  installUrl?: string;
  downloadUrl?: string;
  aggregateRating?: {
    '@type': string;
    ratingValue: string;
    ratingCount: string;
  };
}

/** Event schema (Schema.org) — for webinars, launches, meetups */
export interface EventSchema extends SchemaBase {
  '@type': 'Event';
  name: string;
  description: string;
  url: string;
  startDate: string;
  endDate: string;
  eventStatus?: string;
  eventAttendanceMode?: string;
  location?: {
    '@type': 'Place' | 'VirtualLocation';
    name?: string;
    url?: string;
    address?: {
      '@type': string;
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
    };
  };
  organizer?: {
    '@type': string;
    name: string;
    url?: string;
  };
  performer?: {
    '@type': string;
    name: string;
    url?: string;
  };
  offers?: {
    '@type': string;
    price: string;
    priceCurrency: string;
    url?: string;
    availability?: string;
  };
  image?: string;
}

/** Course schema (Schema.org) — for tutorials and training content */
export interface CourseSchema extends SchemaBase {
  '@type': 'Course';
  name: string;
  description: string;
  url: string;
  provider?: {
    '@type': string;
    name: string;
    url?: string;
  };
  educationalLevel?: string;
  inLanguage?: string;
  isAccessibleForFree?: boolean;
  coursePrerequisites?: string;
  image?: string;
  hasCourseInstance?: {
    '@type': string;
    courseMode?: string;
    courseWorkload?: string;
  };
}

/** AggregateRating schema (Schema.org) — for overall rating summary */
export interface AggregateRatingSchema extends SchemaBase {
  '@type': 'AggregateRating';
  ratingValue: number;
  ratingCount: number;
  bestRating?: number;
  worstRating?: number;
}

/** Review schema (Schema.org) — for individual testimonials and social proof */
export interface ReviewSchema extends SchemaBase {
  '@type': 'Review';
  name: string;
  reviewBody: string;
  datePublished: string;
  author: {
    '@type': 'Person';
    name: string;
  };
  reviewRating: {
    '@type': 'Rating';
    ratingValue: number;
    bestRating?: number;
    worstRating?: number;
  };
  itemReviewed?: {
    '@type': string;
    name: string;
    url?: string;
  };
}

/** HowTo schema (Schema.org) — for step-by-step tutorials and guides */
export interface HowToSchema extends SchemaBase {
  '@type': 'HowTo';
  name: string;
  description: string;
  url: string;
  image?: string;
  totalTime?: string;
  estimatedCost?: {
    '@type': string;
    currency?: string;
    value?: string;
  };
  tool?: {
    '@type': 'HowToTool';
    name: string;
  }[];
  supply?: {
    '@type': 'HowToSupply';
    name: string;
  }[];
  step: {
    '@type': 'HowToStep';
    name: string;
    text: string;
    url?: string;
    image?: string;
    itemListElement?: {
      '@type': 'HowToDirection';
      text: string;
    }[];
  }[];
}

/** VideoObject schema (Schema.org) — for demo videos and tutorials */
export interface VideoObjectSchema extends SchemaBase {
  '@type': 'VideoObject';
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string;
  contentUrl?: string;
  embedUrl?: string;
  url?: string;
  width?: number;
  height?: number;
  interactionCount?: string;
  expires?: string;
  requiresSubscription?: boolean;
  regionsAllowed?: string;
  publication?: {
    '@type': string;
    name: string;
    url?: string;
  };
  author?: {
    '@type': string;
    name: string;
    url?: string;
  };
}

/** LocalBusiness schema (Schema.org) — for agency clients in Google Maps and local search */
export interface LocalBusinessSchema extends SchemaBase {
  '@type': 'LocalBusiness';
  name: string;
  description: string;
  url: string;
  image?: string;
  telephone?: string;
  email?: string;
  address?: {
    '@type': 'PostalAddress';
    streetAddress?: string;
    addressLocality: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry: string;
  };
  geo?: {
    '@type': 'GeoCoordinates';
    latitude: number;
    longitude: number;
  };
  openingHoursSpecification?: {
    '@type': 'OpeningHoursSpecification';
    dayOfWeek: string | string[];
    opens: string;
    closes: string;
  }[];
  priceRange?: string;
  aggregateRating?: AggregateRatingSchema;
  sameAs?: string[];
}

/** Service schema (Schema.org) — for individual service offerings */
export interface ServiceSchema extends SchemaBase {
  '@type': 'Service';
  name: string;
  description: string;
  url: string;
  serviceType?: string;
  provider?: {
    '@type': string;
    name: string;
    url?: string;
  };
  areaServed?: string | { '@type': string; name: string }[];
  hasOfferCatalog?: {
    '@type': 'OfferCatalog';
    name: string;
    itemListElement: {
      '@type': 'Offer';
      itemOffered: {
        '@type': 'Service';
        name: string;
      };
    }[];
  };
  serviceOutput?: { '@type': string; name: string }[];
  aggregateRating?: AggregateRatingSchema;
  offers?: {
    '@type': string;
    price?: string;
    priceCurrency?: string;
  };
}

/** ItemList schema (Schema.org) — for carousel-style rich results */
export interface ItemListSchema extends SchemaBase {
  '@type': 'ItemList';
  name?: string;
  description?: string;
  url?: string;
  numberOfItems?: number;
  itemListOrder?: string;
  itemListElement: {
    '@type': 'ListItem';
    position: number;
    name: string;
    url?: string;
    item?: {
      '@type': string;
      name: string;
      description?: string;
      url?: string;
      image?: string;
    };
  }[];
}

/**
 * Discriminated union of all typed schemas.
 * Narrow by checking `schema['@type']` against SchemaType literals:
 * ```ts
 * if (schema['@type'] === 'FAQPage') {
 *   // TypeScript knows schema is FAQPageSchema
 * }
 * ```
 */
/** WebPage schema (Schema.org) — for individual page metadata, breadcrumbs, and canonical URLs */
export interface WebPageSchema extends SchemaBase {
  '@type': 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage';
  name: string;
  description: string;
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: {
    '@type': string;
    name: string;
    url?: string;
  };
  publisher?: {
    '@type': string;
    name: string;
    logo?: {
      '@type': string;
      url: string;
    };
  };
  breadcrumb?: BreadcrumbListSchema;
  mainEntity?: {
    '@type': string;
    [key: string]: unknown;
  };
  inLanguage?: string;
  isPartOf?: {
    '@type': string;
    name: string;
    url: string;
  };
  hasPart?: {
    '@type': string;
    name: string;
    url: string;
  }[];
  potentialAction?: {
    '@type': string;
    target: string;
    'query-input'?: string;
  }[];
}

export type TypedSchema = WebApplicationSchema | OrganizationSchema | FAQPageSchema | BreadcrumbListSchema | ProductSchema | SoftwareApplicationSchema | EventSchema | VideoObjectSchema | CourseSchema | HowToSchema | AggregateRatingSchema | ReviewSchema | LocalBusinessSchema | ServiceSchema | ItemListSchema | WebPageSchema;

// ─── Component ────────────────────────

interface JsonLdProps {
  /** Single schema object or array of schema objects */
  schema: TypedSchema | TypedSchema[];
}

/**
 * Renders JSON-LD structured data as a <script> tag.
 * Safe for server components — uses dangerouslySetInnerHTML with JSON.stringify.
 */
export function JsonLd({ schema }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ─── Shared Schema Factories ───────────

const BASE_URL = 'https://oracle.app';

/** ORACLE WebApplication schema — shared across auth pages */
export const ORACLE_APP_SCHEMA: WebApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  '@id': `${BASE_URL}/#webapp`,
  name: 'ORACLE',
  description:
    'The ultimate AI-powered agency assistant with 40+ service domains, 55+ prompts, 10 AI providers, and smart routing.',
  url: BASE_URL,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  author: {
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'ORACLE Team',
    url: BASE_URL,
  },
};

/** ORACLE Organization schema — homepage */
export const ORACLE_ORG_SCHEMA: OrganizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${BASE_URL}/#organization`,
  name: 'ORACLE',
  url: BASE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${BASE_URL}/favicon.ico`,
    width: 512,
    height: 512,
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'support@oracle.app',
    availableLanguage: ['English', 'Hindi'],
  },
  foundingDate: '2024',
  description:
    'The ultimate AI-powered agency assistant for digital agencies in India — 40+ service domains, 55+ prompts, 10 AI providers.',
};

/** ORACLE FAQPage schema — homepage */
export const ORACLE_FAQ_SCHEMA: FAQPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is ORACLE?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ORACLE is an AI-powered universal agency intelligence platform with 40+ service domains, 55+ curated prompts, and 10 AI providers. It is built for digital agencies in India to streamline client delivery, proposals, invoicing, and AI-driven workflows.',
      },
    },
    {
      '@type': 'Question',
      name: 'How many AI providers does ORACLE support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ORACLE supports 10 AI providers including OpenAI, Anthropic Claude, Google Gemini, Perplexity, Mistral, Groq, Cohere, Stability AI, ElevenLabs, and Sarvam with smart routing and automatic failover.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is ORACLE free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, ORACLE is free to use. It offers a generous free tier with access to all 40+ service domains, AI providers, and features including lead generation, project management, invoicing, and AI-powered workflows.',
      },
    },
    {
      '@type': 'Question',
      name: 'What service domains does ORACLE cover?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ORACLE covers 40+ service domains including SEO, Google Ads, Meta Ads, content marketing, social media, email marketing, web development, app development, UI/UX design, video production, and more.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I manage client projects in ORACLE?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, ORACLE includes full project management with time tracking, task management, scope approvals, profitability analysis, and delivery progress monitoring across all your client projects.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is AEO/GEO in ORACLE?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AEO (AI Engine Optimisation) and GEO (Generative Engine Optimisation) help your agency content get cited by ChatGPT, Perplexity, Gemini, and other AI search engines. ORACLE analyses your content and optimises it for AI-powered search results.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does ORACLE support voice AI agents?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, ORACLE integrates with VAPI, Sarvam, and ElevenLabs to build AI voice agents for your agency clients. You can configure voice agents for appointment booking, customer support, and lead qualification workflows.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I run WhatsApp campaigns with ORACLE?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, ORACLE provides WhatsApp Business API campaign management including broadcast sequences, automated follow-ups, message templates, and campaign analytics for client outreach and marketing.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the chatbot builder in ORACLE?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ORACLE includes a visual chatbot builder for creating AI-powered chatbots for client websites and WhatsApp. You can customise responses, train on client knowledge bases, and deploy across multiple channels.',
      },
    },
  ],
};

/** ORACLE Product schema — free tier offering */
export const ORACLE_PRODUCT_SCHEMA: ProductSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  '@id': `${BASE_URL}/#product`,
  name: 'ORACLE — Universal Agency Intelligence',
  description:
    'AI-powered agency assistant with 40+ service domains, 55+ prompts, 10 AI providers, smart routing, and built-in project management.',
  url: BASE_URL,
  image: `${BASE_URL}/favicon.ico`,
  brand: {
    '@type': 'Brand',
    name: 'ORACLE',
  },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
    availability: 'https://schema.org/InStock',
    priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
  },
  category: 'AI Business Software',
};

/**
 * ORACLE SoftwareApplication schemas — placeholders for mobile apps.
 * TODO: Update with real store URLs and metadata when apps are published.
 */
export const ORACLE_IOS_APP_SCHEMA: SoftwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${BASE_URL}/#ios-app`,
  name: 'ORACLE — Universal Agency Intelligence',
  description:
    'AI-powered agency assistant with 40+ service domains, 55+ prompts, 10 AI providers, smart routing, and built-in project management.',
  // TODO: Replace with real App Store URL when published
  url: 'https://apps.apple.com/app/oracle-agency-intelligence/id000000000',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'iOS 16.0+',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  author: {
    '@type': 'Organization',
    name: 'ORACLE Team',
    url: BASE_URL,
  },
  // TODO: Replace with real screenshot URL
  screenshot: `${BASE_URL}/favicon.ico`,
};

export const ORACLE_ANDROID_APP_SCHEMA: SoftwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${BASE_URL}/#android-app`,
  name: 'ORACLE — Universal Agency Intelligence',
  description:
    'AI-powered agency assistant with 40+ service domains, 55+ prompts, 10 AI providers, smart routing, and built-in project management.',
  // TODO: Replace with real Play Store URL when published
  url: 'https://play.google.com/store/apps/details?id=com.oracle.agency',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Android 10+',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
  author: {
    '@type': 'Organization',
    name: 'ORACLE Team',
    url: BASE_URL,
  },
  // TODO: Replace with real screenshot URL
  screenshot: `${BASE_URL}/favicon.ico`,
};

/**
 * Factory to create an Event schema for ORACLE webinars, launches, or meetups.
 * Use this when publishing upcoming events to appear in Google Events rich results.
 */
export function oracleEventSchema(event: {
  name: string;
  description: string;
  url: string;
  startDate: string;
  endDate: string;
  eventStatus?: string;
  eventAttendanceMode?: string;
  location?: EventSchema['location'];
  offers?: EventSchema['offers'];
  image?: string;
}): EventSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    eventStatus: event.eventStatus ?? 'https://schema.org/EventScheduled',
    eventAttendanceMode: event.eventAttendanceMode ?? 'https://schema.org/OnlineEventAttendanceMode',
    organizer: {
      '@type': 'Organization',
      name: 'ORACLE',
      url: BASE_URL,
    },
    ...event,
  };
}

/**
 * Factory to create a VideoObject schema for ORACLE demo videos and tutorials.
 * Use this on pages that embed videos to appear in Google Video rich results.
 */
export function oracleVideoSchema(video: {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string;
  contentUrl?: string;
  embedUrl?: string;
  url?: string;
  width?: number;
  height?: number;
}): VideoObjectSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    author: {
      '@type': 'Organization',
      name: 'ORACLE',
      url: BASE_URL,
    },
    publication: {
      '@type': 'PublicationEvent',
      name: 'ORACLE',
      url: BASE_URL,
    },
    ...video,
  };
}

/**
 * Factory to create a Course schema for ORACLE tutorials and training content.
 * Use this on tutorial pages to appear in Google Course rich results.
 */
export function oracleCourseSchema(course: {
  name: string;
  description: string;
  url: string;
  educationalLevel?: string;
  isAccessibleForFree?: boolean;
  coursePrerequisites?: string;
  image?: string;
}): CourseSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    provider: {
      '@type': 'Organization',
      name: 'ORACLE',
      url: BASE_URL,
    },
    inLanguage: 'en',
    isAccessibleForFree: course.isAccessibleForFree ?? true,
    ...course,
  };
}

/**
 * Factory to create a HowTo schema for ORACLE step-by-step tutorials and guides.
 * Use this on tutorial/guide pages to appear in Google HowTo rich results.
 */
export function oracleHowToSchema(howTo: {
  name: string;
  description: string;
  url: string;
  totalTime?: string;
  image?: string;
  estimatedCost?: HowToSchema['estimatedCost'];
  tool?: { name: string }[];
  supply?: { name: string }[];
  step: { name: string; text: string; url?: string; image?: string; itemListElement?: { text: string }[] }[];
}): HowToSchema {
  const { step, tool, supply, ...rest } = howTo;
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    step: step.map((s) => ({
      '@type': 'HowToStep' as const,
      name: s.name,
      text: s.text,
      url: s.url,
      image: s.image,
      itemListElement: s.itemListElement?.map((d) => ({
        '@type': 'HowToDirection' as const,
        text: d.text,
      })),
    })),
    ...(tool && { tool: tool.map((t) => ({ '@type': 'HowToTool' as const, name: t.name })) }),
    ...(supply && { supply: supply.map((s) => ({ '@type': 'HowToSupply' as const, name: s.name })) }),
    ...rest,
  };
}

/**
 * Factory to create a Review schema for ORACLE testimonials and social proof.
 * Use this on testimonial pages to appear in Google Review rich results.
 */
export function oracleReviewSchema(review: {
  name: string;
  reviewBody: string;
  datePublished: string;
  authorName: string;
  ratingValue: number;
  bestRating?: number;
  itemReviewed?: ReviewSchema['itemReviewed'];
}): ReviewSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    name: review.name,
    reviewBody: review.reviewBody,
    datePublished: review.datePublished,
    author: {
      '@type': 'Person',
      name: review.authorName,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.ratingValue,
      bestRating: review.bestRating ?? 5,
      worstRating: 1,
    },
    ...(review.itemReviewed && {
      itemReviewed: review.itemReviewed,
    }),
  };
}

/**
 * Factory to create an AggregateRating schema for ORACLE overall rating.
 * Embed this inside Product or SoftwareApplication schemas.
 */
export function oracleAggregateRatingSchema(rating: {
  ratingValue: number;
  ratingCount: number;
  bestRating?: number;
}): AggregateRatingSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateRating',
    ratingValue: rating.ratingValue,
    ratingCount: rating.ratingCount,
    bestRating: rating.bestRating ?? 5,
    worstRating: 1,
  };
}

/**
 * Factory to create a LocalBusiness schema for ORACLE agency clients.
 * Use this on client showcase or directory pages to appear in Google Maps and local search results.
 */
export function oracleLocalBusinessSchema(business: {
  name: string;
  description: string;
  url: string;
  telephone?: string;
  email?: string;
  address?: {
    streetAddress?: string;
    addressLocality: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry: string;
  };
  geo?: { latitude: number; longitude: number };
  openingHoursSpecification?: { dayOfWeek: string | string[]; opens: string; closes: string }[];
  priceRange?: string;
  aggregateRating?: AggregateRatingSchema;
  sameAs?: string[];
  image?: string;
}): LocalBusinessSchema {
  const { geo, address, openingHoursSpecification, aggregateRating, ...rest } = business;
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    ...(address && {
      address: {
        '@type': 'PostalAddress',
        ...address,
      },
    }),
    ...(geo && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
    }),
    ...(openingHoursSpecification && {
      openingHoursSpecification: openingHoursSpecification.map((o) => ({
        '@type': 'OpeningHoursSpecification' as const,
        dayOfWeek: o.dayOfWeek,
        opens: o.opens,
        closes: o.closes,
      })),
    }),
    ...(aggregateRating && { aggregateRating }),
    ...rest,
  };
}

/**
 * Factory to create a Service schema for ORACLE individual service offerings.
 * Use this on service pages (SEO, PPC, etc.) to appear in Google Search rich results.
 */
export function oracleServiceSchema(service: {
  name: string;
  description: string;
  url: string;
  serviceType?: string;
  areaServed?: ServiceSchema['areaServed'];
  serviceOutput?: { name: string }[];
  aggregateRating?: AggregateRatingSchema;
  offers?: ServiceSchema['offers'];
}): ServiceSchema {
  const { areaServed, serviceOutput, ...rest } = service;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    provider: {
      '@type': 'Organization',
      name: 'ORACLE',
      url: BASE_URL,
    },
    ...(areaServed && {
      areaServed: Array.isArray(areaServed)
        ? areaServed.map((a) => ({ '@type': 'Place' as const, name: a.name }))
        : areaServed,
    }),
    ...(serviceOutput && {
      serviceOutput: serviceOutput.map((o) => ({ '@type': 'DefinedTerm' as const, name: o.name })),
    }),
    ...rest,
  };
}

/**
 * Factory to create an ItemList schema for ORACLE service domains or features.
 * Use this on listing pages to appear as carousel-style rich results in Google Search.
 */
export function oracleItemListSchema(list: {
  name?: string;
  description?: string;
  url?: string;
  itemListOrder?: string;
  items: { name: string; url?: string; description?: string; image?: string }[];
}): ItemListSchema {
  const { items, ...rest } = list;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListOrder: rest.itemListOrder ?? 'https://schema.org/ItemListUnordered',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem' as const,
      position: i + 1,
      name: item.name,
      url: item.url,
      ...(item.description && {
        item: {
          '@type': 'Thing' as const,
          name: item.name,
          description: item.description,
          url: item.url,
          image: item.image,
        },
      }),
    })),
    ...rest,
  };
}

/**
 * Factory to create a WebPage schema for individual ORACLE pages.
 * Use this on every page for canonical URLs, breadcrumbs, and page metadata.
 */
export function oracleWebPageSchema(page: {
  name: string;
  description: string;
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  pageType?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage';
  breadcrumb?: BreadcrumbListSchema;
  mainEntity?: WebPageSchema['mainEntity'];
  inLanguage?: string;
  hasPart?: { name: string; url: string }[];
  potentialAction?: WebPageSchema['potentialAction'];
}): WebPageSchema {
  return {
    '@context': 'https://schema.org',
    '@type': page.pageType ?? 'WebPage',
    name: page.name,
    description: page.description,
    url: page.url,
    author: {
      '@type': 'Organization',
      name: 'ORACLE',
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'ORACLE',
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/favicon.ico`,
      },
    },
    inLanguage: page.inLanguage ?? 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: 'ORACLE — Universal Agency Intelligence',
      url: BASE_URL,
    },
    ...(page.image && { image: page.image }),
    ...(page.datePublished && { datePublished: page.datePublished }),
    ...(page.dateModified && { dateModified: page.dateModified }),
    ...(page.breadcrumb && { breadcrumb: page.breadcrumb }),
    ...(page.mainEntity && { mainEntity: page.mainEntity }),
    ...(page.hasPart && {
      hasPart: page.hasPart.map((p) => ({
        '@type': 'WebPage' as const,
        name: p.name,
        url: p.url,
      })),
    }),
    ...(page.potentialAction && { potentialAction: page.potentialAction }),
  };
}

/** BreadcrumbList for the login/auth flow */
export function authBreadcrumbSchema(
  items: { name: string; url: string }[],
): BreadcrumbListSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${BASE_URL}/#breadcrumb`,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${BASE_URL}${item.url}`,
    })),
  };
}
