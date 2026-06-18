# ORACLE — Product Truth Document

> **Version:** 2.1 · **Last updated:** June 18, 2026
> **Canonical source of truth.** All product decisions, repairs, and feature work should reference this document.

---

## 1. What Is ORACLE?

ORACLE is an **AI-powered operating system for digital agencies**. It is NOT a chatbot wrapper — it is a full business execution layer where agency teams manage clients, run AI across 40 service disciplines, track time, generate invoices, and deliver polished work.

**One-liner:** The most capable AI coworker ever built for a professional digital agency.

**Owner:** Preet Osho · Oracle Digital · Delhi, India

---

## 2. Target User

| Attribute | Detail |
|-----------|--------|
| **Who** | Small-to-mid digital agencies (1–15 employees) in India |
| **Pain** | Managing 5–20 clients across SEO, ads, web dev, content, voice bots — manually, with scattered tools |
| **Goal** | Deliver ₹50,000+ client-quality work at speed, without hiring specialists for every domain |
| **Geography** | Tier-1 (Mumbai, Delhi, Bangalore), Tier-2 (Pune, Ahmedabad, Jaipur), Tier-3 (Lucknow, Bhopal, Indore) |
| **Channel** | WhatsApp-first communication (not email) |
| **Budget** | ₹0–₹50,000/month for AI tools (BYOK — Bring Your Own Key) |
| **Language** | Professional English for clients; natural Hinglish for WhatsApp/social content |

---

## 3. Product Identity

| Property | Value |
|----------|-------|
| **Name** | ORACLE |
| **Tagline** | AI Operating System for Digital Agencies |
| **Persona** | Senior strategist + full execution team + entire internet knowledge — in one interface |
| **Tone** | Professional, direct, India-aware. Never generic. Never vague. |
| **Quality bar** | Every output must be good enough to send to a ₹50,000+ client without editing |
| **Pricing philosophy** | INR-first. All costs, invoices, proposals in ₹. Never USD unless explicitly asked. |

---

## 4. Core Features

### 4.1 AI Chat (Primary Interface)

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-provider chat | ✅ | Streaming + sync responses across 10 AI providers |
| Provider failover | ✅ | NeverStopRouter auto-switches on failure (Groq → Google → Cerebras → ...) |
| BYOK model | ✅ | Users bring their own API keys (stored encrypted server-side) |
| Cost tracking | ✅ | Per-message INR + USD cost display |
| Token budgeting | ✅ | Real-time token consumption display |
| Model selector | ✅ | 30+ models across 10 providers, switchable mid-conversation |
| Agent types | ✅ | 12 specialist agents: Orchestrator, Researcher, Writer, Developer, Analyst, Strategist, Marketer, Designer, Finance, Voice, QA, Coordinator, Workflow |
| Multi-agent orchestration | ✅ | Complex tasks decomposed across specialist agents |
| MCP tools | ✅ | Gmail, Calendar, Drive integration (Anthropic models only) |
| Streaming SSE | ✅ | Real-time token-by-token response rendering |
| Markdown rendering | ✅ | Full markdown support in responses |
| Conversation history | ✅ | Persistent conversations with title generation |
| Project context | ✅ | Select a project to inject client context into AI responses |

### 4.2 Quality Assurance

| Feature | Status | Description |
|---------|--------|-------------|
| Hallucination guard | ✅ | Auto-detects unsupported claims, fabricated stats, overconfidence |
| Quality scoring | ✅ | 5-dimension scoring: Completeness, Specificity, Actionability, India Context, Client Ready (100 pts) |
| Confidence badges | ✅ | Visual confidence % on each AI response |
| Guard stats panel | ✅ | Aggregated quality metrics across conversation |
| Self-verification | ✅ | AI self-checks output before presenting to user |
| Fact grounding | ✅ | Verifies claims against injected context (RAG docs, web search, memory) |
| Pattern detection | ✅ | Identifies recurring hallucination types for learning |

### 4.3 Client Management

| Feature | Status | Description |
|---------|--------|-------------|
| Client projects | ✅ | Full CRUD with client name, industry, service, status, value, deadline, contacts |
| Project memory | ✅ | Per-client memory (preferences, facts, feedback, decisions, contacts) |
| Memory extraction | ✅ | Auto-extracts memories from conversations using AI |
| Time tracking | ✅ | Billable/non-billable time entries per client |
| Invoice generation | ✅ | GST-aware invoices with PDF export |

### 4.4 Knowledge & Research

| Feature | Status | Description |
|---------|--------|-------------|
| Knowledge docs (RAG) | ✅ | Upload PDF, DOCX, XLSX for context-aware AI responses |
| Web search | ✅ | Tavily/Serper API integration for real-time research |
| Search results in chat | ✅ | Web search results injected as context |
| Document chunking | ✅ | Smart chunking + embedding for relevant retrieval |

### 4.5 Content & Prompts

| Feature | Status | Description |
|---------|--------|-------------|
| Prompt library | ✅ | 55+ pre-built prompts across 6 categories |
| Prompt versioning | ✅ | Version control + A/B testing for prompts |
| Custom prompts | ✅ | Create, edit, favourite custom prompts |
| Domain knowledge | ✅ | 40 agency disciplines with expert approaches, tools, pricing |
| Test cases | ✅ | 8 realistic client scenarios for testing AI capabilities |

### 4.6 Business Operations

| Feature | Status | Description |
|---------|--------|-------------|
| Revenue streams | ✅ | Track services, products, retainers, affiliates, SaaS revenue |
| Expense tracking | ✅ | Categorised expense management (software, tools, freelancer, marketing) |
| Lead generation | ✅ | Lead pipeline with status tracking, personalised outreach |
| Proposals/Roadmaps | ✅ | AI-generated client proposals with pricing, timeline, KPIs |
| Workflows | ✅ | Multi-step agent workflows for complex projects |
| Analytics dashboard | ✅ | Usage analytics, cost breakdown, provider performance |

### 4.7 Intelligence & Automation

| Feature | Status | Description |
|---------|--------|-------------|
| Proactive intelligence | ✅ | Surfaces relevant insights without being asked |
| Cross-domain thinking | ✅ | Identifies related services across 40 disciplines |
| Pattern recognition | ✅ | Recognises recurring task patterns |
| Self-training loop | ✅ | Learns from corrections and feedback |
| Satisfaction tracker | ✅ | Tracks user satisfaction over time |
| Weekly web scan | ✅ | Discovers new tools and techniques |
| Monthly intelligence report | ✅ | Automated performance and insight reports |

### 4.8 Payments

| Feature | Status | Description |
|---------|--------|-------------|
| Razorpay integration | ✅ | Subscription billing with Razorpay |
| Payment verification | ✅ | Server-side payment signature verification |

### 4.9 UI & Experience

| Feature | Status | Description |
|---------|--------|-------------|
| App shell | ✅ | Single-page app with 30+ lazy-loaded tabs |
| Command palette | ✅ | Cmd+K navigation across all features |
| Sidebar | ✅ | Quick actions, project context, model selector, RAG docs |
| Theme system | ✅ | Light/dark mode with design tokens |
| Onboarding wizard | ✅ | First-run setup flow |
| Notifications | ✅ | In-app notification system |
| Responsive design | ✅ | Mobile-first responsive layout |
| SEO | ✅ | JSON-LD, OG tags, meta tags, sitemap, robots.txt |

---

## 5. User Journeys

### Journey 1: First-Time Setup
1. **Landing page** → Click "Get Started"
2. **Login/Signup** → Email/password or magic link (Supabase Auth)
3. **Onboarding wizard** → Enter agency name, select domains, connect API keys
4. **Dashboard** → See empty state with quick-start cards
5. **First chat** → Ask any agency question → Get professional-grade response

### Journey 2: Client Project Workflow
1. **Create project** → Projects tab → "New Project" → Enter client details
2. **Select project** → Chat sidebar → Select project for memory context
3. **Chat with context** → AI remembers client details across conversations
4. **Upload docs** → Knowledge tab → Upload client brief, contracts, brand guide
5. **Generate proposal** → Roadmap tab → Paste brief → AI generates full proposal
6. **Track time** → Time tab → Log hours per project
7. **Generate invoice** → Invoices tab → Select project → GST-aware invoice → Export PDF

### Journey 3: Multi-Agent Complex Task
1. **Ask complex question** → "Create a full marketing plan for my restaurant client"
2. **Orchestrator decomposes** → Breaks into: research → strategy → content → ads → measurement
3. **Agents execute in sequence** → Researcher gathers data → Strategist plans → Writer creates content
4. **Quality gates** → Hallucination guard checks each agent's output
5. **Synthesis** → Orchestrator combines all outputs into coherent deliverable
6. **User reviews** → Confidence badges on each section, feedback buttons

### Journey 4: Lead Generation & Outreach
1. **Leads tab** → Configure lead generation (Google Maps, Website Audit, Funded Startup)
2. **Leads discovered** → AI identifies businesses with poor online presence
3. **Personalised outreach** → AI generates custom WhatsApp/email messages per lead
4. **Track pipeline** → New → Contacted → Responded → Hot → Converted
5. **Follow-ups** → Scheduled follow-up reminders

### Journey 5: Quality-Driven Delivery
1. **Generate output** → Any AI response automatically scored
2. **Review score** → 5-dimension quality breakdown (Completeness, Specificity, Actionability, India Context, Client Ready)
3. **Hallucination check** → Auto-detected issues flagged with severity
4. **Feedback loop** → User rates response → Memory extracted → Pattern learned
5. **Continuous improvement** → Self-training loop improves over time

---

## 6. AI Provider Architecture

| Provider | Models | Free Tier | Streaming | MCP |
|----------|--------|-----------|-----------|-----|
| Groq | Llama 3.3 70B, Llama 3 8B, Mixtral 8x7B | ✅ Unlimited | ✅ | ❌ |
| Google AI | Gemini 2.0 Flash, Gemini 1.5 Pro | ✅ Generous | ✅ | ❌ |
| Cerebras | Llama 3.3 70B, Llama 3.1 8B | ✅ Fast inference | ✅ | ❌ |
| OpenRouter | DeepSeek R1, Llama 3.3 70B (free) | ✅ Free models | ✅ | ❌ |
| Together AI | Llama 3.3 70B Free, Llama 3.1 405B | ✅ Free tier | ✅ | ❌ |
| Mistral AI | Mistral Large, Mistral Small, Mixtral 8x22B | ✅ Free tier | ✅ | ❌ |
| Cohere | Command R+, Command R, Command Light | ✅ Free tier | ✅ | ❌ |
| Perplexity | Sonar Large, Sonar Small (online) | ❌ Paid | ✅ | ❌ |
| Anthropic | Claude Opus 4, Sonnet 4, Haiku 4.5 | ❌ Paid | ✅ | ✅ |
| OpenAI | GPT-4o, GPT-4o Mini, o3-mini | ❌ Paid | ✅ | ❌ |

**Failover order:** Groq → Google → Cerebras → OpenRouter → Together → Mistral → Cohere → Anthropic → OpenAI → Perplexity

---

## 7. Agent System

| Agent | Role | Specialisations |
|-------|------|-----------------|
| **Orchestrator** | Default. Decomposes complex tasks across specialists | Task decomposition, agent selection, result synthesis |
| **Researcher** | Web research & data gathering | Web search, competitive analysis, market intelligence |
| **Writer** | Content creation | Copywriting, SEO content, proposals, documentation |
| **Developer** | Code generation & implementation | React, Next.js, Node.js, Python, databases |
| **Analyst** | Data analysis & reporting | SEO audits, ads analysis, business analytics |
| **Strategist** | Business strategy & planning | Growth frameworks, roadmaps, positioning |
| **Marketer** | Digital marketing campaigns | SEO, ads, social, email, WhatsApp, growth hacking |
| **Designer** | UI/UX & brand design | Wireframes, design systems, visual content |
| **Finance** | Financial analysis & planning | Budgeting, pricing, investment analysis, ROI |
| **Voice** | Voice agent configuration | VAPI, Sarvam AI, ElevenLabs, telephony |
| **QA** | Quality assurance & testing | Code review, security, accessibility, performance |
| **Coordinator** | Project management | Sprint planning, client communication, delivery |
| **Workflow** | Multi-phase orchestration | Sequential agent chaining, quality gates, pipelines |

---

## 8. 40 Agency Service Domains

### Digital Marketing (10)
Website Development · Complete SEO · Google Ads · Meta Ads · LinkedIn Marketing · Social Media Marketing · Email Marketing · Content Marketing · Growth Hacking · Lead Generation

### Development (6)
CRM & Sales Systems · Voice Agents · AI Chatbots · SaaS Development · Mobile App Development · E-Commerce (Shopify)

### Content (4)
Brand Identity · PR & Outreach · Video Marketing · WhatsApp Marketing

### Finance (2)
Investment Analysis · Trading Strategy

### Operations (1)
Data Analytics

### Industry Verticals (17)
Real Estate · Healthcare · Legal · Manufacturing/B2B · Education/EdTech · Hospitality · D2C/Retail · NGO/Non-profit · Fashion & Beauty · Entertainment/Events · Agriculture/AgriTech · Travel/Tourism · Recruitment/HR · FinTech · Gaming/Apps · Architecture/Interior Design · WordPress Development

---

## 9. Data Models

| Entity | Key Fields | Relationships |
|--------|------------|---------------|
| **ClientProject** | clientName, industry, service, status, value, deadline, contacts, requirements | Has many TimeEntries, Invoices, Memories |
| **TimeEntry** | clientId, description, hours, rate, date, billable | Belongs to ClientProject |
| **Invoice** | clientId, items[], subtotal, gst, total, status | Belongs to ClientProject |
| **Memory** | clientId, content, category, importance | Belongs to ClientProject |
| **KnowledgeDocument** | name, content, chunks[], source, tags | Linked to ClientProject |
| **PromptItem** | title, category, domain, prompt, useCount, rating | Standalone |
| **Conversation** | title, messages[], agentType | Standalone |
| **Lead** | businessName, status, channel, personalisedMessage | Standalone |
| **RevenueStream** | name, type, monthlyProjection, margin, status | Standalone |
| **UsageRecord** | provider, model, tokens, costUSD, costINR | Standalone |
| **QualityScore** | completeness, specificity, actionability, indiaContext, clientReady | Attached to messages |

---

## 10. Technical Architecture

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16 (App Router) | Server-side AI proxy, SSR auth |
| Language | TypeScript 5 (strict) | No `any` types in production code |
| UI | React 18, Tailwind CSS 4, shadcn/ui, Framer Motion | Design tokens in `styles/design-tokens.ts` |
| State | Zustand | Router store for cost/usage tracking |
| Auth | Supabase Auth | Email/password + magic link + OAuth |
| Database | Supabase (PostgreSQL) | RLS policies, migrations in `supabase/migrations/` |
| AI Proxy | Custom server-side proxy | Keys never leave server, encrypted at rest |
| Encryption | AES-256-CBC | `src/lib/encryption.ts` — shared encrypt/decrypt/maskKey |
| Rate Limiting | In-memory + Upstash Redis | `src/lib/rate-limit.ts` — per-endpoint + global |
| CSRF | Double-submit cookie pattern | Enforced in root middleware for all mutating API routes |
| Testing | Vitest + React Testing Library + user-event + jsdom | Test files in `*.test.tsx` / `*.test.ts` |
| Error Tracking | Sentry | Client + server + edge configs |
| Deployment | Vercel (assumed) | Next.js optimized |

---

## 11. Security Model

| Layer | Implementation |
|-------|---------------|
| **Authentication** | Supabase Auth with session refresh in root middleware |
| **Route protection** | Unauthenticated users redirected to `/login` |
| **API key encryption** | AES-256-CBC with random IV, stored as `iv_hex:ciphertext_hex` |
| **CSRF protection** | Centralised in root middleware for all POST/PUT/PATCH/DELETE routes |
| **CSRF cookie Secure** | `Secure` flag conditional on HTTPS (production only, excluded on localhost) |
| **Rate limiting** | All 35+ API routes rate-limited (write: 30 req/min, read: 60 req/min) |
| **RLS** | Supabase Row Level Security policies on all tables |
| **Key isolation** | API keys never exposed to client (no `NEXT_PUBLIC_` prefix for service keys) |
| **Input validation** | Zod schemas on all POST/PUT routes (invoices/[id] PUT fixed for mass-assignment) |
| **CSP** | Content-Security-Policy on HTML page loads (Sentry + Supabase allowlisted, `upgrade-insecure-requests` for mixed content) |
| **Permissions-Policy** | Camera, microphone, geolocation denied on all responses |

---

## 12. Out of Scope (NOT building)

| Item | Reason |
|------|--------|
| **Video generation** | Out of scope for text/code-focused AI |
| **Image generation** | Future feature — not current focus |
| **Multi-user team features** | Single-user per account for now |
| **Native mobile app** | Web-first, responsive design covers mobile |
| **Self-hosted deployment** | SaaS model via Vercel |
| **Custom model fine-tuning** | BYOK model, users choose provider |
| **Real-time collaboration** | Not in v1 scope |
| **White-label platform** | Future SaaS revenue stream, not current product |
| **Phone/SMS integration** | Voice agent config only, not telephony provider |
| **Payment processing for clients** | Agency tool, not payment processor |

---

## 13. Success Criteria

### Product-Market Fit
- [ ] Agency owner can onboard and get first useful response within 5 minutes
- [ ] 80%+ of AI outputs are good enough to send to a client without editing
- [ ] User returns to the app at least 3x/week after first week

### Quality Benchmarks
- [ ] Quality scores average ≥ 75/100 across all dimensions
- [ ] Hallucination guard catches ≥ 90% of unsupported claims
- [ ] Zero data leaks (API keys, client data, credentials)
- [ ] All outputs in INR with Indian number formatting (₹1,50,000 not ₹150,000)

### Technical Health
- [ ] TypeScript compiles with zero errors
- [ ] All critical API routes have auth, rate limiting, CSRF, and input validation
- [ ] Build succeeds without warnings
- [ ] Lighthouse score ≥ 90 on landing page
- [ ] Zero console errors in production

### Business
- [ ] 40 service domains fully usable with expert-level guidance
- [ ] 55+ prompts tested and producing client-quality output
- [ ] 10 AI providers working with failover
- [ ] Razorpay billing functional for subscription model

---

## 14. Repair Progress & Remaining Roadmap

| Phase | Focus | Status | Key Items |
|-------|-------|--------|-----------|
| **Phase 1** | Security foundation | ✅ Done | Root middleware: auth enforcement, session refresh, CSRF double-submit cookie, security headers |
| **Phase 2** | Shared infrastructure | ✅ Done | Shared encryption (`src/lib/encryption.ts`), rate limiting (in-memory + Upstash), CSRF enforcement on all mutating routes |
| **Phase 3** | Frontend polish | ✅ Done | Decomposed ChatPanel (~1200→490 lines) into 6 sub-components (ChatHeader, MessageBubble, ChatInputArea, EmptyState, MarkdownComponents, agent-config). Responsive `sm:`/`md:` breakpoints. Removed dead code and circular dependency. |
| **Phase 4** | Backend hardening | ✅ Done | Audited all 18 POST + 6 PUT routes — all already had `validateBody` + Zod schemas. Fixed `invoices/[id]` PUT (was raw body → Supabase, now validates + whitelists fields). Added `UpdateInvoiceSchema`. |
| **Phase 5** | Security hardening | ✅ Done | CSRF cookie `Secure` flag (conditional on HTTPS). CSP header on HTML page loads (Sentry + Supabase allowlisted). Permissions-Policy (camera/mic/geo denied). npm audit: 7 transitive vulns (2 high: undici, hono) — requires eslint v9 upgrade to fix. |
| **Phase 6** | AI system repair | ✅ Done | Quality scoring: aligned grade/label thresholds (C≥40="Needs Work", D≥20="Poor"), trend noise reduction. Memory extraction: deduplication, importance validation, per-client limit (100), improved prompt. Hallucination guard: weight normalization, self-verification fallback 70→50, replaced noisy `missing_caveat` with `unsupported_claim`, updated year range to 2024. |
| **Phase 7** | Self-training loop | ✅ Done | Created `feedback-bridge.ts` connecting hallucination-guard → self-training → model-selector. Verdict buttons update model performance learning. Quality scores fed via `.then()` callbacks (non-blocking). `getFeedbackSummary()` aggregates insights from all 3 systems. |
| **Phase 8** | UI polish | ✅ Done | Enhanced Sidebar QualityBar with SVG circular gauge + grade letter. Created reusable `LoadingSkeleton` components (ChatMessage, Card, Table, Stats). |
| **Phase 9** | Failure modes | ✅ Done | Fixed critical provider health bug: `recordProviderHealth()` used `localStorage` but was called server-side (silently no-op). Migrated to client-side recording — server returns `_health` metadata in response body (sync) and SSE chunks (streaming). Fixed `latencyMs` bug (was `Date.now() - Date.now()` = always 0). Added health recording to streaming handler. Created `api-key-validation.ts` for live key testing. Added `OfflineBanner` with `navigator.onLine` detection. Added 26 unit tests in `provider-health.test.ts` (1,428 total tests across 83 files). |
| **Phase 10** | Release readiness | 🟡 In Progress | CSP hardened: `upgrade-insecure-requests` directive. Accessibility: `SkipNav` component (WCAG 2.1 AA), `#main-content` target. Remaining: performance audit (bundle size, lazy loading), SEO audit (Lighthouse ≥90), production CSP live testing |

---

## 15. File Map (Key Files)

| Path | Purpose |
|------|---------|
| `src/lib/system-prompt.ts` | All AI prompts (12 agents + quality scoring + memory extraction) |
| `src/lib/ai-constants.ts` | Model pricing, failover order, cost calculation |
| `src/lib/model-selector.ts` | Provider/model selection logic |
| `src/lib/router.ts` | NeverStopRouter — smart routing + failover |
| `src/app/api/ai/chat/route.ts` | Server-side AI proxy (keys never leave server, health metadata returned to client) |
| `src/lib/provider-health.test.ts` | 26 unit tests: storage, server-side regression guard, stats, status thresholds |
| `src/lib/encryption.ts` | Shared AES-256-CBC encryption for API keys |
| `src/lib/rate-limit.ts` | Rate limiting (in-memory + Upstash) |
| `src/lib/csrf.ts` | CSRF token generation + validation |
| `src/lib/hallucination-guard.ts` | Hallucination detection + quality gating |
| `src/lib/quality.ts` | Quality scoring engine |
| `src/lib/memory.ts` | Agent memory management |
| `src/lib/rag.ts` | Document chunking + retrieval |
| `src/lib/supabase/` | Supabase client, server, hooks, middleware, validation |
| `src/middleware.ts` | Root middleware (auth, CSRF, session refresh) |
| `src/data/domains.ts` | 40 agency service domains |
| `src/data/prompts.ts` | 55+ pre-built prompts |
| `src/types/index.ts` | All TypeScript type definitions |
| `src/lib/feedback-bridge.ts` | Connects hallucination-guard ↔ self-training ↔ model-selector |
| `src/lib/api-key-validation.ts` | Live API key validation via server proxy |
| `src/lib/provider-health.ts` | Provider health monitoring (latency, uptime, error rates) |
| `src/components/oracle/ProviderHealthPanel.tsx` | Provider health dashboard (per-provider stats, uptime, latency) |
| `src/components/oracle/agent-config.ts` | Agent constants, labels, types, system prompts |
| `src/components/oracle/ChatHeader.tsx` | Conversation/project/agent selectors |
| `src/components/oracle/MessageBubble.tsx` | Message rendering with ConfidenceBadge |
| `src/components/oracle/ChatInputArea.tsx` | Input area with agent badge, attachments, cost estimate |
| `src/components/oracle/EmptyState.tsx` | Empty state with quick start cards |
| `src/components/oracle/MarkdownComponents.tsx` | ReactMarkdown custom renderers |
| `src/components/oracle/LoadingSkeleton.tsx` | Reusable skeleton components (Chat, Card, Table, Stats) |
| `src/components/oracle/OfflineBanner.tsx` | Offline detection banner (navigator.onLine) |
| `src/components/oracle/SkipNav.tsx` | WCAG 2.1 AA skip navigation component |
| `src/components/oracle/` | 70+ UI components |
| `src/app/api/` | 20+ API route handlers |

---

*This document is the canonical source of truth for the ORACLE product. Update it when features change, new domains are added, or architecture evolves.*
