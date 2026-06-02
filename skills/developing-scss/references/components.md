# Composants SCSS — Patterns & Exemples

## Bouton — composant complet

```scss
// components/_button.scss
@use '../abstracts' as *;

.button {
  @extend %reset-button;
  @include flex-center;
  @include transition(color, background-color, border-color, box-shadow, transform);
  @include focus-ring;

  gap: $spacing-2;
  padding: $spacing-2 $spacing-4;
  border-radius: $radius-md;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  line-height: $line-height-tight;
  text-decoration: none;
  white-space: nowrap;
  user-select: none;

  // ── Éléments
  &__icon {
    flex-shrink: 0;
    width: 1em;
    height: 1em;
    pointer-events: none;
  }

  &__label { @include truncate; }

  &__badge {
    @include label($size: $font-size-xs);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25em;
    height: 1.25em;
    padding-inline: 0.25em;
    border-radius: $radius-full;
    background: currentColor;
    color: var(--color-surface);
    font-size: 0.75em;
  }

  // ── Variantes
  &--primary {
    background: $color-primary;
    color: #fff;

    &:hover:not(:disabled, [aria-disabled="true"]) {
      background: $color-primary-hover;
    }

    &:active:not(:disabled) { transform: scale(0.98); }
  }

  &--secondary {
    background: var(--color-surface-raised);
    color: var(--color-text);
    box-shadow: $shadow-sm;

    &:hover:not(:disabled) {
      background: var(--color-surface-elevated);
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

  &--danger {
    background: $color-danger;
    color: #fff;

    &:hover:not(:disabled) { background: shade($color-danger, 15%); }
  }

  &--link {
    background: transparent;
    color: $color-primary;
    padding-inline: 0;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  // ── Tailles
  &--xs {
    padding: $spacing-1 $spacing-2;
    font-size: $font-size-xs;
    border-radius: $radius-sm;
  }

  &--sm {
    padding: $spacing-1 $spacing-3;
    font-size: $font-size-xs;
  }

  &--lg {
    padding: $spacing-3 $spacing-6;
    font-size: $font-size-base;
    border-radius: $radius-lg;
  }

  &--xl {
    padding: $spacing-4 $spacing-8;
    font-size: $font-size-lg;
    border-radius: $radius-xl;
  }

  // ── États globaux
  &--full  { width: 100%; justify-content: center; }
  &--icon-only { padding: $spacing-2; }

  &:disabled,
  &[aria-disabled="true"] {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  &[aria-busy="true"] {
    cursor: wait;
    pointer-events: none;
  }
}
```

---

## Card — composant flexible

```scss
// components/_card.scss
@use '../abstracts' as *;

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: $radius-xl;
  overflow: hidden;
  @include transition(box-shadow, transform);

  &__image {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  &__body {
    padding: $spacing-4;

    @include respond-to('md') { padding: $spacing-6; }
  }

  &__header {
    @include flex-between;
    margin-block-end: $spacing-3;
  }

  &__title {
    @include truncate(2);
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: var(--color-text);
  }

  &__subtitle {
    font-size: $font-size-sm;
    color: var(--color-text-muted);
    margin-block-start: $spacing-1;
  }

  &__content {
    font-size: $font-size-sm;
    color: var(--color-text-muted);
    line-height: $line-height-relaxed;
  }

  &__footer {
    @include flex-between($gap: $spacing-2);
    padding: $spacing-4;
    padding-block-start: 0;
  }

  &__actions {
    @include flex($gap: $spacing-2);
  }

  // ── Modificateurs
  &--elevated {
    box-shadow: $shadow-md;

    &:hover { box-shadow: $shadow-lg; }
  }

  &--interactive {
    cursor: pointer;

    &:hover {
      box-shadow: $shadow-lg;
      transform: translateY(-2px);
    }

    &:active { transform: translateY(0); }

    @include focus-ring;
  }

  &--horizontal {
    display: grid;

    @include respond-to('sm') {
      grid-template-columns: 200px 1fr;
    }

    .card__image {
      aspect-ratio: 1;
      height: 100%;
    }
  }

  &--compact {
    .card__body { padding: $spacing-3; }
  }
}
```

---

## Formulaire — inputs et labels

```scss
// components/_form.scss
@use '../abstracts' as *;

.field {
  display: grid;
  gap: $spacing-1;

  &__label {
    @include label($uppercase: false);
    color: var(--color-text);
  }

  &__hint {
    font-size: $font-size-xs;
    color: var(--color-text-muted);
  }

  &__error {
    font-size: $font-size-xs;
    color: $color-danger;
    display: flex;
    align-items: center;
    gap: $spacing-1;
  }

  // ── Modificateurs d'état
  &--error {
    .field__label { color: $color-danger; }
    .input { @include field-state('error'); }
  }

  &--success {
    .input { @include field-state('success'); }
  }
}

// Input
.input {
  @include field-base;

  &--sm { font-size: $font-size-sm; padding: $spacing-1 $spacing-2; }
  &--lg { font-size: $font-size-lg; padding: $spacing-3 $spacing-4; }

  &--with-icon-left  { padding-inline-start: $spacing-10; }
  &--with-icon-right { padding-inline-end: $spacing-10; }
}

// Wrapper avec icône
.input-wrapper {
  position: relative;

  &__icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-muted);
    pointer-events: none;
    width: 1rem;
    height: 1rem;

    &--left  { left: $spacing-3; }
    &--right { right: $spacing-3; }
  }
}

// Select
.select {
  @include field-base;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%236b7280' d='M4 6l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right $spacing-3 center;
  background-size: 1rem;
  padding-inline-end: $spacing-8;
  cursor: pointer;
}

// Textarea
.textarea {
  @include field-base;
  resize: vertical;
  min-height: 100px;
  field-sizing: content; // propriété moderne
}

// Checkbox / Radio accessibles
.choice {
  display: flex;
  align-items: flex-start;
  gap: $spacing-3;
  cursor: pointer;

  &__control {
    flex-shrink: 0;
    width: 1rem;
    height: 1rem;
    margin-block-start: 0.125rem;
    accent-color: $color-primary;
    cursor: pointer;
  }

  &__label {
    font-size: $font-size-sm;
    color: var(--color-text);
    line-height: $line-height-normal;
  }

  &__hint {
    font-size: $font-size-xs;
    color: var(--color-text-muted);
    margin-block-start: $spacing-1;
  }
}
```

---

## Badge / Tag

```scss
// components/_badge.scss
@use '../abstracts' as *;

.badge {
  @include label($size: $font-size-xs);
  @include flex-center;
  display: inline-flex;
  gap: $spacing-1;
  padding: 0.25em 0.625em;
  border-radius: $radius-full;
  border: 1px solid transparent;

  &__dot {
    width: 0.5em;
    height: 0.5em;
    border-radius: $radius-full;
    background: currentColor;
    flex-shrink: 0;
  }

  // Variantes sémantiques
  $badge-variants: (
    'primary': ($color-primary, tint($color-primary, 90%)),
    'success': ($color-success, tint($color-success, 90%)),
    'warning': ($color-warning, tint($color-warning, 90%)),
    'danger':  ($color-danger,  tint($color-danger,  90%)),
    'neutral': ($color-text-muted, var(--color-surface-raised)),
  );

  @each $name, $values in $badge-variants {
    $color: list.nth($values, 1);
    $bg:    list.nth($values, 2);

    &--#{$name} {
      color: shade($color, 20%);
      background: $bg;
      border-color: alpha($color, 0.3);
    }
  }

  // Tailles
  &--sm { font-size: 0.65rem; padding: 0.125em 0.5em; }
  &--lg { font-size: $font-size-sm; padding: 0.375em 0.875em; }

  // Sans fond (outline)
  &--outline {
    background: transparent;
    border-color: currentColor;
  }
}
```

---

## Navigation / Tabs

```scss
// components/_tabs.scss
@use '../abstracts' as *;

.tabs {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;

  &__list {
    @extend %reset-list;
    display: flex;
    gap: $spacing-1;
    border-bottom: 1px solid var(--color-border);
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar { display: none; }
  }

  &__item {}

  &__trigger {
    @extend %reset-button;
    @include label($uppercase: false);
    @include transition(color, border-color);
    @include focus-ring;

    padding: $spacing-2 $spacing-3;
    color: var(--color-text-muted);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    white-space: nowrap;
    border-radius: $radius-sm $radius-sm 0 0;

    &:hover { color: var(--color-text); }

    &[aria-selected="true"] {
      color: $color-primary;
      border-bottom-color: $color-primary;
    }
  }

  &__panel {
    &[hidden] { display: none; }
  }
}
```

---

## Composant Vue : exemple intégré

```vue
<!-- ProductCard.vue -->
<template>
  <article class="product-card" :class="{ 'product-card--featured': featured }">
    <div class="product-card__media">
      <img class="product-card__image" :src="image" :alt="title" />
      <span v-if="badge" class="product-card__badge badge badge--primary">
        {{ badge }}
      </span>
    </div>

    <div class="product-card__body">
      <h3 class="product-card__title">{{ title }}</h3>
      <p class="product-card__description">{{ description }}</p>

      <div class="product-card__footer">
        <span class="product-card__price">{{ price }}</span>
        <button class="button button--primary button--sm" @click="$emit('add')">
          Ajouter
        </button>
      </div>
    </div>
  </article>
</template>

<style lang="scss" scoped>
@use '~/assets/styles/abstracts' as *;

.product-card {
  @include card($padding: 0);
  @include transition(box-shadow, transform);
  display: grid;
  overflow: hidden;

  &:hover {
    box-shadow: $shadow-lg;
    transform: translateY(-2px);
  }

  &__media {
    position: relative;
    overflow: hidden;
  }

  &__image {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    @include transition(transform);

    .product-card:hover & {
      transform: scale(1.04);
    }
  }

  &__badge {
    position: absolute;
    top: $spacing-3;
    right: $spacing-3;
  }

  &__body {
    padding: $spacing-4;
    display: grid;
    gap: $spacing-2;
  }

  &__title {
    @include truncate(2);
    @include heading($font-size-lg);
    color: var(--color-text);
  }

  &__description {
    @include truncate(3);
    font-size: $font-size-sm;
    color: var(--color-text-muted);
    line-height: $line-height-relaxed;
  }

  &__footer {
    @include flex-between;
    margin-block-start: $spacing-2;
  }

  &__price {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: $color-primary;
  }

  // ── Variante featured
  &--featured {
    border: 2px solid $color-primary;
    box-shadow: 0 0 0 4px alpha($color-primary, 0.1);
  }

  // ── Responsive
  @include respond-to('lg') {
    grid-template-columns: 240px 1fr;

    .product-card__image {
      height: 100%;
      aspect-ratio: auto;
    }
  }
}
</style>
```
