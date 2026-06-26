# ORACLE — Test Priority Matrix
> **Risk × Effort categorization for all test scenarios**
> Generated: June 23, 2026

---

## How to Read This Matrix

| | **Low Effort** (< 2 hrs) | **Medium Effort** (2-8 hrs) | **High Effort** (8+ hrs) |
|---|---|---|---|
| **Critical Risk** | 🔴 P1: DO FIRST | 🔴 P1: DO FIRST | 🟠 P2: PLAN CAREFULLY |
| **High Risk** | 🟠 P2: DO SOON | 🟡 P3: SCHEDULE | 🟡 P3: SCHEDULE |
| **Medium Risk** | 🟢 P4: WHEN AVAILABLE | 🟢 P4: WHEN AVAILABLE | 🔵 P5: BACKLOG |
| **Low Risk** | 🔵 P5: BACKLOG | 🔵 P5: BACKLOG | ⚪ P6: NEVER |

---

## Risk Level Definitions

| Risk Level | Definition | Impact if Missing |
|---|---|---|
| 🔴 **Critical** | Data loss, security breach, compliance violation, financial loss | Catastrophic — legal liability, user trust destroyed |
| 🟠 **High** | Broken core workflows, poor user experience, revenue impact | Significant — users can't complete key tasks |
| 🟡 **Medium** | Degraded experience, missing features, edge case failures | Moderate — workaround exists but UX suffers |
| 🟢 **Low** | Cosmetic issues, minor UX friction, non-critical edge cases | Minor —不影响 core functionality |

## Effort Level Definitions

| Effort Level | Definition | Example |
|---|---|---|
| **Low** (< 2 hrs) | Pure function tests, unit tests, assertion-only | Encryption round-trip, format validation, config defaults |
| **Medium** (2-8 hrs) | Integration tests, mock-heavy tests, multi-step workflows | Rate limit enforcement, permission matrix, workflow validation |
| **High** (8+ hrs) | End-to-end tests, real API tests, complex state management | AI chat pipeline, agent orchestration, multi-provider failover |

---

## 🔴 P1: CRITICAL RISK — DO FIRST

### 1.1 Security & Compliance (15 scenarios)

| # | Scenario | Risk | Effort | File | Status |
|---|---|---|---|---|---|
| S-1 | API Key Encryption (AES-256-CBC round-trip) | 🔴 Critical | Low | `encryption.test.ts` | ✅ Done |
| S-2 | API Key Masking (display safety) | 🔴 Critical | Low | `encryption.test.ts` | ✅ Done |
| S-3 | Encryption without key (graceful error) | 🔴 Critical | Low | `encryption.test.ts` | ✅ Done |
| S-4 | CSRF Protection (token required for POST) | 🔴 Critical | Medium | `csrf.test.ts` | ✅ Done |
| S-5 | CSRF Secure Cookie (production flag) | 🔴 Critical | Low | `csrf.test.ts` | ✅ Done |
| S-6 | Rate Limiting Enforcement (429 response) | 🔴 Critical | Medium | `rate-limit.test.ts` | ✅ Done |
| S-7 | Rate Limit Reset (window expiry) | 🔴 Critical | Low | `rate-limit.test.ts` | ✅ Done |
| S-8 | Prompt Injection Detection (identity override) | 🔴 Critical | Low | `prompt-sanitizer.test.ts` | ✅ Done |
| S-9 | Critical Injection Blocking (>4 threats) | 🔴 Critical | Low | `prompt-sanitizer.test.ts` | ✅ Done |
| S-10 | Zero-Width Character Stripping | 🔴 Critical | Low | `prompt-sanitizer.test.ts` | ✅ Done |
| S-11 | Document Content Sanitization (injection) | 🔴 Critical | Medium | `prompt-sanitizer.test.ts` | ✅ Done |
| S-12 | Search Result Sanitization (injection) | 🔴 Critical | Medium | `prompt-sanitizer.test.ts` | ✅ Done |
| S-13 | Message Sanitization (array injection) | 🔴 Critical | Medium | `prompt-sanitizer.test.ts` | ✅ Done |
| S-14 | RLS (Row Level Security) — users see only own data | 🔴 Critical | High | `permissions.test.ts` | ✅ Done |
| S-15 | Authentication Enforcement (redirect to login) | 🔴 Critical | High | Integration | ⬜ Pending |

### 1.2 Data Integrity (10 scenarios)

| # | Scenario | Risk | Effort | File | Status |
|---|---|---|---|---|---|
| D-1 | Workflow Cycle Detection | 🔴 Critical | Low | `workflow-validation.test.ts` | ✅ Done |
| D-2 | Workflow Max 8 Phases Limit | 🔴 Critical | Low | `workflow-validation.test.ts` | ✅ Done |
| D-3 | Workflow totalSteps Matching | 🔴 Critical | Low | `workflow-validation.test.ts` | ✅ Done |
| D-4 | Dependency Range Validation | 🔴 Critical | Low | `workflow-validation.test.ts` | ✅ Done |
| D-5 | Invoice GST Calculation (18%) | 🔴 Critical | Medium | `invoice.test.ts` | ✅ Done |
| D-6 | Invoice CGST/SGST Split | 🔴 Critical | Low | `invoice.test.ts` | ✅ Done |
| D-7 | Late Fee Calculation (grace period + %/day) | 🔴 Critical | Medium | `late-fee-calculator.test.ts` | ✅ Done |
| D-8 | Tax Calculator (intra-state vs interstate) | 🔴 Critical | Medium | `tax-calculator.test.ts` | ✅ Done |
| D-9 | Contract Generation (Indian law clauses) | 🔴 Critical | High | `contracts.test.ts` | ✅ Done |
| D-10 | Permission Role Hierarchy (owner>admin>employee>client) | 🔴 Critical | Low | `permissions.test.ts` | ✅ Done |

---

## 🟠 P2: HIGH RISK — DO SOON

### 2.1 AI Quality Assurance (20 scenarios)

| # | Scenario | Risk | Effort | File | Status |
|---|---|---|---|---|---|
| Q-1 | Hallucination Guard — Pattern Detection | 🟠 High | Low | `hallucination-guard.test.ts` | ✅ Done |
| Q-2 | Hallucination Guard — Domain Strictness (Finance/SEBI) | 🟠 High | Low | `hallucination-guard.test.ts` | ✅ Done |
| Q-3 | Hallucination Guard — Domain Strictness (Healthcare) | 🟠 High | Low | `hallucination-guard.test.ts` | ✅ Done |
| Q-4 | Hallucination Guard — Domain Strictness (Legal) | 🟠 High | Low | `hallucination-guard.test.ts` | ✅ Done |
| Q-5 | Hallucination Guard — Domain Strictness (Ads/Tracking) | 🟠 High | Low | `hallucination-guard.test.ts` | ✅ Done |
| Q-6 | Hallucination Guard — Self-Verification Pipeline | 🟠 High | Medium | `hallucination-guard.test.ts` | ✅ Done |
| Q-7 | Confidence Scorer — Hedging Detection | 🟠 High | Low | `confidence-scorer.test.ts` | ✅ Done |
| Q-8 | Confidence Scorer — Overconfidence Detection | 🟠 High | Low | `confidence-scorer.test.ts` | ✅ Done |
| Q-9 | Confidence Scorer — Source Citation Check | 🟠 High | Low | `confidence-scorer.test.ts` | ✅ Done |
| Q-10 | Confidence Scorer — Claim Grounding | 🟠 High | Medium | `confidence-scorer.test.ts` | ✅ Done |
| Q-11 | Fact Grounding — Claims vs Context | 🟠 High | Medium | `fact-grounding.test.ts` | ✅ Done |
| Q-12 | Fact Grounding — Ungrounded Claims Detection | 🟠 High | Medium | `fact-grounding.test.ts` | ✅ Done |
| Q-13 | Quality Scorer — 5-Dimension Calculation | 🟠 High | Low | `quality.test.ts` | ✅ Done |
| Q-14 | Quality Scorer — Grade Thresholds (A+/A/B+/B/C/D/F) | 🟠 High | Low | `quality.test.ts` | ✅ Done |
| Q-15 | Quality Scorer — AI Response Parsing (JSON) | 🟠 High | Medium | `quality.test.ts` | ✅ Done |
| Q-16 | Hallucination Learning — Record & Retrieve | 🟠 High | Low | `hallucination-guard.test.ts` | ✅ Done |
| Q-17 | Hallucination Learning — Insights Calculation | 🟠 High | Medium | `hallucination-guard.test.ts` | ✅ Done |
| Q-18 | SEBI Disclaimer Auto-Inclusion (finance domain) | 🟠 High | Medium | Domain | ⬜ Pending |
| Q-19 | Healthcare Disclaimer Auto-Inclusion | 🟠 High | Medium | Domain | ⬜ Pending |
| Q-20 | Legal Disclaimer Auto-Inclusion | 🟠 High | Medium | Domain | ⬜ Pending |

### 2.2 Core Business Logic (15 scenarios)

| # | Scenario | Risk | Effort | File | Status |
|---|---|---|---|---|---|
| B-1 | Invoice Creation with GST (full calculation) | 🟠 High | Medium | `invoice.test.ts` | ✅ Done |
| B-2 | Invoice PDF Export | 🟠 High | High | `invoice.test.ts` | ✅ Done |
| B-3 | Contract Type Selection (website vs retainer vs NDA) | 🟠 High | Medium | `contracts.test.ts` | ✅ Done |
| B-4 | Contract PDF Export | 🟠 High | High | `contracts.test.ts` | ✅ Done |
| B-5 | Proposal PDF Export | 🟠 High | High | `proposal-pdf.ts` | ⬜ Pending |
| B-6 | Expense Summary Calculation (by category/client) | 🟠 High | Medium | `expense-tracker.test.ts` | ✅ Done |
| B-7 | Revenue Stream Tracking | 🟠 High | Medium | `revenue-templates.ts` | ⬜ Pending |
| B-8 | Lead Pipeline Status Progression | 🟠 High | Medium | `lead-templates.ts` | ⬜ Pending |
| B-9 | Profitability Calculation (margin, hourly rate) | 🟠 High | Low | `profitability.test.ts` | ✅ Done |
| B-10 | Profitability Aggregation (multi-project) | 🟠 High | Medium | `profitability.test.ts` | ✅ Done |
| B-11 | INR Formatting (₹1,50,000 not ₹150,000) | 🟠 High | Low | `export-utils.test.ts` | ✅ Done |
| B-12 | Subscription Validity Check | 🟠 High | Medium | `subscription.test.ts` | ✅ Done |
| B-13 | Trial Expiration with Grace Period | 🟠 High | Medium | `subscription.test.ts` | ✅ Done |
| B-14 | Daily Usage Tracking (50/day limit) | 🟠 High | Medium | `subscription.test.ts` | ✅ Done |
| B-15 | Razorpay Payment Verification | 🟠 High | High | `razorpay.test.ts` | ✅ Done |

---

## 🟡 P3: MEDIUM RISK — SCHEDULE

### 3.1 Workflow Engine (12 scenarios)

| # | Scenario | Risk | Effort | File | Status |
|---|---|---|---|---|---|
| W-1 | JSON Extraction from Markdown | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |
| W-2 | JSON Extraction via Bracket Depth | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |
| W-3 | Topological Sort (correct order) | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |
| W-4 | Parallel Execution Groups | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |
| W-5 | Diamond Dependency Pattern | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |
| W-6 | Sequential Step Numbering Enforcement | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |
| W-7 | Quality Gate Warning | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |
| W-8 | Empty Task Validation | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |
| W-9 | Self-Reference Prevention | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |
| W-10 | Workflow Name/Time Validation | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |
| W-11 | Complex Diamond Dependency (4+ nodes) | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |
| W-12 | BuildPlanGraph (adjacency, in-degree) | 🟡 Medium | Low | `workflow-validation.test.ts` | ✅ Done |

### 3.2 Knowledge & Memory (10 scenarios)

| # | Scenario | Risk | Effort | File | Status |
|---|---|---|---|---|---|
| K-1 | Memory Save and Retrieve | 🟡 Medium | Low | `memory.test.ts` | ✅ Done |
| K-2 | Memory Deduplication | 🟡 Medium | Low | `memory.test.ts` | ✅ Done |
| K-3 | Memory Extraction from Conversation | 🟡 Medium | Medium | `memory.test.ts` | ✅ Done |
| K-4 | Memory Importance Ranking | 🟡 Medium | Low | `memory.test.ts` | ✅ Done |
| K-5 | Memory Per-Client Isolation | 🟡 Medium | Medium | `memory.test.ts` | ✅ Done |
| K-6 | Memory Max Limit (100) | 🟡 Medium | Low | `memory.test.ts` | ✅ Done |
| K-7 | Semantic Search Retrieval | 🟡 Medium | High | `search.test.ts` | ✅ Done |
| K-8 | RAG Context Building | 🟡 Medium | Medium | `rag.test.ts` | ✅ Done |
| K-9 | Document Chunking with Overlap | 🟡 Medium | Medium | `rag.test.ts` | ✅ Done |
| K-10 | Embedding Generation & Storage | 🟡 Medium | High | `embeddings.test.ts` | ✅ Done |

### 3.3 Intelligence & Automation (10 scenarios)

| # | Scenario | Risk | Effort | File | Status |
|---|---|---|---|---|---|
| I-1 | Proactive Risk Detection | 🟡 Medium | Medium | `proactive-intelligence.test.ts` | ✅ Done |
| I-2 | Cross-Domain Service Identification | 🟡 Medium | Medium | `cross-domain-thinking.test.ts` | ⬜ Pending |
| I-3 | Upsell Detection After Task | 🟡 Medium | Medium | `upsell-detection.test.ts` | ✅ Done |
| I-4 | Self-Training Task Recording | 🟡 Medium | Medium | `self-training.test.ts` | ⬜ Pending |
| I-5 | Satisfaction NPS Calculation | 🟡 Medium | Low | `satisfaction-tracker.test.ts` | ✅ Done |
| I-6 | Pattern Recognition | 🟡 Medium | Medium | `pattern-recognition.test.ts` | ⬜ Pending |
| I-7 | Feedback Bridge Integration | 🟡 Medium | High | `feedback-bridge.test.ts` | ⬜ Pending |
| I-8 | Weekly Web Scan Tool Discovery | 🟡 Medium | Medium | `weekly-web-scan.test.ts` | ✅ Done |
| I-9 | Emerging Trend Detection | 🟡 Medium | Medium | `weekly-web-scan.test.ts` | ✅ Done |
| I-10 | Cost Tracker Recording | 🟡 Medium | Medium | `cost-tracker.test.ts` | ✅ Done |

---

## 🟢 P4: LOWER RISK — WHEN AVAILABLE

### 4.1 Provider & Model Selection (8 scenarios)

| # | Scenario | Risk | Effort | File | Status |
|---|---|---|---|---|---|
| M-1 | Provider Failover on Error | 🟢 Low | High | Integration | ⬜ Pending |
| M-2 | BYOK Key Encryption & Storage | 🟢 Low | Medium | `user-api-keys.ts` | ⬜ Pending |
| M-3 | Model Selection by Tier | 🟢 Low | Medium | `model-selector.test.ts` | ✅ Done |
| M-4 | Circuit Breaker State Management | 🟢 Low | Medium | `circuit-breaker.test.ts` | ✅ Done |
| M-5 | Provider Health Tracking | 🟢 Low | Medium | `provider-health.test.ts` | ✅ Done |
| M-6 | Streaming SSE Response | 🟢 Low | High | Integration | ⬜ Pending |
| M-7 | Context Window Management | 🟢 Low | High | `context-manager.test.ts` | ✅ Done |
| M-8 | Token Budget Tracking | 🟢 Low | Medium | `token-budget.test.ts` | ✅ Done |

### 4.2 UI & Export (8 scenarios)

| # | Scenario | Risk | Effort | File | Status |
|---|---|---|---|---|---|
| U-1 | Export to CSV | 🟢 Low | Low | `export-utils.test.ts` | ✅ Done |
| U-2 | Export to PDF | 🟢 Low | Medium | `export-utils.test.ts` | ✅ Done |
| U-3 | Export to Word | 🟢 Low | Medium | `export-utils.test.ts` | ✅ Done |
| U-4 | Quality Score Display (color/label/grade) | 🟢 Low | Low | `quality.test.ts` | ✅ Done |
| U-5 | Quality Trend Detection (improving/declining) | 🟢 Low | Low | `quality.test.ts` | ✅ Done |
| U-6 | localStorage Persistence (quality scores) | 🟢 Low | Low | `quality.test.ts` | ✅ Done |
| U-7 | localStorage Persistence (guard config) | 🟢 Low | Low | `hallucination-guard.test.ts` | ✅ Done |
| U-8 | localStorage Persistence (learning entries) | 🟢 Low | Low | `hallucination-guard.test.ts` | ✅ Done |

### 4.3 Domain-Specific (15 scenarios)

| # | Scenario | Risk | Effort | File | Status |
|---|---|---|---|---|---|
| DS-1 | INR Number Formatting (all amounts) | 🟢 Low | Low | `export-utils.test.ts` | ✅ Done |
| DS-2 | Indian Platform References (Practo, JustDial) | 🟢 Low | Medium | Domain | ⬜ Pending |
| DS-3 | Festival Season Awareness (Diwali, monsoon) | 🟢 Low | Medium | Domain | ⬜ Pending |
| DS-4 | Tier-1/2/3 City Strategy Adaptation | 🟢 Low | Medium | Domain | ⬜ Pending |
| DS-5 | Hinglish Content Generation | 🟢 Low | Medium | Domain | ⬜ Pending |
| DS-6 | WhatsApp Business API Pricing (India) | 🟢 Low | Low | Domain | ⬜ Pending |
| DS-7 | Google Ads CPC Benchmarks (India) | 🟢 Low | Low | Domain | ⬜ Pending |
| DS-8 | Property Portal Optimization (99acres) | 🟢 Low | Medium | Domain | ⬜ Pending |
| DS-9 | Healthcare Platform Knowledge (Practo) | 🟢 Low | Medium | Domain | ⬜ Pending |
| DS-10 | Legal Indian Law Context (DPDP Act) | 🟢 Low | Medium | Domain | ⬜ Pending |
| DS-11 | Agricultural Season Awareness (Kharif/Rabi) | 🟢 Low | Medium | Domain | ⬜ Pending |
| DS-12 | Education Exam Calendar (IIT-JEE, CBSE) | 🟢 Low | Medium | Domain | ⬜ Pending |
| DS-13 | Wedding Season Pricing (Nov-Feb) | 🟢 Low | Medium | Domain | ⬜ Pending |
| DS-14 | Tax Season Marketing (March EOFY) | 🟢 Low | Medium | Domain | ⬜ Pending |
| DS-15 | RERA Compliance in Real Estate | 🟢 Low | Low | Domain | ⬜ Pending |

---

## 🔵 P5: LOW RISK — BACKLOG

### 5.1 Nice-to-Have Features (10 scenarios)

| # | Scenario | Risk | Effort | File | Status |
|---|---|---|---|---|---|
| N-1 | Conversation Branching (edit & resend) | 🔵 Low | High | UI | ⬜ Pending |
| N-2 | Agent Type Badge Display | 🔵 Low | Low | UI | ⬜ Pending |
| N-3 | Confidence Badge Click Interaction | 🔵 Low | Medium | UI | ⬜ Pending |
| N-4 | Prompt Version A/B Testing | 🔵 Low | High | `prompt-versioning.ts` | ⬜ Pending |
| N-5 | Prompt Favourite Toggle | 🔵 Low | Low | UI | ⬜ Pending |
| N-6 | Prompt Search (keyword) | 🔵 Low | Low | UI | ⬜ Pending |
| N-7 | Bulk Project Import (CSV) | 🔵 Low | Medium | Integration | ⬜ Pending |
| N-8 | Conversation Title Auto-Generation | 🔵 Low | Medium | Integration | ⬜ Pending |
| N-9 | MCP Tool Integration (Gmail/Calendar) | 🔵 Low | High | Integration | ⬜ Pending |
| N-10 | Emergency Stop (admin) | 🔵 Low | Medium | `emergency-stop.test.ts` | ✅ Done |

---

## 📊 Summary Statistics

### By Risk Level

| Risk Level | Total Scenarios | Done | Pending | % Complete |
|---|---|---|---|---|
| 🔴 Critical | 25 | 24 | 1 | 96% |
| 🟠 High | 35 | 28 | 7 | 80% |
| 🟡 Medium | 42 | 35 | 7 | 83% |
| 🟢 Low | 31 | 20 | 11 | 65% |
| 🔵 Low | 10 | 1 | 9 | 10% |
| **Total** | **143** | **108** | **35** | **76%** |

### By Effort Level

| Effort Level | Total Scenarios | Done | Pending | % Complete |
|---|---|---|---|---|
| Low (< 2 hrs) | 68 | 60 | 8 | 88% |
| Medium (2-8 hrs) | 52 | 38 | 14 | 73% |
| High (8+ hrs) | 23 | 10 | 13 | 43% |
| **Total** | **143** | **108** | **35** | **76%** |

### By Category

| Category | Total | Done | Pending |
|---|---|---|---|
| Security & Compliance | 15 | 14 | 1 |
| Data Integrity | 10 | 10 | 0 |
| AI Quality Assurance | 20 | 18 | 2 |
| Core Business Logic | 15 | 12 | 3 |
| Workflow Engine | 12 | 12 | 0 |
| Knowledge & Memory | 10 | 10 | 0 |
| Intelligence & Automation | 10 | 6 | 4 |
| Provider & Model | 8 | 5 | 3 |
| UI & Export | 8 | 8 | 0 |
| Domain-Specific | 15 | 0 | 15 |
| Nice-to-Have | 10 | 1 | 9 |

---

## 🎯 Recommended Implementation Order

### Phase 1: Critical Security Gaps (Week 1)
1. **S-15**: Authentication Enforcement — integration test for redirect to login
2. **Q-18**: SEBI Disclaimer Auto-Inclusion — domain validation test
3. **Q-19**: Healthcare Disclaimer Auto-Inclusion — domain validation test
4. **Q-20**: Legal Disclaimer Auto-Inclusion — domain validation test

### Phase 2: High-Risk Business Logic (Week 2)
5. **B-5**: Proposal PDF Export — unit test for PDF generation
6. **B-8**: Lead Pipeline Status Progression — integration test
7. **I-2**: Cross-Domain Service Identification — unit test
8. **I-4**: Self-Training Task Recording — unit test
9. **I-7**: Feedback Bridge Integration — integration test

### Phase 3: Medium-Risk Intelligence (Week 3)
10. **I-6**: Pattern Recognition — unit test
11. **I-8/9**: Web Scan & Trend Detection — integration tests
12. **M-1**: Provider Failover — integration test with mocked providers
13. **M-2**: BYOK Key Encryption — unit test
14. **M-6**: Streaming SSE Response — integration test

### Phase 4: Domain-Specific Validation (Week 4)
15. **DS-1 through DS-15**: Domain knowledge validation tests — unit tests for each domain's compliance, pricing, and platform references

### Phase 5: Nice-to-Have & UI (Week 5)
16. **N-1 through N-10**: UI and feature tests — component and integration tests

---

## 🏷️ Quick Reference: What to Test First

If you have **2 hours**: Do S-1 through S-10 (critical security unit tests)
If you have **1 day**: Do all 🔴 Critical risk items (25 scenarios)
If you have **1 week**: Do all 🔴 + 🟠 items (60 scenarios)
If you have **2 weeks**: Do all 🔴 + 🟠 + 🟡 items (102 scenarios)
If you have **1 month**: Complete all 143 scenarios

---

> **Note:** This matrix should be reviewed monthly and updated as new scenarios are added or existing ones are completed. Risk levels may change based on production incident data.
