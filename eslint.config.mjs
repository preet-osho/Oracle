import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,

  // Production code: warn on noisy rules, ignore _ prefixed args/vars
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  // Relaxed rules for test files (must come AFTER source rules to override)
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test-setup.ts", "**/test-utils.ts", "**/test-utils.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },

  // Relaxed rules for scripts and config files
  {
    files: ["scripts/**/*.ts", "vitest.config.ts", "eslint.config.mjs"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];

export default eslintConfig;
