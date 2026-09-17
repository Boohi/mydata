import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.tauri/**",
      "**/target/**",
      "**/.build/**",
      "apps/ui/src-tauri/target/**",
      // Portable shared source is authenticated by the context portability check.
      "skills/**",
      ".agents/skills/**",
      ".claude/skills/**",
      ".opencode/skills/**",
      ".ai-scripts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // Preserve the inherited OpenCode adapter signatures; all other lint rules stay active.
  {
    files: [".opencode/plugins/continuous-memory.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    files: [".opencode/plugins/docs-check.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^(_|output$)" }],
    },
  },
];
