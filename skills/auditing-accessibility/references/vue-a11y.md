# Vue/Nuxt — Patterns d'Accessibilité Spécifiques

Ce fichier complète les références génériques avec des patterns propres à l'écosystème Vue/Nuxt.

---

## Checklist Vue/Nuxt

### Navigation SPA (Single Page Application)
- [ ] Après un changement de route : le focus est géré explicitement
- [ ] Le titre de page (`<title>`) est mis à jour à chaque route (Nuxt : `useHead()`)
- [ ] Un mécanisme d'annonce du changement de page existe (`aria-live` ou focus sur `<h1>`)
- [ ] Les transitions de page ne bloquent pas le focus ou les lecteurs d'écran
- [ ] `vue-router` : `router.afterEach` utilisé pour la gestion du focus

### Composants Vue et accessibilité
- [ ] Les composants headless (ex: Headless UI, Radix Vue) sont utilisés pour les widgets complexes
  quand disponibles
- [ ] Les composants custom réimplémentant des éléments natifs incluent tous les attributs ARIA requis
- [ ] Props `aria-*` sont transmises via `v-bind="$attrs"` pour les composants wrapper
- [ ] `inheritAttrs: false` utilisé correctement sur les composants qui transmettent manuellement les attributs

### Teleport (`<Teleport>`)
- [ ] Les modales/dialogs utilisent `<Teleport to="body">` pour éviter les problèmes de z-index et de focus
- [ ] Le focus trap est actif dans les composants téléportés
- [ ] Le scroll du body est bloqué pendant l'ouverture d'une modale

### Transitions Vue (`<Transition>`, `<TransitionGroup>`)
- [ ] `prefers-reduced-motion` respecté (voir references/motion.md)
- [ ] Les `<TransitionGroup>` sur des listes ne perturbent pas l'ordre de lecture
- [ ] Les transitions n'empêchent pas les annonces des lecteurs d'écran

### `v-show` vs `v-if`
- [ ] `v-show` : l'élément reste dans le DOM mais masqué — s'assurer qu'il n'est pas atteignable
  au clavier quand masqué (`tabindex="-1"` ou `aria-hidden="true"` en complément)
- [ ] `v-if` : préférable pour les éléments qui ne doivent vraiment pas exister dans le DOM

### Formulaires Vue
- [ ] La validation réactive met à jour `aria-invalid` et `aria-describedby` dynamiquement
- [ ] `vee-validate` ou `zod` + messages d'erreur liés aux champs via `aria-describedby`
- [ ] Les erreurs apparaissant dynamiquement sont annoncées (`role="alert"` ou `aria-live`)

---

## Patterns courants

### Focus après changement de route (Vue Router)
```ts
// router/index.ts
import { createRouter } from 'vue-router'

const router = createRouter({ /* ... */ })

router.afterEach(() => {
  // Attendre le prochain tick pour que le DOM soit mis à jour
  nextTick(() => {
    // Option 1 : Focus sur le h1 de la nouvelle page
    const h1 = document.querySelector('h1')
    if (h1) {
      h1.setAttribute('tabindex', '-1')
      h1.focus()
    }

    // Option 2 : Focus sur la région <main>
    const main = document.querySelector('main')
    if (main) {
      main.setAttribute('tabindex', '-1')
      main.focus()
    }
  })
})
```

### Titre de page dynamique (Nuxt)
```vue
<!-- pages/product/[id].vue -->
<script setup>
const product = await useFetch(...)

useHead({
  title: computed(() => `${product.value?.name} — MonSite`),
})
</script>
```

### Transmission des attributs ARIA dans un composant wrapper
```vue
<!-- components/BaseButton.vue -->
<script setup>
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  loading?: boolean
}>()
</script>

<template>
  <!-- ✅ Les aria-* passés au composant atterrissent sur le bouton, pas sur la div wrapper -->
  <div class="button-wrapper">
    <button
      v-bind="$attrs"
      :aria-busy="loading"
      :aria-disabled="loading"
      class="btn"
    >
      <slot />
    </button>
  </div>
</template>
```

### Focus trap pour modale (composable)
```ts
// composables/useFocusTrap.ts
import { ref, onUnmounted } from 'vue'

export function useFocusTrap(containerRef: Ref<HTMLElement | null>) {
  const previousFocus = ref<HTMLElement | null>(null)

  const FOCUSABLE_SELECTORS = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ')

  function activate() {
    previousFocus.value = document.activeElement as HTMLElement
    const first = containerRef.value?.querySelector<HTMLElement>(FOCUSABLE_SELECTORS)
    first?.focus()

    containerRef.value?.addEventListener('keydown', trapFocus)
  }

  function deactivate() {
    containerRef.value?.removeEventListener('keydown', trapFocus)
    previousFocus.value?.focus()
  }

  function trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab') return

    const focusable = Array.from(
      containerRef.value?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS) ?? []
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  onUnmounted(deactivate)

  return { activate, deactivate }
}
```

### v-show accessible
```vue
<template>
  <!-- ❌ v-show sans gestion du focus — élément atteignable même masqué -->
  <div v-show="isVisible" class="panel">
    <button>Action dans le panel masqué</button>
  </div>

  <!-- ✅ v-show avec attributs cohérents -->
  <div
    v-show="isVisible"
    :aria-hidden="!isVisible"
    class="panel"
  >
    <button :tabindex="isVisible ? 0 : -1">Action dans le panel</button>
  </div>
</template>
```

---

## Librairies Vue recommandées pour l'a11y

| Librairie | Usage |
|---|---|
| `@vueuse/core` | `useReducedMotion`, `useActiveElement`, `useFocus` |
| `radix-vue` | Composants headless accessibles (Dialog, Select, Tabs…) |
| `headlessui` (Vue) | Alternative Tailwind Labs |
| `vue-announcer` | Annonces pour lecteurs d'écran lors des navigations SPA |
| `vee-validate` | Validation de formulaires avec gestion des erreurs accessibles |
| `floating-ui` | Positionnement accessible de tooltips/popovers |
