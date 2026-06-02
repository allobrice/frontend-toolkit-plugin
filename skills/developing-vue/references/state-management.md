# State Management — Pinia & Vuex

Guide complet de gestion d'état pour Vue 2.7 et Vue 3.

## Table des matières

1. [Pinia — le standard Vue 3](#pinia)
2. [Patterns Pinia avancés](#pinia-avancé)
3. [Vuex — legacy Vue 2](#vuex)
4. [Migration Vuex → Pinia](#migration)
5. [Patterns de state sans librairie](#state-simple)

---

## Pinia

### Store Setup syntax (recommandé)

```typescript
// stores/useUserStore.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const isLoading = ref(false)

  // Getters (computed)
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const fullName = computed(() =>
    user.value ? `${user.value.firstName} ${user.value.lastName}` : ''
  )

  // Actions
  async function login(credentials: { email: string; password: string }) {
    isLoading.value = true
    try {
      const response = await api.post('/auth/login', credentials)
      token.value = response.data.token
      user.value = response.data.user
      localStorage.setItem('token', response.data.token)
    } catch (error) {
      token.value = null
      user.value = null
      throw error
    } finally {
      isLoading.value = false
    }
  }

  async function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  async function fetchProfile() {
    if (!token.value) return
    user.value = await api.get('/auth/me')
  }

  return {
    // State
    user,
    token,
    isLoading,
    // Getters
    isAuthenticated,
    fullName,
    // Actions
    login,
    logout,
    fetchProfile,
  }
})
```

### Store Options syntax

```typescript
// stores/useCartStore.ts
import { defineStore } from 'pinia'

interface CartItem {
  productId: number
  name: string
  price: number
  quantity: number
}

interface CartState {
  items: CartItem[]
  couponCode: string | null
  discount: number
}

export const useCartStore = defineStore('cart', {
  state: (): CartState => ({
    items: [],
    couponCode: null,
    discount: 0,
  }),

  getters: {
    totalItems: (state) => state.items.reduce((sum, item) => sum + item.quantity, 0),

    subtotal: (state) => state.items.reduce(
      (sum, item) => sum + item.price * item.quantity, 0
    ),

    // Getter qui utilise un autre getter
    total(): number {
      return this.subtotal * (1 - this.discount)
    },

    // Getter avec paramètre
    getItemById: (state) => (productId: number) =>
      state.items.find(item => item.productId === productId),
  },

  actions: {
    addItem(product: Omit<CartItem, 'quantity'>) {
      const existing = this.items.find(i => i.productId === product.productId)
      if (existing) {
        existing.quantity++
      } else {
        this.items.push({ ...product, quantity: 1 })
      }
    },

    removeItem(productId: number) {
      const index = this.items.findIndex(i => i.productId === productId)
      if (index > -1) this.items.splice(index, 1)
    },

    async applyCoupon(code: string) {
      const { discount } = await api.post('/coupons/validate', { code })
      this.couponCode = code
      this.discount = discount
    },

    clearCart() {
      this.$reset()  // Réinitialise au state initial
    },
  },
})
```

### Utilisation dans un composant

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useCartStore } from '@/stores/useCartStore'

const cartStore = useCartStore()

// ✅ storeToRefs pour garder la réactivité des state/getters
const { items, totalItems, total } = storeToRefs(cartStore)

// ✅ Les actions se déstructurent directement (pas de réactivité)
const { addItem, removeItem, clearCart } = cartStore

// ❌ Déstructuration sans storeToRefs — perte de réactivité
// const { items, total } = cartStore  // items et total figés
</script>

<template>
  <div>
    <p>{{ totalItems }} articles — {{ total }}€</p>
    <div v-for="item in items" :key="item.productId">
      <span>{{ item.name }} x{{ item.quantity }}</span>
      <button @click="removeItem(item.productId)">Supprimer</button>
    </div>
    <button @click="clearCart">Vider le panier</button>
  </div>
</template>
```

---

## Pinia avancé

### Store composant — un store utilise un autre store

```typescript
// stores/useCheckoutStore.ts
import { defineStore } from 'pinia'
import { useCartStore } from './useCartStore'
import { useUserStore } from './useUserStore'

export const useCheckoutStore = defineStore('checkout', () => {
  const cartStore = useCartStore()
  const userStore = useUserStore()

  async function processCheckout(shippingAddress: Address) {
    if (!userStore.isAuthenticated) {
      throw new Error('Utilisateur non connecté')
    }

    const order = await api.post('/orders', {
      items: cartStore.items,
      total: cartStore.total,
      userId: userStore.user!.id,
      shippingAddress,
    })

    cartStore.clearCart()
    return order
  }

  return { processCheckout }
})
```

### Plugin Pinia — persistence

```typescript
// plugins/piniaPersistence.ts
import type { PiniaPluginContext } from 'pinia'

export function piniaPersistedState({ store }: PiniaPluginContext) {
  // Charger l'état sauvegardé
  const savedState = localStorage.getItem(`pinia-${store.$id}`)
  if (savedState) {
    store.$patch(JSON.parse(savedState))
  }

  // Sauvegarder à chaque changement
  store.$subscribe((_mutation, state) => {
    localStorage.setItem(`pinia-${store.$id}`, JSON.stringify(state))
  })
}

// main.ts
import { createPinia } from 'pinia'
import { piniaPersistedState } from './plugins/piniaPersistence'

const pinia = createPinia()
pinia.use(piniaPersistedState)
```

### $subscribe — réagir aux changements

```typescript
const cartStore = useCartStore()

// Écouter tous les changements du store
cartStore.$subscribe((mutation, state) => {
  console.log('Mutation:', mutation.type)  // 'direct' | 'patch object' | 'patch function'
  console.log('Store ID:', mutation.storeId)

  // Sauvegarder dans localStorage
  localStorage.setItem('cart', JSON.stringify(state.items))
}, {
  detached: true,  // Survit au démontage du composant
})
```

### $onAction — intercepter les actions

```typescript
const userStore = useUserStore()

// Logger toutes les actions
const unsubscribe = userStore.$onAction(({ name, args, after, onError }) => {
  const start = Date.now()
  console.log(`[${name}] démarrée avec args:`, args)

  after((result) => {
    console.log(`[${name}] terminée en ${Date.now() - start}ms`)
  })

  onError((error) => {
    console.error(`[${name}] échouée:`, error)
  })
})

// Plus tard : arrêter l'écoute
unsubscribe()
```

---

## Vuex

### Store Vuex typé (Vue 2.7 / Vue 3 legacy)

```typescript
// store/index.ts
import { createStore } from 'vuex'

interface RootState {
  user: User | null
  notifications: Notification[]
}

export default createStore<RootState>({
  state: {
    user: null,
    notifications: [],
  },

  getters: {
    isAuthenticated: (state) => !!state.user,
    unreadCount: (state) => state.notifications.filter(n => !n.read).length,
  },

  mutations: {
    SET_USER(state, user: User | null) {
      state.user = user
    },
    ADD_NOTIFICATION(state, notification: Notification) {
      state.notifications.push(notification)
    },
    MARK_READ(state, id: string) {
      const notif = state.notifications.find(n => n.id === id)
      if (notif) notif.read = true
    },
  },

  actions: {
    async login({ commit }, credentials: Credentials) {
      const { user, token } = await api.post('/auth/login', credentials)
      commit('SET_USER', user)
      return { user, token }
    },

    async fetchNotifications({ commit }) {
      const notifications = await api.get('/notifications')
      notifications.forEach((n: Notification) => commit('ADD_NOTIFICATION', n))
    },
  },

  modules: {
    // Modules Vuex pour le découpage
  },
})
```

### Vuex avec Composition API (Vue 2.7+)

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'

const store = useStore()

const user = computed(() => store.state.user)
const isAuthenticated = computed(() => store.getters.isAuthenticated)

function login(credentials: Credentials) {
  return store.dispatch('login', credentials)
}
</script>
```

---

## Migration

### Vuex → Pinia — stratégie progressive

```
1. Installer Pinia à côté de Vuex
2. Créer les nouveaux stores en Pinia
3. Migrer composant par composant
4. Supprimer les modules Vuex migrés
5. Supprimer Vuex quand tout est migré
```

**Correspondances :**

| Vuex | Pinia |
|------|-------|
| `state` | `state` ou `ref()` |
| `getters` | `getters` ou `computed()` |
| `mutations` | _(supprimées)_ — modif directe du state |
| `actions` | `actions` ou fonctions |
| `modules` | Stores séparés |
| `commit('MUTATION')` | `store.property = value` |
| `dispatch('action')` | `store.action()` |
| `mapState`, `mapGetters` | `storeToRefs(store)` |

---

## State simple

### Composable avec state partagé (sans librairie)

```typescript
// composables/useSharedCounter.ts
import { ref, readonly } from 'vue'

// State défini HORS du composable = partagé entre tous les composants
const count = ref(0)

export function useSharedCounter() {
  function increment() { count.value++ }
  function decrement() { count.value-- }
  function reset() { count.value = 0 }

  return {
    count: readonly(count),  // ✅ Lecture seule pour les consommateurs
    increment,
    decrement,
    reset,
  }
}
```

### Quand utiliser quoi

```
State local → ref() / reactive()
  ↓ Besoin de partager entre composants ?
State partagé parent/enfant → props + emit
  ↓ Plus de 2 niveaux de profondeur ?
State partagé via provide/inject → composable provider
  ↓ Besoin de state global avec devtools, SSR, persistence ?
Pinia → store dédié
```
