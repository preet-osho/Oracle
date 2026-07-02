# Fetch Timeout Policy

> Audit of all `fetchWithTimeout` call sites across the codebase.
> Maps every call to its timeout tier constant for consistency and maintainability.
>
> **Last updated:** 2026-07-02
> **Total callsites:** 64
> **Related commits:**
> - `36d4744` — refactor: consolidate fetchWithTimeout, add timeout tiers, and fix test regressions
> - `d690ccd` — feat: add TabErrorBoundary component and typed event bus

## Timeout Tiers

| Constant | Value | Use Case |
|---|---|---|
| `TIMEOUT_QUICK_MS` | 15s | Validation pings, key checks, lightweight internal APIs |
| `TIMEOUT_MODERATE_MS` | 30s | Editor gate reviews, embeddings, external search APIs |
| `TIMEOUT_STANDARD_MS` | 60s | AI provider sync (non-streaming) generation calls |
| `TIMEOUT_STREAMING_MS` | 120s | AI provider streaming generation calls |

`FETCH_TIMEOUT_MS` aliases `TIMEOUT_QUICK_MS` (15s) — used when no explicit `timeoutMs` is passed.

All constants are defined in `src/lib/fetch-utils.ts` and enforced by the ESLint rule `custom/no-raw-timeout-ms` (set to `warn`).

---

## Call Site Registry

### 1. `src/app/api/ai/chat/route.ts` — AI Chat Proxy (Server)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 406 | `streamAnthropic` | `https://api.anthropic.com/v1/messages` | STREAMING | 120s | Anthropic streaming — long generation |
| 485 | `streamOpenAICompatible` | `{baseUrl}/chat/completions` | STREAMING | 120s | OpenAI-compatible streaming — long generation |
| 570 | `callAnthropicSync` | `https://api.anthropic.com/v1/messages` | STANDARD | 60s | Anthropic non-streaming — moderate generation |
| 619 | `callOpenAISync` | `{baseUrl}/chat/completions` | STANDARD | 60s | OpenAI-compatible non-streaming — moderate generation |

### 2. `src/lib/router.ts` — AI Provider Router

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 288 | `callAnthropicSync` | `{provider.baseUrl}/messages` | STANDARD | 60s | Anthropic provider sync call |
| 342 | `callOpenAISync` | `{baseUrl}/chat/completions` | STANDARD | 60s | OpenAI-compatible provider sync call |

### 3. `src/lib/editor-gate.ts` — Editor Quality Gate

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 154 | `runEditorGate` | `/api/ai/chat` (proxy) | MODERATE | 30s | AI review with maxTokens:1500 |

### 4. `src/lib/embeddings.ts` — OpenAI Embeddings

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 76 | `generateEmbeddings` | `https://api.openai.com/v1/embeddings` | MODERATE | 30s | Batch embedding requests can be slow |

### 5. `src/lib/rag.ts` — External Search APIs

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 344 | `tavilySearch` | `https://api.tavily.com/search` | MODERATE | 30s | External search API |
| 373 | `serperSearch` | `https://google.serper.dev/search` | MODERATE | 30s | External search API |

### 6. `src/lib/api-key-validation.ts` — API Key Validation

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 35 | `validateApiKey` | `/api/ai/chat` (proxy) | QUICK | 15s | Quick "Say ok" validation with maxTokens:5 |

### 7. `src/lib/task-executor.ts` — Background Task Execution

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 185 | `executeClientTask` | `/api/ai/chat` (proxy) | QUICK | 15s | Background task — uses `FETCH_TIMEOUT_MS` |

### 8. `src/lib/razorpay.ts` — Razorpay Payment API

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 135 | `createRazorpayOrder` | `/api/razorpay/orders` (proxy) | QUICK | 15s | Internal payment API — uses `FETCH_TIMEOUT_MS` |
| 150 | `verifyRazorpayPayment` | `/api/razorpay/verify` (proxy) | QUICK | 15s | Internal payment API — uses `FETCH_TIMEOUT_MS` |

### 9. `src/lib/api.ts` — Generic API Fetch Helper

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 119 | `apiFetch` | Dynamic (CRUD endpoints) | QUICK | 15s | General API helper — uses `FETCH_TIMEOUT_MS` |

### 10. `src/lib/user-api-keys.ts` — User API Key Management

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 34 | `list` | `/api/user-api-keys` | QUICK | 15s | Internal CRUD — uses `FETCH_TIMEOUT_MS` |
| 51 | `save` | `/api/user-api-keys` | QUICK | 15s | Internal CRUD — uses `FETCH_TIMEOUT_MS` |
| 72 | `remove` | `/api/user-api-keys` | QUICK | 15s | Internal CRUD — uses `FETCH_TIMEOUT_MS` |

### 11. `src/components/oracle/ChatPanel.tsx` — Chat Panel (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 164 | `fetchDailyUsage` | `/api/subscription/status` | QUICK | 15s | Quick status check |
| 494 | `buildAIContext` | `/api/web-search` (proxy) | MODERATE | 30s | External search via proxy |
| 732 | `scoreResponse` | `/api/ai/chat` (proxy) | STANDARD | 60s | Quality scoring — sync AI call |
| 825 | `callAI` (operating loop) | `/api/ai/chat` (proxy) | STANDARD | 60s | Loop step — sync AI call |
| 890 | Main response (streaming) | `/api/ai/chat` (proxy) | STREAMING | 120s | SSE streaming — long generation |
| 1025 | Non-streaming response | `/api/ai/chat` (proxy) | STANDARD | 60s | Non-streaming AI call |

### 12. `src/components/oracle/ConfigTab.tsx` — Config Tab (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 68 | `fetchCircuits` (GET) | `/api/analytics/circuits` | QUICK | 15s | Internal API — circuit breaker status |
| 90 | `handleResetCircuit` (POST) | `/api/analytics/circuits` | QUICK | 15s | Internal API — circuit breaker reset |
| 204 | `fetchIndexedIds` | `/api/knowledge-docs/indexed` | QUICK | 15s | Internal API — indexed doc list |
| 231 | `handleTestKey` | `/api/ai/chat` (proxy) | QUICK | 15s | Validation "Say ok" with maxTokens:10 |
| 365 | `handleReindexDoc` | `/api/knowledge-docs/{id}/reindex` | MODERATE | 30s | Re-indexing a single document |
| 385 | `handleReindexAll` | `/api/knowledge-docs/reindex` | MODERATE | 30s | Re-indexing all documents |

### 13. `src/components/oracle/OrchestratorPanel.tsx` — Orchestrator (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 530 | `analyzeTask` | `/api/ai/chat` (proxy) | STANDARD | 60s | Multi-agent planning — sync AI call |

### 14. `src/app/api/web-search/route.ts` — Web Search Proxy (Server)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 117 | `searchTavilyServer` | `https://api.tavily.com/search` | MODERATE | 30s | External search API |
| 147 | `searchSerperServer` | `https://google.serper.dev/search` | MODERATE | 30s | External search API |

### 15. `src/app/api/razorpay/orders/route.ts` — Razorpay Order Creation (Server)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 56 | `POST` | `https://api.razorpay.com/v1/orders` | QUICK | 15s | External payment API — order creation |

### 16. `src/app/api/razorpay/verify/route.ts` — Razorpay Payment Verification (Server)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 88 | `POST` | `https://api.razorpay.com/v1/payments/{id}` | QUICK | 15s | External payment API — payment details |

### 17. `src/app/api/og/route.tsx` — OG Image Font Fetching (Edge)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 77 | `fetchFontCached` | `https://fonts.gstatic.com/*` (Google Fonts) | QUICK | 15s | Font assets — cached after first fetch |

### 18. `src/components/oracle/BusinessTab.tsx` — Revenue Streams CRUD (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 64 | `loadStreams` (seed) | `/api/revenue-streams/seed` | QUICK | 15s | Internal CRUD — seed defaults |
| 73 | `loadStreams` (list) | `/api/revenue-streams` | QUICK | 15s | Internal CRUD — list streams |
| 99 | `updateStreamStatus` | `/api/revenue-streams/{id}` (PUT) | QUICK | 15s | Internal CRUD — update status |
| 110 | `deleteStream` | `/api/revenue-streams/{id}` (DELETE) | QUICK | 15s | Internal CRUD — delete stream |
| 211 | `onSave` (create) | `/api/revenue-streams` (POST) | QUICK | 15s | Internal CRUD — create stream |

### 19. `src/components/oracle/LeadsTab.tsx` — Leads CRUD (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 190 | `loadLeads` (seed) | `/api/leads/seed` | QUICK | 15s | Internal CRUD — seed defaults |
| 199 | `loadLeads` (list) | `/api/leads` | QUICK | 15s | Internal CRUD — list leads |
| 238 | `updateLeadStatus` | `/api/leads/{id}` (PUT) | QUICK | 15s | Internal CRUD — update status |
| 249 | `deleteLead` | `/api/leads/{id}` (DELETE) | QUICK | 15s | Internal CRUD — delete lead |
| 347 | `onSave` (create) | `/api/leads` (POST) | QUICK | 15s | Internal CRUD — create lead |

### 20. `src/components/oracle/RateLimitDashboard.tsx` — Rate Limit Analytics (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 140 | `fetchUserDrilldown` | `/api/analytics/rate-limits` | QUICK | 15s | Internal API — user events |
| 162 | `fetchData` | `/api/analytics/rate-limits` | QUICK | 15s | Internal API — analytics overview |
| 591 | `handleReset` (DELETE) | `/api/analytics/rate-limits` | QUICK | 15s | Internal API — reset user limits |
| 796 | `RateLimitConfigPanel` (GET) | `/api/admin/rate-limit-config` | QUICK | 15s | Internal API — fetch config |
| 816 | `handleSave` (PUT) | `/api/admin/rate-limit-config` | QUICK | 15s | Internal API — save config |
| 870 | `fetchHistory` | `/api/admin/rate-limit-config?history=true` | QUICK | 15s | Internal API — config change history |

### 21. `src/components/oracle/Header.tsx` — Emergency Stop (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 54 | mount effect | `/api/emergency-stop` (GET) | QUICK | 15s | Internal API — check status |
| 67 | `toggleEmergencyStop` | `/api/emergency-stop` (POST) | QUICK | 15s | Internal API — toggle stop |

### 22. `src/components/oracle/ProviderHealthDashboard.tsx` — Provider Health (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 89 | `fetchOverview` | `/api/analytics/health` | QUICK | 15s | Internal API — health overview |
| 100 | `fetchTimeline` | `/api/analytics/health` | QUICK | 15s | Internal API — provider timeline |

### 23. `src/components/oracle/ImageGenerationTab.tsx` — DALL-E 3 Image Generation (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 69 | `generateImage` | `https://api.openai.com/v1/images/generations` | MODERATE | 30s | External API — DALL-E 3 generation |
| 119 | `downloadImage` | Generated image URL (CDN) | MODERATE | 30s | External CDN — download generated image |

### 24. `src/components/oracle/MemoryExtractor.tsx` — AI Memory Extraction (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 56 | `extractMemories` | `/api/ai/chat` (proxy) | STANDARD | 60s | AI sync — maxTokens:1000 |

### 25. `src/components/oracle/QualityTab.tsx` — AI Quality Scoring (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 215 | `scoreResponseText` | `/api/ai/chat` (proxy) | STANDARD | 60s | AI sync — maxTokens:800 |

### 26. `src/components/oracle/OnboardingWizard.tsx` — API Key Validation (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 119 | `handleTestAndSave` | `/api/ai/chat` (proxy) | QUICK | 15s | Validation "Say ok" with maxTokens:10 |

### 27. `src/components/oracle/RoadmapTab.tsx` — AI Proposal Generation (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 61 | `generateProposal` | `/api/ai/chat` (proxy) | STREAMING | 120s | AI streaming — long proposal generation |

### 28. `src/components/oracle/AppShell.tsx` — Subscription Status (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 107 | mount effect | `/api/subscription/status` | QUICK | 15s | Internal API — check subscription |

### 29. `src/components/pricing/PricingPage.tsx` — Subscription Activation (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 203 | `startCheckout` | `/api/subscription/status` (POST) | QUICK | 15s | Internal API — activate subscription |

### 30. `src/components/oracle/CostDashboard.tsx` — Cost Tracking (Client)

| Line | Function | URL | Tier | Timeout | Rationale |
|---|---|---|---|---|---|
| 89 | `fetchData` (overview) | `/api/analytics/costs?view=overview` | QUICK | 15s | Internal API — cost overview |
| 90 | `fetchData` (daily) | `/api/analytics/costs?view=daily&days=30` | QUICK | 15s | Internal API — daily cost breakdown |
| 91 | `fetchData` (by-provider) | `/api/analytics/costs?view=by-provider&days=30` | QUICK | 15s | Internal API — provider cost breakdown |

---

## Summary Statistics

| Tier | Constant | Timeout | Call Sites | % of Total |
|---|---|---|---|---|
| QUICK | `TIMEOUT_QUICK_MS` / `FETCH_TIMEOUT_MS` | 15s | 41 | 64% |
| MODERATE | `TIMEOUT_MODERATE_MS` | 30s | 10 | 16% |
| STANDARD | `TIMEOUT_STANDARD_MS` | 60s | 10 | 16% |
| STREAMING | `TIMEOUT_STREAMING_MS` | 120s | 3 | 5% |
| **Total** | | | **64** | **100%** |

> All 64 callsites use named tier constants. `FETCH_TIMEOUT_MS` is an alias for `TIMEOUT_QUICK_MS` — both resolve to 15s. The ESLint rule `custom/no-raw-timeout-ms` enforces this at `warn` level.

---

## Design Principles

1. **All callsites use named constants** — No raw `timeoutMs` number literals. The ESLint rule `custom/no-raw-timeout-ms` enforces this at `warn` level.
2. **Internal APIs (15s / QUICK):** All calls to our own `/api/*` endpoints use `TIMEOUT_QUICK_MS` or `FETCH_TIMEOUT_MS`. These are server-side proxies that should respond quickly.
3. **External APIs (30s / MODERATE):** Third-party APIs (OpenAI embeddings, Tavily, Serper) get `TIMEOUT_MODERATE_MS` to account for network variability.
4. **AI Generation Sync (60s / STANDARD):** Non-streaming AI generation calls (Anthropic, OpenAI-compatible) get `TIMEOUT_STANDARD_MS` for complete responses.
5. **AI Generation Streaming (120s / STREAMING):** Streaming AI generation calls get `TIMEOUT_STREAMING_MS` — the timer clears once SSE headers arrive, so this is a safety net.
6. **Client-side calls to `/api/*`** use explicit tier constants matching the expected response time, not just the default.

## Adding a New Call Site

When adding a new `fetchWithTimeout` call:

1. **Determine the tier** based on the target:
   - Internal `/api/*` endpoint → `TIMEOUT_QUICK_MS`
   - External third-party API → `TIMEOUT_MODERATE_MS`
   - AI provider sync → `TIMEOUT_STANDARD_MS`
   - AI provider streaming → `TIMEOUT_STREAMING_MS`
2. **Import the constant** from `@/lib/fetch-utils`
3. **Pass it as `timeoutMs`** in the options object
4. **Add a row** to this document
5. **Add a test** in `fetch-utils.test.ts` if using a new tier value
