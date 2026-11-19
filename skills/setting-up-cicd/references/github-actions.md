# GitHub Actions — Reference

> Référence technique de la plateforme : structure, triggers, jobs, cache, matrix, concurrency,
> factorisation, patterns par stack, anti-patterns. Lue dans les trois modes du skill.

**Sources de changelog utilisées dans ce fichier**

- <https://github.blog/changelog/2026-05-07-github-actions-concurrency-groups-now-allow-larger-queues/>
- <https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout/>

## Sommaire

1. Structure de base d'un workflow
2. Triggers (`on:`) — patterns canoniques
3. Jobs, steps et dépendances
4. Actions officielles à privilégier
5. Secrets, variables et environnements
6. Secret managers externes → déplacé dans `security-supply-chain.md`
7. Cache & artefacts
8. Matrix builds
9. Permissions & sécurité → déplacé dans `security-supply-chain.md`
10. Concurrency & timeouts
11. Reusable workflows & composite actions
12. Patterns spécifiques par stack (Vue/Nuxt, React/Next, Node.js, **PHP/Composer**, **PHP + bundler frontend**)
13. Patterns monorepo
14. Anti-patterns courants

---

## 1. Structure de base

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions: {}

jobs:
  ci:
    name: Lint, Test, Build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6.0.10
      - uses: actions/setup-node@v7
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

**Règles** : `name` du workflow toujours présent. `concurrency` toujours présent.
`timeout-minutes` toujours présent.

Trois choix de ce squelette méritent une explication, parce qu'ils ne sont pas les défauts :

- **`permissions: {}` au niveau workflow**, puis élévation par job. Le job hérite alors du strict
  nécessaire au lieu du défaut du dépôt. Un `contents: read` global est déjà mieux que rien, mais
  il accorde la lecture à des jobs qui n'en ont pas besoin.
- **`persist-credentials: false`** sur le checkout. Sans lui, `actions/checkout` laisse le token
  dans `.git/config`, où tout step ultérieur — y compris un script de dépendance — peut le lire.
  À retirer uniquement si un step suivant doit pousser sur le dépôt.
- **`pnpm/action-setup` sans `version:`** : l'action lit le champ `packageManager` de
  `package.json`. Épingler la version dans le workflow *en plus* crée deux sources de vérité qui
  divergeront.

---

## 2. Triggers (`on:`) — patterns canoniques

### Workflow CI standard

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

### Déploiement prod sur tag

```yaml
on:
  push:
    tags: ['v*.*.*']
```

### Déploiement manuel (workflow_dispatch)

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
        required: true
      version:
        type: string
        required: false
```

### Merge queue

```yaml
on:
  pull_request:
    branches: [main]
  merge_group:
    types: [checks_requested]
```

Un workflow porteur d'un check requis **doit** déclarer `merge_group`, sinon il ne s'exécute jamais
dans la file et toutes les PR se bloquent. Détail et diagnostic : `testing-and-quality-gates.md` §5.

### Path filters (monorepo)

```yaml
on:
  pull_request:
    paths:
      - 'apps/web/**'
      - 'packages/ui/**'
      - '.github/workflows/web.yml'
```

### `pull_request_target` et `workflow_run` — ⚠️ DANGER

Les deux triggers ont le **même profil de risque** : ils s'exécutent dans le contexte du dépôt
de base, avec accès aux secrets, tout en étant déclenchés par du contenu venu d'un fork.

À utiliser **uniquement** pour des actions qui n'exécutent pas le code de la PR (labeling,
commentaire automatique). **Jamais** pour builder ou tester du code de fork avec accès aux
secrets — c'est la faille RCE dite *pwn request*.

```yaml
# OK : labeling uniquement, sans checkout du code de la PR
on:
  pull_request_target:
    types: [opened]
permissions:
  pull-requests: write
```

#### Le garde-fou est désormais dans `actions/checkout`

Depuis sa v7, `actions/checkout` **refuse** de récupérer le code d'une PR de fork sous
`pull_request_target` et `workflow_run`. Le refus se déclenche sur un `repository:` pointant le
fork, un `ref:` correspondant aux refs *merge* ou *head* de la PR, ou un `ref:` résolvant le SHA
de ces commits. La protection a été rétroportée aux majeures encore supportées : un workflow sur
tag flottant l'a reçue automatiquement, un workflow épinglé au SHA doit être mis à jour.

Conséquence pratique : rester sur une majeure ancienne, c'est se priver du garde-fou, pas
seulement rater une nouveauté.

Un opt-out existe, `allow-unsafe-pr-checkout`. Le documenter comme tel — **jamais** le produire
dans un exemple, et le traiter comme un **P0** en audit s'il apparaît sans justification écrite
dans le workflow.

---

## 3. Jobs, steps et dépendances

### Jobs parallèles (par défaut)

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [...]
  test:
    runs-on: ubuntu-latest
    steps: [...]
  typecheck:
    runs-on: ubuntu-latest
    steps: [...]
```

Les 3 jobs tournent en parallèle. C'est le défaut — il faut le préserver.

### Dépendances

```yaml
jobs:
  build:
    needs: [lint, test, typecheck]
    runs-on: ubuntu-latest
    steps: [...]

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps: [...]
```

### Job conditionnel

```yaml
deploy:
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

### Outputs entre jobs

```yaml
permissions:
  contents: read

jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - id: version
        run: echo "version=$(jq -r .version package.json)" >> "$GITHUB_OUTPUT"

  build:
    needs: prepare
    runs-on: ubuntu-latest
    steps:
      - run: echo "Building ${{ needs.prepare.outputs.version }}"
```

---

## 4. Actions à privilégier et politique de référence

Deux régimes, selon l'éditeur de l'action. Détail de la politique et outillage de migration :
`security-supply-chain.md`.

| Action | Référence à écrire | Usage |
|---|---|---|
| `actions/checkout` | `@v7` | Toujours. `fetch-depth: 0` seulement si release/changelog |
| `actions/setup-node` | `@v7` | Coupler avec `cache:` |
| `actions/cache` | `@v6` | Cache custom (`.next/cache`, `~/.cache/...`) |
| `actions/upload-artifact` | `@v7` | Artefacts entre jobs |
| `actions/download-artifact` | `@v8` | Récupération d'artefacts |
| `actions/attest` | `@v4` | Attestation de provenance (remplace `attest-build-provenance`) |
| `github/codeql-action` | `@v4` | CodeQL, et upload SARIF via `upload-sarif` |
| `pnpm/action-setup` | SHA | Setup pnpm, avant `setup-node` |
| `shivammathur/setup-php` | SHA | Setup PHP + Composer |
| `docker/setup-buildx-action` | SHA | Build multi-plateforme + cache |
| `docker/login-action` | SHA | Login registry |
| `docker/build-push-action` | SHA | Build + push avec cache GHA |
| `docker/metadata-action` | SHA | Tags & labels OCI automatiques |
| `docker/setup-qemu-action` | SHA | Requis pour le cross-build ARM |

### Politique de référence

| Éditeur | Référence | Raison |
|---|---|---|
| `actions/*`, `github/*` | Tag majeur flottant `@vN` | Éditeur = GitHub, même surface de confiance que la plateforme. Le tag majeur reçoit les correctifs de sécurité automatiquement |
| **Tout le reste, `docker/*` inclus** | SHA complet + `# <tag>` | `docker/*` est une organisation tierce, pas GitHub. Le risque démontré vient de là |

```yaml
# Officielle : tag majeur flottant
- uses: actions/checkout@v7

# Tierce : SHA complet, commentaire de version pour la lisibilité humaine
- uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
```

> Épingler au SHA **sans** Dependabot fige les vulnérabilités au lieu de les éviter.
> `.github/dependabot.yml` avec `package-ecosystem: github-actions` est un prérequis, pas une
> option. Voir `security-supply-chain.md`.

### Vérifier une version — deux appels, pas un

```bash
gh api repos/OWNER/REPO/releases/latest --jq .tag_name          # dernière release
gh api repos/OWNER/REPO/git/refs/tags --jq '.[].ref'            # tags réellement publiés
```

Le second appel n'est pas redondant : **une release n'implique pas un tag majeur flottant.**
`actions/dependency-review-action` publie jusqu'à `v5.0.0` alors que ses tags majeurs s'arrêtent
à `v3` — écrire `@v5` produit un workflow cassé. Il faut `@v5.0.0`. Ne jamais déduire `@vN` d'un
numéro de release.

Le script `scripts/pin-actions.sh` automatise la résolution tag → SHA.
---

## 5. Secrets, variables et environnements

### Secrets repo vs environnement

| Niveau | Usage |
|---|---|
| Repository secrets | Tokens partagés, peu sensibles |
| Environment secrets | Tokens de production, avec gates de protection |
| Organization secrets | Partagés cross-repos |

```yaml
deploy-prod:
  environment:
    name: production
    url: https://app.example.com
  steps:
    - run: ./deploy.sh
      env:
        DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

L'utilisation d'un `environment` permet :
- Protection rules (reviewers requis avant exécution)
- Wait timer
- Branches autorisées

### Variables (non sensibles)

```yaml
env:
  NODE_VERSION: '20.11.0'
  REGISTRY: ghcr.io

jobs:
  build:
    env:
      IMAGE_NAME: ${{ github.repository }}
```

### Masquage manuel

```yaml
- run: echo "::add-mask::$VALUE"
```

À utiliser pour masquer des valeurs dérivées qui ne sont pas dans `secrets`.

---

## 6. Secret managers externes

Déplacé dans `security-supply-chain.md` : 1Password Connect, HashiCorp Vault (auth OIDC),
Doppler, critères de choix entre GitHub Secrets et secret manager externe, et anti-patterns
de nommage multi-environnements.

Rappel minimal : GitHub Secrets pour les credentials *CI*, secret manager externe pour les
secrets *applicatifs* dès qu'il y a rotation fréquente, plusieurs équipes ou une exigence
d'audit trail.

## 7. Cache & artefacts

### Cache via `setup-node`

```yaml
- uses: actions/setup-node@v7
  with:
    node-version-file: '.nvmrc'
    cache: 'pnpm'        # ou 'npm', 'yarn'
    cache-dependency-path: '**/pnpm-lock.yaml'
```

### Cache custom (Next.js, Nuxt, Turbo)

```yaml
- uses: actions/cache@v6
  with:
    path: |
      .next/cache
      node_modules/.cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ hashFiles('**/*.[jt]s', '**/*.[jt]sx') }}
    restore-keys: |
      ${{ runner.os }}-nextjs-${{ hashFiles('**/pnpm-lock.yaml') }}-
```

### Cache Turbo (remote cache local)

```yaml
- uses: actions/cache@v6
  with:
    path: .turbo
    key: turbo-${{ github.job }}-${{ github.ref_name }}-${{ github.sha }}
    restore-keys: |
      turbo-${{ github.job }}-${{ github.ref_name }}-
      turbo-${{ github.job }}-
```

### Artefacts entre jobs

```yaml
build:
  steps:
    - run: pnpm build
    - uses: actions/upload-artifact@v7
      with:
        name: dist
        path: dist/
        retention-days: 1

deploy:
  needs: build
  steps:
    - uses: actions/download-artifact@v8
      with:
        name: dist
        path: dist/
```

---

## 8. Matrix builds

### Multi-versions Node (rare, justifier)

```yaml
strategy:
  fail-fast: false
  matrix:
    node: [18, 20, 22]
runs-on: ubuntu-latest
steps:
  - uses: actions/setup-node@v7
    with:
      node-version: ${{ matrix.node }}
```

> **Coût** : N×runners. À justifier (lib publique multi-versions, oui ; app interne, non).

### Multi-OS

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
runs-on: ${{ matrix.os }}
```

### Exclusions

```yaml
strategy:
  matrix:
    node: [18, 20, 22]
    os: [ubuntu-latest, windows-latest]
    exclude:
      - os: windows-latest
        node: 18
```

---

## 9. Permissions & sécurité

Déplacé dans `security-supply-chain.md` : politique de permissions, `permissions: {}` puis
élévation par job, tableau des permissions par usage, OIDC vers AWS / Azure / GCP, et signaux
de risque P0.

Rappel minimal : déclarer `permissions: {}` au niveau workflow et élever par job. Le défaut
implicite du dépôt est trop large.

## 10. Concurrency & timeouts

### Concurrency (à toujours mettre)

Deux politiques opposées, à ne pas mélanger dans un même bloc.

```yaml
# CI sur PR / branche : le dernier commit gagne, on annule le reste
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

```yaml
# Déploiement : on ne coupe jamais, et on met en file au lieu d'écraser
concurrency:
  group: deploy-production
  cancel-in-progress: false
  queue: max
```

### `queue` — trois contraintes à connaître

| Valeur | Comportement |
|---|---|
| `single` (défaut) | **Un seul** run en attente. Tout nouveau run **annule et remplace** celui qui attendait |
| `max` | Jusqu'à **100** runs en attente, traités séquentiellement. Au-delà du plafond, les runs supplémentaires sont annulés |

1. **`queue: max` avec `cancel-in-progress: true` est interdit** et produit une *erreur de
   validation du workflow*. Ne jamais générer ce couple. C'est aussi pourquoi la forme dynamique
   `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` devient un piège dès qu'on
   ajoute `queue: max` : préférer deux workflows, ou deux callers, avec une politique franche
   chacun.
2. **Plafond de 100** runs en attente par groupe ; au-delà, annulation silencieuse.
3. **Ordre FIFO non garanti** : l'ordre suit l'instant où chaque run *commence à attendre* sur le
   groupe, pas sa date de dispatch. Ne jamais s'appuyer sur `queue: max` pour garantir un ordre
   de déploiement — pour cela, sérialiser en amont.

> **Pourquoi ça compte.** Sans `queue: max`, `cancel-in-progress: false` seul ne protège qu'un
> run : deux merges rapprochés sur `main` et le premier déploiement en attente est annulé et
> remplacé, sans rien dans les logs pour le signaler. Un déploiement disparaît. Sur tout job de
> déploiement, `queue: max` n'est pas une optimisation, c'est la correction d'une perte de run.

### Timeouts

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15        # sinon 360 par défaut, soit 6 h
    permissions:
      contents: read
    steps:
      - run: ./long-task.sh
        timeout-minutes: 5
```

Référence : CI Node ≈ 5-12 min, build Docker ≈ 10-20 min, deploy ≈ 5-10 min.

---

## 11. Reusable workflows & composite actions

### Reusable workflow

Fichier `.github/workflows/_reusable-ci.yml` :

```yaml
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '20'
    secrets:
      NPM_TOKEN:
        required: false

jobs:
  ci:
    runs-on: ubuntu-latest
    steps: [...]
```

Appel :

```yaml
permissions:
  contents: read

jobs:
  call-ci:
    uses: ./.github/workflows/_reusable-ci.yml
    with:
      node-version: '22'
    # Passage explicite : `secrets: inherit` transmettrait TOUS les secrets du dépôt,
    # y compris ceux dont le workflow appelé n'a aucun usage.
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Composite action (locale)

Fichier `.github/actions/setup/action.yml` :

```yaml
name: 'Setup'
description: 'Setup Node + pnpm + install'
runs:
  using: 'composite'
  steps:
    - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6.0.10
      with:
        version: 9
    - uses: actions/setup-node@v7
      with:
        node-version-file: '.nvmrc'
        cache: 'pnpm'
    - run: pnpm install --frozen-lockfile
      shell: bash
```

Usage : `- uses: ./.github/actions/setup`

→ DRY pour les workflows qui répètent le même setup plusieurs fois.

### Limites à connaître

- **Profondeur d'imbrication : 10 niveaux** — le caller de premier niveau, plus jusqu'à neuf
  workflows réutilisables chaînés.
- **`secrets: inherit` ne cascade pas automatiquement** dans les workflows imbriqués : les secrets
  ne sont transmis qu'au workflow directement appelé. Une chaîne de trois niveaux doit les
  repropager à chaque étage.
- Un caller ne peut pas surcharger les `steps:` du workflow appelé. Ce qui doit varier passe par
  `inputs:` — voir `architecture-patterns.md` §4.

### Écrire dans le résumé de run

```yaml
- name: Résumé
  if: always()
  run: |
    {
      echo "## Build"
      echo "| Élément | Valeur |"
      echo "|---|---|"
      echo "| Commit | ${GITHUB_SHA::7} |"
      echo "| Runner | ${RUNNER_OS} |"
    } >> "$GITHUB_STEP_SUMMARY"
```

Le markdown écrit dans `$GITHUB_STEP_SUMMARY` s'affiche sur la page du run. Gratuit, sans action
tierce ni secret. À privilégier avant d'ajouter une notification externe : voir
`release-and-delivery.md` §8.

---

## 12. Patterns spécifiques par stack

### Vue / Nuxt 3-4

```yaml
- run: pnpm build               # → .output/
- name: Upload Nuxt output
  uses: actions/upload-artifact@v7
  with:
    name: nuxt-output
    path: .output
```

Pour Nuxt en mode **standalone** (Docker) :

```yaml
env:
  NITRO_PRESET: node-server     # ou 'docker', 'vercel', 'netlify'
```

### React / Next 14-15

```yaml
- uses: actions/cache@v6
  with:
    path: .next/cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ hashFiles('app/**', 'pages/**', 'components/**') }}
- run: pnpm build               # → .next/
```

Pour Next en **standalone** (Docker) :

```js
// next.config.js
module.exports = { output: 'standalone' }
```

### Vite / Vue 3 SPA

```yaml
- run: pnpm build               # → dist/
- uses: actions/upload-artifact@v7
  with:
    name: dist
    path: dist
```

### Node.js / API backend

```yaml
- run: pnpm typecheck
- run: pnpm test
- run: pnpm build               # optionnel (TS → JS)
```

Si Express / Fastify / Nitro server-only : pas de build front, l'effort va aux tests
d'intégration. Pour provisionner une base ou un cache pendant ces tests, voir
`testing-and-quality-gates.md` §2 (`services:`).

### PHP / Composer

```yaml
- uses: actions/checkout@v7

- name: Setup PHP
  uses: shivammathur/setup-php@f3e473d116dcccaddc5834248c87452386958240 # 2.37.2
  with:
    php-version: '8.3'
    tools: composer:v2
    coverage: none                       # ou 'xdebug' / 'pcov' si tests avec coverage
    extensions: mbstring, intl, pdo_mysql, gd, zip

- name: Cache Composer dependencies
  uses: actions/cache@v6
  with:
    path: vendor                          # ou application/vendors selon le projet
    key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}
    restore-keys: ${{ runner.os }}-composer-

- name: Install Composer dependencies
  run: composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader

- name: Run PHPStan
  run: vendor/bin/phpstan analyse --no-progress

- name: Run PHPUnit
  run: vendor/bin/phpunit --no-coverage
```

**Notes** :
- `--no-dev` en prod uniquement. En CI pour les tests, laisser les dev deps installées.
- `--optimize-autoloader` (ou `-o`) en prod pour de meilleures perfs runtime.
- `setup-php` accepte `extensions:` pour pré-installer les modules natifs (gain de temps vs `apt install`).
- Cache key sur `composer.lock` → invalidation correcte.

### Setup hybride : PHP + bundler frontend (Webpack / Vite)

Pattern courant : un backend PHP (Symfony, Laravel, CodeIgniter, custom) avec un frontend
JS bundlé par Webpack ou Vite, parfois un backoffice JS séparé.

```yaml
permissions: {}

jobs:
  frontend:
    name: 🎨 Build Frontend
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Cache Webpack/Vite intermediate
        uses: actions/cache@v6
        with:
          path: |
            node_modules/.cache
            node_modules/.vite
          key: ${{ runner.os }}-bundler-${{ hashFiles('webpack.config.js', 'vite.config.ts', 'package-lock.json') }}
          restore-keys: ${{ runner.os }}-bundler-

      - run: npm ci
      - run: npm run build

      - uses: actions/upload-artifact@v7
        with:
          name: frontend-build
          path: public/dist/

  backend:
    name: 🐘 Build Backend
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7

      - uses: shivammathur/setup-php@f3e473d116dcccaddc5834248c87452386958240 # 2.37.2
        with:
          php-version: '8.3'
          tools: composer:v2

      - uses: actions/cache@v6
        with:
          path: vendor
          key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}

      - run: composer install --no-dev --optimize-autoloader

  package-deploy:
    name: 📦 Package & Deploy
    needs: [frontend, backend]
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
      - uses: actions/download-artifact@v8
        with:
          name: frontend-build
          path: public/dist/

      # Restaurer le cache vendor/ depuis le job backend
      - uses: actions/cache/restore@v6
        with:
          path: vendor
          key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}

      - run: ./scripts/package-and-deploy.sh
```

**Points clés** :
- **Frontend et backend en parallèle** → gain de ~50% sur le temps total
- **Double cache** : `node_modules/.cache` + `node_modules/.vite` côté frontend, `vendor/` côté backend
- **Job de packaging séparé** : réunit les artefacts buildés et fait le deploy → responsabilité claire
- Si un sous-module a son propre `package.json` (ex: `apps/backoffice/`), faire un 3ᵉ job parallèle dédié

---

## 13. Patterns monorepo

### Path filtering

```yaml
on:
  pull_request:
    paths:
      - 'apps/web/**'
      - 'packages/**'
      - '.github/workflows/web.yml'
```

### Filtrage dynamique (changes detection)

```yaml
- uses: dorny/paths-filter@ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d # v4.0.3
  id: changes
  with:
    filters: |
      web:
        - 'apps/web/**'
        - 'packages/ui/**'
      api:
        - 'apps/api/**'
        - 'packages/db/**'

- if: steps.changes.outputs.web == 'true'
  run: pnpm --filter web build
```

### Turbo + cache

```yaml
- run: pnpm turbo run build test --filter='[origin/main]'
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

Si pas de remote cache : `actions/cache` sur `.turbo` (voir §7).

### pnpm workspaces

```yaml
- run: pnpm --filter './apps/web...' build
- run: pnpm --filter './packages/*' test
```

---

## 14. Anti-patterns courants

| Anti-pattern | Sévérité | Pourquoi |
|---|---|---|
| `uses: <action>@main` ou `@master` | 🟠 P1 | Référence mobile → casse ou compromission silencieuse |
| Version d'action en retard d'une majeure ou plus | 🟠 P1 | Correctifs de sécurité manqués — cf. le durcissement `checkout` v7 (§2) |
| Action tierce sur un tag au lieu d'un SHA | 🟠 P1 | Un tag est repointable par son détenteur |
| `queue: max` absent sur un job de déploiement | 🟠 P1 | Le défaut `single` fait perdre un run en attente, sans trace |
| `queue: max` avec `cancel-in-progress: true` | 🔴 P0 | Erreur de validation : le workflow ne démarre pas |
| `merge_group` absent avec merge queue active | 🟡 P2 | Effet pratique : toutes les PR bloquées |
| Pas de cache `setup-node` | 🟠 P1 | +1 à +3 min par run, pour rien |
| `permissions:` absent | 🟠 P1 | Token avec write-all par défaut |
| `concurrency:` absent | 🟡 P2 | Pile de runs sur push successifs, coût × N |
| `timeout-minutes:` absent | 🟡 P2 | Défaut 6h → coût catastrophique si bug |
| `${{ secrets.X }}` dans un `if:` | 🔴 P0 | Secrets exposés en clair dans les logs |
| `npm install` sans lockfile | 🟠 P1 | Builds non reproductibles |
| `npm install` au lieu de `npm ci` | 🟡 P2 | Pas idempotent en CI |
| Build + Deploy dans le même job | 🟡 P2 | Pas de séparation responsabilité, pas d'artefact |
| Secrets dans `env:` global | 🟠 P1 | Exposé à tous les steps, mêmes ceux qui n'en ont pas besoin |
| Job qui dépend du `success()` implicite | 🟢 P3 | OK mais expliciter `if: needs.x.result == 'success'` est plus clair |
| `${{ github.event.* }}` interpolé dans `run:` | 🔴 P0 | Injection shell → RCE |

### Le piège de l'injection shell

```yaml
# ❌ DANGER
- run: echo "Title: ${{ github.event.pull_request.title }}"

# ✅ SÛR
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "Title: $PR_TITLE"
```

Toute valeur user-controlled (titre PR, body, branch name, commit message) doit passer
par une variable d'environnement, pas par interpolation directe.
