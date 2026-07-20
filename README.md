# ORACLE — Universal Agency Intelligence

> The ultimate AI-powered agency assistant with 40+ service domains, 55+ prompts, 10 AI providers, and smart routing.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to see ORACLE.

## 🎯 Features

### Core
- **Multi-Provider AI Router** — BYOK (Bring Your Own Key) support for 10 AI providers
- **Smart Routing** — Auto-selects the best model for each task type
- **Streaming Responses** — Real-time token-by-token AI responses
- **Cost Tracking** — Monitor spending across all providers in INR

### Agency Tools
- **39 Specialist Agents** — Complete multi-agent workforce across 15 categories (see [AGENTS.md](AGENTS.md))
- **40+ Service Domains** — Complete expertise across digital marketing, development, finance, and industry verticals
- **55+ Pre-built Prompts** — Ready-to-use prompts for any agency task
- **6 Automated Workflows** — Multi-step processes from strategy to execution
- **8 Client Test Cases** — Real scenarios to test ORACLE's capabilities

### Project Management
- **Client Projects** — Manage projects, contacts, and requirements
- **Time Tracking** — Log hours with manual entry or live timer
- **Invoice Generation** — Create GST-compliant invoices automatically

### Knowledge & Memory
- **RAG Documents** — Upload and query your knowledge base
- **Per-Client Memory** — Remember client preferences and history
- **Web Search** — Real-time research via Tavily/Serper APIs

### Intelligence
- **Quality Scoring** — Rate responses on completeness, specificity, and actionability
- **Multi-Agent Orchestration** — Decompose complex tasks across specialist agents
- **Roadmap Generation** — Create comprehensive client proposals with AI

### Indian Market Intelligence (Q3 2026)
- **WhatsApp Business API** — BSP cost comparison, compliance warnings, INR migration tracking
- **GST/TDS Compliance** — Invoice date compliance, TDS deduction tracking, tax calculations
- **CRM Cost Analysis** — HubSpot scaling warnings, Zoho fragmentation detection, Custom CRM ROI
- **Vernacular Content** — Hindi/Tamil/Bengali tone guidance, Tier-2/3 city budget recommendations
- **Agency Positioning** — AI commoditization defense, human polish pipeline, value framing

## 🔑 API Keys (BYOK)

ORACLE supports 10 AI providers with free tiers:

| Provider | Free Tier | Sign Up |
|----------|-----------|---------|
| Groq | 14,400 req/day | [console.groq.com](https://console.groq.com) |
| Google AI | 1M tokens/day | [aistudio.google.com](https://aistudio.google.com) |
| Cerebras | 600 req/min | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| OpenRouter | 200+ free models | [openrouter.ai](https://openrouter.ai) |
| Together AI | $25 credit | [api.together.ai](https://api.together.ai) |
| Mistral AI | Rate-limited free | [console.mistral.ai](https://console.mistral.ai) |
| Cohere | 1000 calls/month | [dashboard.cohere.com](https://dashboard.cohere.com) |
| Perplexity | $5 credit | [perplexity.ai](https://perplexity.ai) |
| OpenAI | $5 credit | [platform.openai.com](https://platform.openai.com) |
| Anthropic | $5 credit | [console.anthropic.com](https://console.anthropic.com) |

Get your API key in Settings → API Keys.

## 🏗️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** React 18, Tailwind CSS, Framer Motion
- **State:** Zustand with persistence
- **AI:** Multi-provider routing (OpenAI, Anthropic, Groq, Google, etc.)
- **Components:** Radix UI, shadcn/ui patterns
- **Markdown:** react-markdown, rehype-highlight, remark-gfm

## 📁 Project Structure

```
oracle/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Home page
│   │   ├── layout.tsx         # Root layout
│   │   ├── error.tsx          # Global error boundary
│   │   ├── loading.tsx        # Loading state
│   │   └── not-found.tsx      # 404 page
│   ├── components/
│   │   ├── oracle/            # Main app components
│   │   │   ├── AppShell.tsx   # Root app shell
│   │   │   ├── ChatPanel.tsx  # AI chat interface
│   │   │   ├── Sidebar.tsx    # Quick actions & settings
│   │   │   ├── Header.tsx     # Navigation & controls
│   │   │   ├── CommandPalette.tsx
│   │   │   ├── ConfigTab.tsx  # Settings & API keys
│   │   │   ├── PromptsTab.tsx # Prompt library
│   │   │   ├── TestCasesTab.tsx
│   │   │   ├── WorkflowsTab.tsx
│   │   │   ├── ProjectsTab.tsx
│   │   │   └── RoadmapTab.tsx
│   │   └── ui/                # Reusable UI components
│   ├── lib/
│   │   ├── router.ts          # NeverStopRouter engine
│   │   ├── system-prompt.ts   # AI system prompts
│   │   ├── memory.ts          # Per-client memory
│   │   ├── rag.ts             # RAG & document processing
│   │   ├── q3-scenarios.ts    # Q3 Indian market intelligence (17 functions)
│   │   └── utils.ts           # Utility functions
│   ├── stores/
│   │   └── router.store.ts    # Zustand state store
│   ├── data/
│   │   ├── domains.ts         # 40 agency domains
│   │   ├── prompts.ts         # 55+ prompts
│   │   ├── providers.ts       # 10 AI providers
│   │   └── test-cases.ts      # 8 test scenarios
│   ├── styles/
│   │   └── design-tokens.ts   # Design system tokens
│   └── types/
│       └── index.ts           # TypeScript types
├── AGENTS.md                 # All 39 agents: categories, descriptions, use cases
├── public/                    # Static assets
├── middleware.ts              # Security headers & CSP
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 🎨 Design System

ORACLE uses a comprehensive design system with:

- **CSS Variables** for theming (light/dark mode)
- **Design Tokens** for colors, typography, spacing, shadows
- **Motion Variants** for consistent animations
- **Accessibility** focus rings, ARIA labels, keyboard navigation

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + K` | Open command palette |
| `⌘/Ctrl + J` | Focus chat input |
| `⌘/Ctrl + /` | Show keyboard shortcuts |
| `Esc` | Close modals |

## 🧪 Testing

```bash
# Run all tests (3,023 tests across 125 files)
npx vitest run

# Run Q3 Indian market intelligence tests (115 tests)
npx vitest run src/lib/q3-scenarios.test.ts

# Run a specific project
npx vitest run --project oracle
npx vitest run --project lib

# Run a single test file
npx vitest run src/components/oracle/ChatPanel.test.tsx
```

### Priority-Based Test Runner

ORACLE uses a priority-based test runner (`scripts/run-by-priority.ts`) that executes tests by risk level. Each test file is mapped to one of 6 priority tiers based on its impact on security, compliance, and business logic.

#### Priority Tiers

| Tier | Risk Level | Description | Example Files |
|------|-----------|-------------|---------------|
| **P1** | 🔴 Critical | Security, compliance, data integrity | `encryption.test.ts`, `permissions.test.ts`, `domain-compliance.test.ts` |
| **P2** | 🟠 High | AI quality assurance, business logic | `hallucination-guard.test.ts`, `quality.test.ts`, `razorpay.test.ts` |
| **P3** | 🟡 Medium | Knowledge, memory, intelligence | `memory.test.ts`, `rag.test.ts`, `self-training.test.ts` |
| **P4** | 🟢 Low | Export, UI helpers, utilities | `export-utils.test.ts`, `logger.test.ts`, `audit-log.test.ts` |
| **P5** | 🔵 Backlog | API, data, UI components | `api.test.ts`, `search-helpers.test.ts` |
| **P6** | ⚪ Nice-to-Have | Component tests | `src/components/**/*.test.tsx` |

#### Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests with vitest |
| `npm run test:all` | Run all priority tiers sequentially with combined summary |
| `npm run test:priority` | Run all priority tiers sequentially (alias) |
| `npm run test:p1` | Run only P1 critical tests |
| `npm run test:p2` | Run only P2 high-risk tests |
| `npm run test:p3` | Run only P3 medium-risk tests |
| `npm run test:p4` | Run only P4 low-risk tests |
| `npm run test:quick` | Run P1 tests with fail-fast (fastest feedback) |
| `npm run test:since` | Run tests for files changed in last commit |
| `npm run test:ci` | Auto-detect base branch from CI env vars |
| `npm run test:coverage` | Run all tiers with per-tier coverage metrics |
| `npm run test:watch` | Watch all tests (vitest interactive mode) |
| `npm run test:watch:p1` | Watch only P1 critical tests |
| `npm run test:watch:since` | Watch only tests affected by recent changes |

#### Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--fail-fast` | `-b` | Stop on first test failure |
| `--coverage` | `-c` | Collect per-tier coverage metrics |
| `--watch` | `-w` | Interactive watch mode (re-runs on file changes) |
| `--since <ref>` | | Only run tests for files changed since ref |
| `--changed-since-ci` | `--ci` | Auto-detect base branch from CI environment variables |

#### Incremental Mode (`--since`)

Run only the tests affected by recent changes:

```bash
# Since last commit
npm run test:since

# Since specific commit count
npx tsx scripts/run-by-priority.ts --since 3

# Since uncommitted changes
npx tsx scripts/run-by-priority.ts --since HEAD

# Since staged changes only
npx tsx scripts/run-by-priority.ts --since STAGED

# Since a branch
npx tsx scripts/run-by-priority.ts --since origin/main

# Combine with priority tier
npx tsx scripts/run-by-priority.ts --since P1
```

#### CI Auto-Detection (`--changed-since-ci`)

In CI environments, the runner automatically detects the base branch from environment variables:

| CI Provider | Environment Variable |
|-------------|---------------------|
| GitHub Actions | `GITHUB_BASE_REF` |
| GitLab CI | `CI_MERGE_REQUEST_TARGET_BRANCH_NAME` |
| Bitbucket | `BITBUCKET_PR_DESTINATION_BRANCH` |
| Azure DevOps | `SYSTEM_PULLREQUEST_TARGETBRANCH` |
| Generic CI | `CI_BASE_BRANCH` or `BASE_BRANCH` |

```bash
# In GitHub Actions workflow
npx tsx scripts/run-by-priority.ts --changed-since-ci

# Or using the npm script
npm run test:ci
```

#### Coverage by Priority Tier

```bash
# Run coverage across all tiers
npm run test:coverage

# Coverage output includes:
# - Per-tier table (lines, branches, functions, statements)
# - Average across tiers
# - Color-coded status (🟢 ≥80%, 🟡 ≥60%, 🔴 <60%)
# - JSON summary at coverage-priority/coverage-summary.json
```

#### CI Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs tests in 4 chained stages:

1. **Quick-fail gate** — typecheck + lint + P1 run in parallel
2. **P2 high-risk** — runs after P1 passes
3. **P3 medium-risk** — runs after P2 passes
4. **P4-P6 low-risk** — runs after P3 passes
5. **Coverage report** — runs after all tiers, posts to PR

If P1 fails, downstream jobs are skipped to save CI time.

### Test Architecture

The test suite is split into two [vitest projects](https://vitest.dev/guide/projects) with shared and scoped setup:

```
src/
├── setupTests.ts                  # Global setup — loaded by all tests
│                                   #   localStorage, fetch, ResizeObserver,
│                                   #   scrollIntoView, clipboard mocks
│                                   #   + beforeEach cleanup
├── components/oracle/
│   ├── test-setup.ts              # Oracle-only setup — merged with global
│   │                               #   framer-motion & design-tokens mocks
│   ├── test-utils.ts              # Shared helpers for streaming tests
│   │                               #   createStreamingChunks, streamFromChunks
│   ├── *.test.tsx                 # Oracle component tests
│   └── ...
└── lib/
    └── *.test.ts                  # Library tests (no UI mocks needed)
```

**How setup merging works:** vitest merges `setupFiles` from the root config and each project. Oracle tests receive both `setupTests.ts` (global) and `test-setup.ts` (component-specific), while lib tests receive only `setupTests.ts`. The `extends: true` flag on each project ensures plugins and path aliases are inherited from the root config.

**Adding new tests:**
- Lib tests — just create `*.test.ts` in `src/lib/`; no additional setup needed.
- Oracle tests — create `*.test.tsx` in `src/components/oracle/`; framer-motion and design-tokens are mocked automatically.
- If an oracle test needs extra design-token exports (e.g. `QUICK_START_CARDS`, `cardHoverProps`), add a `vi.mock('@/styles/design-tokens', ...)` override in the test file — it replaces the setup mock.
- For streaming tests, import `createStreamingChunks` and `streamFromChunks` from `./test-utils`.
- Q3 Indian market tests are in `src/lib/q3-scenarios.test.ts` — all 115 tests for 17 functions covering WhatsApp, GST/TDS, CRM, vernacular content, and agency positioning.

## 🪝 Git Hooks

Via [husky](https://typicode.github.io/husky/), two Git hooks enforce quality gates:

#### Pre-Commit Hook

Runs before every commit:

1. **ESLint** — catches style and code quality issues
2. **P1 critical tests** — security, compliance, and data integrity tests with fail-fast

#### Pre-Push Hook

Runs before `git push`:

- **All priority tiers** (`npm run test:all`) — runs P1 through P6 sequentially with a combined summary. This is slower but ensures nothing is broken before it reaches remote.

### Bypassing the Hooks

To skip hooks (e.g., for WIP commits or emergency fixes):

```bash
# Skip pre-commit hook for a single commit
git commit --no-verify -m "wip: temporary commit"

# Or the short form
git commit -n -m "wip: temporary commit"

# Skip pre-push hook
git push --no-verify

# Or the short form
git push -n
```

> **⚠️ Use `--no-verify` sparingly.** CI will still run the full test suite, so skipped checks will surface there. Run `npm run test:quick` or `npm run test:all` manually after using `--no-verify` to catch issues early.

## 🔧 Development

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Format
npx prettier --write .
```

## 📝 License

Private — All rights reserved.

## 📊 Q3 2026 Indian Market Intelligence

ORACLE includes 17 business logic functions for Indian agency operations, backed by 115 executable tests:

| Category | Functions | Tests |
|----------|-----------|-------|
| WhatsApp Business API | BSP cost comparison, compliance warnings, INR migration, template reclassification, API verification timeline, Green tick checklist | 48 |
| GST/TDS Compliance | Invoice date compliance, TDS deduction tracking | 14 |
| CRM Cost Analysis | HubSpot scaling warning, Zoho fragmentation detection, Custom CRM ROI | 16 |
| Payment Enforcement | Upfront payment policy with milestone enforcement | 6 |
| Indian Market Context | Tier-2/3 city budget recommendations, vernacular content guidance (Hindi/Tamil/Bengali) | 12 |
| Agency Positioning | AI-Native value framing, human polish pipeline, commodity differentiation | 19 |

**Key files:**
- `src/lib/q3-scenarios.ts` — All 17 functions with TypeScript interfaces
- `src/lib/q3-scenarios.test.ts` — 115 tests (all passing)
- `USER_COMPLAINT_TRACKER.md` — Maps 117 real-world complaints to test coverage
- `Q3_2026_USER_RESEARCH.md` — Research sources and scenario details
