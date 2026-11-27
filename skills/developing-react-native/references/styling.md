# Styles : StyleSheet, thème typé, mode sombre, safe areas, texte dynamique

> Vérifié le 2026-11-27 (RN 0.88, Expo SDK 58, `react-native-safe-area-context` ~5.11 recommandé
> par le SDK). Les tokens réels du projet (couleurs, échelle d'espacement, typographie) et ses
> éventuelles exceptions de style viennent de son `CLAUDE.md` : ce fichier ne fixe que la méthode.

## Sommaire

1. Règles
2. Thème typé issu des design tokens
3. `StyleSheet.create` et styles dépendant du thème
4. Mode sombre
5. Safe areas et edge-to-edge Android
6. Tailles de police dynamiques
7. Dépendances de style supplémentaires

---

## 1. Règles

- **`StyleSheet.create`** pour tout style statique, défini **hors du composant**.
- **Aucune valeur en dur** : couleurs, espacements, rayons, tailles de police et durées viennent du
  thème. Un `'#fff'` ou un `margin: 13` dans un composant est un défaut.
- **Pas d'objet de style inline recréé à chaque rendu** (`style={{ padding: 16 }}`). Seule
  exception : une valeur réellement dynamique (position animée, largeur calculée), combinée en
  tableau avec un style statique : `style={[styles.bar, { width }]}`.
- Variantes par sélection d'objets (`styles[variant]`), pas par ternaires imbriqués dans le JSX.
- Pas de CSS ni de SCSS : la skill `developing-scss` ne s'applique pas ici. Seuls les **tokens
  bruts** peuvent être partagés avec le web (voir `monorepo.md`).

## 2. Thème typé issu des design tokens

```ts
// shared/theme/tokens.ts : valeurs brutes, éventuellement générées depuis packages/tokens
export const palette = {
  neutral0: '#FFFFFF',
  neutral900: '#111827',
  neutral700: '#374151',
  neutral100: '#F3F4F6',
  brand500: '#2563EB',
  brand300: '#93C5FD',
  danger500: '#DC2626',
  danger300: '#FCA5A5',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 4, md: 8, lg: 16, full: 999 } as const;
export const fontSize = { caption: 12, body: 16, title: 20, display: 28 } as const;
```

```ts
// shared/theme/theme.ts : rôles sémantiques, une entrée par schéma
import { fontSize, palette, radius, spacing } from './tokens';

type ColorRole = 'background' | 'surface' | 'text' | 'textMuted' | 'primary' | 'danger' | 'border';

export type Theme = {
  colors: Record<ColorRole, string>;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
};

const shared = { spacing, radius, fontSize };

export const lightTheme: Theme = {
  ...shared,
  colors: {
    background: palette.neutral0,
    surface: palette.neutral100,
    text: palette.neutral900,
    textMuted: palette.neutral700,
    primary: palette.brand500,
    danger: palette.danger500,
    border: palette.neutral100,
  },
};

export const darkTheme: Theme = {
  ...shared,
  colors: {
    background: palette.neutral900,
    surface: palette.neutral700,
    text: palette.neutral0,
    textMuted: palette.neutral100,
    primary: palette.brand300,
    danger: palette.danger300,
    border: palette.neutral700,
  },
};
```

- Les composants consomment des **rôles** (`colors.text`), jamais la palette brute : le mode
  sombre et un futur rebranding ne touchent alors que `theme.ts`.
- Chaque paire texte / fond respecte le contraste WCAG AA (4,5:1 pour le texte courant, 3:1 pour
  le texte large et les composants d'interface) **dans les deux schémas**. Barème complet : skill
  `auditing-accessibility`.

## 3. `StyleSheet.create` et styles dépendant du thème

Pour un style qui dépend du thème, on écrit une fabrique hors du composant, mémoïsée par thème :

```ts
// shared/theme/useThemedStyles.ts
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type { Theme } from './theme';
import { useTheme } from './ThemeProvider';

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: Theme) => T,
): T {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
}
```

```tsx
// features/listings/components/ListingCard.tsx
import { Text, View } from 'react-native';
import type { Theme } from '@/shared/theme/theme';
import { useThemedStyles } from '@/shared/theme/useThemedStyles';

type ListingCardProps = { title: string; price: string };

export function ListingCard({ title, price }: ListingCardProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.price}>{price}</Text>
    </View>
  );
}

function createStyles(theme: Theme) {
  return {
    card: {
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
    },
    title: { fontSize: theme.fontSize.body, color: theme.colors.text },
    price: { fontSize: theme.fontSize.title, color: theme.colors.primary, fontWeight: '600' },
  } as const;
}
```

- `createStyles` est une fonction de module, donc stable : le `useMemo` ne recalcule qu'au
  changement de thème. Avec React Compiler actif, la mémoïsation reste explicite ici parce que
  l'API (`factory` reçue en paramètre) l'exige.
- Les styles statiques qui ne dépendent pas du thème restent dans un `StyleSheet.create` de module.

## 4. Mode sombre

```tsx
// shared/theme/ThemeProvider.tsx
import { createContext, use, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type Theme } from './theme';

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  return <ThemeContext value={scheme === 'dark' ? darkTheme : lightTheme}>{children}</ThemeContext>;
}

export function useTheme(): Theme {
  const theme = use(ThemeContext);
  if (!theme) throw new Error('useTheme doit être utilisé sous <ThemeProvider>');
  return theme;
}
```

- `useColorScheme()` suit le réglage système en direct.
- Dans `app.config.ts`, `userInterfaceStyle: 'automatic'` est nécessaire pour que l'app suive le
  schéma système. Avec `'light'`, `useColorScheme` renvoie toujours `'light'`. Les prérequis par
  plateforme sont dans le guide Expo « Color themes ». Le modifier demande un nouveau build.
- La barre de statut suit le thème (`<StatusBar style="auto" />` de `expo-status-bar`), comme les
  couleurs de navigation (`ThemeProvider` d'Expo Router / React Navigation, alimenté par le même
  thème).
- Un choix manuel (« clair / sombre / système ») est stocké en AsyncStorage, puisque c'est une
  préférence non sensible, et prime sur `useColorScheme`.

## 5. Safe areas et edge-to-edge Android

- **Edge-to-edge est obligatoire sur Android depuis SDK 54** (cible Android 16 / API 36, non
  désactivable) : l'app dessine sous la barre de statut et la barre de navigation. Il faut gérer
  les insets partout, Android compris.
- `react-native-safe-area-context` est préinstallé avec Expo Router. On utilise :
  - `useSafeAreaInsets()` pour ajouter des marges précises (bouton fixé en bas, header custom) ;
  - `<SafeAreaView edges={['top']}>` de **`react-native-safe-area-context`**, jamais celui de
    `react-native` (limité à iOS) ;
  - les écrans dans un `Stack` avec header natif : le header gère déjà le haut, n'ajouter que les
    bords nécessaires.

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function StickyFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.footer, { paddingBottom: insets.bottom }]}>{children}</View>;
}

const styles = StyleSheet.create({ footer: { paddingHorizontal: 16, paddingTop: 12 } });
```

- Une `FlatList` plein écran reçoit les insets dans `contentContainerStyle`, pas sur un parent :
  le contenu défile alors sous les barres, comme attendu.

## 6. Tailles de police dynamiques

- `allowFontScaling` vaut `true` par défaut sur `Text` et `TextInput` : **ne pas le désactiver**.
  C'est un réglage d'accessibilité de l'utilisateur.
- `maxFontSizeMultiplier` plafonne l'agrandissement d'un texte précis (`>= 1` fixe le plafond, `0`
  le supprime). À réserver aux éléments contraints (onglet, badge), jamais au corps de texte.
- `useWindowDimensions().fontScale` (mis à jour en direct) ou `PixelRatio.getFontScale()`
  permettent d'adapter la mise en page : passer en colonne, autoriser le retour à la ligne.
- Mise en page qui tient à 200 % : pas de hauteur fixe sur un conteneur de texte,
  `numberOfLines` seulement avec le texte complet disponible ailleurs, `flexWrap` sur les rangées.
- Un composant `Text` partagé (`shared/ui/Text.tsx`) porte les variantes typographiques du thème
  et la couleur par défaut, pour ne pas répéter les styles de texte.

## 7. Dépendances de style supplémentaires

`StyleSheet` + thème typé couvre le besoin. Une librairie de style (CSS-in-JS, utility-first,
système de thème tiers) n'entre que **si le projet l'utilise déjà** ou avec une justification
écrite et validée :

- le besoin qu'elle couvre et que le thème typé ne couvre pas ;
- son coût (taille, runtime, compatibilité avec la nouvelle architecture, maintenance) ;
- son alignement avec le SDK (`npx expo install`).

Si le projet en utilise une, on suit ses conventions au lieu d'introduire `StyleSheet` à côté.

## Sources (vérifié le 2026-11-27)

- https://reactnative.dev/docs/stylesheet · https://reactnative.dev/docs/usecolorscheme
- https://reactnative.dev/docs/text (`allowFontScaling`, `maxFontSizeMultiplier`)
- https://reactnative.dev/docs/usewindowdimensions · https://reactnative.dev/docs/pixelratio
- https://docs.expo.dev/develop/user-interface/color-themes/
- https://docs.expo.dev/develop/user-interface/safe-areas/
- https://docs.expo.dev/versions/latest/sdk/safe-area-context/
- https://expo.dev/changelog/sdk-54 (edge-to-edge obligatoire)
