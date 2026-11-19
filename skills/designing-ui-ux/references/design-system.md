# Design System & Tokens — Référence actionnable

Principes de cohérence visuelle, tokens, spacing, typographie, couleurs.

## Table des matières

1. [Philosophie des tokens](#philosophie-des-tokens)
2. [Spacing & grid](#spacing--grid)
3. [Typographie](#typographie)
4. [Couleur](#couleur)
5. [Border radius & elevation](#border-radius--elevation)
6. [Iconographie](#iconographie)
7. [Hiérarchie visuelle](#hiérarchie-visuelle)

---

## Philosophie des tokens

Un design token est une **variable nommée** qui représente une décision de design (ex : `color-primary-500`, `space-4`). Les tokens transforment les valeurs arbitraires en décisions cohérentes et maintenables.

### Trois niveaux de tokens

1. **Tokens primitifs** (brut) — valeurs de base, non contextuelles.
   - `color-blue-500: #3b82f6`
   - `space-8: 32px`
   - `font-size-16: 16px`

2. **Tokens sémantiques** (rôle) — usage contextuel, pointent vers les primitifs.
   - `color-primary: color-blue-500`
   - `color-text-default: color-gray-900`
   - `space-card-padding: space-6`

3. **Tokens composants** (spécifique) — pointent vers les sémantiques.
   - `button-primary-bg: color-primary`
   - `card-padding: space-card-padding`

**Pourquoi cette hiérarchie ?** Changer `color-primary` met à jour toute l'app sans toucher aux primitifs. Changer de thème (dark/light) échange seulement les sémantiques.

### Règle essentielle
Ne **jamais** utiliser une valeur magique dans un composant (`padding: 13px`, `color: #4a5b6c`). Toujours pointer vers un token. Si le token n'existe pas, c'est qu'il faut le créer ou que la valeur est un indice de dérive.

---

## Spacing & grid

### Échelle de spacing
Utiliser une échelle géométrique, pas arithmétique. Base 4px ou 8px.

**Échelle 4px (recommandée pour précision)** :
```
0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128
```

**Échelle 8px (Material Design)** :
```
0, 8, 16, 24, 32, 40, 48, 64, 80, 96, 128
```

**Pourquoi une échelle et pas des valeurs libres ?** La régularité des espacements est ce que l'œil perçoit comme "professionnel". Un écran où tous les espacements sont dans l'échelle paraît cohérent même sans y penser consciemment (Gestalt — Similarity + Proximity).

### Règles d'usage
- Padding interne d'un composant ≤ espacement entre composants (Proximity : ce qui est dedans est plus lié que ce qui est dehors).
- Ratio typique : padding 16 à l'intérieur d'un card, margin 24-32 entre cards.
- Vertical rhythm : l'espacement entre blocs de texte suit une progression cohérente (paragraphe = 16, sous-titre = 32, section = 48).
- **Mobile** : diviser souvent par 1,5 (padding 24 → 16, etc.) pour compenser la taille d'écran.

### Grid et containers
- Max-width container : 1280-1440 px pour desktop.
- Grille 12 colonnes (standard Bootstrap/Tailwind) ou 8 colonnes pour layouts plus libres.
- Gutter (espace entre colonnes) : 16-24 px.
- Mobile-first : stack vertical par défaut, colonnes à partir de md (768px) ou lg (1024px).

### Anti-patterns
- Padding différents à gauche et à droite sans raison.
- Marges négatives pour "corriger" un mauvais spacing → refactor.
- Spacing de 13px, 17px, 23px → utiliser l'échelle, toujours.

---

## Typographie

### Échelle typographique
Utiliser une échelle basée sur un ratio (1.2, 1.25, 1.333, 1.5), pas des tailles arbitraires.

**Échelle 1.25 (typique) à partir de 16px** :
```
12 — caption, légende
14 — small, meta
16 — body (base)
20 — h4
24 — h3
32 — h2
40 — h1
48+ — display
```

### Règles
- **Base 16px** pour le body (convention web, taille par défaut des navigateurs, évite le zoom).
- Ne jamais descendre en dessous de 12px pour du texte lisible.
- **Line-height** : 1.5 pour body, 1.2-1.3 pour les titres.
- **Max line length** : 60-75 caractères pour du body (au-delà, fatigue de lecture).
- Max 2-3 poids (font-weight) utilisés dans une interface (regular 400, medium 500/600, bold 700).
- Max 2 familles de police. Idéalement une seule (système + variante pour code).

### Hiérarchie par contraste, pas par taille seule
Titre ≠ « plus gros texte ». C'est la combinaison :
- **Taille** (24 vs 16)
- **Poids** (700 vs 400)
- **Couleur** (gray-900 vs gray-700)
- **Letter-spacing** (resserré vs normal)
- **Line-height** (plus serré sur titres)

Un bon titre doit rester lisible **sans** couleur, par la typographie seule.

### Texte et contraste
- Contraste min 4.5:1 pour du body (WCAG AA), 7:1 pour AAA.
- Éviter le gris clair sur blanc qui passe à 3:1 → illisible par malvoyants et en plein soleil.
- Pas de texte sur image sans overlay suffisant.

### Anti-patterns
- Tailles au pixel près (15px, 17px, 19px) → indiscernables, utilisez l'échelle.
- Titre h1 en bold + italic + underline + shadow → surcharge.
- Tout le body en gris `#aaa` → pseudo-discrétion qui tue la lisibilité.

---

## Couleur

### Structure d'une palette
**Neutres** (gris) : 9 à 11 nuances, du blanc au noir. C'est 80 % de l'UI.
**Primaire** : couleur de marque, 9 nuances (50-900).
**Sémantiques** :
- Success (vert)
- Warning (orange/jaune)
- Danger/Error (rouge)
- Info (bleu, souvent = primaire si la marque est bleue)

**Accent** (optionnel) : couleur secondaire pour variétés, parcimonieusement.

### Ratios de couleur : règle du 60-30-10
- **60 %** de neutre (fond, texte, composants non interactifs).
- **30 %** de couleur secondaire (hover states, backgrounds accentués).
- **10 %** de primaire/accent (CTA, éléments clés, indicateurs).

Si ta page est à 40 % de couleur primaire → bruit visuel, l'œil ne sait plus où regarder (Von Restorff dilué).

### Tokens sémantiques essentiels
```
color-background-default
color-background-subtle  (fond de card par ex)
color-background-muted   (hover states)

color-text-default
color-text-muted         (labels, metadata)
color-text-disabled
color-text-inverse       (sur fond sombre)

color-border-default
color-border-subtle
color-border-strong

color-primary
color-primary-hover
color-primary-active
color-primary-disabled

color-success / warning / danger / info + variantes bg/border/text
```

### Dark mode
- **Pas juste inverser** : les noirs purs sur blanc pur fatiguent les yeux.
- Light : fonds `#ffffff`, texte `#0a0a0a` ou `#18181b`.
- Dark : fonds `#0a0a0a` ou `#18181b` (pas noir absolu), texte `#f5f5f5`.
- Éléments élevés en dark = plus clairs (pas plus sombres). La lumière "remonte".
- Couleurs saturées à désaturer en dark (un rouge vif devient agressif).

### Couleur et sens
- Rouge = danger/erreur **seulement** (pas pour décoration).
- Vert = succès/positif **seulement**.
- **Ne jamais** communiquer une info **par la couleur seule** : doubler par icône ou texte (accessibilité daltonisme).

### Anti-patterns
- 6 couleurs primaires saturées sur la même page → chaos.
- Couleurs non documentées dans le design system → dérive garantie.
- Fond blanc pur `#ffffff` + texte noir pur `#000000` → contraste excessif, fatigue.

---

## Border radius & elevation

### Border radius
Choisir un système cohérent et s'y tenir.

**Échelle typique** :
```
0 — tranchant (tableaux stricts, data)
2-4 — subtil (inputs, boutons par défaut)
6-8 — moderne (la plupart des apps actuelles)
12-16 — friendly (cards, modales)
9999px — pleinement arrondi (badges, pills, avatars)
```

Une fois l'échelle choisie, l'appliquer **systématiquement** : un bouton et un input dans le même formulaire doivent partager le même radius.

### Elevation (shadows)
Les ombres expriment la hiérarchie Z (profondeur).

**Échelle typique** :
```
none — éléments au niveau du fond
sm — cards, boutons au repos
md — dropdowns, tooltips
lg — modales, drawers
xl — popups centrales, contenu important
```

**Règles** :
- Ombres légères et diffuses plutôt que dures et sombres. `0 2px 8px rgba(0,0,0,0.08)` plutôt que `0 2px 4px rgba(0,0,0,0.5)`.
- Combiner une shadow + un léger border pour netteté (souvent `0 0 0 1px rgba(0,0,0,0.05)` + shadow diffuse).
- En dark mode, les ombres deviennent peu visibles → utiliser une **bordure plus claire** pour l'élévation.

### Anti-patterns
- Radius différents sur bouton et input adjacents → incohérence criante.
- Ombres très sombres en light mode → effet "sale".
- Combinaison ombre + gros border + gradient → styling années 2005.

---

## Iconographie

### Cohérence
- **Une seule famille** d'icônes (Lucide, Heroicons, Material Symbols, Phosphor...).
- Même stroke-width (1.5 ou 2 px typique).
- Même style (outline OU filled, pas mélangé).
- Même grille (24×24 par défaut en web).

### Taille et alignement
- Aligner la baseline de l'icône avec le texte : ajuster `vertical-align` ou utiliser flexbox.
- Taille proportionnelle au texte : 16px à côté de body 14-16, 20px à côté de titre.
- Icon-only : min 24×24 px visuel dans une zone tactile 44×44.

### Signification
- Utiliser les icônes **conventionnelles** (Jakob's Law). Loupe = search, engrenage = params, corbeille = supprimer.
- Icône sans texte : accompagner d'un `aria-label` et/ou tooltip.
- Une icône qui ne se comprend pas en 1 seconde = mauvaise icône → ajouter un label ou changer.

### Anti-patterns
- Mélanger deux familles (Lucide + Font Awesome) → ruine la cohérence.
- Icônes décoratives au milieu de texte → bruit visuel.
- Icône custom ambiguë pour une fonctionnalité importante.

---

## Hiérarchie visuelle

La hiérarchie visuelle est **l'outil le plus puissant du designer**. Elle guide l'œil et réduit la charge cognitive.

### Les 6 leviers
Par ordre de puissance perceptive :

1. **Taille** — l'élément le plus grand attire l'œil en premier.
2. **Contraste** — élément à fort contraste vs fond sort du lot (Von Restorff).
3. **Couleur** — couleur vive sur neutre attire, mais à doser.
4. **Position** — en haut/gauche = scan primaire (culture occidentale), centre = focus.
5. **Densité** (espace blanc) — plus un élément est isolé, plus il est mis en valeur.
6. **Typographie** — poids, style, famille.

### Méthode : test du "squint"
Plisser les yeux devant l'écran. Les 3 éléments qui ressortent doivent être **exactement** les 3 éléments que tu voulais mettre en avant. Sinon, la hiérarchie est cassée.

### Règle des 3 niveaux
Sur un écran, viser 3 niveaux de hiérarchie max :
- **Primaire** : 1 élément (titre principal, CTA principal).
- **Secondaire** : 3-5 éléments (sous-titres, metadata clé, actions secondaires).
- **Tertiaire** : le reste (corps, détails, actions mineures).

Plus de 3 niveaux = l'œil se perd.

### Espace négatif (whitespace)
Ce n'est pas du "vide". C'est un outil de groupement, de respiration, de focus.

**Règles** :
- Plus d'espace autour d'un élément = plus d'importance perçue.
- L'espace externe d'un groupe doit être **plus grand** que l'espace interne (Proximity).
- Ne pas remplir par réflexe un espace vide → la saturation tue la hiérarchie.

### Anti-patterns
- 5 CTA de même taille et couleur → aucune action primaire (violation Von Restorff + hiérarchie).
- Titre h1 petit et corps de texte gros → hiérarchie inversée.
- Densité extrême (tout collé) → œil fatigué, impression d'amateurisme.

---

## Cohérence transverse : la checklist

Quand tu produis ou audites une UI, vérifier :

- [ ] Tous les espacements sont dans l'échelle définie.
- [ ] Toutes les tailles de texte sont dans l'échelle typographique.
- [ ] Toutes les couleurs proviennent du design system (aucun hex inline).
- [ ] Les border-radius sont cohérents dans un même groupe d'éléments.
- [ ] Les icônes sont de la même famille.
- [ ] Un seul CTA primaire par zone de décision.
- [ ] Contraste texte ≥ 4.5:1 (AA).
- [ ] Les états (hover, focus, disabled) sont définis pour tous les composants interactifs.
- [ ] Dark mode prévu ou explicitement hors scope.
- [ ] 60-30-10 respecté (neutre domine).

## Règle d'or

> La cohérence est plus importante que la créativité. Un bon design system est **invisible** à l'utilisateur — il se sent chez lui partout. Les décisions isolées belles mais incohérentes produisent un produit amateur.
