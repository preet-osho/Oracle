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
# Run all tests
npx vitest run

# Run a specific project
npx vitest run --project oracle
npx vitest run --project lib

# Run a single test file
npx vitest run src/components/oracle/ChatPanel.test.tsx
```

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
