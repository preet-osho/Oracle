import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import noRawTimeoutMs from "./eslint/rules/no-raw-timeout-ms.js";
import noRawFetch from "./eslint/rules/no-raw-fetch.js";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,

  // Production code: warn on noisy rules, ignore _ prefixed args/vars
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: {
      "custom": { rules: { "no-raw-timeout-ms": noRawTimeoutMs, "no-raw-fetch": noRawFetch } },
    },
    rules: {
      "custom/no-raw-timeout-ms": "warn",
      "custom/no-raw-fetch": "warn",
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
      "custom/no-raw-timeout-ms": "off",
      "custom/no-raw-fetch": "off",
    },
  },

  // Relaxed rules for scripts and config files
  {
    files: ["scripts/**/*.ts", "vitest.config.ts", "eslint.config.mjs"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
];

export default eslintConfig;
