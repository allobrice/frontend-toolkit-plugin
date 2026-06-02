# Migration Vue 2 → Vue 3

Guide de migration progressive de Vue 2.x/2.7 vers Vue 3.

## Table des matières

1. [Stratégie de migration](#stratégie)
2. [Breaking changes majeurs](#breaking-changes)
3. [Mode compatibilité @vue/compat](#compat)
4. [Migration des composants](#composants)
5. [Migration Vuex → Pinia](#vuex-pinia)
6. [Migration Vue Router 3 → 4](#router)

---

## Stratégie

### Approche recommandée

```
Phase 1 — Préparer (sur Vue 2.7)
  ├── Activer la Composition API via Vue 2.7 natif
  ├── Réécrire les nouveaux composants en Composition API
  ├── Migrer les mixins → composables
  └── Supprimer les filtres (filters) — utiliser computed/méthodes

Phase 2 — Migrer (vers Vue 3 + @vue/compat)
  ├── Installer Vue 3 avec @vue/compat
  ├── Corriger les warnings de compatibilité un par un
  ├── Mettre à jour les dépendances (Vuex → Pinia, Router 3 → 4)
  └── Tester chaque page/fonctionnalité

Phase 3 — Finaliser
  ├── Supprimer @vue/compat
  ├── Nettoyer le code legacy
  └── Passer en mode Vue 3 pur
```

---

## Breaking changes

### Création d'application

```javascript
// Vue 2
import Vue from 'vue'
import App from './App.vue'
new Vue({ render: h => h(App) }).$mount('#app')

// Vue 3
import { createApp } from 'vue'
import App from './App.vue'
const app = createApp(App)
app.mount('#app')
```

### Plugins et configuration globale

```javascript
// Vue 2
Vue.use(MyPlugin)
Vue.component('MyComponent', MyComponent)
Vue.directive('my-directive', myDirective)
Vue.mixin(myMixin)
Vue.prototype.$http = axios

// Vue 3
const app = createApp(App)
app.use(MyPlugin)
app.component('MyComponent', MyComponent)
app.directive('my-directive', myDirective)
// ❌ Plus de mixin global — utiliser provide/inject ou composables
app.provide('http', axios)
// Ou app.config.globalProperties.$http = axios (déconseillé)
```

### v-model

```vue
<!-- Vue 2 — v-model utilise value + input -->
<CustomInput :value="name" @input="name = $event" />
<!-- Équivalent à : <CustomInput v-model="name" /> -->

<!-- Vue 3 — v-model utilise modelValue + update:modelValue -->
<CustomInput :model-value="name" @update:model-value="name = $event" />

<!-- Vue 3 — v-model multiples -->
<UserForm v-model:first-name="first" v-model:last-name="last" />
```

### Événements et $listeners

```vue
<!-- Vue 2 — $listeners transmis séparément -->
<template>
  <child-component v-bind="$attrs" v-on="$listeners" />
</template>

<!-- Vue 3 — $listeners fusionné dans $attrs -->
<template>
  <child-component v-bind="$attrs" />
</template>

<!-- Vue 3 — inheritAttrs: false pour contrôle total -->
<script setup>
defineOptions({ inheritAttrs: false })
</script>
```

### Filtres supprimés

```vue
<!-- Vue 2 — filtres dans le template -->
<template>
  <p>{{ date | formatDate }}</p>
  <p>{{ price | currency('EUR') }}</p>
</template>

<!-- Vue 3 — utiliser des fonctions ou computed -->
<script setup>
import { formatDate, formatCurrency } from '@/utils/formatters'
const formattedDate = computed(() => formatDate(date.value))
const formattedPrice = computed(() => formatCurrency(price.value, 'EUR'))
</script>
<template>
  <p>{{ formattedDate }}</p>
  <p>{{ formattedPrice }}</p>
</template>
```

### $on, $off, $once supprimés

```javascript
// Vue 2 — event bus
const bus = new Vue()
bus.$on('event', handler)
bus.$emit('event', data)

// Vue 3 — utiliser mitt ou tiny-emitter
import mitt from 'mitt'
const emitter = mitt()
emitter.on('event', handler)
emitter.emit('event', data)

// ✅ Préférer : provide/inject, props/emits, ou Pinia
```

### Transition / TransitionGroup

```html
<!-- Vue 2 -->
<transition name="fade">...</transition>
<transition-group tag="ul">...</transition-group>

<!-- Vue 3 — PascalCase recommandé -->
<Transition name="fade">...</Transition>
<TransitionGroup tag="ul">...</TransitionGroup>
```

### Fragments (éléments racine multiples)

```vue
<!-- Vue 2 — un seul élément racine obligatoire -->
<template>
  <div>
    <header>...</header>
    <main>...</main>
  </div>
</template>

<!-- Vue 3 — fragments supportés -->
<template>
  <header>...</header>
  <main>...</main>
</template>
```

### Lifecycle hooks renommés

| Vue 2 (Options) | Vue 3 (Options) | Vue 3 (Composition) |
|-----------------|-----------------|---------------------|
| `beforeCreate` | `beforeCreate` | _(dans setup)_ |
| `created` | `created` | _(dans setup)_ |
| `beforeMount` | `beforeMount` | `onBeforeMount` |
| `mounted` | `mounted` | `onMounted` |
| `beforeUpdate` | `beforeUpdate` | `onBeforeUpdate` |
| `updated` | `updated` | `onUpdated` |
| `beforeDestroy` | `beforeUnmount` | `onBeforeUnmount` |
| `destroyed` | `unmounted` | `onUnmounted` |

---

## Compat

### Installation du mode compatibilité

```bash
npm install vue@3 @vue/compat
```

```javascript
// vue.config.js ou vite.config.ts
// Webpack
module.exports = {
  resolve: {
    alias: {
      vue: '@vue/compat',
    },
  },
}

// Vite
import { defineConfig } from 'vite'
export default defineConfig({
  resolve: {
    alias: {
      vue: '@vue/compat',
    },
  },
})
```

```javascript
// main.ts — configurer les features de compatibilité
import { configureCompat } from 'vue'

configureCompat({
  // Désactiver les features déjà migrées
  COMPONENT_V_MODEL: false,        // v-model migré
  INSTANCE_LISTENERS: false,       // $listeners migré
  RENDER_FUNCTION: false,          // render functions migrées
  // Garder la compat pour le reste
  GLOBAL_MOUNT: true,
})
```

---

## Composants

### Migration d'un composant Options → Composition

```vue
<!-- AVANT (Vue 2 Options API) -->
<script>
export default {
  props: {
    userId: { type: Number, required: true },
  },
  data() {
    return {
      user: null,
      loading: false,
      error: null,
    }
  },
  computed: {
    fullName() {
      return this.user ? `${this.user.first} ${this.user.last}` : ''
    },
  },
  watch: {
    userId: {
      immediate: true,
      handler: 'fetchUser',
    },
  },
  methods: {
    async fetchUser() {
      this.loading = true
      try {
        this.user = await api.getUser(this.userId)
      } catch (e) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },
  },
  beforeDestroy() {
    // cleanup
  },
}
</script>
```

```vue
<!-- APRÈS (Vue 3 Composition API) -->
<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps<{
  userId: number
}>()

const user = ref<User | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const fullName = computed(() =>
  user.value ? `${user.value.first} ${user.value.last}` : ''
)

async function fetchUser() {
  loading.value = true
  error.value = null
  try {
    user.value = await api.getUser(props.userId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erreur inconnue'
  } finally {
    loading.value = false
  }
}

watch(() => props.userId, fetchUser, { immediate: true })

onUnmounted(() => {
  // cleanup
})
</script>
```

### Migration des mixins → composables

```javascript
// AVANT — mixin (Vue 2)
export const paginationMixin = {
  data() {
    return { page: 1, perPage: 20, total: 0 }
  },
  computed: {
    totalPages() { return Math.ceil(this.total / this.perPage) },
    hasNextPage() { return this.page < this.totalPages },
  },
  methods: {
    nextPage() { if (this.hasNextPage) this.page++ },
    prevPage() { if (this.page > 1) this.page-- },
    setPage(p) { this.page = Math.max(1, Math.min(p, this.totalPages)) },
  },
}
```

```typescript
// APRÈS — composable (Vue 3)
import { ref, computed } from 'vue'

export function usePagination(initialPerPage = 20) {
  const page = ref(1)
  const perPage = ref(initialPerPage)
  const total = ref(0)

  const totalPages = computed(() => Math.ceil(total.value / perPage.value))
  const hasNextPage = computed(() => page.value < totalPages.value)
  const hasPrevPage = computed(() => page.value > 1)

  function nextPage() { if (hasNextPage.value) page.value++ }
  function prevPage() { if (hasPrevPage.value) page.value-- }
  function setPage(p: number) {
    page.value = Math.max(1, Math.min(p, totalPages.value))
  }
  function setTotal(t: number) { total.value = t }

  return {
    page, perPage, total,
    totalPages, hasNextPage, hasPrevPage,
    nextPage, prevPage, setPage, setTotal,
  }
}
```

---

## Vuex Pinia

Voir [state-management.md](./state-management.md#migration) pour le guide complet.

---

## Router

### Changements Vue Router 3 → 4

```typescript
// Vue Router 3 (Vue 2)
import VueRouter from 'vue-router'
Vue.use(VueRouter)
const router = new VueRouter({ routes, mode: 'history' })

// Vue Router 4 (Vue 3)
import { createRouter, createWebHistory } from 'vue-router'
const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Catch-all route
// Vue Router 3 : path: '*'
// Vue Router 4 : path: '/:pathMatch(.*)*'
```
