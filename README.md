# frontend-toolkit

Plugin Claude Code : outillage **frontend générique** pour AlloVoisins. Guides de développement
(Vue/Nuxt, TypeScript, JavaScript, SCSS), clean code, UI/UX, revue de code multi-lentilles, audits
(accessibilité, performance, SEO, architecture), conteneurisation Docker et CI/CD GitHub Actions.
Framework-agnostique, réutilisable hors AlloVoisins.

Namespace : `frontend-toolkit:*`.

## Rôle dans l'architecture

Foyer unique des assets frontend génériques : ils vivent ici, pas au scope User. Un plugin métier
qui en a besoin le déclare en dépendance (`dependencies: ["frontend-toolkit"]`) et invoque ses
assets par référence namespacée, jamais par copie.

Les agents de test Playwright (`playwright-test-{planner,generator,healer}`) et la command
`/new-test-e2e` ne sont pas ici : ils vivent dans le plugin `web-front` de la marketplace.

## Contenu

**Agents (2) — délégués**
- `vue-developer` — implémente et refactore le code Vue 3.5 / Nuxt 4 / TS strict, y compris les
  correctifs issus des audits. Peut lire une maquette via le plugin Figma officiel s'il est installé.
- `code-reviewer` — revue qualité, sécurité et maintenabilité.

**Skills — développement (5)**
`developing-vue` · `developing-with-nuxt4` · `developing-typescript` · `developing-javascript` ·
`developing-scss`

**Skills — conception et qualité (3)**
- `designing-ui-ux` — Laws of UX, UI patterns, design system, formulaires, micro-interactions.
- `writing-clean-code` — code smells, SOLID, patterns GoF (objet et fonctionnel), par symptôme.
- `reviewing-code` — revue d'une PR GitHub ou d'un dossier local. Combine plusieurs lentilles et
  publie une review GitHub après confirmation. Usage :
  `/reviewing-code <url-pr | dossier> [-seo] [-perf] [-archi] [-a11y] [--no-post] [--level …]`.

**Skills — audits (4)** — rapport avec score par domaine et findings P0→P3
`auditing-accessibility` · `auditing-performance` · `auditing-seo` · `auditing-architecture`

**Skills — infra (2)**
- `containerizing-with-docker` — Dockerfiles, Docker Compose, optimisation d'images.
- `setting-up-cicd` — génération, adaptation et audit de workflows GitHub Actions.

Tous les skills sont auto-déclenchables (aucun `disable-model-invocation`), y compris
`reviewing-code`, pour rester invocable depuis un autre agent ou outil IA.

## Installation

Via marketplace git + `/plugin`, puis activer dans le repo cible. `/doctor` mesure le budget des
descriptions.

Si des copies de ces skills ou agents existent aussi dans `~/.claude/skills` ou `~/.claude/agents`,
les supprimer après l'installation : sinon chaque composant est chargé deux fois.

## Prérequis selon les composants

- `reviewing-code` : `node`, `git` et `gh` authentifié (mode PR).
- `setting-up-cicd` : `gh` pour l'épinglage des actions par SHA (`scripts/pin-actions.sh`).
- `containerizing-with-docker` : `python3` pour les scripts de génération, `docker` pour l'analyse d'image.
- `vue-developer` : plugin Figma officiel pour lire les maquettes (optionnel).

## Maintenance

- Chemins internes : `${CLAUDE_SKILL_DIR}` (ou `${CLAUDE_PLUGIN_ROOT}`), jamais `~/.claude/skills/…`.
- Incrémenter `version` dans `.claude-plugin/plugin.json` à chaque changement visible ; mineure à
  chaque ajout ou suppression de composant.
