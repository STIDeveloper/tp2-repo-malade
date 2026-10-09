# Notes — contexte pour GET /rooms/:id/availability

## Answer
- `src/routes/rooms.ts` n'a que 2 routes (`GET /`, `GET /:id`), handlers **synchrones**, sans try/catch ni ValidationError : la seule erreur est un 404 manuel (`rooms.ts:12-15`). Aucune query n'est validée.
- Le modèle de validation/erreurs vit dans `src/routes/bookings.ts:18-65` : `requireString/requireDate/requirePositiveInt` lèvent `ValidationError`, attrapée et rendue en 400.
- Le store est typé `Room {id,name,capacity,hourlyRate}` / `Booking {id,roomId,who,people,startsAt,endsAt,price}` ; les dates sont des `string` ISO 8601 UTC terminés par `Z` (`store.ts:1-16,31-32`).
- **Il n'existe nulle part** de notion de créneaux, d'horaires d'ouverture ou de disponibilité. « Créneau » = un simple intervalle `[début, fin[` géré par `overlaps()` (`overlap.ts:1-12`). L'endpoint est donc à concevoir de zéro.
- Tests = **vitest**, pas de supertest : `createApp().listen(0)` + `fetch` global par requête (`test/helpers/http.ts:17-26`). Le `ApiBody` (`http.ts:5-14`) devra être étendu pour typer la réponse, sinon `typecheck` strict échoue.

## How it works
1. `src/app.ts:5-12` : `createApp()` monte `roomsRouter` sur `/rooms` et `bookingsRouter` sur `/bookings`. C'est la seule factory — les tests la réutilisent.
2. `src/routes/rooms.ts:6-8` — `GET /rooms` : `res.json({ rooms })`, handler synchrone sans validation.
3. `src/routes/rooms.ts:10-17` — `GET /rooms/:id` : `findRoom(req.params.id)` (`store.ts:53-55`) ; `undefined` => `res.status(404).json({ error: "salle inconnue" })` puis `return`. Sinon `res.json({ room, bookings: bookingsForRoom(room.id) })`.
4. `src/routes/bookings.ts:18-65` — `POST /bookings` : tout le corps dans un `try` ; validations de forme (`requireString`, `requirePositiveInt`, `requireDate`) puis règles métier qui `throw new ValidationError(...)` (`bookings.ts:28,33,36`).
5. `src/routes/bookings.ts:39-45` — conflit de créneau : pas une erreur, réponse directe `409` avec `conflictsWith`.
6. `src/routes/bookings.ts:58-64` — `catch` : `if (err instanceof ValidationError) res.status(err.status).json({ error: err.message })`, sinon `throw err`. `ValidationError.status = 400` (`validate.ts:4-6`).
7. `src/lib/validate.ts` — `requireDate` (`:16-22`) appelle `requireString` puis rejette si `Number.isNaN(Date.parse(value))`. `requirePositiveInt` (`:24-29`) exige `number` entier `> 0`.
8. Tests : `test/helpers/http.ts:17-26` démarre l'app sur un port libre, `fetch`, renvoie `{status, body}`, ferme le serveur en `finally`. Exemple rooms : `test/rooms.spec.ts:20-32`.

## Key files
- `src/routes/rooms.ts:1-17` — routeur à étendre ; handlers sync, 404 manuel, aucune validation query.
- `src/routes/bookings.ts:18-65` — modèle imposé par AGENTS.md pour validation + 400/409.
- `src/lib/validate.ts:4-29` — `ValidationError`, `requireString/Date/PositiveInt`.
- `src/lib/overlap.ts:6-12` — seule brique temporelle existante : `a1 < b2 && b1 < a2`, `[début, fin[`.
- `src/store.ts:1-59` — types `Room`/`Booking`, données, `findRoom`, `bookingsForRoom`.
- `test/helpers/http.ts:5-34` — `ApiBody` (à étendre) + `call`/`post`.
- `test/rooms.spec.ts:1-33` — style de test de route.

## Gotchas
- Pas de notion d'ouverture de salle : aucun champ horaire sur `Room` (`store.ts:1-6`) et aucun `.env` lu par le code de routes. Toute grille horaire est une décision nouvelle, non ancrée dans le dépôt.
- `requireDate` valide par `Date.parse`, pas par regex : `"2026-11-02"` et des formats exotiques passent (`validate.ts:18`). Le message est « date invalide : <champ> ».
- `ValidationError` n'est attrapée que via try/catch explicite ; un handler `async` sans try/catch rejetterait la promesse vers Express 4 sans 400. `rooms.ts` actuel est synchrone.
- `req.params.id` est une `string` non validée dans `rooms.ts:11` (`.trim()`/format absents).
- Les tests partagent le **même store en mémoire** et ne le réinitialisent pas : les mutations d'un `it` persistent pour les suivants (`bookings.spec.ts:49-67` crée des réservations ensuite visibles ; `store.spec.ts:4-5` l'assume). L'ordre des tests compte.
- Seuil de couverture 90 % lignes/branches (`vitest.config.ts:15`) ; `src/server.ts` exclu (`:13`).
- `ApiBody` (`test/helpers/http.ts:5-14`) est une interface fermée : toute nouvelle clé de réponse non déclarée casse `npm run typecheck` en strict.
- AGENTS.md interdit de toucher `src/store.ts` (disparaît avec INFRA-140) : ne pas y ajouter d'horaires d'ouverture.
- `src/lib/AGENTS.md` exige un `export default` par module de `src/lib/` — contredit le code actuel (validate/overlap/price n'ont que des exports nommés). Ne pas s'y fier aveuglément.

## Unknowns
- Aucun ticket, README, commit ou fichier ne définit « créneau », l'amplitude horaire, le pas (30 min ? 1 h ?) ni le format de réponse de `availability`. Impossible de déduire la spec depuis le dépôt ; il faut la fournir (voir `git log` : aucun commit lié).
- Pas pu vérifier s'il existe une base externe « vraie » (INFRA-140) contenant les horaires : le dépôt n'a que le store mémoire.
- `.env` existe mais son contenu n'a pas été ouvert (hors périmètre routes) ; je ne peux pas affirmer qu'aucune config d'ouverture n'y traîne.
