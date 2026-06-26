// ═══════════════════════════════════════
// ORACLE — JSON-LD barrel export
// Import all schema types, constants, and factories from here
// ═══════════════════════════════════════

// ─── Types ─────────────────────────────
export type {
  SchemaType,
  TypedSchema,
  WebApplicationSchema,
  OrganizationSchema,
  FAQPageSchema,
  BreadcrumbListSchema,
  ProductSchema,
  SoftwareApplicationSchema,
  EventSchema,
  CourseSchema,
  AggregateRatingSchema,
  ReviewSchema,
  HowToSchema,
  VideoObjectSchema,
  LocalBusinessSchema,
  ServiceSchema,
  ItemListSchema,
  WebPageSchema,
} from './schemas';

// ─── Component ─────────────────────────
export { JsonLd } from './schemas';

// ─── Static Schemas ────────────────────
export {
  ORACLE_APP_SCHEMA,
  ORACLE_ORG_SCHEMA,
  ORACLE_FAQ_SCHEMA,
  ORACLE_PRODUCT_SCHEMA,
  ORACLE_IOS_APP_SCHEMA,
  ORACLE_ANDROID_APP_SCHEMA,
} from './schemas';

// ─── Factory Functions ─────────────────
export {
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
