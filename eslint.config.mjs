import js from "@eslint/js";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "background.js",
      "content.js",
      "popup.js",
      "node_modules/**",
      "web-ext-artifacts/**",
      "icons/**",
      "katex/**",
      "marked/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ["src/**/*.ts", "scripts/**/*.ts", "vite.config.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        browser: "readonly",
        katex: "readonly",
        marked: "readonly"
      }
    },
    rules: {
      "no-console": "off"
    }
  },
  {
    files: ["src/content/index.ts", "src/content/markdown.ts"],
    rules: {
      "no-control-regex": "off",
      "prefer-const": "off"
    }
  }
);
