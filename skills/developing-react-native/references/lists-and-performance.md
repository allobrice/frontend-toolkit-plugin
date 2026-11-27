# Listes et performance

> Vérifié le 2026-11-27 : FlashList v2 (2.x), Reanimated 4 (4.7.1 recommandé par le SDK 58, avec
> `react-native-worklets`), Gesture Handler ~3.3.0 recommandé par le SDK 58, `expo-image` ~58,
> React Native DevTools (RN 0.88). Utiliser `npx expo install` pour obtenir la version alignée sur
> le SDK installé. La performance web (Core Web Vitals, bundle) relève de `auditing-performance`,
> pas de ce fichier.

## Sommaire

1. Règle : toute liste longue est virtualisée
2. FlatList bien configurée
3. FlashList v2
4. Pagination infinie et rafraîchissement
5. Re-rendus et React Compiler
6. Animations et gestes sur le thread UI
7. Images : `expo-image`
8. Mesurer avant d'optimiser

---

## 1. Règle : toute liste longue est virtualisée

```
La liste…
├── a moins de ~20 éléments, de taille connue et fixe → ScrollView + map acceptable
├── est longue, paginée ou de taille inconnue → FlatList (ou SectionList pour des sections)
└── est longue ET le profilage montre des saccades, ou les items sont lourds et hétérogènes
    → FlashList v2, si le projet l'a déjà ou après validation de la dépendance
```

`ScrollView` + `map` sur une liste longue monte **tous** les éléments : mémoire, temps de premier
rendu et saccades augmentent avec le nombre d'éléments.

## 2. FlatList bien configurée

```tsx
// features/listings/components/ListingList.tsx
import { memo, useCallback } from 'react';
import { FlatList, type ListRenderItem } from 'react-native';
import type { Listing } from '../types';
import { ListingRow, LISTING_ROW_HEIGHT } from './ListingRow';

type ListingListProps = {
  listings: readonly Listing[];
  onOpen: (id: Listing['id']) => void;
  onEndReached: () => void;
};

const MemoListingRow = memo(ListingRow);

function keyExtractor(item: Listing): string {
  return item.id;
}

function getItemLayout(_: ArrayLike<Listing> | null | undefined, index: number) {
  return { length: LISTING_ROW_HEIGHT, offset: LISTING_ROW_HEIGHT * index, index };
}

export function ListingList({ listings, onOpen, onEndReached }: ListingListProps) {
  const renderItem = useCallback<ListRenderItem<Listing>>(
    ({ item }) => <MemoListingRow listing={item} onOpen={onOpen} />,
    [onOpen],
  );

  return (
    <FlatList
      data={listings}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      initialNumToRender={10}
      windowSize={7}
    />
  );
}
```

- **`keyExtractor`** renvoie un identifiant stable issu des données, jamais l'index.
- **`getItemLayout`** uniquement si la hauteur de ligne est **fixe et connue** (incluant les
  séparateurs). Il évite la mesure et rend `scrollToIndex` fiable. Une hauteur fausse donne des
  sauts.
- **Item mémoïsé** (`memo`) et props stables : l'item ne reçoit que ce qu'il affiche et un
  callback qui prend l'id. Pas de fonction fléchée créée par ligne dans le parent.
- `useCallback` et `memo` restent légitimes **ici** même avec React Compiler : c'est le cas mesuré
  « enfant mémoïsé qui reçoit une callback » de `developing-react`. Avec le compilateur actif et
  vérifié, on peut s'en passer : suivre la configuration du projet.
- Réglages `initialNumToRender` / `windowSize` / `maxToRenderPerBatch` : on garde les défauts et
  on ne les change qu'après mesure.
- Pas de `FlatList` imbriquée dans un `ScrollView` de même direction : la virtualisation casse.
  On utilise `ListHeaderComponent` / `ListFooterComponent`.

## 3. FlashList v2

- Exige la nouvelle architecture (toujours le cas depuis SDK 55).
- **`estimatedItemSize` est déprécié et ignoré** en v2 : plus d'estimation de taille à fournir.
  Un `estimatedItemSize` dans un code v2 est un résidu de migration v1.
- API proche de `FlatList` (`data`, `renderItem`, `keyExtractor`). Les composants sont
  **recyclés** : un item ne doit pas garder d'état local lié à une ancienne ligne. Si nécessaire,
  on réinitialise par `key` ou on remonte l'état.
- `getItemType` pour des items hétérogènes (en-tête de section, carte, publicité) : il améliore
  le recyclage.
- Migration v1 vers v2 : suivre le guide officiel, ne rien supposer.

## 4. Pagination infinie et rafraîchissement

```ts
// features/listings/hooks/useListingsFeed.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchListingsPage } from '../api/listingsApi';

const FIRST_PAGE: string | null = null;

export function useListingsFeed() {
  const query = useInfiniteQuery({
    queryKey: ['listings', 'feed'],
    queryFn: ({ pageParam, signal }) => fetchListingsPage({ cursor: pageParam, signal }),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const listings = query.data?.pages.flatMap((page) => page.items) ?? [];

  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  };

  return { ...query, listings, loadMore };
}
```

- Pagination par curseur côté API de préférence à l'offset, qui donne des doublons quand la liste
  bouge.
- `onEndReached` peut se déclencher plusieurs fois : la garde `!isFetchingNextPage` est
  obligatoire.
- Tirer pour rafraîchir : `refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}`.
- États à rendre : chargement initial (squelette), **vide** (`ListEmptyComponent`), erreur avec
  « Réessayer », chargement de page suivante (`ListFooterComponent`), fin de liste, et hors ligne
  (données en cache affichées avec un bandeau).

## 5. Re-rendus et React Compiler

- Mêmes principes que le web (`developing-react` → `references/performance.md`) : état minimal,
  rien de dérivé stocké, contexte découpé, pas de composant défini dans un composant.
- React Compiler : la configuration Babel est automatique depuis SDK 54, et la doc Expo montre
  l'activation par `experiments.reactCompiler: true`. Qu'il soit actif par défaut en SDK 58 n'est
  **pas vérifié** : lire la config du projet.
- Spécifique au mobile : un re-rendu du parent d'une liste coûte cher. On garde l'état qui change
  souvent (saisie de recherche, scroll) **hors** du composant qui porte la liste, ou on le passe par
  `useDeferredValue`.

## 6. Animations et gestes sur le thread UI

- **Reanimated 4** pour toute animation continue ou pilotée par un geste : elle tourne sur le
  thread UI et ne saccade pas quand le JS est occupé. Il exige la nouvelle architecture et le
  paquet `react-native-worklets` (`npx expo install react-native-reanimated react-native-worklets`).
  Reanimated 3 n'est plus maintenu.
- **Gesture Handler** (v3 recommandé par le SDK 58) pour les gestes : glisser, pincer, balayer pour
  supprimer. Pas de `PanResponder` pour du code neuf. La v3 a changé d'API par rapport à la v2 :
  lire la doc de la version installée.
- `Animated` de RN reste acceptable pour une animation simple avec `useNativeDriver: true`.
- Respecter la réduction des animations (voir `accessibility.md`).
- Animer `transform` et `opacity`, pas `width`, `height` ou `top`, qui recalculent la mise en page.

## 7. Images : `expo-image`

```tsx
import { Image } from 'expo-image';

<Image
  source={{ uri: listing.thumbnailUrl }}
  placeholder={{ blurhash: listing.blurhash }}
  contentFit="cover"
  transition={150}
  cachePolicy="memory-disk"
  recyclingKey={listing.id}
  accessibilityLabel={listing.thumbnailAlt}
  style={styles.thumbnail}
/>
```

- `expo-image` (SDWebImage / Glide) remplace `Image` de RN : cache disque, placeholders
  BlurHash / ThumbHash, `contentFit`, transitions.
- `recyclingKey` dans une liste recyclée (FlashList) : sans lui, l'ancienne image s'affiche le
  temps du chargement.
- Demander à l'API des vignettes à la bonne taille plutôt que de réduire une image pleine
  résolution sur l'appareil.
- Image décorative : `accessible={false}`. Image porteuse d'information : `accessibilityLabel`.

## 8. Mesurer avant d'optimiser

- **Toujours mesurer sur un build de release, sur un appareil Android d'entrée de gamme.** Le mode
  dev est bien plus lent et fausse tout.
- **React Native DevTools** (touche `j` dans le terminal Metro) : Profiler React (rendus et
  durées), onglets Performance et Network depuis RN 0.83, Memory.
- **Moniteur de performance** (menu développeur) : FPS du thread JS et du thread UI. Une chute du
  thread JS pendant le scroll signale un travail JS par item. Une chute du thread UI signale une
  vue trop lourde ou une animation hors thread UI.
- **Expo Atlas** pour la taille du bundle : `EXPO_ATLAS=true npx expo start`, ou `expo export`
  suivi de `npx expo-atlas`.
- **Hermes** est le moteur par défaut. Hermes V1 est le défaut côté RN depuis 0.84 ; son statut
  par défaut dans les SDK Expo 57/58 n'est **pas vérifié** : lire la config.
- On consigne la mesure avant / après dans le compte rendu : « optimisé » sans chiffre n'est pas
  un résultat.

## Sources (vérifié le 2026-11-27)

- https://reactnative.dev/docs/flatlist · https://reactnative.dev/docs/optimizing-flatlist-configuration
- https://shopify.github.io/flash-list/docs/v2-changes · https://shopify.github.io/flash-list/docs/v2-migration
- https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/
- https://docs.expo.dev/versions/latest/sdk/reanimated/ · https://docs.expo.dev/versions/latest/sdk/gesture-handler/
- https://docs.expo.dev/versions/latest/sdk/image/
- https://docs.expo.dev/guides/react-compiler/
- https://reactnative.dev/docs/react-native-devtools · https://docs.expo.dev/guides/analyzing-bundles/
- https://reactnative.dev/blog/2026/02/11/react-native-0.84 · https://docs.expo.dev/guides/using-hermes/
- https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries
