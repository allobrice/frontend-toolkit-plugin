# Performance Vue.js

Guide d'optimisation des performances pour Vue 2.7 et Vue 3.

## Table des matières

1. [Optimisation du rendu](#optimisation-du-rendu)
2. [Lazy loading et code splitting](#lazy-loading)
3. [Gestion des listes volumineuses](#listes-volumineuses)
4. [Réactivité performante](#réactivité-performante)
5. [Optimisation des watchers et computed](#watchers-et-computed)
6. [Composants async et Suspense](#composants-async)
7. [Memoization et cache](#memoization)
8. [Bonnes pratiques de bundle](#bundle)
9. [Outils de diagnostic](#diagnostic)

---

## Optimisation du rendu

### v-once — rendu statique unique

```vue
<template>
  <!-- Rendu une seule fois, jamais mis à jour -->
  <header v-once>
    <h1>{{ appTitle }}</h1>
    <p>{{ appDescription }}</p>
  </header>

  <!-- Contenu dynamique normal -->
  <main>
    <UserList :users="users" />
  </main>
</template>
```

### v-memo — memoization du template (Vue 3.2+)

```vue
<template>
  <!-- Re-rendu UNIQUEMENT si id ou selected changent -->
  <div v-for="item in list" :key="item.id" v-memo="[item.id, item === selected]">
    <p>{{ item.name }}</p>
    <p>{{ item.description }}</p>
    <!-- Contenu complexe qui ne change pas souvent -->
  </div>
</template>
```

**Quand utiliser `v-memo`** : listes de >1000 éléments où seules quelques propriétés changent (ex: sélection).

### Éviter les re-rendus inutiles

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

// ❌ Objet recréé à chaque rendu
// <ChildComponent :style="{ color: 'red', fontSize: '14px' }" />

// ✅ Objet stable en dehors du template
const childStyle = { color: 'red', fontSize: '14px' }

// ❌ Fonction recréée à chaque rendu
// <ChildComponent @click="() => handleClick(item.id)" />

// ✅ Méthode stable
function handleItemClick(id: number) {
  // ...
}

// ❌ Computed qui retourne toujours un nouvel objet
const badComputed = computed(() => ({ ...state })) // Nouvel objet à chaque accès

// ✅ Computed qui garde la même référence si rien ne change
const items = ref<Item[]>([])
const sortedItems = computed(() =>
  [...items.value].sort((a, b) => a.name.localeCompare(b.name))
)
</script>
```

### Composants fonctionnels pour les cas simples

```typescript
// Pas de state, pas de lifecycle — rendu plus rapide
import { h, type FunctionalComponent } from 'vue'

const StaticBadge: FunctionalComponent<{ label: string; color: string }> = (props) => {
  return h('span', { class: `badge badge--${props.color}` }, props.label)
}

StaticBadge.props = ['label', 'color']
export default StaticBadge
```

---

## Lazy loading

### Lazy loading de routes

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/views/Home.vue'),  // ✅ Chunk séparé
    },
    {
      path: '/dashboard',
      component: () => import('@/views/Dashboard.vue'),
      children: [
        {
          path: 'analytics',
          // Grouper dans le même chunk avec un commentaire magique
          component: () => import(/* webpackChunkName: "dashboard" */ '@/views/Analytics.vue'),
        },
        {
          path: 'reports',
          component: () => import(/* webpackChunkName: "dashboard" */ '@/views/Reports.vue'),
        },
      ],
    },
  ],
})
```

### Lazy loading de composants

```vue
<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'

// ✅ Composant chargé à la demande
const HeavyChart = defineAsyncComponent(() =>
  import('@/components/HeavyChart.vue')
)

// ✅ Avec loading et erreur
const HeavyEditor = defineAsyncComponent({
  loader: () => import('@/components/RichTextEditor.vue'),
  loadingComponent: () => import('@/components/EditorSkeleton.vue'),
  errorComponent: () => import('@/components/ErrorFallback.vue'),
  delay: 200,        // Délai avant d'afficher le loading (ms)
  timeout: 10000,    // Timeout avant d'afficher l'erreur (ms)
})

// ✅ Chargement conditionnel
const showChart = ref(false)
</script>

<template>
  <button @click="showChart = true">Afficher le graphique</button>
  <!-- Le chunk ne se charge que quand showChart est true -->
  <HeavyChart v-if="showChart" :data="chartData" />
</template>
```

### Prefetching intelligent

```vue
<script setup lang="ts">
import { onMounted } from 'vue'

// Précharger un composant au hover ou après le montage
const preloadEditor = () => import('@/components/RichTextEditor.vue')

onMounted(() => {
  // Précharger après le rendu initial (idle time)
  if ('requestIdleCallback' in window) {
    requestIdleCallback(preloadEditor)
  } else {
    setTimeout(preloadEditor, 2000)
  }
})
</script>

<template>
  <button @mouseenter="preloadEditor" @click="openEditor">
    Ouvrir l'éditeur
  </button>
</template>
```

---

## Listes volumineuses

### Virtual scrolling avec vue-virtual-scroller

```vue
<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const props = defineProps<{
  items: Array<{ id: number; name: string; description: string }>
}>()
</script>

<template>
  <!-- Rend uniquement les éléments visibles dans le viewport -->
  <RecycleScroller
    class="scroller"
    :items="items"
    :item-size="80"
    key-field="id"
    v-slot="{ item }"
  >
    <div class="item">
      <h3>{{ item.name }}</h3>
      <p>{{ item.description }}</p>
    </div>
  </RecycleScroller>
</template>

<style scoped>
.scroller {
  height: 500px;
}
</style>
```

### Pagination vs infinite scroll

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const items = ref<Item[]>([])
const page = ref(1)
const isLoading = ref(false)
const hasMore = ref(true)

async function loadMore() {
  if (isLoading.value || !hasMore.value) return
  isLoading.value = true

  try {
    const newItems = await fetchItems(page.value)
    if (newItems.length === 0) {
      hasMore.value = false
    } else {
      items.value.push(...newItems)
      page.value++
    }
  } finally {
    isLoading.value = false
  }
}

// Intersection Observer pour infinite scroll
const sentinel = ref<HTMLElement>()
let observer: IntersectionObserver

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) loadMore()
    },
    { rootMargin: '200px' }  // Précharge 200px avant la fin
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div>
    <div v-for="item in items" :key="item.id">
      <ItemCard :item="item" />
    </div>
    <div ref="sentinel" />
    <p v-if="isLoading">Chargement...</p>
  </div>
</template>
```

---

## Réactivité performante

### shallowRef — éviter le suivi profond

```vue
<script setup lang="ts">
import { shallowRef, triggerRef } from 'vue'

// ❌ ref() — suivi profond de chaque propriété imbriquée
// const bigData = ref(hugeObject)

// ✅ shallowRef — seule la référence racine est réactive
const bigData = shallowRef<LargeDataset>(loadInitialData())

// Pour notifier d'un changement interne :
function updateNestedValue() {
  bigData.value.nested.property = 'new'
  triggerRef(bigData)  // Force le re-rendu
}

// Ou réassigner complètement :
function replaceData(newData: LargeDataset) {
  bigData.value = newData  // ✅ Déclenche automatiquement le re-rendu
}
```

### shallowReactive — objets plats

```typescript
import { shallowReactive } from 'vue'

// Seules les propriétés de premier niveau sont réactives
const state = shallowReactive({
  user: { name: 'John' },  // user est réactif, user.name NON
  items: [],                // items est réactif, items[0] NON
  count: 0,                 // ✅ réactif
})

// ✅ Ceci déclenche un re-rendu
state.count++
state.user = { name: 'Jane' }

// ❌ Ceci ne déclenche PAS de re-rendu
state.user.name = 'Jane'
```

### Éviter les pertes de réactivité

```typescript
import { ref, reactive, toRef, toRefs } from 'vue'

const state = reactive({ count: 0, name: 'Vue' })

// ❌ Perte de réactivité par déstructuration
const { count, name } = state  // count et name sont des valeurs brutes

// ✅ Conserver la réactivité avec toRefs
const { count, name } = toRefs(state)  // count et name sont des Ref<>

// ✅ Ou toRef pour une seule propriété
const countRef = toRef(state, 'count')

// ❌ Perte de réactivité en passant une prop déstructurée
const props = defineProps<{ user: User }>()
const { user } = props  // ❌ Perd la réactivité

// ✅ Utiliser toRef ou accéder via props.user
const userRef = toRef(props, 'user')
// Ou simplement utiliser props.user dans le template/computed
```

---

## Watchers et computed

### computed vs watch — règle de choix

```typescript
// ✅ Utiliser computed quand on DÉRIVE une valeur d'autres valeurs réactives
const fullName = computed(() => `${firstName.value} ${lastName.value}`)
const filteredList = computed(() => items.value.filter(i => i.active))

// ✅ Utiliser watch quand on a besoin d'un EFFET DE BORD
watch(searchQuery, async (newQuery) => {
  // Appel API = effet de bord → watch
  results.value = await searchAPI(newQuery)
})

// ❌ Anti-pattern : watch pour dériver une valeur
watch(firstName, (val) => {
  fullName.value = `${val} ${lastName.value}`  // ❌ Utiliser computed
})
```

### watchEffect avec cleanup

```typescript
import { watchEffect, ref } from 'vue'

const userId = ref(1)

watchEffect((onCleanup) => {
  const controller = new AbortController()

  fetch(`/api/users/${userId.value}`, { signal: controller.signal })
    .then(r => r.json())
    .then(data => { user.value = data })

  // Annuler la requête précédente quand userId change
  onCleanup(() => controller.abort())
})
```

### watch avec debounce

```typescript
import { watch, ref } from 'vue'

const search = ref('')
let timeoutId: ReturnType<typeof setTimeout>

watch(search, (newVal) => {
  clearTimeout(timeoutId)
  timeoutId = setTimeout(async () => {
    results.value = await searchAPI(newVal)
  }, 300)
})

// Ou avec un composable réutilisable
function useDebouncedRef<T>(initialValue: T, delay = 300) {
  const value = ref(initialValue) as Ref<T>
  const debounced = ref(initialValue) as Ref<T>
  let timeout: ReturnType<typeof setTimeout>

  watch(value, (val) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      debounced.value = val
    }, delay)
  })

  return { value, debounced }
}
```

---

## Composants async

### Suspense avec gestion d'erreur

```vue
<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'

const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err
  return false  // Ne pas propager
})
</script>

<template>
  <div v-if="error">
    <ErrorDisplay :error="error" @retry="error = null" />
  </div>
  <Suspense v-else>
    <template #default>
      <AsyncDashboard />
    </template>
    <template #fallback>
      <DashboardSkeleton />
    </template>
  </Suspense>
</template>
```

---

## Memoization

### Composable de memoization

```typescript
// composables/useMemoize.ts
import { ref, watch, type Ref } from 'vue'

export function useMemoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  keyFn: (...args: TArgs) => string = (...args) => JSON.stringify(args)
) {
  const cache = new Map<string, TResult>()

  function memoized(...args: TArgs): TResult {
    const key = keyFn(...args)
    if (cache.has(key)) return cache.get(key)!
    const result = fn(...args)
    cache.set(key, result)
    return result
  }

  function clear() {
    cache.clear()
  }

  return { call: memoized, clear, cacheSize: () => cache.size }
}
```

### Memoization avec computed et Map

```typescript
import { computed, reactive } from 'vue'

const expensiveResults = reactive(new Map<string, ComputedResult>())

function getExpensiveComputed(key: string, data: Ref<RawData>) {
  if (!expensiveResults.has(key)) {
    expensiveResults.set(key, computed(() => heavyTransform(data.value)))
  }
  return expensiveResults.get(key)!
}
```

---

## Bundle

### Tree-shaking — imports nommés

```typescript
// ✅ Import nommé — tree-shakeable
import { ref, computed, watch } from 'vue'

// ❌ Import global — inclut tout Vue
import Vue from 'vue'

// ✅ Pinia — import nommé du store
import { useUserStore } from '@/stores/user'

// ✅ Lodash — import spécifique
import debounce from 'lodash-es/debounce'
// ❌ import { debounce } from 'lodash'  // Inclut tout lodash
```

### Analyse du bundle

```bash
# Vite — visualiser la taille du bundle
npx vite build --mode production
npx vite-bundle-visualizer

# Webpack
npx webpack-bundle-analyzer dist/stats.json
```

---

## Diagnostic

### Vue DevTools — profiling

Utiliser l'onglet **Performance** des Vue DevTools pour identifier les composants lents.

### Mesurer les re-rendus

```vue
<script setup lang="ts">
import { onRenderTracked, onRenderTriggered } from 'vue'

// Debug uniquement — identifie les dépendances suivies
onRenderTracked((event) => {
  console.log('Render tracked:', event)
})

// Identifie ce qui déclenche un re-rendu
onRenderTriggered((event) => {
  console.log('Render triggered:', event)
})
</script>
```

### Checklist de performance

1. **Routes** : toutes lazy-loadées ?
2. **Composants lourds** : `defineAsyncComponent` ou `v-if` conditionnel ?
3. **Listes >100 items** : virtual scrolling ou pagination ?
4. **Gros objets réactifs** : `shallowRef` au lieu de `ref` ?
5. **v-for** : `:key` unique (jamais l'index sur liste dynamique) ?
6. **Watchers** : `computed` suffisant à la place ?
7. **Images** : lazy loading natif (`loading="lazy"`) ?
8. **Bundle** : imports nommés, pas d'import global ?
9. **Event listeners** : nettoyés dans `onUnmounted` ?
10. **CSS** : `<style scoped>` pour éviter les fuites ?
