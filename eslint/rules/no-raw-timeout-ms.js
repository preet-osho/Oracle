/**
 * ESLint rule: no-raw-timeout-ms
 *
 * Flags raw number literals assigned to the `timeoutMs` property in
 * fetchWithTimeout calls (and similar fetch-with-timeout patterns).
 * Enforces use of named tier constants from @/lib/fetch-utils:
 *   TIMEOUT_QUICK_MS     (15s)
 *   TIMEOUT_MODERATE_MS  (30s)
 *   TIMEOUT_STANDARD_MS  (60s)
 *   TIMEOUT_STREAMING_MS (120s)
 *
 * ✅ fetchWithTimeout(url, { timeoutMs: TIMEOUT_QUICK_MS })
 * ❌ fetchWithTimeout(url, { timeoutMs: 15_000 })
 */

const TIER_CONSTANTS = new Set([
  'TIMEOUT_QUICK_MS',
  'TIMEOUT_MODERATE_MS',
  'TIMEOUT_STANDARD_MS',
  'TIMEOUT_STREAMING_MS',
  'FETCH_TIMEOUT_MS', // also acceptable — aliases QUICK
]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow raw number literals for timeoutMs; use named tier constants',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noRawTimeout:
        'Raw number literal `{{value}}` for timeoutMs. Use a named tier constant: TIMEOUT_QUICK_MS (15s), TIMEOUT_MODERATE_MS (30s), TIMEOUT_STANDARD_MS (60s), or TIMEOUT_STREAMING_MS (120s).',
    },
    schema: [],
  },

  create(context) {
    return {
      // Match `timeoutMs: <number>` inside any object literal
      Property(node) {
        if (node.key.type !== 'Identifier' && node.key.type !== 'Literal') return;
        if (node.key.name !== 'timeoutMs' && node.key.value !== 'timeoutMs') return;

        const value = node.value;

        // Allow named constants
        if (value.type === 'Identifier' && TIER_CONSTANTS.has(value.name)) return;

        // Allow computed references (e.g. TIMEOUT_MS constant defined elsewhere)
        if (value.type === 'Identifier') return;

        // Flag raw number literals (15_000, 60000, etc.)
        if (value.type === 'Literal' && typeof value.value === 'number') {
          context.report({
            node: value,
            messageId: 'noRawTimeout',
            data: { value: String(value.value) },
          });
          return;
        }

        // Flag unary expressions like -1 or +1 (unlikely but defensive)
        if (value.type === 'UnaryExpression' && value.argument.type === 'Literal') {
          context.report({
            node: value,
            messageId: 'noRawTimeout',
            data: { value: context.sourceCode.getText(value) },
          });
        }
      },
    };
  },
};
