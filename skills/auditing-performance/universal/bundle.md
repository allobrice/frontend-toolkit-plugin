# Bundle JS — Patterns & Anti-patterns Perf

Ce fichier couvre l'optimisation du bundle JavaScript : taille, tree shaking, code splitting,
dead code, polyfills, libs lourdes. C'est souvent le domaine où on trouve les **plus gros gains
en TBT et INP**, parce que chaque KB de JS coûte du parse + compile + execute, surtout sur mobile.

> **Charge** : ce fichier est presque toujours pertinent pour un audit perf — tout projet front
> a un bundle. Charge-le sauf cas très spécifique (audit purement images ou fonts).

---

## 1. Analyse du bundle — méthodologie

Avant tout fix, il faut **mesurer**. Sans bundle analyzer, on optimise à l'aveugle.

### 1.1 Outils par stack

| Stack | Outil |
|---|---|
| Vite (Vue 3, Nuxt 3/4) | `vite-bundle-visualizer` ou `rollup-plugin-visualizer` |
| Webpack (Nuxt 2, Next legacy) | `webpack-bundle-analyzer` |
| Next.js (App Router) | `@next/bundle-analyzer` natif |
| Tous | `source-map-explorer` (depuis sourcemaps de prod) |

### 1.2 Ce qu'on cherche dans l'analyzer

1. **Bundles >250KB gzipped** → red flag, on doit les justifier
2. **Libs >50KB gzipped** → candidates au remplacement / lazy loading
3. **Modules dupliqués** → multiples versions de la même lib
4. **Imports inattendus** → dépendances "fantômes" tirées par une lib
5. **Code non utilisé** dans les chunks shared

> **Objectif de référence** sur du Vue/Next moderne : **JS initial <200KB gzipped** sur mobile.
> Au-delà, le TBT décroche et le LCP devient sensible.

---

## 2. Tree shaking

### 2.1 Imports CJS au lieu d'ESM

❌ **Problème** : les modules CommonJS (`require`) ne sont pas tree-shakables → la lib entière est incluse.

```ts
// ❌ tout `lodash` (~70KB) bundled, même si tu n'utilises que `debounce`
const _ = require('lodash')
```

✅ **Fix** : import ESM nommé, ou cherry-pick

```ts
// ✅ uniquement debounce (~2KB)
import debounce from 'lodash-es/debounce'
// ou
import { debounce } from 'lodash-es'  // si tree shaking fonctionne (vérifier !)
```

**Sévérité** : 🔴 P0 sur libs >20KB

### 2.2 `sideEffects` non déclaré dans `package.json`

❌ **Problème** : sans `"sideEffects"`, les bundlers gardent tout par sécurité (un import "for side effects" pourrait être nécessaire).

✅ **Fix** : déclarer dans `package.json` de chaque package interne

```json
{
  "sideEffects": false  // ✅ tout est tree-shakable
}
```

Ou liste explicite si certains fichiers ont des effets (CSS imports, polyfills) :

```json
{
  "sideEffects": ["*.css", "./src/polyfills.ts"]
}
```

**Sévérité** : 🟠 P1 (gros impact sur libs partagées dans un monorepo)

### 2.3 Re-exports qui cassent le tree shaking

❌ **Problème** : un `index.ts` qui re-exporte tout en wildcard force le bundler à charger tout pour analyser les usages.

```ts
// ❌ src/utils/index.ts
export * from './foo'
export * from './bar'
export * from './baz'
```

✅ **Fix** : re-exports nommés explicites, ou imports directs

```ts
// ✅ re-exports nommés
export { foo, fooHelper } from './foo'
export { bar } from './bar'

// ou côté consommateur, import direct
import { foo } from '@/utils/foo'  // ✅ skip le barrel
```

**Sévérité** : 🟠 P1 sur barrels volumineux

### 2.4 Imports d'icônes en bulk

❌ **Problème** : `import * as Icons from 'lucide-react'` ou équivalent → toutes les icônes bundled.

```tsx
// ❌ ~150KB d'icônes
import * as Icons from 'lucide-react'
```

✅ **Fix** : import nommé par icône

```tsx
// ✅ ~2KB par icône
import { ChevronRight, Search, User } from 'lucide-react'
```

**Sévérité** : 🔴 P0 (gain souvent >100KB)

---

## 3. Code splitting

### 3.1 Pas de splitting par route

❌ **Problème** : single chunk JS pour toute l'app → première page charge le code de toutes les autres.

✅ **Fix** : route-based splitting (intégré nativement en Vue Router, Nuxt, Next App Router, React Router 6+)

```ts
// Vue Router
const routes = [
  { path: '/dashboard', component: () => import('./Dashboard.vue') }
]

// React Router
const Dashboard = lazy(() => import('./Dashboard'))
```

**Sévérité** : 🔴 P0 si pas appliqué (rare en stack moderne, mais à vérifier)

### 3.2 Composants lourds en eager dans le bundle initial

❌ **Problème** : éditeur WYSIWYG, charting lib, video player, code editor → 200-500KB chacun, dans le bundle initial même si utilisés sur 1 page.

✅ **Fix** : lazy import au point d'usage

```ts
// React/Next
const RichEditor = dynamic(() => import('./RichEditor'), { ssr: false })

// Vue/Nuxt (préfixe Lazy)
<LazyRichEditor v-if="editing" />
```

**Cas typiques à split** :
- Editors : TinyMCE, CKEditor, ProseMirror, Lexical → 200-400KB
- Charts : Chart.js, ApexCharts, Highcharts → 100-300KB
- Maps : Leaflet, Mapbox, Google Maps → 100-200KB
- Video : Video.js, Plyr → 50-150KB
- 3D : Three.js → 600KB+
- PDF : pdf.js → 200KB+

**Sévérité** : 🔴 P0 sur composants >100KB non-critiques au LCP

### 3.3 Vendor chunk monolithique

❌ **Problème** : tout `node_modules` dans un seul chunk `vendors.js` → invalidation totale du cache à chaque mise à jour.

✅ **Fix** : split par lib stable

```ts
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', '@vue/runtime-core'],
          'vendor-utils': ['lodash-es', 'date-fns'],
          // les autres : auto
        }
      }
    }
  }
}
```

**Sévérité** : 🟡 P2 (gain sur les visites répétées)

---

## 4. Dead code & imports inutilisés

### 4.1 Imports inutilisés détectés par Lighthouse

❌ **Problème** : Lighthouse `unused-javascript` indique du code jamais exécuté → souvent imports oubliés ou code dev resté en prod.

✅ **Fix** : ESLint avec `no-unused-vars` + `import/no-unused-modules` strict en CI.

**Sévérité** : 🟠 P1 si le score Lighthouse remonte >20KB d'unused

### 4.2 Code de dev/debug en production

❌ **Problème** : `console.log`, code derrière `if (debug)`, dev tools intégrés → bundled en prod.

✅ **Fix** : utiliser `import.meta.env.DEV` (Vite) ou `process.env.NODE_ENV === 'development'` qui sont éliminés à build.

```ts
if (import.meta.env.DEV) {
  console.log('[debug]', state)  // ✅ supprimé en prod
}
```

✅ **Fix complémentaire** : `terser`/`swc` configuré pour drop console.* en prod.

```ts
// vite.config.ts
export default {
  esbuild: {
    drop: ['console', 'debugger'],  // ✅ supprime console.log
  }
}
```

**Sévérité** : 🟡 P2 (gain modeste mais hygiène)

### 4.3 Conditional imports qui ne sont jamais éliminés

❌ **Problème** : `if (feature) import(...)` ne peut pas être tree-shaken si la condition n'est pas constante au build.

✅ **Fix** : utiliser des `define` ou variables d'env constantes au build.

```ts
// ✅ si FEATURE_X est constant au build, le code est éliminé
if (FEATURE_X) {
  await import('./featureX')
}
```

**Sévérité** : 🟡 P2

---

## 5. Polyfills & build target moderne

### 5.1 Polyfills servis aux navigateurs modernes

❌ **Problème** : par défaut, beaucoup de configs bundle des polyfills pour IE11 / vieux Safari → 30-100KB inutiles servis à 95% des users.

✅ **Fix** : `browserslist` cohérent avec ta vraie cible

```json
// package.json
"browserslist": [
  ">0.5%",
  "last 2 versions",
  "Firefox ESR",
  "not dead",
  "not IE 11"  // explicite
]
```

✅ **Fix Next** : `target: 'es2020'` ou `experimental.modernBrowsers: true` (selon version).

✅ **Fix Vite** : `build.target: 'es2020'` (par défaut sur Vite 5+).

**Métriques** : TBT (P1), bundle size
**Sévérité** : 🟠 P1 si polyfills legacy détectés (`legacy-javascript` Lighthouse)

### 5.2 `core-js` complet importé

❌ **Problème** : importer `core-js` global ajoute >100KB.
✅ **Fix** : `useBuiltIns: 'usage'` dans Babel ou laisser SWC gérer (Next, Vite SWC).

**Sévérité** : 🟠 P1

### 5.3 Pas de differential serving

✅ **Pattern moderne** : servir des bundles ES2020+ aux navigateurs modernes via `<script type="module">` et un fallback `<script nomodule>`.

Vite, Next, Nuxt le font automatiquement en mode moderne. Vérifier que c'est activé.

**Sévérité** : 🟡 P2

---

## 6. Bibliothèques lourdes & alternatives

### 6.1 `moment.js`

❌ **Problème** : ~70KB gzipped, locales bundlées, mutable, deprecated par ses propres mainteneurs.
✅ **Fix** :
- `date-fns` (modulaire, ~2-10KB selon usage, immutable)
- `dayjs` (~3KB, API moment-like)
- `Temporal` API (native, encore en stage 3 — polyfill ~30KB)

**Sévérité** : 🔴 P0 sur projet qui utilise moment activement

### 6.2 `lodash` complet

Voir 2.1 — cherry-pick ou alternatives natives (`Array.prototype.*`, `Object.fromEntries`, structured clone, etc.)

### 6.3 Multiple state libs

❌ **Problème** : projet qui a Redux + Zustand + Context custom → 30-50KB cumulés inutiles.
✅ **Fix** : choisir une lib et migrer.

**Sévérité** : 🟠 P1

### 6.4 Charting libs lourdes pour usage simple

❌ **Problème** : `Chart.js` complet (~200KB) pour un seul donut chart.
✅ **Fix** : SVG manuel pour cas simples, `recharts`/`visx` modulaires pour cas complexes.

**Sévérité** : 🟠 P1 selon usage

### 6.5 jQuery dans un projet Vue/React

❌ **Problème** : jQuery (~85KB) résiduel d'un legacy → contourné par les frameworks modernes.
✅ **Fix** : éliminer, remplacer par DOM natif ou refacto en composant framework.

**Sévérité** : 🔴 P0 si présent et inutile

---

## 7. Modules dupliqués

### 7.1 Plusieurs versions de la même lib

❌ **Problème** : monorepo avec lib v1 dans package A et v2 dans package B → les deux dans le bundle final.

✅ **Fix** :
- `npm dedupe` / `pnpm dedupe`
- `resolutions` (yarn) ou `overrides` (npm/pnpm) pour forcer une version
- Bundle analyzer pour détecter les doublons

**Sévérité** : 🟠 P1

### 7.2 Polyfills dupliqués entre vendor et app

❌ **Problème** : une lib externe contient ses propres polyfills déjà inclus par ton build.
✅ **Fix** : éviter les libs qui shipent leurs polyfills (vérifier au choix de la dépendance).

**Sévérité** : 🟡 P2

---

## 8. Minification & transformation

### 8.1 Code non minifié en prod

❌ **Problème** : Lighthouse `unminified-javascript` → souvent un proxy/CDN qui ne transmet pas le bon header, ou un build mal configuré.
✅ **Fix** : vérifier que `minify: true` (Vite/Rollup) ou `swcMinify: true` (Next) ou Terser actif.

**Sévérité** : 🔴 P0 si non minifié

### 8.2 SWC vs Terser vs esbuild

- **esbuild** : le plus rapide, minification correcte, défaut Vite
- **SWC** : Rust-based, défaut Next 12+, légèrement plus agressif que esbuild
- **Terser** : le plus optimisé en taille, mais le plus lent

**Recommandation** : esbuild ou SWC en standard. Terser uniquement si chaque KB compte (sites perf-critiques, ad-tech).

**Sévérité** : 🟢 P3 (différence <5% en général)

---

## 9. Source maps

### 9.1 Source maps en production servies aux users

❌ **Problème** : `.map` files servis publiquement → reverse engineering facile + bande passante gaspillée.

✅ **Fix** :
- Sourcemaps uploadés à Sentry/Datadog uniquement, pas servis au public
- Ou `hidden-source-map` (généré mais pas référencé dans le bundle)

**Sévérité** : 🟡 P2 (sécurité + perf marginale)

### 9.2 Source maps inline

❌ **Problème** : sourcemap inline dans le bundle JS → bundle x3 en taille.
✅ **Fix** : `sourcemap: true` (fichier séparé), jamais `'inline'` en prod.

**Sévérité** : 🔴 P0 si détecté

---

## 10. Chunks async — preload / prefetch

### 10.1 Chunks lazy loadés trop tard

❌ **Problème** : un composant `<LazyMyForm>` cliqué déclenche le download du chunk au moment du clic → délai visible.

✅ **Fix** : `prefetch` au survol ou à l'idle

```ts
// Vue/Nuxt — built-in via NuxtLink prefetch
<NuxtLink to="/form" prefetch>Form</NuxtLink>

// React — prefetch manuel
const handleHover = () => import('./MyForm')  // pré-charge au hover
```

✅ **Fix Next App Router** : `<Link prefetch>` (défaut on viewport)

**Sévérité** : 🟡 P2

### 10.2 `preload` abusif des chunks

❌ **Problème** : preloader trop de chunks → contention bande passante avec le LCP.
✅ **Fix** : ne preload que les chunks **certains** d'être utilisés au-dessus du fold.

**Sévérité** : 🟠 P1 si LCP impacté

---

## Checklist rapide d'audit Bundle

À l'audit, vérifier systématiquement :

- [ ] Bundle analyzer généré et inspecté
- [ ] JS initial <200KB gzipped sur mobile
- [ ] Aucune lib >50KB non justifiée dans le bundle initial
- [ ] Tree shaking effectif (imports nommés, `sideEffects` déclaré)
- [ ] Pas d'icônes en wildcard (`import *`)
- [ ] Pas de barrel files (`export *`) sur grosses arbo
- [ ] Code splitting par route activé
- [ ] Composants lourds (>100KB) en lazy/dynamic
- [ ] Pas de duplicates dans le bundle
- [ ] Polyfills cohérents avec `browserslist` réel
- [ ] Pas de polyfills IE11 si non ciblé
- [ ] `moment.js` éliminé ou remplacé
- [ ] `lodash` cherry-pick ou éliminé
- [ ] Pas de jQuery résiduel
- [ ] `console.log` supprimés en prod
- [ ] Code minifié confirmé (esbuild/SWC/Terser)
- [ ] Sourcemaps non servis au public
- [ ] Prefetch raisonné sur les chunks lazy
