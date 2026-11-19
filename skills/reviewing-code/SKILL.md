---
name: reviewing-code
description: Revue de code complète d'une PR GitHub ou d'un dossier local, quel que soit le repo. Combine /code-review, superpowers:requesting-code-review, l'agent code-reviewer, writing-clean-code et les skills de stack détectés (Vue, TS, Nuxt 4, SCSS), plus des audits en option (-seo, -perf, -archi, -a11y). Pour une PR, publie une review GitHub (synthèse et commentaires inline). Pour un dossier, produit un rapport markdown local.
argument-hint: <url-pr-github | dossier> [-seo] [-perf] [-archi] [-a11y] [--no-post] [--level low|medium|high|xhigh]
disable-model-invocation: false
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(git -C ~/.cache/reviewing-code/*), Read(~/.cache/reviewing-code/**), Read(${CLAUDE_SKILL_DIR}/**)
---

# /reviewing-code : revue multi-lentilles d'une PR GitHub ou d'un dossier

Arguments reçus : `$ARGUMENTS`

`S = ${CLAUDE_SKILL_DIR}` désigne le dossier de ce skill (chemin absolu, valable en installation
plugin comme au scope utilisateur).

**Deux modes**, que le script déduit de la cible :

- **mode PR** (`context.mode = "pr"`) : la cible est une URL de PR ou `owner/repo#n`. On revoit le
  diff dans un worktree en cache et on publie une review GitHub ;
- **mode dossier** (`context.mode = "dir"`) : la cible est un chemin local, dossier ou fichier,
  relatif au cwd. On revoit **tout le code existant** du périmètre, en lecture seule, et on écrit
  un rapport `revue.md`. Rien n'est publié et rien n'est écrit dans le repo.

## 1. Préparer

```bash
node ${CLAUDE_SKILL_DIR}/scripts/prepare.mjs $ARGUMENTS --out <scratchpad>/reviewing-code-<repo>-<n|dossier>
```

`<scratchpad>` est le dossier scratchpad de la session ; sans scratchpad, on omet `--out`. Le
script imprime le chemin du `context.json`, puis on lit ce fichier. Si le script échoue (cible
invalide, flag inconnu, PR introuvable, dossier vide ou backend seul), on rend son message et on
s'arrête. Les `warnings` sont relayés à l'utilisateur sans s'arrêter, sauf « diff volumineux » ou
« périmètre volumineux » : on propose alors de restreindre la revue (`AskUserQuestion` : à
certains fichiers en mode PR, à un sous-dossier en mode dossier).

On annonce en une ligne :
- mode PR : la PR, le nombre de fichiers revus, les fichiers backend exclus, les lentilles ;
- mode dossier : le dossier (`target.dir` dans `target.repo`), le nombre de fichiers et de lignes
  (`totalLines`), les modifications non commitées présentes si `target.dirty`, les fichiers backend
  exclus et les lentilles.

**Périmètre : front uniquement.** Le script retire déjà de la revue les fichiers backend
(`context.excludedFiles`) : tout `.php` hors dossier `views/`, `application/**` hors `views/`, les
tests PHPUnit, `composer.*`, `phpunit.xml*` et `*.sql`. Les vues CI3 (`application/views/**`),
qui portent du HTML/CSS/JS intégré par le front, restent dans la revue. En mode dossier, il écarte
aussi les fichiers générés, binaires et lockfiles (`context.ignoredFiles`). Une cible qui ne
contient que du backend s'arrête dès la préparation.

## 2. Lancer les lentilles en parallèle

**Un seul message**, qui contient :

- un appel `Agent` par lentille de `context.lenses` sauf `code-review`. Les prompts sont dans
  `S/references/lens-prompts.md` : le **socle du mode** (`context.mode`) plus le bloc de la
  lentille (variante du mode s'il y en a une), avec les `{…}` remplacés par les valeurs du
  `context.json`, `{skillDir}` par le chemin absolu de `S` et `{skillsRoot}` par celui de son
  dossier parent. Le prompt est complet, aucun renvoi à cette conversation ;
- pour la lentille `code-review` :
  - **mode PR** : l'appel `Skill` à **`code-review`**, args `<context.level> <pr.url>`, **sans**
    `--comment` (c'est cette skill qui publie, pas `/code-review`). Il revoit toute la PR, backend
    compris : ses findings backend sont écartés à la consolidation ;
  - **mode dossier** : **pas** de skill `/code-review`. Avec un chemin pour cible, elle ne revoit
    que les changements non commités de ce chemin, donc rien sur du code commité. On lance à la
    place un `Agent` `general-purpose` avec le bloc « code-review (mode dossier) » de
    `lens-prompts.md`, qui écrit lui-même `{findingsDir}/code-review.json`.

Mode PR : `/code-review` ne revoit que le repo du cwd. Si ce cwd n'est pas le repo de la PR, ou si
la skill ne sait pas résoudre l'URL, on la relance dans un `Agent` `general-purpose`. Son prompt
lui demande d'invoquer la skill `code-review` avec les args `<level> <numéro>` en travaillant
depuis `{worktree}`, sans `--comment`, et de rendre ses findings au format de
`S/references/findings-schema.md`.

En mode PR, une fois `/code-review` terminé, on recopie ses findings (`ReportFindings`) dans
`{findingsDir}/code-review.json`, au format commun : `file` devient `path`, `summary` devient
`title` et `body`, `failure_scenario` complète le `body`, et la sévérité se déduit de la gravité
du scénario.

## 3. Consolider

Le script `S/scripts/consolidate.mjs` fait la partie mécanique. On ne garde que le jugement.

1. **Propositions** : `node ${CLAUDE_SKILL_DIR}/scripts/consolidate.mjs {contextFile} --propose`. Le script lit les
   `{findingsDir}/*.json` et applique les filtres de périmètre : fichiers backend, fichiers hors
   du dossier revu, P0 en confiance low. Il numérote chaque finding `lentille#i` et imprime :
   - les lentilles en échec, à signaler sans les relancer ;
   - les **groupes sûrs** : même fichier, lignes à 3 près. Ils sont *probablement* des
     doublons, mais deux problèmes différents peuvent tomber sur les mêmes lignes ;
   - les **paires à juger** : textes proches, sur un autre fichier ou loin dans le même fichier.
     C'est le cas typique d'un même défaut transverse (code mort, styles non scopés) ancré à
     des endroits différents selon la lentille ;
   - les **isolés**.
2. **Vérification** : chaque P0 et P1 se relit dans le code. En mode PR, on passe par
   `git -C {worktree} show {headSha}:<path>`. En mode dossier, on lit `Read {target.root}/<path>`.
   Un finding démenti par le code est écarté (`drop`). Si le contexte réel réduit ou aggrave
   l'impact, la sévérité change (`override` ou `severity` du groupe, avec une `note`). En mode PR,
   on écarte aussi tout finding sur une ligne que la PR ne touche pas et qu'elle ne rend pas
   fautive.
3. **Décisions** : on écrit `{outDir}/merge.json`, qui ne contient **que** les décisions. Tout id
   non cité reste un finding seul.

   ```json
   {
     "groups":   [ { "ids": ["stack#2", "code-review#2"], "severity": "P3", "title": "…",
                     "body_from": "stack#2", "note": "Composant sans appelant." } ],
     "drop":     [ { "id": "superpowers#14", "reason": "confiance faible" } ],
     "override": { "clean-code#1": { "severity": "P3", "note": "…" } },
     "strengths": [ "3 points forts au plus, dédoublonnés, avec `path:line`" ]
   }
   ```

   Dans un groupe, sauf indication contraire, le script retient la sévérité la plus haute, le
   `body` le plus complet et la suggestion la plus précise. Il note aussi les lentilles d'origine.
4. **Application** : `node ${CLAUDE_SKILL_DIR}/scripts/consolidate.mjs {contextFile} --apply {outDir}/merge.json`.
   Le script trie les findings de P0 à P3 puis par fichier, et écrit `{outDir}/consolidated.json`
   ainsi que la sortie du mode :
   - **mode PR** : `{outDir}/review.json` (`{ body, comments }`). La synthèse contient le verdict
     (✅ / ⚠️ P1 / ⛔ P0), le tableau des sévérités, les lentilles, les fichiers hors périmètre, les
     points forts, les points clés P0/P1 et les remarques `line: null`. Il y a un commentaire
     inline par finding qui a une `line` (`**🔴 P0 · catégorie** · titre`, body, bloc
     `suggestion`, lentilles) ;
   - **mode dossier** : `{context.reportFile}` (`revue.md`). Il contient la santé du code, le
     tableau des sévérités, les lentilles, le hors-périmètre, les statistiques de fusion, les
     points forts, les remarques générales, puis une section par sévérité. Chaque finding y
     prend la forme `` `path:line` · catégorie · titre ``, avec son body, ses notes de
     consolidation, sa suggestion et ses lentilles.

   Une erreur (id inconnu, id cité deux fois) se corrige dans `merge.json` avant de relancer.

## 4. Relire la sortie

On relit rapidement le fichier produit. Les titres doivent être clairs et en français. On vérifie
aussi qu'aucun finding ne porte sur le backend ni sur un fichier hors périmètre. S'il faut
corriger un point, on retouche `merge.json`, avec un `title` ou une `note`, et on relance
`--apply` : on n'édite pas la sortie à la main, pour qu'elle reste reproductible.

## 5. Restituer

### Mode PR : aperçu, puis publication

1. `node ${CLAUDE_SKILL_DIR}/scripts/post-review.mjs {contextFile} {outDir}/review.json --dry-run` : on récupère le
   nombre de commentaires inline et le nombre de remarques basculées dans le corps.
2. On montre à l'utilisateur la synthèse, puis la liste des commentaires inline
   (`sévérité path:line titre`).
3. Si `context.post` est `false` (`--no-post`) : on s'arrête là et on donne le chemin de
   `review.json`.
4. Sinon on demande confirmation par `AskUserQuestion`, puisqu'une review GitHub notifie l'auteur
   et les reviewers. Les options : « Publier », « Publier sans les P3 », « Ne pas publier ».
   **Rien ne se publie sans cet accord.**
5. Après accord : `node ${CLAUDE_SKILL_DIR}/scripts/post-review.mjs {contextFile} {outDir}/review.json`. Le script
   imprime l'URL de la review, qu'on transmet. Si GitHub renvoie une 422, on lit l'erreur, on
   bascule les commentaires fautifs dans le corps et on republie une seule fois.

### Mode dossier : rapport

On affiche dans le terminal la synthèse (santé du code, tableau des sévérités, points forts),
puis la liste `sévérité path:line titre` de tous les findings, et enfin le **chemin absolu** de
`revue.md`. Pas de `post-review.mjs` et pas de confirmation : rien ne sort de la machine.

## 6. Nettoyer

`node ${CLAUDE_SKILL_DIR}/scripts/cleanup.mjs {contextFile}` retire le worktree en mode PR, et n'a aucun effet en
mode dossier. Le clone partiel reste dans `~/.cache/reviewing-code/` et accélère les revues
suivantes du même repo.

## Garde-fous

- On ne modifie jamais le code revu, on ne pousse rien, on n'approuve pas et on ne demande pas de
  changements : en mode PR, `event` vaut toujours `COMMENT`.
- Mode dossier : aucune écriture dans le repo revu et aucune commande git qui modifie son état
  (pas de checkout, stash, add ni commit). On écrit seulement dans `{outDir}`.
- Chaque lentille ne reçoit que des chemins et des SHA, jamais l'historique de cette conversation.
- Revue **front uniquement** : jamais de commentaire sur un contrôleur, un modèle, une library
  ou une config PHP, ni sur des tests PHPUnit ou du SQL, même quand `/code-review` en remonte.
