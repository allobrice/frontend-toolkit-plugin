# Anti-patterns Vue.js

Erreurs courantes et mauvaises pratiques à éviter dans Vue 2.7 et Vue 3.

## Table des matières

1. [Réactivité](#réactivité)
2. [Props et données](#props-et-données)
3. [Computed et watchers](#computed-et-watchers)
4. [Template et rendu](#template-et-rendu)
5. [Composables](#composables)
6. [Performance](#performance)
7. [Architecture](#architecture)

---

## Réactivité

### ❌ Déstructuration de reactive() ou props

```typescript
// ❌ Perte de réactivité
const state = reactive({ count: 0, name: 'Vue' })
const { count, name } = state  // count = 0, figé !

const props = defineProps<{ user: User }>()
const { user } = props  // user figé, ne sera plus mis à jour

// ✅ Utiliser toRefs ou accès direct
const { count, name } = toRefs(state)
const userRef = toRef(props, 'user')
// Ou : utiliser props.user directement
```

### ❌ Réassigner un reactive()

```typescript
// ❌ Remplacer l'objet reactive perd la réactivité
let state = reactive({ items: [] })
state = reactive({ items: newItems })  // Le template pointe encore sur l'ancien

// ✅ Modifier les propriétés
state.items = newItems

// ✅ Ou utiliser ref() si la réassignation est nécessaire
const state = ref({ items: [] })
state.value = { items: newItems }
```

### ❌ Oublier .value avec ref()

```typescript
const count = ref(0)

// ❌ Compare la Ref, pas la valeur
if (count === 0) { }  // Toujours false

// ✅ Utiliser .value dans le script
if (count.value === 0) { }

// ✅ Dans le template, .value est auto-unwrappé
// <p>{{ count }}</p>  — pas besoin de count.value
```

### ❌ Perdre la réactivité avec l'opérateur spread

```typescript
const user = reactive({ name: 'John', age: 30 })

// ❌ L'objet retourné n'est PAS réactif
const copy = { ...user }

// ✅ Utiliser toRefs pour un spread réactif
const { name, age } = toRefs(user)

// ✅ Ou garder la référence reactive
const copy = reactive({ ...user })  // Réactif mais déconnecté de user
```

---

## Props et données

### ❌ Muter une prop

```vue
<script setup>
const props = defineProps({ count: Number })

// ❌ INTERDIT — Vue émettra un warning
function increment() {
  props.count++  // Mutation directe
}

// ✅ Émettre un événement
const emit = defineEmits(['update:count'])
function increment() {
  emit('update:count', props.count + 1)
}

// ✅ Ou copie locale si modification interne uniquement
const localCount = ref(props.count)
</script>
```

### ❌ Objet/Array mutable comme valeur par défaut

```typescript
// ❌ Référence partagée entre toutes les instances
defineProps({
  items: { type: Array, default: [] },        // ❌ Partagé !
  config: { type: Object, default: {} },       // ❌ Partagé !
})

// ✅ Factory function obligatoire
defineProps({
  items: { type: Array, default: () => [] },   // ✅ Nouvelle instance
  config: { type: Object, default: () => ({}) }, // ✅ Nouvelle instance
})
```

### ❌ Utiliser index comme :key dans v-for

```vue
<!-- ❌ L'index change quand la liste est réordonnée/filtrée -->
<li v-for="(item, index) in items" :key="index">{{ item.name }}</li>

<!-- ✅ Identifiant unique et stable -->
<li v-for="item in items" :key="item.id">{{ item.name }}</li>

<!-- ⚠️ L'index est acceptable UNIQUEMENT pour les listes :
     - Statiques (jamais réordonnées, filtrées, ou modifiées)
     - Sans state interne (pas d'input, pas de composant avec data) -->
```

---

## Computed et watchers

### ❌ Watch quand computed suffit

```typescript
// ❌ Anti-pattern : watch pour dériver une valeur
const firstName = ref('John')
const lastName = ref('Doe')
const fullName = ref('')

watch([firstName, lastName], ([first, last]) => {
  fullName.value = `${first} ${last}`  // ❌
})

// ✅ computed — déclaratif, mis en cache, plus clair
const fullName = computed(() => `${firstName.value} ${lastName.value}`)
```

### ❌ Computed avec effet de bord

```typescript
// ❌ Un computed ne doit JAMAIS avoir d'effets de bord
const filteredItems = computed(() => {
  analyticsTracker.log('filter applied')  // ❌ Effet de bord
  apiCallCount.value++                     // ❌ Mutation
  return items.value.filter(i => i.active)
})

// ✅ Computed pur + watch séparé pour les effets
const filteredItems = computed(() => items.value.filter(i => i.active))

watch(filteredItems, (newItems) => {
  analyticsTracker.log('filter applied')  // ✅ Effet de bord dans watch
})
```

### ❌ Watcher sans cleanup

```typescript
// ❌ Timer ou listener qui fuit
watch(userId, (id) => {
  const interval = setInterval(() => pollUser(id), 5000)
  // Le setInterval précédent n'est JAMAIS nettoyé !
})

// ✅ Utiliser onCleanup
watch(userId, (id, _old, onCleanup) => {
  const interval = setInterval(() => pollUser(id), 5000)
  onCleanup(() => clearInterval(interval))
})
```

---

## Template et rendu

### ❌ v-if et v-for sur le même élément

```vue
<!-- ❌ v-if et v-for sur le même élément — v-if n'a pas accès à item -->
<li v-for="item in items" v-if="item.active" :key="item.id">
  {{ item.name }}
</li>

<!-- ✅ Filtrer dans un computed -->
<li v-for="item in activeItems" :key="item.id">
  {{ item.name }}
</li>

<!-- ✅ Ou wrapper avec <template> -->
<template v-for="item in items" :key="item.id">
  <li v-if="item.active">{{ item.name }}</li>
</template>
```

### ❌ Logique complexe dans le template

```vue
<!-- ❌ Expression complexe dans le template -->
<p>{{ items.filter(i => i.price > 100).sort((a, b) => b.price - a.price).slice(0, 5).map(i => i.name).join(', ') }}</p>

<!-- ✅ Extraire dans un computed -->
<script setup>
const topExpensiveNames = computed(() =>
  items.value
    .filter(i => i.price > 100)
    .sort((a, b) => b.price - a.price)
    .slice(0, 5)
    .map(i => i.name)
    .join(', ')
)
</script>
<template>
  <p>{{ topExpensiveNames }}</p>
</template>
```

### ❌ v-html avec contenu non sanitisé

```vue
<!-- ❌ XSS possible -->
<div v-html="userComment" />

<!-- ✅ Sanitiser d'abord -->
<div v-html="DOMPurify.sanitize(userComment)" />

<!-- ✅ Ou utiliser du texte si pas besoin de HTML -->
<p>{{ userComment }}</p>
```

---

## Composables

### ❌ State partagé par accident

```typescript
// ❌ Le state est recréé à chaque appel — pas partagé
export function useCounter() {
  const count = ref(0)  // Nouvelle instance à chaque appel
  return { count, increment: () => count.value++ }
}

// ✅ State partagé intentionnel — déclarer hors de la fonction
const count = ref(0)
export function useSharedCounter() {
  return {
    count: readonly(count),
    increment: () => count.value++,
  }
}
```

### ❌ Composable qui ne respecte pas les règles de lifecycle

```typescript
// ❌ onMounted en dehors d'un setup — ne fonctionne pas
export function useBadComposable() {
  setTimeout(() => {
    onMounted(() => { })  // ❌ Appelé hors de setup synchrone
  }, 0)
}

// ✅ Les hooks lifecycle doivent être appelés de manière synchrone
export function useGoodComposable() {
  onMounted(() => {
    // ✅ Appelé immédiatement dans le flux synchrone de setup
  })
}
```

### ❌ Ne pas nettoyer les effets

```typescript
// ❌ Fuite mémoire — event listener jamais supprimé
export function useWindowSize() {
  const width = ref(window.innerWidth)
  window.addEventListener('resize', () => {
    width.value = window.innerWidth
  })
  return { width }
}

// ✅ Nettoyage dans onUnmounted
export function useWindowSize() {
  const width = ref(window.innerWidth)

  function onResize() {
    width.value = window.innerWidth
  }

  onMounted(() => window.addEventListener('resize', onResize))
  onUnmounted(() => window.removeEventListener('resize', onResize))

  return { width: readonly(width) }
}
```

---

## Performance

### ❌ ref() pour de gros objets immuables

```typescript
// ❌ Vue crée des proxies récursifs pour chaque propriété
const hugeConfig = ref(loadGiantConfigObject())

// ✅ shallowRef si pas besoin de réactivité profonde
const hugeConfig = shallowRef(loadGiantConfigObject())

// ✅ Ou markRaw si l'objet ne doit JAMAIS être réactif
import { markRaw } from 'vue'
const map = markRaw(new Map())  // Jamais converti en proxy
```

### ❌ Watcher immédiat pour initialisation

```typescript
// ❌ Watch immediate juste pour initialiser
const userId = ref(1)
const user = ref(null)

watch(userId, async (id) => {
  user.value = await fetchUser(id)
}, { immediate: true })

// ✅ Appeler directement + watch pour les changements suivants
const user = ref(await fetchUser(userId.value))
watch(userId, async (id) => {
  user.value = await fetchUser(id)
})

// ✅ Ou watchEffect (suit automatiquement les dépendances)
watchEffect(async () => {
  user.value = await fetchUser(userId.value)
})
```

---

## Architecture

### ❌ Composant god (fait tout)

```
❌ Un composant de 500+ lignes qui :
  - Fetch des données
  - Gère un formulaire
  - Contient la logique de pagination
  - Affiche un tableau
  - Gère les modals
```

```
✅ Découper :
  UserManagement/
  ├── UserManagement.vue     (orchestration)
  ├── UserTable.vue          (affichage tableau)
  ├── UserForm.vue           (formulaire)
  ├── UserFilters.vue        (filtres)
  └── composables/
      ├── useUsers.ts        (fetch + CRUD)
      └── usePagination.ts   (logique pagination)
```

### ❌ Props drilling (>2 niveaux)

```
❌ GrandParent → Parent → Child → GrandChild (même prop transmise)

✅ Solutions :
  - provide/inject pour >2 niveaux
  - Pinia pour du state vraiment global
  - Composable partagé
```

### ❌ Event bus global (Vue 2 pattern)

```typescript
// ❌ Difficile à tracer, pas de typage, fuites mémoire
const bus = new Vue()
bus.$on('user-updated', handler)
bus.$emit('user-updated', data)

// ✅ Alternatives Vue 3 :
// - Props / emit pour parent-enfant
// - Provide / inject pour arbre profond
// - Pinia pour state global
// - Composable partagé pour logique commune
```
