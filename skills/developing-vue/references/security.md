# Sécurité Vue.js

Guide de sécurité pour applications Vue.js : XSS, sanitization, auth guards, CSRF, CSP.

## Table des matières

1. [XSS et injection](#xss)
2. [Sanitization du contenu](#sanitization)
3. [Auth guards et navigation](#auth-guards)
4. [CSRF et requêtes API](#csrf)
5. [Content Security Policy](#csp)
6. [Bonnes pratiques générales](#bonnes-pratiques)

---

## XSS

### v-html — le danger principal

```vue
<!-- ❌ DANGEREUX — injection XSS possible -->
<div v-html="userComment" />

<!-- ❌ DANGEREUX — même avec une variable "contrôlée" -->
<div v-html="formattedContent" />  <!-- Si le contenu vient de l'utilisateur -->
```

**Règle absolue** : ne JAMAIS utiliser `v-html` avec du contenu non fiable (saisie utilisateur, données API non validées, contenu CMS non sanitisé).

```vue
<!-- ✅ SÛR — le texte est automatiquement échappé -->
<p>{{ userComment }}</p>

<!-- ✅ SÛR — v-text échappe aussi -->
<p v-text="userComment" />
```

### Quand v-html est acceptable

```vue
<script setup lang="ts">
import DOMPurify from 'dompurify'

const props = defineProps<{
  rawHtml: string  // Contenu HTML provenant d'un CMS ou API
}>()

// ✅ Sanitiser AVANT le rendu
const safeHtml = computed(() => DOMPurify.sanitize(props.rawHtml, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
}))
</script>

<template>
  <!-- ✅ v-html avec contenu sanitisé -->
  <div v-html="safeHtml" />
</template>
```

### Injections via attributs dynamiques

```vue
<!-- ❌ DANGEREUX — injection possible via :href -->
<a :href="userProvidedUrl">Lien</a>

<!-- L'utilisateur pourrait fournir : javascript:alert('xss') -->
```

```vue
<script setup lang="ts">
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // ✅ N'autoriser que http et https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '#'
    }
    return parsed.href
  } catch {
    return '#'
  }
}

const safeUrl = computed(() => sanitizeUrl(props.userUrl))
</script>

<template>
  <a :href="safeUrl" target="_blank" rel="noopener noreferrer">Lien</a>
</template>
```

### Injection via style dynamique

```vue
<!-- ❌ DANGEREUX — injection CSS -->
<div :style="userProvidedStyle" />

<!-- ✅ SÛR — valeurs contrôlées uniquement -->
<div :style="{ color: sanitizedColor, fontSize: sanitizedSize }" />
```

```typescript
// Valider les valeurs CSS
function sanitizeColor(color: string): string {
  // N'autoriser que les couleurs hexadécimales ou nommées
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color
  const safeColors = ['red', 'blue', 'green', 'black', 'white']
  return safeColors.includes(color) ? color : 'inherit'
}
```

---

## Sanitization

### DOMPurify — la référence

```typescript
// utils/sanitize.ts
import DOMPurify from 'dompurify'

// Configuration restrictive par défaut
const DEFAULT_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],  // Forcer target sur les liens
}

export function sanitizeHtml(dirty: string, config?: DOMPurify.Config): string {
  return DOMPurify.sanitize(dirty, { ...DEFAULT_CONFIG, ...config })
}

// Version stricte — texte uniquement
export function stripHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}
```

### Directive personnalisée v-safe-html

```typescript
// directives/vSafeHtml.ts
import DOMPurify from 'dompurify'
import type { Directive } from 'vue'

export const vSafeHtml: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.innerHTML = DOMPurify.sanitize(binding.value)
  },
  updated(el, binding) {
    if (binding.value !== binding.oldValue) {
      el.innerHTML = DOMPurify.sanitize(binding.value)
    }
  },
}

// main.ts
app.directive('safe-html', vSafeHtml)
```

```vue
<!-- Utilisation -->
<template>
  <div v-safe-html="userContent" />
</template>
```

---

## Auth guards

### Navigation guards Vue Router

```typescript
// router/guards.ts
import type { NavigationGuardWithThis } from 'vue-router'
import { useUserStore } from '@/stores/useUserStore'

export const requireAuth: NavigationGuardWithThis<undefined> = (to, from, next) => {
  const userStore = useUserStore()

  if (!userStore.isAuthenticated) {
    next({
      name: 'login',
      query: { redirect: to.fullPath },  // Rediriger après login
    })
  } else {
    next()
  }
}

export const requireGuest: NavigationGuardWithThis<undefined> = (to, from, next) => {
  const userStore = useUserStore()

  if (userStore.isAuthenticated) {
    next({ name: 'dashboard' })
  } else {
    next()
  }
}

export const requireRole = (roles: string[]): NavigationGuardWithThis<undefined> => {
  return (to, from, next) => {
    const userStore = useUserStore()

    if (!userStore.isAuthenticated) {
      next({ name: 'login' })
    } else if (!roles.includes(userStore.user!.role)) {
      next({ name: 'forbidden' })
    } else {
      next()
    }
  }
}
```

```typescript
// router/index.ts
const router = createRouter({
  routes: [
    {
      path: '/login',
      component: () => import('@/views/Login.vue'),
      beforeEnter: requireGuest,
    },
    {
      path: '/dashboard',
      component: () => import('@/views/Dashboard.vue'),
      beforeEnter: requireAuth,
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      component: () => import('@/views/Admin.vue'),
      beforeEnter: requireRole(['admin']),
    },
  ],
})

// Guard global — vérifier les meta
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth && !userStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})
```

### Rendu conditionnel par permission

```vue
<script setup lang="ts">
import { useUserStore } from '@/stores/useUserStore'

const userStore = useUserStore()

// Composable de permissions
function usePermissions() {
  const can = (permission: string) =>
    userStore.user?.permissions?.includes(permission) ?? false

  const hasRole = (role: string) =>
    userStore.user?.role === role

  const isOwner = (resourceUserId: number) =>
    userStore.user?.id === resourceUserId

  return { can, hasRole, isOwner }
}

const { can, hasRole, isOwner } = usePermissions()
</script>

<template>
  <div>
    <button v-if="can('create:post')" @click="createPost">
      Nouveau post
    </button>

    <button v-if="isOwner(post.authorId) || hasRole('admin')" @click="deletePost(post.id)">
      Supprimer
    </button>

    <!-- ⚠️ IMPORTANT : le contrôle frontend est purement visuel.
         L'API DOIT aussi vérifier les permissions côté serveur. -->
  </div>
</template>
```

### Directive v-permission

```typescript
// directives/vPermission.ts
import type { Directive } from 'vue'
import { useUserStore } from '@/stores/useUserStore'

export const vPermission: Directive<HTMLElement, string | string[]> = {
  mounted(el, binding) {
    const userStore = useUserStore()
    const permissions = Array.isArray(binding.value) ? binding.value : [binding.value]

    const hasPermission = permissions.some(p =>
      userStore.user?.permissions?.includes(p)
    )

    if (!hasPermission) {
      el.style.display = 'none'
      // Ou el.remove() pour supprimer complètement du DOM
    }
  },
}

// Utilisation
// <button v-permission="'delete:user'">Supprimer</button>
// <div v-permission="['edit:post', 'admin:all']">...</div>
```

---

## CSRF

### Token CSRF avec Axios

```typescript
// utils/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,  // Envoyer les cookies (session, CSRF)
})

// Lire le token CSRF depuis le cookie (pattern Django/Laravel)
api.interceptors.request.use((config) => {
  const csrfToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1]

  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
  }

  return config
})

// Intercepteur de réponse pour les erreurs auth
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expiré — rediriger vers login
      const userStore = useUserStore()
      userStore.logout()
      router.push({ name: 'login' })
    }
    return Promise.reject(error)
  }
)

export default api
```

---

## CSP

### Configuration Content Security Policy

```html
<!-- index.html ou en-tête serveur -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'nonce-{{CSP_NONCE}}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  font-src 'self';
  frame-src 'none';
  object-src 'none';
">
```

**Avec Vite** — configurer le nonce pour les scripts inline :

```typescript
// vite.config.ts
export default defineConfig({
  html: {
    cspNonce: 'placeholder',  // Remplacé par le serveur
  },
})
```

---

## Bonnes pratiques

### Checklist de sécurité

1. **v-html** : jamais avec du contenu non sanitisé. Utiliser DOMPurify
2. **URLs dynamiques** : valider le protocole (`http:` / `https:` uniquement)
3. **Styles dynamiques** : valider les valeurs, ne jamais passer un objet brut utilisateur
4. **Auth guards** : sur les routes ET côté serveur (jamais uniquement côté frontend)
5. **CSRF** : token sur toutes les mutations (POST, PUT, DELETE)
6. **Cookies** : `HttpOnly`, `Secure`, `SameSite=Strict` pour les tokens de session
7. **Variables d'environnement** : ne jamais exposer de secrets dans `VITE_*` (envoyés au client)
8. **Dépendances** : `npm audit` régulier, mise à jour des packages
9. **CSP** : configurer une Content Security Policy stricte
10. **CORS** : restreindre les origines autorisées côté serveur

### Variables d'environnement — ce qui est sûr

```bash
# .env — ✅ Variables publiques (envoyées au client)
VITE_API_URL=https://api.example.com
VITE_APP_TITLE=Mon Application
VITE_STRIPE_PUBLIC_KEY=pk_live_xxx

# ❌ NE JAMAIS mettre de secrets dans VITE_*
# VITE_API_SECRET=sk_live_xxx      ← DANGER : exposé dans le bundle
# VITE_DATABASE_URL=postgres://...  ← DANGER : exposé dans le bundle
```

### Validation des données côté client

```typescript
// ⚠️ La validation côté client est un COMPLÉMENT, pas un remplacement
// Le serveur DOIT toujours re-valider

import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().int().positive().max(150),
  website: z.string().url().optional(),
})

type User = z.infer<typeof UserSchema>

function validateUserInput(data: unknown): User {
  return UserSchema.parse(data)  // Throw si invalide
}
```
