# salles-api — conventions du depot

Service interne de reservation de salles. Express + TypeScript, stockage en memoire pour
l'instant (la vraie base arrive avec INFRA-140).

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | installe les dependances et branche les hooks git (husky) |
| `npm start` | demarre l'API sur le port 3000 (via `tsx`, il n'y a pas d'etape de build) |
| `npm run test:unit` | lance les tests — le hook pre-commit le fait a chaque commit |
| `npm run test:coverage` | tests + couverture, echoue sous 90 % (c'est ce que lance la CI) |
| `npm run typecheck` | `tsc --noEmit` en mode strict |
| `npm run lint` | ESLint (typescript-eslint recommended + quelques regles) |

Les tests sont des fichiers `test/**/*.spec.ts` (INFRA-205) : un autre suffixe n'est
pas execute.

## Conventions

1. **Toute nouvelle fonction exportee porte une JSDoc** d'une ligne minimum, qui dit ce
   qu'elle fait et pas comment (sauf dans `src/lib/`, voir `src/lib/AGENTS.md`). Le code
   existant (`src/store.ts`, `src/app.ts`) n'est pas encore a jour.
2. **Les erreurs de validation sont des `ValidationError`** (`src/lib/validate.ts`),
   levees par les fonctions `require*` et attrapees dans la route, qui repond 400 avec
   `{ error }`. La migration vers un type `Result` evoquee en mars n'a pas ete faite :
   le nouveau code suit le modele de `src/routes/bookings.ts`, pas une convention qui
   n'existe que sur le papier.
3. Les dates circulent en **ISO 8601 UTC**, toujours en `string`, jamais en `Date`.
4. Un module par responsabilite dans `src/lib/`. Pas de fichier `utils.ts`.
5. Les imports relatifs portent l'extension `.js` (ESM).

## Ce qu'il ne faut pas faire

- Ne pas ajouter de dependance sans en parler.
- Ne pas commiter dans `main` directement.
- Ne pas toucher a `src/store.ts` : il disparait avec INFRA-140.
