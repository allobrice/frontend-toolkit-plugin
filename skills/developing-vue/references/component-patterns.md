# Patterns de composants Vue.js

Guide complet des patterns de composants pour Vue 2.7 et Vue 3, Options API et Composition API.

## Table des matières

1. [Props avancées](#props-avancées)
2. [Emits et v-model](#emits-et-v-model)
3. [Slots](#slots)
4. [Provide / Inject](#provide--inject)
5. [Composants génériques](#composants-génériques)
6. [Render functions et JSX](#render-functions)
7. [Teleport et Suspense](#teleport-et-suspense)
8. [Patterns de composition](#patterns-de-composition)

---

## Props avancées

### Validation complexe (Runtime)

```vue
<script setup lang="ts">
// TypeScript — validation compile-time
interface Props {
  status: 'idle' | 'loading' | 'success' | 'error'
  user: {
    id: number
    name: string
    email: string
  }
  items: string[]
  callback?: (value: string) => void
}

const props = defineProps<Props>()
```

```vue
<script setup>
// JavaScript — validation runtime avec validators
const props = defineProps({
  status: {
    type: String,
    required: true,
    validator: (value) => ['idle', 'loading', 'success', 'error'].includes(value),
  },
  user: {
    type: Object,
    required: true,
    validator: (user) => {
      return user.id && user.name && user.email
    },
  },
  items: {
    type: Array,
    default: () => [],
  },
  callback: {
    type: Function,
    default: null,
  },
})
```

### withDefaults avec types complexes

```vue
<script setup lang="ts">
interface MenuItem {
  id: string
  label: string
  icon?: string
  disabled?: boolean
}

interface Props {
  items: MenuItem[]
  direction?: 'horizontal' | 'vertical'
  maxVisible?: number
  onSelect?: (item: MenuItem) => void
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'vertical',
  maxVisible: 10,
  // ⚠️ Pour les objets/tableaux, utiliser une factory function
  items: () => [],
})
```

### Props en lecture seule — pattern immuable

```vue
<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  items: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// ❌ INTERDIT — mutation directe
// props.modelValue = 'new value'

// ✅ Émettre un événement
function updateValue(newVal: string) {
  emit('update:modelValue', newVal)
}

// ❌ INTERDIT — mutation de tableau prop
// props.items.push('new')

// ✅ Émettre une copie modifiée
function addItem(item: string) {
  emit('update:items', [...props.items, item])
}
```

---

## Emits et v-model

### v-model simple (Vue 3)

```vue
<!-- Parent -->
<template>
  <SearchInput v-model="searchQuery" />
  <!-- Équivalent à : -->
  <SearchInput :model-value="searchQuery" @update:model-value="searchQuery = $event" />
</template>
```

```vue
<!-- SearchInput.vue -->
<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Pattern avec computed writable
import { computed } from 'vue'

const model = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>

<template>
  <input v-model="model" />
</template>
```

### v-model multiples (Vue 3)

```vue
<!-- Parent -->
<template>
  <UserForm
    v-model:first-name="user.firstName"
    v-model:last-name="user.lastName"
    v-model:email="user.email"
  />
</template>
```

```vue
<!-- UserForm.vue -->
<script setup lang="ts">
const props = defineProps<{
  firstName: string
  lastName: string
  email: string
}>()

const emit = defineEmits<{
  'update:firstName': [value: string]
  'update:lastName': [value: string]
  'update:email': [value: string]
}>()
</script>

<template>
  <form>
    <input :value="firstName" @input="emit('update:firstName', ($event.target as HTMLInputElement).value)" />
    <input :value="lastName" @input="emit('update:lastName', ($event.target as HTMLInputElement).value)" />
    <input :value="email" @input="emit('update:email', ($event.target as HTMLInputElement).value)" />
  </form>
</template>
```

### defineModel (Vue 3.4+)

```vue
<!-- Raccourci simplifié pour v-model -->
<script setup lang="ts">
// Remplace defineProps + defineEmits pour v-model
const modelValue = defineModel<string>({ required: true })
const firstName = defineModel<string>('firstName')
const count = defineModel<number>('count', { default: 0 })

// Utilisation directe — lecture ET écriture
function increment() {
  count.value++  // ✅ Met à jour automatiquement le parent
}
</script>

<template>
  <input v-model="modelValue" />
</template>
```

### Emits avec validation

```vue
<script setup lang="ts">
const emit = defineEmits<{
  submit: [payload: { name: string; email: string }]
  cancel: []
  'page-change': [page: number]
}>()

// Options API — émits avec validation runtime
// emits: {
//   submit: (payload) => payload.name && payload.email,
//   cancel: null, // pas de validation
//   'page-change': (page) => typeof page === 'number' && page > 0,
// }
</script>
```

---

## Slots

### Slot par défaut

```vue
<!-- Card.vue -->
<template>
  <div class="card">
    <slot>
      <!-- Contenu par défaut si aucun slot fourni -->
      <p>Aucun contenu</p>
    </slot>
  </div>
</template>

<!-- Utilisation -->
<Card>
  <p>Mon contenu personnalisé</p>
</Card>
```

### Slots nommés

```vue
<!-- Layout.vue -->
<template>
  <div class="layout">
    <header>
      <slot name="header" />
    </header>
    <main>
      <slot />  <!-- slot par défaut -->
    </main>
    <footer>
      <slot name="footer" />
    </footer>
  </div>
</template>

<!-- Utilisation -->
<Layout>
  <template #header>
    <h1>Mon titre</h1>
  </template>

  <p>Contenu principal</p>

  <template #footer>
    <p>© 2025</p>
  </template>
</Layout>
```

### Scoped slots (slots avec données)

```vue
<!-- DataList.vue -->
<script setup lang="ts" generic="T">
import { computed } from 'vue'

const props = defineProps<{
  items: T[]
  keyField: keyof T
}>()

const isEmpty = computed(() => props.items.length === 0)
</script>

<template>
  <div class="data-list">
    <slot name="header" :count="items.length" :is-empty="isEmpty" />

    <template v-if="isEmpty">
      <slot name="empty">
        <p>Aucun élément</p>
      </slot>
    </template>

    <template v-else>
      <div v-for="(item, index) in items" :key="item[keyField]">
        <slot name="item" :item="item" :index="index" />
      </div>
    </template>

    <slot name="footer" />
  </div>
</template>

<!-- Utilisation -->
<DataList :items="users" key-field="id">
  <template #header="{ count, isEmpty }">
    <h2>Utilisateurs ({{ count }})</h2>
  </template>

  <template #item="{ item: user, index }">
    <UserCard :user="user" :rank="index + 1" />
  </template>

  <template #empty>
    <EmptyState message="Aucun utilisateur trouvé" />
  </template>
</DataList>
```

### Slots conditionnels (vérifier si un slot est fourni)

```vue
<script setup>
import { useSlots } from 'vue'

const slots = useSlots()
const hasHeader = computed(() => !!slots.header)
</script>

<template>
  <div>
    <header v-if="hasHeader" class="card-header">
      <slot name="header" />
    </header>
    <div class="card-body">
      <slot />
    </div>
  </div>
</template>
```

---

## Provide / Inject

### Typage avec InjectionKey (Vue 3 + TypeScript)

```typescript
// types/injection-keys.ts
import type { InjectionKey, Ref } from 'vue'

export interface ThemeContext {
  theme: Ref<'light' | 'dark'>
  toggleTheme: () => void
}

export const ThemeKey: InjectionKey<ThemeContext> = Symbol('theme')

export interface AuthContext {
  user: Ref<User | null>
  isAuthenticated: Ref<boolean>
  login: (credentials: Credentials) => Promise<void>
  logout: () => Promise<void>
}

export const AuthKey: InjectionKey<AuthContext> = Symbol('auth')
```

```vue
<!-- Provider parent -->
<script setup lang="ts">
import { provide, ref } from 'vue'
import { ThemeKey, type ThemeContext } from '@/types/injection-keys'

const theme = ref<'light' | 'dark'>('light')

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

provide(ThemeKey, { theme, toggleTheme })
</script>
```

```vue
<!-- Consumer enfant (n'importe quelle profondeur) -->
<script setup lang="ts">
import { inject } from 'vue'
import { ThemeKey } from '@/types/injection-keys'

// ✅ Avec valeur par défaut
const { theme, toggleTheme } = inject(ThemeKey, {
  theme: ref('light'),
  toggleTheme: () => {},
})

// ✅ Ou assertion si on sait que le provider existe
const themeCtx = inject(ThemeKey)!
</script>
```

### Provide réactif — attention aux pièges

```vue
<script setup lang="ts">
import { provide, ref, readonly } from 'vue'

const count = ref(0)

// ❌ Permet aux enfants de muter directement
provide('count', count)

// ✅ Fournir en readonly + mutateur explicite
provide('count', readonly(count))
provide('incrementCount', () => { count.value++ })

// ✅ Encore mieux — encapsuler dans un objet
provide('counter', {
  count: readonly(count),
  increment: () => { count.value++ },
  decrement: () => { count.value-- },
})
```

### Pattern Provider/Consumer avec composable

```typescript
// composables/useTheme.ts
import { inject, provide, ref, type Ref } from 'vue'

const ThemeSymbol = Symbol('theme')

interface ThemeAPI {
  theme: Ref<'light' | 'dark'>
  toggle: () => void
}

export function provideTheme(initial: 'light' | 'dark' = 'light') {
  const theme = ref(initial)
  const api: ThemeAPI = {
    theme,
    toggle: () => {
      theme.value = theme.value === 'light' ? 'dark' : 'light'
    },
  }
  provide(ThemeSymbol, api)
  return api
}

export function useTheme(): ThemeAPI {
  const api = inject<ThemeAPI>(ThemeSymbol)
  if (!api) {
    throw new Error('useTheme() requiert provideTheme() dans un composant parent')
  }
  return api
}
```

---

## Composants génériques

### Composant générique (Vue 3.3+ `<script setup>` generic)

```vue
<!-- GenericSelect.vue -->
<script setup lang="ts" generic="T extends { id: string | number; label: string }">
import { computed } from 'vue'

const props = defineProps<{
  options: T[]
  modelValue: T | null
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T | null]
}>()

const selectedLabel = computed(() => props.modelValue?.label ?? props.placeholder ?? 'Sélectionner...')
</script>

<template>
  <select @change="emit('update:modelValue', options.find(o => String(o.id) === ($event.target as HTMLSelectElement).value) ?? null)">
    <option value="" disabled :selected="!modelValue">{{ placeholder }}</option>
    <option
      v-for="option in options"
      :key="option.id"
      :value="String(option.id)"
      :selected="modelValue?.id === option.id"
    >
      {{ option.label }}
    </option>
  </select>
</template>
```

### Pattern Headless Component (logique sans UI)

```vue
<!-- MouseTracker.vue — composant headless -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const x = ref(0)
const y = ref(0)

function update(event: MouseEvent) {
  x.value = event.pageX
  y.value = event.pageY
}

onMounted(() => window.addEventListener('mousemove', update))
onUnmounted(() => window.removeEventListener('mousemove', update))
</script>

<template>
  <!-- Expose les données via scoped slot -->
  <slot :x="x" :y="y" />
</template>

<!-- Utilisation -->
<MouseTracker v-slot="{ x, y }">
  <p>Position : {{ x }}, {{ y }}</p>
</MouseTracker>
```

---

## Render functions

### Render function avec Composition API

```typescript
import { h, defineComponent, ref } from 'vue'

export default defineComponent({
  props: {
    level: {
      type: Number,
      required: true,
      validator: (v: number) => v >= 1 && v <= 6,
    },
  },
  setup(props, { slots }) {
    return () => h(
      `h${props.level}`,                    // tag
      { class: 'dynamic-heading' },          // props/attrs
      slots.default?.()                      // children
    )
  },
})
```

### Functional component (Vue 3)

```typescript
import { h, type FunctionalComponent } from 'vue'

interface IconProps {
  name: string
  size?: number
  color?: string
}

const Icon: FunctionalComponent<IconProps> = (props, { attrs }) => {
  return h('svg', {
    width: props.size ?? 24,
    height: props.size ?? 24,
    fill: props.color ?? 'currentColor',
    ...attrs,
  }, [
    h('use', { href: `#icon-${props.name}` }),
  ])
}

Icon.props = ['name', 'size', 'color']
Icon.displayName = 'Icon'

export default Icon
```

---

## Teleport et Suspense

### Teleport — rendu hors du DOM parent

```vue
<template>
  <!-- Modal rendue dans <body> au lieu du composant parent -->
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal-content">
        <slot />
        <button @click="close">Fermer</button>
      </div>
    </div>
  </Teleport>
</template>
```

### Suspense — chargement de composants async

```vue
<!-- Parent -->
<template>
  <Suspense>
    <template #default>
      <AsyncDashboard />
    </template>
    <template #fallback>
      <LoadingSpinner />
    </template>
  </Suspense>
</template>
```

```vue
<!-- AsyncDashboard.vue — composant avec setup async -->
<script setup lang="ts">
// Le await au top-level rend le composant async
const data = await fetchDashboardData()
</script>

<template>
  <div>{{ data }}</div>
</template>
```

---

## Patterns de composition

### Composant wrapper (Higher-Order Component)

```vue
<!-- WithLoading.vue -->
<script setup lang="ts">
defineProps<{
  loading: boolean
  error?: string | null
}>()
</script>

<template>
  <div>
    <div v-if="loading" class="loading-state">
      <slot name="loading">
        <p>Chargement...</p>
      </slot>
    </div>
    <div v-else-if="error" class="error-state">
      <slot name="error" :error="error">
        <p>Erreur : {{ error }}</p>
      </slot>
    </div>
    <slot v-else />
  </div>
</template>

<!-- Utilisation -->
<WithLoading :loading="isLoading" :error="error">
  <UserList :users="users" />

  <template #loading>
    <SkeletonLoader :count="5" />
  </template>
</WithLoading>
```

### Compound Component (composants liés)

```vue
<!-- Tabs.vue -->
<script setup lang="ts">
import { provide, ref, type Ref } from 'vue'

const activeTab = ref<string>('')

provide('tabs-active', activeTab)
provide('tabs-set', (id: string) => { activeTab.value = id })
</script>

<template>
  <div class="tabs" role="tablist">
    <slot />
  </div>
</template>
```

```vue
<!-- Tab.vue -->
<script setup lang="ts">
import { inject, type Ref } from 'vue'

const props = defineProps<{ id: string; label: string }>()

const active = inject<Ref<string>>('tabs-active')!
const setActive = inject<(id: string) => void>('tabs-set')!
</script>

<template>
  <div>
    <button
      role="tab"
      :aria-selected="active === id"
      @click="setActive(id)"
    >
      {{ label }}
    </button>
    <div v-show="active === id" role="tabpanel">
      <slot />
    </div>
  </div>
</template>

<!-- Utilisation -->
<Tabs>
  <Tab id="general" label="Général">
    <GeneralSettings />
  </Tab>
  <Tab id="security" label="Sécurité">
    <SecuritySettings />
  </Tab>
</Tabs>
```
