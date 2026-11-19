# Optimization — Reference

> Patterns d'optimisation pour CI/CD : cache, parallélisme, jobs conditionnels, choix du runner.
> Réduire le temps de pipeline et le coût compute sans sacrifier la fiabilité.

**Sources de changelog utilisées dans ce fichier**

- <https://github.blog/changelog/2026-01-29-arm64-standard-runners-are-now-available-in-private-repositories/>
- <https://github.blog/changelog/2026-06-25-actions-steps-can-now-be-run-in-parallel/>
- <https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/>

## Sommaire

1. Principes d'optimisation CI/CD
2. Cache — qu'est-ce qu'on cache, dans quel ordre
3. Parallélisme — jobs, et désormais steps
4. Jobs conditionnels & path filters
5. Factorisation — renvois
6. Choix du runner, dont arm64
7. Anti-patterns de performance
8. Estimer un gain — table de référence

---

## 1. Principes d'optimisation CI/CD

Trois axes, dans l'ordre de priorité :

1. **Ne pas faire** ce qui n'est pas nécessaire → conditional jobs, path filters
2. **Faire en parallèle** ce qui peut l'être → jobs indépendants
3. **Faire plus vite** ce qui doit être fait → cache, runner adapté

> Toujours optimiser **dans cet ordre**. Cacher un test inutile est moins efficace que ne
> pas le lancer.

### Mesurer avant d'optimiser

Avant de toucher à un workflow lent, lister :
- Temps total observé (médiane sur 5-10 runs)
- Temps par job (UI GitHub → Actions → run → "View workflow file" + durées)
- Temps des steps les plus longs

Sans cette base, l'optimisation relève de la roulette.

Deux sources à utiliser plutôt que l'intuition :

- **Actions Performance Metrics** (onglet Insights du dépôt ou de l'organisation) : durée médiane
  par workflow et par job, taux d'échec, temps d'attente de runner. C'est ce qui distingue « la CI
  est lente » de « la CI attend un runner 4 minutes ».
- **La consommation** (Settings → Billing) : minutes par workflow, stockage d'artefacts et de
  cache. Un pipeline coûteux et un pipeline lent ne sont pas toujours le même pipeline — une matrix
  inutile coûte cher sans rallonger le temps perçu, puisqu'elle tourne en parallèle.

---

## 2. Cache — qu'est-ce qu'on cache, dans quel ordre

### Ordre d'impact (du plus rentable au moins rentable)

| Niveau | Cible | Gain typique |
|---|---|---|
| 1 | Dépendances package manager (`node_modules` ou cache pnpm/npm/yarn) | -1 à -3 min |
| 2 | Cache Next.js / Nuxt / Turbo | -30s à -2 min |
| 3 | Cache Docker Buildx (`type=gha`) | -1 à -5 min |
| 4 | Cache TypeScript build info (`*.tsbuildinfo`) | -10s à -30s |
| 5 | Cache outils tiers (Cypress, Playwright browsers) | -30s à -1 min |

### Cache dépendances (intégré à `setup-node`)

```yaml
- uses: actions/setup-node@v7
  with:
    node-version-file: '.nvmrc'
    cache: 'pnpm'
    cache-dependency-path: '**/pnpm-lock.yaml'
```

> C'est **gratuit** et **automatique**. Tout workflow Node sans ça → P1.

### Cache Next.js (`.next/cache`)

```yaml
- uses: actions/cache@v6
  with:
    path: ${{ github.workspace }}/.next/cache
    key: nextjs-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ hashFiles('**/*.[jt]s', '**/*.[jt]sx', '!**/node_modules/**') }}
    restore-keys: |
      nextjs-${{ hashFiles('**/pnpm-lock.yaml') }}-
```

**Stratégie** : key précise (sources + lockfile), `restore-keys` plus laxe (lockfile seul) pour
hit partiel sur les PRs.

### Cache Nuxt (`.nuxt`, `node_modules/.cache`)

```yaml
- uses: actions/cache@v6
  with:
    path: |
      .nuxt
      node_modules/.cache
    key: nuxt-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ hashFiles('nuxt.config.*', 'app.config.*') }}
    restore-keys: |
      nuxt-${{ hashFiles('**/pnpm-lock.yaml') }}-
```

### Cache Turbo (monorepo)

```yaml
- uses: actions/cache@v6
  with:
    path: .turbo
    key: turbo-${{ github.job }}-${{ github.ref_name }}-${{ github.sha }}
    restore-keys: |
      turbo-${{ github.job }}-${{ github.ref_name }}-
      turbo-${{ github.job }}-
```

> Pour un usage > 5 devs : envisager **Turbo Remote Cache** (Vercel ou self-hosted) → cache
> partagé entre devs + CI.

### Cache Docker Buildx

Voir `deploy-targets.md` §5.

### Règles d'or du cache

1. **Key précise** + **restore-keys plus larges** → un hit partiel reste utile
2. **Inclure le lockfile** dans la key → invalidation automatique au changement de dépendances
3. **Ne pas cacher `node_modules`** directement → passer par le cache du package manager
4. **Vérifier le hit rate** dans les logs : `Cache restored successfully` vs `Cache not found`
5. **Surveiller la taille** : le cache d'un dépôt est plafonné, et l'éviction est silencieuse.
   Un cache saturé par des entrées obsolètes fait tomber le hit rate sans message d'erreur

### ⚠️ Cache en lecture seule sur certains triggers

Certains triggers ne peuvent plus **écrire** dans le cache sur le scope de la branche par défaut.
Le motif de sécurité est traité dans `security-supply-chain.md` §6 ; voici la conséquence
opérationnelle.

| Accès | Triggers |
|---|---|
| **Read-write** | `push`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`, et tout trigger dont le scope de cache n'est pas la branche par défaut (`pull_request`, `release`) |
| **Read-only** | `pull_request_target`, `issue_comment`, cascades `workflow_run` issues d'une PR de fork, et tout trigger sans accès en écriture au dépôt |

**L'échec est silencieux.** `actions/cache` logue un avertissement et le job continue sans
sauvegarder. Aucune étape ne passe au rouge. Le symptôme est un hit rate qui s'effondre sans
qu'aucun run n'échoue — le genre de régression qui reste des mois en place.

**Les restores ne sont pas affectés** : lire depuis le cache fonctionne partout.

#### Cas réel de casse

Un workflow de release déclenché sur `pull_request` de type `closed` — un pattern courant pour
« publier quand la PR est mergée ». Le trigger perd son token d'écriture sur le scope concerné, et
le cache de build cesse d'être alimenté. Le workflow continue de passer, simplement plus lentement,
run après run.

#### Le pattern de contournement

Séparer l'écriture de la lecture : un workflow sur trigger fiable remplit le cache, les workflows
non fiables se contentent de le restaurer.

```yaml
# warm-cache.yml — écrit le cache sur un trigger read-write
on:
  push:
    branches: [main]
jobs:
  warm:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
```

```yaml
# côté trigger non fiable : restauration seule, jamais de save
- uses: actions/cache/restore@v6
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: ${{ runner.os }}-pnpm-
```

`actions/cache/restore` rend l'intention explicite : le workflow lit, il n'écrit pas. Utiliser
`actions/cache` tout court sur un trigger read-only n'échoue pas — il ne fait simplement rien à la
fin du job, ce qui est plus difficile à diagnostiquer.

---

## 3. Parallélisme — extraire ce qui peut tourner en //

### Pattern de base : 3 jobs indépendants

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [...]

  typecheck:
    runs-on: ubuntu-latest
    steps: [...]

  test:
    runs-on: ubuntu-latest
    steps: [...]

  build:
    needs: [lint, typecheck, test]
    runs-on: ubuntu-latest
    steps: [...]
```

→ Temps total = `max(lint, typecheck, test) + build`
→ Au lieu de `lint + typecheck + test + build`.

### Coût vs gain — jobs parallèles

Un job parallèle coûte un setup complet : checkout, installation du toolchain, restauration du
cache. Compter environ 30 s, davantage sur une stack lourde.

- **+1 job** = +1 setup — n'a de sens que si le job dure plus d'une minute
- 3 jobs de 30 s en parallèle : le setup domine, aucun gain réel
- 3 jobs de 3 min en parallèle : ~6 min gagnées sur du séquentiel

C'est ce coût de setup qui justifiait de regrouper des tâches courtes dans un même job, au prix de
leur séquentialité. **Ce compromis n'est plus le seul disponible.**

### Steps parallèles — le compromis a changé

Des mots-clés de niveau step permettent d'exécuter des steps concurremment **dans un même job**,
donc en payant un seul setup :

| Mot-clé | Effet |
|---|---|
| `background` | Lance le step en asynchrone et passe immédiatement au suivant |
| `wait` | Attend la fin d'un ou plusieurs steps `background` nommés |
| `wait-all` | Attend la fin de tous les steps `background` précédents |
| `cancel` | Termine proprement un step `background` devenu inutile |
| `parallel` | Convertit un groupe de steps en steps `background` suivis d'un `wait` |

Trois usages : paralléliser des tâches réellement indépendantes ; démarrer un service de fond,
travailler, puis l'arrêter proprement ; lancer une tâche non bloquante (envoi de télémétrie
pendant l'empaquetage).

> ⚠️ **Syntaxe non reproduite ici volontairement.** Ces mots-clés sont annoncés par le changelog du
> 25/06/2026, mais leur syntaxe exacte — placement, valeurs acceptées, contraintes — n'était pas
> documentée sur la référence de syntaxe de workflow au moment d'écrire ce fichier. Vérifier la
> documentation officielle avant d'en produire un exemple, plutôt que d'extrapoler une forme
> plausible.

### Comment arbitrer désormais

| Situation | Choix |
|---|---|
| Tâches courtes (< 1 min) et indépendantes, même toolchain | **Steps parallèles** — un seul setup |
| Tâches longues, même toolchain | Jobs parallèles : le setup est amorti, et on gagne des logs séparés et un retry par job |
| Toolchains différents (Node et PHP) | Jobs parallèles — les setups ne se partagent pas |
| Besoin d'un statut de check distinct par tâche | Jobs parallèles — un step ne produit pas de check |
| Service de fond nécessaire pendant d'autres steps | Steps `background`, ou `services:` si c'est un conteneur |

Le gain des steps parallèles est le setup économisé ; leur coût est la perte de granularité — un
job unique, un seul statut, des logs entremêlés. Sur une CI de moins de cinq minutes, la
lisibilité vaut souvent mieux que les 30 s gagnées.

### Composite action pour factoriser le setup

Si on a 3 jobs qui partagent le même setup, créer une composite action (voir
`github-actions.md` §11) plutôt que dupliquer 3 fois le code.

### Tests en parallèle (sharding)

Pour des suites de tests longues :

```yaml
test:
  strategy:
    matrix:
      shard: [1, 2, 3, 4]
  runs-on: ubuntu-latest
  permissions:
    contents: read
  steps:
    - run: pnpm test --shard=${{ matrix.shard }}/4
```

Vitest, Playwright, Jest supportent nativement le sharding.

---

## 4. Conditional jobs & path filters

### Path filters (le plus efficace en monorepo)

```yaml
on:
  pull_request:
    paths:
      - 'apps/web/**'
      - 'packages/ui/**'
      - 'pnpm-lock.yaml'
      - '.github/workflows/web.yml'
```

→ Le workflow ne se déclenche **même pas** si rien de pertinent n'a changé. Gratuit.

### Filtrage dynamique avec `dorny/paths-filter`

```yaml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      web: ${{ steps.filter.outputs.web }}
      api: ${{ steps.filter.outputs.api }}
    steps:
      - uses: actions/checkout@v7
      - uses: dorny/paths-filter@ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d # v4.0.3
        id: filter
        with:
          filters: |
            web: ['apps/web/**', 'packages/ui/**']
            api: ['apps/api/**', 'packages/db/**']

  build-web:
    needs: changes
    if: needs.changes.outputs.web == 'true'
    runs-on: ubuntu-latest
    steps: [...]
```

### Skip CI sur certains commits

Pour skip volontairement un workflow (docs only, etc.) :

```yaml
on:
  push:
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

> ⚠️ Attention : `paths` et `paths-ignore` n'agissent pas comme attendu sur les **required
> status checks**. Si une PR ne touche que `.md`, le check ne s'exécute pas → la PR reste
> bloquée. Solution : un job "always-pass" en fallback, ou utiliser des branch protection
> rules basées sur un workflow chapeau.

---

## 5. Factorisation — reusable workflows & composite actions

Traité ailleurs, pour éviter la triple duplication qui existait :

| Besoin | Où |
|---|---|
| Syntaxe `workflow_call`, composite action locale, limites de la plateforme | `github-actions.md` §11 |
| Architecture multi-environnements : base + callers, ce qui va dans chacun | `architecture-patterns.md` |

Le seul angle proprement lié à l'optimisation : **dès qu'un même setup est répété dans 3 jobs ou
plus, le factoriser en composite action.** Le gain n'est pas du temps d'exécution mais de la
cohérence — un cache mal configuré dans une copie sur trois est invisible jusqu'à ce qu'on cherche
pourquoi un job est plus lent que ses voisins.

## 6. Choix du runner

| Label | Quand l'utiliser |
|---|---|
| `ubuntu-latest` | Défaut, la grande majorité des cas |
| `ubuntu-24.04` | Reproductibilité critique — épingler la version au lieu de suivre `latest` |
| `ubuntu-24.04-arm` / `ubuntu-22.04-arm` | Charges arm64, ou recherche d'un meilleur rapport perf/coût |
| `windows-latest`, `windows-11-arm` | Tests spécifiques à Windows |
| `macos-latest` | Builds iOS / macOS uniquement — le runner le plus coûteux |
| Larger runners | Build CPU-bound de plus de 10 min. Réservés aux plans Team et Enterprise Cloud |
| Self-hosted | Hardware spécifique, accès à un réseau privé, très gros volume |

### Runners arm64

Les standard runners arm64 (`ubuntu-24.04-arm`, `ubuntu-22.04-arm`, `windows-11-arm`) sont
disponibles **dans tous les dépôts, privés inclus, depuis le 29 janvier 2026**. Ce sont des runners
GitHub-hosted pleinement supportés, adaptés à des charges CI de production — pas une preview.

| Contexte | Ressources |
|---|---|
| Dépôt privé | 2 vCPU |
| Dépôt public | 4 vCPU |

La consommation s'impute sur les minutes incluses du plan. Deux usages où ils changent vraiment
quelque chose :

- **Build d'images multi-arch** : construire la variante `linux/arm64` sur un runner arm64 natif
  évite l'émulation QEMU, qui multiplie le temps de build par 2 à 4. Voir `deploy-targets.md` §5.
- **Cible de production en arm64** (Graviton, Ampere) : tester sur la même architecture que la
  production plutôt que sur x64.

⚠️ 2 vCPU en dépôt privé, contre 4 pour `ubuntu-latest` : un job CPU-bound peut être **plus lent**
sur arm64. Mesurer avant de basculer, ne pas supposer un gain.

> Pour un larger runner, l'arbitrage se mesure : si le gain en minutes multiplié par le coût
> unitaire reste inférieur au surcoût du runner, l'opération est rentable. Le tester sur un
> échantillon plutôt que le déduire.

---

## 7. Anti-patterns de performance

| Anti-pattern | Coût typique | Fix |
|---|---|---|
| `npm install` sans cache | +1-3 min/run | `cache: 'npm'` dans setup-node |
| Jobs séquentiels qui pourraient être // | +X min | Découper en jobs avec `needs:` |
| Pas de `concurrency` → runs empilés | × N runs en parallèle pour rien | Bloc `concurrency` |
| Matrix sur 3 versions Node "au cas où" | × 3 sur tout | Justifier ou retirer |
| Build complet sur changement de README | Coût total | `paths-ignore: ['**.md']` |
| `fetch-depth: 0` sans raison | +5-30s | Retirer si pas besoin de l'historique |
| Réinstaller des outils à chaque step | +30s par step | Setup global en début de job |
| Cypress/Playwright sans cache browsers | +1-2 min | Cache `~/.cache/Cypress` ou `~/.cache/ms-playwright` |
| Build Docker sans `cache-from`/`cache-to` | +5-10 min | Ajouter cache GHA |
| Cache key trop large (`hashFiles('**/*')`) | Cache miss systématique | Key précise + restore-keys laxes |
| Cache sans `restore-keys` | Pas de hit partiel | Toujours au moins 1 fallback |
| Écriture de cache sur un trigger read-only | Hit rate qui s'effondre, **sans erreur** | Séparer warm-cache et restore (§2) |
| Jobs séparés pour des tâches de moins d'une minute | Le setup coûte plus que le parallélisme | Steps parallèles dans un seul job (§3) |
| Larger runner sur un job I/O-bound | Surcoût sans gain | Mesurer avant : le CPU n'était pas le goulot |
| Bascule sur arm64 sans mesure | Peut être **plus lent** (2 vCPU en dépôt privé) | Comparer sur un échantillon (§6) |

---

## 8. Estimer un gain — table de référence

À utiliser pour le rapport en mode audit :

| Action | Gain estimé |
|---|---|
| Ajout cache `setup-node` | -1 à -3 min |
| Ajout cache `.next/cache` | -30s à -2 min |
| Ajout cache Docker Buildx | -1 à -5 min |
| Parallélisation 3 jobs (lint/test/typecheck) | -2 à -5 min |
| Path filter sur monorepo | -50% des runs |
| Suppression matrix injustifiée | -50% à -66% du coût |
| Composite action factorisée | -5s à -30s par job |
| Sharding tests (4 shards) | -50% à -70% sur la suite tests |
| `concurrency: cancel-in-progress` (PR) | −X runs pour X commits successifs |
| Steps parallèles au lieu de jobs, sur des tâches courtes | −30 s par job supprimé |
| Build arm64 natif au lieu de QEMU (multi-arch) | −50 % à −75 % sur l'étape arm64 |
| Réparation d'une écriture de cache sur trigger read-only | Restaure le gain du cache, souvent −1 à −3 min |

### Exemple de synthèse d'audit

> "Pipeline actuelle : ~14 min médiane. Recommandations :
> - Cache pnpm manquant (-2 min)
> - Lint et test séquentiels alors qu'indépendants (-3 min)
> - Cache `.next/cache` absent (-1 min)
> - **Estimation post-optimisation : ~8 min** (-43%)"
