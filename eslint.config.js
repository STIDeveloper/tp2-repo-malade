import tseslint from "typescript-eslint";

// Mise en place du lint — ticket INFRA-212.
// Le parser TypeScript est branche, les regles seront choisies avec l'equipe.
export default [
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" }
    },
    rules: {}
  }
];
