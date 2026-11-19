# Audit & Reporting — Reference

> Barème de sévérité, scoring, cadre DORA et formats de sortie des 3 modes du skill.
> Lue par `SKILL.md` au moment de produire la réponse, quel que soit le mode.

**Sources externes utilisées dans ce fichier** — aucune. Ce fichier définit une convention interne
au skill. Les règles qu'il pondère sont sourcées dans les références qui les portent.

## Sommaire

1. Grille de sévérité P0 → P3
2. Catalogue des findings et leur niveau
3. Scoring global et grade
4. Cadre DORA
5. Format de sortie — mode Génération
6. Format de sortie — mode Adaptation
7. Format de sortie — mode Audit

---

## 1. Grille de sévérité P0 → P3

| Niveau | Label | Critère |
|---|---|---|
| 🔴 | **P0 — Bloquant** | Faille de sécurité exploitable, perte de données ou de déploiement, workflow cassé, absence de tests bloquants avant la prod |
| 🟠 | **P1 — Majeur** | Coût ou lenteur injustifiés, fragilité structurelle, dérive de maintenance, absence de filet (rollback, épinglage) |
| 🟡 | **P2 — Modéré** | Mauvais usage d'un mécanisme, duplication, garde-fou manquant sans conséquence immédiate |
| 🟢 | **P3 — Mineur** | Lisibilité, nommage, regroupement, redondances cosmétiques |

**Pondérer selon le contexte.** Un side-project n'est pas une application bancaire. Un P0 sur un
dépôt privé sans secret de production ne pèse pas comme le même P0 sur un pipeline qui déploie des
paiements. Annoncer la pondération appliquée plutôt que de la taire.

---

## 2. Catalogue des findings et leur niveau

Référence pour classer un finding sans réinventer le barème à chaque audit. La colonne « Détail »
indique où la règle est justifiée.

### Sécurité — P0

| Finding | Détail |
|---|---|
| Secret, token ou identifiant en clair dans le workflow | `security-supply-chain.md` |
| `${{ github.event.* }}` interpolé directement dans un `run:` — injection shell | `github-actions.md` §14 |
| `${{ secrets.X }}` dans un `if:` — valeur exposée en clair | `github-actions.md` §14 |
| `pull_request_target` ou `workflow_run` qui checkout et exécute du code de fork | `github-actions.md` §2 |
| `allow-unsafe-pr-checkout` sans justification écrite dans le workflow | `github-actions.md` §2 |
| `permissions: write-all` sans justification | `security-supply-chain.md` |
| `protocol: ftp` — transfert des credentials et du code en clair | `deploy-targets.md` §6 |
| Déploiement poussant `.git`, `.github`, `.env*` ou `node_modules` vers la cible | `deploy-targets.md` §6 |
| `cancel-in-progress: true` sur un job de déploiement | `architecture-patterns.md` §6 |

### Fiabilité et coût — P1

| Finding | Détail |
|---|---|
| Version d'action en retard d'au moins une majeure | `github-actions.md` §4 |
| Action tierce non épinglée au SHA, ou sur `@main` / `@master` / `@latest` | `security-supply-chain.md` |
| Épinglage SHA **sans** Dependabot `github-actions` — vulnérabilités figées | `security-supply-chain.md` |
| `queue: max` absent sur un job de déploiement — perte silencieuse de run | `github-actions.md` §10 |
| Aucun linting de workflow (`actionlint` / `zizmor`) dans la CI | `security-supply-chain.md` |
| `permissions:` absent au niveau workflow | `security-supply-chain.md` |
| Cache du package manager absent | `optimization.md` §2 |
| Jobs séquentiels alors qu'indépendants | `optimization.md` §3 |
| CI > 10 min sans raison identifiée | `optimization.md` §1 |
| Déploiement sans mécanisme de rollback | `release-and-delivery.md` |
| Déploiement sans smoke test post-deploy | `release-and-delivery.md` |
| 2 workflows ou plus quasi-identiques par environnement | `architecture-patterns.md` §1 |
| `permissions:` absent dans un workflow réutilisable | `architecture-patterns.md` §7 |
| `npm install` sans lockfile — builds non reproductibles | `github-actions.md` §14 |
| Secrets dans un `env:` global du workflow | `github-actions.md` §14 |
| `ssh-keyscan` en CI sur une cible de production (TOFU) | `deploy-targets.md` §7 |

### Hygiène — P2

| Finding | Détail |
|---|---|
| `concurrency:` absent | `github-actions.md` §10 |
| `timeout-minutes:` absent | `github-actions.md` §10 |
| `persist-credentials: false` absent sur le checkout | `github-actions.md` §1 |
| Écriture de cache sur un trigger devenu read-only — échec silencieux | `optimization.md` §2 |
| `merge_group` absent alors que la merge queue est active | `testing-and-quality-gates.md` |
| Matrix injustifiée (multi-versions « au cas où ») | `optimization.md` §7 |
| `fetch-depth: 0` sans besoin d'historique | `optimization.md` §7 |
| `npm install` au lieu de `npm ci` | `github-actions.md` §14 |
| Build et deploy dans le même job, sans artefact intermédiaire | `github-actions.md` §14 |
| Cache sans `restore-keys` — aucun hit partiel | `optimization.md` §2 |
| Runner non optimal pour la charge | `optimization.md` §6 |
| Logique env-aware via `if:` plutôt que via `inputs:` | `architecture-patterns.md` §4 |
| `secrets: inherit` alors qu'un sous-ensemble suffit | `architecture-patterns.md` §7 |
| Plus de 10 secrets applicatifs dans `secrets.*` | `security-supply-chain.md` |

### Forme — P3

Noms de steps absents ou non parlants, jobs mal regroupés, absence de commentaire sur un choix non
évident, redondances cosmétiques, dépendance implicite au `success()` qui gagnerait à être
explicitée.

---

## 3. Scoring global

Mode audit uniquement.

- Base : **100 points**
- P0 = **−20** · P1 = **−8** · P2 = **−3** · P3 = **−1**
- Grade : **A** (85-100) · **B** (70-84) · **C** (50-69) · **D** (< 50)

**Ne pas sur-auditer.** Un workflow sain doit être annoncé comme sain. Un audit qui ne remonte que
des P3 est une bonne nouvelle, pas un échec à compenser en gonflant les sévérités. À l'inverse, ne
pas lisser un P0 pour préserver un grade flatteur : le score sert le diagnostic, il n'est pas le
livrable.

---

## 4. Cadre DORA

Quatre métriques pour juger ce que le pipeline **permet ou empêche structurellement**. Elles ne se
mesurent pas depuis le YAML : elles se déduisent des contraintes qu'il impose.

| Métrique | Ce que le workflow révèle |
|---|---|
| **Deployment frequency** | Un déploiement sur tag manuel uniquement plafonne la fréquence. Un déploiement sur merge la libère. Des gates humains sur chaque environnement la brident volontairement — c'est un choix, pas un défaut |
| **Lead time for changes** | Durée de CI + attente de merge queue + gates d'approbation. Une CI de 25 min sur chaque PR est un plancher de lead time, indépendamment de l'équipe |
| **Change failure rate** | Sans tests bloquants, sans smoke test post-deploy ni environnement de préproduction, le taux d'échec n'est pas mesuré, donc pas maîtrisé |
| **MTTR** | Sans rollback documenté et testé, le temps de restauration est inconnu. C'est le lien le plus direct entre un manque dans le YAML et un indicateur métier |

Usage en audit : une ligne par métrique concernée, par exemple « pas de rollback documenté → MTTR
non maîtrisé ». Ne produire aucun chiffre qui ne soit pas mesuré.

---

## 5. Format de sortie — mode 🆕 Génération

````
# 🚀 Workflow CI/CD — [Nom du projet]

## Contexte détecté
- **Stack** : [Nuxt 4 / Next 15 / Node.js + …]
- **Package manager** : [pnpm / npm / yarn / bun]
- **Build output** : [.output/public / .next / dist]
- **Cible de déploiement** : [Vercel / Netlify / Docker / FTPS / rsync]

## Fichier généré : `.github/workflows/<nom>.yml`

```yaml
[YAML idiomatique, commenté uniquement là où le « pourquoi » n'est pas évident]
```

## Prérequis à configurer

### Secrets GitHub (`Settings → Secrets and variables → Actions`)
| Secret | Origine | Note |
|---|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens | Scope minimal |

### Variables (non sensibles)
| Variable | Valeur exemple |
|---|---|
| `NODE_VERSION` | `20.11.0` |

### Permissions GitHub
[Permissions requises par job, et pourquoi chacune]

### `.github/dependabot.yml`
[Toujours fourni dès qu'une action est épinglée au SHA — sans lui l'épinglage fige les CVE]

## Comment ça se déclenche
[Triggers configurés et effet attendu de chacun]

## Checklist post-installation
- [ ] Tester sur une PR draft avant de merger
- [ ] Vérifier que le 1er run remplit bien le cache
- [ ] Confirmer le déploiement preview
- [ ] Vérifier que `actionlint` et `zizmor` passent sur le workflow produit
````

---

## 6. Format de sortie — mode 🔧 Adaptation

````
# 🔧 Adaptation du workflow — [fichier ciblé]

## Ce qui existe déjà
- [3 à 5 puces sur le workflow actuel et son rôle]

## Ce qui change

```diff
- - run: npm run build
+ - run: pnpm build
+   env:
+     NODE_ENV: production
```

## Pourquoi ces changements
[Justification concise par bloc modifié]

## Impact attendu
- ⏱ Temps de CI : [estimation]
- 🔒 Sécurité : [neutre / +1 / +2]
- 🧪 Couverture : [tests ajoutés / inchangés]

## Risques & points d'attention
- [Nouveau secret à créer, branche protégée à reconfigurer, etc.]
````

---

## 7. Format de sortie — mode 🔍 Audit

````
# 🔍 Audit CI/CD — [Nom du workflow]

## Synthèse exécutive

| Métrique | Valeur |
|---|---|
| Score global | XX/100 — Grade [A/B/C/D] |
| Findings P0 / P1 / P2 / P3 | N / N / N / N |
| Temps CI estimé (avant → après) | ~X min → ~Y min |
| Verdict | ✅ Sain / ⚠️ À optimiser / 🔴 Refonte recommandée |

### Points forts
### Points critiques

## Findings détaillés

| # | Sévérité | Problème | Localisation | Recommandation |
|---|---|---|---|---|
| 1 | 🔴 P0 | … | `<fichier>:<ligne>` | … |

### Explications & corrections (P0 / P1 uniquement)
[Par finding : explication + avant / après en YAML]

## Impact DORA
[Une ligne par métrique concernée. Omettre celles que le workflow n'éclaire pas]

## Plan d'action recommandé
### Immédiat (P0)
### Court terme (P1)
### Moyen terme (P2 / P3)

## Workflow optimisé (optionnel — si l'écart est significatif)

```yaml
[Version réécrite intégrant P0 + P1]
```
````

### Avant de rendre un audit

Lancer `scripts/audit-workflows.sh` : `actionlint` et `zizmor` remontent les findings mécaniques
plus fiablement qu'une lecture. Réserver l'analyse à ce qu'un outil ne voit pas — l'architecture,
la pertinence du découpage en environnements, l'adéquation au contexte métier. Si les outils n'ont
pas pu être exécutés, le dire dans le rapport plutôt que de laisser croire à une couverture
complète.
