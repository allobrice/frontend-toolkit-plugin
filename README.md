# frontend-toolkit

Plugin Claude Code : outillage **frontend générique** pour AlloVoisins (Vue/Nuxt/React, TypeScript, SCSS), audits (accessibilité, performance, SEO), agents de test Playwright, et skills de lecture/diff Figma. Framework-agnostique, réutilisable hors AlloVoisins.

Namespace : `frontend-toolkit:*`.

## Rôle dans l'architecture

Socle technique de la paire de plugins AlloVoisins. `allovoisins-frontend` (plugin métier) en **dépend** (`dependencies: ["frontend-toolkit"]`) et invoque ses assets par référence namespacée — jamais de copie. Foyer unique des assets frontend génériques : ils vivent ici, pas au scope User.

## Contenu

**Agents (8) — délégués**
`vue-developer` · `ui-engineer` · `typescript-pro` · `code-reviewer` · `test-runner-fixer` · `playwright-test-planner` · `playwright-test-generator` · `playwright-test-healer`

**Skills auto-déclenchables (9)**
`developing-{javascript,scss,typescript,vue}` · `developing-with-nuxt4` · `creating-vue-components` · `auditing-{accessibility,performance,seo}`

**Skills sur invocation (2 — `disable-model-invocation` + `context: fork`)**
- `reading-figma-context` — distille un node Figma en brief d'implémentation (read-only).
- `diffing-figma` — compare un node Figma au composant implémenté ; écarts gradés A–D / P0–P3 (read-only, ne corrige pas).

## Installation

Via marketplace git + `/plugin`. Activer dans le repo cible. `/doctor` pour mesurer le budget descriptions.

## À vérifier au premier install

- Champ `dependencies` du `plugin.json` (fonctionnel ≥ v2.1.110, non documenté).
- Namespace des `subagent_type` de plugin (impact sur la command projet `/new-test-e2e`).
- Invocation cross-plugin des skills `disable-model-invocation` depuis `allovoisins-frontend`.
- Slug du serveur MCP Figma dans les `allowed-tools` des deux skills Figma.

## Maintenance

Réf. format : `claude-code-reference-condensee.md`. Source de vérité des décisions : `ARCHITECTURE-LOCKED.md`.
