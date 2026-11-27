# Navigation et UX native

> Vérifié le 2026-11-27 (Expo Router ~58, `expo-haptics` ~58). Les principes UX généraux (Laws
> of UX, états chargement / vide / erreur, hiérarchie) relèvent de la skill `designing-ui-ux` :
> ce fichier ne traite que de ce qui est propre au natif.

## Sommaire

1. Principe : une app native, pas un site
2. Retour : bouton Android, geste iOS, retour prédictif
3. En-têtes natifs
4. Onglets
5. Modales et sheets
6. Retours tactiles et haptiques
7. Conventions à ne pas importer du web

---

## 1. Principe : une app native, pas un site

L'utilisateur iOS et l'utilisateur Android ont des habitudes différentes. On utilise les
navigateurs natifs (`Stack` natif, `Tabs`) d'Expo Router, qui donnent gratuitement transitions,
gestes, en-têtes et accessibilité de chaque plateforme. Un composant de navigation reconstruit en
`View` + `Pressable` perd tout cela.

## 2. Retour : bouton Android, geste iOS, retour prédictif

- **iOS** : le geste de balayage depuis le bord gauche revient en arrière dans un `Stack`. Ne pas
  le désactiver (`gestureEnabled: false`) sauf pour un écran où le retour ferait perdre des données
  non enregistrées, et proposer alors une sortie explicite.
- **Android** : le bouton ou geste système de retour doit **toujours** faire quelque chose de
  prévisible : fermer la sheet, revenir à l'écran précédent, puis quitter l'app depuis la racine.
  Expo Router le gère pour les navigateurs. Un `BackHandler` custom n'est justifié que pour
  intercepter une sortie avec des modifications non enregistrées.
- **Retour prédictif (Android 13+)** : `android.predictiveBackGestureEnabled` dans la config d'app,
  **`false` par défaut**. L'activer est un choix projet (nouveau build) qui suppose de tester les
  `BackHandler` existants.
- Confirmation avant de quitter un formulaire modifié : intercepter l'événement `beforeRemove` de
  la navigation et afficher une `Alert` native (« Abandonner les modifications ? »).

## 3. En-têtes natifs

```tsx
// src/app/(app)/listings/[id].tsx
import { Stack, useLocalSearchParams } from 'expo-router';
import { ListingDetailScreen } from '@/features/listings/screens/ListingDetailScreen';
import { useListing } from '@/features/listings/hooks/useListing';

export default function ListingDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useListing(id);

  return (
    <>
      <Stack.Screen options={{ title: data?.title ?? '' }} />
      <ListingDetailScreen id={id} />
    </>
  );
}
```

- Titre, bouton de retour et actions d'en-tête passent par les `options` du `Stack`, pas par un
  header dessiné dans l'écran. Les conventions diffèrent selon la plateforme (titre centré sur iOS,
  aligné à gauche sur Android, grand titre iOS) : les laisser au navigateur natif.
- Actions d'en-tête : une ou deux au maximum, avec icône **et** `accessibilityLabel`. Le reste va
  dans un menu.

## 4. Onglets

- Trois à cinq destinations de premier niveau, toujours visibles. Le libellé reste affiché sous
  l'icône.
- Chaque onglet garde sa propre pile. Un second appui sur l'onglet actif remonte à sa racine
  (comportement par défaut à préserver).
- Pas d'onglet qui ouvre une action (« + Publier ») sans raison forte : une action se place dans
  l'écran ou dans l'en-tête.

## 5. Modales et sheets

`presentation` du `Stack.Screen` : `card` (défaut), `modal`, `transparentModal`,
`containedModal`, `containedTransparentModal`, `fullScreenModal`, `formSheet`.

```tsx
// src/app/(app)/_layout.tsx (extrait)
<Stack.Screen
  name="filters"
  options={{
    presentation: 'formSheet',
    sheetAllowedDetents: [0.5, 1],
    sheetGrabberVisible: true,
    title: 'Filtres',
  }}
/>
```

| Besoin | Présentation |
|---|---|
| Tâche courte, contexte à garder visible (filtres, choix) | `formSheet` avec détentes |
| Tâche autonome (création d'annonce) | `modal`, fermeture explicite (« Annuler ») |
| Flux bloquant (onboarding, paiement) | `fullScreenModal` |
| Confirmation destructrice | `Alert` native ou action sheet, pas un écran |

- `sheetAllowedDetents` : fractions croissantes ou `'fitToContents'`, trois au maximum sur Android.
  `sheetGrabberVisible` ne vaut que pour iOS. Sur Android, un `formSheet` n'a pas de header natif :
  y placer un titre et un bouton de fermeture accessibles.
- Une modale ou une sheet a toujours une sortie : geste, bouton « Fermer » ou « Annuler », et retour
  Android.

## 6. Retours tactiles et haptiques

- `Pressable` avec un retour visuel d'appui (`style={({ pressed }) => …}`). Sur Android,
  `android_ripple` donne l'effet attendu.
- `expo-haptics` **avec parcimonie**, pour confirmer un événement significatif, pas chaque appui :

| Événement | API |
|---|---|
| Succès, avertissement, échec d'une action | `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` (`Warning`, `Error`) |
| Changement de sélection (picker, segment, toggle) | `Haptics.selectionAsync()` |
| Impact physique (glisser-déposer, seuil atteint) | `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` (`Medium`, `Heavy`, `Rigid`, `Soft`) |
| Retour Android dédié | `Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)` (Android seul) |

- L'haptique ne remplace jamais un retour visuel ou une annonce d'accessibilité. Elle s'enveloppe
  dans `shared/lib/haptics.ts`, pour être mockable et désactivable.

## 7. Conventions à ne pas importer du web

| Réflexe web | En natif |
|---|---|
| Survol (`:hover`), tooltip au survol | rien ; l'info importante est visible ou derrière un appui long documenté |
| Lien texte souligné pour une action | bouton ou ligne de liste appuyable |
| Fil d'Ariane, menu hamburger pour la navigation principale | onglets, pile, bouton retour |
| `window.alert`, modale HTML maison pour confirmer | `Alert.alert` natif |
| Pagination numérotée | défilement infini (`onEndReached`) et tirer pour rafraîchir (`refreshControl`) |
| Scroll horizontal caché, carrousel sans indicateur | liste horizontale avec indicateur ou sous-écran |
| `<select>` reconstruit | sélecteur natif, sheet de choix |

## Sources (vérifié le 2026-11-27)

- https://docs.expo.dev/router/advanced/stack/ · https://docs.expo.dev/router/advanced/modals/
- https://docs.expo.dev/router/advanced/tabs/
- https://docs.expo.dev/versions/latest/config/app/ (`android.predictiveBackGestureEnabled`)
- https://docs.expo.dev/versions/latest/sdk/haptics/
- https://reactnative.dev/docs/pressable · https://reactnative.dev/docs/backhandler
