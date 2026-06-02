# Build Configuration — Audit & Patterns Perf

Ce fichier couvre l'audit des **configurations de build** : Vite, Next.js, Nuxt, TypeScript,
PostCSS, browserslist. C'est souvent là que se cachent les **régressions silencieuses** —
un flag mal positionné dans `next.config.ts` ou `vite.config.ts` peut annuler toutes les
autres optimisations.

> **Charge** : ce fichier est **systématique** dès que les fichiers de config sont fournis
> (vite.config.\*, next.config.\*, nuxt.config.\*, tsconfig.json, postcss.config.\*,
> .browserslistrc, package.json).

---

## 1. Vite (Vue 3, Nuxt 3/4 sous-jacent, Astro, SvelteKit)

### 1.1 `build.target` legacy

❌ **Problème** : `target: 'es2015'` ou défaut Vite ancien → polyfills inutiles, syntaxe verbose

```ts
// ❌ vite.config.ts
export default defineConfig({
  build: { target: 'es2015' }
})
```

✅ **Fix** : cibler `'es2020'` minimum (sauf cible legacy explicite)

```ts
// ✅ Vite 5+ par défaut
export default defineConfig({
  build: { target: 'es2020' }  // ou 'esnext' si pile moderne
})
```

**Sévérité** : 🟠 P1

### 1.2 Minification désactivée ou Terser sans raison

❌ **Problème** : `minify: false` laissé d'un debug, ou `minify: 'terser'` sans gain mesuré (Terser est ~3-5% plus petit que esbuild mais 10x plus lent au build).

✅ **Fix** : esbuild par défaut (rapide + qualité), Terser uniquement si chaque KB compte

```ts
export default defineConfig({
  build: {
    minify: 'esbuild',  // ✅ défaut Vite, optimal
    // ou 'terser' si gain critique mesuré
  }
})
```

**Sévérité** : 🔴 P0 si `minify: false` en prod

### 1.3 `cssCodeSplit` désactivé

❌ **Problème** : `cssCodeSplit: false` → tout le CSS dans un seul fichier monolithique chargé sur toutes les pages.
✅ **Fix** : laisser `cssCodeSplit: true` (défaut) sauf raison spécifique.

**Sévérité** : 🟠 P1

### 1.4 `assetsInlineLimit` mal calibré

❌ **Problème** :
- Trop bas (4KB défaut) : beaucoup de petits fichiers, surcharge requêtes HTTP
- Trop haut (50KB+) : assets gonflent le JS/CSS, tree shaking moins efficace

✅ **Fix** : 4-8KB est le sweet spot. Augmenter uniquement si HTTP/1.1 (rare aujourd'hui).

**Sévérité** : 🟡 P2

### 1.5 `manualChunks` mal configuré ou absent

❌ **Problème** : `vendors.js` monolithique → invalidation cache totale à chaque mise à jour.
✅ **Fix** : split par groupe stable (cf `universal/bundle.md` §3.3)

**Sévérité** : 🟡 P2 (gain sur visites répétées)

### 1.6 Sourcemaps inline en prod

❌ **Problème** : `sourcemap: 'inline'` → bundle JS x3-4 en taille.
✅ **Fix** : `sourcemap: 'hidden'` (généré, non référencé) ou `true` (fichier séparé) + upload privé à Sentry/Datadog.

```ts
export default defineConfig({
  build: {
    sourcemap: 'hidden',  // ✅ utilisable pour debug sans exposer
  }
})
```

**Sévérité** : 🔴 P0 si inline

### 1.7 `optimizeDeps.exclude` excessif

❌ **Problème** : exclure trop de deps de la pré-bundling Vite → cold start dev lent + parfois bugs prod.
✅ **Fix** : `exclude` uniquement si problème confirmé. `include` pour forcer la pré-bundling de deps qui le bénéficient.

**Sévérité** : 🟢 P3 (DX)

### 1.8 `define` non utilisé pour les feature flags

✅ **Pattern** : remplacer les flags par des constantes au build → dead code elimination

```ts
// vite.config.ts
export default defineConfig({
  define: {
    __FEATURE_X__: JSON.stringify(process.env.FEATURE_X === 'true')
  }
})

// dans le code
if (__FEATURE_X__) {
  await import('./featureX')  // ✅ supprimé du bundle si false
}
```

**Sévérité** : 🟡 P2

---

## 2. Next.js — `next.config.ts`

### 2.1 `compress: false` ou compression non-vérifiée

❌ **Problème** :
- `compress: false` désactive la compression Next
- Reverse proxy devant qui ne compresse pas non plus → réponses brutes

✅ **Fix** : laisser `compress: true` (défaut) OU s'assurer que le proxy (Vercel, Cloudflare, nginx) compresse en brotli/gzip.

```ts
export default {
  compress: true,  // ✅ défaut, à conserver sauf reverse proxy déjà en charge
}
```

**Sévérité** : 🔴 P0 si rien ne compresse

### 2.2 `productionBrowserSourceMaps: true`

❌ **Problème** : génère + sert les sourcemaps publiquement → bundle x3 en bande passante + fuite code source.

✅ **Fix** : laisser `false` (défaut). Pour Sentry, utiliser `@sentry/nextjs` qui upload sans servir publiquement.

**Sévérité** : 🔴 P0 si `true`

### 2.3 `compiler.removeConsole` non activé en prod

❌ **Problème** : `console.log` partout en prod → bundle gonflé + perf runtime impactée sur logs lourds.

✅ **Fix** :

```ts
export default {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false
  }
}
```

**Sévérité** : 🟡 P2

### 2.4 `images` mal configuré

❌ **Problèmes courants** :
- `images.remotePatterns` absent → images externes non optimisées
- `images.formats` sans `'image/avif'` → AVIF non servi
- `images.deviceSizes` non aligné avec les breakpoints réels du design → générations inutiles

✅ **Fix** :

```ts
export default {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com' }],
    deviceSizes: [640, 768, 1024, 1280, 1600],  // alignés avec le design
    minimumCacheTTL: 31536000,  // 1 an pour images optimisées
  }
}
```

**Sévérité** : 🟠 P1

### 2.5 `experimental.optimizePackageImports` absent

✅ **Pattern Next 14+** : transforme automatiquement les imports de libs lourdes en cherry-pick

```ts
export default {
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', '@heroicons/react', 'lodash-es']
  }
}
```

**Métriques** : TBT, bundle size
**Sévérité** : 🟠 P1 si libs concernées présentes

### 2.6 `experimental.ppr` non évalué (Next 14+ exp / Next 15 stable canary)

✅ **Pattern** : Partial Prerendering combine static shell + dynamic streamé.

```ts
export default {
  experimental: { ppr: 'incremental' }  // ✅ opt-in par route via `experimental_ppr = true`
}
```

**Sévérité** : 🟠 P1 sur sites e-commerce / contenu mixte

### 2.7 `experimental.reactCompiler` non évalué (React 19 + Next 15)

✅ **Pattern** : memoization automatique, moins de useMemo/useCallback manuels.

```ts
export default {
  experimental: { reactCompiler: true }
}
```

**Sévérité** : 🟢 P3 — encore experimental, à valider en staging

### 2.8 Bundle analyzer non configuré

✅ **Setup Next** :

```ts
import bundleAnalyzer from '@next/bundle-analyzer'
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })

export default withBundleAnalyzer({
  // config Next
})
```

```bash
ANALYZE=true npm run build  # génère le report
```

**Sévérité** : 🟢 P3 (outil, pas optim directe)

### 2.9 `output: 'standalone'` absent pour déploiement Docker

✅ **Pattern** : génère un build minimal portable, réduit drastiquement la taille de l'image Docker.

```ts
export default {
  output: 'standalone'
}
```

**Sévérité** : 🟡 P2 (cold start, taille image — pas perf front directe)

---

## 3. Nuxt — `nuxt.config.ts`

### 3.1 `nitro.compressPublicAssets` désactivé

❌ **Problème** : assets publics servis non compressés → poids transfert x3-5.
✅ **Fix** :

```ts
export default defineNuxtConfig({
  nitro: {
    compressPublicAssets: { brotli: true, gzip: true }
  }
})
```

**Sévérité** : 🔴 P0

### 3.2 `experimental.payloadExtraction` désactivé

❌ **Problème** : payload SSR injecté dans le HTML → HTML gros, parse plus long.
✅ **Fix** : `payloadExtraction: true` (défaut depuis Nuxt 3.7, vérifier que pas désactivé).

**Sévérité** : 🟠 P1

### 3.3 `experimental.componentIslands` non évalué

✅ **Pattern Nuxt 3.9+** : islands architecture pour pages mixtes statique/interactif (cf `frameworks/vue-nuxt.md` §7.2).

```ts
export default defineNuxtConfig({
  experimental: { componentIslands: true }
})
```

**Sévérité** : 🟡 P2

### 3.4 `experimental.lazyHydration` non utilisé (Nuxt 3.12+)

✅ **Pattern** : permet `<LazyComp hydrate-on-visible />` etc. (cf `frameworks/vue-nuxt.md` §1.2)

**Sévérité** : 🟠 P1 sur projets avec composants below-the-fold lourds

### 3.5 `experimental.viewTransition` pour navigations animées

✅ **Pattern** : utilise l'API View Transitions native pour transitions de page → perf et UX.

**Sévérité** : 🟢 P3

### 3.6 `image` mal configuré (`@nuxt/image`)

✅ **Pattern** :

```ts
export default defineNuxtConfig({
  image: {
    format: ['avif', 'webp'],
    densities: [1, 2],
    domains: ['cdn.example.com'],
    screens: { sm: 640, md: 768, lg: 1024, xl: 1280, xxl: 1536 }
  }
})
```

**Sévérité** : 🟠 P1

### 3.7 `vite.build.target` non aligné avec browserslist

❌ **Problème** : config Vite par défaut peut surclasser le browserslist du projet → bundle plus gros que nécessaire.
✅ **Fix** : aligner explicitement.

```ts
export default defineNuxtConfig({
  vite: {
    build: { target: 'es2020' }
  }
})
```

**Sévérité** : 🟡 P2

### 3.8 `routeRules` absent

❌ **Problème** : pas de cache edge, pas d'ISR/SWR, pas de prerender. (cf `frameworks/vue-nuxt.md` §5.2)

**Sévérité** : 🔴 P0 sur pages à fort trafic

### 3.9 `nitro.prerender` absent sur routes statiques

✅ **Pattern** :

```ts
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/about', '/pricing']
    }
  }
})
```

**Sévérité** : 🟠 P1

---

## 4. TypeScript — `tsconfig.json`

### 4.1 `target` legacy

❌ **Problème** : `target: 'ES5'` ou `'ES2015'` → transpilation lourde, code volumineux, polyfills.
✅ **Fix** : `target: 'ES2020'` minimum (sauf cible legacy explicite)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

**Sévérité** : 🟠 P1 si target legacy

### 4.2 `isolatedModules: false` ou absent

❌ **Problème** : empêche la transpilation parallèle (utilisée par esbuild, swc, Vite) → builds plus lents.
✅ **Fix** : `isolatedModules: true` (impose `import type` explicite mais accélère drastiquement).

**Sévérité** : 🟢 P3 (DX)

---

## 5. PostCSS & CSS pipeline

### 5.1 Pas de minification CSS

❌ **Problème** : CSS non minifié servi en prod (souvent oublié quand custom postcss.config).
✅ **Fix** : `cssnano` ou équivalent dans la chaîne PostCSS prod.

```js
// postcss.config.cjs
module.exports = {
  plugins: {
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {})
  }
}
```

> Vite, Next, Nuxt minifient le CSS par défaut. Vérifier surtout sur configs custom.

**Sévérité** : 🔴 P0 si non minifié

### 5.2 Tailwind sans purge / `content` mal configuré

❌ **Problème** : Tailwind sans `content` correct → CSS final >3MB (toutes les classes).
✅ **Fix** :

```ts
// tailwind.config.ts
export default {
  content: [
    './app/**/*.{vue,ts,tsx}',
    './components/**/*.{vue,ts,tsx}',
    './pages/**/*.{vue,ts,tsx}'
  ]
}
```

**Sévérité** : 🔴 P0 si CSS final >100KB

### 5.3 `autoprefixer` non aligné avec browserslist

❌ **Problème** : ajoute des prefixes pour navigateurs hors-cible → CSS gonflé.
✅ **Fix** : `autoprefixer` lit `.browserslistrc` ou `package.json` automatiquement → vérifier que browserslist est défini cohéremment.

**Sévérité** : 🟡 P2

---

## 6. Browserslist

### 6.1 Pas de `browserslist` défini

❌ **Problème** : chaque outil (Babel, autoprefixer, esbuild, swc) prend son défaut → souvent IE11 inclus → polyfills inutiles.

✅ **Fix** : définir explicitement dans `package.json` ou `.browserslistrc`

```json
// package.json
{
  "browserslist": [">0.5%", "last 2 versions", "Firefox ESR", "not dead", "not IE 11"]
}
```

**Sévérité** : 🔴 P0 si polyfills legacy détectés (cf Lighthouse `legacy-javascript`)

### 6.2 Browserslist trop laxiste

❌ **Problème** : `> 0.1%` ou `last 5 versions` → cible des navigateurs quasi-éteints → polyfills inutiles.
✅ **Fix** : `> 0.5%` est un bon défaut. Croiser avec analytics réels si possible.

**Sévérité** : 🟠 P1

---

## 7. CI/CD perf checks

### 7.1 Pas de Lighthouse CI

❌ **Problème** : régressions perf détectées seulement en prod.
✅ **Fix** : `lhci` (Lighthouse CI) en pipeline avec budgets

```yaml
# .lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }]
      }
    }
  }
}
```

**Sévérité** : 🟠 P1 (prévention plutôt que fix)

### 7.2 Pas de bundle size budget

❌ **Problème** : un PR ajoute une lib de 200KB sans alerte.
✅ **Fix** : `size-limit`, `bundlewatch`, ou `@next/bundle-analyzer` en CI

```json
// .size-limit.json
[
  {
    "name": "Initial JS",
    "path": ".next/static/chunks/main-*.js",
    "limit": "200 KB"
  }
]
```

**Sévérité** : 🟠 P1

---

## 8. Source maps en prod (cas spécifique)

### 8.1 Sourcemaps inline ou exposées

❌ **Problème** : sourcemaps inline gonflent le bundle. Sourcemaps publiques exposent le code source.
✅ **Fix** : `hidden-source-map` (généré, non référencé), upload à Sentry/Datadog/Bugsnag.

(cf Vite §1.6, Next §2.2 ci-dessus)

**Sévérité** : 🔴 P0 si inline ou publiques

---

## 9. Pièges silencieux à vérifier systématiquement

Ces erreurs n'apparaissent dans aucun warning, mais détruisent les perfs :

1. **`NODE_ENV` non défini en prod** → React/Vue tournent en mode dev, perf catastrophique
2. **HMR (`hot reload`) actif en prod** → bundle gonflé
3. **`devDependencies` qui finissent en runtime** → bundle pollué (ex: `webpack-bundle-analyzer` importé statiquement)
4. **`postinstall` qui réinstalle des deps lourdes** → builds CI 3x plus lents
5. **Cache CI désactivé / mal configuré** → recompilation totale à chaque PR
6. **Builds générés sur archi différente** (M1 vs x86) → binaires natifs incompatibles, fallback JS lent
7. **Variables d'env publiques contenant des secrets** → fuite + bundle gonflé inutilement
8. **Polyfills tirés deux fois** : par le bundler ET par une lib qui les ship → duplication
9. **`process.env.X` non remplacé au build** → reste en runtime, perf et sécurité
10. **`tsc` en build au lieu de `swc`/`esbuild`/`vite build`** → builds 5-10x plus lents

---

## Checklist rapide d'audit Build Configuration

À l'audit, vérifier systématiquement :

### Vite (si présent)
- [ ] `build.target: 'es2020'` minimum
- [ ] `build.minify` activé (esbuild ou Terser)
- [ ] `build.cssCodeSplit: true`
- [ ] `build.sourcemap` non-inline (`hidden` ou séparé)
- [ ] `manualChunks` configuré pour vendors stables
- [ ] `define` utilisé pour les feature flags

### Next (si présent)
- [ ] `compress: true` ou compression au niveau proxy
- [ ] `productionBrowserSourceMaps: false`
- [ ] `compiler.removeConsole` activé en prod
- [ ] `images` configuré (formats avif/webp, remotePatterns, deviceSizes)
- [ ] `experimental.optimizePackageImports` pour libs concernées
- [ ] `experimental.ppr` évalué (Next 14+)
- [ ] Bundle analyzer setup
- [ ] `output: 'standalone'` si déploiement Docker

### Nuxt (si présent)
- [ ] `nitro.compressPublicAssets` activé
- [ ] `experimental.payloadExtraction: true`
- [ ] `experimental.componentIslands` évalué
- [ ] `experimental.lazyHydration` activé (Nuxt 3.12+)
- [ ] `image` configuré (formats, densities, screens)
- [ ] `vite.build.target` aligné avec browserslist
- [ ] `routeRules` configuré
- [ ] `nitro.prerender` pour routes statiques

### TypeScript
- [ ] `target: 'ES2020'` minimum
- [ ] `isolatedModules: true`

### CSS
- [ ] CSS minifié en prod
- [ ] Tailwind `content` correctement scopé
- [ ] `autoprefixer` aligné avec browserslist

### Browserslist
- [ ] `browserslist` défini explicitement
- [ ] Pas de cible IE11 (sauf besoin métier)
- [ ] `> 0.5%` ou équivalent raisonnable

### CI/CD
- [ ] Lighthouse CI en pipeline avec budgets
- [ ] Bundle size budget (size-limit / bundlewatch)
- [ ] Cache build CI activé

### Pièges silencieux
- [ ] `NODE_ENV=production` en prod
- [ ] HMR désactivé en prod
- [ ] `devDependencies` non bundled en prod
- [ ] Sourcemaps non publiques (hidden ou upload privé)
