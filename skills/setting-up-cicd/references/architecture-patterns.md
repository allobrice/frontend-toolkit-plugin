# Architecture Patterns — Reference

> Patterns d'architecture pour CI/CD multi-environnements. Lue dès qu'il y a 2 environnements ou
> plus. C'est ici que se joue la maintenabilité long terme d'un setup CI/CD.

**Sources de changelog utilisées dans ce fichier**

- <https://github.blog/changelog/2026-05-07-github-actions-concurrency-groups-now-allow-larger-queues/>

## Sommaire

1. Le problème : duplication entre workflows par environnement
2. Pattern recommandé : reusable workflow centralisé (`workflow_call`)
3. Anatomie d'un setup multi-env propre
4. Gérer les différences entre environnements (sans `if:` partout)
5. Environments GitHub : protection, secrets, gates
6. Concurrency par environnement
7. Anti-patterns multi-env
8. Migration : passer d'un workflow par env à un base reusable

---

## 1. Le problème : duplication entre workflows par environnement

Setup typique « naïf » :

```
.github/workflows/
├── deploy-staging.yml      ← 150 lignes
├── deploy-preprod.yml      ← 150 lignes (95% identiques)
└── deploy-prod.yml         ← 150 lignes (95% identiques)
```

Problèmes :
- Toute évolution = modifier 3 fichiers à la main, risque de drift entre envs
- Bug fixé en staging mais pas en prod parce qu'on a oublié de propager
- Diff de revue de PR illisible (« +12, -8 dans 3 fichiers »)
- Onboarding douloureux : comprendre pourquoi 3 fichiers font « presque la même chose »

**Si tu vois ça, c'est P1**. La factorisation via `workflow_call` est le remède.

---

## 2. Pattern recommandé : reusable workflow centralisé

### Structure cible

```
.github/workflows/
├── deploy-base.yml         ← LE workflow réutilisable (workflow_call)
├── deploy-features.yml     ← caller : push sur feature/* → appelle base avec env=feature
├── deploy-preprod.yml      ← caller : push sur release/* → appelle base avec env=preprod
└── deploy-prod.yml         ← caller : push sur main ou tag → appelle base avec env=prod
```

### Le caller (workflow par environnement)

```yaml
name: CI_Preprod

on:
  push:
    branches: [release/*]

concurrency:
  group: preprod_deployment
  cancel-in-progress: false        # Ne JAMAIS couper un deploy en cours

permissions:
  contents: read

jobs:
  call-base:
    uses: ./.github/workflows/deploy-base.yml
    with:
      environment_name: preprod
      server_dir: /preprod/
      verify_url: https://preprod.example.com
    secrets:
      ftp_server:     ${{ secrets.FTP_SERVER }}
      ftp_username:   ${{ secrets.FTP_USERNAME }}
      ftp_password:   ${{ secrets.FTP_PASSWORD }}
      gpg_key:        ${{ secrets.GPG_KEY }}
      op_token:       ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
      teams_webhook:  ${{ secrets.TEAMS_WEBHOOK }}
```

**Le caller fait 3 choses, pas plus** :
1. Définit *quand* (triggers : branches, tags, manuel)
2. Définit *quoi* via `with:` (env-specific values)
3. Passe les secrets via `secrets:` (ou `secrets: inherit` si tous identiques)

### Le base (workflow réutilisable)

```yaml
name: BASE_CI_CD

on:
  workflow_call:
    inputs:
      environment_name: { required: true, type: string }
      server_dir:       { required: true, type: string }
      verify_url:       { required: false, type: string, default: '' }
      branch:           { required: false, type: string }
    secrets:
      ftp_server:     { required: true }
      ftp_username:   { required: true }
      ftp_password:   { required: true }
      gpg_key:        { required: true }
      op_token:       { required: true }
      teams_webhook:  { required: true }

permissions:
  contents: read

jobs:
  frontend:
    name: 🎨 Build Frontend
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps: [...]

  backend:
    name: 🐘 Build Backend
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps: [...]

  package-deploy:
    name: 📦 Package & Deploy
    needs: [frontend, backend]
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment: ${{ inputs.environment_name }}
    steps: [...]

  notify-on-failure:
    name: 🔔 Notify
    needs: [frontend, backend, package-deploy]
    if: failure()
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps: [...]
```

**Le base ne sait pas** :
- Qui l'a appelé (feature ? preprod ? prod ?)
- Sur quelle branche on est
- Quelle est la "vraie" cible

Il reçoit tout via `inputs` et `secrets`. C'est ce qui le rend réutilisable.

---

## 3. Anatomie d'un setup multi-env propre

### Ce qui va dans le caller

| Élément | Pourquoi |
|---|---|
| `on:` (triggers) | Spécifique à l'environnement (branches, tags, dispatch) |
| `concurrency:` | Politique par env (PR = cancel ; prod = pas de cancel) |
| `inputs` passés à base | Différences déclaratives entre envs |
| Mapping de secrets | Mapping noms applicatifs → secrets GitHub |

### Ce qui va dans le base

| Élément | Pourquoi |
|---|---|
| Les jobs réels (build, test, package, deploy, notify) | Logique mutualisée |
| `permissions:` | Politique de sécurité du workflow |
| `timeout-minutes:` | Toujours sur chaque job |
| Logique conditionnelle stack-aware (`if: inputs.environment_name == ...`) | Diffs ciblés entre envs |

### Ce qui NE doit PAS être dans le base

- `on: push: ...` → c'est l'affaire du caller
- Des `if: github.ref == 'refs/heads/main'` → utilise `inputs.environment_name` à la place
- Des secrets hardcodés (même `secrets.X` direct) → toujours via `secrets:` du `workflow_call`

---

## 4. Gérer les différences entre environnements

Trois techniques, par ordre de préférence :

### 4.a — Variables via `inputs` (préféré)

```yaml
# caller
with:
  domain: preprod.example.com
  cdn_distribution_id: E1A2B3C4D5

# base
- run: aws cloudfront create-invalidation --distribution-id ${{ inputs.cdn_distribution_id }}
```

### 4.b — `case` dans un step bash (lisible pour de la logique métier)

```yaml
- name: Generate .env
  env:
    DEPLOY_ENV: ${{ inputs.environment_name }}
  run: |
    case "$DEPLOY_ENV" in
      production) DOMAIN="www.example.com" ;;
      preprod)    DOMAIN="preprod.example.com" ;;
      feature)    DOMAIN="${{ inputs.branch }}.feature.example.com" ;;
      *)          echo "::error::Unknown env: $DEPLOY_ENV"; exit 1 ;;
    esac
    echo "BASE_DOMAIN=$DOMAIN" >> .env
```

Préférer ce pattern à 4 jobs conditionnels quand la logique est triviale (mapping de strings).

### 4.c — Job conditionnel (`if:`) — à éviter quand possible

```yaml
deploy-cdn-invalidation:
  if: inputs.environment_name == 'production'
  runs-on: ubuntu-latest
  steps: [...]
```

À utiliser **seulement** si un job entier n'a de sens que dans certains envs (ex: invalidation CDN
prod, smoke tests prod-only). Sinon, passer par 4.a.

### Règle d'or

> **Plus la logique conditionnelle vit dans des `inputs`, mieux c'est.** Un `if:` partout fait
> du base un sapin de Noël illisible.

---

## 5. Environments GitHub : protection, secrets, gates

GitHub permet de déclarer un `environment:` dans un job, ce qui débloque :

- **Required reviewers** : N approbations obligatoires avant exécution du job
- **Wait timer** : délai forcé avant exécution (ex: 30 min de cooling-off avant prod)
- **Deployment branches** : whitelist de branches autorisées à déployer cet env
- **Environment secrets** : secrets scopés à l'env (override des secrets repo)
- **Environment variables** : variables non-sensibles scopées à l'env

```yaml
package-deploy:
  needs: [frontend, backend]
  runs-on: ubuntu-latest
  environment:
    name: ${{ inputs.environment_name }}
    url: ${{ inputs.verify_url }}
  steps: [...]
```

### Quand utiliser `environment:`

| Environnement | `environment:` utile ? |
|---|---|
| `feature` (déploiement par branche) | ❌ Non, trop de friction |
| `staging` / `preprod` | ⚠️ Optionnel, si on veut isoler les secrets |
| `production` | ✅ Oui : required reviewers + branches whitelist |
| `hotfix` | ✅ Oui : reviewers obligatoires + log d'audit |

L'URL passée dans `environment.url` apparaît dans l'onglet Deployments de GitHub → utile pour
naviguer rapidement vers le déploiement en cours.

---

## 6. Concurrency par environnement

Stratégie différente selon l'env :

```yaml
# caller pour PR / feature : on annule les runs précédents
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# caller pour preprod : on sérialise, on n'annule pas, et on met en file
concurrency:
  group: preprod_deployment
  cancel-in-progress: false
  queue: max

# caller pour prod : idem, la file est le point critique
concurrency:
  group: prod_deployment
  cancel-in-progress: false
  queue: max
```

### La règle

> **PR / feature** : `cancel-in-progress: true` (gain de coût, le dernier commit gagne).
> **Preprod / prod** : `cancel-in-progress: false` **et `queue: max`** — un déploiement à moitié
> fait est pire que de l'attente, et un déploiement annulé sans trace est pire que les deux.

`cancel-in-progress: false` **seul ne suffit pas** : avec le défaut `queue: single`, un seul run
peut attendre, et le suivant l'annule en le remplaçant. Deux merges rapprochés sur `main` → le
premier déploiement en attente disparaît silencieusement. `queue: max` porte la file à 100.

⚠️ `queue: max` avec `cancel-in-progress: true` est **interdit** (erreur de validation du
workflow) : les callers PR et les callers de déploiement ne peuvent donc pas partager un même
bloc `concurrency`. C'est un argument de plus pour laisser cette politique dans le caller, jamais
dans le base. Détail des trois contraintes : `github-actions.md` §10.

### Merge queue et environments

La merge queue s'insère **avant** le déploiement, pas à sa place. Deux conséquences à ne pas
confondre :

- Les checks requis tournent sur le commit temporaire de la file. Le workflow qui les porte doit
  déclarer `merge_group` (`testing-and-quality-gates.md` §5). C'est un workflow de **CI**, pas de
  déploiement : il ne doit ni toucher un `environment:`, ni consommer de secret de production.
- Le workflow de **déploiement** reste déclenché sur `push` vers la branche par défaut, après le
  merge effectif. C'est lui qui porte `environment:`, les gates d'approbation et `queue: max`.

Mélanger les deux — un déploiement déclenché sur `merge_group` — déploierait un commit temporaire
qui n'existera peut-être jamais dans l'historique si la file est réorganisée. C'est un **P0**.

Un effet secondaire utile : la merge queue sérialise les merges, donc lisse naturellement la file
de déploiement en aval. Elle ne remplace pas `queue: max` pour autant, puisqu'un
`workflow_dispatch` ou un hotfix peut toujours arriver en parallèle.

### Concurrency key partagée entre callers (avancé)

Si plusieurs workflows (ex: `deploy-prod.yml` + `hotfix.yml`) peuvent déployer le même
environnement, partager la key :

```yaml
concurrency:
  group: ${{ inputs.environment_name }}_deployment   # dans le base
```

→ Évite le scénario « hotfix push pendant qu'un release deploy est en cours ».

---

## 7. Anti-patterns multi-env

| Anti-pattern | Sévérité | Pourquoi |
|---|---|---|
| 3 workflows quasi-identiques (un par env) | 🟠 P1 | Drift inévitable, maintenance × 3 |
| Logique env-aware dans le caller via `if:` plutôt que via `inputs:` | 🟡 P2 | Le base devient dépendant du caller |
| `secrets: inherit` quand seul un sous-ensemble est nécessaire | 🟡 P2 | Surface d'exposition gonflée |
| Pas de `permissions:` dans le base | 🟠 P1 | Permissions héritées par défaut du caller |
| `cancel-in-progress: true` sur prod | 🔴 P0 | Risque de déploiement partiel |
| `queue: max` absent sur un job de déploiement | 🟠 P1 | Le défaut `single` fait perdre un déploiement en attente, sans trace |
| Caller qui contient des `steps:` au lieu de juste appeler base | 🟡 P2 | Brise le contrat single-responsibility |
| Base qui référence `github.ref_name` directement | 🟡 P2 | Doit recevoir la branche en `input`, pas la déduire |
| Pas de `concurrency:` distincte par env | 🟡 P2 | Tous les envs se bloquent mutuellement |

### Exemple : base qui fuit dans l'abstraction

```yaml
# ❌ Mauvais : le base "sait" qu'il y a une branche release
- run: |
    if [[ "${{ github.ref_name }}" == release/* ]]; then
      ./scripts/release-deploy.sh
    fi

# ✅ Bon : le caller dit explicitement ce qu'il veut
# caller :
with:
  deploy_strategy: 'release'

# base :
- run: ./scripts/${{ inputs.deploy_strategy }}-deploy.sh
```

---

## 8. Migration : passer d'un workflow par env à un base reusable

### Plan en 5 étapes

**1. Recenser** : lister les 2-N workflows existants côte-à-côte, identifier les diffs réels
   (ce qui change vraiment d'un env à l'autre).

**2. Extraire les inputs** : tout ce qui diffère devient un `input` de base
   (environment_name, server_dir, verify_url, branch...).

**3. Extraire les secrets requis** : lister tous les `secrets.X` utilisés, les rendre explicites
   dans `workflow_call.secrets`.

**4. Créer `deploy-base.yml`** : recopier les jobs, remplacer les valeurs hardcodées par
   `${{ inputs.X }}` ou `${{ secrets.X }}`.

**5. Réécrire les callers** : chaque ancien workflow devient ~20 lignes (triggers + concurrency
   + `uses:` + `with:` + `secrets:`).

### Checklist de validation post-migration

- [ ] Chaque caller fait < 50 lignes
- [ ] Le base ne référence aucun `github.ref` directement (sauf `github.run_id` / `github.sha`)
- [ ] Tous les secrets sont déclarés dans `workflow_call.secrets:`
- [ ] `permissions:` est déclaré dans le base
- [ ] `timeout-minutes:` sur chaque job du base
- [ ] `concurrency:` cohérente avec la criticité de chaque env, avec `queue: max` sur les envs déployés
- [ ] Aucun caller de déploiement déclenché sur `merge_group`
- [ ] Un smoke test consomme réellement `verify_url` (cf. `release-and-delivery.md` §1)
- [ ] Un chemin de rollback existe et a été testé (cf. `release-and-delivery.md` §2-3)
- [ ] Un dry-run sur un env de test passe avant de toucher la prod

### Gain typique observé

- **-60% de lignes** YAML totales (3×150 → 1×200 + 3×30)
- **0 drift** entre envs (par construction)
- **Diff de PR lisible** : un changement = un fichier (le base)
- **Onboarding** : nouveau dev comprend l'archi en 5 min via le base
