# Mixins & Fonctions SCSS — Référence complète

## Mixins responsive

```scss
// Mixin principal mobile-first
@mixin respond-to($breakpoint) {
  $bp: map.get($breakpoints, $breakpoint);

  @if $bp == null {
    @error "Breakpoint `#{$breakpoint}` inconnu. Disponibles : #{map.keys($breakpoints)}";
  }

  @media (min-width: $bp) { @content; }
}

// Max-width (desktop-first, usage rare)
@mixin respond-below($breakpoint) {
  $bp: map.get($breakpoints, $breakpoint);
  @media (max-width: calc(#{$bp} - 1px)) { @content; }
}

// Plage de breakpoints
@mixin respond-between($min, $max) {
  $bp-min: map.get($breakpoints, $min);
  $bp-max: map.get($breakpoints, $max);
  @media (min-width: $bp-min) and (max-width: calc(#{$bp-max} - 1px)) { @content; }
}

// Print
@mixin print-only {
  @media print { @content; }
}

@mixin screen-only {
  @media screen { @content; }
}

// Préférences système
@mixin prefers-dark {
  @media (prefers-color-scheme: dark) { @content; }
}

@mixin prefers-reduced-motion {
  @media (prefers-reduced-motion: reduce) { @content; }
}
```

---

## Mixins Layout

```scss
// Flexbox
@mixin flex($direction: row, $align: center, $justify: flex-start, $gap: null) {
  display: flex;
  flex-direction: $direction;
  align-items: $align;
  justify-content: $justify;

  @if $gap { gap: $gap; }
}

@mixin flex-center($direction: row) {
  @include flex($direction: $direction, $align: center, $justify: center);
}

@mixin flex-between($gap: null) {
  @include flex($align: center, $justify: space-between, $gap: $gap);
}

@mixin flex-column($gap: null) {
  @include flex($direction: column, $align: stretch, $gap: $gap);
}

// Grid auto-responsive
@mixin grid-auto($min: 250px, $gap: $spacing-4) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min($min, 100%), 1fr));
  gap: $gap;
}

// Centrage absolu
@mixin absolute-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

// Overlay full
@mixin full-overlay($z: $z-overlay) {
  position: fixed;
  inset: 0;
  z-index: $z;
}

// Aspect ratio (fallback)
@mixin aspect-ratio($w: 16, $h: 9) {
  aspect-ratio: #{$w} / #{$h};

  // Fallback navigateurs anciens
  @supports not (aspect-ratio: 1) {
    &::before {
      content: '';
      display: block;
      padding-block-start: math.percentage(math.div($h, $w));
    }
  }
}
```

---

## Mixins Typographie

```scss
// Tronquer sur N lignes
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

// Heading style cohérent
@mixin heading($size, $weight: $font-weight-bold, $tracking: null) {
  font-size: $size;
  font-weight: $weight;
  line-height: $line-height-tight;

  @if $tracking { letter-spacing: $tracking; }
}

// Label / caption
@mixin label($size: $font-size-xs, $uppercase: true) {
  font-size: $size;
  font-weight: $font-weight-semibold;
  letter-spacing: if($uppercase, 0.05em, normal);

  @if $uppercase { text-transform: uppercase; }
}

// Visually hidden (accessibilité)
@mixin sr-only {
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

// Annule sr-only
@mixin not-sr-only {
  position: static;
  width: auto;
  height: auto;
  padding: 0;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

---

## Mixins Interaction & Accessibilité

```scss
// Focus visible — standard moderne
@mixin focus-ring($color: $color-primary, $offset: 2px, $width: 2px) {
  &:focus { outline: none; }

  &:focus-visible {
    outline: $width solid $color;
    outline-offset: $offset;
  }
}

// Focus inset (pour les inputs)
@mixin focus-ring-inset($color: $color-primary) {
  &:focus { outline: none; }

  &:focus-visible {
    box-shadow: inset 0 0 0 2px $color;
  }
}

// Transition avec respect prefers-reduced-motion
@mixin transition($props...) {
  $transitions: ();

  @each $prop in $props {
    $transitions: append(
      $transitions,
      $prop $duration-normal $ease-default,
      comma
    );
  }

  transition: $transitions;

  @include prefers-reduced-motion {
    transition: none;
  }
}

// État interactif de surface
@mixin interactive-surface($hover-color: null, $active-scale: 0.98) {
  cursor: pointer;
  @include transition(background-color, transform, box-shadow);

  @if $hover-color {
    &:hover:not(:disabled) { background-color: $hover-color; }
  }

  &:active:not(:disabled) { transform: scale($active-scale); }

  &:disabled,
  &[aria-disabled="true"] {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
}
```

---

## Mixins Formulaires

```scss
// Style de base pour les champs
@mixin field-base {
  display: block;
  width: 100%;
  padding: $spacing-2 $spacing-3;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: $radius-md;
  font-size: $font-size-base;
  line-height: $line-height-normal;
  @include transition(border-color, box-shadow);
  @include focus-ring-inset;

  &::placeholder {
    color: $color-text-muted;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--color-surface-disabled);
  }
}

// Validation states
@mixin field-state($state) {
  $colors: (
    'error':   $color-danger,
    'success': $color-success,
    'warning': $color-warning,
  );

  $color: map.get($colors, $state);

  @if $color == null {
    @error "State inconnu : `#{$state}`";
  }

  border-color: $color;
  box-shadow: 0 0 0 3px alpha($color, 0.15);
}
```

---

## Fonctions avancées

```scss
@use 'sass:math';
@use 'sass:color';
@use 'sass:string';
@use 'sass:list';

// px → rem
@function rem($px) {
  @if math.is-unitless($px) {
    @return math.div($px, 16) * 1rem;
  }
  @return math.div(math.div($px, $px * 0 + 1), 16) * 1rem;
}

// em relatif à un parent
@function em($px, $context: 16px) {
  @return math.div($px, $context) * 1em;
}

// Typographie fluide (clamp)
@function fluid($min, $max, $min-vp: 320px, $max-vp: 1280px) {
  $slope: math.div($max - $min, $max-vp - $min-vp);
  $y-axis: $min - ($slope * $min-vp);
  $sign: if($y-axis >= 0, '+', '-');

  @return clamp(
    #{$min},
    #{math.abs($y-axis)} #{$sign} #{math.abs($slope) * 100vw},
    #{$max}
  );
}

// Contraste texte auto (noir ou blanc)
@function contrast-color($bg, $light: #fff, $dark: #000) {
  $luminance: color.lightness($bg);
  @return if($luminance > 60%, $dark, $light);
}

// Alpha sans dépréciation
@function alpha($color, $opacity) {
  @return color.adjust($color, $alpha: $opacity - 1);
}

// Tinte / ombre
@function tint($color, $weight: 10%) {
  @return color.mix(#fff, $color, $weight);
}

@function shade($color, $weight: 10%) {
  @return color.mix(#000, $color, $weight);
}

// Clamp de valeur numérique
@function clamp-value($min, $val, $max) {
  @return math.max($min, math.min($val, $max));
}

// Conversion degrés → radians (pour calc CSS)
@function deg-to-rad($deg) {
  @return math.div($deg, 57.2958);
}
```

---

## Patterns avancés — @mixin avec contenu

```scss
// Overlay avec slot de contenu
@mixin modal-overlay {
  @include full-overlay($z: $z-modal);
  display: grid;
  place-items: center;
  background: alpha(#000, 0.6);
  backdrop-filter: blur(4px);
  @include transition(opacity);

  @content;
}

// Usage
.modal-backdrop {
  @include modal-overlay {
    padding: $spacing-4;
  }
}

// Pattern Loading skeleton
@mixin skeleton($radius: $radius-md) {
  background: linear-gradient(
    90deg,
    var(--color-surface-raised) 25%,
    var(--color-surface-elevated) 50%,
    var(--color-surface-raised) 75%
  );
  background-size: 200% 100%;
  border-radius: $radius;
  animation: skeleton-pulse 1.5s ease-in-out infinite;

  @include prefers-reduced-motion {
    animation: none;
    background: var(--color-surface-raised);
  }
}

@keyframes skeleton-pulse {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```
