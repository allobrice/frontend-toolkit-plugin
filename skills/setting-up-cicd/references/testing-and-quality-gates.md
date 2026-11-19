# Testing & Quality Gates — Reference

> Tests en CI : provisionner des dépendances (`services:`), étager la pyramide, rendre les
> résultats lisibles, traiter la flakiness, et articuler les checks requis avec la merge queue.
> Lue dès qu'il s'agit d'ajouter, d'étager ou de fiabiliser des tests dans un pipeline.

**Sources de changelog utilisées dans ce fichier** — aucun changelog spécifique. Les mécanismes
décrits (`services:`, `merge_group`, `$GITHUB_STEP_SUMMARY`, branch protection) sont des
fonctionnalités stables de la plateforme.

## Sommaire

1. Étager la pyramide en CI
2. `services:` — provisionner des dépendances
3. Rendre les résultats lisibles
4. Flakiness
5. Checks requis et merge queue
6. Le piège `paths` × checks requis

---

## 1. Étager la pyramide en CI

Quatre étages, et surtout : **qui bloque quoi**. Un pipeline où tout bloque est un pipeline que
l'équipe apprend à contourner ; un pipeline où rien ne bloque ne protège rien.

| Étage | Déclencheur | Durée cible | Bloquant ? |
|---|---|---|---|
| **Unitaires** | Chaque PR, chaque push | < 3 min | ✅ Toujours |
| **Intégration** | Chaque PR | < 8 min | ✅ Toujours — c'est ici que `services:` intervient |
| **E2E** | PR vers la branche par défaut, ou après déploiement preview | < 15 min | ✅ Sur un sous-ensemble critique ; la suite complète peut être non bloquante |
| **Performance / charge** | `schedule` nocturne, ou avant release | Libre | ❌ Alerte, jamais bloquant sur une PR |

Deux principes qui évitent la plupart des pipelines mal étagés :

- **Le plus rapide d'abord, et en parallèle.** Lint, typecheck et tests unitaires sont
  indépendants : trois jobs concurrents, pas trois étapes séquentielles. Voir `optimization.md` §3.
- **Les E2E ne bloquent pas sur ce qu'ils ne maîtrisent pas.** Un E2E qui dépend d'une API tierce
  en sandbox échouera pour des raisons étrangères à la PR. Soit on mocke la dépendance et le test
  bloque, soit on ne mocke pas et il n'a pas à bloquer.

Absence totale de test bloquant avant un déploiement de production → **P0**.

---

## 2. `services:` — provisionner des dépendances

`services:` démarre des conteneurs pour la durée d'un job. C'est la réponse à « mes tests ont
besoin d'une base de données » : pas de mock, pas d'installation manuelle, pas de base partagée
entre les runs.

### PostgreSQL

```yaml
integration:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  permissions:
    contents: read

  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
        POSTGRES_DB: app_test
      ports:
        - 5432:5432
      # Sans health-check, les steps démarrent avant que Postgres accepte les connexions
      options: >-
        --health-cmd "pg_isready -U test"
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5

  steps:
    - uses: actions/checkout@v7
      with:
        persist-credentials: false

    - uses: actions/setup-node@v7
      with:
        node-version-file: '.nvmrc'
        cache: 'pnpm'

    - run: pnpm install --frozen-lockfile
    - run: pnpm test:integration
      env:
        DATABASE_URL: postgres://test:test@localhost:5432/app_test
```

### MySQL et Redis, côté PHP

```yaml
services:
  mysql:
    image: mysql:8.4
    env:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: app_test
    ports:
      - 3306:3306
    options: >-
      --health-cmd "mysqladmin ping -h 127.0.0.1 -uroot -proot"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

```yaml
steps:
  - uses: shivammathur/setup-php@f3e473d116dcccaddc5834248c87452386958240 # 2.37.2
    with:
      php-version: '8.3'
      tools: composer:v2
      extensions: mbstring, intl, pdo_mysql, redis
      coverage: pcov

  # En CI de test, garder les dev deps : --no-dev est pour le packaging de prod
  - run: composer install --no-interaction --prefer-dist
  - run: vendor/bin/phpunit --log-junit junit.xml
    env:
      DB_HOST: 127.0.0.1
      DB_PORT: 3306
      REDIS_URL: redis://127.0.0.1:6379
```

### Quatre pièges de `services:`

1. **Toujours un `--health-cmd`.** Sans lui, le premier step démarre dès que le conteneur existe,
   pas quand le service répond. Le symptôme est une CI qui échoue une fois sur cinq sur un
   « connection refused » — de la flakiness pure, causée par le pipeline et non par le code.
2. **`localhost`, pas le nom du service.** Sur un runner hébergé, les steps tournent sur l'hôte et
   les ports sont mappés : la cible est `localhost:5432`. Le nom du service (`postgres:5432`) ne
   fonctionne que si le job lui-même tourne dans un conteneur (`container:`).
3. **Épingler l'image.** `postgres:latest` fait dériver la version de base entre deux runs, et
   `postgres:16` reste un tag mobile. Sur un pipeline sensible, épingler par digest.
4. **`services:` ne s'applique qu'à un job.** Deux jobs qui ont besoin de la même base la déclarent
   chacun — ce sont deux instances distinctes, ce qui est le comportement souhaitable : aucun état
   partagé entre jobs.

---

## 3. Rendre les résultats lisibles

Un test qui échoue dans 400 lignes de log coûte plus cher qu'il ne rapporte.

### Artefacts de rapport

```yaml
- name: Upload test reports
  if: always()          # sinon aucun rapport quand les tests échouent, soit le seul cas utile
  uses: actions/upload-artifact@v7
  with:
    name: test-reports-${{ github.job }}
    path: |
      junit.xml
      coverage/
      playwright-report/
    retention-days: 7   # défaut 90 jours : du stockage facturé pour rien
```

`if: always()` n'est pas un détail. Sans lui, le step est sauté dès que les tests échouent, et le
rapport d'échec — le seul qui intéresse — n'est jamais uploadé.

### Annotations dans la PR

```yaml
- name: Publish test results
  if: always()
  uses: dorny/test-reporter@a43b3a5f7366b97d083190328d2c652e1a8b6aa2 # v3.0.0
  with:
    name: Tests unitaires
    path: junit.xml
    reporter: java-junit
```

Le test qui casse apparaît alors annoté sur la ligne concernée dans la PR, au lieu d'être à
chercher dans les logs.

### `$GITHUB_STEP_SUMMARY`

Le gain le plus rentable du lot : du markdown écrit dans ce fichier s'affiche directement sur la
page du run. Aucune action, aucun coût.

```yaml
- name: Résumé
  if: always()
  run: |
    {
      echo "## Résultats"
      echo ""
      echo "| Suite | Statut |"
      echo "|---|---|"
      echo "| Unitaires | ${{ job.status }} |"
      echo ""
      echo "Couverture : $(cat coverage/summary.txt)"
    } >> "$GITHUB_STEP_SUMMARY"
```

À utiliser aussi pour afficher l'URL d'un déploiement, un diff de taille de bundle, ou la liste
des migrations appliquées.

### Couverture

```yaml
- uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v7.0.0
  with:
    files: coverage/lcov.info
    fail_ci_if_error: false     # une panne du service tiers ne doit pas casser la CI
  env:
    CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

Sur un seuil de couverture : un seuil **différentiel** (« le code ajouté est couvert ») change les
comportements, un seuil global (« 80 % du projet ») produit surtout des tests écrits pour le
chiffre.

---

## 4. Flakiness

Un test instable est plus nuisible qu'un test absent : il apprend à l'équipe à relancer sans lire.

| Cause | Correctif |
|---|---|
| État partagé entre tests | Isolation : base réinitialisée par test ou par fichier, jamais de fixture globale mutable |
| `sleep` arbitraire dans un E2E | Attente explicite sur une condition (`waitFor`, `expect(...).toBeVisible()`) |
| Sélecteurs CSS fragiles | `data-testid`, jamais une classe de style |
| Absence de health-check sur un `service:` | Voir §2, piège n°1 |
| Écart entre environnement local et CI | Aligner les versions via `.nvmrc`, `engines`, images épinglées |
| Parallélisme non maîtrisé | Sharding avec des bases distinctes par shard, pas une base partagée |

Capturer les traces à l'échec, systématiquement :

```yaml
- run: pnpm test:e2e
- uses: actions/upload-artifact@v7
  if: failure()
  with:
    name: playwright-traces
    path: test-results/
    retention-days: 3
```

**Sur les retries.** Un `retries: 2` fait passer la CI au vert sans corriger le bug : le
comportement instable reste en production, où personne ne relance. Un retry est acceptable comme
mesure de confinement temporaire, à condition que l'échec initial soit visible dans le rapport et
qu'un ticket existe. Un retry silencieux et permanent est une dette masquée.

---

## 5. Checks requis et merge queue

### Le trigger `merge_group` est obligatoire

La merge queue construit un commit temporaire mêlant la PR et les précédentes de la file, puis
attend les checks requis **sur ce commit**. Un workflow déclenché uniquement sur `pull_request` ne
s'exécute jamais dans ce contexte : le check requis reste indéfiniment en attente, et **toutes les
PR de la file se bloquent**.

```yaml
on:
  pull_request:
    branches: [main]
  merge_group:
    types: [checks_requested]
```

C'est la panne la plus fréquente à l'activation d'une merge queue. Symptôme à reconnaître : toutes
les PR bloquées sur un check « Expected — Waiting for status to be reported » juste après
l'activation. En audit : merge queue active sans `merge_group` → **P2**, mais avec la mention que
l'effet pratique est un blocage total.

### Ce qui doit être un check requis

| Type | Requis ? |
|---|---|
| Lint, typecheck, tests unitaires | ✅ |
| Tests d'intégration | ✅ |
| Linting de workflow (`actionlint`, `zizmor`) | ✅ |
| E2E — sous-ensemble critique | ✅ |
| E2E — suite complète | ⚠️ Selon la durée : au-delà de 15 min, la file devient le goulot |
| Scan de vulnérabilités | ✅ sur les sévérités hautes uniquement |
| Couverture | ⚠️ En différentiel, pas en absolu |
| Tests de performance | ❌ |

Chaque check requis s'ajoute au *lead time* de chaque PR, y compris en file. C'est un arbitrage
explicite, pas une case à cocher : voir le cadre DORA dans `audit-and-reporting.md` §4.

---

## 6. Le piège `paths` × checks requis

`paths` et `paths-ignore` empêchent le workflow de **se déclencher**. Or un check requis qui ne
s'exécute pas n'est pas « réussi » : il reste *en attente*, et la PR ne peut pas être mergée.

```yaml
# ❌ Une PR qui ne touche qu'un .md ne déclenche rien → check requis en attente → PR bloquée
on:
  pull_request:
    paths-ignore: ['**.md', 'docs/**']
```

Trois issues, par ordre de préférence :

1. **Ne pas mettre de `paths` sur le workflow porteur du check requis.** Filtrer plus bas, au
   niveau des jobs, avec `dorny/paths-filter` : le workflow se déclenche toujours, mais les jobs
   coûteux se sautent. Voir `optimization.md` §4.
2. **Un job « gate » sans filtre** qui réussit toujours et porte le check requis, les jobs réels
   étant conditionnés en amont.
3. **Un workflow chapeau** déclaré comme check requis, appelant les autres via `workflow_call`.

La première est la seule qui ne mente pas sur l'état réel : le check qui passe correspond à un
travail réellement exécuté ou explicitement jugé inutile, pas à un job vide.
