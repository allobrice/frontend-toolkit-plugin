# SCSS Architecture — Référence détaillée

## Organisation 7-1 Pattern (adapté)

Le pattern 7-1 est la base. On l'adapte aux projets modernes Vue/Nuxt :

```
styles/
├── abstracts/           # Jamais de CSS généré — juste des outils
│   ├── _index.scss      # Barrel : @forward de tout
│   ├── _tokens.scss     # Design tokens (couleurs, espacement, typo…)
│   ├── _mixins.scss     # Mixins réutilisables
│   ├── _functions.scss  # Fonctions SCSS pures
│   └── _placeholders.scss  # %placeholders partagés
│
├── base/                # Styles globaux, reset, defaults
│   ├── _reset.scss
│   ├── _typography.scss
│   ├── _accessibility.scss
│   └── _index.scss
│
├── layouts/             # Structures de mise en page
│   ├── _grid.scss
│   ├── _container.scss
│   └── _index.scss
│
├── components/          # Un fichier par composant global
│   ├── _button.scss
│   ├── _form.scss
│   ├── _badge.scss
│   └── _index.scss
│
├── utilities/           # Classes utilitaires (optionnel si Tailwind)
│   ├── _spacing.scss
│   ├── _display.scss
│   └── _index.scss
│
└── main.scss            # Point d'entrée : @use de tout
```

### main.scss — point d'entrée propre

```scss
// main.scss
@use 'abstracts';   // via _index.scss barrel
@use 'base';
@use 'layouts';
@use 'components';
@use 'utilities';
```

### Barrel files — abstracts/_index.scss

```scss
// Expose tout sans namespace pour une DX fluide
@forward 'tokens';
@forward 'mixins';
@forward 'functions';
@forward 'placeholders';
```

Consommation dans n'importe quel fichier :
```scss
@use '~/assets/styles/abstracts' as *;
// → toutes les variables, mixins, fonctions disponibles directement
```

---

## Gestion des tokens avec maps

Pour des systèmes complexes, les maps SCSS donnent plus de structure :

```scss
// Définition avec map
$colors: (
  'primary': (
    '50':  #eff6ff,
    '100': #dbeafe,
    '500': #3b82f6,
    '700': #1d4ed8,
    '900': #1e3a8a,
  ),
  'success': (
    '500': #22c55e,
    '700': #15803d,
  ),
  'danger': (
    '500': #ef4444,
    '700': #b91c1c,
  ),
);

// Fonction d'accès type-safe
@use 'sass:map';

@function color($palette, $shade: '500') {
  $p: map.get($colors, $palette);

  @if $p == null {
    @error "Palette inconnue : `#{$palette}`";
  }

  $value: map.get($p, '#{$shade}');

  @if $value == null {
    @error "Teinte inconnue : `#{$shade}` dans `#{$palette}`";
  }

  @return $value;
}

// Utilisation
.alert--danger {
  color: color('danger', '700');
  background: color('danger', '50');
}
```

---

## Génération dynamique avec @each

```scss
// Génère des classes utilitaires depuis une map
$status-colors: (
  'success': #22c55e,
  'warning': #f59e0b,
  'danger':  #ef4444,
  'info':    #3b82f6,
);

@each $name, $color in $status-colors {
  .badge--#{$name} {
    background: color.adjust($color, $alpha: -0.85);
    color: color.adjust($color, $lightness: -20%);
    border: 1px solid color.adjust($color, $alpha: -0.6);
  }
}

// Génère des classes de spacing
$spacings: (1: 0.25rem, 2: 0.5rem, 3: 0.75rem, 4: 1rem, 6: 1.5rem, 8: 2rem);

@each $key, $value in $spacings {
  .mt-#{$key} { margin-top: $value; }
  .mb-#{$key} { margin-bottom: $value; }
  .px-#{$key} { padding-inline: $value; }
  .py-#{$key} { padding-block: $value; }
}
```

---

## Typographie responsive avec fluid()

```scss
// Titres fluides — s'adaptent au viewport sans media queries
h1 {
  font-size: fluid(1.75rem, 3rem);
  line-height: $line-height-tight;
  font-weight: $font-weight-bold;
  letter-spacing: -0.02em;
}

h2 {
  font-size: fluid(1.5rem, 2.25rem);
  line-height: $line-height-tight;
  font-weight: $font-weight-semibold;
}

// Base/_typography.scss complet
body {
  font-family: $font-family-sans;
  font-size: $font-size-base;
  line-height: $line-height-normal;
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

// Prose — contenu éditorial
.prose {
  max-width: 65ch;

  p { margin-block: $spacing-4; }

  h2 {
    font-size: $font-size-2xl;
    font-weight: $font-weight-bold;
    margin-block-start: $spacing-8;
    margin-block-end: $spacing-3;
  }

  a {
    color: $color-primary;
    text-underline-offset: 3px;

    &:hover { text-decoration-thickness: 2px; }
  }

  code {
    font-family: $font-family-mono;
    font-size: 0.875em;
    background: var(--color-surface-raised);
    padding: 0.125em 0.25em;
    border-radius: $radius-sm;
  }
}
```

---

## Reset moderne (_reset.scss)

```scss
// Reset opinionated — compatible avec les custom properties
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 100%;
  scroll-behavior: smooth;
  text-size-adjust: none;
  -webkit-text-size-adjust: none;
}

body {
  min-height: 100dvh;
  line-height: $line-height-normal;
}

img,
picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
}

input,
button,
textarea,
select {
  font: inherit;
}

p,
h1,
h2,
h3,
h4,
h5,
h6 {
  overflow-wrap: break-word;
}

// Respect des préférences d'animation
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Container et Grid Layout

```scss
// layouts/_container.scss
.container {
  width: 100%;
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: $spacing-4;

  @include respond-to('md') { padding-inline: $spacing-6; }
  @include respond-to('lg') { padding-inline: $spacing-8; }
}

// layouts/_grid.scss
.grid {
  display: grid;
  gap: $spacing-4;

  &--2-cols {
    @include respond-to('md') { grid-template-columns: repeat(2, 1fr); }
  }

  &--3-cols {
    @include respond-to('md') { grid-template-columns: repeat(2, 1fr); }
    @include respond-to('lg') { grid-template-columns: repeat(3, 1fr); }
  }

  &--sidebar {
    @include respond-to('lg') { grid-template-columns: 280px 1fr; }
  }
}
```
