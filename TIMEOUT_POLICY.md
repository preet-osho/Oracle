# Fetch Timeout Policy

> Auto-generated audit of all `fetchWithTimeout` call sites across the codebase.
> Maps every call to its timeout tier constant for consistency and maintainability.

## Timeout Tiers

| Constant | Value | Use Case |
|---|---|---|
| `TIMEOUT_QUICK_MS` | 15s | Validation pings, key checks, lightweight internal APIs |
| `TIMEOUT_MODERATE_MS` | 30s | Editor gate reviews, embeddings, external search APIs |
| `TIMEOUT_STANDARD_MS` | 60s | AI provider sync (non-streaming) generation calls |
| `TIMEOUT_STREAMING_MS` | 120s | AI provider streaming generation calls |

`FETCH_TIMEOUT_MS` aliases `TIMEOUT_QUICK_MS` (15s) — used when no explicit `timeoutMs` is passed.

---

## Call Site Registry

### 1. `src/app/api/ai/chat/route.ts` — AI Chat Proxy (Server)

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 406 | `streamAnthropic` | `https://api.anthropic.com/v1/messages` | 120s | STREAMING | Anthropic streaming — long generation |
| 485 | `streamOpenAICompatible` | `{baseUrl}/chat/completions` | 120s | STREAMING | OpenAI-compatible streaming — long generation |
| 570 | `callAnthropicSync` | `https://api.anthropic.com/v1/messages` | 60s | STANDARD | Anthropic non-streaming — moderate generation |
| 619 | `callOpenAISync` | `{baseUrl}/chat/completions` | 60s | STANDARD | OpenAI-compatible non-streaming — moderate generation |

### 2. `src/lib/router.ts` — AI Provider Router

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 288 | `callAnthropicSync` | `{provider.baseUrl}/messages` | 60s | STANDARD | Anthropic provider sync call |
| 342 | `callOpenAISync` | `{baseUrl}/chat/completions` | 60s | STANDARD | OpenAI-compatible provider sync call |

### 3. `src/lib/editor-gate.ts` — Editor Quality Gate

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 154 | `runEditorGate` | `/api/ai/chat` (proxy) | 30s | MODERATE | AI review with maxTokens:1500 |

### 4. `src/lib/embeddings.ts` — OpenAI Embeddings

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 76 | `generateEmbeddings` | `https://api.openai.com/v1/embeddings` | 30s | MODERATE | Batch embedding requests can be slow |

### 5. `src/lib/rag.ts` — External Search APIs

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 344 | `tavilySearch` | `https://api.tavily.com/search` | 30s | MODERATE | External search API |
| 373 | `serperSearch` | `https://google.serper.dev/search` | 30s | MODERATE | External search API |

### 6. `src/lib/api-key-validation.ts` — API Key Validation

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 35 | `validateApiKey` | `/api/ai/chat` (proxy) | 15s | QUICK | Quick "Say ok" validation with maxTokens:5 |

### 7. `src/lib/task-executor.ts` — Background Task Execution

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 185 | `executeClientTask` | `/api/ai/chat` (proxy) | 15s | DEFAULT | Background task — uses `FETCH_TIMEOUT_MS` |

### 8. `src/lib/razorpay.ts` — Razorpay Payment API

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 135 | `createRazorpayOrder` | `/api/razorpay/orders` (proxy) | 15s | DEFAULT | Internal payment API — uses `FETCH_TIMEOUT_MS` |
| 150 | `verifyRazorpayPayment` | `/api/razorpay/verify` (proxy) | 15s | DEFAULT | Internal payment API — uses `FETCH_TIMEOUT_MS` |

### 9. `src/lib/api.ts` — Generic API Fetch Helper

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 119 | `apiFetch` | Dynamic (CRUD endpoints) | 15s | DEFAULT | General API helper — uses `FETCH_TIMEOUT_MS` |

### 10. `src/lib/user-api-keys.ts` — User API Key Management

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 34 | `list` | `/api/user-api-keys` | 15s | DEFAULT | Internal CRUD — uses `FETCH_TIMEOUT_MS` |
| 51 | `save` | `/api/user-api-keys` | 15s | DEFAULT | Internal CRUD — uses `FETCH_TIMEOUT_MS` |
| 72 | `remove` | `/api/user-api-keys` | 15s | DEFAULT | Internal CRUD — uses `FETCH_TIMEOUT_MS` |

### 11. `src/components/oracle/ChatPanel.tsx` — Chat Panel (Client)

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 164 | Subscription check | `/api/subscription/status` | 15s | DEFAULT | Quick status check — uses `FETCH_TIMEOUT_MS` |
| 494 | Web search | `/api/web-search` (proxy) | 15s | DEFAULT | External search via proxy — uses `FETCH_TIMEOUT_MS` |
| 731 | callAI (sync) | `/api/ai/chat` (proxy) | 15s | DEFAULT | Step-by-step operating loop — uses `FETCH_TIMEOUT_MS` |
| 823 | Main response (streaming) | `/api/ai/chat` (proxy) | 15s | DEFAULT | SSE streaming — uses `FETCH_TIMEOUT_MS` |
| 887 | callAI (loop step) | `/api/ai/chat` (proxy) | 15s | DEFAULT | Loop step execution — uses `FETCH_TIMEOUT_MS` |
| 1021 | callAI (orchestrator) | `/api/ai/chat` (proxy) | 15s | DEFAULT | Multi-agent orchestration — uses `FETCH_TIMEOUT_MS` |

### 12. `src/components/oracle/ConfigTab.tsx` — Config Tab (Client)

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 68 | List circuits | `/api/analytics/circuits` | 15s | DEFAULT | Internal API — uses `FETCH_TIMEOUT_MS` |
| 90 | Toggle circuit | `/api/analytics/circuits` | 15s | DEFAULT | Internal API — uses `FETCH_TIMEOUT_MS` |
| 204 | List indexed docs | `/api/knowledge-docs/indexed` | 15s | DEFAULT | Internal API — uses `FETCH_TIMEOUT_MS` |
| 231 | AI analysis | `/api/ai/chat` (proxy) | 15s | DEFAULT | Document analysis — uses `FETCH_TIMEOUT_MS` |
| 365 | Reindex doc | `/api/knowledge-docs/{id}/reindex` | 15s | DEFAULT | Internal API — uses `FETCH_TIMEOUT_MS` |
| 385 | Reindex all | `/api/knowledge-docs/reindex` | 15s | DEFAULT | Internal API — uses `FETCH_TIMEOUT_MS` |

### 13. `src/components/oracle/OrchestratorPanel.tsx` — Orchestrator (Client)

| Line | Function | URL | Timeout | Tier | Rationale |
|---|---|---|---|---|---|
| 530 | AI orchestration | `/api/ai/chat` (proxy) | 15s | DEFAULT | Multi-agent planning — uses `FETCH_TIMEOUT_MS` |

---

## Summary Statistics

| Tier | Constant | Timeout | Call Sites | % of Total |
|---|---|---|---|---|
| QUICK | `TIMEOUT_QUICK_MS` | 15s | 1 | 3% |
| MODERATE | `TIMEOUT_MODERATE_MS` | 30s | 3 | 9% |
| STANDARD | `TIMEOUT_STANDARD_MS` | 60s | 4 | 12% |
| STREAMING | `TIMEOUT_STREAMING_MS` | 120s | 2 | 6% |
| DEFAULT | `FETCH_TIMEOUT_MS` | 15s | 22 | 70% |
| **Total** | | | **32** | **100%** |

---

## Design Principles

1. **Internal APIs (15s / DEFAULT):** All calls to our own `/api/*` endpoints use the default 15s timeout. These are server-side proxies that should respond quickly.
2. **External APIs (30s / MODERATE):** Third-party APIs (OpenAI embeddings, Tavily, Serper) get 30s to account for network variability.
3. **AI Generation Sync (60s / STANDARD):** Non-streaming AI generation calls (Anthropic, OpenAI-compatible) get 60s for complete responses.
4. **AI Generation Streaming (120s / STREAMING):** Streaming AI generation calls get 120s — the timer clears once SSE headers arrive, so this is a safety net.
5. **Client-side calls to `/api/*`** use `FETCH_TIMEOUT_MS` (15s) since the server-side handler already has its own timeout budget.

## Adding a New Call Site

When adding a new `fetchWithTimeout` call:

1. **Determine the tier** based on the target:
   - Internal `/api/*` endpoint → `TIMEOUT_QUICK_MS` (or default)
   - External third-party API → `TIMEOUT_MODERATE_MS`
   - AI provider sync → `TIMEOUT_STANDARD_MS`
   - AI provider streaming → `TIMEOUT_STREAMING_MS`
2. **Import the constant** from `@/lib/fetch-utils`
3. **Pass it as `timeoutMs`** in the options object
4. **Add a row** to this document
5. **Add a test** in `fetch-utils.test.ts` if using a new tier value
