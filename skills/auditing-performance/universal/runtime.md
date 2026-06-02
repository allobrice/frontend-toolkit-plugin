# Runtime & Rendering — Patterns & Anti-patterns Perf

Ce fichier couvre les patterns d'**exécution JS** et de **rendu navigateur** qui affectent
l'INP, le TBT et la fluidité perçue (FPS). C'est ce qui se passe **après** que le bundle ait
été chargé.

> **Charge** : pertinent dès qu'il y a interactivité, listes, animations, ou que Lighthouse
> remonte des `long-tasks` / `mainthread-work-breakdown`. Les patterns Vue/React-spécifiques
> (memoization, useTransition, shallowRef) sont dans `frameworks/*.md` — ce fichier couvre
> les patterns **navigateur-niveau** universels.

---

## 1. Long tasks (>50ms)

### 1.1 Définition & impact

Une **long task** est toute exécution JS bloquant le main thread plus de 50ms. Pendant ce temps :
- Aucune interaction n'est traitée (clic, scroll, keypress) → INP dégradé
- Aucun render visuel → jank
- Lighthouse compte le surplus au-dessus de 50ms dans le **TBT**

**Outils de détection** :
- Chrome DevTools → Performance tab → tâches >50ms en rouge
- Lighthouse → audits `long-tasks`, `mainthread-work-breakdown`
- `PerformanceObserver({ entryTypes: ['longtask'] })` en production

### 1.2 Boucles synchrones lourdes

❌ **Problème** : traitement de gros datasets en synchrone bloque tout

```ts
// ❌ traite 10000 items en une fois → ~200-500ms de blocage
const processed = bigArray.map(item => expensiveTransform(item))
```

✅ **Fix** : chunker avec yield au main thread (voir §2)

```ts
async function processInChunks<T, R>(items: T[], fn: (item: T) => R, chunkSize = 100): Promise<R[]> {
  const result: R[] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    result.push(...items.slice(i, i + chunkSize).map(fn))
    await yieldToMain()  // cf §2
  }
  return result
}
```

**Métriques** : INP (P0), TBT
**Sévérité** : 🔴 P0 sur tâches >100ms

### 1.3 JSON.parse / stringify sur gros payloads

❌ **Problème** : `JSON.parse` d'un payload >1MB peut bloquer 100-500ms.
✅ **Fix** :
- **Server-side** : ne pas envoyer 1MB de JSON, paginer / streamer
- **Client-side** : Web Worker (cf §3) ou `Response.json()` natif (parfois plus rapide)

**Sévérité** : 🟠 P1

---

## 2. Yielding au main thread

### 2.1 Pas de yield dans les boucles longues

❌ **Problème** : boucle qui tourne 200ms sans yield = INP catastrophique si l'utilisateur clique pendant.

✅ **Fix moderne** : `scheduler.yield()` (Chromium 129+, polyfillable)

```ts
async function yieldToMain(): Promise<void> {
  if ('scheduler' in window && 'yield' in window.scheduler) {
    return window.scheduler.yield()  // ✅ priorité préservée, le mieux
  }
  return new Promise(resolve => setTimeout(resolve, 0))  // fallback
}
```

✅ **Fix legacy** : `setTimeout(fn, 0)` ou `MessageChannel`

⚠️ **Piège** : `requestAnimationFrame` n'est PAS un yield (il s'exécute dans le frame, donc bloque toujours).

**Métriques** : INP (P0)
**Sévérité** : 🔴 P0 sur traitements interactifs

### 2.2 `requestIdleCallback` pour tâches non urgentes

✅ **Pattern** : analytics, cache prewarming, indexation, prefetch — toutes les tâches "background"

```ts
requestIdleCallback(() => {
  warmupCache()
  preloadNextRoute()
}, { timeout: 2000 })
```

⚠️ **Limitations** : non supporté Safari avant 16.4, et le `timeout` peut le faire s'exécuter même si idle inexistant.

**Sévérité** : 🟡 P2

---

## 3. Web Workers

### 3.1 Computation lourde dans le main thread

❌ **Problème** : parsing/transformation/calcul lourd dans le main thread → blocage de toute l'UI.

**Cas typiques à passer en Worker** :
- Parsing CSV/XML/Markdown lourd (>500KB)
- Transformation d'images côté client (resize, crop, filtres)
- Cryptographie (hash, sign, verify)
- Calculs scientifiques, graphes, geo (Turf.js)
- Compression / décompression
- Diffing (`diff`, `fast-json-patch`)

✅ **Fix** : Web Worker, idéalement avec **Comlink** pour ergonomie

```ts
// worker.ts
import * as Comlink from 'comlink'
const api = {
  parseHeavyCSV(text: string) { return parse(text) }
}
Comlink.expose(api)

// main.ts
import * as Comlink from 'comlink'
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
const api = Comlink.wrap<typeof import('./worker').api>(worker)
const parsed = await api.parseHeavyCSV(csvText)  // ✅ non-bloquant
```

**Métriques** : INP (P0), TBT
**Sévérité** : 🔴 P0 sur features lourdes (éditeurs, previews, etc.)

### 3.2 Web Worker pour micro-tâches

❌ **Anti-pattern** : Worker pour des calculs <10ms — l'overhead de message passing dépasse le gain.
✅ **Fix** : garder en main thread + yield si nécessaire.

**Sévérité** : 🟢 P3 (anti-pattern)

### 3.3 Service Worker pour cache offline

✅ **Pattern** : SW pour cache des assets statiques, stratégies offline-first sur API.
Outils : Workbox (Google), `vite-plugin-pwa`, `@nuxt/pwa`, `next-pwa`.

> Voir aussi `universal/network.md` pour les stratégies de cache.

**Sévérité** : 🟡 P2 (gain énorme sur visites répétées si pertinent)

---

## 4. Virtual scrolling / windowing

### 4.1 Liste de 1000+ items rendue intégralement

❌ **Problème** : 1000 items × 5 nodes DOM = 5000 nodes → mount lent + scroll laggy + INP dégradé.

✅ **Fix** : virtualiser — ne rendre que les items visibles + buffer

| Stack | Lib recommandée |
|---|---|
| React | `@tanstack/react-virtual` (moderne), `react-window` (mature) |
| Vue 3 | `@tanstack/vue-virtual`, `vue-virtual-scroller` |
| Universal | `@tanstack/virtual-core` |

```tsx
// Exemple TanStack Virtual (React)
const rowVirtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 60,
  overscan: 5,
})
```

**Métriques** : INP (P0), TBT, dom-size
**Sévérité** : 🔴 P0 sur listes >200 items

### 4.2 Trade-offs de la virtualisation

⚠️ **À considérer** :
- **SEO** : items non rendus ne sont pas indexés → ne pas virtualiser sur du contenu indexable
- **Ctrl+F navigateur** : ne trouve que les items visibles
- **Accessibilité** : screen readers peuvent perdre le contexte total — toujours fournir un `aria-rowcount`/`aria-rowindex` ou équivalent

**Recommandation** : virtualiser pour l'admin/dashboard, paginer ou "load more" pour SEO + a11y critiques.

---

## 5. DOM size & complexité

### 5.1 Lighthouse `dom-size` >1500 nodes

❌ **Problème** : DOM trop grand → tous les selectors CSS deviennent plus lents, layout/paint coûteux, memory pressure.

**Seuils Lighthouse** :
- ✅ <800 nodes : OK
- ⚠️ 800-1500 nodes : warning
- 🔴 >1500 nodes : impact significatif

✅ **Fix** :
- Pagination / infinite scroll virtualisé
- Découpage en pages plus courtes
- `content-visibility: auto` (cf §6)
- Suppression de wrappers inutiles

**Sévérité** : 🟠 P1 si >1500, 🔴 P0 si >3000

### 5.2 Sur-imbrication de composants (wrapper hell)

❌ **Problème** : 10 niveaux de `<div>` wrappers pour des layouts CSS triviaux → DOM gonflé, parsing slow.

✅ **Fix** : Fragment (React `<>`, Vue `<template>`), `display: contents` pour l'élément à effacer du flow visuel.

**Sévérité** : 🟡 P2

---

## 6. CSS Containment & content-visibility

### 6.1 `content-visibility: auto` non utilisé sur sections offscreen

✅ **Pattern moderne** : indique au navigateur de skip layout/paint pour les sections non visibles.

```css
.section-below-fold {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px;  /* ✅ réserve l'espace pour éviter CLS */
}
```

**Gains observés** : -30 à -50% sur le Loading time des pages longues.

⚠️ **Pièges** :
- `contain-intrinsic-size` indispensable, sinon CLS sur scroll rapide
- Casse `Ctrl+F` sur le contenu collapsé (fixé via `hidden="until-found"`)
- Encore non supporté Safari <18

**Métriques** : LCP, FCP, TBT
**Sévérité** : 🟠 P1 sur pages longues (blogs, e-commerce, listings)

### 6.2 `contain: layout style paint` sur composants isolés

✅ **Pattern** : sur un composant qui peut être traité indépendamment du reste (carte produit, popover, modal), `contain` permet au navigateur d'optimiser les recalculs.

```css
.product-card { contain: layout style paint; }
```

**Sévérité** : 🟡 P2

---

## 7. Animations performantes

### 7.1 Animations sur propriétés non-composited

❌ **Problème** : animer `width`, `height`, `top`, `left`, `margin`, `padding` déclenche layout + paint à chaque frame → jank.

```css
/* ❌ relayout à chaque frame */
.box { transition: width 300ms; }
.box:hover { width: 300px; }
```

✅ **Fix** : animer uniquement `transform` et `opacity` (composited, GPU)

```css
/* ✅ composited, 60 fps garantis */
.box { transition: transform 300ms; }
.box:hover { transform: scaleX(1.2); }
```

**Métriques** : INP (P1), CLS si scroll ou layout impacté
**Sévérité** : 🟠 P1 — détecté par Lighthouse `non-composited-animations`

### 7.2 `will-change` en abus

❌ **Problème** : `will-change: transform` sur 100 éléments → 100 layers GPU → memory pressure massive, peut **dégrader** la perf.

✅ **Fix** : `will-change` UNIQUEMENT juste avant l'animation, retiré après

```ts
element.style.willChange = 'transform'
animate(element, () => {
  element.style.willChange = 'auto'  // ✅ libère le layer
})
```

**Sévérité** : 🟠 P1

### 7.3 `prefers-reduced-motion` ignoré

❌ **Problème** : utilisateurs avec sensibilité au motion (vestibulaires, vertiges) reçoivent toutes les animations → mauvaise UX + a11y violation.

✅ **Fix** :

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Sévérité** : 🟡 P2 (a11y, pas perf directe — mais gain perf collatéral)

### 7.4 Bibliothèques d'animation lourdes pour cas simples

❌ **Problème** : importer GSAP (~70KB) ou Framer Motion (~50KB) pour 1 fade-in.
✅ **Fix** : CSS transitions natives, ou `Web Animations API` pour cas plus complexes (gratuit, natif).

**Sévérité** : 🟠 P1 selon usage

---

## 8. Event handlers & listeners

### 8.1 Listeners scroll/wheel/touch sans `{ passive: true }`

❌ **Problème** : sans `passive`, le navigateur attend que le handler ait fini avant de scroller → scroll laggy.

```ts
// ❌
window.addEventListener('scroll', handler)
```

✅ **Fix** :

```ts
// ✅ scroll fluide garanti
window.addEventListener('scroll', handler, { passive: true })
```

⚠️ Avec `passive: true`, `preventDefault()` ne fonctionne plus dans le handler.

**Métriques** : INP (P0), scroll FPS
**Sévérité** : 🔴 P0 sur listeners scroll/touch sur la page entière

### 8.2 Pas de debounce/throttle sur events haute fréquence

❌ **Problème** : `resize`, `scroll`, `mousemove`, `input` peuvent fire 50-100x/sec → handlers exécutés trop souvent.

✅ **Fix** : `debounce` (attend la fin), `throttle` (limite la fréquence)

```ts
import debounce from 'lodash-es/debounce'
const onResize = debounce(() => recomputeLayout(), 150)
window.addEventListener('resize', onResize)
```

> Pour des cas simples, implémenter soi-même évite la dépendance (cf `universal/bundle.md` §6.2).

**Sévérité** : 🟠 P1

### 8.3 Listeners non nettoyés au unmount

❌ **Problème** : composant démonté mais listener toujours actif → memory leak + handler qui ref un node disparu.

✅ **Fix** : `AbortController` (moderne, propre)

```ts
const controller = new AbortController()
window.addEventListener('scroll', handler, { signal: controller.signal })
// au unmount :
controller.abort()  // ✅ retire tous les listeners liés
```

**Métriques** : memory, INP indirect
**Sévérité** : 🟠 P1

### 8.4 Pas d'event delegation sur listes longues

❌ **Problème** : 1000 items × 1 listener click = 1000 listeners → memory + slow attach.
✅ **Fix** : 1 listener sur le parent + `event.target` pour identifier l'item.

**Sévérité** : 🟡 P2

---

## 9. Memory leaks & GC pressure

### 9.1 Timers / intervals non nettoyés

❌ **Problème** : `setInterval` qui continue à tourner après unmount → références retenues, GC bloqué.
✅ **Fix** : `clearInterval` au cleanup (`onUnmounted`, `useEffect` return).

**Sévérité** : 🔴 P0 si répété (cause de jank progressif sur SPA)

### 9.2 Closures qui retiennent de gros objets

❌ **Problème** : un callback enregistré globalement qui capture `bigData` → `bigData` jamais GC.
✅ **Fix** : `WeakRef` / `WeakMap` pour références faibles si pertinent ; sinon nettoyer le callback.

**Sévérité** : 🟠 P1

### 9.3 Detached DOM nodes

❌ **Problème** : un node retiré du DOM mais référencé en JS → leak.
✅ **Fix** : nettoyer les références (DevTools → Memory → Heap snapshot → "Detached" pour détecter).

**Sévérité** : 🟠 P1

### 9.4 Sub/observers non disposés

❌ **Problème** : `IntersectionObserver`, `MutationObserver`, `ResizeObserver`, RxJS subscriptions, etc. non `disconnect()`/`unsubscribe()`.
✅ **Fix** : disposer systématiquement au cleanup.

**Sévérité** : 🟠 P1

---

## 10. Profiling & mesure

### 10.1 Méthodologie de profiling

Pour identifier les bottlenecks runtime :

1. **Chrome DevTools → Performance tab**
   - Record l'interaction problématique
   - Chercher les long tasks (rouge)
   - Inspecter "Bottom-up" pour les fonctions coûteuses

2. **Performance Insights** (Chrome moderne)
   - Auto-détection des INP problématiques
   - Suggestions d'optimisation

3. **React DevTools Profiler / Vue DevTools Performance**
   - Identifier les re-renders inutiles
   - Mesurer le coût par composant

4. **Web Vitals JS / Chrome Web Vitals Extension**
   - Mesure INP en réel (lab + RUM)

### 10.2 Mesure en prod (RUM)

✅ **Pattern** : envoyer les Web Vitals à un backend pour avoir la vérité terrain

```ts
import { onCLS, onINP, onLCP } from 'web-vitals'

const send = (metric) => {
  navigator.sendBeacon('/analytics/vitals', JSON.stringify(metric))
}
onCLS(send)
onINP(send)
onLCP(send)
```

> Permet de détecter les régressions dès qu'elles touchent les utilisateurs réels, pas juste le lab.

**Sévérité** : 🟢 P3 (instrumentation, pas optim directe)

---

## Checklist rapide d'audit Runtime

À l'audit, vérifier systématiquement :

- [ ] Pas de long tasks >100ms identifiables dans le profile
- [ ] Boucles lourdes chunkées avec yield au main thread
- [ ] Web Worker utilisé pour computations >50ms (parsing, crypto, image manip)
- [ ] Listes >200 items virtualisées (TanStack Virtual, react-window)
- [ ] DOM <1500 nodes par page
- [ ] Pas de wrapper hell (`<div>` imbriqués sans raison)
- [ ] `content-visibility: auto` sur sections below-the-fold (pages longues)
- [ ] Animations sur `transform`/`opacity` uniquement
- [ ] `will-change` localisé et retiré après animation
- [ ] `prefers-reduced-motion` respecté
- [ ] Listeners scroll/touch en `{ passive: true }`
- [ ] Debounce/throttle sur resize/scroll/input
- [ ] AbortController pour cleanup des listeners
- [ ] Event delegation sur listes longues
- [ ] Timers/intervals/observers nettoyés au unmount
- [ ] Pas de detached DOM nodes (heap snapshot vide en "Detached")
- [ ] Web Vitals JS instrumenté en prod (RUM)
