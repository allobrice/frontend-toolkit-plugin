# Vue / Nuxt — Patterns & Anti-patterns Perf

Ce fichier couvre les spécificités perf des stacks **Vue 2.7, Vue 3, Nuxt 3 et Nuxt 4**.
Chaque pattern indique le problème, la métrique Core Web Vital impactée, le fix et la sévérité.

> **Charge** : ne consulte ce fichier que si la stack détectée est Vue/Nuxt
> (présence de `nuxt.config`, `package.json` avec `vue`/`nuxt`, fichiers `.vue`).
> Pour React/Next, voir `frameworks/react-next.md`.

---

## 1. Hydration

L'hydration est **le** point le plus critique en SSR. Un mauvais pattern ici dégrade INP, TBT et parfois LCP.

### 1.1 Hydration mismatch silencieux

❌ **Problème** : contenu différent SSR vs CSR (date locale, random, `window`, `Date.now()`)

```vue
<!-- Mauvais : `Date.now()` génère une valeur différente côté serveur et client -->
<template>
  <div>Connecté il y a {{ Date.now() - lastSeen }}ms</div>
</template>
```

**Impact** : Vue ré-hydrate le node entier → CLS + INP dégradé + warning console
**Métriques** : CLS (P0), INP (P1)
**Fix** : isoler la valeur côté client uniquement

```vue
<!-- Vue 3 / Nuxt 3+ -->
<template>
  <div>Connecté il y a <ClientOnly>{{ elapsed }}</ClientOnly>ms</div>
</template>

<!-- ou avec onMounted pour éviter le flash -->
<script setup lang="ts">
const elapsed = ref<number | null>(null)
onMounted(() => { elapsed.value = Date.now() - lastSeen })
</script>
```

**Sévérité** : 🔴 P0 si above-the-fold

### 1.2 Hydration synchrone d'un grand arbre

❌ **Problème** : tout le payload SSR est hydraté en une seule passe synchrone, bloquant le main thread.
**Métriques** : TBT (P0), INP (P1), LCP indirect

✅ **Fix Nuxt 3.12+ / Nuxt 4 : Lazy Hydration**

```vue
<template>
  <!-- Hydratation différée jusqu'à ce que le composant soit visible -->
  <LazyMyHeavyComponent hydrate-on-visible />

  <!-- Hydratation au premier idle -->
  <LazyMyChartComponent hydrate-on-idle />

  <!-- Hydratation à la première interaction -->
  <LazyMyModal hydrate-on-interaction="click" />
</template>
```

**Sévérité** : 🟠 P1 sur composants lourds (charts, video players, tableaux)

### 1.3 `<ClientOnly>` en abus

❌ **Problème** : envelopper trop de composants dans `<ClientOnly>` tue le bénéfice du SSR.
- Le HTML initial est vide → LCP catastrophique
- Le composant se monte côté client uniquement → FCP retardé

✅ **Fix** : utiliser `<ClientOnly>` UNIQUEMENT pour les composants qui :
- Dépendent de `window`/`document` au mount
- Affichent du contenu personnalisé (timezone, A/B test client-side)

Pour le reste, accepter l'hydration ou utiliser un Server Component.

**Sévérité** : 🔴 P0 si appliqué above-the-fold

---

## 2. Réactivité Vue 3

### 2.1 `reactive()` sur de gros objets / arrays

❌ **Problème** : `reactive()` crée un Proxy sur chaque propriété récursivement. Sur un array de 1000+ items, le coût est massif (mount + chaque update).

```ts
// Mauvais : un Proxy par item, par propriété
const items = reactive(largeArrayOf1000Products)
```

✅ **Fix** : `shallowRef` / `shallowReactive` quand la réactivité profonde n'est pas nécessaire

```ts
// Bon : un seul Proxy au niveau racine
const items = shallowRef(largeArrayOf1000Products)
// Pour update : remplacer la référence
items.value = [...items.value, newItem]
```

**Métriques** : INP (P0 sur listes), TBT
**Sévérité** : 🔴 P0 pour listes >100 items, 🟠 P1 entre 50-100

### 2.2 `watch` avec `deep: true` sur gros objets

❌ **Problème** : `deep` parcourt récursivement à chaque check → très coûteux.

```ts
watch(bigState, () => { ... }, { deep: true })  // ❌
```

✅ **Fix** : watcher ciblé sur les propriétés qui changent réellement

```ts
watch(() => bigState.value.specificField, () => { ... })
```

**Sévérité** : 🟠 P1

### 2.3 `computed` sans dépendances stables

❌ **Problème** : computed qui dépend d'un objet recréé à chaque render → recalcul systématique.

```ts
// Mauvais : `filters` est recréé → computed recalculé à chaque render
const filtered = computed(() => items.value.filter(i => filters.includes(i.tag)))
```

✅ **Fix** : isoler les dépendances en refs stables, ou utiliser `markRaw` pour les valeurs non réactives.

**Sévérité** : 🟡 P2

### 2.4 `v-for` sans `:key` ou avec `index`

❌ **Problème** : Vue ne peut pas réutiliser les nodes → recreation complète à chaque mutation.

```vue
<div v-for="(item, i) in items" :key="i">  <!-- ❌ index instable -->
```

✅ **Fix** : clé stable et unique (id métier)

```vue
<div v-for="item in items" :key="item.id">  <!-- ✅ -->
```

**Métriques** : INP (P1)
**Sévérité** : 🟠 P1 sur listes >50 items

### 2.5 `v-memo` pour cache de sub-trees

✅ **Pattern** : sur des items de liste rarement modifiés, `v-memo` évite le re-render.

```vue
<div v-for="item in items" :key="item.id" v-memo="[item.id, item.updatedAt]">
  <ExpensiveCard :item="item" />
</div>
```

**Sévérité** : 🟢 P3 (gain marginal mais utile sur listes lourdes)

---

## 3. Composants async & code splitting

### 3.1 `defineAsyncComponent` sans loading state

❌ **Problème** : composant async sans skeleton → CLS quand il apparaît.

```ts
const Modal = defineAsyncComponent(() => import('./Modal.vue'))  // ❌
```

✅ **Fix** : loading + error + delay

```ts
const Modal = defineAsyncComponent({
  loader: () => import('./Modal.vue'),
  loadingComponent: ModalSkeleton,  // ✅ skeleton dimensionné
  errorComponent: ModalError,
  delay: 200,
  timeout: 3000,
})
```

**Métriques** : CLS (P1)

### 3.2 Composant lourd au-dessus du fold non lazy

❌ **Problème** : tout est dans le bundle initial, retarde l'hydration.
✅ **Fix Nuxt** : préfixe `Lazy` sur l'import

```vue
<template>
  <!-- Charge le code uniquement à l'usage -->
  <LazyMyChart v-if="showChart" />
</template>
```

**Sévérité** : 🟠 P1

---

## 4. Data fetching (Nuxt 3/4)

### 4.1 `useFetch` sans `lazy: true` sur données non critiques

❌ **Problème** : `useFetch` bloque la navigation par défaut → TTFB perçu dégradé.

```ts
// Mauvais : bloque la navigation tant que la requête n'est pas finie
const { data } = await useFetch('/api/recommendations')
```

✅ **Fix** : `lazy: true` pour les données non critiques au render initial

```ts
const { data, pending } = await useFetch('/api/recommendations', { lazy: true })
```

**Métriques** : LCP (P1), TTFB perçu
**Sévérité** : 🟠 P1

### 4.2 Pas de `key` sur `useAsyncData` → cache miss

❌ **Problème** : sans key explicite, Nuxt utilise le filename + ligne. Si l'appel est dans un composant réutilisé, cache miss à chaque mount.

✅ **Fix** : key stable

```ts
const { data } = await useAsyncData(
  `product-${id.value}`,  // ✅ key stable et unique
  () => $fetch(`/api/products/${id.value}`),
  { watch: [id] }
)
```

**Sévérité** : 🟠 P1

### 4.3 `$fetch` côté serveur qui fait un appel HTTP au lieu d'appeler l'API directement

❌ **Problème** : `$fetch('/api/foo')` côté serveur fait un round-trip HTTP local au lieu d'appeler la fonction directement → +50-200ms de TTFB.

✅ **Fix** : utiliser les Nitro `defineEventHandler` exports directement, ou passer par les "server utils".

**Sévérité** : 🟠 P1 si critique au LCP

### 4.4 Pas de `transform` pour réduire le payload

❌ **Problème** : récupérer 50 champs alors qu'on n'en affiche que 5 → HTML plus gros, hydration plus lente.

✅ **Fix** :

```ts
const { data } = await useFetch('/api/products', {
  transform: (products) => products.map(p => ({ id: p.id, name: p.name, price: p.price }))
})
```

**Sévérité** : 🟡 P2 (mais 🟠 P1 sur listes longues)

---

## 5. Routing & navigation (Nuxt)

### 5.1 `<NuxtLink>` sans contrôle du prefetch

❌ **Problème** : `<NuxtLink>` prefetch tous les liens visibles par défaut → bande passante gaspillée + bundle pollué.

✅ **Fix** : désactiver sur les liens rares (footer, mentions légales, liens externes vers admin)

```vue
<NuxtLink to="/legal/cgv" :prefetch="false">CGV</NuxtLink>
```

✅ **Fix Nuxt 4** : config globale via `nuxt.config`

```ts
export default defineNuxtConfig({
  experimental: {
    defaults: {
      nuxtLink: { prefetch: false }  // opt-in plutôt qu'opt-out
    }
  }
})
```

**Sévérité** : 🟡 P2

### 5.2 Pas de `routeRules` (pas de cache edge)

❌ **Problème** : chaque requête tape le serveur, alors que des pages sont statiques ou semi-dynamiques.

✅ **Fix** : routeRules dans `nuxt.config`

```ts
export default defineNuxtConfig({
  routeRules: {
    '/': { isr: 60 },                          // ISR 60s (revalidation)
    '/blog/**': { swr: 3600 },                 // SWR 1h
    '/admin/**': { ssr: false },               // SPA pour l'admin
    '/api/static/**': { cache: { maxAge: 300 } },  // cache API
    '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  }
})
```

**Métriques** : TTFB (P0), LCP
**Sévérité** : 🔴 P0 sur pages à fort trafic non personnalisées

---

## 6. Images (Nuxt)

### 6.1 `<img>` natif au lieu de `<NuxtImg>` / `<NuxtPicture>`

❌ **Problème** : pas de génération AVIF/WebP, pas de `srcset`, pas de redimensionnement → LCP dégradé sur mobile.

✅ **Fix** : utiliser `@nuxt/image`

```vue
<!-- LCP image, above-the-fold -->
<NuxtImg
  src="/hero.jpg"
  width="1200"
  height="600"
  format="webp,avif"
  fetchpriority="high"
  preload
  sizes="sm:100vw md:50vw lg:1200px"
/>

<!-- Image lazy below-the-fold -->
<NuxtImg src="/feature.jpg" loading="lazy" :width="400" :height="300" />
```

**Métriques** : LCP (P0), CLS (P0 si pas de width/height)
**Sévérité** : 🔴 P0 sur image LCP

### 6.2 Pas de `width`/`height` sur images dynamiques

❌ **Problème** : navigateur ne réserve pas l'espace → CLS.
✅ **Fix** : toujours fournir width/height (ou aspect-ratio CSS)

**Sévérité** : 🔴 P0

---

## 7. Server Components & Islands (Nuxt 3.9+ / Nuxt 4)

### 7.1 Composant statique non server-only

❌ **Problème** : un footer statique est hydraté inutilement → TBT inutile.
✅ **Fix Nuxt 3.9+** : suffix `.server.vue`

```
components/
  AppFooter.server.vue   ← rendu serveur uniquement, zéro JS client
  ProductCard.vue         ← composant standard hydraté
```

**Métriques** : TBT (P1), bundle size
**Sévérité** : 🟠 P1 sur composants statiques lourds

### 7.2 Islands architecture pas activée pour pages mixtes

✅ **Pattern Nuxt 4** : `experimental.componentIslands: true` permet d'avoir des îlots interactifs dans une page majoritairement statique.

```vue
<template>
  <article>
    <!-- Tout est statique sauf ce widget -->
    <h1>Article statique</h1>
    <p>Contenu statique...</p>
    <NuxtIsland name="LikeButton" :props="{ articleId }" />
  </article>
</template>
```

**Sévérité** : 🟡 P2 (gain significatif sur sites contenu)

---

## 8. Configuration Nuxt critique

### 8.1 `payloadExtraction` désactivé

❌ **Problème** : payload SSR injecté dans le HTML → HTML plus gros, FCP/LCP dégradés sur grandes pages.
✅ **Fix Nuxt 3+** : `payloadExtraction: true` (défaut depuis Nuxt 3.7)

```ts
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true  // payload servi en .json séparé, parallélisable
  }
})
```

**Sévérité** : 🟠 P1

### 8.2 Pas de compression Nitro

❌ **Problème** : réponses non compressées → poids transfert x3-5.
✅ **Fix** : Nitro compress (brotli/gzip)

```ts
export default defineNuxtConfig({
  nitro: {
    compressPublicAssets: { brotli: true, gzip: true }
  }
})
```

**Sévérité** : 🔴 P0 si non configuré

### 8.3 Pas de `prerender` sur pages statiques

❌ **Problème** : pages réellement statiques rendues à chaque requête.
✅ **Fix** :

```ts
export default defineNuxtConfig({
  nitro: {
    prerender: { routes: ['/', '/about', '/pricing', '/contact'] }
  }
})
```

**Sévérité** : 🟠 P1

---

## 9. Auto-imports & tree shaking

### 9.1 Auto-import de composants jamais utilisés sur la page

❌ **Problème** : par défaut, Nuxt auto-importe tous les composants détectés dans `components/` → bundle pollué si tu n'utilises pas un loader async.

✅ **Fix** : Lazy-import explicite sur les composants lourds

```vue
<LazyMyHeavyChart />  <!-- chunk séparé -->
```

✅ **Fix complémentaire** : config `components.dirs` ciblée plutôt qu'auto-discovery global.

**Sévérité** : 🟠 P1 sur composants >50KB

### 9.2 Composables avec side effects au top-level

❌ **Problème** : un composable auto-importé qui exécute du code au top-level pollue le bundle même s'il n'est pas appelé.

✅ **Fix** : tout le code dans la fonction exportée, pas en haut du module.

```ts
// ❌ s'exécute à l'import même
const expensiveSetup = doSomething()
export const useFoo = () => expensiveSetup

// ✅ s'exécute uniquement à l'usage
export const useFoo = () => doSomething()
```

**Sévérité** : 🟡 P2

---

## 10. Spécificités Vue 2.7 (legacy)

> Vue 2.7 reste utilisé sur de gros legacy. Voici les spécificités à connaître.

### 10.1 Réactivité Object.defineProperty (vs Proxy en Vue 3)

- Pas de détection ajout/suppression de propriétés → `Vue.set()` / `this.$set()` requis
- Coût initial plus élevé sur gros objets
- **Fix** : envisager la migration Vue 3 si bottleneck identifié

### 10.2 Composition API via `@vue/composition-api` (Vue 2 < 2.7)

- Plugin avec coût bundle (~6KB)
- Vue 2.7 l'inclut nativement → migrer si possible

### 10.3 Pas de `<script setup>` performant en Vue 2

- Verbosité plus élevée
- Pas de tree shaking aussi efficace
- **Fix** : prioriser la migration Vue 3 pour les projets perf-critiques

---

## Checklist rapide d'audit Vue/Nuxt

À l'audit, vérifier systématiquement :

- [ ] Hydration mismatches (warnings console SSR)
- [ ] Lazy hydration appliquée sur composants below-the-fold lourds
- [ ] `shallowRef`/`shallowReactive` sur listes >50 items
- [ ] `:key` stable sur tous les `v-for`
- [ ] `<NuxtImg>` partout, jamais `<img>` natif sur LCP
- [ ] `width`/`height` sur toutes les images
- [ ] `routeRules` configuré pour les pages cacheables
- [ ] `payloadExtraction: true`
- [ ] `nitro.compressPublicAssets` activé
- [ ] `prerender` sur pages statiques
- [ ] `<ClientOnly>` utilisé avec parcimonie
- [ ] Composants statiques en `.server.vue`
- [ ] `useFetch` avec `lazy: true` sur données non critiques
- [ ] `useAsyncData` avec `key` stable
- [ ] `<NuxtLink :prefetch="false">` sur liens rares
- [ ] Auto-imports de composants lourds en `Lazy*`
