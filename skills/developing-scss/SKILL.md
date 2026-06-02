---
name: developing-scss
description: >
  Expert SCSS senior pour tout code de style : composants Vue/Nuxt, feuilles de
  style globales, design systems, tokens, architecture CSS. Utiliser
  SYSTÉMATIQUEMENT dès qu'il y a du SCSS, du CSS, du style, des mixins, des
  variables, des tokens, une charte graphique, un design system, ou une demande
  de refactoring / organisation du style. Déclencher aussi pour des questions sur
  BEM, utility-first, responsive, theming sombre/clair, ou l'organisation des
  fichiers styles. Ne pas attendre une mention explicite de SCSS — si le contexte
  implique du rendu visuel ou du code de style, utiliser ce skill.
---

# SCSS Expert — Senior Patterns & Best Practices

Expertise complète SCSS : architecture scalable, patterns réutilisables, code
propre et lisible, toujours aligné sur les dernières pratiques CSS/SCSS.

> **Références détaillées** : si tu as besoin d'exemples complets sur un sujet
> précis, charge le fichier correspondant dans `references/` :
> - `references/architecture.md` — organisation fichiers, 7-1 pattern, tokens
> - `references/mixins-functions.md` — mixins responsive, utilitaires, fonctions
> - `references/components.md` — BEM, composants Vue, patterns courants

---

## Principes fondamentaux

### 1. Tokens d'abord, valeurs brutes jamais

Toute valeur visuelle passe par un token. Zéro valeur magique dans le code.

```scss
// ✅ Correct
$color-primary-500: #3b82f6;
$spacing-4: 1rem;
$radius-md: 0.375rem;

// ❌ Interdit
color: #3b82f6;
padding: 16px;
border-radius: 6px;
```

### 2. Nesting : 3 niveaux max, toujours intentionnel

```scss
// ✅ Propre — nesting sémantique
.card {
  padding: $spacing-4;

  &__header {
    display: flex;
    align-items: center;
  }

  &__title {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
  }

  &--featured {
    border: 2px solid $color-primary-500;
  }
}

// ❌ Trop profond
.card {
  .header {
    .title {
      span { ... } // niveau 4 → STOP
    }
  }
}
```

### 3. `@use` / `@forward` — jamais `@import`

```scss
// ✅ Moderne (Dart Sass)
@use 'tokens/colors' as colors;
@use 'abstracts/mixins' as mx;

.button {
  color: colors.$primary-500;
  @include mx.flex-center;
}

// ❌ Déprécié
@import 'tokens/colors';
```

---

## Architecture fichiers

```
styles/
├── abstracts/           # Pas de CSS généré
│   ├── _index.scss      # @forward de tout abstracts/
│   ├── _tokens.scss     # Variables globales
│   ├── _mixins.scss     # Mixins réutilisables
│   ├── _functions.scss  # Fonctions SCSS
│   └── _placeholders.scss
├── base/
│   ├── _reset.scss
│   ├── _typography.scss
│   └── _index.scss
├── components/          # Un fichier par composant
│   ├── _button.scss
│   ├── _card.scss
│   └── _index.scss
├── layouts/
│   ├── _grid.scss
│   └── _index.scss
└── main.scss            # Point d'entrée unique
```

`abstracts/_index.scss` — barrel file :
```scss
@forward 'tokens';
@forward 'mixins';
@forward 'functions';
@forward 'placeholders';
```

Utilisation dans n'importe quel fichier :
```scss
@use '../abstracts' as *; // expose tout sans namespace
```

---

## Variables & Tokens

### Système d'échelle

```scss
// abstracts/_tokens.scss

// Couleurs — palette + sémantique séparées
$_palette: (
  'blue': (
    100: #dbeafe,
    500: #3b82f6,
    700: #1d4ed8,
    900: #1e3a8a,
  ),
  'neutral': (
    0:   #ffffff,
    100: #f5f5f5,
    500: #737373,
    900: #171717,
  ),
);

// Tokens sémantiques (découplés de la palette)
$color-primary:          map.get($_palette, 'blue', 500) !default;
$color-primary-hover:    map.get($_palette, 'blue', 700) !default;
$color-surface:          map.get($_palette, 'neutral', 0) !default;
$color-text:             map.get($_palette, 'neutral', 900) !default;
$color-text-muted:       map.get($_palette, 'neutral', 500) !default;

// Espacement — échelle 4px
$spacing-1:  0.25rem;  // 4px
$spacing-2:  0.5rem;   // 8px
$spacing-3:  0.75rem;  // 12px
$spacing-4:  1rem;     // 16px
$spacing-6:  1.5rem;   // 24px
$spacing-8:  2rem;     // 32px
$spacing-12: 3rem;     // 48px
$spacing-16: 4rem;     // 64px

// Typographie
$font-family-sans:  'Inter', system-ui, sans-serif;
$font-family-mono:  'JetBrains Mono', 'Fira Code', monospace;

$font-size-xs:   0.75rem;
$font-size-sm:   0.875rem;
$font-size-base: 1rem;
$font-size-lg:   1.125rem;
$font-size-xl:   1.25rem;
$font-size-2xl:  1.5rem;
$font-size-4xl:  2.25rem;

$font-weight-normal:   400;
$font-weight-medium:   500;
$font-weight-semibold: 600;
$font-weight-bold:     700;

$line-height-tight:  1.25;
$line-height-normal: 1.5;
$line-height-relaxed: 1.75;

// Bordures & rayons
$radius-sm: 0.25rem;
$radius-md: 0.375rem;
$radius-lg: 0.5rem;
$radius-xl: 0.75rem;
$radius-full: 9999px;

// Ombres
$shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
$shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
$shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

// Transitions
$duration-fast:   150ms;
$duration-normal: 250ms;
$duration-slow:   400ms;
$ease-default:    cubic-bezier(0.4, 0, 0.2, 1);

// Breakpoints
$breakpoints: (
  'sm':  640px,
  'md':  768px,
  'lg':  1024px,
  'xl':  1280px,
  '2xl': 1536px,
);

// Z-index — couches nommées
$z-below:   -1;
$z-base:     0;
$z-raised:   10;
$z-dropdown: 100;
$z-sticky:   200;
$z-overlay:  300;
$z-modal:    400;
$z-toast:    500;
```

---

## Mixins essentiels

```scss
// abstracts/_mixins.scss
@use 'sass:map';
@use 'tokens' as t;

// ─── Responsive ──────────────────────────────────────────
@mixin respond-to($breakpoint) {
  $bp: map.get(t.$breakpoints, $breakpoint);

  @if $bp == null {
    @error "Breakpoint inconnu : `#{$breakpoint}`. Disponibles : #{map.keys(t.$breakpoints)}";
  }

  @media (min-width: $bp) {
    @content;
  }
}

// Utilisation :
// .hero { font-size: $font-size-xl; @include respond-to('lg') { font-size: $font-size-4xl; } }

// ─── Layout ──────────────────────────────────────────────
@mixin flex-center($direction: row) {
  display: flex;
  flex-direction: $direction;
  align-items: center;
  justify-content: center;
}

@mixin flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

@mixin grid-auto($min: 250px, $gap: $spacing-4) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax($min, 1fr));
  gap: $gap;
}

// ─── Typographie ─────────────────────────────────────────
@mixin truncate($lines: 1) {
  @if $lines == 1 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  } @else {
    display: -webkit-box;
    -webkit-line-clamp: $lines;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

@mixin visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

// ─── Interactions ─────────────────────────────────────────
@mixin focus-ring($color: t.$color-primary, $offset: 2px) {
  &:focus-visible {
    outline: 2px solid $color;
    outline-offset: $offset;
    border-radius: t.$radius-sm;
  }
}

@mixin transition($props...) {
  $transitions: ();

  @each $prop in $props {
    $transitions: append(
      $transitions,
      $prop t.$duration-normal t.$ease-default,
      comma
    );
  }

  transition: $transitions;
}

// Utilisation : @include transition(color, background-color, box-shadow);

// ─── Surfaces ─────────────────────────────────────────────
@mixin card($padding: t.$spacing-4, $radius: t.$radius-lg) {
  background: t.$color-surface;
  border-radius: $radius;
  padding: $padding;
  box-shadow: t.$shadow-md;
}
```

---

## Fonctions SCSS

```scss
// abstracts/_functions.scss
@use 'sass:math';
@use 'sass:color';

// Convertit px en rem (base 16px)
@function rem($px) {
  @return math.div($px, 16) * 1rem;
}

// Ratio fluide entre deux tailles selon le viewport
@function fluid($min-size, $max-size, $min-bp: 320px, $max-bp: 1280px) {
  $slope: math.div($max-size - $min-size, $max-bp - $min-bp);
  $intercept: $min-size - $slope * $min-bp;

  @return clamp(
    #{$min-size},
    #{$intercept} + #{$slope * 100vw},
    #{$max-size}
  );
}

// Couleur avec opacité, sans dépréciation
@function alpha($color, $opacity) {
  @return color.adjust($color, $alpha: $opacity - 1);
}
```

---

## Placeholders (héritage mutualisé)

```scss
// abstracts/_placeholders.scss
@use 'tokens' as t;

%reset-button {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

%reset-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

%overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  backdrop-filter: blur(4px);
}
```

---

## BEM dans SCSS

```scss
// Composant complet — lisible, plat, sans nesting excessif
.button {
  // Base
  @extend %reset-button;
  @include transition(color, background-color, box-shadow, transform);
  @include focus-ring;

  display: inline-flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-2 $spacing-4;
  border-radius: $radius-md;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  line-height: $line-height-tight;
  text-decoration: none;

  // ── Éléments BEM
  &__icon {
    flex-shrink: 0;
    width: 1em;
    height: 1em;
  }

  &__label {
    @include truncate;
  }

  // ── Modificateurs BEM
  &--primary {
    background: $color-primary;
    color: $color-surface;

    &:hover:not(:disabled) {
      background: $color-primary-hover;
    }
  }

  &--ghost {
    background: transparent;
    color: $color-primary;
    box-shadow: inset 0 0 0 1px currentColor;

    &:hover:not(:disabled) {
      background: alpha($color-primary, 0.08);
    }
  }

  &--sm {
    padding: $spacing-1 $spacing-3;
    font-size: $font-size-xs;
  }

  &--lg {
    padding: $spacing-3 $spacing-6;
    font-size: $font-size-base;
  }

  // ── États
  &:disabled,
  &[aria-disabled="true"] {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  &[aria-busy="true"] {
    cursor: wait;
  }
}
```

---

## Theming sombre/clair

```scss
// Avec custom properties CSS — approche recommandée
:root {
  --color-surface:    #{$color-surface};
  --color-text:       #{$color-text};
  --color-text-muted: #{$color-text-muted};
  --color-primary:    #{$color-primary};
  --color-border:     #{$color-border};
}

[data-theme="dark"] {
  --color-surface:    #{$color-neutral-900};
  --color-text:       #{$color-neutral-50};
  --color-text-muted: #{$color-neutral-400};
  --color-primary:    #{$color-primary-400};
  --color-border:     #{$color-neutral-700};
}

// Les composants utilisent les custom properties
.card {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
```

---

## Dans un composant Vue / Nuxt

```vue
<style lang="scss" scoped>
@use '~/assets/styles/abstracts' as *;

.product-card {
  @include card($padding: $spacing-6);

  display: grid;
  gap: $spacing-4;

  &__image {
    border-radius: $radius-md;
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }

  &__title {
    @include truncate(2);
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: var(--color-text);
  }

  &__price {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: $color-primary;
  }

  @include respond-to('lg') {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
```

---

## Checklist qualité

Avant toute PR contenant du SCSS :

- [ ] Aucune valeur brute (px, couleur hex) hors des tokens
- [ ] `@use` / `@forward` uniquement — zéro `@import`
- [ ] Nesting ≤ 3 niveaux
- [ ] Mixins pour tout pattern répété 2+ fois
- [ ] BEM respecté : `.block__element--modifier`
- [ ] States accessibles : `:focus-visible`, `aria-*`, pas uniquement `:hover`
- [ ] Responsive via `respond-to()` — pas de media queries inline brutes
- [ ] Theming via custom properties CSS — pas de classes `.dark`
- [ ] Aucun `!important` sauf override forcé documenté

---

> Pour des **exemples complets et détaillés**, consulter les références :
> `references/architecture.md`, `references/mixins-functions.md`, `references/components.md`
