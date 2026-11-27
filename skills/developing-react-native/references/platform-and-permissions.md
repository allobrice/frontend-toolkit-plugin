# Spécificités de plateforme et permissions

> Vérifié le 2026-11-27 sur la doc `Platform` de RN 0.88 et les pages des modules Expo (SDK 58).

## Sommaire

1. Une seule base de code, des écarts assumés
2. `Platform.OS` et `Platform.select`
3. Fichiers `.ios.tsx` / `.android.tsx`
4. Permissions

---

## 1. Une seule base de code, des écarts assumés

Le code est commun par défaut. Un écart de plateforme se justifie quand **le comportement attendu
par l'utilisateur** diffère (navigation, sélecteur de date, partage, haptique), pas pour contourner
un bug de mise en page qu'un style commun corrigerait. Chaque écart est testé sur les deux
plateformes.

## 2. `Platform.OS` et `Platform.select`

```ts
import { Platform, StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
      default: {},
    }),
  },
});
```

- `Platform.select` pour une **valeur** qui diffère. `Platform.OS === 'ios'` pour une branche
  courte de logique.
- Les couleurs de l'exemple sont des tokens dans un vrai projet. L'ombre s'exprime différemment
  par plateforme : c'est un écart légitime.
- `Platform.Version` pour une API qui n'existe qu'à partir d'une version d'OS (nombre sur Android,
  chaîne sur iOS). Commenter la raison.
- Plusieurs `Platform.OS` dans un même composant : c'est le signal pour extraire le comportement
  dans un module dédié (§3) ou une Strategy injectée.

## 3. Fichiers `.ios.tsx` / `.android.tsx`

Metro résout `DateField.ios.tsx` ou `DateField.android.tsx` à la place de `DateField.tsx` selon
la plateforme.

- **Seulement si l'implémentation diverge largement** (composant natif différent, flux différent),
  pas pour trois lignes : celles-ci restent dans `Platform.select`.
- Les deux fichiers exportent **la même API typée**. Un `DateField.types.ts` commun porte le type
  des props, importé par les deux implémentations, pour qu'elles ne divergent pas en silence.
- Tests : couvrir les deux variantes (jest-expo propose des presets par plateforme ; suivre la
  configuration du projet).

```
shared/ui/DateField/
├── DateField.types.ts      # export type DateFieldProps = { … }
├── DateField.ios.tsx       # export function DateField(props: DateFieldProps)
├── DateField.android.tsx   # export function DateField(props: DateFieldProps)
└── index.ts                # export { DateField } from './DateField'; export type { DateFieldProps } from './DateField.types';
```

## 4. Permissions

Les modules Expo exposent des fonctions `requestPermissionsAsync` / `getPermissionsAsync` et,
pour la plupart, des hooks (`useCameraPermissions`, `useMediaLibraryPermissions`…). Lire la page du
module installé pour le nom exact.

**Déclaration** : les textes iOS (`NSCameraUsageDescription`…) et les permissions Android se
déclarent dans `app.config.ts`, souvent via les options du config plugin du module. Le texte
explique **pourquoi** l'app en a besoin, dans la langue de l'app. Toute modification demande un
nouveau build.

**Demande au moment de l'usage**, jamais en rafale au démarrage :

```tsx
// features/listings/hooks/useListingPhotoPicker.ts
import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickResult =
  | { status: 'picked'; uris: string[] }
  | { status: 'cancelled' }
  | { status: 'denied'; canAskAgain: boolean };

export function useListingPhotoPicker() {
  const [permission, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const pick = async (): Promise<PickResult> => {
    const current = permission?.granted ? permission : await requestPermission();
    if (!current.granted) return { status: 'denied', canAskAgain: current.canAskAgain };

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true });
    if (result.canceled) return { status: 'cancelled' };
    return { status: 'picked', uris: result.assets.map((asset) => asset.uri) };
  };

  return { pick, openSettings: () => Linking.openSettings() };
}
```

- Expliquer avant la demande système quand le bénéfice n'est pas évident (écran ou texte
  d'introduction), puisque la demande système ne peut souvent être faite qu'une fois.
- **Refus** : l'app continue de fonctionner sans la fonctionnalité. Si `canAskAgain` vaut `false`,
  on propose « Ouvrir les réglages » (`Linking.openSettings()`) au lieu de redemander.
- **Accès partiel** (photos limitées sur iOS, localisation approximative) : à traiter comme un
  état valide, pas comme un refus.
- Ne demander que les permissions réellement utilisées : chaque permission déclarée est examinée
  par les stores.
- Les options exactes de `launchImageLibraryAsync` (`mediaTypes`…) dépendent de la version de
  `expo-image-picker` : vérifier sa page avant usage.

## Sources (vérifié le 2026-11-27)

- https://reactnative.dev/docs/platform · https://reactnative.dev/docs/platform-specific-code
- https://docs.expo.dev/guides/permissions/
- https://docs.expo.dev/versions/latest/sdk/imagepicker/
