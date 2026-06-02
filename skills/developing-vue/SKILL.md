---
name: developing-vue
description: "Guide d'expertise Vue.js complet couvrant Vue 2.7 et Vue 3, Options API et Composition API, avec et sans TypeScript. Utiliser ce skill dès que l'utilisateur pose une question sur Vue.js, demande une revue de code Vue, veut comprendre un pattern Vue, cherche à optimiser un composant Vue, ou a besoin de conseils sur les bonnes pratiques Vue. Couvre : patterns de composants, performance, state management (Pinia/Vuex), sécurité, Vue Router, et migration Vue 2→3. Même si l'utilisateur ne mentionne pas explicitement 'bonnes pratiques', utiliser ce skill pour toute question Vue afin de garantir des réponses alignées avec les standards modernes. Déclencher aussi pour les fichiers .vue, les mentions de ref(), reactive(), computed(), watch(), defineProps(), defineEmits(), ou tout concept lié à l'écosystème Vue."
---

# Vue.js Expertise

Skill pour générer et maintenir du code Vue.js de qualité professionnelle, couvrant Vue 2.7 et Vue 3, Options API et Composition API, avec et sans TypeScript.

## Principes fondamentaux

Toujours respecter ces principes lors de l'écriture de code Vue :

1. **Composition API par défaut** — Préférer `<script setup>` pour tout nouveau code Vue 3. L'Options API reste valide pour Vue 2.7 ou la maintenance de code existant.
2. **TypeScript encouragé** — Typer les props, emits, refs et computed. Fournir les deux versions (TS/JS) si le contexte est ambigu.
3. **Single Responsibility** — Un composant = une responsabilité. Extraire la logique réutilisable dans des composables.
4. **Props down, Events up** — Flux de données unidirectionnel strict. Jamais de mutation directe des props.
5. **Réactivité explicite** — Utiliser `ref()` pour les primitives, `reactive()` pour les objets. Éviter les pertes de réactivité.
6. **Performance par défaut** — Lazy loading des routes, `v-once` / `v-memo` quand pertinent, `shallowRef` pour les gros objets.

## Détection de version

Avant de répondre, identifier la version de Vue du projet :

| Signal | Version probable |
|--------|-----------------|
| `<script setup>`, `defineProps()` | Vue 3 |
| `createApp()`, `defineComponent()` | Vue 3 |
| `new Vue()`, `Vue.component()` | Vue 2.x |
| `@vue/composition-api` import | Vue 2.7 avec Composition API |
| `setup()` dans Options API | Vue 2.7+ ou Vue 3 |
| Pinia | Vue 3 (ou Vue 2.7 avec plugin) |
| Vuex | Vue 2.x ou Vue 3 (legacy) |

Si la version est ambiguë, demander ou fournir les deux variantes.

## Patterns rapides — Composition API (Vue 3)

### Composant avec `<script setup>` + TypeScript

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// Props typées
const props = defineProps<{
  title: string
  count?: number
  items: string[]
}>()

// Valeurs par défaut
const { count = 0 } = props // ⚠️ Perd la réactivité
// ✅ Préférer withDefaults :
const propsWithDefaults = withDefaults(defineProps<{
  title: string
  count?: number
}>(), {
  count: 0,
})

// Emits typés
const emit = defineEmits<{
  'update:count': [value: number]
  'submit': [data: { name: string }]
}>()

// State réactif
const search = ref('')
const isLoading = ref(false)

// Computed
const filteredItems = computed(() =>
  props.items.filter(item =>
    item.toLowerCase().includes(search.value.toLowerCase())
  )
)

// Lifecycle
onMounted(() => {
  console.log('Composant monté')
})

// Méthode
function handleSubmit() {
  emit('submit', { name: search.value })
}
</script>

<template>
  <div>
    <h2>{{ title }}</h2>
    <input v-model="search" placeholder="Rechercher..." />
    <ul>
      <li v-for="item in filteredItems" :key="item">{{ item }}</li>
    </ul>
    <button @click="handleSubmit">Valider</button>
  </div>
</template>
```

### Composant avec `<script setup>` sans TypeScript

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'

// Props avec validation runtime
const props = defineProps({
  title: { type: String, required: true },
  count: { type: Number, default: 0 },
  items: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:count', 'submit'])

const search = ref('')

const filteredItems = computed(() =>
  props.items.filter(item =>
    item.toLowerCase().includes(search.value.toLowerCase())
  )
)
</script>
```

### Composable (extraction de logique)

```typescript
// composables/useSearch.ts
import { ref, computed, type Ref } from 'vue'

export function useSearch<T>(
  items: Ref<T[]>,
  searchFn: (item: T, query: string) => boolean
) {
  const query = ref('')

  const results = computed(() => {
    if (!query.value) return items.value
    return items.value.filter(item => searchFn(item, query.value))
  })

  const hasResults = computed(() => results.value.length > 0)

  function reset() {
    query.value = ''
  }

  return { query, results, hasResults, reset }
}
```

## Patterns rapides — Options API (Vue 2.7 / Vue 3)

### Composant Options API avec TypeScript

```vue
<script lang="ts">
import { defineComponent, type PropType } from 'vue'

interface Item {
  id: number
  name: string
}

export default defineComponent({
  name: 'ItemList',

  props: {
    items: {
      type: Array as PropType<Item[]>,
      required: true,
    },
    title: {
      type: String,
      default: 'Liste',
    },
  },

  emits: {
    select: (item: Item) => !!item.id,
  },

  data() {
    return {
      search: '',
    }
  },

  computed: {
    filteredItems(): Item[] {
      return this.items.filter(item =>
        item.name.toLowerCase().includes(this.search.toLowerCase())
      )
    },
  },

  methods: {
    handleSelect(item: Item) {
      this.$emit('select', item)
    },
  },
})
</script>
```

## Arbres de décision

### Options API vs Composition API

```
Nouveau projet Vue 3 ?
├── Oui → Composition API + <script setup>
└── Non
    ├── Projet Vue 2.7 existant ?
    │   ├── Nouveau composant → Composition API (setup())
    │   └── Maintenance → Options API (garder la cohérence)
    └── Migration en cours ?
        └── Nouveaux composants en Composition API, migration progressive
```

### ref() vs reactive()

```
Quel type de données ?
├── Primitive (string, number, boolean) → ref()
├── Objet simple → ref() ou reactive()
│   └── Besoin de réassigner l'objet entier ? → ref()
│   └── Objet stable, propriétés modifiées → reactive()
├── Tableau → ref()  (permet la réassignation)
└── Gros objet non suivi en profondeur → shallowRef()
```

### Gestion de state

```
Besoin de state partagé ?
├── State local au composant → ref() / reactive()
├── State partagé parent ↔ enfants → props + emit / provide + inject
├── State global simple → Composable avec state externe
└── State global complexe → Pinia
    ├── Nouveau projet → Pinia (toujours)
    └── Projet existant avec Vuex → Migration progressive vers Pinia
```

## Fichiers de référence

Consulter ces fichiers pour les patterns détaillés :

| Fichier | Contenu | Quand le lire |
|---------|---------|---------------|
| [references/component-patterns.md](references/component-patterns.md) | Props, emits, slots, provide/inject, v-model, composants génériques, render functions | Conception de composants, architecture, patterns avancés |
| [references/performance.md](references/performance.md) | Lazy loading, virtual scroll, memoization, shallowRef, optimisation rendu | Problèmes de performance, optimisation, gros volumes de données |
| [references/state-management.md](references/state-management.md) | Pinia (stores, actions, getters, plugins), Vuex (legacy), patterns de state | Gestion d'état global, stores, persistence |
| [references/security.md](references/security.md) | XSS, sanitization, v-html, auth guards, CSRF, Content Security Policy | Sécurité, validation, affichage de contenu utilisateur |
| [references/vue-router.md](references/vue-router.md) | Navigation guards, lazy loading routes, meta, transitions, scroll behavior | Routing, navigation, guards, middleware |
| [references/migration-vue2-vue3.md](references/migration-vue2-vue3.md) | Breaking changes, @vue/compat, stratégie de migration progressive | Migration de Vue 2 vers Vue 3 |
| [references/anti-patterns.md](references/anti-patterns.md) | Erreurs courantes, perte de réactivité, mauvais usages de watch/computed | Revue de code, debugging, refactoring |

## Conventions de code

### Nommage

- **Composants** : PascalCase dans le script (`UserProfile`), kebab-case ou PascalCase dans le template
- **Props** : camelCase dans le script (`userName`), kebab-case dans le template (`user-name`)
- **Emits** : kebab-case (`update:model-value`, `item-selected`)
- **Composables** : préfixe `use` (`useAuth`, `useSearch`, `usePagination`)
- **Stores Pinia** : préfixe `use` + suffixe `Store` (`useUserStore`, `useCartStore`)
- **Fichiers** : PascalCase pour composants (`UserProfile.vue`), camelCase pour composables (`useAuth.ts`)

### Structure d'un fichier `.vue`

```vue
<script setup lang="ts">
// 1. Imports
// 2. Props & Emits
// 3. Composables
// 4. State réactif (ref, reactive)
// 5. Computed
// 6. Watchers
// 7. Lifecycle hooks
// 8. Méthodes
// 9. Expose (si nécessaire)
</script>

<template>
  <!-- Template concis, logique complexe dans le script -->
</template>

<style scoped>
/* Toujours scoped sauf cas justifié */
</style>
```

## Rappels critiques

- **TOUJOURS** utiliser `:key` unique sur `v-for` (jamais l'index sauf liste statique)
- **JAMAIS** muter une prop directement — émettre un événement ou utiliser un v-model
- **JAMAIS** utiliser `v-html` avec du contenu utilisateur non sanitisé
- **TOUJOURS** lazy-loader les routes et composants lourds
- **PRÉFÉRER** `<script setup>` à `setup()` en Vue 3 (moins de boilerplate, meilleure inférence TS)
- **ÉVITER** `watch` quand `computed` suffit
- **ÉVITER** `reactive()` pour des valeurs qui seront réassignées
- **TOUJOURS** désenregistrer les listeners manuels dans `onUnmounted`
- **UTILISER** `shallowRef()` pour les gros objets/tableaux non suivis en profondeur
- **VÉRIFIER** la perte de réactivité lors de la déstructuration de `reactive()` ou de `props`
