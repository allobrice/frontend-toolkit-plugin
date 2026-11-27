# Anti-patterns React Native : avant / après

> Catalogue de revue. Les anti-patterns React communs au web (effets superflus, état dupliqué,
> `key` par index, composant défini dans un composant) sont dans `developing-react` →
> `references/anti-patterns.md`. Ici, seulement ce qui est propre au mobile, ou qui y coûte plus
> cher.

## Sommaire

1. `any` et types de confort
2. Logique métier dans un composant
3. `useEffect` pour dériver un état
4. Styles inline et valeurs en dur
5. `ScrollView` + `map` sur une longue liste
6. Token dans AsyncStorage
7. Données personnelles dans les logs
8. Conventions web plaquées sur le natif
9. Dimensions figées
10. `TouchableOpacity` et éléments interactifs sans accessibilité
11. Mise à jour OTA d'un changement natif

---

## 1. `any` et types de confort

```ts
// ❌
const params = useLocalSearchParams() as any;
const listing = (await res.json()) as Listing;
```

```ts
// ✅
const { id } = useLocalSearchParams<{ id: string }>();
const listing = listingSchema.parse(await res.json()); // validation à la frontière
```

Les paramètres de route et les réponses d'API sont des **entrées non fiables** : on les valide, on
ne les caste pas. Typage avancé : `developing-typescript`.

## 2. Logique métier dans un composant

```tsx
// ❌ l'écran appelle l'API, calcule, écrit en base et formate
export function PublishScreen() {
  const onPublish = async () => {
    const res = await fetch(`${API}/listings`, { method: 'POST', body: JSON.stringify(form) });
    if (!res.ok) await db.runAsync('INSERT INTO outbox …', [/* … */]);
    // …
  };
}
```

```tsx
// ✅ l'écran délègue à un hook de feature, lequel délègue aux services
export function PublishScreen() {
  const { publish, status } = usePublishListing(); // API, outbox, invalidation : dans la feature
  return <ListingForm onSubmit={publish} status={status} />;
}
```

## 3. `useEffect` pour dériver un état

```tsx
// ❌
const [total, setTotal] = useState(0);
useEffect(() => setTotal(items.reduce((sum, item) => sum + item.priceCents, 0)), [items]);
```

```tsx
// ✅
const totalCents = items.reduce((sum, item) => sum + item.priceCents, 0);
```

Même règle pour l'état réseau : on lit `useNetworkState()` ou `onlineManager`, on ne recopie pas la
valeur dans un `useState` par effet.

## 4. Styles inline et valeurs en dur

```tsx
// ❌ objet recréé à chaque rendu, couleur et espacements en dur, mode sombre impossible
<View style={{ padding: 16, backgroundColor: '#fff', borderRadius: 8 }}>
```

```tsx
// ✅
const styles = useThemedStyles(createStyles);
<View style={styles.card}>
```

Voir `styling.md`. Seule une valeur réellement dynamique se combine en tableau :
`[styles.bar, { width }]`.

## 5. `ScrollView` + `map` sur une longue liste

```tsx
// ❌ monte les 500 éléments d'un coup
<ScrollView>{listings.map((l) => <ListingCard key={l.id} listing={l} />)}</ScrollView>
```

```tsx
// ✅ virtualisée, paginée, item mémoïsé
<FlatList data={listings} keyExtractor={keyExtractor} renderItem={renderItem} onEndReached={loadMore} />
```

Voir `lists-and-performance.md`.

## 6. Token dans AsyncStorage

```ts
// ❌ stockage en clair, inclus dans les sauvegardes
await AsyncStorage.setItem('token', accessToken);
```

```ts
// ✅
await writeSecure('accessToken', accessToken); // expo-secure-store, WHEN_UNLOCKED_THIS_DEVICE_ONLY
```

Même défaut pour un token dans un store Zustand `persist`, dans le cache TanStack Query persisté
ou dans `app.config.ts`. Voir `security-and-storage.md`.

## 7. Données personnelles dans les logs

```ts
// ❌
console.log('login', email, response);
```

```ts
// ✅ aucun log de données personnelles ; le logger central masque et filtre par environnement
logger.info('auth.sign_in.success');
```

## 8. Conventions web plaquées sur le natif

| ❌ | ✅ |
|---|---|
| `<div>`, `<span>`, `onClick`, `className` | `View`, `Text`, `Pressable onPress`, `style` |
| Texte hors d'un `<Text>` | Tout texte dans un `Text` (sinon l'app plante) |
| `window`, `document`, `localStorage` | APIs RN / Expo (`Dimensions`, AsyncStorage, SecureStore) |
| Hover, tooltip, lien souligné pour une action | Bouton, appui long documenté, ligne de liste |
| `alert()` / modale HTML maison | `Alert.alert`, `presentation: 'modal' \| 'formSheet'` |
| Header et bouton retour dessinés à la main | En-tête natif du `Stack` |
| Pagination numérotée | Défilement infini + tirer pour rafraîchir |
| `<input type="date">` reconstruit | Sélecteur natif (`forms-and-keyboard.md` §5) |
| CSS / SCSS, `*.module.scss` | `StyleSheet` + thème typé |

Voir `navigation-and-native-ux.md`.

## 9. Dimensions figées

```ts
// ❌ lu une seule fois : faux après rotation, split-screen, pliable, taille de police changée
const { width } = Dimensions.get('window');
```

```ts
// ✅ suit les changements
const { width, fontScale } = useWindowDimensions();
```

## 10. `TouchableOpacity` et éléments interactifs sans accessibilité

```tsx
// ❌ cible trop petite, pas de rôle, pas de nom : VoiceOver annonce « bouton » ou rien
<TouchableOpacity onPress={onFavorite}><HeartIcon size={16} /></TouchableOpacity>
```

```tsx
// ✅
<IconButton label="Favori" selected={isFavorite} icon={<HeartIcon size={24} />} onPress={onFavorite} />
```

`Pressable` pour le code neuf (états `pressed`, `android_ripple`, `hitSlop`). Le composant
partagé impose nom, rôle, état et cible de 48. Voir `accessibility.md`.

## 11. Mise à jour OTA d'un changement natif

```
❌ Ajout de expo-camera + permission dans app.config.ts → eas update --channel production
   → crash au démarrage sur les builds existants (module natif absent)
```

```
✅ Nouveau build (eas build) → soumission → l'OTA ne transporte ensuite que du JS / des assets
   compatibles avec la runtimeVersion
```

Voir `build-and-release.md` §7.
