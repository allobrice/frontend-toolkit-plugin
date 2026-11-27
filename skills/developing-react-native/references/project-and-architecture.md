# Projet, Expo Router et architecture

> Vérifié le 2026-11-27 : Expo SDK 58 (sorti le 2026-10-15), React Native 0.88, React 19.3.0,
> `expo-router` ~58. Avant d'appliquer une règle liée à une version, relire `package.json` :
> le SDK installé fait foi, pas ce fichier.

## Sommaire

1. Expo : CNG, dev builds, Expo Go
2. `app.config.ts` et config plugins
3. Expo Router : fichiers, layouts, groupes
4. Routes protégées
5. Deep links
6. Structure par feature : UI, hooks, services
7. Nouvelle architecture

---

## 1. Expo : CNG, dev builds, Expo Go

- **Continuous Native Generation (CNG).** `ios/` et `android/` sont **générés** par
  `npx expo prebuild` à partir de `app.config.ts` et des config plugins. Ils sont ignorés par git.
  Depuis SDK 57, `prebuild` nettoie ces dossiers par défaut (`--no-clean` pour les garder).
  - Projet en CNG : toute modification native passe par la config ou un config plugin, jamais
    par une retouche de `ios/` ou `android/`, qui serait écrasée.
  - Projet qui versionne `ios/` et `android/` (bare) : les modifications natives se font dans
    ces dossiers, et `app.config.ts` ne pilote plus tout. Le signaler avant de toucher quoi que
    ce soit.
- **Development build** (`expo-dev-client`) : c'est la cible de développement d'une vraie app.
  Expo Go ne charge ni module natif custom ni configuration native : il ne sert que pour un
  prototype.
- Le profil `development` de `eas.json` produit le dev build (voir `build-and-release.md`).

## 2. `app.config.ts` et config plugins

`app.config.ts` est prioritaire sur `app.json`. Il est typé, synchrone (pas de `Promise`) et
lu au build. Ce qu'il expose arrive dans le bundle client via `Constants.expoConfig` :
**aucun secret dedans**. Pour vérifier ce qui est public : `npx expo config --type public`.

```ts
// app.config.ts
import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_VARIANT = process.env.APP_VARIANT ?? 'production';

const VARIANTS = {
  development: { name: 'Annonces (dev)', bundleId: 'com.example.annonces.dev' },
  preview: { name: 'Annonces (preview)', bundleId: 'com.example.annonces.preview' },
  production: { name: 'Annonces', bundleId: 'com.example.annonces' },
} as const satisfies Record<string, { name: string; bundleId: string }>;

type Variant = keyof typeof VARIANTS;

function isVariant(value: string): value is Variant {
  return value in VARIANTS;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = VARIANTS[isVariant(APP_VARIANT) ? APP_VARIANT : 'production'];
  return {
    ...config,
    name: variant.name,
    slug: 'annonces',
    scheme: 'annonces',
    ios: { bundleIdentifier: variant.bundleId },
    android: { package: variant.bundleId },
    plugins: ['expo-router', 'expo-secure-store'],
  };
};
```

`export default` est ici imposé par l'outillage Expo : c'est l'exception admise à la règle des
exports nommés. Il en va de même pour les fichiers de route (§3).

- **Config plugins** : fonctions synchrones `with<Feature>` appliquées pendant `prebuild`.
  Beaucoup de modules Expo en fournissent un (`expo-secure-store`, `expo-sqlite`,
  `expo-camera`…), avec les options natives (permissions, `useSQLCipher`…).
- Écrire un config plugin maison seulement quand aucun module n'expose l'option. Il se place dans
  `plugins/`, est typé (`ConfigPlugin<Props>`) et sa raison est documentée.
- Toute modification de `app.config.ts` ou d'un plugin **exige un nouveau build natif** : elle ne
  passe pas en mise à jour OTA.

## 3. Expo Router : fichiers, layouts, groupes

Depuis SDK 55, le gabarit par défaut place les routes dans `src/app/`. Suivre ce que fait le
projet (`app/` ou `src/app/`).

| Fichier | Rôle |
|---|---|
| `_layout.tsx` | Navigateur du segment (`Stack`, `Tabs`…). Le layout racine accueille les providers et l'initialisation |
| `index.tsx` | Route par défaut du segment |
| `[id].tsx`, `[...rest].tsx` | Segment dynamique, attrape-tout |
| `(groupe)/` | Regroupe des routes **sans changer l'URL** : `(auth)`, `(tabs)` |
| `+not-found.tsx` | Route inconnue |
| `+native-intent.tsx` | Réécriture des liens entrants, côté natif |

```
src/app/
├── _layout.tsx              # providers (QueryClient, thème, SafeAreaProvider), Stack racine
├── (auth)/
│   ├── _layout.tsx
│   └── sign-in.tsx
├── (app)/
│   ├── _layout.tsx          # Tabs
│   ├── (home)/index.tsx
│   └── listings/
│       ├── index.tsx
│       └── [id].tsx
└── +not-found.tsx
```

- **Un fichier de route reste mince** : il lit les paramètres, appelle un hook de la feature et
  rend un composant d'écran. La logique vit dans `features/` (§6).
- Paramètres : `useLocalSearchParams<{ id: string }>()`. Une valeur d'URL reste une entrée non
  fiable : la valider (schéma) avant usage.
- **Typed routes** : expérimental et désactivé par défaut (`experiments.typedRoutes: true`). À
  n'activer qu'avec l'accord du projet.

## 4. Routes protégées

```tsx
// src/app/_layout.tsx
import { Stack } from 'expo-router';
import { useSession } from '@/features/auth/useSession';

export default function RootLayout() {
  const { status } = useSession();
  const isSignedIn = status === 'authenticated';

  return (
    <Stack>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
```

- Quand `guard` est faux, l'utilisateur est redirigé vers l'ancre du navigateur et l'historique
  des écrans protégés est purgé. Les gardes s'imbriquent. `Tabs.Protected` existe aussi.
  `redirectTo` est disponible depuis SDK 58.
- **La garde est côté client : ce n'est pas de la sécurité.** L'API vérifie toujours le token ;
  l'écran ne fait que masquer.
- Tant que la session est en cours de restauration (lecture de SecureStore), garder l'écran de
  démarrage (`expo-splash-screen`) plutôt que d'afficher brièvement `(auth)`.

## 5. Deep links

- Expo Router rend chaque écran adressable par un lien. Le `scheme` (`annonces://`) se déclare
  dans la config, et le changer demande un nouveau build.
- En production, préférer les **Universal Links (iOS) / App Links (Android)** sur un domaine
  maîtrisé : le schéma custom peut être revendiqué par une autre app.
- `+native-intent.tsx` exporte `redirectSystemPath` pour réécrire un lien entrant (lien
  marketing, ancienne URL). Le chemin reçu est **non fiable** : liste blanche, pas d'`eval` de
  paramètres, pas de redirection vers une URL externe arbitraire.
- Un lien profond vers un écran protégé passe par la garde (§4) : ne jamais court-circuiter
  l'authentification parce que l'utilisateur arrive par un lien.

## 6. Structure par feature : UI, hooks, services

```
src/
├── app/                       # routes uniquement (minces)
├── features/
│   └── listings/
│       ├── api/               # services : client HTTP, adapters DTO → domaine
│       │   ├── listingsApi.ts
│       │   └── listingsApi.test.ts
│       ├── hooks/             # TanStack Query, logique d'écran
│       │   └── useListings.ts
│       ├── components/        # présentation pure : props → UI
│       │   ├── ListingCard.tsx
│       │   └── ListingCard.test.tsx
│       ├── screens/
│       │   └── ListingsScreen.tsx
│       └── types.ts           # types de domaine
├── shared/                    # ui/ (Button, Text…), theme/, lib/ (http, storage), hooks/
└── test/                      # helpers de rendu, mocks
```

- **Composant de présentation** : il reçoit des props et émet des callbacks. Aucun `fetch`, aucun
  accès au stockage, aucun module natif importé directement.
- **Hook** : il orchestre (requête, mutation, état d'écran) et expose une API de domaine
  (`useListings`, pas `useListingsLogic`).
- **Service** : I/O et adaptation (HTTP, SQLite, SecureStore). Le format d'API ne dépasse pas
  cette couche.
- Les modules natifs (SecureStore, SQLite, Haptics, Network) sont enveloppés dans
  `shared/lib/` : un seul endroit à mocker, une seule API typée.
- Principes SOLID, DRY et code smells : skill `writing-clean-code`. Typage avancé : skill
  `developing-typescript`.

## 7. Nouvelle architecture

- React Native 0.82 est la première version qui tourne **uniquement** sur la nouvelle
  architecture (Fabric, TurboModules, JSI). RN 0.84 supprime le code legacy. Côté Expo, SDK 54
  était le dernier SDK avec l'ancienne architecture ; depuis SDK 55, l'option `newArchEnabled`
  n'existe plus.
- Conséquence : toute dépendance native doit être compatible avec la nouvelle architecture.
  FlashList v2 et Reanimated 4 l'exigent déjà.
- Installer les dépendances avec `npx expo install <paquet>` : il choisit la version alignée sur
  le SDK. Après un changement, lancer `npx expo-doctor`.
- Ajouter une dépendance native demande un nouveau build et une validation explicite.

## Sources (vérifié le 2026-11-27)

- https://expo.dev/changelog/sdk-58 · https://expo.dev/changelog/sdk-57 · https://expo.dev/changelog/sdk-55
- https://docs.expo.dev/versions/latest/
- https://docs.expo.dev/workflow/continuous-native-generation/
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.expo.dev/workflow/configuration/
- https://docs.expo.dev/config-plugins/introduction/
- https://docs.expo.dev/router/basics/notation/
- https://docs.expo.dev/router/advanced/protected/ · https://docs.expo.dev/router/advanced/authentication/
- https://docs.expo.dev/router/reference/typed-routes/
- https://docs.expo.dev/linking/overview/ · https://docs.expo.dev/linking/into-your-app/
- https://docs.expo.dev/router/advanced/native-intent/
- https://docs.expo.dev/guides/new-architecture/ · https://reactnative.dev/blog/2026/02/11/react-native-0.84
