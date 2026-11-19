# Micro-interactions & Feedback — Référence actionnable

Les micro-interactions sont les petits feedbacks visuels/animés qui donnent vie à une interface. Elles construisent la perception de qualité et de réactivité.

## Table des matières

1. [Principes du feedback](#principes-du-feedback)
2. [Timing et durées](#timing-et-durées)
3. [États interactifs obligatoires](#états-interactifs-obligatoires)
4. [Transitions et animations](#transitions-et-animations)
5. [Loaders, skeletons, progress](#loaders-skeletons-progress)
6. [Optimistic UI](#optimistic-ui)
7. [Anti-patterns](#anti-patterns)

---

## Principes du feedback

### Tout doit réagir
Toute action utilisateur doit produire un feedback visuel immédiat (< 100 ms). Sans feedback, l'utilisateur :
- doute que son action ait été prise en compte,
- re-clique (double-submit),
- abandonne.

### Trois temporalités de feedback

1. **Immédiat (< 100 ms)** : l'utilisateur perçoit comme instantané.
   - Changement d'état visuel du bouton au clic.
   - Focus ring.
   - Checkbox qui coche.

2. **Court (100–400 ms)** : ressenti comme fluide.
   - Ouverture d'un menu, d'un dropdown.
   - Transition entre vues.
   - Validation d'un champ.

3. **Long (> 400 ms)** : l'utilisateur attend (Doherty Threshold).
   - Chargement de données.
   - Upload.
   - Traitement serveur.
   - → Nécessite un **indicateur de progression**.

### Feedback ≠ animation gratuite
Chaque animation doit avoir une **fonction** :
- Indiquer un état (loading, success).
- Guider l'attention (nouvel élément qui apparaît).
- Montrer une relation (élément qui se déplace vers sa cible).
- Renforcer une action (bouton qui "s'enfonce").

Animer pour animer = bruit, latence perçue en plus, fatigue visuelle.

---

## Timing et durées

### Durées types

| Interaction | Durée recommandée |
|---|---|
| Changement d'état immédiat (hover, active) | 100-150 ms |
| Transition simple (fade, slide court) | 150-250 ms |
| Ouverture de modale, drawer | 200-300 ms |
| Animation complexe (choreography) | 300-500 ms |
| Transition de page | 300-500 ms |
| Animation décorative (confetti, celebration) | 500-1500 ms |

**Au-delà de 500 ms pour une transition utilitaire → trop long.** L'utilisateur perçoit un ralentissement.

### Courbes d'easing
- `ease-out` : démarre rapide, ralentit → objet qui "arrive". Entrées d'éléments (modale, toast).
- `ease-in` : démarre lent, accélère → objet qui "part". Sorties.
- `ease-in-out` : mouvement symétrique → transitions de position (déplacement).
- `linear` : mouvement constant → loaders, progress bars.

**Éviter** :
- Les courbes "bouncy" (spring) partout → ça fatigue vite.
- Aucun easing (linear par défaut pour tout) → ressenti artificiel.

### Préférences utilisateur (accessibilité)
Respecter `prefers-reduced-motion` : désactiver ou simplifier les animations pour les utilisateurs qui le demandent (vertiges, troubles vestibulaires).

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## États interactifs obligatoires

Tout composant interactif (bouton, lien, input, card cliquable) doit avoir ces états définis :

### Les 8 états canoniques

| État | Déclencheur | Indication visuelle |
|---|---|---|
| **Default** | Au repos | État neutre |
| **Hover** | Curseur dessus (desktop) | Changement subtil (fond, couleur, élévation) |
| **Focus** | Clavier (Tab) ou click | Outline visible (2-3px, couleur contrastée) |
| **Active (pressed)** | Clic/tap en cours | Enfoncement visuel, couleur plus sombre |
| **Disabled** | Non cliquable | Opacity ~0.5, curseur not-allowed, **pas de hover** |
| **Loading** | Action en cours | Spinner inline, label remplacé, non cliquable |
| **Error** | Échec action/validation | Couleur danger, icône, message |
| **Success** | Réussite récente | Couleur success, icône (brièvement) |

### Focus ring : non négociable
- **Jamais** `outline: none` sans alternative visible.
- Le focus ring est **critique** pour les utilisateurs au clavier.
- Peut être stylisé (`:focus-visible` pour l'afficher seulement au clavier, pas au clic souris).

### Hover : absent sur touch
Sur mobile/tablette, il n'y a **pas de hover** au sens strict (le tap fait hover + click simultanément). Ne jamais dépendre du hover pour afficher une info critique.

### Active ≠ Focus
- **Focus** : l'élément a "l'attention" (souvent ciblé au clavier).
- **Active** : l'élément est en train d'être pressé.
Les deux sont distincts et peuvent coexister.

---

## Transitions et animations

### Principes Disney adaptés à l'UI

Les 12 principes d'animation Disney, filtrés pour les interfaces :

1. **Squash & stretch** → déformation légère pour renforcer le feedback tactile (bouton qui se "tasse" au clic).
2. **Anticipation** → petit mouvement inverse avant l'action principale.
3. **Timing** → la vitesse d'une animation doit correspondre à son poids perçu (un objet lourd = plus lent).
4. **Slow in, slow out** → easing naturel (voir section easing).
5. **Arcs** → pas de mouvements linéaires purs pour les objets qui "volent".
6. **Secondary action** → plusieurs éléments animés en chœur mais pas en sync parfaite.
7. **Exaggeration** → avec parcimonie, pour les moments "peak" (Peak-End Rule).

### Animations communes

#### Fade in/out
Usage : apparition/disparition discrète (tooltip, toast).
Durée : 150-250 ms ease-out.

#### Slide in (drawer, modale)
Usage : entrée latérale ou verticale.
Drawer : slide-in-right (300 ms ease-out).
Modale : fade + scale subtil (200 ms).

#### Scale (pop)
Usage : attirer l'attention sur un changement (badge compteur qui s'incrémente, checkmark d'un toggle).
Durée : 150-200 ms, légère sur-amplitude (scale 1 → 1.1 → 1).

#### Shake (erreur)
Usage : signaler une erreur sur un champ ou une action interdite.
Amplitude : 3-5 px, 2-3 aller-retours, 300 ms.
Discret, jamais spammé.

#### Ripple (Material Design)
Usage : feedback tactile d'un tap, émane du point de contact.
À utiliser si cohérent avec le design system, pas ailleurs.

### Page transitions
- Applications web standard : pas de transition de page (respect du modèle mental navigateur).
- Apps SPA avec identité forte : fade ou slide subtil (200-300 ms).
- Mobile native feel : push horizontal pour navigation hiérarchique.

### Anti-patterns
- Tout animer tout le temps → latence perçue, épuisement visuel.
- Animations d'entrée qui bloquent l'interaction (l'utilisateur doit attendre que ça apparaisse pour cliquer).
- Animations longues > 1 s sur interactions fréquentes.

---

## Loaders, skeletons, progress

### Règle de décision

| Durée attendue | Pattern |
|---|---|
| < 400 ms | **Rien** (flicker si on met quelque chose) |
| 400 ms – 1 s | Skeleton discret ou spinner local |
| 1 s – 10 s | Skeleton structuré **ou** progress bar |
| > 10 s | Progress bar avec ETA + possibilité d'annuler |
| Indéterminé court | Spinner |
| Indéterminé long | Progress bar indéterminée + message d'état |

### Skeleton screens
**Pourquoi c'est mieux qu'un spinner** : le skeleton suggère la structure qui va arriver → le cerveau anticipe → la charge perçue est réduite.

**Règles** :
- Reproduire la forme approximative du contenu réel.
- Animation subtile (pulse ou shimmer), pas flash.
- **Pas** de skeleton si le contenu final est très différent (ex : skeleton de liste qui se transforme en empty state → incohérence frustrante).

### Spinners
- Bons pour : opérations indéterminées, courtes (1-3 s), locales (sur un bouton).
- Taille adaptée au contexte (16 px dans un bouton, 24 px dans une zone).
- **Pas** de spinner plein écran pour opérations < 1 s.

### Progress bars
- Obligatoires si l'utilisateur doit attendre > 10 s **et** que la progression est connue.
- Indiquer un ETA si possible (« Environ 30 s restantes »).
- **Ne jamais** bloquer à 99 % (erreur fréquente).
- Bar linéaire pour opérations linéaires (upload, traitement).
- Bar circulaire (doughnut) pour progression d'un objectif (« 70 % du profil complet »).

### Messages d'attente
Pour les longues opérations, donner du contexte :
- « Analyse en cours... » → « Extraction des données... » → « Génération du rapport... »
- L'utilisateur sent qu'il se passe quelque chose, même sans barre à 100 %.

### Anti-patterns
- Loader plein écran pour chaque action → interface qui flashe en permanence.
- Skeleton qui reste 5 s après le chargement effectif (cache mal géré).
- Progress bar qui recule (rend l'attente plus longue perçue).

---

## Optimistic UI

### Principe
Plutôt que d'attendre la confirmation serveur pour afficher le résultat, **afficher immédiatement** l'état attendu. Si le serveur répond OK : rien à faire. Si échec : rollback + erreur.

### Cas où l'utiliser
- **Actions à haute probabilité de succès** : like, bookmark, archive, marquage lu/non-lu.
- Actions réversibles facilement.
- Actions où l'utilisateur doit rester en flow.

### Cas où ne PAS l'utiliser
- Actions **critiques** : paiement, suppression importante → attendre confirmation.
- Actions où le serveur peut refuser souvent (validation complexe).
- Création d'objet dont l'utilisateur va immédiatement consulter le détail.

### Patterns associés
- Toast avec "Annuler" après une action. L'action est partiellement optimiste : on la fait, mais l'utilisateur peut revenir en arrière pendant 5-10 s.
- Feedback visuel immédiat + petit spinner discret (synchronisation en arrière-plan).
- Rollback visible et explicite si échec.

---

## Micro-interactions stars (à connaître)

### Le like animé (heart beat)
- Tap → scale 1 → 1.3 → 1 (bounce).
- Changement de couleur instantané.
- Léger confetti/particules (à doser selon l'identité).
Référence : Twitter, Instagram.

### Le pull to refresh
- Glisser du haut vers le bas.
- Indicateur qui apparaît progressivement.
- Seuil dépassé → relâchement → refresh.
- Animation pendant le fetch.
Référence : apps mobiles natives.

### Le swipe to reveal actions
- Swipe horizontal sur un item de liste.
- Actions (archive, delete) apparaissent.
- Seuil partiel → bouton.
- Seuil total → action directe.
Référence : Gmail, Mail iOS.

### Le sticky header qui réduit
- Header plein au top.
- Au scroll, réduit en hauteur, peut passer de transparent à opaque avec blur.
- Gain d'espace + maintien du contexte.

### Le long-press contextuel
- Maintien long → menu contextuel ou quick actions.
- Feedback haptique sur mobile.
- Accompagné d'une indication visuelle (agrandissement léger).

---

## Anti-patterns

### 1. Animation longue sur action répétitive
Exemple : ajouter au panier déclenche une animation de 1,5 s à chaque fois → utilisateur attend à chaque clic.

### 2. Disabled sans explication
Un bouton grisé sans indication du pourquoi → l'utilisateur ne comprend pas comment activer.

### 3. Animations d'entrée bloquantes
Hero qui fade in pendant 800 ms avant d'être cliquable → friction pure.

### 4. Feedback absent
Clic sur bouton "Sauvegarder" → rien ne se passe visible → utilisateur re-clique.

### 5. Hover-only actions
Actions révélées seulement au hover → inaccessibles au clavier et sur touch.

### 6. Toast qui disparaît trop vite
Message de succès qui flash 1 s → utilisateur le rate.

### 7. Animation par défaut des frameworks
Utiliser les transitions Vue `fade` par défaut partout → feel générique et lent.

### 8. Motion sickness inducer
Parallax agressif, zoom important, rotation → désagréable pour beaucoup.

---

## Checklist feedback/micro-interactions

Pour chaque écran/composant à produire :

- [ ] Tous les éléments interactifs ont 8 états définis (default, hover, focus, active, disabled, loading, error, success quand pertinent).
- [ ] Focus ring visible au clavier (jamais `outline: none` nu).
- [ ] Toute action déclenche un feedback < 100 ms.
- [ ] Opérations > 400 ms ont un indicateur (skeleton, spinner, progress).
- [ ] Durées d'animation ≤ 300 ms pour les transitions utilitaires.
- [ ] Easing défini (pas de linear partout).
- [ ] `prefers-reduced-motion` respecté.
- [ ] Optimistic UI pour actions à haute proba de succès.
- [ ] Messages de succès/erreur cohérents avec les micro-animations.
- [ ] Pas d'animation bloquant l'interaction.

## Règle d'or des micro-interactions

> Une bonne micro-interaction est **invisible** tant qu'elle est en place, et **manque cruellement** quand elle est absente. La perfection est atteinte quand l'utilisateur ne la remarque pas consciemment mais perçoit le produit comme « fluide » ou « bien fait ».
