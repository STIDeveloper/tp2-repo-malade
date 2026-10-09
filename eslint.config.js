import tseslint from "typescript-eslint";

// Mise en place du lint — ticket INFRA-212.
// Socle : les regles recommandees de typescript-eslint, plus quelques regles
// de base qui attrapent de vrais bugs. A enrichir avec l'equipe.
export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parserOptions: { ecmaVersion: "latest", sourceType: "module" }
    },
    rules: {
      eqeqeq: ["error", "always"],
      "no-debugger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  }
);
