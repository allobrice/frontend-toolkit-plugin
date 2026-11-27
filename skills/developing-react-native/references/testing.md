# Tests : jest-expo, React Native Testing Library, e2e

> Vérifié le 2026-11-27 : `jest-expo` (Jest 30 requis depuis SDK 58), `@testing-library/react-native`
> v14 (14.1, au moins 14 requis pour tester Expo Router), `expo-router/testing-library`, Maestro.
> La philosophie commune (tester le comportement, requêtes par rôle, fonctions pures d'abord, ce
> qu'on ne teste pas) est dans `developing-react` → `references/testing.md` et n'est pas répétée.

## Sommaire

1. Setup
2. Requêtes : rôle et libellé
3. Interactions : `userEvent`
4. Providers et helper de rendu
5. Mocks des modules natifs
6. Tester Expo Router
7. Ce qu'on teste où
8. Tests de bout en bout : Maestro ou Detox

---

## 1. Setup

- Installation alignée sur le SDK : `npx expo install jest-expo jest @types/jest --dev`, puis
  `"jest": { "preset": "jest-expo" }` dans `package.json` (ou `jest.config.ts`).
- `@testing-library/react-native` v14. `react-test-renderer` est **déprécié** et ne supporte pas
  React 19 : ne pas l'utiliser, ne pas écrire de snapshot de l'arbre complet.
- Fichier colocalisé : `ListingCard.test.tsx` à côté de `ListingCard.tsx`.
- Réutiliser la configuration existante (`jest.setup.ts`, helpers). Ne pas la modifier sans
  validation.

## 2. Requêtes : rôle et libellé

Ordre de préférence, identique au web :

1. `getByRole('button', { name: 'Favori' })` : vérifie au passage rôle et nom accessibles ;
2. `getByLabelText('Adresse e-mail')` : champs ;
3. `getByText('Aucune annonce')` : contenu non interactif ;
4. `getByTestId` : **en dernier recours**, pour ce qui n'a ni rôle ni texte.

```tsx
// features/listings/components/ListingCard.test.tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { ListingCard } from './ListingCard';
import { aListing } from '@/test/factories';

describe('ListingCard', () => {
  it('ouvre l’annonce et bascule le favori sans ouvrir l’annonce', async () => {
    const user = userEvent.setup();
    const onOpen = jest.fn();
    const onToggleFavorite = jest.fn();
    const listing = aListing({ id: 'l1', title: 'Vélo', isFavorite: false });

    render(<ListingCard listing={listing} onOpen={onOpen} onToggleFavorite={onToggleFavorite} />);

    await user.press(screen.getByRole('button', { name: 'Favori' }));
    expect(onToggleFavorite).toHaveBeenCalledWith('l1');
    expect(onOpen).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: /Vélo/ }));
    expect(onOpen).toHaveBeenCalledWith('l1');
  });

  it('expose l’état sélectionné du favori', () => {
    render(<ListingCard listing={aListing({ isFavorite: true })} onOpen={jest.fn()} onToggleFavorite={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Favori' })).toBeSelected();
  });
});
```

- Les matchers (`toBeSelected`, `toBeDisabled`, `toBeVisible`, `toHaveTextContent`…) sont intégrés
  à RNTL ; vérifier la configuration du projet pour leur import.
- Un test qui ne trouve pas un bouton par son rôle et son nom révèle un **défaut d'accessibilité** :
  on corrige le composant, pas le test.

## 3. Interactions : `userEvent`

`userEvent.setup()`, puis des actions **asynchrones** : `press`, `longPress`, `type`, `clear`,
`paste`, `scrollTo`, et depuis la 14.1 `pullToRefresh` et `accessibilityAction`.

- `userEvent` plutôt que `fireEvent` : il simule la séquence réelle (`pressIn`, `pressOut`,
  focus, saisie caractère par caractère).
- Toujours `await` les actions. Pour un contenu qui apparaît après une promesse :
  `await screen.findByText(…)`.
- `fireEvent` reste utile pour un événement que `userEvent` ne couvre pas (`onEndReached`,
  `onLayout`).

## 4. Providers et helper de rendu

```tsx
// test/renderWithProviders.tsx
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...options }: RenderOptions & { queryClient?: QueryClient } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
          <ThemeProvider>{children}</ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    );
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
```

- Un `QueryClient` neuf par test, `retry: false`.
- `SafeAreaProvider` reçoit des `initialMetrics` : sans lui, `useSafeAreaInsets` ne renvoie rien en
  test.

## 5. Mocks des modules natifs

jest-expo mocke la partie native du SDK Expo. La liste exacte des modules couverts n'est **pas
documentée** (non vérifié) : si un test échoue sur un module natif, on ajoute un mock explicite.

Règle : **on mocke notre enveloppe, pas le module natif**. Les modules natifs passent par
`shared/lib/` (voir `project-and-architecture.md` §6), ce qui donne un seul point à remplacer :

```ts
// features/auth/signOut.test.ts
import { signOut } from './signOut';
import { clearSecure } from '@/shared/lib/secureStorage';
import { createTestQueryClient } from '@/test/renderWithProviders';

jest.mock('@/shared/lib/secureStorage', () => ({
  clearSecure: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/shared/lib/db/wipeLocalDatabase', () => ({
  wipeLocalDatabase: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/sync/outbox', () => ({
  clearOutbox: jest.fn().mockResolvedValue(undefined),
}));

it('purge le stockage sécurisé et le cache au logout', async () => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(['me'], { id: 'u1' });

  await signOut(queryClient);

  expect(clearSecure).toHaveBeenCalled();
  expect(queryClient.getQueryData(['me'])).toBeUndefined();
});
```

- Pour tester l'enveloppe elle-même (`secureStorage.ts`), on mocke `expo-secure-store` avec un
  `Map` en mémoire, dans le test ou dans un fichier `__mocks__/` partagé.
- Réseau : MSW ou un faux client HTTP injecté, comme sur le web. Pas de `fetch` mocké à la main
  dans chaque test.
- État réseau : forcer `onlineManager.setOnline(false)` dans le test pour couvrir le hors ligne,
  et le remettre à `true` dans `afterEach`.
- Code natif propre à une plateforme : `Platform.OS` se remplace par test si besoin, ou via les
  presets de plateforme de jest-expo selon la configuration du projet.

## 6. Tester Expo Router

```tsx
import { renderRouter, screen } from 'expo-router/testing-library';

it('redirige vers la connexion sans session', async () => {
  renderRouter(
    {
      _layout: () => <RootLayoutUnderTest />,
      '(auth)/sign-in': () => <SignInScreen />,
      '(app)/index': () => <HomeScreen />,
    },
    { initialUrl: '/' },
  );
  expect(await screen.findByRole('header', { name: 'Connexion' })).toBeVisible();
  expect(screen).toHavePathname('/sign-in');
});
```

- `renderRouter` accepte une table de routes mockées, une liste de chemins ou un dossier de
  fixtures, plus `initialUrl`.
- Matchers fournis : `toHavePathname`, `toHavePathnameWithParams`, `toHaveSegments`,
  `toHaveSearchParams`, `toHaveRouterState`.
- On teste la navigation (garde, redirection, deep link) ; le contenu des écrans se teste au niveau
  du composant d'écran.

## 7. Ce qu'on teste où

| Niveau | Cible | Outil |
|---|---|---|
| Fonctions pures | adapters, validateurs, reducers, migrations SQL (sur une base en mémoire si l'environnement le permet), règles de conflit | Jest seul |
| Hooks | hooks de feature (avec QueryClient de test) | `renderHook` de RNTL |
| Composants | rendu, accessibilité (rôle, nom, état), interactions | RNTL + `userEvent` |
| Navigation | gardes, redirections, liens profonds | `expo-router/testing-library` |
| Parcours critiques | connexion, création hors ligne puis synchronisation, paiement | e2e (§8) sur build réel |

## 8. Tests de bout en bout : Maestro ou Detox

| | Maestro | Detox |
|---|---|---|
| Écriture | flux YAML déclaratifs, sans code dans l'app | tests JS / TS, API riche |
| Installation | CLI externe, aucun paquet npm dans l'app | dépendances et configuration native dans le projet |
| Synchronisation | attentes implicites, tolérant | synchronisé avec l'activité de l'app (réseau, animations), précis mais plus exigeant |
| Intégration Expo | documenté dans le guide e2e d'EAS Workflows | non couvert par la doc Expo actuelle |
| Bon choix si | équipe qui veut des parcours lisibles et rapides à écrire, QA impliquée | tests e2e nombreux et complexes, besoin de contrôle fin, équipe JS |

- Par défaut, **Maestro** pour un projet Expo, sauf si le projet utilise déjà autre chose (aucun
  classement officiel entre les deux n'a été vérifié).
- Sélecteurs : texte visible et libellés d'accessibilité d'abord ; `testID` pour ce qui n'en a
  pas. Les `testID` sont stables et nommés par intention (`listing-card-l1`).
- Les tests e2e tournent sur un build (dev ou preview), pas sur Expo Go. Ils couvrent peu de
  parcours, mais les plus critiques.

## Sources (vérifié le 2026-11-27)

- https://docs.expo.dev/develop/unit-testing/
- https://oss.callstack.com/react-native-testing-library/docs/api/events/user-event
- https://docs.expo.dev/router/reference/testing/
- https://docs.expo.dev/build-reference/e2e-tests/
- https://docs.maestro.dev/platform-support/react-native
