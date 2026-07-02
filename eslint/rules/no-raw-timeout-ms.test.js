/**
 * Tests for the ESLint rule: no-raw-timeout-ms
 *
 * Uses ESLint's RuleTester to verify the rule correctly:
 * - Flags raw number literals for timeoutMs
 * - Allows named tier constants
 * - Allows any Identifier (computed references)
 * - Flags unary expressions
 */

const { RuleTester } = require('eslint');
const rule = require('./no-raw-timeout-ms.js');

// ESLint 9+ flat config format
const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-raw-timeout-ms', rule, {
  valid: [
    // ── Named tier constants ──
    {
      code: `fetchWithTimeout(url, { timeoutMs: TIMEOUT_QUICK_MS })`,
    },
    {
      code: `fetchWithTimeout(url, { timeoutMs: TIMEOUT_MODERATE_MS })`,
    },
    {
      code: `fetchWithTimeout(url, { timeoutMs: TIMEOUT_STANDARD_MS })`,
    },
    {
      code: `fetchWithTimeout(url, { timeoutMs: TIMEOUT_STREAMING_MS })`,
    },
    {
      code: `fetchWithTimeout(url, { timeoutMs: FETCH_TIMEOUT_MS })`,
    },

    // ── Any Identifier (computed references) ──
    {
      code: `fetchWithTimeout(url, { timeoutMs: MY_CUSTOM_TIMEOUT })`,
    },
    {
      code: `fetchWithTimeout(url, { timeoutMs: getTimeout() })`,
    },

    // ── String keys (should not trigger) ──
    {
      code: `fetchWithTimeout(url, { 'timeoutMs': TIMEOUT_QUICK_MS })`,
    },

    // ── Non-timeoutMs properties (should not trigger) ──
    {
      code: `fetchWithTimeout(url, { timeout: 5000 })`,
    },
    {
      code: `fetchWithTimeout(url, { timeoutMs: TIMEOUT_QUICK_MS, method: 'POST' })`,
    },

    // ── Object not inside a function call (should not trigger) ──
    {
      code: `const config = { timeoutMs: TIMEOUT_QUICK_MS }`,
    },

    // ── No timeoutMs property at all ──
    {
      code: `fetchWithTimeout(url, { method: 'GET', headers: {} })`,
    },

    // ── Nested object with timeoutMs (valid usage) ──
    {
      code: `fetchWithTimeout(url, { ...options, timeoutMs: TIMEOUT_STREAMING_MS })`,
    },
  ],

  invalid: [
    // ── Raw number literals ──
    {
      code: `fetchWithTimeout(url, { timeoutMs: 15000 })`,
      errors: [{ messageId: 'noRawTimeout', data: { value: '15000' } }],
    },
    {
      code: `fetchWithTimeout(url, { timeoutMs: 30_000 })`,
      errors: [{ messageId: 'noRawTimeout', data: { value: '30000' } }],
    },
    {
      code: `fetchWithTimeout(url, { timeoutMs: 60000 })`,
      errors: [{ messageId: 'noRawTimeout', data: { value: '60000' } }],
    },
    {
      code: `fetchWithTimeout(url, { timeoutMs: 120_000 })`,
      errors: [{ messageId: 'noRawTimeout', data: { value: '120000' } }],
    },

    // ── String key with raw number ──
    {
      code: `fetchWithTimeout(url, { 'timeoutMs': 5000 })`,
      errors: [{ messageId: 'noRawTimeout', data: { value: '5000' } }],
    },

    // ── Unary expressions ──
    {
      code: `fetchWithTimeout(url, { timeoutMs: -1 })`,
      errors: [{ messageId: 'noRawTimeout' }],
    },

    // ── Multiple violations in one call ──
    {
      code: `fetchWithTimeout(url, { timeoutMs: 15000, method: 'POST' })`,
      errors: [{ messageId: 'noRawTimeout', data: { value: '15000' } }],
    },

    // ── Multiple calls with violations ──
    {
      code: `
        fetchWithTimeout(url1, { timeoutMs: 15000 });
        fetchWithTimeout(url2, { timeoutMs: 30000 });
      `,
      errors: [
        { messageId: 'noRawTimeout', data: { value: '15000' } },
        { messageId: 'noRawTimeout', data: { value: '30000' } },
      ],
    },

    // ── Realistic bad pattern ──
    {
      code: `await fetchWithTimeout('/api/ai/chat', { method: 'POST', timeoutMs: 60000 })`,
      errors: [{ messageId: 'noRawTimeout', data: { value: '60000' } }],
    },
  ],
});
