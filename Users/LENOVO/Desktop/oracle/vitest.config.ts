import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// ── Test Architecture ──
// Two vitest projects with scoped setup files (setupFiles are merged, not overridden):
//   oracle — src/setupTests.ts (global) + src/components/oracle/test-setup.ts (framer-motion, design-tokens)
//   lib    — src/setupTests.ts (global only)
// Both inherit plugins and resolve.alias from root via extends: true (inherits root plugins, alias, env).
// Shared test helpers (createStreamingChunks, streamFromChunks) live in test-utils.ts.
// See README.md § Testing for the full diagram.

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 30000,
    teardownTimeout: 5000,
    setupFiles: ['src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts', 'src/components/**/*.tsx'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'oracle',
          include: ['src/components/oracle/**/*.test.{ts,tsx}'],
          setupFiles: ['src/components/oracle/test-setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'lib',
          include: ['src/lib/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'api',
          include: ['src/app/api/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'data',
          include: ['src/data/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          include: ['src/components/ui/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
