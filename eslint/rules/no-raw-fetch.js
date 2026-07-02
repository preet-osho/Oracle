/**
 * ESLint rule: no-raw-fetch
 *
 * Flags raw `fetch()` calls and enforces use of `fetchWithTimeout` from
 * @/lib/fetch-utils. This ensures all network requests have proper timeout
 * protection via the tier constant system.
 *
 * ✅ fetchWithTimeout(url, { timeoutMs: TIMEOUT_QUICK_MS })
 * ❌ fetch(url, { method: 'POST' })
 *
 * Exemptions:
 * - fetchWithTimeout calls (obviously)
 * - Test files (handled by eslint config override)
 * - Import statements
 * - Calls where the first argument is not a string/identifier (dynamic/catch-all)
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow raw fetch() calls; use fetchWithTimeout from @/lib/fetch-utils',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noRawFetch:
        'Raw `fetch()` call. Use `fetchWithTimeout` from `@/lib/fetch-utils` with a named tier constant (TIMEOUT_QUICK_MS, TIMEOUT_MODERATE_MS, TIMEOUT_STANDARD_MS, or TIMEOUT_STREAMING_MS).',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;

        // Only match `fetch(...)` calls — simple Identifier named "fetch"
        if (callee.type !== 'Identifier' || callee.name !== 'fetch') return;

        // Skip if this is inside an import declaration (parent check)
        let parent = node.parent;
        while (parent) {
          if (parent.type === 'ImportDeclaration') return;
          parent = parent.parent;
        }



        context.report({
          node: callee,
          messageId: 'noRawFetch',
        });
      },
    };
  },
};
