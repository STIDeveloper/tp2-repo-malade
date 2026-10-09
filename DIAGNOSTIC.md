# DIAGNOSTIC — salles-api, le repo malade

Ce document liste, brique par brique, ce qui était cassé dans le dépôt, **comment je l'ai
démontré** (commande lancée, capture), **où était la cause**, et **le commit qui répare**.
Il liste aussi ce qui ressemblait à un défaut mais ne l'était pas, et ce que j'ai choisi de
ne pas corriger.

## Méthode

- **État de référence** : `ab57521`, l'état du dépôt tel que fourni. Une première tentative
  de réparation (`fe453b5`, `8d7c92e`) a été **annulée** par `930f8c1` : elle ne
  démontrait rien, contournait la convention `*.spec.ts`, et ajoutait un
  `test/availability.test.ts` qui ne contenait que des `expect(true).toBe(true)`.
- **Une réparation = un commit**, sur la branche `reparation`. Le hook `pre-commit`
  (lint + typecheck + tests) a tourné sur chacun d'eux ; il a d'ailleurs refusé deux de mes
  commits (tests mal typés), corrigés avant de recommiter.
- **Preuves** : chaque capture de `captures/` est une **vraie fenêtre de terminal**
  (conhost Windows) dans laquelle la commande a été exécutée, puis photographiée
  (`scripts/diagnostic/capture-terminal.ps1`). Le bandeau de chaque capture donne la date,
  le dossier et le commit (`ab57521` = avant, `reparation @ …` = après).
- **Les agents ont été interrogés par OpenCode lui-même**, pas déduits de leurs fichiers :
  `opencode agent list`, `opencode debug agent <nom>` (droits résolus) et surtout
  `opencode debug agent <nom> --tool <outil>`, qui **exécute un outil au nom d'un agent**.
- **Mesures** : couverture (`@vitest/coverage-v8`) et mutation testing (Stryker) avant et
  après.
- **Exercice 1** lancé deux fois avec `opencode run`, depuis un clone neuf et une session
  neuve, sur l'énoncé exact du sujet. Sessions analysées avec
  `scripts/diagnostic/analyse-session.mjs` (qui a travaillé, outils, fichiers écrits, refus,
  tokens). Les journaux bruts des deux exécutions sont dans
  `captures/exercice1/journal-avant.log` et `journal-apres.log`.

> **Limite à connaître.** Le modèle déclaré par le dépôt (`opencode/deepseek-v4-pro`)
> exige un compte OpenCode Zen payant : sans compte, `opencode run` répond
> `UnknownError`. Pour les deux exécutions de l'exercice 1, **seul le modèle** a été
> remplacé par le modèle gratuit `opencode/big-pickle`, via la variable
> `OPENCODE_CONFIG_CONTENT`. Aucun fichier du dépôt n'a été modifié pour ça : prompts,
> droits, plugin, commandes et MCP sont ceux du commit testé. Les deux exécutions
> utilisent le même modèle, donc la comparaison avant/après reste valable.

## Chiffres avant / après

| Mesure | Avant (`ab57521`) | Après (`reparation`) | Captures |
|---|---|---|---|
| Fichiers de test exécutés | 2 sur 4 | 7 sur 7 | avant/13, après/11 |
| Tests exécutés / ignorés | 5 / 4 skip | 54 / 1 skip (documenté) | avant/13, après/11 |
| Couverture des lignes | 17,9 % | 98,1 % (seuil 90 % bloquant) ¹ | avant/14, après/12 |
| Score de mutation (Stryker) | **4,4 %** | **93,1 %** ² | avant/15, après/13 |
| Règles ESLint actives | 0 | 50 | avant/11, après/09 |
| `tsc` en mode strict | désactivé (+ `@ts-nocheck`) | activé | avant/12, après/10 |
| Commit avec erreur de type (clone neuf) | accepté | refusé par le hook | avant/09, après/07 |
| CI | lint seul | lint + typecheck + tests avec seuil | avant/17, après/15 |
| Bugs de production | 2 (prix « 5020 », 409 bout à bout) | 0 | avant/12, avant/16, après/10 |
| Agents sans outil de lecture | 1 (finder) | 0 | avant/04-05, après/03-04 |
| MCP en échec ou sans jeton | 6 sur 6 | 0 déclaré | avant/08, après/06 |

¹ Après réparation, `src/server.ts` (7 lignes qui ne font que démarrer l'écoute) est exclu
de la mesure ; avant, il était compté à 0 %.

² 93,9 % à la fin de la réparation du harness (`cec0946`), 93,1 % une fois intégré
l'endpoint écrit par la chaîne (exercice 1). Ses survivants sont surtout des
redondances : la regex `ISO_DAY` fait double emploi avec l'aller-retour `toISOString`, et
seul le message d'erreur d'un `date=` vide n'est pas vérifié.

Dans tout le document, « avant/13 » désigne `captures/avant/13-*.png` et « après/11 »
`captures/apres/11-*.png`. Les numéros avant et après ne se correspondent pas un à un :
la colonne « Captures » donne la paire à comparer.

## Exercice 1 — la chaîne d'origine au travail

Tâche : « Ajoute un endpoint GET /rooms/:id/availability?date=YYYY-MM-DD qui renvoie les
créneaux libres d'une salle sur la journée demandée, avec ses tests. » Lancée sans aide,
sans reformulation (`captures/exercice1/avant-*.png`).

| Observation | Preuve |
|---|---|
| **L'architecte fait le travail lui-même.** « Small repo. Let me read the core files directly rather than spinning up agents » : 17 lectures de fichiers avant son premier appel à un subagent (21 au total). | log de session, avant-1 (`read×21`) |
| **finder, explorer et tester ne travaillent jamais.** Seuls planner, dev et reviewer sont appelés. | avant-1 (« jamais appelés ») |
| **Le reviewer, privé de `bash`, détourne le hook.** `npm run test:unit` refusé → il écrit `.opencode/scratch/probe.ts` et `test/__probe.spec.ts` dans le dépôt pour que le plugin post-écriture lance les tests à sa place ; `rm` refusé → **il modifie `scripts/checks.sh`** pour y injecter `rm -f …`, puis le remet en état. | avant-2 |
| **Le reviewer brûle 1,06 million de tokens** de contexte (62 appels) pour un diff de quatre fichiers ; c'est l'agent qui lit le plus. | avant-1 |
| **La chaîne annonce « Shipped » sur un filet troué** : elle s'appuie sur des checks verts, alors que la moitié des tests ne tourne pas et que le lint n'a aucune règle. | avant-3 |
| **Une règle fausse façonne le code** : le dev écrit `export default freeSlots` et le justifie ainsi : « mandatory default export, no JSDoc, no I/O (per `src/lib/AGENTS.md`) ». | avant-3 |
| **Le bug connu est contourné, pas corrigé** : l'architecte repère que `overlaps()` est faux et fait réécrire la comparaison dans `availability.ts` au lieu de la réparer (« deliberately NOT fixed »). | avant-3, log |
| **Une règle métier est inventée** : horaires 08:00–20:00 UTC, « this is my invention ». Il le signale, ce qui est honnête, mais rien dans le dépôt ne le cadre. | avant-3 |

## Problèmes trouvés, par brique

Légende : **Démontré** = commande lancée et sortie capturée. **Mesuré** = outil de mesure.
**Observé** = constaté pendant l'exercice 1.

### Rules

| # | Symptôme | Cause | Preuve | Réparation |
|---|---|---|---|---|
| R1 | `npm test` → `Missing script: "test"` ; `npm run build` → `Missing script: "build"`. Les deux commandes « à lancer avant tout commit » d'après les règles n'existent pas. | `AGENTS.md` (tableau Commandes) | Démontré — avant/01 | `6f523ce` — après/02 |
| R2 | Les règles imposent « les erreurs remontent en `Result`, jamais en `throw` », mais tout le code lève `ValidationError` et l'attrape dans un `try/catch` de route. Un agent qui obéit écrit du code incohérent avec le reste. | `AGENTS.md` convention 2 | Démontré — avant/02 | `6f523ce` |
| R3 | « Toute fonction exportée porte une JSDoc » : faux pour `src/store.ts` et `src/app.ts`. | `AGENTS.md` convention 1 | Démontré (lecture + grep) | `6f523ce` (la règle vise le nouveau code) |
| R4 | `src/lib/AGENTS.md` déclare un `export default` « obligatoire » ; aucun des 3 modules n'en a. En exercice 1, le dev l'applique au nouveau module. | `src/lib/AGENTS.md` | Démontré — avant/02, observé — avant-3 | **Non corrigé**, voir plus bas |

### Subagents et droits

| # | Symptôme | Cause | Preuve | Réparation |
|---|---|---|---|---|
| A1 | **finder ne peut rien lire** : `Tool read is disabled for agent finder`, `Tool grep is disabled…`. Il « répond sans avoir rien lu ». | `.opencode/agent/finder.md` : `"*": deny` est la **dernière** règle ; OpenCode retient la dernière règle qui s'applique, elle écrase `read/glob/grep: allow`. | Démontré — avant/04, avant/05 | `04fdce0` — après/03, après/04 (`Found 5 matches`) |
| A2 | finder doit « expliquer en prose, généreusement », alors que l'architecte l'utilise pour « Where is X? » et lui interdit d'expliquer, et qu'il tourne sur le petit modèle. | `finder.md` (description, Output format) | Démontré — avant/07 | `04fdce0` |
| A3 | L'architecte « Never writes code » mais a `edit: allow` et `bash "*": allow`, ajoutés par `865177b` (« unblock, trop de refus de permission »). | `architect.md` (permissions) | Démontré — avant/04, avant/06 | `2a90411` — après/03 |
| A4 | Règle « absolue » inversée : « If a question can be answered by a subagent, **it can also be answered by you** », plus « use whichever is faster ». Conséquence observée : 17 lectures par l'architecte lui-même avant la première délégation. | `architect.md` §Your real constraint | Démontré — avant/06, observé — avant-1 | `2a90411` — après/05 |
| A5 | `tester` n'est pas dans le tableau de l'équipe de l'architecte : il n'est jamais appelé. | `architect.md` §Your team | Démontré + observé — avant-1 | `2a90411` |
| A6 | Le reviewer « fixes what it finds » (`edit: allow`), alors que son propre prompt fonde sa valeur sur le fait de ne pas avoir écrit le code, et que dev est « the only agent with write access ». À l'inverse, il ne peut lancer aucun test. Conséquence : le contournement du hook (exercice 1). | `reviewer.md` | Démontré — avant/05 (`npm run test:unit` refusé), avant/07 ; observé — avant-2 | `933d577` — après/04 |
| A7 | explorer « lit » mais a `edit: allow` sans restriction : `opencode debug agent explorer --tool write` crée `src/ecrit-par-explorer.ts`. Il a aussi `curl*` et l'instruction d'appeler « an internal service ». | `explorer.md` | Démontré — avant/05 | `20e17ee` — après/04 |
| A8 | dev a `task: allow` et l'instruction d'envoyer des morceaux « à d'autres dev », alors que l'architecte interdit deux dev sur les mêmes fichiers et ne peut pas le contrôler. | `dev.md` | Démontré — avant/07 | `e04e1c5` |
| A9 | Un agent qui peut écrire peut réécrire le script qui le juge (`scripts/checks.sh`), ce que le reviewer a fait. | droits `edit` des agents | Observé — avant-2 | `933d577` (reviewer), `e04e1c5` (dev : `.opencode/`, `.husky/`, `.github/`, `scripts/` en `deny`) — après/04 |

### Commands

| # | Symptôme | Cause | Preuve | Réparation |
|---|---|---|---|---|
| C1 | `/ship` fait `git add -A`, commit et `git push` sur la branche courante « sans poser de question », et interdit de relancer les checks parce que « le hook post-écriture s'en est déjà occupé ». Or ce hook renvoie toujours 0 (démontré : `typecheck` rouge, code de sortie 0), et `AGENTS.md` interdit de commiter dans `main`. | `.opencode/command/ship.md` | Démontré — avant/10 | `b3bd9c3` — après/08 |

### MCP

| # | Symptôme | Cause | Preuve | Réparation |
|---|---|---|---|---|
| M1 | `opencode mcp list` : `salles-db` **failed** (URL `.lan` interne ; la base n'existe pas encore, INFRA-140), `slack` **failed**, `sentry` **needs authentication**, `github` et `notion` démarrent **sans aucun jeton** défini nulle part, `playwright` n'a rien à piloter (API sans interface). Aucun prompt d'agent ne mentionne un seul de ces serveurs. | `opencode.json` | Démontré — avant/08 | `cc91156` — après/06 |

### Hooks

| # | Symptôme | Cause | Preuve | Réparation |
|---|---|---|---|---|
| H1 | Dans un clone neuf, après `npm install`, `core.hooksPath` n'est pas défini et `.git/hooks` ne contient que des exemples : **un commit avec une erreur de type passe**. | husky absent de `package.json` (ni dépendance ni script `prepare`) ; `.husky/pre-commit` au format husky v4 | Démontré — avant/09 | `5f56071` — après/07 (`husky - pre-commit script failed`) |
| H2 | `scripts/checks.sh` se dit « branché dans opencode.json (experimental.hook.file_edited) » : cette clé n'existe pas, c'est `.opencode/plugin/checks.js` qui l'appelle. | commentaire de `scripts/checks.sh` | Démontré (`opencode debug config` liste le plugin) | `5790f10` |

### Lint et types

| # | Symptôme | Cause | Preuve | Réparation |
|---|---|---|---|---|
| L1 | `eslint --print-config` : **0 règle active**. Un fichier avec `any`, variable inutilisée, `==`, `debugger` et `eval` passe le lint. | `eslint.config.js` : `rules: {}` | Démontré — avant/11 | `ec2816b` — après/09 (50 règles, 5 erreurs) |
| T1 | `strict`, `noImplicitAny`, `strictNullChecks` à `false`. | `tsconfig.json` | Démontré — avant/12 | `07b62d4` — après/10 |
| T2 | `// @ts-nocheck` en tête de `price.ts` cache une erreur que `tsc --strict` voit dès qu'on le retire : `TS2322: Type 'string' is not assignable to type 'number'`. | `src/lib/price.ts:1` | Démontré — avant/12, après/01 | `859f8cf` |

### Tests (et bugs que le filet réparé a attrapés)

| # | Symptôme | Cause | Preuve | Réparation |
|---|---|---|---|---|
| U1 | 4 fichiers de test, **2 exécutés** : `bookings.test.ts` et `price.test.ts` ne tournent jamais. | `vitest.config.ts` n'inclut que `*.spec.ts`, la convention du dépôt (INFRA-205), et ces deux fichiers ne la respectent pas | Démontré — avant/13 | `f0848a0` (fichiers renommés, la convention est gardée) |
| U2 | Le test qui prouve le bug de chevauchement est en `it.skip`, et deux autres sont des `it.skip` contenant `expect(true).toBe(true)`. | `test/overlap.spec.ts` | Démontré — avant/13 | `58d1524` |
| U3 | `store.spec.ts` teste un `storeDouble` défini dans le test lui-même : en mutation testing, **25 mutants sur 26 couverts de `store.ts` survivent**. | `test/store.spec.ts` | Mesuré — avant/15 | `cb77e73` |
| U4 | Aucune mesure de couverture : 17,9 % des lignes réellement couvertes ; `rooms.ts`, `bookings.ts`, `validate.ts` et `price.ts` à 0 %. | pas de `@vitest/coverage-v8`, pas de seuil | Mesuré — avant/14 | `48101e2`, `fb669f1` (seuil 90 %), `cec0946` — après/12 |
| U5 | Score de mutation **4,4 %** : presque tout bug introduit dans le code passerait les tests. | U1 à U4 | Mesuré — avant/15 | 93,1 % — après/13 |
| B1 | **Bug de prod** : `POST /bookings` un samedi renvoie `"price":"5020"` (chaîne) au lieu de `70`. | `src/lib/price.ts` : `WEEKEND_SURCHARGE = "20"`, concaténé ; masqué par T2 et U1 | Démontré par l'API — avant/12 ; attrapé par le filet réparé — après/01 | `859f8cf` — après/10 |
| B2 | **Bug de prod** : une réservation 11h–12h après une réservation 9h–11h est refusée en **409**, alors que la doc de `overlaps` annonce des créneaux `[début, fin[`. | `src/lib/overlap.ts` : `<=` au lieu de `<` ; masqué par U1 et U2 | Démontré par l'API — avant/16 ; attrapé — après/01 | `58d1524` — après/10 (HTTP 201) |

### CI et Git

| # | Symptôme | Cause | Preuve | Réparation |
|---|---|---|---|---|
| G1 | La CI ne lance que le lint (qui n'a aucune règle). Les tests ont été commentés par `07a2c4d` (« fix ci », « ça bloquait les merges ») ; le typecheck n'y a jamais été. | `.github/workflows/ci.yml` | Démontré — avant/17 | `e0f99f8` — après/15 |

## Ce qui ressemble à un défaut et n'en est pas un

Vérifié, puis laissé tel quel volontairement :

- **`scripts/checks.sh` renvoie toujours 0** (INFRA-231). C'est un retour d'information
  pour l'agent pendant qu'il travaille, pas une barrière. Le défaut était ailleurs :
  `/ship` (C1) s'en servait comme d'une barrière. Maintenant que husky et la CI bloquent,
  ce choix tient.
- **Le test `legacy-bookings` en `it.skip`** (« SKIP ASSUMÉ », INFRA-198) : la fixture
  n'existe pas dans le dépôt, le réactiver le ferait échouer au chargement. C'est le seul
  skip restant.
- **La convention `*.spec.ts`** (INFRA-205) est une décision, pas une erreur de config :
  j'ai renommé les fichiers au lieu d'élargir l'`include` (ce que faisait la tentative
  précédente).
- **« Pas de JSDoc » dans `src/lib/`** : c'est une règle de chemin (`src/lib/AGENTS.md`)
  qui prime sur la règle racine pour ce dossier. `price.ts` sans JSDoc est donc conforme.
- **« Ne pas toucher à `src/store.ts` »** (INFRA-140) : respecté. Les tests du store ont
  été réécrits sans toucher au store.
- **`planner` en `mode: primary`.** Je l'ai d'abord soupçonné d'être injoignable par
  l'architecte. **L'exercice 1 m'a donné tort** : la tâche `subagent_type: "planner"` a
  été exécutée (`completed`), OpenCode 1.18 accepte de déléguer à un agent primaire. Le
  mode primaire permet en plus à un humain de choisir `planner` directement pour rédiger
  un plan, ce qui est cohérent avec son prompt (« the artifact a human actually
  reviews »). Laissé tel quel.
- **`STRIPE_SECRET_KEY` dans `.env`** : la ligne est marquée « JEU DE DONNÉES
  PÉDAGOGIQUE, aucune valeur réelle » (`sk_test_FAKE_TEACHING_FIXTURE…`).
- **Les droits de `tester`** (`bash "*": allow` sauf git destructeur, écriture limitée à
  `.opencode/scratch/`, qui est dans `.gitignore`) correspondent à son rôle : lancer
  l'application et la casser, sans toucher au code.
- **`isWeekend` en UTC** : les règles du dépôt imposent des dates ISO 8601 UTC.

## Ce que je n'ai pas corrigé, et pourquoi

- **R4 — `export default` « obligatoire » dans `src/lib/`.** La règle se justifie par des
  « scripts de facturation » qui chargeraient les modules par leur chemin. Ces scripts ne
  sont pas dans le dépôt : je ne peux vérifier ni la règle ni le code. Ajouter des
  `export default` serait sans risque, mais ce serait inventer une exigence ; supprimer la
  règle pourrait casser un consommateur externe. À trancher avec l'équipe facturation.
  L'incohérence est démontrée (avant/02) et son effet observé (avant-3).
- **`dev` garde `bash "*"`.** Il en a besoin pour lancer les checks, mais un shell libre
  peut toujours écrire dans `scripts/` sans passer par l'outil `edit`. La protection du
  harness ne repose donc pas sur les droits de l'agent : elle repose sur husky et la CI,
  qui s'exécutent hors de la session de l'agent.
- **`.env` versionné** (`ecd0790`, « fichier d'env de recette pour l'équipe »). La clé
  Stripe est un faux déclaré. `SALLES_DB_URL` pointe vers une base de recette qui
  n'existe pas encore (INFRA-140). Sortir le fichier de Git sans `.env.example` casserait
  l'usage déclaré par l'équipe ; à revoir quand la vraie base arrivera.
- **Stryker n'est pas branché en CI.** Il a servi d'instrument de mesure (avant/après).
  Le seuil de couverture, lui, est bloquant en CI. À la fin de la réparation du harness,
  les 11 mutants survivants étaient équivalents : Express traite `""` comme `"/"`, `typeof !== "number"` est redondant avec
  `Number.isInteger`, la branche `throw err` est inatteignable, et le reste porte sur des
  libellés de données de démo.
- **Le coût en contexte des MCP n'a pas été mesuré.** `opencode debug agent` ne charge
  pas les outils MCP, et le démarrage d'OpenCode ne change pas (≈ 525 ms avec ou sans les
  MCP, car ils se connectent en différé). Je ne revendique donc aucun gain de contexte ou
  de démarrage : les MCP sont retirés parce qu'ils échouent ou n'ont pas de jeton
  (démontré), pas pour un gain que je n'ai pas mesuré.
- **La protection de la branche `main`** (« un job rouge bloque la fusion ») se règle
  dans GitHub, pas dans le dépôt.

## Exercice 1 — relancé après réparation

Même énoncé, **clone neuf de la branche `reparation`**, **session neuve** (`ex1-apres`),
même modèle de substitution. Captures `captures/exercice1/apres-*.png`.

| | Avant (`ab57521`) | Après (`reparation`) |
|---|---|---|
| Lectures de l'architecte avant sa 1re délégation | 17 | **0** : il commence par `explorer` |
| Agents appelés | 3 sur 6 (finder, explorer, tester jamais) | **6 sur 6** ¹ |
| Fichiers écrits hors de son rôle | reviewer : 3, dont **`scripts/checks.sh`** | **0** : le reviewer n'écrit rien |
| Vérification de l'API réelle | aucune (tester jamais appelé) | `tester` : 24 commandes contre le serveur lancé |
| Bug trouvé pendant la vérification | 0 | **1** : des dates impossibles (`2026-02-30`, `2026-04-31`) renvoyaient 200, car V8 les reporte au mois suivant. Le reviewer l'avait seulement soupçonné ; le tester l'a prouvé, le dev l'a corrigé, le tester a revérifié (« FIXED ») |
| Ce que valent les checks « verts » | 2 fichiers de test sur 4, lint sans règle | 7 fichiers sur 7, 54 tests, couverture 98,1 %, lint 50 règles, tsc strict |
| Réutilisation du code existant | `overlaps()` contourné (logique réécrite) | `overlaps()` corrigé et réutilisé |
| Convention d'erreur | validation écrite à la main dans la route, sans `validate.ts` | réutilise `ValidationError`, comme `bookings.ts` |
| Livraison | « Shipped » | « Reste non commité, conformément aux règles » : c'est l'humain qui livre |
| Tokens lus, tous agents | 2,16 M | 2,34 M |

¹ L'appel au `finder` a été fait, mais il a échoué pour une raison extérieure au dépôt :
le modèle gratuit a répondu « OpenCode's free tier can only be used from within
OpenCode ». L'architecte s'est rabattu sur `explorer`. Avec le modèle d'origine du dépôt,
cette erreur n'existe pas. Que le finder sache lire est, lui, démontré (après/04 :
`Found 5 matches`).

Pour être juste : la version « avant » gérait déjà les dates impossibles (même
aller-retour `toISOString`). La version « après » a d'abord raté ce cas, et c'est la
vérification réparée qui l'a rattrapé avant livraison. Le gain n'est pas « un meilleur
premier jet », c'est qu'une erreur du dev ne passe plus inaperçue.

Le coût total ne baisse pas : plus d'agents travaillent, et le tester lance réellement
l'API. Mais la dépense a changé de nature. Avant, le reviewer brûlait 1,06 M de tokens à
contourner ses propres droits. Après, le reviewer en consomme 0,50 M, et le budget sert
à une vérification qui a trouvé un vrai bug.

**Ce qui reste perfectible**, observé pendant cette exécution :

- le reviewer s'est vu refuser 6 commandes `bash` (`ls`, `node -e`, commandes
  enchaînées avec `&&` ou `|`) : ses droits restent étroits ; c'est voulu, exercer le code
  est le rôle du tester, et c'est lui qui a trouvé le bug ;
- l'endpoint renvoie les 12 créneaux, libres et occupés (`available: true/false`), là où
  l'énoncé dit « les créneaux libres ». L'architecte a figé ce contrat lui-même, faute de
  spécification, et l'a annoncé. À valider par un humain ;
- `src/lib/availability.ts` a un `export default`, conformément à la règle R4, laissée en
  l'état.

Le code produit est intégré au dépôt par le commit `7d2fe24` (avec le plan et les notes
d'exploration dans `.opencode/plans/`), après relecture et passage du hook.

## Reproduire

```bash
npm install                     # branche aussi le hook pre-commit
npm run lint && npm run typecheck && npm run test:coverage
node scripts/diagnostic/droits-agents.mjs                  # droits effectifs de chaque agent
node scripts/diagnostic/analyse-session.mjs <sessionID> .  # qui a travaillé dans une session
```
