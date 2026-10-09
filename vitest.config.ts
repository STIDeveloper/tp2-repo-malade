import { defineConfig } from "vitest/config";

// Normalisation du nommage des tests — ticket INFRA-205.
// La convention du depot est *.spec.ts.
export default defineConfig({
  test: {
    include: ["test/**/*.spec.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // server.ts ne fait que demarrer l'ecoute : rien a tester unitairement.
      exclude: ["src/server.ts"],
      reporter: ["text"],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 }
    }
  }
});
