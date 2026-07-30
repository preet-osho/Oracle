/**
 * Tests for the ESLint rule: no-raw-fetch
 *
 * Uses ESLint's RuleTester to verify the rule correctly:
 * - Flags raw fetch() calls
 * - Allows fetchWithTimeout() calls
 * - Allows fetch inside import declarations
 * - Allows non-fetch identifiers and member expressions
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { RuleTester } = require('eslint');
const rule = require('./no-raw-fetch.js');

// ESLint 9+ flat config format
const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-raw-fetch', rule, {
  valid: [
    // ── fetchWithTimeout is allowed ──
    {
      code: `fetchWithTimeout(url, { timeoutMs: TIMEOUT_QUICK_MS })`,
    },
    {
      code: `fetchWithTimeout('/api/test', { method: 'POST' })`,
    },
    {
      code: `await fetchWithTimeout('/api/ai/chat', { timeoutMs: TIMEOUT_STANDARD_MS })`,
    },

    // ── Non-fetch identifiers are allowed ──
    {
      code: `axios.get(url)`,
    },
    {
      code: `myCustomFetch(url)`,
    },
    {
      code: `window.fetchSomething()`,
    },

    // ── Member expression calls (obj.fetch) are allowed ──
    {
      code: `obj.fetch(url)`,
    },
    {
      code: `this.fetch(url)`,
    },
    {
      code: `service.fetch(url)`,
    },
    {
      code: `globalThis.fetch(url)`,
    },

    // ── Import declarations are allowed ──
    {
      code: `import { fetch } from 'undici'`,
    },

    // ── No fetch calls at all ──
    {
      code: `const x = 42`,
    },
    {
      code: `console.log('hello')`,
    },

    // ── fetchWithTimeout with all tier constants ──
    {
      code: `fetchWithTimeout(url, { timeoutMs: TIMEOUT_MODERATE_MS })`,
    },
    {
      code: `fetchWithTimeout(url, { timeoutMs: TIMEOUT_STREAMING_MS })`,
    },
  ],

  invalid: [
    // ── Basic raw fetch() ──
    {
      code: `fetch(url)`,
      errors: [{ messageId: 'noRawFetch' }],
    },
    {
      code: `await fetch(url)`,
      errors: [{ messageId: 'noRawFetch' }],
    },

    // ── fetch with options ──
    {
      code: `fetch(url, { method: 'POST' })`,
      errors: [{ messageId: 'noRawFetch' }],
    },
    {
      code: `fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } })`,
      errors: [{ messageId: 'noRawFetch' }],
    },

    // ── fetch with string URL ──
    {
      code: `fetch('https://api.example.com/data')`,
      errors: [{ messageId: 'noRawFetch' }],
    },
    {
      code: `fetch('/api/test')`,
      errors: [{ messageId: 'noRawFetch' }],
    },

    // ── fetch with template literal URL ──
    {
      code: 'fetch(`/api/test/${id}`)',
      errors: [{ messageId: 'noRawFetch' }],
    },

    // ── Multiple raw fetch calls ──
    {
      code: `
        fetch(url1);
        fetch(url2);
      `,
      errors: [
        { messageId: 'noRawFetch' },
        { messageId: 'noRawFetch' },
      ],
    },

    // ── Realistic pattern — should be fetchWithTimeout ──
    {
      code: `await fetch('/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages }) })`,
      errors: [{ messageId: 'noRawFetch' }],
    },

    // ── fetch with AbortSignal.timeout (old pattern) ──
    {
      code: `await fetch(url, { signal: AbortSignal.timeout(3000) })`,
      errors: [{ messageId: 'noRawFetch' }],
    },

    // ── Promise.all with fetch ──
    {
      code: `const [a, b] = await Promise.all([fetch(url1), fetch(url2)])`,
      errors: [
        { messageId: 'noRawFetch' },
        { messageId: 'noRawFetch' },
      ],
    },

    // ── fetch in .then() chain ──
    {
      code: `fetch(url).then(r => r.json())`,
      errors: [{ messageId: 'noRawFetch' }],
    },

    // ── fetch with signal from AbortController ──
    {
      code: `fetch(url, { signal: controller.signal })`,
      errors: [{ messageId: 'noRawFetch' }],
    },

    // ── fetch result assigned to variable ──
    {
      code: `const result = fetch(url)`,
      errors: [{ messageId: 'noRawFetch' }],
    },
    {
      code: `const data = await fetch(url)`,
      errors: [{ messageId: 'noRawFetch' }],
    },
  ],
});
