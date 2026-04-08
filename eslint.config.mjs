import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import securityPlugin from "eslint-plugin-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Curated security rules. We enable a focused subset of eslint-plugin-security
  // — the high-signal rules — and skip the noisy ones (object-injection,
  // non-literal-regexp, non-literal-fs-filename) that produce mostly false
  // positives in a typed Next.js + Supabase codebase.
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: { security: securityPlugin },
    rules: {
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-unsafe-regex": "warn",
      "security/detect-bidi-characters": "error",
      "security/detect-child-process": "error",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-non-literal-require": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
