# Nuxt 4 — Patterns d'Implémentation SEO

> Ce fichier est lu par le skill `auditing-seo` lors de la phase d'implémentation des correctifs.
> Pour l'implémentation du code, déléguer au skill `developing-vue` + `developing-with-nuxt4`.

## Table des matières
1. [useSeoMeta & useHead](#1-usoseometa--usehead)
2. [Sitemap](#2-sitemap--nuxtjssitemap)
3. [Robots.txt](#3-robotstxt--nuxtjsrobots)
4. [Données structurées JSON-LD](#4-données-structurées-json-ld)
5. [Images optimisées](#5-images--nuxtimage)
6. [Performance SSR](#6-performance-ssr)
7. [Open Graph dynamique](#7-open-graph-dynamique)
8. [Breadcrumbs](#8-breadcrumbs)
9. [Redirections Nitro](#9-redirections-nitro)
10. [i18n SEO](#10-i18n--hreflang)

---

## 1. useSeoMeta & useHead

### Pattern de base — page statique
```vue
<!-- app/pages/[slug].vue -->
<script setup lang="ts">
// Préférer useSeoMeta à useHead pour les meta SEO
useSeoMeta({
  title: 'Titre de la page – Nom du site',
  description: 'Description concise entre 120 et 158 caractères, incluant le mot-clé principal.',
  ogTitle: 'Titre Open Graph (peut différer)',
  ogDescription: 'Description OG optimisée pour le partage social.',
  ogImage: 'https://example.com/og-image.jpg',
  ogUrl: 'https://example.com/ma-page',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  robots: 'index, follow',
})
</script>
```

### Pattern dynamique — page de contenu
```vue
<!-- app/pages/articles/[slug].vue -->
<script setup lang="ts">
const route = useRoute()
const { data: article } = await useFetch(`/api/articles/${route.params.slug}`)

// Redirection 404 si contenu introuvable
if (!article.value) {
  throw createError({ statusCode: 404, statusMessage: 'Article non trouvé' })
}

useSeoMeta({
  title: () => `${article.value?.title} – Mon Blog`,
  description: () => article.value?.excerpt,
  ogTitle: () => article.value?.title,
  ogImage: () => article.value?.coverImage,
  articlePublishedTime: () => article.value?.publishedAt,
  articleModifiedTime: () => article.value?.updatedAt,
})

// Canonical auto-géré par Nuxt si l'URL est correcte
// Forcer si nécessaire :
useHead({
  link: [
    { rel: 'canonical', href: `https://example.com/articles/${route.params.slug}` }
  ]
})
</script>
```

### Pattern title template global
```ts
// app/app.vue
useHead({
  titleTemplate: (title) => title ? `${title} – Nom du site` : 'Nom du site',
  htmlAttrs: { lang: 'fr' },
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ]
})
```

---

## 2. Sitemap — @nuxtjs/sitemap

### Installation
```bash
npx nuxi module add sitemap
```

### Configuration nuxt.config.ts
```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/sitemap'],
  
  sitemap: {
    // Routes statiques auto-détectées depuis app/pages/
    // Routes dynamiques à déclarer :
    sources: [
      '/api/__sitemap__/urls',  // endpoint API custom
    ],
    defaults: {
      changefreq: 'weekly',
      priority: 0.8,
      lastmod: new Date().toISOString(),
    },
    // Exclusions
    exclude: [
      '/admin/**',
      '/auth/**',
    ],
  },
})
```

### Endpoint API pour URLs dynamiques
```ts
// server/api/__sitemap__/urls.ts
export default defineEventHandler(async () => {
  // Récupérer les slugs depuis la DB/CMS
  const articles = await $fetch('/api/articles?fields=slug,updatedAt')
  
  return articles.map((article) => ({
    loc: `/articles/${article.slug}`,
    lastmod: article.updatedAt,
    changefreq: 'monthly',
    priority: 0.6,
  }))
})
```

---

## 3. Robots.txt — @nuxtjs/robots

### Installation
```bash
npx nuxi module add robots
```

### Configuration
```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/robots'],
  
  robots: {
    // Règles globales
    rules: [
      { UserAgent: '*' },
      { Allow: '/' },
      { Disallow: '/admin' },
      { Disallow: '/auth' },
      // Sitemap auto-ajouté si @nuxtjs/sitemap est installé
    ],
    // Désactiver en développement
    enabled: process.env.NODE_ENV === 'production',
  },
})
```

---

## 4. Données Structurées JSON-LD

### Composable useSchemaOrg (pattern recommandé)
```ts
// app/composables/useSchemaOrg.ts
export function useOrganizationSchema() {
  useHead({
    script: [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': 'https://example.com/#organization',
        name: 'Nom de l\'entreprise',
        url: 'https://example.com',
        logo: {
          '@type': 'ImageObject',
          url: 'https://example.com/logo.png',
          width: 200,
          height: 60,
        },
        sameAs: [
          'https://www.linkedin.com/company/...',
          'https://twitter.com/...',
        ],
      }),
    }],
  })
}

export function useArticleSchema(article: {
  title: string
  description: string
  publishedAt: string
  updatedAt: string
  image: string
  slug: string
}) {
  useHead({
    script: [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': `https://example.com/articles/${article.slug}#article`,
        headline: article.title,
        description: article.description,
        image: article.image,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        publisher: {
          '@id': 'https://example.com/#organization',
        },
      }),
    }],
  })
}

export function useBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  useHead({
    script: [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }),
    }],
  })
}
```

---

## 5. Images — @nuxt/image

### Installation
```bash
npx nuxi module add image
```

### Utilisation — Remplacement des `<img>`
```vue
<template>
  <!-- AVANT (non optimisé) -->
  <!-- <img src="/hero.jpg" alt="Hero" width="1200" height="600"> -->

  <!-- APRÈS (optimisé SEO + performance) -->
  <NuxtImg
    src="/hero.jpg"
    alt="Description précise de l'image pour l'accessibilité et le SEO"
    width="1200"
    height="600"
    format="webp"
    quality="85"
    loading="eager"  <!-- eager pour le LCP, lazy pour le reste -->
    :preload="isLCPImage"
    sizes="sm:100vw md:50vw lg:1200px"
  />
</template>
```

### Configuration
```ts
// nuxt.config.ts
export default defineNuxtConfig({
  image: {
    quality: 85,
    format: ['webp', 'avif'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
})
```

---

## 6. Performance SSR

### Preload du LCP
```vue
<!-- app/app.vue ou layout -->
<script setup>
useHead({
  link: [
    // Preload de la police principale
    { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/main.woff2', crossorigin: '' },
    // Preload de l'image LCP (si connue à l'avance)
    { rel: 'preload', as: 'image', href: '/hero.webp' },
    // Preconnect aux origines tierces
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'dns-prefetch', href: 'https://cdn.example.com' },
  ],
})
</script>
```

### Route prefetching intelligent
```vue
<!-- Désactiver le prefetch agressif si coûteux -->
<NuxtLink :prefetch="false" to="/heavy-page">Lien</NuxtLink>
<!-- Prefetch au hover uniquement -->
<NuxtLink prefetch-on="interaction" to="/page">Lien</NuxtLink>
```

### Server-side caching (Nitro)
```ts
// server/api/articles/[slug].ts
export default defineCachedEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const article = await fetchArticle(slug)
  return article
}, {
  maxAge: 60 * 60, // 1 heure
  name: 'article',
  getKey: (event) => getRouterParam(event, 'slug') ?? '',
})
```

---

## 7. Open Graph dynamique

### Image OG dynamique (Nuxt Image API)
```ts
// server/routes/og/[...slug].ts
// Génération d'images OG dynamiques
import { createCanvas } from '@napi-rs/canvas'

export default defineEventHandler(async (event) => {
  // Pattern simplifié - utiliser une lib comme Satori pour du vrai rendu
  const canvas = createCanvas(1200, 630)
  const ctx = canvas.getContext('2d')
  // ... dessiner l'image
  setResponseHeader(event, 'Content-Type', 'image/png')
  return canvas.toBuffer('image/png')
})
```

---

## 8. Breadcrumbs

### Composant Breadcrumb avec Schema
```vue
<!-- app/components/AppBreadcrumb.vue -->
<script setup lang="ts">
interface BreadcrumbItem {
  label: string
  to?: string
}

const props = defineProps<{
  items: BreadcrumbItem[]
}>()

const baseUrl = 'https://example.com'

// Schema.org BreadcrumbList
useHead({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: props.items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.label,
        ...(item.to ? { item: `${baseUrl}${item.to}` } : {}),
      })),
    }),
  }],
})
</script>

<template>
  <nav aria-label="Fil d'Ariane">
    <ol itemscope itemtype="https://schema.org/BreadcrumbList">
      <li
        v-for="(item, i) in items"
        :key="i"
        itemprop="itemListElement"
        itemscope
        itemtype="https://schema.org/ListItem"
      >
        <NuxtLink v-if="item.to" :to="item.to" itemprop="item">
          <span itemprop="name">{{ item.label }}</span>
        </NuxtLink>
        <span v-else itemprop="name">{{ item.label }}</span>
        <meta itemprop="position" :content="String(i + 1)" />
      </li>
    </ol>
  </nav>
</template>
```

---

## 9. Redirections Nitro

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    // Redirection 301 permanente
    '/ancienne-url': { redirect: { to: '/nouvelle-url', statusCode: 301 } },
    // Page statique (SSG)
    '/a-propos': { prerender: true },
    // ISR — revalidation toutes les heures
    '/blog/**': { isr: 3600 },
    // SWR — cache avec revalidation
    '/api/articles': { swr: 300 },
    // Noindex programmatique
    '/admin/**': { robots: 'noindex' },
    // Headers custom
    '/assets/**': {
      headers: { 'cache-control': 'max-age=31536000, immutable' }
    },
  },
})
```

---

## 10. i18n & hreflang

### Avec @nuxtjs/i18n
```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/i18n'],
  i18n: {
    locales: [
      { code: 'fr', iso: 'fr-FR', file: 'fr.json' },
      { code: 'en', iso: 'en-US', file: 'en.json' },
    ],
    defaultLocale: 'fr',
    strategy: 'prefix_except_default',
    // hreflang auto-générés par le module
    seo: true,
  },
})
```

### hreflang manuel si pas de module i18n
```ts
// app/composables/useHreflang.ts
export function useHreflang(slug: string) {
  useHead({
    link: [
      { rel: 'alternate', hreflang: 'fr', href: `https://example.com/fr/${slug}` },
      { rel: 'alternate', hreflang: 'en', href: `https://example.com/en/${slug}` },
      { rel: 'alternate', hreflang: 'x-default', href: `https://example.com/${slug}` },
    ],
  })
}
```

---

## Modules SEO recommandés pour Nuxt 4

| Module | Usage | Installation |
|--------|-------|--------------|
| `@nuxtjs/sitemap` | Sitemap auto | `npx nuxi module add sitemap` |
| `@nuxtjs/robots` | robots.txt | `npx nuxi module add robots` |
| `@nuxt/image` | Optimisation images | `npx nuxi module add image` |
| `@nuxtjs/i18n` | SEO multilingue | `npx nuxi module add i18n` |
| `nuxt-schema-org` | Schema.org simplifié | `npx nuxi module add schema-org` |
| `@nuxtjs/og-image` | Images OG dynamiques | `npx nuxi module add og-image` |

## Checklist rapide Nuxt SEO

- [ ] `useSeoMeta()` sur toutes les pages
- [ ] `titleTemplate` défini dans `app.vue`
- [ ] `htmlAttrs: { lang: 'fr' }` dans `app.vue`
- [ ] `@nuxtjs/sitemap` configuré avec routes dynamiques
- [ ] `@nuxtjs/robots` configuré (désactivé en dev)
- [ ] `@nuxt/image` utilisé pour toutes les `<img>`
- [ ] JSON-LD présent sur les pages importantes
- [ ] `routeRules` pour les redirections et headers
- [ ] Canonical auto ou explicite sur les pages dupliquées
- [ ] Vérification HTML brut (curl) sans JS
