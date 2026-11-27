---
name: developing-react-native
description: >
  À utiliser pour toute tâche de code sur une app mobile React Native / Expo (iOS, Android) :
  écran, composant, style, thème et mode sombre, formulaire et clavier, liste, navigation,
  accessibilité (VoiceOver, TalkBack), stockage et tokens, hors ligne, tests, build et OTA.
  Signaux : react-native ou expo dans package.json, app.json / app.config.ts, eas.json, dossier
  apps/mobile, fichiers .ios.tsx / .android.tsx, imports react-native (View, Text, Pressable,
  FlatList, StyleSheet). La charger même quand la demande porte surtout sur l'accessibilité, le
  style ou l'UX d'un écran mobile, en complément de auditing-accessibility ou designing-ui-ux.
  Contenu : React Native + Expo (SDK 58, RN 0.88, nouvelle architecture — vérifié le 2026-11-27)
  en TypeScript strict — Expo Router (layouts, groupes, routes protégées, deep links),
  app.config.ts, config plugins, dev builds, StyleSheet et thème typé, safe areas,
  FlatList / FlashList, Reanimated, Gesture Handler, expo-image, TanStack Query hors ligne,
  expo-sqlite, expo-secure-store, permissions, jest-expo, React Native Testing Library, Maestro,
  EAS Build / Submit / Update, monorepo pnpm. Déclencher aussi sur : "app mobile", "app Expo",
  "écran React Native", "rends accessible la carte de l'app mobile", "mode sombre de l'app",
  "build EAS", "mise à jour OTA", "deep link", "hors ligne", "garder le token dans l'app".
  Ne PAS utiliser pour du React web (DOM, Vite, Next.js, apps/web, CSS / SCSS) : c'est
  developing-react / developing-with-nextjs.
---

# React Native + Expo : code de production

Écrire une app mobile qui se comporte comme une app native, pas comme un site emballé. Le code
reste petit, typé, accessible, et tient sans réseau. **Version de référence, vérifiée le
2026-11-27 : Expo SDK 58, React Native 0.88, React 19.3.0, nouvelle architecture seule.** Le SDK
installé dans le projet fait foi : relire `package.json` avant d'appliquer une règle liée à une
version.

## Principes directeurs

1. **Natif d'abord.** Navigateurs natifs, en-têtes natifs, sélecteurs natifs, gestes de la
   plateforme. Rien de reconstruit « comme sur le web ».
2. **Les mêmes règles React.** Rendu pur, état minimal, rien de dérivé stocké, un effet ne sert
   qu'à synchroniser avec un système externe (skill `developing-react` pour le socle).
3. **Le thème décide de toute valeur visuelle.** `StyleSheet.create`, rôles sémantiques typés,
   aucune valeur en dur, mode sombre et texte dynamique gérés dès le départ.
4. **Toute liste longue est virtualisée**, et l'on mesure sur un build de release avant d'optimiser.
5. **Le réseau est intermittent par nature.** Timeouts, état « en attente », écritures locales
   puis synchronisées quand le besoin l'exige.
6. **Un secret ne vit que dans SecureStore.** Rien de sensible en AsyncStorage, dans les logs ou
   dans le bundle.
7. **Accessible par construction.** Rôle, nom, état, cibles de 44 pt / 48 dp, test au lecteur
   d'écran.
8. **Savoir ce qui demande un build.** Natif, permissions et config passent par un build ;
   l'OTA ne transporte que du JS et des assets.

## Détecter le contexte avant d'écrire

| Signal dans le projet | Conséquence |
|---|---|
| `expo` dans `package.json` | Lire la version du SDK ; installer toute dépendance avec `npx expo install` |
| `ios/` et `android/` ignorés par git | CNG : le natif passe par `app.config.ts` et les config plugins, jamais par une retouche des dossiers |
| `ios/` et `android/` versionnés | Projet bare : le signaler, modifier le natif dans ces dossiers |
| `expo-router`, dossier `src/app` ou `app/` | Routes par fichiers ; fichiers de route minces (`project-and-architecture.md`) |
| `@shopify/flash-list` | FlashList v2 : pas d'`estimatedItemSize` |
| `@tanstack/react-query` | Brancher `focusManager` et `onlineManager` (`data-and-offline.md`) |
| `expo-sqlite` avec `useSQLCipher` | Base chiffrée : contrôler `PRAGMA cipher_version` |
| `react-native-keyboard-controller` | L'utiliser pour les formulaires longs plutôt que `KeyboardAvoidingView` |
| `eas.json` | Profils de build et canaux OTA : ne rien publier sans validation |
| `pnpm-workspace.yaml` et `apps/web` | Monorepo : aligner React, paquets partagés en TS source (`monorepo.md`) |
| Librairie de style tierce déjà présente | Suivre ses conventions, ne pas ajouter `StyleSheet` à côté |

## Arbres de décision

### Où vit cette donnée ?

```
Elle se calcule à partir des props ou d'un autre état ?
├── Oui → calcul pendant le rendu
└── Non → elle vient du serveur ?
    ├── Oui → TanStack Query
    │   └── doit rester lisible hors ligne ? → cache persisté (sans donnée sensible)
    └── Non → elle est saisie par l'utilisateur et doit survivre sans réseau ou au redémarrage ?
        ├── Oui → SQLite (+ outbox si elle doit partir au serveur)
        └── Non → useState / useReducer, Context, store : mêmes règles que developing-react
```

### Quel stockage ?

```
Token, secret, clé de chiffrement → expo-secure-store (jamais ailleurs)
Données personnelles ou métier hors ligne → SQLite chiffrée (SQLCipher), clé en SecureStore
Cache serveur non sensible → cache TanStack Query persisté ou SQLite
Préférence UI (thème, langue, onboarding vu) → AsyncStorage
```

### Quelle liste ?

```
Moins de ~20 éléments de taille fixe → ScrollView + map
Longue, paginée, de taille inconnue → FlatList (keyExtractor, item mémoïsé, getItemLayout si hauteur fixe)
Longue et saccadée après mesure, ou items lourds et hétérogènes → FlashList v2 (si présente ou validée)
```

### OTA ou nouveau build ?

```
Seulement du TS / JS, des styles, des images → OTA possible (canal preview d'abord)
Dépendance native, permission, app.config.ts, config plugin, SDK, icône, scheme → nouveau build
Doute → considérer qu'un build est nécessaire
```

## Rappels critiques

- **JAMAIS** de token ou de secret ailleurs que dans `expo-secure-store` ; **JAMAIS** de donnée
  personnelle dans un log.
- **JAMAIS** de `ScrollView` + `map` sur une liste longue ou paginée.
- **JAMAIS** de style inline statique ni de valeur visuelle en dur ; **JAMAIS** de CSS / SCSS.
- **JAMAIS** de `useEffect` pour dériver un état ou recopier l'état réseau.
- **JAMAIS** de logique métier, de `fetch` ou de SQL dans un composant de présentation.
- **JAMAIS** de `any`, de `@ts-ignore` ni de cast pour lire un paramètre de route ou une réponse
  d'API : on valide.
- **JAMAIS** de retouche de `ios/` / `android/` dans un projet CNG, ni de publication OTA d'un
  changement natif.
- **TOUJOURS** rôle, nom et état sur un élément interactif, et une cible d'au moins 44 pt / 48 dp.
- **TOUJOURS** les safe areas (`react-native-safe-area-context`), Android compris (edge-to-edge
  obligatoire).
- **TOUJOURS** un timeout sur un appel réseau et un état visible quand une action attend le réseau.
- **PRÉFÉRER** les exports nommés. `export default` n'est admis que là où l'outillage l'exige
  (fichiers de route Expo Router, `app.config.ts`).

## Fichiers de référence

| Fichier | Contenu | Quand le lire |
|---|---|---|
| [references/project-and-architecture.md](references/project-and-architecture.md) | CNG, dev builds, `app.config.ts`, config plugins, Expo Router (layouts, groupes, routes protégées, deep links), structure par feature, nouvelle architecture | Nouvel écran ou nouvelle route, organisation du code, ajout d'une dépendance native |
| [references/styling.md](references/styling.md) | `StyleSheet`, thème typé issu des tokens, styles dépendant du thème, mode sombre, safe areas, edge-to-edge, texte dynamique | Tout code de style |
| [references/navigation-and-native-ux.md](references/navigation-and-native-ux.md) | Retour iOS / Android, en-têtes, onglets, modales et sheets, haptique, réflexes web à proscrire | Navigation, modale, interaction |
| [references/forms-and-keyboard.md](references/forms-and-keyboard.md) | Clavier, props de `TextInput`, chaîne de focus, champs numériques, date et heure natives, validation | Tout formulaire ou champ de saisie |
| [references/lists-and-performance.md](references/lists-and-performance.md) | FlatList, FlashList v2, pagination, re-rendus, Reanimated, Gesture Handler, `expo-image`, mesure | Listes, animations, images, lenteur |
| [references/data-and-offline.md](references/data-and-offline.md) | TanStack Query en RN, modes réseau, persistance, `expo-sqlite` et migrations, outbox, synchronisation, réseau instable | Données serveur, hors ligne, base locale |
| [references/security-and-storage.md](references/security-and-storage.md) | Matrice de stockage, SecureStore, SQLite chiffrée, purge au logout, sauvegardes, sélecteur d'apps, logs, secrets de build | Authentification, données sensibles, stockage |
| [references/accessibility.md](references/accessibility.md) | `accessibility*` et `role` / `aria-*`, regroupement, ordre de lecture, cibles, réduction des animations, annonces, VoiceOver et TalkBack | Tout composant interactif, correctif a11y |
| [references/platform-and-permissions.md](references/platform-and-permissions.md) | `Platform.select`, fichiers `.ios.tsx` / `.android.tsx`, permissions | Écart entre plateformes, caméra, photos, localisation… |
| [references/testing.md](references/testing.md) | jest-expo, RNTL v14 et `userEvent`, mocks natifs, tests d'Expo Router, Maestro ou Detox | Écriture ou revue de tests |
| [references/build-and-release.md](references/build-and-release.md) | Profils `eas.json`, variables d'environnement, versions, Submit, EAS Update et ses limites, `runtimeVersion` | Build, publication, OTA, variables d'environnement |
| [references/monorepo.md](references/monorepo.md) | pnpm isolé, Metro automatique, paquets partagés en TS source, doublons de React, alignement avec le web | Monorepo avec `apps/mobile` |
| [references/anti-patterns.md](references/anti-patterns.md) | Catalogue avant / après des erreurs propres au mobile | Revue de code, refactoring, relecture de son propre diff |

Ouvrir la référence qui correspond à la tâche, pas toutes.

## Frontière avec les autres skills

- **Socle React** (rendu, état, effets, hooks, React Compiler, Actions) → `developing-react`, à
  lire pour les principes et non pour le DOM, CSS Modules ou Vitest.
- **Typage avancé** (génériques, unions discriminées, schémas de validation, typage d'API) →
  `developing-typescript`.
- **UX** (Laws of UX, hiérarchie, états, UX des formulaires) → `designing-ui-ux`.
- **Barème d'accessibilité** (WCAG, contrastes, gravité, format d'audit) → `auditing-accessibility`.
- **Code smells, SOLID, patterns** → `writing-clean-code`.
- **React web, Next.js, SCSS** : hors périmètre (`developing-react`, `developing-with-nextjs`,
  `developing-scss`).
- **Conventions du dépôt** (tokens, exceptions de style, règles RGPD, commandes) → le `CLAUDE.md`
  du projet et de l'app, qui prime toujours sur cette skill.
