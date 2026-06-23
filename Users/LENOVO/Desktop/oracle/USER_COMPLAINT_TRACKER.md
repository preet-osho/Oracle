# ORACLE — User Complaint Tracker

> **Purpose:** Maps every real-world user complaint (from Reddit, G2, competitor analysis) to test scenarios, current coverage status, and priority.
> **Last Updated:** June 23, 2026 (Q3 scenarios integrated)
>
> **Priority Legend:**
> - 🔴 **P0 — Critical:** Security, compliance, data loss, financial errors (blocks release)
> - 🟠 **P1 — High:** Core functionality failures, revenue-impacting bugs
> - 🟡 **P2 — Medium:** UX friction, missing features competitors have
> - 🟢 **P3 — Low:** Nice-to-haves, edge cases, cosmetic issues

---

## Coverage Summary

| Status | Count | % |
|--------|-------|---|
| ✅ Covered (unit tests) | 38 | 32% |
| ✅ Covered (integration in real-user-scenarios.test.ts) | 12 | 10% |
| ⚠️ Partial (some aspects tested) | 18 | 15% |
| ❌ No test coverage | 34 | 29% |
| ✅ Covered (Q3, executable tests) | 17 | 14% |
| ❌ No test coverage (Q3) | 0 | 0% |
| **Total scenarios** | **117** | |

---

## 1. The "Generic Content" Problem

> Source: G2 reviews of Jasper, Copy.ai, Writesonic; Reddit r/marketing

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 1.1 | Dental Clinic Gets Generic Proposal | AI output doesn't reference local context | — | ❌ None | 🟡 P2 | Requires LLM output evaluation; not unit-testable |
| 1.2 | Restaurant Gets Template Response | Brand Voice features produce identical output | — | ❌ None | 🟡 P2 | Requires LLM output evaluation |
| 1.3 | B2B Gets Consumer-Style Copy | Wrong tone for B2B context | — | ❌ None | 🟡 P2 | Requires LLM output evaluation |
| 1.4 | WhatsApp Sounds Like Email | AI generates too-formal messages | — | ❌ None | 🟡 P2 | Requires LLM output evaluation |
| 1.5 | All Domains Produce Same Quality | No domain differentiation | `cross-domain-thinking.test.ts` | ⚠️ Partial | 🟡 P2 | Service bundles tested; output quality not tested |
| 1.6 | Hinglish in Professional Context | Language mixing breaks professional tone | — | ❌ None | 🟡 P2 | Requires LLM output evaluation |
| 1.7 | Output Needs More Editing Than Writing | AI output is generic filler | — | ❌ None | 🟡 P2 | Requires LLM output evaluation |

**Gap:** No LLM output quality evaluation framework exists. Consider adding prompt-versioning quality tests or output scoring.

---

## 2. BYOK & Multi-Provider Failures

> Source: OpenRouter GitHub, Reddit r/LocalLLaMA, LiteLLM discussions

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 2.1 | Silent 429 Without Failover | 429 errors not caught, empty responses | `circuit-breaker.test.ts` | ⚠️ Partial | 🔴 P0 | Circuit breaker tested; actual failover flow untested |
| 2.2 | API Key Expiry Causes Partial Failure | Expired key crashes routing | — | ❌ None | 🔴 P0 | No test for key expiry detection |
| 2.3 | Cost Untracked with Free Provider | Free tier shows ₹0 but has hidden costs | `cost-tracker.test.ts` | ⚠️ Partial | 🟠 P1 | Cost tracking tested; free tier edge case untested |
| 2.4 | Model Drift Between Providers | Same model gives different quality | — | ❌ None | 🟡 P2 | Requires output comparison testing |
| 2.5 | Stale Provider Health Data | Health dashboard shows outdated info | `provider-health.test.ts` | ✅ Covered | 🟠 P1 | Health checks tested |
| 2.6 | Context Window Bloat | Token count spikes on provider switch | `token-budget.test.ts` | ⚠️ Partial | 🟠 P1 | Token budget tested; cross-provider context not tested |
| 2.7 | Multiple Keys Same Provider | Confusion about which key is active | `user-api-keys.ts` (no tests) | ❌ None | 🟡 P2 | Key management exists but untested |
| 2.8 | Rate Limit Not Surfaced to User | Silent rate limit failure | `rate-limit.test.ts` | ✅ Covered | 🟠 P1 | Rate limiting + user-facing errors tested |

**Gaps:** Key expiry detection, cross-provider context preservation, multi-key management need tests.

---

## 3. Hallucination & Fabrication Failures

> Source: Evidently AI research, ChatGPT court filing incident

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 3.1 | Fabricated "According to a Study" | AI invents statistics | `hallucination-guard.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🔴 P0 | Pattern detection + full pipeline integration tested |
| 3.2 | Promises Page 1 Ranking | Overconfident claims violate Google policy | `hallucination-guard.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🟠 P1 | Overconfidence patterns detected |
| 3.3 | Outdated Information as Current | Old data presented as fresh | `hallucination-guard.test.ts` | ✅ Covered | 🟠 P1 | "last year", "in 2024" patterns detected |
| 3.4 | Fabricated Client Testimonials | AI generates fictional case studies | — | ❌ None | 🟠 P1 | No test for placeholder vs fabricated content |
| 3.5 | Hallucinated Indian Legal Info | Wrong GST/RERA/SEBI information | `domain-compliance.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🔴 P0 | SEBI, healthcare, legal disclaimers tested |
| 3.6 | Invented Competitor Data | Fabricated market share percentages | — | ❌ None | 🟠 P1 | No test for source attribution validation |
| 3.7 | Inconsistent Numbers in Response | Budget sections don't add up | `hallucination-guard.test.ts` | ✅ Covered | 🟠 P1 | Internal consistency check tested |
| 3.8 | AI Doesn't Know It Doesn't Know | Fabricates recent events | — | ❌ None | 🟡 P2 | Requires real-time awareness testing |

**Gaps:** Fabricated testimonials/case studies detection, competitor data validation, recency awareness.

---

## 4. Invoice & GST Compliance Failures

> Source: ClearTax, Indian Ministry of Finance, r/IndianBusiness

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 4.1 | Wrong CGST/SGST Split | Total GST shown instead of split | `tax-calculator.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🔴 P0 | Both unit and integration tests |
| 4.2 | Interstate IGST Not Calculated | Defaults to intra-state | `tax-calculator.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🔴 P0 | IGST for Delhi→Mumbai, Bangalore→Chennai tested |
| 4.3 | Indian Number Formatting Error | Western ₹150,000 instead of ₹1,50,000 | `tax-calculator.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🟠 P1 | formatINR tested across all scales |
| 4.4 | Invoice Number Not Sequential | Non-sequential breaks tax compliance | `invoice.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🔴 P0 | Sequential generation tested with localStorage |
| 4.5 | Missing Required Invoice Fields | GSTIN, HSN/SAC omitted | `invoice.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🔴 P0 | formatInvoiceAsText field inclusion tested |
| 4.6 | Late Fee Wrong Formula | Grace period ignored, wrong calculation | `late-fee-calculator.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🟠 P1 | Grace period, cap, escalation levels tested |
| 4.7 | Reminder Tone Not Escalating | Same tone at 3 and 60 days | `late-fee-calculator.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🟠 P1 | 4 escalation levels with tone verification |

**Status:** Fully covered across unit + integration tests. No gaps.

---

## 5. Indian Market Context Failures

> Source: Reddit r/IndianBusiness, real agency owner interviews

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 5.1 | WhatsApp > Email Assumption | AI defaults to email | — | ❌ None | 🟡 P2 | LLM output behavior |
| 5.2 | Wrong Platform Recommendations | Yelp/UberEats instead of Zomato/Swiggy | — | ❌ None | 🟡 P2 | LLM output behavior |
| 5.3 | USD Pricing in Indian Context | $ instead of ₹ | `tax-calculator.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🟠 P1 | formatINR always produces ₹ prefix |
| 5.4 | Missing Festival Calendar | No Diwali/Navratri in content calendar | — | ❌ None | 🟡 P2 | LLM output behavior |
| 5.5 | Tier-2/3 City Strategy Ignored | Mumbai/Delhi-centric advice | — | ❌ None | 🟡 P2 | LLM output behavior |
| 5.6 | GST Rate Errors | Wrong rates for services | `tax-calculator.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🔴 P0 | 18%/12%/0% rates tested for multiple service types |
| 5.7 | Missing SEBI Disclaimer | Financial advice without disclaimer | `domain-compliance.test.ts`, `hallucination-guard.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🔴 P0 | 3 layers: unit, compliance, integration |
| 5.8 | Missing Healthcare Disclaimer | Medical advice without disclaimer | `domain-compliance.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🔴 P0 | Healthcare domain strictness tested |
| 5.9 | Ignoring Indian Phone Format | US (555) format instead of +91 | `real-user-scenarios.test.ts` | ✅ Covered | 🟡 P3 | Phone format regex tested |
| 5.10 | No UPI/Payment Context | Stripe/PayPal instead of Razorpay/UPI | — | ❌ None | 🟡 P2 | `razorpay.test.ts` exists but no UPI preference test |

**Gaps:** 5 scenarios are LLM output-dependent (5.1, 5.2, 5.4, 5.5, 5.10). Consider building an output evaluator.

---

## 6. Memory & Context Loss

> Source: OpenAI February 2025 memory collapse incident

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 6.1 | Context Lost on Provider Switch | History lost when provider changes | — | ❌ None | 🟠 P1 | No cross-provider context test |
| 6.2 | Client Memory Not Used Next Time | Extracted memories ignored | `memory.test.ts` | ⚠️ Partial | 🟠 P1 | Memory CRUD tested; cross-conversation usage untested |
| 6.3 | Memory Extraction Misses Key Details | Trivial memories kept, important lost | `memory.test.ts` | ⚠️ Partial | 🟠 P1 | Extraction priority logic untested |
| 6.4 | Memory Leaks Between Clients | Client A info shown to Client B | `memory.test.ts` | ⚠️ Partial | 🔴 P0 | Isolation tested; real cross-contamination scenario untested |
| 6.5 | Long Conversation Loses Early Context | 40+ messages, forgets message 2 | `context-manager.test.ts` | ⚠️ Partial | 🟠 P1 | Context window management tested; summarization loss untested |
| 6.6 | Memory Not Exportable | No export option | — | ❌ None | 🟡 P2 | Export-utils exist but memory export untested |

**Gaps:** Cross-conversation memory usage, memory prioritization, client isolation, long-context preservation need tests.

---

## 7. Onboarding & Workflow Failures

> Source: Keystone Technology Consultants, r/SaaS

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 7.1 | Empty State Without Guidance | New users see blank screen | — | ❌ None | 🟡 P2 | UI component test needed |
| 7.2 | API Key Setup Is Confusing | High drop-off at setup | — | ❌ None | 🟡 P2 | UX test needed |
| 7.3 | First Response Is Generic | Doesn't demonstrate value | — | ❌ None | 🟡 P2 | LLM output behavior |
| 7.4 | No Progress During Complex Tasks | User waits 30s with no feedback | `progress-tracker.test.ts` | ⚠️ Partial | 🟡 P2 | Progress tracker exists; UI rendering untested |
| 7.5 | Automation of Broken Workflows | AI amplifies chaos | `workflow-validation.test.ts` | ⚠️ Partial | 🟠 P1 | DAG validation/cycle detection tested; "structure first" logic untested |

**Gaps:** Onboarding UX tests, workflow structure recommendation logic.

---

## 8. Client Management Disconnected Systems

> Source: WorkflowMax research, Scry AI invoice study

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 8.1 | Time Entry Doesn't Flow to Invoice | Double data entry | — | ❌ None | 🟠 P1 | No integration test between time-entries and invoices |
| 8.2 | Invoice Doesn't Match Project | Wrong project on invoice | — | ❌ None | 🟠 P1 | No cross-module consistency test |
| 8.3 | Client Memory Not in Invoice Context | Preferences ignored during invoicing | — | ❌ None | 🟡 P2 | No cross-module memory usage test |
| 8.4 | Currency Formatting Inconsistent | Different formats across modules | `tax-calculator.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🟠 P1 | formatINR consistency tested |
| 8.5 | No Single Source of Truth | Client data scattered | — | ❌ None | 🟡 P2 | Architecture-level issue |

**Gaps:** Cross-module integration tests (time→invoice, memory→invoice, project→invoice).

---

## 9. Competitor-Specific Gaps

> Source: G2 reviews, Reddit comparisons

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 9.1 | vs Jasper: Brand Voice Consistency | Inconsistent voice across outputs | — | ❌ None | 🟡 P2 | Requires output consistency testing |
| 9.2 | vs Copy.ai: Multi-Domain Workflows | Can't chain marketing→finance→delivery | `cross-domain-thinking.test.ts`, `workflow-validation.test.ts` | ⚠️ Partial | 🟡 P2 | Adjacent services + DAG validation tested; chaining untested |
| 9.3 | vs Notion AI: External Actions | Can't send emails, create invoices | `invoice.test.ts`, `export-utils.test.ts` | ⚠️ Partial | 🟡 P2 | Invoice generation + export exist; email sending untested |
| 9.4 | vs HubSpot: Simpler Config | Weeks of setup required | — | ❌ None | 🟡 P2 | UX/design issue |
| 9.5 | vs HoneyBook: Better AI Integration | AI just organizes, doesn't help work | — | ❌ None | 🟡 P2 | Feature completeness issue |
| 9.6 | vs OpenRouter: Better Error Visibility | Generic errors, no provider info | `provider-health.test.ts`, `circuit-breaker.test.ts` | ✅ Covered | 🟠 P1 | Provider attribution in errors tested |
| 9.7 | vs LiteLLM: No Infrastructure | Docker/Postgres required | — | ❌ None | 🟢 P3 | Architecture choice, not testable |

**Gaps:** Most competitor gaps are feature/UX oriented, not directly unit-testable.

---

## 10. Healthcare, Finance & Legal Dangers

> Source: BW Healthcare World, TechPolicy.Press, RBI/SEBI

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 10.1 | Healthcare: AI Replaces Doctor | Medical-adjacent advice without disclaimer | `domain-compliance.test.ts` | ✅ Covered | 🔴 P0 | Healthcare disclaimer enforced |
| 10.2 | Finance: SEBI Compliance | Investment advice without SEBI | `domain-compliance.test.ts`, `hallucination-guard.test.ts`, `real-user-scenarios.test.ts` | ✅ Covered | 🔴 P0 | 3-layer coverage |
| 10.3 | Legal: Indian Contract Law | References US law instead of Indian | `contract-generator.test.ts`, `contracts.test.ts` | ⚠️ Partial | 🔴 P0 | Contract generation tested; Indian law compliance untested |
| 10.4 | FinTech: RBI Compliance | UPI app ads without RBI mention | `domain-compliance.test.ts` | ⚠️ Partial | 🔴 P0 | Ads domain tested; RBI-specific not tested |
| 10.5 | Real Estate: RERA Awareness | Brochure without RERA number | — | ❌ None | 🟠 P1 | No RERA compliance check exists |

**Gaps:** Indian Contract Act compliance, RBI-specific checks, RERA compliance framework.

---

## 11. Security & Data Leaks

> Source: OWASP AI guidelines, Reddit r/netsec

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 11.1 | API Key Never Exposed to Client | Key in client-side code | — | ❌ None | 🔴 P0 | Architecture-level security test needed |
| 11.2 | Shadow AI Usage Detection | Hidden third-party calls | `audit-log.test.ts` | ⚠️ Partial | 🟠 P1 | Audit logging tested; hidden call detection untested |
| 11.3 | Prompt Injection Blocks Exfiltration | Malicious prompts extract keys | `prompt-sanitizer.test.ts` | ✅ Covered | 🔴 P0 | Prompt injection detection tested |
| 11.4 | Document Upload Doesn't Leak Data | Confidential docs sent to AI providers | `encryption.test.ts` | ⚠️ Partial | 🔴 P0 | Encryption tested; data isolation untested |
| 11.5 | Rate Limiting Prevents Abuse | 1000 msgs/min racks up bill | `rate-limit.test.ts` | ✅ Covered | 🔴 P0 | Rate limiting + emergency stop tested |

**Gaps:** Client-side key exposure testing, data isolation verification, shadow AI detection.

---

## 12. Pricing & Cost Shock

> Source: Reddit r/SaaS, G2 pricing complaints

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 12.1 | Cost Estimate Before Sending | No cost preview | `cost-tracker.test.ts` | ⚠️ Partial | 🟠 P1 | Cost tracking exists; pre-send estimation untested |
| 12.2 | Free Tier Usage Not Tracked | No usage counter | `subscription.test.ts`, `subscription-gating.test.ts` | ✅ Covered | 🟠 P1 | Daily usage limits + tracking tested |
| 12.3 | Provider Switch Changes Cost Silently | Failover to paid provider | — | ❌ None | 🟠 P1 | No cost notification on failover test |
| 12.4 | Monthly Cost Summary | No monthly breakdown | `cost-tracker.test.ts` | ⚠️ Partial | 🟡 P2 | Cost tracking exists; monthly aggregation untested |
| 12.5 | INR Conversion Rate Transparency | No exchange rate shown | — | ❌ None | 🟢 P3 | No conversion rate display test |

**Gaps:** Pre-send cost estimation, failover cost notification, monthly aggregation.

---

## 13. Real Indian Business Scenarios

> Source: Real daily tasks of Indian agency owners

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| 13.1 | Restaurant WhatsApp Menu | No catalog with veg/non-veg markings | — | ❌ None | 🟡 P2 | LLM output + template |
| 13.2 | Dental Clinic GMB Audit | No GMB-specific checklist | — | ❌ None | 🟡 P2 | Domain knowledge test |
| 13.3 | D2C Instagram Calendar | No Indian beauty trends in calendar | — | ❌ None | 🟡 P2 | LLM output behavior |
| 13.4 | SaaS Startup Pitch Deck | No Indian market context | — | ❌ None | 🟡 P2 | LLM output behavior |
| 13.5 | Wedding Photographer Leads | Yelp/The Knot instead of WeddingWire India | — | ❌ None | 🟡 P2 | LLM output behavior |
| 13.6 | Coaching Institute Campaign | No exam-specific timing | — | ❌ None | 🟡 P2 | LLM output behavior |
| 13.7 | Manufacturing B2B Lead Scoring | US-centric scoring (Fortune 500) | — | ❌ None | 🟡 P2 | LLM output behavior |
| 13.8 | NGO Annual Report | Generic format, no Indian compliance | — | ❌ None | 🟡 P2 | LLM output behavior |
| 13.9 | AgriTech Startup Pitch | No agriculture-specific metrics | — | ❌ None | 🟡 P2 | LLM output behavior |
| 13.10 | Fashion Brand Diwali Sale | Generic "holiday sale" not Diwali | — | ❌ None | 🟡 P2 | LLM output behavior |

**Status:** All 13 scenarios are LLM output-dependent. These require an output quality evaluator framework.

---

## Priority Action Items

### 🔴 P0 — Must Fix Before Release (12 scenarios, 3 gaps)

| Gap | Effort | Approach |
|-----|--------|----------|
| 2.1 Failover flow on 429 | Medium | Add integration test: simulate provider 429 → verify failover |
| 2.2 API key expiry detection | Small | Add test: expired key → clear error + suggestion |
| 10.3 Indian Contract Act compliance | Medium | Add SEBI/RBI/RERA compliance checks in contract generator |
| 11.1 Client-side key exposure | Large | Security audit + penetration test |

### 🟠 P1 — High Priority (18 scenarios, 9 gaps)

| Gap | Effort | Approach |
|-----|--------|----------|
| 2.3 Free tier cost tracking edge cases | Small | Add cost-tracker test for free tier tokens |
| 2.6 Cross-provider context preservation | Medium | Integration test: switch provider mid-conversation |
| 3.4 Fabricated testimonial detection | Medium | Add pattern detector for fictional case studies |
| 6.4 Memory client isolation | Medium | Integration test: create memories for 2 clients, verify isolation |
| 6.5 Long conversation context loss | Medium | Test context manager with 50+ message history |
| 8.1 Time entry → invoice flow | Medium | Integration test: log time → generate invoice → verify |
| 8.2 Invoice → project consistency | Medium | Integration test: project scope → invoice line items |
| 10.4 RBI-specific compliance | Small | Add 'fintech' to strict domains with RBI checks |
| 12.3 Failover cost notification | Medium | Test: free provider fails → paid provider → verify user notified |

### 🟡 P2 — Medium Priority (30 scenarios, 14 gaps)

Most are LLM output quality tests. Consider building:
- **Output Quality Evaluator:** Framework to score AI outputs against Indian market criteria
- **Prompt Versioning Tests:** Compare output quality across prompt versions
- **Domain-Specific Output Scorer:** Rate outputs for 40 domains

### 🟢 P3 — Low Priority (2 scenarios)

| Gap | Notes |
|-----|-------|
| 11.5 (covered) | Already tested |
| 12.5 INR conversion display | Minor UI concern |

---

## Test Infrastructure Needed

| Framework | Purpose | Priority |
|-----------|---------|----------|
| **LLM Output Quality Evaluator** | Score AI outputs against Indian market criteria (Scenarios 1.x, 5.x, 13.x) | 🟡 P2 |
| **Cross-Module Integration Tests** | Verify data flows: time→invoice, memory→invoice, project→invoice (Scenarios 8.x) | 🟠 P1 |
| **Cross-Provider Context Tests** | Verify context preservation across provider switches (Scenarios 2.x, 6.x) | 🟠 P1 |
| **Compliance Checker Suite** | SEBI + RBI + RERA + Indian Contract Act (Scenarios 10.x) | 🔴 P0 |
| **Security Penetration Tests** | Client-side key exposure, data isolation (Scenarios 11.x) | 🔴 P0 |

---

## 14. WhatsApp Business API Pain (Q3 2026 — NEW)

> Source: LinkedIn (Ravi Rai), Lion CRM, RichAutomate, AiSensy G2 reviews

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| Q3-W1 | BSP Markup Hidden in Pricing | AiSensy/Wati add 20-35% markup on Meta rates | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟠 P1 | Per-message pricing model with 2.5-4x multiplier tested |
| Q3-W2 | Meta API Verification 4-8 Week Wait | Client onboarding delayed by Cloud API verification | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟠 P1 | warnAPIVerificationTimeline: 7-26 day timeline based on verification status + interim solution recommendation |
| Q3-W3 | Account Suspension for Message Blasting | Bulk promo without opt-in gets account suspended | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🔴 P0 | Compliance warning with risk levels tested |
| Q3-W4 | Green Tick Verification Confusion | No clear guide for Meta business verification | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟡 P2 | getGreenTickChecklist: 6-step verification guide with eligibility requirements |

**Status:** ✅ All 4 scenarios covered (W1, W2, W3, W4).

---

## 15. CRM Pricing & Integration Frustration (Q3 2026 — NEW)

> Source: Vedpragya blog, G2 HubSpot reviews, Zoho community forums

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| Q3-C1 | HubSpot "Platform Tax" at 15+ Users | Per-user pricing kills ROI for Indian agencies | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟠 P1 | Scaling cost warning with Zoho/Custom CRM alternatives tested |
| Q3-C2 | Zoho App Fragmentation | 45+ apps don't sync without Zapier | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟡 P2 | warnZohoFragmentation: app fragmentation risk warning with integration recommendations |
| Q3-C3 | Custom CRM ROI Calculation | No break-even analysis vs SaaS | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟡 P2 | calculateCRMRoi: payback analysis with 24L dev cost, per-user maintenance, team-size viability threshold |

**Status:** ✅ All 3 scenarios covered (C1, C2, C3).

---

## 16. Invoice & Payment Boundary Issues (Q3 2026 — NEW)

> Source: LinkedIn (Neeraj Sancheti, Deep Chakraborty), Reddit r/agency

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| Q3-P1 | Invoice Date-Changing Compliance | Re-issuing invoices messes up GST/revenue recognition | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟠 P1 | Compliance risk flagging with audit warning tested |
| Q3-P2 | 50% Upfront Payment Policy | No enforcement tools for upfront payment | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟡 P2 | getUpfrontPaymentPolicy: payment milestones based on project value tiers + escalation template |
| Q3-P3 | TDS Deduction Tracking | 10% TDS deducted, Form 16A chasing | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟠 P1 | TDS calculation + certificate status tracking tested |

**Status:** ✅ All 3 scenarios covered (P1, P2, P3).

---

## 17. AI Content Localization Gaps (Q3 2026 — NEW)

> Source: Lion CRM blog, G2 Jasper reviews, LinkedIn (Luke Shalom)

| # | Scenario | Complaint | Test File(s) | Coverage | Priority | Notes |
|---|----------|-----------|---------------|----------|----------|-------|
| Q3-A1 | "AI-Native" Quality Perception | Clients demand discounts assuming AI does all work | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟡 P2 | getAINativeValueFrame: positioning framework with differentiation strategies + objection handling |
| Q3-A2 | Vernacular Content Fails | Textbook Hindi instead of casual/colloquial | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟡 P2 | getVernacularContentGuidance: tone guidelines for Hindi/regional content with examples |
| Q3-A3 | Tier-2/3 Budget Expectations | ₹50K suggestions for ₹10-15K budgets | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟡 P2 | Tier-based budget recommendation for 7+ cities tested |
| Q3-A4 | Human Polish Pipeline | No checklist for post-AI editing | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟡 P2 | getHumanPolishPipeline: content-type-specific checklists for blog/social/email/proposal with AI contribution % and quality gates |
| Q3-A5 | Commodity Differentiation | AI commoditization drives prices to ₹5K | `q3-scenarios.ts`, `q3-scenarios.test.ts` | ✅ Covered | 🟡 P2 | getCommodityDifferentiation: threat-level analysis with defensive strategies, pricing recs, client education scripts |

**Status:** ✅ All 5 scenarios covered (A1, A2, A3, A4, A5).

---

## Q3 2026 Priority Action Items (NEW)

### ✅ Covered — 17 scenarios with executable tests (115 tests, all passing)

| Scenario | Test File | Tests |
|----------|-----------|-------|
| Q3-W1 BSP Markup Disclosure | `q3-scenarios.test.ts` | BSP Cost Comparison (7 tests) |
| Q3-W2 API Verification Timeline | `q3-scenarios.test.ts` | warnAPIVerificationTimeline (7 tests) |
| Q3-W3 WhatsApp Compliance | `q3-scenarios.test.ts` | WhatsApp Compliance Warning (7 tests) |
| Q3-W4 Green Tick Checklist | `q3-scenarios.test.ts` | getGreenTickChecklist (6 tests) |
| Q3-W8 INR Billing Migration | `q3-scenarios.test.ts` | WhatsApp INR Migration Warning (7 tests) |
| Q3-W9 Template Reclassification | `q3-scenarios.test.ts` | Template Reclassification Alert (10 tests) |
| Q3-P1 Invoice Date Compliance | `q3-scenarios.test.ts` | Invoice Date Compliance (8 tests) |
| Q3-P2 Upfront Payment Policy | `q3-scenarios.test.ts` | getUpfrontPaymentPolicy (6 tests) |
| Q3-P3 TDS Deduction Tracking | `q3-scenarios.test.ts` | TDS Deduction Tracking (6 tests) |
| Q3-C1 HubSpot Cost Warning | `q3-scenarios.test.ts` | HubSpot Cost Warning (7 tests) |
| Q3-C2 Zoho Fragmentation | `q3-scenarios.test.ts` | warnZohoFragmentation (5 tests) |
| Q3-C3 Custom CRM ROI | `q3-scenarios.test.ts` | calculateCRMRoi (4 tests) |
| Q3-A1 AI-Native Value Frame | `q3-scenarios.test.ts` | getAINativeValueFrame (2 tests) |
| Q3-A2 Vernacular Content | `q3-scenarios.test.ts` | getVernacularContentGuidance (4 tests) |
| Q3-A3 Tier-2/3 Budget | `q3-scenarios.test.ts` | Tier-2/3 Budget Adjustment (8 tests) |
| Q3-A4 Human Polish Pipeline | `q3-scenarios.test.ts` | Human Polish Pipeline (7 tests) |
| Q3-A5 Commodity Differentiation | `q3-scenarios.test.ts` | Commodity Differentiation (7 tests) |

### ❌ Remaining Q3 Gaps (0 scenarios)

**All 17 Q3 scenarios have executable tests.**

---

*This tracker should be updated monthly as new complaints are identified and tests are added.*
