# Formulaires et clavier

> Vérifié le 2026-11-27 : `TextInput` de RN 0.88, guide Expo « Keyboard handling »,
> `@react-native-community/datetimepicker` 9.2.1 recommandé par le SDK 58,
> `react-native-keyboard-controller` 1.22.7 recommandé par le SDK 58. La validation par schéma et
> son typage relèvent de `developing-typescript` ; l'UX des formulaires (libellés, erreurs, ordre)
> relève de `designing-ui-ux` (`references/forms-ux.md`).

## Sommaire

1. Gestion du clavier
2. Bien configurer un `TextInput`
3. Chaîne de focus et soumission
4. Champs numériques
5. Date et heure natives
6. Validation et erreurs
7. Exemple complet

---

## 1. Gestion du clavier

| Situation | Solution |
|---|---|
| Écran simple, un ou deux champs | `KeyboardAvoidingView` de RN, `behavior="padding"` |
| Écran sous un header de `Stack` | idem, avec `keyboardVerticalOffset={useHeaderHeight()}` |
| Long formulaire à plusieurs champs, barre « précédent / suivant », comportement identique iOS / Android | `react-native-keyboard-controller` (`KeyboardAwareScrollView`, `KeyboardToolbar`), **si le projet l'a déjà** ou après validation de la dépendance |

`KeyboardAvoidingView` de RN :

- Props : `behavior` (`'padding' | 'height' | 'position'`), `keyboardVerticalOffset`, `enabled`.
  Fixer `behavior` **sur les deux plateformes** : sans lui, la vue reste sous le clavier sur
  Android en edge-to-edge. `padding` est le comportement le plus fiable.
- Ne pas combiner `softwareKeyboardLayoutMode: 'pan'` (config Android) avec `behavior="padding"` :
  le champ monterait deux fois.
- Expo le juge adapté au prototypage et aux écrans simples. Pour un formulaire complexe, il
  conseille d'envisager `react-native-keyboard-controller`.

`react-native-keyboard-controller` (dépendance native, à valider) :

- Exige un `<KeyboardProvider>` à la racine et Reanimated. Le guide Expo indique un dev build ;
  la page de référence du SDK le dit inclus dans Expo Go. En cas de doute, viser le dev build.
- `KeyboardAwareScrollView` (`bottomOffset`, `extraKeyboardSpace`, `disableScrollOnKeyboardHide`)
  fait défiler jusqu'au champ actif.
- `KeyboardToolbar` s'écrit en composants composés (`KeyboardToolbar.Prev`, `.Next`, `.Done`).
  L'ancienne API par props (`showArrows`, `onNextCallback`) est remplacée.

Dans tous les cas : `keyboardShouldPersistTaps="handled"` sur le `ScrollView` du formulaire.
Sans lui, le premier appui sur un bouton ne fait que fermer le clavier.

## 2. Bien configurer un `TextInput`

Les props récentes, alignées sur le web, **priment** sur les anciennes :

| Rôle | Prop à utiliser | Ancienne prop (remplacée) |
|---|---|---|
| Type de clavier | `inputMode` : `text`, `decimal`, `numeric`, `tel`, `search`, `email`, `url`, `none` | `keyboardType` |
| Touche de validation | `enterKeyHint` : `done`, `next`, `search`, `send`, `go` (`enter` iOS seul, `previous` Android seul) | `returnKeyType` |
| Comportement à la validation | `submitBehavior` : `'submit'`, `'blurAndSubmit'`, `'newline'` | `blurOnSubmit` (déprécié) |
| Remplissage automatique | `autoComplete` (`email`, `username`, `current-password`, `new-password`, `one-time-code`, `tel`, `postal-code`…) | — |

- `textContentType` (iOS seul) prime sur `autoComplete` quand les deux sont fixés : n'en mettre
  **qu'un**, `autoComplete` de préférence (il couvre les deux plateformes).
- `keyboardType` ne reste utile que pour un clavier sans équivalent dans `inputMode`
  (`number-pad`, `phone-pad`, `ascii-capable`…).
- Mot de passe : `secureTextEntry`, `autoComplete="current-password"` ou `"new-password"`, et un
  bouton « Afficher » accessible.
- `autoCapitalize="none"` et `autoCorrect={false}` pour un email, un identifiant ou un code.
- Chaque champ a un **libellé visible** et un `accessibilityLabel` identique sur le `TextInput`.
  `aria-labelledby` / `accessibilityLabelledBy` ne fonctionne que sur Android : il ne suffit pas
  seul (voir `accessibility.md`). Le placeholder ne remplace pas le libellé.

## 3. Chaîne de focus et soumission

```tsx
const passwordRef = useRef<TextInput>(null);

<TextInput
  value={email}
  onChangeText={setEmail}
  inputMode="email"
  autoComplete="email"
  autoCapitalize="none"
  enterKeyHint="next"
  submitBehavior="submit"
  onSubmitEditing={() => passwordRef.current?.focus()}
/>
<TextInput
  ref={passwordRef}
  value={password}
  onChangeText={setPassword}
  secureTextEntry
  autoComplete="current-password"
  enterKeyHint="done"
  submitBehavior="blurAndSubmit"
  onSubmitEditing={handleSubmit}
/>
```

- `submitBehavior="submit"` garde le clavier ouvert pendant le passage au champ suivant, donc pas
  de clignotement.
- Le dernier champ soumet. Le bouton d'envoi reste visible au-dessus du clavier.
- Ordre de focus = ordre visuel = ordre de lecture du lecteur d'écran.

## 4. Champs numériques

- La saisie reste une **chaîne** dans l'état du formulaire. Elle n'est convertie en nombre qu'à la
  validation : `Number("")` vaut `0`, et le séparateur décimal dépend de la locale (`,` en
  français).
- `inputMode="decimal"` pour un prix, `"numeric"` pour un entier, `"tel"` pour un téléphone
  (jamais `numeric`, qui exclut `+`).
- Normaliser avant de convertir (`value.replace(',', '.')`), valider par schéma, et afficher la
  valeur formatée par `Intl.NumberFormat` hors édition.
- Un montant se manipule en centimes entiers côté domaine.

## 5. Date et heure natives

- Le paquet documenté par le SDK 58 est `@react-native-community/datetimepicker`.
- La même page présente `@expo/ui` (SwiftUI / Jetpack Compose) comme remplaçant direct. À ne pas
  introduire sans validation : c'est une dépendance et une API à part.
- Les comportements diffèrent : sur Android, le sélecteur s'ouvre en dialogue impératif ; sur iOS,
  il est en ligne ou en sheet. On l'enveloppe dans **un composant `DateField` partagé** qui expose
  une API unique (`value: Date | null`, `onChange`, `label`, `minimumDate`) et cache les
  différences.
- Jamais de sélecteur de date reconstruit à la main, ni de saisie libre « JJ/MM/AAAA » quand le
  sélecteur natif convient.
- Fuseaux : la valeur sort en `Date` locale. La sérialisation vers l'API (ISO 8601 avec fuseau)
  se fait dans la couche service.

## 6. Validation et erreurs

- Schéma unique (Zod ou la librairie du projet) partagé entre formulaire et couche API. Typage
  dérivé du schéma : skill `developing-typescript`.
- Validation au **blur** puis à la soumission. Pas d'erreur affichée pendant la première saisie.
- L'erreur est affichée sous le champ, liée au champ pour le lecteur d'écran, et **annoncée** à
  la soumission (`AccessibilityInfo.announceForAccessibility`). Le focus revient au premier champ
  en erreur.
- Pendant l'envoi : bouton désactivé avec `accessibilityState={{ busy: true, disabled: true }}`,
  indicateur visible, et double envoi impossible.
- Sans réseau : le formulaire s'enregistre localement et part plus tard (voir
  `data-and-offline.md`). On ne bloque pas l'utilisateur derrière un « Pas de connexion ».
- Bibliothèque de formulaires (React Hook Form, TanStack Form…) : réutiliser celle du projet, ne
  pas en introduire une pour deux champs.

## 7. Exemple complet

```tsx
// features/auth/components/SignInForm.tsx
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useThemedStyles } from '@/shared/theme/useThemedStyles';
import type { Theme } from '@/shared/theme/theme';

type SignInFormProps = {
  isPending: boolean;
  error: string | null;
  onSubmit: (credentials: { email: string; password: string }) => void;
};

export function SignInForm({ isPending, error, onSubmit }: SignInFormProps) {
  const styles = useThemedStyles(createStyles);
  const headerHeight = useHeaderHeight();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = () => {
    if (!isPending) onSubmit({ email: email.trim(), password });
  };

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.flex}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.label}>Adresse e-mail</Text>
        <TextInput
          accessibilityLabel="Adresse e-mail"
          value={email}
          onChangeText={setEmail}
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          enterKeyHint="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          style={styles.input}
        />
        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          ref={passwordRef}
          accessibilityLabel="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          enterKeyHint="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={handleSubmit}
          style={styles.input}
        />
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isPending, busy: isPending }}
            disabled={isPending}
            onPress={handleSubmit}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonLabel}>{isPending ? 'Connexion…' : 'Se connecter'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: Theme) {
  return {
    flex: { flex: 1 },
    content: { padding: theme.spacing.md, gap: theme.spacing.sm },
    label: { fontSize: theme.fontSize.body, color: theme.colors.text },
    input: {
      minHeight: 48,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      color: theme.colors.text,
      fontSize: theme.fontSize.body,
    },
    error: { color: theme.colors.danger, fontSize: theme.fontSize.body },
    actions: { marginTop: theme.spacing.md },
    button: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
    },
    buttonPressed: { opacity: 0.85 },
    buttonLabel: { color: theme.colors.background, fontSize: theme.fontSize.body, fontWeight: '600' },
  } as const;
}
```

- `accessibilityRole="alert"` marque le message, mais seule une annonce explicite
  (`AccessibilityInfo.announceForAccessibility`, déclenchée par l'appelant quand l'erreur change)
  garantit sa lecture sur les deux plateformes.
- `useHeaderHeight` vient de `@react-navigation/elements`, installé avec Expo Router. Vérifier sa
  présence dans `package.json` avant de l'importer.

## Sources (vérifié le 2026-11-27)

- https://reactnative.dev/docs/textinput · https://reactnative.dev/docs/keyboardavoidingview
- https://docs.expo.dev/guides/keyboard-handling/
- https://docs.expo.dev/versions/latest/sdk/keyboard-controller/
- https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-aware-scroll-view
- https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-toolbar
- https://docs.expo.dev/versions/latest/sdk/date-time-picker/ · https://docs.expo.dev/versions/latest/sdk/ui/
