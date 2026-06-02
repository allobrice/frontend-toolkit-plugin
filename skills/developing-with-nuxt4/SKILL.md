---
name: developing-with-nuxt4
description: Extension Nuxt 4 pour projets Vue. Utiliser quand le projet implique Nuxt 4, un dossier app/, des fichiers dans app/pages/, server/api/, app/composables/, ou nuxt.config.ts. Couvre la nouvelle structure app/, file-based routing, auto-imports, Nitro server, shared/, et conventions Nuxt 4.
---

# Nuxt 4 Skill

Extension pour projets Nuxt 4. Les patterns Vue et TypeScript sont gérés par l'agent vue-developer.

## Prérequis

- Node.js 18.20+ (LTS recommandé)
- Vue 3.4+
- TypeScript 5.x

## Structure projet Nuxt 4

```
├── app/                     # Code client (srcDir)
│   ├── app.vue              # Composant racine
│   ├── app.config.ts        # Config runtime client
│   ├── error.vue            # Page d'erreur
│   ├── assets/              # Fichiers buildés (SCSS, images)
│   ├── components/          # Auto-importés
│   ├── composables/         # Auto-importés, préfixe use*
│   ├── layouts/             # Templates de page
│   ├── middleware/          # Route guards
│   ├── pages/               # File-based routing
│   ├── plugins/             # Extensions app
│   └── utils/               # Helpers auto-importés
├── shared/                  # Code partagé client/serveur
│   ├── types/               # Types communs
│   └── utils/               # Helpers isomorphes
├── server/                  # Code serveur (Nitro)
│   ├── api/                 # API routes
│   ├── routes/              # Server routes
│   ├── middleware/          # Server middleware
│   └── utils/               # Server-only helpers
├── modules/                 # Modules Nuxt custom
├── layers/                  # Layers Nuxt
├── public/                  # Fichiers statiques
├── content/                 # Nuxt Content (si utilisé)
└── nuxt.config.ts           # Configuration
```

### Changement majeur : l'alias `~`

```typescript
// Nuxt 4 : ~ pointe vers app/ (srcDir)
import { User } from '~/types'        // → app/types
import UserCard from '~/components'   // → app/components

// Pour accéder à la racine, utiliser le chemin relatif ou configurer un alias
```

## Conventions de nommage

| Élément | Convention | Auto-import |
|---------|------------|-------------|
| `app/components/UserCard.vue` | PascalCase | `<UserCard />` |
| `app/components/base/Button.vue` | Nested | `<BaseButton />` |
| `app/composables/useAuth.ts` | camelCase + use | `useAuth()` |
| `app/utils/formatDate.ts` | camelCase | `formatDate()` |
| `shared/utils/validate.ts` | camelCase | `validate()` |
| `app/pages/users/[id].vue` | kebab-case | `/users/:id` |
| `server/api/users.get.ts` | kebab + method | `GET /api/users` |

### Nommage des composants (standardisé Nuxt 4)

```
app/components/base/Button.vue  →  <BaseButton />
app/components/ui/Card.vue      →  <UiCard />
```

Le nom du composant = chemin du dossier + nom du fichier (dédupliqué).

## Pages & Routing

```vue
<!-- app/pages/users/[id].vue -->
<script setup lang="ts">
const route = useRoute()
const id = computed(() => route.params.id as string)

// Data fetching
const { data: user, status } = await useFetch(`/api/users/${id.value}`)

// Metadata
useHead({ title: () => user.value?.name ?? 'User' })

// Page config
definePageMeta({
  middleware: 'auth',
  layout: 'dashboard'
})
</script>
```

### Routes dynamiques

| Fichier | Route | Params |
|---------|-------|--------|
| `app/pages/posts/[id].vue` | `/posts/:id` | `route.params.id` |
| `app/pages/posts/[...slug].vue` | `/posts/*` | `route.params.slug` (array) |
| `app/pages/[[optional]].vue` | `/` ou `/:optional` | optionnel |

### Route groups (Nuxt 4)

```
app/pages/
├── (marketing)/
│   ├── index.vue      → /
│   ├── about.vue      → /about
│   └── contact.vue    → /contact
└── (dashboard)/
    └── admin.vue      → /admin
```

Le groupe est ignoré dans l'URL mais disponible via `route.meta.groups`.

## Data Fetching (Nuxt 4)

### Comportement mis à jour

```typescript
// Nuxt 4 : même clé = même ref réactive partagée
const { data: users } = await useFetch('/api/users', { key: 'users' })

// Dans un autre composant avec la même clé → même instance réactive
const { data: sameUsers } = await useFetch('/api/users', { key: 'users' })
```

### useFetch vs useAsyncData

```typescript
// useFetch : appels API simples
const { data, status, error, refresh } = await useFetch('/api/users')

// useAsyncData : logique custom ou sources multiples
const { data } = await useAsyncData('user-profile', async () => {
  const [user, posts] = await Promise.all([
    $fetch(`/api/users/${id}`),
    $fetch(`/api/users/${id}/posts`)
  ])
  return { user, posts }
})
```

### Options clés

```typescript
const { data } = await useFetch('/api/users', {
  watch: [filters],
  transform: (data) => data.users,
  pick: ['id', 'name'],
  lazy: true,
  server: false,
  immediate: false,
  default: () => [],   // Nuxt 4 : si non défini → undefined
  
  // Nuxt 4 : getCachedData avec contexte
  getCachedData: (key, nuxt, ctx) => {
    // ctx indique la cause du refetch
    if (ctx.cause === 'refresh') return undefined
    return nuxt.payload.data[key]
  }
})
```

## Dossier shared/

Nouveau dans Nuxt 4 : code partagé entre client et serveur.

```typescript
// shared/types/user.ts
export interface User {
  id: string
  email: string
  name: string
}

// shared/utils/validate.ts
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Utilisable partout sans import (auto-importé)
// app/pages/register.vue
const valid = isValidEmail(form.email)

// server/api/users.post.ts
const valid = isValidEmail(body.email)
```

## Server API (Nitro)

### Endpoint basique

```typescript
// server/api/users/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID requis' })
  }
  
  return findUserById(id)
})
```

### Validation avec Zod

```typescript
// server/api/users.post.ts
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2)
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema.parse)
  return createUser(body)
})
```

### Server utils (auto-importés)

```typescript
// server/utils/db.ts
export function getDb() {
  return useDatabase()
}

// Utilisable dans tous les endpoints sans import
```

## Middleware

### Route middleware

```typescript
// app/middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const auth = useAuthStore()
  
  if (!auth.isAuthenticated) {
    return navigateTo('/login', { redirectCode: 401 })
  }
})

// app/middleware/auth.global.ts → appliqué à toutes les routes
```

### Nuxt 4 : scan des index.js dans middleware/

```
app/middleware/
├── auth/
│   └── index.ts    # Maintenant scanné automatiquement
└── guest.ts
```

## Configuration Nuxt 4

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },
  
  modules: ['@pinia/nuxt', '@nuxt/image'],
  
  runtimeConfig: {
    apiSecret: process.env.API_SECRET,
    public: {
      apiBase: process.env.API_BASE
    }
  },
  
  // Nuxt 4 : generate supprimé, utiliser nitro.prerender
  nitro: {
    prerender: {
      routes: ['/sitemap.xml'],
      ignore: ['/admin', '/private']
    }
  },
  
  typescript: {
    strict: true
  },
  
  // Styles : Nuxt 4 n'inline que les styles des composants Vue
  // Les CSS globaux ne sont plus inlinés par défaut
})
```

## Plugins (Nuxt 4)

```typescript
// app/plugins/api.ts
export default defineNuxtPlugin({
  name: 'api-plugin',
  setup(nuxtApp) {
    const api = $fetch.create({
      baseURL: '/api',
      onRequest({ options }) {
        const auth = useAuthStore()
        if (auth.token) {
          options.headers.set('Authorization', `Bearer ${auth.token}`)
        }
      }
    })

    return { provide: { api } }
  }
})

// Utilisation
const { $api } = useNuxtApp()
```

## State Management

### useState (SSR-safe)

```typescript
const counter = useState('counter', () => 0)
```

### Pinia

```typescript
// app/stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = useCookie('token')
  
  const isAuthenticated = computed(() => !!token.value)
  
  async function login(credentials: Credentials) {
    const res = await $fetch('/api/auth/login', {
      method: 'POST',
      body: credentials
    })
    user.value = res.user
    token.value = res.token
  }
  
  return { user, isAuthenticated, login }
})
```

## Migration Nuxt 3 → 4

### Codemod automatique

```bash
npx codemod@latest nuxt/4/migration-recipe
```

### Checklist manuelle

1. Créer le dossier `app/`
2. Déplacer : `assets/`, `components/`, `composables/`, `layouts/`, `middleware/`, `pages/`, `plugins/`, `utils/`, `app.vue`, `error.vue`, `app.config.ts`
3. Garder à la racine : `nuxt.config.ts`, `server/`, `public/`, `modules/`, `layers/`, `content/`
4. Créer `shared/` si besoin de code isomorphe
5. Remplacer `generate` par `nitro.prerender`
6. Mettre à jour les configs tierces (Tailwind, ESLint)

## Anti-patterns Nuxt 4

| ❌ Éviter | ✅ Préférer |
|-----------|-------------|
| Code client à la racine | Tout dans `app/` |
| `axios` / `fetch` | `$fetch` / `useFetch` |
| `onMounted` pour data | `useFetch` / `useAsyncData` |
| localStorage direct | `useCookie` / `useState` |
| Import manuel auto-imports | Laisser Nuxt gérer |
| `process.env` client | `useRuntimeConfig()` |
| `generate` config | `nitro.prerender` |
| Types dupliqués client/serveur | `shared/types/` |

## Hydration & SSR

```vue
<!-- Client-only avec fallback -->
<ClientOnly>
  <HeavyChart />
  <template #fallback>
    <Skeleton />
  </template>
</ClientOnly>
```

### Lazy hydration (Nuxt 4)

```vue
<!-- Hydrate quand visible -->
<LazyHeavyComponent hydrate-on-visible />

<!-- Hydrate au idle -->
<LazyChart hydrate-on-idle />

<!-- Ne jamais hydrater (statique) -->
<LazyStaticContent hydrate-never />
```

## Performance Nuxt 4

- Build 20-30% plus rapide (optimisations Vite)
- Edge rendering first-class (Cloudflare Workers, Vercel Edge)
- File watching optimisé (Chokidar) grâce à la structure `app/`
- Styles Vue inlinés uniquement (CSS global séparé)
