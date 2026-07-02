# Contributing to ORACLE

> Guidelines for contributing to the ORACLE project — an AI-powered operating system for digital agencies.

---

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Testing Strategy](#testing-strategy)
  - [Philosophy](#philosophy)
  - [Test Types](#test-types)
  - [Running Tests](#running-tests)
  - [Writing New Tests](#writing-new-tests)
  - [Mocking Patterns](#mocking-patterns)
  - [Coverage Expectations](#coverage-expectations)
  - [Common Pitfalls](#common-pitfalls)
- [Code Style](#code-style)
- [Fetch Timeout Tiers](#fetch-timeout-tiers)
  - [ESLint Rules](#eslint-rules)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)

---

## Development Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Type check
npx tsc --noEmit

# Run all tests
npx vitest run

# Run tests with coverage
npx vitest run --coverage

# Run a specific test file
npx vitest run src/lib/encryption.test.ts

# Run tests in watch mode
npx vitest
```

---

## Project Structure

```
oracle/
├── src/
│   ├── app/                    # Next.js App Router pages + API routes
│   ├── components/
│   │   ├── oracle/            # Main app components (ChatPanel, Sidebar, etc.)
│   │   │   ├── test-setup.ts  # Component-specific test setup (framer-motion mock)
│   │   │   ├── test-utils.ts  # Shared test helpers (streaming, etc.)
│   │   │   └── *.test.tsx     # Component tests
│   │   └── ui/                # Reusable UI primitives (shadcn/ui)
│   ├── lib/                   # Business logic, utilities, integrations
│   │   ├── *.test.ts          # Library unit tests
│   │   └── supabase/          # Supabase client, server, hooks, middleware
│   ├── stores/                # Zustand state management
│   ├── data/                  # Static data (domains, prompts, providers)
│   ├── styles/                # Design tokens
│   └── types/                 # TypeScript type definitions
├── supabase/
│   └── migrations/            # Database migrations
├── vitest.config.ts           # Test configuration (two projects: oracle + lib)
└── package.json
```

---

## Testing Strategy

### Philosophy

ORACLE follows a **quality-first testing approach** where every test must verify *actual behavior*, not just verify that code runs. Tests should:

1. **Test real outputs** — verify actual CSV content, HTML structure, markdown formatting, not just "no errors thrown"
2. **Cover edge cases** — empty inputs, malformed data, boundary conditions, concurrent access
3. **Isolate side effects** — mock external services (Supabase, AI providers, filesystem) but test pure logic exhaustively
4. **Be deterministic** — no flaky tests, no timing dependencies, no random data

### Test Types

| Type | Location | Framework | Purpose |
|------|----------|-----------|---------|
| **Unit tests** | `src/lib/*.test.ts` | Vitest | Pure functions, calculations, business logic |
| **Component tests** | `src/components/oracle/*.test.tsx` | Vitest + React Testing Library | UI rendering, user interactions, state changes |
| **Integration tests** | Mixed | Vitest | Multi-module workflows (e.g., rate limiting → response) |

### Running Tests

```bash
# Run all tests
npx vitest run

# Run with coverage report
npx vitest run --coverage

# Run a specific project
npx vitest run --project lib        # Library tests only
npx vitest run --project oracle     # Component tests only

# Run a single file
npx vitest run src/lib/encryption.test.ts

# Run in watch mode (re-runs on file change)
npx vitest

# Run tests matching a pattern
npx vitest run -t "encrypts and decrypts"
```

### Writing New Tests

#### Creating a New Test File

1. **Co-locate tests with source**: `src/lib/foo.ts` → `src/lib/foo.test.ts`
2. **Use the `.test.ts` / `.test.tsx` extension** (Vitest auto-discovers these)
3. **No additional setup needed for lib tests** — just create the file
4. **For component tests** — framer-motion and design-tokens are mocked automatically via `test-setup.ts`

#### Test File Template

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { myFunction } from './my-module';

describe('myFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does something expected', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });

  it('handles edge case', () => {
    expect(() => myFunction(null)).toThrow('Expected error message');
  });
});
```

#### Naming Conventions

- **File**: `<module-name>.test.ts` (e.g., `encryption.test.ts`)
- **Describe block**: module name or function name (e.g., `describe('encrypt', ...)`)
- **Test cases**: lowercase, descriptive, start with action (e.g., `it('encrypts and decrypts a simple string', ...)`)
- **Group related tests**: use nested `describe` blocks for different function groups or scenarios

### Mocking Patterns

#### Mocking External Services (Supabase)

```typescript
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

// In tests:
expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
  user_id: 'user-123',
}));
```

#### Mocking Browser APIs (Blob, URL, localStorage)

```typescript
// Capture Blob content for download verification
let capturedBlob: Blob | null = null;
vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
  capturedBlob = blob as Blob;
  return 'blob:mock-url';
});

// Later in test:
const content = await capturedBlob!.text();
expect(content).toContain('expected,csv,data');
```

#### Environment Variables (Module-Level Consts)

When a module captures `process.env` at the top level (e.g., `const KEY = process.env.MY_KEY`), you must set the env var **before** the import. Use `vi.hoisted()`:

```typescript
const { TEST_KEY } = vi.hoisted(() => {
  process.env.MY_SECRET_KEY = 'test-key-12345678901234567890';
  return { TEST_KEY: 'test-key-12345678901234567890' };
});

import { myFunction } from './my-module';
```

#### Mocking with `vi.resetModules()`

For testing different configurations of a module:

```typescript
it('works with different config', async () => {
  vi.resetModules();
  process.env.MY_CONFIG = 'alternate';
  const { myFunction } = await import('./my-module');
  // ...test alternate config
});
```

#### Mocking Date/Time

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-21T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});
```

### Coverage Expectations

The project targets the following coverage thresholds per file:

| Category | Target | Notes |
|----------|--------|-------|
| **Pure logic files** (calculations, formatters, validators) | **100% line coverage** | encryption, profitability, csrf, token-budget |
| **Service modules** (with external deps) | **≥80% line coverage** | Testable logic mocked; Supabase calls verified via mocks |
| **UI components** | **≥60% line coverage** | Focus on user-facing behavior, not internal state |
| **Supabase-dependent modules** | Best effort | Mock Supabase client; test validation/transformation logic |

#### Current High-Coverage Modules

| Module | Line% | Strategy |
|--------|-------|----------|
| `csrf.ts` | 100% | Pure crypto functions, easily testable |
| `logger.ts` | 100% | Mock console methods, verify output format |
| `profitability.ts` | 100% | Pure calculation functions |
| `token-budget.ts` | 100% | Pure arithmetic + thresholds |
| `encryption.ts` | 85% | AES-256-CBC round-trip with env var setup |
| `rate-limit.ts` | 60% | In-memory fallback tested; Upstash mocked |

#### Running Coverage

```bash
# Full coverage report
npx vitest run --coverage

# Coverage for a specific directory
npx vitest run --coverage src/lib/
```

### Common Pitfalls

#### 1. Module-Level Environment Variables

**Problem**: Module captures `process.env` at import time; setting it in `beforeEach` is too late.

**Solution**: Use `vi.hoisted()` to set env vars before imports:

```typescript
vi.hoisted(() => {
  process.env.API_KEY = 'test-key-12345678901234567890';
});
```

#### 2. Multiple Spies on Same Method

**Problem**: Creating two `vi.spyOn(console, 'info')` in parallel tests conflicts.

**Solution**: Use a single spy per test, or use `vi.clearAllMocks()` in `beforeEach`.

#### 3. Vitest Hoists `import` Above Code

**Problem**: Even if you write `process.env.X = 'y'` before `import`, Vitest moves the import to the top.

**Solution**: Always use `vi.hoisted()` for env vars that must be set before module load.

#### 4. Blob Content Verification

**Problem**: `URL.createObjectURL(blob)` returns a string URL, not the content.

**Solution**: Spy on `URL.createObjectURL`, capture the Blob, then read via `blob.text()`:

```typescript
let capturedBlob: Blob | null = null;
vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
  capturedBlob = b as Blob;
  return 'blob:mock';
});
// ... call export function ...
const content = await capturedBlob!.text();
```

#### 5. Testing Supabase-Dependent Code

**Problem**: Functions that call `supabase.from('table')` fail without a real database.

**Solution**: Mock the entire Supabase chain:

```typescript
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));
```

---

## Code Style

- **TypeScript strict mode** — no `any` types in production code
- **Functional components** with hooks (no class components)
- **Tailwind CSS** for styling — no CSS modules or styled-components
- **Zod schemas** for all input validation
- **Named exports** preferred over default exports
- **Async/await** over raw Promises

---

## Fetch Timeout Tiers

All network requests must use `fetchWithTimeout` from `@/lib/fetch-utils` with a named tier constant. Raw `timeoutMs` number literals are flagged by the ESLint rule `custom/no-raw-timeout-ms` (set to `warn`).

### Tier Constants

| Constant | Value | Use When |
|----------|-------|----------|
| `TIMEOUT_QUICK_MS` | 15s | Validation pings, key checks, lightweight internal `/api/*` endpoints |
| `TIMEOUT_MODERATE_MS` | 30s | External third-party APIs (Tavily, Serper, OpenAI embeddings, reindex) |
| `TIMEOUT_STANDARD_MS` | 60s | AI provider sync (non-streaming) generation calls |
| `TIMEOUT_STREAMING_MS` | 120s | AI provider streaming generation calls |

`FETCH_TIMEOUT_MS` aliases `TIMEOUT_QUICK_MS` (15s) — used as the default when no `timeoutMs` is passed.

### How to Add a New Callsite

```typescript
import { fetchWithTimeout, TIMEOUT_MODERATE_MS } from '@/lib/fetch-utils';

// ✅ Correct — named tier constant
const res = await fetchWithTimeout('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
  timeoutMs: TIMEOUT_MODERATE_MS,
});

// ❌ Wrong — raw number literal (ESLint will warn)
const res = await fetchWithTimeout('https://api.example.com/data', {
  timeoutMs: 30_000,
});
```

### Choosing the Right Tier

1. **Internal `/api/*` endpoint** → `TIMEOUT_QUICK_MS` (15s) — server-side proxies should respond quickly
2. **External third-party API** → `TIMEOUT_MODERATE_MS` (30s) — account for network variability
3. **AI provider sync** → `TIMEOUT_STANDARD_MS` (60s) — non-streaming generation needs time
4. **AI provider streaming** → `TIMEOUT_STREAMING_MS` (120s) — safety net; timer clears once SSE headers arrive

### Updating the Audit

After adding a new callsite, update `TIMEOUT_POLICY.md` with a new row in the appropriate section and increment the summary statistics.

### ESLint Rules

Two custom ESLint rules enforce fetch timeout conventions:

#### `custom/no-raw-timeout-ms`

Flags raw `timeoutMs` number literals (e.g., `30_000`). All timeouts must use named tier constants.

```typescript
// ❌ ESLint warning — raw number literal
const res = await fetchWithTimeout(url, { timeoutMs: 30_000 });

// ✅ Correct — named tier constant
const res = await fetchWithTimeout(url, { timeoutMs: TIMEOUT_MODERATE_MS });
```

#### `custom/no-raw-fetch`

Flags raw `fetch()` calls and enforces using `fetchWithTimeout` from `@/lib/fetch-utils`. This ensures every network request has proper timeout protection via the tier constant system.

```typescript
// ❌ ESLint warning — raw fetch() call
const res = await fetch('https://api.example.com/data', { method: 'POST' });

// ✅ Correct — fetchWithTimeout with tier constant
const res = await fetchWithTimeout('https://api.example.com/data', {
  method: 'POST',
  timeoutMs: TIMEOUT_MODERATE_MS,
});
```

**What gets flagged:**
- `fetch(url)` — standalone calls
- `fetch(url, opts)` — calls with options
- `const res = fetch(url)` — assigned results
- `Promise.all([fetch(a), fetch(b)])` — parallel calls
- `fetch(url).then(...)` — chained calls

**What is allowed:**
- `fetchWithTimeout(url, { timeoutMs: TIMEOUT_QUICK_MS })` — the correct pattern
- `obj.fetch(url)` — member expressions (e.g., Supabase client)
- `import { fetch } from '...'` — import declarations
- Test files — disabled via ESLint config override

Both rules are set to `warn` level for `src/**/*.ts(x)` and disabled in test files. See `eslint/rules/` for implementations and `eslint/rules/*.test.js` for test suites.

---

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `test` — adding or updating tests
- `docs` — documentation changes
- `refactor` — code restructuring without behavior change
- `chore` — maintenance tasks

**Examples:**
```
test: add encryption.test.ts (25 tests) — AES-256-CBC round-trip, key handling
fix: move provider health recording from server to client side
feat: Phase 10 — CSP production hardening, release readiness
```

---

## Pull Request Process

1. **Create a feature branch** from `master`
2. **Write tests** for any new functionality
3. **Ensure all tests pass**: `npx vitest run`
4. **Type check**: `npx tsc --noEmit`
5. **Update PRODUCT_TRUTH.md** if adding/changing features
6. **Submit PR** with clear description of changes

---

## Test File Inventory

### Library Tests (`src/lib/`)

| File | Tests | Coverage |
|------|-------|----------|
| `permissions.test.ts` | 170 | 98% |
| `csrf.test.ts` | 38 | 100% |
| `encryption.test.ts` | 25 | 85% |
| `profitability.test.ts` | 42 | 100% |
| `audit-log.test.ts` | 15 | 100% |
| `token-budget.test.ts` | 24 | 100% |
| `rate-limit.test.ts` | 36 | 60% |
| `logger.test.ts` | 27 | 100% |
| `progress-tracker.test.ts` | 35 | 100% |
| `deadline-tracker.test.ts` | 40 | 93% |
| `feedback-bridge.test.ts` | 26 | 97% |
| `export-utils.test.ts` | 54 | 82% |
| `contracts.test.ts` | 51 | 82% |
| `subscription.test.ts` | 90 | 100% |
| `annual-revenue-report.test.ts` | 30 | 100% |
| `monthly-intelligence-report.test.ts` | 35 | 95% |

### Component Tests (`src/components/oracle/`)

| File | Tests |
|------|-------|
| `FeatureGate.test.tsx` | 60 |
| `ChatPanel.test.tsx` | Various |
| `Sidebar.test.tsx` | Various |
| `WorkflowsTab.test.tsx` | Various |
| `TestCasesTab.test.tsx` | Various |

---

*This document reflects the testing strategy established during the June 2026 coverage improvement session. Update it as patterns evolve.*
