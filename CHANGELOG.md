# Changelog

Toutes les évolutions notables du plugin `frontend-toolkit`. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionnage : mineure à chaque ajout ou
suppression de composant, patch pour une correction.

## [0.8.0] — 2026-11-28

### Ajouté

- Agent `react-native-developer` : développement React Native / Expo en TypeScript strict. Il
  précharge la skill `developing-react-native` (champ `skills:`) et suit la structure de
  `react-developer` (périmètre, préalables, non négociables, boucle de travail, definition of
  done, restitution). Le compte rendu indique si un nouveau build natif est nécessaire.
- Skill `developing-react-native` (Expo SDK 58, React Native 0.88, vérifié le 2026-11-27) :
  `SKILL.md` court et 13 références chargées à la demande :
  - projet et architecture, Expo Router ;
  - styles et thème typé ;
  - navigation et UX native ;
  - formulaires et clavier ;
  - listes et performance ;
  - données et hors ligne ;
  - sécurité et stockage ;
  - accessibilité ;
  - plateformes et permissions ;
  - tests ;
  - build et publication EAS ;
  - monorepo pnpm ;
  - anti-patterns.
- `evals/` : 6 cas `claude plugin eval` (déclenchement, non-déclenchement sur du React web,
  hors ligne, accessibilité, stockage d'un token, mode sombre sans SCSS).
- `CHANGELOG.md`.

### Modifié

- Descriptions de `developing-react`, `developing-scss`, `auditing-performance` et de l'agent
  `react-developer` : exclusion explicite de React Native / Expo, pour éviter les doubles
  déclenchements.
- `vue-developer` et `react-developer` renvoient vers `react-native-developer` pour le mobile.
- README, descriptions du manifest et de la marketplace.

## [0.7.1]

### Modifié

- Mentions React rétablies dans `developing-scss` et `writing-clean-code`.

## [0.7.0]

### Ajouté

- Agent `react-developer` et skills `developing-react` et `developing-with-nextjs`.
- Marketplace mono-plugin.

## Versions antérieures

L'historique avant 0.7.0 est dans `git log` : ajout des skills d'audit, CI/CD, Docker, UI/UX,
revue et clean code ; retrait des agents `ui-engineer`, `typescript-pro`, `test-runner-fixer` et
`code-reviewer`.
