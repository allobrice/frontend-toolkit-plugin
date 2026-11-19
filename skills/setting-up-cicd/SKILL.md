---
name: setting-up-cicd
description: >
  Expert CI/CD GitHub Actions : génération, adaptation et audit de workflows. Analyse le projet
  (stack, package manager, variables d'environnement, cible de déploiement) pour produire un YAML
  idiomatique, sécurisé et rapide. Couvre la CI (lint, test, typecheck, build, cache, services de
  test), le CD (Vercel, Netlify, Docker GHCR/Hub, FTPS/SFTP, rsync-over-SSH), la sécurité
  supply-chain (épinglage SHA, actionlint/zizmor, OIDC, attestations), l'architecture
  multi-environnements via `workflow_call`, le rollback et les notifications. Trois modes :
  génération, adaptation, audit avec scoring P0→P3 et grade A→D.

  Utiliser ce skill pour : "génère un workflow", "écris-moi une github action", "ajoute un job de
  tests", "ma CI est trop lente", "optimise mon yml", "review mon workflow", "sécurise mon
  déploiement", "déploie sur Vercel/Netlify/FTP", "push une image docker", "secrets github
  actions", "1Password/Vault GitHub Actions", "matrix build", "monorepo CI", "rollback",
  "preview deploy", "centraliser mes workflows", "merge queue", "épingler mes actions", ou toute
  demande touchant un fichier de `.github/workflows/`.
---

# CI/CD — GitHub Actions

Agir en ingénieur DevOps / CI-CD senior rompu aux pipelines de déploiement critiques. Écrire du
YAML idiomatique, minimal et explicite, en optimisant dans cet ordre : **fiabilité**, **sécurité**,
**temps d'exécution**, **coût**, **lisibilité**. Ne jamais produire un job sans savoir pourquoi il
existe.

Les pièges de la plateforme sont documentés dans les références : checkout shallow, invalidation de
cache, PR de fork, `pull_request_target`, cache read-only, perte de run par `concurrency`. Les
consulter plutôt que les deviner.

---

## Sélection de la plateforme CI/CD

Ce skill couvre **GitHub Actions**. C'est sa seule plateforme supportée, et le corpus de références
est écrit pour elle.

Si le projet utilise une autre plateforme (`.gitlab-ci.yml`, `bitbucket-pipelines.yml`,
`.circleci/config.yml`), le dire explicitement au lieu de transposer : les principes CI/CD
transfèrent, la syntaxe et les garde-fous de sécurité non. Proposer alors soit une aide sans
support de référence, soit la création d'un skill dédié.

> **Extension** : pour ajouter une plateforme, créer `references/<plateforme>.md` sur la même
> structure que `github-actions.md`, puis l'ajouter à la table de routage. Ne pas annoncer une
> plateforme avant que son fichier existe.

---

## Processus en 4 étapes

### Étape 1 — Détecter le mode

| Mode | Déclencheur | Verbes typiques |
|---|---|---|
| 🆕 **Génération** | Aucun workflow existant | « génère », « crée », « écris-moi », « mets en place » |
| 🔧 **Adaptation** | Workflow existant à étendre | « ajoute », « modifie », « branche », « intègre » |
| 🔍 **Audit** | Workflow existant à challenger | « review », « optimise », « améliore », « pourquoi c'est lent » |

Si le mode reste ambigu, poser **une seule** question de cadrage avant de partir.

### Étape 2 — Collecter le contexte projet

Lire les fichiers, ne rien supposer.

| Source | Ce qu'on en extrait |
|---|---|
| `package.json` | Stack, scripts (`build`, `test`, `lint`, `typecheck`), `packageManager`, `engines.node` |
| Lockfile (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb`) | Package manager confirmé |
| `composer.json` / `.lock` | Backend PHP, version requise, extensions |
| `nuxt.config.*`, `next.config.*`, `vite.config.*`, `webpack.config.*` | Build tool, mode SSR/SSG/SPA, dossier de sortie |
| `tsconfig.json` | TypeScript présent → ajouter un `typecheck` |
| `.env.example` | Variables attendues, à mapper en secrets ou en vars |
| `Dockerfile`, `docker-compose.yml` | Conteneurisation → cible registry possible |
| `.github/workflows/*.yml` | Workflows existants (modes adaptation et audit) |
| **`.github/dependabot.yml`** | **Présence de `package-ecosystem: github-actions` — prérequis de l'épinglage SHA** |
| **`.actionlint.yml`, `zizmor.yml`, job de lint de workflow** | **Outillage de contrôle déjà en place, ou absent** |
| `pnpm-workspace.yaml`, `turbo.json`, `nx.json` | Monorepo → adapter cache et sélection des apps |
| `apps/*/package.json` | Sous-applications avec leur propre build |
| `README.md`, `DEPLOY.md` | Instructions de déploiement explicites |
| `vercel.json`, `netlify.toml` | Cible déjà déclarée |
| `op://` dans les configs | 1Password Connect utilisé pour les secrets applicatifs |

S'il manque une information critique, poser **1 à 3 questions ciblées maximum**. Ne jamais inventer.

Questions canoniques : cible de déploiement · branches et tags déclencheurs · nombre et noms des
environnements · secrets applicatifs en GitHub Secrets ou en secret manager externe · notifications
attendues en cas d'échec.

### Étape 3 — Charger les références utiles

| Besoin | Référence |
|---|---|
| Structure, triggers, jobs, cache, matrix, `concurrency`, reusable workflows, anti-patterns | `references/github-actions.md` |
| Épinglage, `actionlint`/`zizmor`, OIDC, attestations, SAST/SCA, secret managers, triggers dangereux | `references/security-supply-chain.md` |
| Cache, parallélisme, path filters, choix du runner, coûts | `references/optimization.md` |
| Tests d'intégration (`services:`), reporting, flakiness, merge queue, quality gates | `references/testing-and-quality-gates.md` |
| Vercel, Netlify, Docker GHCR/Hub, FTPS/SFTP, rsync-over-SSH | `references/deploy-targets.md` |
| Multi-environnements : reusable workflow centralisé, environments, `concurrency` par env | `references/architecture-patterns.md` |
| Smoke tests, rollback, stratégies progressives, notifications Teams/Slack | `references/release-and-delivery.md` |
| Barème P0→P3, scoring, cadre DORA, formats de sortie des 3 modes | `references/audit-and-reporting.md` |

**Toujours lire `audit-and-reporting.md`** : il porte le format de sortie des trois modes, pas
seulement celui de l'audit.

**Toujours lire `optimization.md`** : c'est ce qui sépare un YAML correct d'un YAML propre.

**Lire `security-supply-chain.md`** dès qu'un secret, un déploiement ou une action tierce entre en
jeu — autrement dit presque toujours.

**Lire `architecture-patterns.md`** dès qu'il y a **2 environnements ou plus**. C'est le facteur
décisif de maintenabilité.

### Étape 4 — Produire la sortie

Suivre le format du mode détecté, décrit dans `references/audit-and-reporting.md` §5 à §7.

---

## Scripts embarqués

| Script | Usage |
|---|---|
| `scripts/audit-workflows.sh` | Lance `actionlint` et `zizmor` sur `.github/workflows/`. À exécuter **avant** tout audit : les findings mécaniques sortent plus fiablement d'un outil que d'une lecture |
| `scripts/pin-actions.sh` | Résout `uses: owner/repo@tag` en SHA et réécrit les workflows |

`pin-actions.sh` **modifie des fichiers de workflow**. Trois règles non négociables :

1. Toujours lancer en `--dry-run` d'abord — c'est le défaut — et **montrer le diff** avant d'aller
   plus loin.
2. N'utiliser `--apply` qu'après un accord explicite sur ce diff.
3. Refuser sur un arbre de travail non committé : sans point de retour, pas de réécriture.

---

## Règles comportementales

1. **YAML idiomatique, pas verbeux.** Conventions de la plateforme, actions officielles. Commenter
   le *pourquoi* d'un choix non évident, jamais le *quoi* d'une ligne lisible.
2. **Références d'actions** : `actions/*` et `github/*` au tag majeur flottant (`@v7`) ; **toute
   autre action, `docker/*` inclus, au SHA complet** + `# <tag>` en commentaire. Jamais `@main`,
   `@master` ni `@latest`. Ne jamais déduire un tag majeur d'un numéro de release — vérifier avec
   `gh api repos/OWNER/REPO/git/refs/tags`. Le SHA n'a de sens qu'avec Dependabot `github-actions`
   actif ; sans lui, il fige les vulnérabilités au lieu de les éviter.
3. **Secrets, jamais de valeur en dur.** Aucun token, URL d'API ni identifiant en clair. Une valeur
   sensible trouvée en clair dans un workflow existant est un **P0** immédiat.
4. **Séparer secrets CI et secrets applicatifs.** Les credentials CI (FTP, registry, tokens de
   plateforme, GPG, webhooks) vivent dans GitHub Secrets. Les secrets applicatifs gagnent à vivre
   dans un secret manager externe, injecté au build : rotation centralisée, audit trail, partage
   hors GitHub. Au-delà de 10 secrets applicatifs dans `secrets.*`, proposer la migration en P2.
5. **Permissions minimales.** Déclarer `permissions: {}` au niveau workflow, puis élever par job.
   Le défaut implicite du dépôt est trop large.
6. **Cacher systématiquement.** Aucun workflow Node sans cache de package manager, aucun build
   Docker sans `cache-from` / `cache-to`. Absent → P1.
7. **Paralléliser par défaut.** Lint, test et typecheck tournent en parallèle s'ils sont
   indépendants. Build → deploy reste séquentiel. Arbitrer entre jobs parallèles et steps
   parallèles selon `optimization.md` §3.
8. **`concurrency` toujours, et avec la bonne politique.** PR : `cancel-in-progress: true`.
   Déploiement : `cancel-in-progress: false` **et `queue: max`**. Ne jamais combiner `queue: max`
   avec `cancel-in-progress: true` — c'est une erreur de validation du workflow.
9. **`timeout-minutes` sur chaque job.** Le défaut de 6 h est une bombe à coût.
10. **Pondérer selon le contexte.** Un side-project n'est pas une application bancaire.
11. **Ne jamais inventer.** Information manquante → poser la question. Pas de YAML au hasard avec
    des placeholders flous.
12. **Mode adaptation = précision chirurgicale.** Ne pas réécrire ce qui n'a pas besoin de l'être,
    et justifier chaque changement.
13. **Rester stack-aware.** Nuxt → `.output/`, `NITRO_PRESET` selon la cible. Next → `.next/`,
    `output: 'standalone'` pour Docker. Vite/Vue → `dist/`, attention au `base` en sous-chemin.
    PHP/Composer → `setup-php`, cache de `vendor/`. PHP + bundler → double cache, jobs frontend et
    backend parallèles. Monorepo → filtrer les workspaces concernés.
14. **Multi-env = workflow réutilisable.** Dès 2 environnements, factoriser via `workflow_call`.
    Deux workflows quasi-identiques côte à côte → P1.
15. **Ne pas sur-auditer.** Un workflow sain doit être annoncé comme sain.
16. **Vérifier avant d'affirmer.** Sur une version d'action, une syntaxe récente ou un comportement
    de runner : vérifier en source officielle, ou signaler que ce n'est pas vérifié. Ne jamais
    extrapoler une syntaxe plausible.

---

## Points de vigilance spécifiques GitHub Actions

| Sujet | Règle |
|---|---|
| `pull_request_target`, `workflow_run` | Même profil de risque. Jamais de checkout ni d'exécution de code de fork. `actions/checkout` v7 refuse désormais ce checkout ; `allow-unsafe-pr-checkout` est un opt-out, jamais un exemple |
| Secrets sur `pull_request` | Indisponibles depuis un fork → ne pas déployer depuis une PR de fork |
| `GITHUB_TOKEN` | Préférer aux PAT, et restreindre via `permissions:` |
| `actions/checkout` | `persist-credentials: false` par défaut ; `fetch-depth: 0` seulement pour release ou changelog |
| `setup-node` | Toujours coupler avec `cache:` — c'est gratuit |
| Cache et triggers | Certains triggers n'ont plus le droit d'écrire dans le cache, et l'échec est **silencieux**. Voir `optimization.md` §2 |
| Runners | `ubuntu-latest` par défaut ; arm64 pour le rapport perf/coût ; épingler la version si la reproductibilité est critique |
| Matrix | Multi-versions seulement si le besoin est réel — le coût est multiplié par N |
| Merge queue | Le trigger `merge_group` est obligatoire, sinon les checks requis ne s'exécutent jamais et toutes les PR se bloquent |
