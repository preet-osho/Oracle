# Changelog

All notable changes to ORACLE — Universal Agency Intelligence are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [0.3.0] — 2026-06-23

### Added — Q3 2026 Indian Market Intelligence

**17 business logic functions** for Indian agency operations with **115 executable tests** (3,023 total tests, 0 failures).

#### WhatsApp Business API (6 functions)
- `compareBSPCosts()` — Compares BSP pricing (Meta Direct, 360dialog, WANotifier, Interakt, AiSensy, Wati) with subscription + per-message + markup model
- `checkWhatsAppCompliance()` — Warns about promotional messaging without opt-in, high-volume review triggers, 1000+ recipient verification
- `checkINRBillingMigration()` — Urgency-based warning for Meta's INR billing migration deadline (Dec 31, 2026)
- `detectReclassification()` — Detects WhatsApp template reclassification (Utility → Marketing = 4-5x cost spike)
- `estimateReclassificationImpact()` — Aggregates cost impact across multiple reclassified templates
- `warnAPIVerificationTimeline()` — Estimates 7-26 day Cloud API verification timeline
- `getGreenTickChecklist()` — 5-step verification guide with eligibility requirements

#### GST/TDS Compliance (2 functions)
- `checkInvoiceDateCompliance()` — Flags invoice date changes as non-compliant, warns about GST filing and revenue recognition impact
- `calculateTDS()` — Calculates TDS deduction (10% default), tracks certificate status with day-based escalation

#### CRM Cost Analysis (3 functions)
- `warnHubSpotScalingCost()` — Warns at 10+ and 20+ users, suggests Zoho CRM and Custom CRM alternatives
- `warnZohoFragmentation()` — Detects multi-app fragmentation, suggests Zoho Flow, Zapier, or consolidation
- `calculateCRMRoi()` — Calculates custom CRM payback vs SaaS at different team sizes

#### Payment Enforcement (1 function)
- `getUpfrontPaymentPolicy()` — Milestone structure based on project value with escalation template

#### Indian Market Context (2 functions)
- `getTierBudgetRecommendation()` — Tier-1/2/3 city classification with budget ranges and package recommendations
- `getVernacularContentGuidance()` — Tone guidance for Hindi (urban/rural), Tamil, Bengali content

#### Agency Positioning (4 functions)
- `getAINativeValueFrame()` — Positioning framework, talking points, differentiation strategies
- `getHumanPolishPipeline()` — Content-type-specific checklists with AI contribution estimates and quality gates
- `getCommodityDifferentiation()` — Threat-level analysis with defensive strategies and client education scripts

### Fixed
- **cost-tracker.test.ts stale data leakage** — Changed `vi.clearAllMocks()` to `vi.resetAllMocks()` and added explicit `mockGte` reset in `beforeEach` to prevent stale mock implementations from leaking between tests

### Changed
- **Test consolidation** — Merged `q3-scenarios-remaining.test.ts` (34 tests) into `q3-scenarios.test.ts` (67 tests) for a single unified Q3 test file (115 tests total)
- **README.md** — Added Indian Market Intelligence features section, Q3 test commands, and Q3 2026 summary table
- **USER_COMPLAINT_TRACKER.md** — Updated 17 Q3 scenarios to ✅ Covered, refreshed coverage summary (17/17 testable scenarios covered)
- **Q3_2026_USER_RESEARCH.md** — Marked all 17 scenarios as ✅ Implemented with test file references

### Research
- Researched Indian agency owner complaints from Reddit, LinkedIn, Twitter/X, G2/Capterra
- Identified 15 new complaint themes across WhatsApp API pain, CRM pricing, invoice/payment boundaries, and AI content localization
- Added Q3-W8 (INR Billing Migration) and Q3-W9 (Template Reclassification) from Meta policy research
- Researched Q3 2026 WhatsApp Business API pricing changes (per-message model, BSP landscape updates)

### Documentation
- `Q3_2026_USER_RESEARCH.md` — Research sources and scenario details
- `USER_COMPLAINT_TRACKER.md` — 117 real-world complaints mapped to test coverage
- `Q3_IMPLEMENTATION_SUMMARY.md` — Comprehensive index linking all Q3 files

---

## [0.2.0] — 2026-06-22

### Added
- Priority-based test runner with 6 tiers (P1-P6)
- CI pipeline with chained stages (fail-fast on P1)
- Git hooks via Husky (pre-commit: ESLint + P1, pre-push: all tiers)
- Coverage reporting by priority tier
- Incremental test mode (`--since`)
- Security: CSP headers, CSRF protection, prompt sanitizer, rate limiting
- Cost tracking across AI providers
- Circuit breaker for provider failover
- Domain compliance checks (healthcare, finance, legal)

---

## [0.1.0] — 2026-06-20

### Added
- Initial release with 40+ service domains
- Multi-provider AI router (10 providers)
- Smart routing and streaming responses
- 55+ pre-built prompts
- Client project management
- GST-compliant invoice generation
- Per-client memory and RAG documents
- Quality scoring and multi-agent orchestration
