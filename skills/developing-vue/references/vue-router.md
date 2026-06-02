# Vue Router — Patterns et bonnes pratiques

Guide pour Vue Router 4 (Vue 3) et Vue Router 3 (Vue 2).

## Table des matières

1. [Configuration de base](#configuration)
2. [Navigation guards](#guards)
3. [Lazy loading des routes](#lazy-loading)
4. [Routes dynamiques et params](#routes-dynamiques)
5. [Meta et middleware](#meta)
6. [Transitions et scroll](#transitions)
7. [Patterns avancés](#patterns-avancés)

---

## Configuration

### Setup Vue Router 4 (Vue 3)

```typescript
// router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('@/views/Users.vue'),
    children: [
      {
        path: ':id',
        name: 'user-detail',
        component: () => import('@/views/UserDetail.vue'),
        props: true,  // ✅ Passe params comme props
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
})

export default router
```

### Composable useRouter / useRoute

```vue
<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

// Accès aux params
const userId = computed(() => route.params.id as string)

// Navigation programmatique
async function goToUser(id: number) {
  await router.push({ name: 'user-detail', params: { id } })
}

function goBack() {
  router.back()
}
</script>
```

---

## Guards

### Guard global — exemple complet

```typescript
// router/guards/authGuard.ts
import type { Router } from 'vue-router'
import { useUserStore } from '@/stores/useUserStore'

export function setupAuthGuard(router: Router) {
  router.beforeEach(async (to, from) => {
    const userStore = useUserStore()

    // Routes publiques — pas de vérification
    if (to.meta.public) return true

    // Vérifier l'authentification
    if (!userStore.isAuthenticated) {
      // Tenter de restaurer la session
      try {
        await userStore.fetchProfile()
      } catch {
        return {
          name: 'login',
          query: { redirect: to.fullPath },
        }
      }
    }

    // Vérifier les rôles requis
    const requiredRoles = to.meta.roles as string[] | undefined
    if (requiredRoles && !requiredRoles.includes(userStore.user!.role)) {
      return { name: 'forbidden' }
    }

    return true
  })
}
```

### Guard par route — beforeEnter

```typescript
const routes: RouteRecordRaw[] = [
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    beforeEnter: (to, from) => {
      const userStore = useUserStore()
      if (userStore.user?.role !== 'admin') {
        return { name: 'forbidden' }
      }
    },
    children: [
      // Tous les enfants héritent du guard parent
      { path: 'users', component: () => import('@/views/admin/Users.vue') },
      { path: 'settings', component: () => import('@/views/admin/Settings.vue') },
    ],
  },
]
```

### Guard dans le composant

```vue
<script setup lang="ts">
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

const hasUnsavedChanges = ref(false)

// Demander confirmation avant de quitter
onBeforeRouteLeave((to, from) => {
  if (hasUnsavedChanges.value) {
    const answer = window.confirm('Modifications non sauvegardées. Quitter ?')
    if (!answer) return false
  }
})

// Réagir au changement de params (même route, param différent)
onBeforeRouteUpdate(async (to, from) => {
  if (to.params.id !== from.params.id) {
    await loadUser(to.params.id as string)
  }
})
</script>
```

---

## Lazy loading

### Grouper les chunks par feature

```typescript
const routes: RouteRecordRaw[] = [
  {
    path: '/dashboard',
    component: () => import(/* webpackChunkName: "dashboard" */ '@/views/Dashboard.vue'),
    children: [
      {
        path: 'analytics',
        component: () => import(/* webpackChunkName: "dashboard" */ '@/views/Analytics.vue'),
      },
      {
        path: 'reports',
        component: () => import(/* webpackChunkName: "dashboard" */ '@/views/Reports.vue'),
      },
    ],
  },
]
```

### Prefetch conditionnel

```typescript
// Précharger la prochaine route probable
router.afterEach((to) => {
  if (to.name === 'user-list') {
    // L'utilisateur va probablement cliquer sur un utilisateur
    import('@/views/UserDetail.vue')
  }
})
```

---

## Routes dynamiques

### Props depuis les params

```typescript
const routes: RouteRecordRaw[] = [
  {
    path: '/users/:id',
    component: () => import('@/views/UserDetail.vue'),
    props: true,  // ✅ route.params.id → prop id
  },
  {
    path: '/search',
    component: () => import('@/views/Search.vue'),
    props: (route) => ({
      query: route.query.q,
      page: Number(route.query.page) || 1,
    }),
  },
]
```

```vue
<!-- UserDetail.vue -->
<script setup lang="ts">
// ✅ Reçu comme prop au lieu d'utiliser useRoute()
const props = defineProps<{
  id: string
}>()
</script>
```

---

## Meta

### Typage des meta routes

```typescript
// router/types.ts
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: string[]
    title?: string
    public?: boolean
    layout?: 'default' | 'admin' | 'auth'
  }
}
```

```typescript
// Utilisation
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/views/Login.vue'),
    meta: {
      public: true,
      title: 'Connexion',
      layout: 'auth',
    },
  },
  {
    path: '/admin',
    component: () => import('@/views/Admin.vue'),
    meta: {
      requiresAuth: true,
      roles: ['admin'],
      title: 'Administration',
      layout: 'admin',
    },
  },
]
```

### Mise à jour du titre de page

```typescript
router.afterEach((to) => {
  const title = to.meta.title
  document.title = title ? `${title} — Mon App` : 'Mon App'
})
```

---

## Transitions

### Transitions de route

```vue
<!-- App.vue ou Layout.vue -->
<template>
  <RouterView v-slot="{ Component, route }">
    <Transition :name="route.meta.transition || 'fade'" mode="out-in">
      <component :is="Component" :key="route.path" />
    </Transition>
  </RouterView>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

---

## Patterns avancés

### Layout dynamique basé sur la meta

```vue
<!-- App.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from '@/layouts/Default.vue'
import AdminLayout from '@/layouts/Admin.vue'
import AuthLayout from '@/layouts/Auth.vue'

const route = useRoute()

const layouts = {
  default: DefaultLayout,
  admin: AdminLayout,
  auth: AuthLayout,
} as const

const currentLayout = computed(() =>
  layouts[route.meta.layout ?? 'default']
)
</script>

<template>
  <component :is="currentLayout">
    <RouterView />
  </component>
</template>
```

### Breadcrumbs automatiques

```typescript
// composables/useBreadcrumbs.ts
import { computed } from 'vue'
import { useRoute, type RouteLocationMatched } from 'vue-router'

interface Breadcrumb {
  label: string
  to?: string
}

export function useBreadcrumbs() {
  const route = useRoute()

  const breadcrumbs = computed<Breadcrumb[]>(() =>
    route.matched
      .filter(record => record.meta.title)
      .map((record, index, arr) => ({
        label: record.meta.title as string,
        to: index < arr.length - 1 ? record.path : undefined,
      }))
  )

  return { breadcrumbs }
}
```
