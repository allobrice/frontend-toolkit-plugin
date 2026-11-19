# Prompts des lentilles

Chaque prompt commence par le **socle du mode** (`context.mode`) : socle PR ou socle dossier. On
y remplace les `{…}` par les valeurs du `context.json` (et `{skillDir}` / `{skillsRoot}` par les
chemins absolus du skill et du dossier qui contient les skills), puis on ajoute le bloc propre à la
lentille, dans sa variante « mode dossier » quand elle existe.

## Socle PR (`mode: "pr"`, en tête de chaque prompt)

```
Tu fais la revue de la PR {pr.url} : « {pr.title} » ({pr.owner}/{pr.repo}, base {pr.baseRef}).

Description de la PR :
<<<
{pr.body, tronquée à 3000 caractères}
>>>

- Checkout de la PR (lecture seule, ne modifie rien, ne déplace pas HEAD) : {worktree}
- Diff à revoir : {diffFile}, **déjà restreint au périmètre front**. Pour un fichier précis :
  `git -C {worktree} diff {baseSha} {headSha} -- <path>`
- Lignes commentables par fichier (côté head) : {commentableFile}
- Fichiers à revoir : {liste path + status de context.files}

**Périmètre : front uniquement.** Ne revois pas le backend, ne le commente pas et n'émets aucun
finding dessus : contrôleurs, modèles, libraries et config PHP, `application/**` hors `views/`,
tests PHPUnit, `composer.*`, SQL. Fichiers backend de cette PR, exclus : {excludedFiles, ou
« aucun »}. Tu peux en lire un pour comprendre un contrat (la forme d'une réponse d'API, par
exemple), mais tes findings ne portent que sur les fichiers à revoir.

Avant de juger, lis les conventions **du repo de la PR**, qui ne se chargent pas d'elles-mêmes
depuis ce checkout : `{worktree}/CLAUDE.md`, les `REVIEW.md` du chemin de chaque fichier modifié,
et les fichiers de `{worktree}/.claude/rules/` dont le périmètre (`paths:` ou dossier
`front/`, `back/`, `backoffice/`) correspond aux fichiers modifiés. Un écart à ces conventions est
un finding (`category: conventions`) qui cite la rule.

Tu ne lances pas de sous-agent. Tu n'écris rien sur GitHub.

Sortie : écris {findingsDir}/{lentille}.json au format décrit dans
{skillDir}/references/findings-schema.md (lis-le d'abord), puis ta réponse
finale tient en une ligne : `OK <n> findings → <chemin>`.
```

## Socle dossier (`mode: "dir"`, en tête de chaque prompt)

```
Tu fais la revue du code existant dans `{target.dir}` du repo {target.repo}
(racine : {target.root}, HEAD {headSha}{, avec des modifications non commitées si target.dirty}).
Ce n'est pas la revue d'un diff : tout le code du périmètre est à juger tel qu'il est
aujourd'hui dans l'arbre de travail.

- Arbre de travail, en **lecture seule** : {target.root}. Ne modifie aucun fichier et ne lance
  aucune commande git qui change l'état (checkout, stash, add, commit…).
- Fichiers à revoir, avec leur nombre de lignes : {fileListFile}
  ({files.length} fichiers, {totalLines} lignes)

**Périmètre : front uniquement.** Ne revois pas le backend, ne le commente pas et n'émets aucun
finding dessus : contrôleurs, modèles, libraries et config PHP, `application/**` hors `views/`,
tests PHPUnit, `composer.*`, SQL. Fichiers backend du dossier, exclus : {excludedFiles, ou
« aucun »}. Tu peux lire un fichier hors périmètre pour comprendre un contrat, mais tes findings
ne portent que sur les fichiers à revoir.

Avant de juger, lis les conventions du repo : `{target.root}/CLAUDE.md`, les `REVIEW.md` du
chemin des fichiers revus, et les fichiers de `{target.root}/.claude/rules/` dont le périmètre
(`paths:` ou dossier `front/`, `back/`, `backoffice/`) correspond aux fichiers revus. Un écart à
ces conventions est un finding (`category: conventions`) qui cite la rule.

Priorise les problèmes réels : bugs, sécurité, fragilités, dette qui gêne vraiment l'évolution
du code. Au plus 25 findings, les plus importants d'abord. Pas de nits en série : un défaut
répété dans plusieurs fichiers donne un seul finding, qui liste les occurrences dans son `body`.

Tu ne lances pas de sous-agent. Tu n'écris rien ailleurs que dans {findingsDir}.

Sortie : écris {findingsDir}/{lentille}.json au format décrit dans
{skillDir}/references/findings-schema.md (lis-le d'abord, règles du mode
dossier), puis ta réponse finale tient en une ligne : `OK <n> findings → <chemin>`.
```

## code-review (mode dossier uniquement)

`subagent_type: general-purpose`. Le socle dossier, puis :

```
Lentille « code-review » (correctness, niveau {level}) : chasse aux bugs uniquement, pas de
style ni de qualité générale. Logique erronée, conditions inversées ou incomplètes, off-by-one,
valeurs null/undefined non gérées, effets de bord à l'hydratation SSR, événements émis au mauvais
moment, accessibilité cassée au point d'empêcher l'usage, tests qui ne testent pas ce qu'ils
prétendent (assertion toujours vraie, mock qui masque le comportement). Chaque finding donne
dans son body un scénario concret (entrée ou état → résultat faux). Aucun finding en confiance
low. Nombre maximal selon le niveau : low 10, medium 15, high et xhigh 25. Le champ "lens" vaut
"code-review".
```

## superpowers

`subagent_type: general-purpose`. Le socle, puis le contenu du template
`requesting-code-review/code-reviewer.md` du plugin superpowers, avec les remplacements suivants :
`[DESCRIPTION]` = titre et description de la PR, `[PLAN_OR_REQUIREMENTS]` = description de la PR
(et ticket Jira si elle le cite), `[BASE_SHA]` = {baseSha}, `[HEAD_SHA]` = {headSha}. Le chemin
du template :
`ls -d ~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/requesting-code-review/code-reviewer.md | sort -V | tail -1`.
On ajoute :

```
Lentille « superpowers » : conformité aux exigences de la PR, cas limites, risques de régression.
Convertis ton verdict (Critical/Important/Minor) en findings : Critical → P0, Important → P1,
Minor → P2 ou P3. La section « Declined to judge » va dans "summary".
```

**Variante mode dossier** : on n'utilise pas le template (il suppose un diff BASE..HEAD et des
exigences). Le socle dossier, puis :

```
Lentille « superpowers » : robustesse du code existant. Cohérence interne (contrats entre
composants, composables, stores et appels d'API du dossier), cas limites non gérés (données
absentes ou vides, erreurs réseau, états de chargement, concurrence), risques de régression
(code fragile, couplage implicite, absence de tests sur une logique critique). Classe en
Critical → P0, Important → P1, Minor → P2 ou P3.
```

## clean-code

`subagent_type: general-purpose`. Le socle, puis :

```
Lentille « clean-code ». Invoque d'abord le skill `writing-clean-code` (outil Skill). S'il est
indisponible, lis {skillsRoot}/writing-clean-code/SKILL.md et ses références utiles. Pars des
symptômes visibles dans le diff (fonctions longues, duplication, conditionnels imbriqués,
couplage, nommage, testabilité) et ne propose un pattern que s'il résout un symptôme constaté.
Pas de refactoring spéculatif.
```

## stack

`subagent_type: general-purpose`. Le socle, puis :

```
Lentille « stack ». Invoque les skills suivants (outil Skill ; s'ils sont indisponibles, lis
{skillsRoot}/<nom>/SKILL.md) : {stack.skills}.
Ne revois que ces fichiers : {stack.frontFiles}.
Cherche les erreurs propres au framework : réactivité Vue (perte de réactivité, watch/computed
mal employés, props mutées, fuites de listeners), typage TS (any, assertions non sûres, types
trop larges), Nuxt 4 (SSR/hydratation, useFetch/useAsyncData, auto-imports, structure app/),
SCSS (tokens et mixins du design system ignorés, valeurs en dur, sélecteurs trop spécifiques).
Rien de ce qui relève de la qualité générale : d'autres lentilles s'en chargent.
```

## seo / perf / archi / a11y

`subagent_type: general-purpose`. Le socle, puis :

```
Lentille « {flag} ». Invoque le skill `{skill}` (outil Skill ; s'il est indisponible, lis
{skillsRoot}/{skill}/SKILL.md et les références qu'il désigne).
IMPORTANT : c'est un audit **du diff de la PR** (en mode dossier : **des fichiers du dossier
revu**), pas du projet entier. Applique la grille du skill
au seul code modifié, et à ce qu'il impacte directement (le composant parent qui rend un composant
modifié, la config qu'il touche). Pas de rapport de score global : seulement des findings ancrés
sur des lignes, plus au plus 3 findings `line: null` pour les impacts transverses introduits par la
PR (en mode dossier : par le périmètre revu). Pas de Lighthouse ni de navigateur : analyse
statique du code.
```
