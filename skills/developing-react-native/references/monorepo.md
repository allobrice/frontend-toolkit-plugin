# Expo dans un monorepo pnpm

> Vérifié le 2026-11-27 sur le guide Expo « Work with monorepos » (SDK 58).

## Sommaire

1. Ce qui a changé : isolé par défaut, Metro automatique
2. Structure type
3. Paquets partagés en TypeScript source
4. Doublons de React et alignement avec le front web
5. Diagnostic

---

## 1. Ce qui a changé : isolé par défaut, Metro automatique

- **Installations isolées de pnpm** : supportées depuis SDK 54. `node-linker=hoisted` n'est **plus
  requis**. On ne le remet (`nodeLinker: hoisted` dans `pnpm-workspace.yaml`, ou
  `node-linker=hoisted` dans `.npmrc`) que si un build natif ou la résolution échoue, et en
  documentant pourquoi. Sur SDK 53, l'isolation devait être désactivée.
- **Metro se configure automatiquement en monorepo depuis SDK 52** via `expo/metro-config`. Les
  anciens réglages manuels sont à **supprimer** : `watchFolders`, `resolver.nodeModulesPaths`,
  `resolver.extraNodeModules`, `resolver.disableHierarchicalLookup`. Ensuite, lancer
  `npx expo start --clear`.
- La résolution d'autolinking adaptée au monorepo est automatique depuis SDK 55.

```js
// apps/mobile/metro.config.js : la config minimale suffit
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
```

## 2. Structure type

```
.
├── pnpm-workspace.yaml        # packages: ['apps/*', 'packages/*']
├── apps/
│   ├── mobile/                # Expo : app.config.ts, eas.json, src/app
│   └── web/                   # Vite ou Next.js
└── packages/
    ├── domain/                # types et règles métier en TS pur, sans react ni react-native
    ├── api-client/            # client HTTP typé, schémas
    └── tokens/                # design tokens (valeurs brutes) → thème RN et SCSS web
```

- Ce qui se partage entre web et mobile : types de domaine, schémas de validation, client API,
  tokens bruts, fonctions pures.
- Ce qui ne se partage pas : composants UI. Le DOM et les primitives natives divergent ; un
  composant « universel » se décide explicitement avec le projet.
- `eas.json` vit dans `apps/mobile`. EAS Build s'exécute depuis ce dossier et installe le
  workspace complet.

## 3. Paquets partagés en TypeScript source

Les paquets internes exposent leur **source TS**, sans étape de build : Metro et Vite les
transpilent.

```json
{
  "name": "@acme/domain",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "sideEffects": false
}
```

- L'app déclare la dépendance en `"@acme/domain": "workspace:*"`.
- Un paquet partagé qui dépend de `react` le déclare en `peerDependencies`, **jamais** en
  `dependencies` : sinon une seconde copie de React s'installe.
- Pas de `export default`. Les exports nommés passent par `src/index.ts`.
- Le `tsconfig` de chaque paquet étend une base commune stricte. Le typecheck se lance par
  paquet (`pnpm -r typecheck`).

## 4. Doublons de React et alignement avec le front web

Le SDK Expo fixe la version de `react` (19.3.0 avec SDK 58, vérifié le 2026-11-27). Deux copies
de React dans le bundle mobile donnent l'erreur « Invalid hook call » ou des contextes vides.

- **Aligner `react` du front web sur la version imposée par le SDK** quand les deux apps
  partagent des paquets qui dépendent de React. Sinon, garder des paquets partagés sans React.
- Forcer une version unique si nécessaire :

```yaml
# pnpm-workspace.yaml (ou "pnpm.overrides" dans package.json selon la version de pnpm)
overrides:
  react: 19.3.0
```

- Pas de détection automatique des doublons documentée par Expo (non vérifié) : on contrôle à la
  main (§5).
- Mettre à jour le SDK, c'est mettre à jour React pour tout le monorepo : à planifier avec
  l'équipe web.

## 5. Diagnostic

| Symptôme | Vérification |
|---|---|
| « Invalid hook call », contexte `undefined` dans un paquet partagé | `pnpm why react --depth=10` dans `apps/mobile` : plus d'une version signifie un doublon |
| Module introuvable depuis un paquet du workspace | dépendance non déclarée dans le `package.json` du paquet (l'isolation pnpm ne pardonne pas) ; `npx expo start --clear` |
| Build natif EAS qui échoue sur un module natif | `npx expo-doctor`, puis `nodeLinker: hoisted` en dernier recours, documenté |
| Ancienne config Metro manuelle | supprimer les options listées au §1 |

## Sources (vérifié le 2026-11-27)

- https://docs.expo.dev/guides/monorepos/
- https://expo.dev/changelog/sdk-54 · https://expo.dev/changelog/sdk-55
- https://docs.expo.dev/versions/latest/
