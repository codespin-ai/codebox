import js from "@eslint/js";
import typescript from "typescript-eslint";
import globals from "globals";

export default typescript.config(
  js.configs.recommended,
  ...typescript.configs.strict,
  {
    files: ["**/*.ts"],
    languageOptions: { globals: globals.node },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-dynamic-delete": "off",
      "no-console": "error",
    },
  },
  {
    files: ["**/test/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  { files: ["**/*.js", "**/*.mjs"], languageOptions: { globals: globals.node } },
  { ignores: ["node_modules/**", "dist/**"] }
);
