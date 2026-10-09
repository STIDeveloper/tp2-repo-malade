---
description: Livre le travail en cours sur une branche, checks verts et relecture faite
agent: architect
---

Le travail est pret a etre livre. Avant de livrer :

1. Relance les checks toi-meme : `npm run typecheck`, `npm run lint`,
   `npm run test:coverage`. Le hook post-ecriture ne bloque jamais (INFRA-231) : il
   montre le rouge, il ne le refuse pas. Si un check est rouge, arrete-toi et dis
   lequel, avec sa sortie.
2. Verifie qu'un verdict `reviewer` existe pour ce diff et qu'il n'est pas
   `VERDICT: BLOCKING`.
3. Montre `git status` et la liste exacte des fichiers a livrer. Pas de `git add -A` :
   les plans, les notes et `.opencode/scratch/` ne partent pas avec le code.

Puis, et seulement si tout est vert, donne a l'humain les commandes a lancer :

```
git switch -c <type>/<sujet-court>      # jamais de commit direct dans main
git add <fichiers listes a l'etape 3>
git commit -m "<type>: <resume en une ligne>"
git push -u origin <type>/<sujet-court>
```

Tu ne commits pas et tu ne pousses pas toi-meme : c'est l'humain qui decide de livrer
(cf. `dev.md` et `AGENTS.md`).
