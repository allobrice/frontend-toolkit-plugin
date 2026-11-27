# Accessibilité en React Native

> Vérifié le 2026-11-27 sur la doc Accessibility et AccessibilityInfo de RN 0.88 et sur
> `useReducedMotion` de Reanimated. Le **barème** (critères WCAG, contrastes, niveaux de
> gravité, format d'audit) relève de la skill `auditing-accessibility`. Ce fichier ne couvre que
> l'API RN et les tests avec VoiceOver et TalkBack.

## Sommaire

1. Deux API équivalentes : `accessibility*` et `role` / `aria-*`
2. Nom, rôle, état, valeur
3. Regroupement et ordre de lecture
4. Cibles tactiles
5. Contrastes et texte dynamique
6. Réduction des animations
7. Annonces et changements d'écran
8. Masquer ce qui ne doit pas être lu
9. Tester avec VoiceOver et TalkBack

---

## 1. Deux API équivalentes : `accessibility*` et `role` / `aria-*`

RN documente deux familles de props, sans en déprécier aucune :

| Besoin | Props historiques | Props alignées sur le web |
|---|---|---|
| Rôle | `accessibilityRole` | `role` (prioritaire si les deux sont présents) |
| Nom | `accessibilityLabel` | `aria-label` |
| État | `accessibilityState={{ disabled, selected, checked, busy, expanded }}` | `aria-disabled`, `aria-selected`, `aria-checked`, `aria-busy`, `aria-expanded` |
| Valeur | `accessibilityValue={{ min, max, now, text }}` | `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` |
| Masquage | `accessibilityElementsHidden` (iOS), `importantForAccessibility` (Android) | `aria-hidden` |
| Région live | `accessibilityLiveRegion` (Android) | `aria-live` (Android) |
| Modale | `accessibilityViewIsModal` (iOS) | `aria-modal` (iOS) |

**Règle** : suivre la convention du projet. À défaut, choisir une famille et s'y tenir dans tout
le code. Ne jamais mélanger les deux sur un même élément. Les exemples ci-dessous utilisent les
props `accessibility*`.

`role` ajoute des valeurs que `accessibilityRole` nomme autrement (`heading` ↔ `header`) ou
n'a pas (`list`, `listitem`…). Vérifier la liste de la version installée.

## 2. Nom, rôle, état, valeur

Tout élément interactif expose **un rôle, un nom et son état**.

```tsx
// shared/ui/IconButton.tsx
import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

type IconButtonProps = {
  label: string; // nom accessible obligatoire : l'icône seule ne dit rien
  icon: ReactNode;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
};

export function IconButton({ label, icon, onPress, selected, disabled = false }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={styles.target}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
```

- **Libellé** : court, sans le rôle (« Ajouter aux favoris », pas « Bouton ajouter aux favoris »,
  puisque le lecteur annonce déjà « bouton »). Commencer par un verbe pour une action.
- **État** plutôt que libellé changeant : un favori actif reste « Favori » avec `selected: true`.
  On ne bascule pas entre « Ajouter » et « Retirer », sauf si le produit le demande.
- `accessibilityHint` seulement quand le résultat de l'action n'est pas évident (« Ouvre le
  détail de l'annonce »). Il est lu après une pause et peut être désactivé par l'utilisateur.
- Rôles usuels : `button`, `link` (navigation externe), `header` (titres de section), `image`,
  `switch`, `checkbox`, `radio`, `tab`, `search`, `adjustable` (slider, avec
  `accessibilityActions` `increment` / `decrement`).
- Titres d'écran et de section : `accessibilityRole="header"`. Les utilisateurs de lecteur d'écran
  naviguent par titres.
- `Switch` et `TextInput` natifs exposent déjà rôle et état : ne pas les écraser.

## 3. Regroupement et ordre de lecture

Une carte d'annonce lue élément par élément (« image », « Vélo », « 120 € », « Lyon ») oblige à
balayer quatre fois. On regroupe :

```tsx
// features/listings/components/ListingCard.tsx (extrait)
<View style={styles.card}>
  <Pressable
    accessible
    accessibilityRole="button"
    accessibilityLabel={`${listing.title}, ${formattedPrice}, ${listing.city}`}
    accessibilityHint="Ouvre l'annonce"
    onPress={() => onOpen(listing.id)}
    style={styles.main}
  >
    <Image source={{ uri: listing.thumbnailUrl }} accessible={false} style={styles.thumbnail} />
    <Text style={styles.title}>{listing.title}</Text>
    <Text style={styles.price}>{formattedPrice}</Text>
    <Text style={styles.city}>{listing.city}</Text>
  </Pressable>
  <IconButton
    label="Favori"
    selected={listing.isFavorite}
    icon={<HeartIcon filled={listing.isFavorite} />}
    onPress={() => onToggleFavorite(listing.id)}
  />
</View>
```

- `accessible` sur le conteneur en fait **un seul élément** : ses enfants ne sont plus focalisables
  séparément. Le favori, action distincte, reste **hors** du groupe, comme élément frère.
- Ne pas mettre un bouton dans un groupe `accessible` : il devient inatteignable. L'alternative
  est `accessibilityActions` sur le groupe (« Ajouter aux favoris » comme action personnalisée).
- **Ordre de lecture = ordre du code** : il suit l'arbre des vues. Une mise en page inversée par
  `flexDirection: 'row-reverse'` ou un positionnement absolu change l'ordre visuel, pas l'ordre
  lu : réordonner le JSX plutôt.
- Les valeurs combinées dans le libellé sont **formatées** (prix avec devise, date en toutes
  lettres), pas brutes.

## 4. Cibles tactiles

- Au moins **44 × 44 pt (iOS, Apple HIG) et 48 × 48 dp (Android, Material)**. On vise 48 sur les
  deux plateformes pour un composant partagé.
- Pour une icône visuellement plus petite : `hitSlop` (`8` autour d'une icône de 32 donne 48) ou
  `minWidth` / `minHeight` sur le `Pressable`. `hitSlop` ne déborde pas du parent : vérifier que
  le parent n'est pas plus petit.
- Espacement suffisant entre deux cibles voisines (au moins 8) pour éviter les appuis involontaires.

## 5. Contrastes et texte dynamique

- Contraste minimal AA : 4,5:1 pour le texte courant, 3:1 pour le texte large et les éléments
  d'interface (icônes, bordures de champ), **dans les deux schémas** clair et sombre. Barème et
  outils : `auditing-accessibility`.
- L'information ne passe jamais par la couleur seule : une erreur a un texte, un statut a une
  icône ou un libellé.
- Texte dynamique : `allowFontScaling` reste actif et la mise en page tient à 200 % (voir
  `styling.md` §6).
- `AccessibilityInfo.isBoldTextEnabled()` (iOS) et `isGrayscaleEnabled()` permettent des
  adaptations ciblées si le produit le demande.

## 6. Réduction des animations

```ts
// shared/hooks/useReduceMotion.ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (isMounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
```

- `AccessibilityInfo.isReduceMotionEnabled()` est asynchrone. L'événement `reduceMotionChanged`
  suit les changements en direct.
- `useReducedMotion()` de Reanimated est synchrone mais **ne lit la valeur qu'au lancement** et ne
  se met pas à jour. C'est acceptable pour une décision ponctuelle ; pour suivre le réglage en
  direct, le hook ci-dessus.
- Les animations Reanimated acceptent `reduceMotion: ReduceMotion.System` dans leur configuration
  pour suivre le réglage système. À vérifier dans la doc de la version installée.
- Avec la réduction activée : pas de parallaxe, pas de zoom, pas d'animation en boucle. Les fondus
  courts restent acceptables. L'information portée par l'animation reste disponible autrement.

## 7. Annonces et changements d'écran

- Résultat d'une action sans changement d'écran (ajout au panier, envoi en file d'attente, erreur
  de formulaire) : `AccessibilityInfo.announceForAccessibility('Annonce enregistrée, envoi dès le
  retour du réseau')`.
- Région live (Android) : `accessibilityLiveRegion="polite"` sur un compteur ou un statut qui change.
- Après une navigation, le lecteur se place en haut du nouvel écran (navigateurs natifs). Un titre
  d'écran (`header`) en premier élément aide l'orientation.
- Pour déplacer le focus après une erreur : `AccessibilityInfo.setAccessibilityFocus` avec le
  handle natif de l'élément (`findNodeHandle(ref.current)`). Son usage et sa fiabilité varient :
  le tester sur les deux plateformes.
- Modale custom (hors navigateur natif) : `accessibilityViewIsModal` (iOS) pour que VoiceOver ne
  sorte pas de la modale.

## 8. Masquer ce qui ne doit pas être lu

- Image ou icône décorative : `accessible={false}` et pas de libellé.
- Contenu sous une modale ou un menu ouvert : `importantForAccessibility="no-hide-descendants"`
  (Android) et `accessibilityElementsHidden` (iOS), ou `aria-hidden`.
- Ne jamais masquer un élément interactif visible.

## 9. Tester avec VoiceOver et TalkBack

À faire sur un **appareil réel** pour toute fonctionnalité qui touche l'UI, avant de déclarer la
tâche terminée :

| Vérification | VoiceOver (iOS) | TalkBack (Android) |
|---|---|---|
| Activer | Réglages › Accessibilité › VoiceOver, ou triple clic latéral si le raccourci est configuré | Paramètres › Accessibilité › TalkBack, ou raccourci des touches de volume |
| Parcourir | balayage droite / gauche | balayage droite / gauche |
| Activer l'élément | double tap | double tap |
| Naviguer par titres | rotor › Titres, puis balayage haut / bas | menu de lecture › Titres |

Pour chaque écran :

1. Chaque élément interactif annonce un **nom**, un **rôle** et son **état** corrects.
2. L'ordre de lecture suit l'ordre visuel. Aucun élément décoratif n'est lu.
3. Une carte se lit en un seul arrêt, avec ses actions secondaires atteignables.
4. Les erreurs et confirmations sont annoncées.
5. On peut fermer une modale et revenir en arrière.
6. Le parcours complet est faisable sans voir l'écran.

Compléter avec : texte à la taille maximale, mode sombre, réduction des animations activée.
Accessibility Inspector (Xcode) et Accessibility Scanner (Android) aident à repérer les manques,
mais ne remplacent pas le test au lecteur d'écran. Dans les tests automatisés, les requêtes par
rôle et par libellé (`testing.md`) vérifient la partie programmatique.

## Sources (vérifié le 2026-11-27)

- https://reactnative.dev/docs/accessibility
- https://reactnative.dev/docs/accessibilityinfo
- https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/
- Cibles de 44 pt et 48 dp : recommandations Apple Human Interface Guidelines et Material Design
  (section accessibilité), reprises par la skill `designing-ui-ux`
