# Ajouter `GET /rooms/:id/availability?date=YYYY-MM-DD` (12 créneaux horaires, libres/occupés)

## Goal

Un client peut appeler `GET /rooms/:id/availability?date=YYYY-MM-DD` et obtenir, pour une
salle connue et une date valide, une réponse `200` **exactement** de la forme :

```json
{
  "room": { "id": "salle-a", "name": "Salle A", "capacity": 12, "hourlyRate": 25 },
  "date": "2026-10-05",
  "slots": [
    { "startsAt": "2026-10-05T08:00:00Z", "endsAt": "2026-10-05T09:00:00Z", "available": true },
    { "startsAt": "2026-10-05T09:00:00Z", "endsAt": "2026-10-05T10:00:00Z", "available": false }
  ]
}
```

- Les **12** créneaux `[08:00, 20:00[` UTC par pas de 1 h sont **toujours** renvoyés, libres
  et occupés (le client filtre) : `08-09, 09-10, …, 19-20`.
- Un créneau est `available: false` s'il **chevauche** au moins une réservation de la salle
  au sens `[début, fin[` (08-09 face à une résa 09-11 ⇒ libre).
- Salle inconnue ⇒ `404 { "error": "salle inconnue" }`.
- `date` manquant, non-`string`, ou non strictement `YYYY-MM-DD` réel ⇒ `400 { "error": ... }`
  via `ValidationError`.
- À la fin : `npm run typecheck`, `npm run lint` et `npm run test:unit` passent ;
  `npm run test:coverage` reste au-dessus du seuil de 90 % (lignes/branches/fonctions/instructions).

## Non-goals

- **Ne pas modifier `src/store.ts`** (interdit par `AGENTS.md` ; disparaît avec INFRA-140) :
  ni horaires d'ouverture, ni type `Slot` n'y sont ajoutés.
- Pas de persistance ni de vraie base (INFRA-140) : on part du store mémoire existant.
- Pas de filtre `available=true`, pas de pagination, pas d'autres granularités (30 min, 2 h).
- Pas de nouvelle dépendance, pas de supertest, pas de modification de `vitest.config.ts`.
- Pas de modification des routes existantes (`GET /rooms`, `GET /rooms/:id`, router bookings).
- Pas de validation via `requireDate` seul (trop laxiste : accepte `2026/10/05`).

## Assumptions and open questions

- Aucune question **bloquante** : le contrat est figé.
- assumption — **la validation de `date` vit dans `src/routes/rooms.ts`**, pas dans
  `src/lib/validate.ts`. L'architecture imposée dit « la route valide/parse `date` » ; on
  suit ce périmètre et on n'ajoute pas de fichier supplémentaire.
- assumption — **l'ordre est : valider `date`, puis `findRoom`**. Donc salle inconnue +
  `date` invalide ⇒ `400` (la validation passe en premier) ; salle inconnue + `date` valide
  ⇒ `404`. Les tests 404 utilisent une date valide pour ne pas dépendre de cet ordre.
- assumption — **messages gelés** : `date` manquant/vide ⇒ `champ manquant ou vide : date` ;
  format invalide ou date irréelle ⇒ `date invalide : date`. Les tests asservissent ces
  chaînes pour rendre le plan vérifiable.
- assumption — **la validité « date réelle » est déléguée à `Date.parse`** (`!Number.isNaN`)
  comme spécifié. Le test d'irréalité utilise `2026-13-01` (mois 13 ⇒ `NaN` garanti) pour ne
  pas dépendre du comportement de `Date.parse("2026-02-30")`.
- assumption — **JSDoc** : `src/lib/AGENTS.md` dit « pas de JSDoc dans `src/lib/` », mais le
  contrat demande une JSDoc d'une ligne sur `RoomSlot`. On suit le contrat (JSDoc d'une ligne
  sur l'interface et sur la fonction par défaut) ; c'est inoffensif pour lint/typecheck.
- assumption — `/:id/availability` est déclarée **avant** `/:id` (ordre imposé). Ce n'est pas
  strictement nécessaire en Express 4 (`/:id` ne matche qu'un seul segment et ne peut pas
  capturer `/amphi/availability`), mais c'est plus sûr et plus lisible ; le plan l'exige.

## Files to touch

| File | Change | Why |
|---|---|---|
| `src/lib/availability.ts` | **Nouveau** module pur : `RoomSlot`, `slotsForDay`, `export default`, constantes 08/20/1 h | Produire les 12 créneaux, sans I/O ni store |
| `test/availability.spec.ts` | **Nouveau** : tests unitaires du module pur | Vérifie bornes semi-ouvertes/contiguïté sans passer par HTTP |
| `test/helpers/http.ts` | Étendre `ApiBody` avec `date?: string; slots?: RoomSlot[]` | `ApiBody` est fermée : sans ça `npm run typecheck` strict casse |
| `src/routes/rooms.ts` | Ajouter `GET /:id/availability` (sync, `try/catch`, `ValidationError`) + helper local `requireIsoDay` | Exposer l'endpoint selon le modèle `bookings.ts` |
| `test/rooms.spec.ts` | Nouveau `describe` pour l'endpoint (200/404/400) | Tests d'intégration de la route |

## Steps

### 1. Créer le module pur `src/lib/availability.ts`

- What : créer le fichier avec, dans cet ordre :
  - imports : `import type { Booking } from "../store.js";` et
    `import { overlaps } from "./overlap.js";`
  - une JSDoc d'une ligne + `export interface RoomSlot { startsAt: string; endsAt: string; available: boolean }`
  - constantes **privées** (non exportées) : `OPENING_HOUR = 8`, `CLOSING_HOUR = 20`
    (le pas de 1 h est porté par la boucle).
  - signature exacte :
    `export function slotsForDay(date: string, bookings: Booking[]): RoomSlot[]`
  - logique (décrite, pas à recopier en corps) : boucler `h` de `OPENING_HOUR` à
    `CLOSING_HOUR - 1` inclus ; `startsAt = \`${date}T${pad(h)}:00:00Z\``,
    `endsAt = \`${date}T${pad(h + 1)}:00:00Z\`` avec `pad` = `String(h).padStart(2, "0")` ;
    `available = !bookings.some((b) => overlaps(startsAt, endsAt, b.startsAt, b.endsAt))` ;
    retourner le tableau des 12 `RoomSlot` dans l'ordre chronologique.
  - `export default slotsForDay;` en fin de fichier (obligatoire pour `src/lib/`).
  - aucune JSDoc superflue hors l'interface/la fonction ; fonction pure, aucun accès store.
- Where : `src/lib/availability.ts` (nouveau).
- Done when : `npm run typecheck` passe, `npm run lint` passe, et
  `node -e "import('./src/lib/availability.ts')"` n'est pas requis — la preuve est le
  typecheck + le lint verts (le module n'est pas encore consommé, l'export default existe).

### 2. Écrire les tests unitaires du module pur

- What : créer `test/availability.spec.ts` (`vitest`, import
  `import { slotsForDay } from "../src/lib/availability.js";`), avec au minimum :
  - **12 créneaux / contiguïté / format** : `slotsForDay("2026-10-05", [])` ⇒ longueur 12,
    premier `{ startsAt: "2026-10-05T08:00:00Z", endsAt: "2026-10-05T09:00:00Z" }`, dernier
    `{ startsAt: "2026-10-05T19:00:00Z", endsAt: "2026-10-05T20:00:00Z" }`, tous `available:true`,
    et `slots[i].endsAt === slots[i+1].startsAt` pour tout `i`.
  - **bornes semi-ouvertes** : avec une résa `[2026-10-05T09:00:00Z, 2026-10-05T11:00:00Z[`,
    seuls les index 1 (09-10) et 2 (10-11) sont `available:false` ; index 0 (08-09) et 3
    (11-12) restent `true`.
  - **hors amplitude** : une résa `[06:00,07:00[` le même jour ⇒ 12 slots `available:true`.
  - **débordement minuit** : une résa de la veille `23:00` au jour `01:00` ⇒ 12 slots
    `available:true` (aucun chevauchement avec `[08:00,…[`).
- Where : `test/availability.spec.ts` (nouveau).
- Done when : `npm run test:unit -- test/availability.spec.ts` passe avec les 4 cas verts.

### 3. Étendre `ApiBody` dans le helper HTTP

- What : dans `test/helpers/http.ts` :
  - ajouter `import type { RoomSlot } from "../../src/lib/availability.js";`
  - ajouter à l'interface `ApiBody` deux clés optionnelles :
    `date?: string;` et `slots?: RoomSlot[];`
  - ne rien changer à `call`/`post`.
- Where : `test/helpers/http.ts:2` (import) et `test/helpers/http.ts:5-14` (interface).
- Done when : `npm run typecheck` passe (l'interface reste valide et aucune réponse existante
  n'est cassée : ce sont des clés optionnelles).

### 4. Ajouter la route `GET /:id/availability`

- What : dans `src/routes/rooms.ts` :
  - imports : ajouter `import { slotsForDay } from "../lib/availability.js";` et
    `import { ValidationError } from "../lib/validate.js";` (garder `findRoom`,
    `bookingsForRoom`, `rooms`, `Router`).
  - constante regex au niveau module : `const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;`
  - helper **local, non exporté** `function requireIsoDay(raw: unknown): string` :
    - `typeof raw !== "string"` ou `raw.trim() === ""` ⇒ `throw new ValidationError("champ manquant ou vide : date")` ;
    - `!ISO_DAY.test(raw) || Number.isNaN(Date.parse(raw))` ⇒
      `throw new ValidationError("date invalide : date")` ;
    - sinon retourne `raw`.
  - route **synchrone**, déclarée **avant** `roomsRouter.get("/:id", …)` :
    `roomsRouter.get("/:id/availability", (req, res) => { … })` :
    - `try` : `const date = requireIsoDay(req.query.date);` puis
      `const room = findRoom(req.params.id);` ; si `!room` ⇒
      `res.status(404).json({ error: "salle inconnue" }); return;` ; puis
      `const slots = slotsForDay(date, bookingsForRoom(room.id));` et
      `res.json({ room, date, slots });`
    - `catch (err)` : `if (err instanceof ValidationError) { res.status(err.status).json({ error: err.message }); return; } throw err;`
      (copie exacte du modèle `src/routes/bookings.ts:58-64`).
- Where : `src/routes/rooms.ts` (route `/:id/availability` insérée entre la ligne 8 et la
  route `/:id` actuelle ligne 10 ; imports en tête lignes 1-2).
- Done when : `npm run typecheck` et `npm run lint` passent ; `GET /rooms/salle-a/availability`
  ne renvoie plus un 404 de `/:id`.

### 5. Ajouter les tests d'intégration de la route

- What : dans `test/rooms.spec.ts`, ajouter un `describe("GET /rooms/:id/availability", …)`
  après les tests existants (le fichier ne mute pas le store ; ne pas y introduire de
  réservation). Réutiliser `const get = (path) => call(path);` déjà défini :
  - **200 salle libre** : `salle-b` le `2026-10-05` ⇒ `status 200`, `body.room?.id === "salle-b"`,
    `body.date === "2026-10-05"`, `body.slots` longueur 12, premier
    `startsAt === "2026-10-05T08:00:00Z"`, dernier `endsAt === "2026-10-05T20:00:00Z"`,
    et `body.slots?.every((s) => s.available === true) === true`.
  - **200 bornes semi-ouvertes** : `salle-a` le `2026-10-05` (résa `bk-1001` 09→11) ⇒
    `body.slots?.filter((s) => !s.available).map((s) => s.startsAt)` égale
    `["2026-10-05T09:00:00Z", "2026-10-05T10:00:00Z"]` (donc 08-09 et 11-12 libres).
  - **200 résa multi-créneaux** : `amphi` le `2026-10-06` (résa `bk-1002` 14→17) ⇒
    exactement 3 slots indisponibles, `startsAt`
    `["2026-10-06T14:00:00Z", "2026-10-06T15:00:00Z", "2026-10-06T16:00:00Z"]`.
  - **404 salle inconnue** : `/rooms/cave/availability?date=2026-10-05` ⇒ `status 404`,
    `body.error === "salle inconnue"`.
  - **400 date manquant** : `/rooms/salle-a/availability` ⇒ `status 400`,
    `body.error === "champ manquant ou vide : date"`.
  - **400 format non-ISO** : `/rooms/salle-a/availability?date=2026/10/05` ⇒ `status 400`,
    `body.error === "date invalide : date"`.
  - **400 date irréelle** : `/rooms/salle-a/availability?date=2026-13-01` ⇒ `status 400`.
- Where : `test/rooms.spec.ts` (fin du fichier, après la ligne 33).
- Done when : `npm run test:unit` passe, tous les `describe`/`it` verts (anciens + nouveaux).

### 6. Vérification finale du seuil de couverture

- What : lancer la couverture pour s'assurer que `src/lib/availability.ts` et la nouvelle
  route ne font pas chuter le seuil.
- Where : racine du dépôt.
- Done when : `npm run test:coverage` termine en succès (lignes/branches/fonctions/instructions
  ≥ 90 %). Le `throw err` du `catch` (jamais atteint) est déjà non couvert dans `bookings.ts`
  sans casser le seuil : même situation ici, c'est acceptable.

## How this is verified

Vérification **écrite avant** l'implémentation (tout est dans les étapes 2 et 5). Les cas
limites couverts :

| Cas | Entrée | Attendu |
|---|---|---|
| Salle libre | `salle-b`, `2026-10-05` | 12 slots, tous `available:true`, 08:00→20:00, contigus |
| Borne basse semi-ouverte | `salle-a`, `2026-10-05` (09→11) | 08-09 libre, 09-10 et 10-11 occupés, 11-12 libre |
| Résa multi-créneaux | `amphi`, `2026-10-06` (14→17) | 14-15, 15-16, 16-17 occupés, 9 autres libres |
| Salle inconnue | `/rooms/cave/availability?date=2026-10-05` | 404 `salle inconnue` |
| `date` manquant | `/rooms/salle-a/availability` | 400 `champ manquant ou vide : date` |
| `date` mauvais format | `?date=2026/10/05` | 400 `date invalide : date` |
| `date` irréelle | `?date=2026-13-01` | 400 |

Commandes de preuve, dans l'ordre :

1. `npm run typecheck` — 0 erreur (notamment `ApiBody` étendue).
2. `npm run lint` — 0 erreur (regex, imports `.js`, pas de variable morte).
3. `npm run test:unit` — tous les tests verts.
4. `npm run test:coverage` — seuil 90 % atteint.

Les tests unitaires du module pur (étape 2) existent parce que la fonction `slotsForDay`
porte toute la sémantique `[début, fin[` : ils la vérifient sans l'HTTP, ce que les tests de
route ne démontrent qu'indirectement.

## Risks and rollback

- **`ApiBody` non étendue** ⇒ `npm run typecheck` échoue en strict sur `res.body.slots`.
  L'étape 3 doit précéder l'étape 5 ; rollback = retirer les deux clés optionnelles.
- **Ordre des routes** : `/:id/availability` doit rester avant `/:id`. En Express 4 `/:id`
  ne matche qu'un segment, donc le risque est faible, mais l'ordre est imposé et vérifié par
  les tests 200 ; rollback = replacer la route.
- **Validation trop laxiste** : ne pas déléguer à `requireDate` seul (`2026/10/05` passerait).
  Le test « mauvais format » échoue si on le fait — c'est le garde-fou.
- **`src/store.ts`** : ne pas y toucher (données partagées par tous les tests et interdit).
  Aucun test de ce plan ne mute le store, donc pas d'effet de bord inter-tests.
- **Couverture** : la route ajoute un `throw err` non couvert (comme `bookings.ts`) ; le seuil
  reste atteignable car les 5 branches utiles (date manquante, format, date irréelle, 404,
  succès) sont toutes exercées. Rollback global : supprimer `src/lib/availability.ts`,
  `test/availability.spec.ts`, le `describe` ajouté et la route, et retirer les clés
  `date?`/`slots?` de `ApiBody`.
