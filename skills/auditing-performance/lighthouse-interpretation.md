# Lighthouse Interpretation Guide

Ce fichier sert de **pivot** quand l'utilisateur fournit un rapport Lighthouse.
Pour chaque métrique Core Web Vital ou audit Lighthouse, il indique :
- Les causes probables ordonnées par fréquence
- Les fichiers de référence à consulter
- Les pièges d'interprétation à connaître

> **Usage** : commence toujours par identifier les métriques en zone "Poor" ou "Needs improvement",
> remonte aux causes via les sections ci-dessous, puis charge les fichiers de référence pour
> formuler les findings et les fixes.

---

## Métriques Core Web Vitals + autres clés Lighthouse

### LCP — Largest Contentful Paint

**Définition** : temps avant le rendu du plus grand élément visible above-the-fold (image, bloc texte, vidéo poster, background image).

**Seuils** : ≤ 2.5s = 🟢 Good · 2.5–4s = 🟠 Needs improvement · > 4s = 🔴 Poor

**Causes probables (par fréquence terrain)** :
1. **Image LCP non optimisée** : mauvais format (JPEG vs AVIF/WebP), absence de `fetchpriority="high"`, image lazy par erreur, pas de `srcset` adapté → `universal/images.md`
2. **Render-blocking resources** : CSS ou JS synchrones dans le `<head>` → `universal/bundle.md`, `universal/network.md`
3. **Server response time élevé** (TTFB > 600ms) : pas de cache CDN, SSR lent, edge mal configuré → `universal/network.md`, `frameworks/{vue-nuxt|react-next}.md`
4. **Web fonts qui retardent le LCP texte** : pas de `font-display: swap`, fonts non préchargées → `universal/fonts.md`
5. **Hydration bloquante** (Nuxt/Next SSR) qui retarde le repaint → `frameworks/{vue-nuxt|react-next}.md`
6. **Third-parties bloquants** insérés dans le head (tags marketing, A/B test) → `universal/third-parties.md`

**Audits Lighthouse à lire en priorité** :
- `largest-contentful-paint-element` (identifie l'élément exact)
- `lcp-lazy-loaded` (image LCP marquée lazy par erreur)
- `prioritize-lcp-image` (manque de `fetchpriority`)
- `render-blocking-resources`
- `server-response-time`

**Piège** : le LCP element peut différer entre mobile et desktop (viewport différent). Toujours auditer les deux si la cible est mixte. Croiser avec CrUX (données réelles utilisateurs) si dispo.

---

### INP — Interaction to Next Paint

**Définition** : temps de réponse à la **pire** interaction utilisateur (clic, tap, keypress) durant la session. Remplace FID depuis mars 2024.

**Seuils** : ≤ 200ms = 🟢 Good · 200–500ms = 🟠 Needs improvement · > 500ms = 🔴 Poor

**Causes probables** :
1. **Long tasks JS** qui bloquent le main thread (handlers lourds, calculs synchrones) → `universal/runtime.md`
2. **Re-renders massifs** après interaction (memoization absente, dépendances mal scopées) → `universal/runtime.md`, `frameworks/{vue-nuxt|react-next}.md`
3. **Hydration partielle** qui bloque les interactions au-dessus du fold → `frameworks/{vue-nuxt|react-next}.md`
4. **Third-parties** qui s'exécutent au mauvais moment (analytics, A/B test, chat widget) → `universal/third-parties.md`
5. **Calculs lourds dans le main thread** alors qu'ils pourraient être en Web Worker → `universal/runtime.md`
6. **DOM trop volumineux** (>1500 nodes) qui ralentit chaque update → `universal/runtime.md`

**Audits Lighthouse à lire** :
- `interaction-to-next-paint`
- `long-tasks`
- `total-blocking-time` (proxy de l'INP en lab)
- `mainthread-work-breakdown`

**Piège** : INP est mesuré **en réel uniquement** (RUM/CrUX). Lighthouse en lab ne donne qu'une approximation via TBT. Pour vraiment auditer l'INP, utiliser la Web Vitals Chrome Extension ou les données CrUX/RUM.

---

### CLS — Cumulative Layout Shift

**Définition** : somme cumulée des décalages visuels imprévus pendant le chargement et la session.

**Seuils** : ≤ 0.1 = 🟢 Good · 0.1–0.25 = 🟠 Needs improvement · > 0.25 = 🔴 Poor

**Causes probables** :
1. **Images sans dimensions explicites** (`width`/`height` ou `aspect-ratio` CSS) → `universal/images.md`
2. **Web fonts avec FOUT** : swap de la fallback vers la custom qui change les métriques → `universal/fonts.md`
3. **Bannières / ads / embeds** insérés dynamiquement above-the-fold (cookie banner, ads display) → `universal/third-parties.md`
4. **Composants qui changent de taille après hydration** (skeleton mal dimensionné, contenu différent SSR vs CSR) → `frameworks/{vue-nuxt|react-next}.md`
5. **Animations sur `width`/`height`/`top`/`left`** au lieu de `transform`/`opacity` → `universal/runtime.md`
6. **Lazy loading sans placeholder dimensionné** → `universal/images.md`

**Audits Lighthouse à lire** :
- `layout-shifts` (identifie les éléments qui shift)
- `unsized-images`
- `font-display`

**Piège** : un CLS bas en lab peut être catastrophique en réel si l'utilisateur scrolle rapidement. Le CLS en CrUX inclut la session entière, pas juste le load.

---

### TBT — Total Blocking Time

**Définition** : somme du temps "bloquant" des long tasks (>50ms, on compte uniquement le surplus au-dessus de 50ms) entre FCP et TTI. Proxy lab de l'INP.

**Seuils** : ≤ 200ms = 🟢 Good · 200–600ms = 🟠 Needs improvement · > 600ms = 🔴 Poor

**Causes probables** :
1. **Bundle JS trop gros** qui parse/compile longtemps au boot → `universal/bundle.md`
2. **Hydration synchrone** d'un grand arbre de composants → `frameworks/{vue-nuxt|react-next}.md`
3. **Third-parties** qui s'exécutent au load (tag manager, analytics, A/B test) → `universal/third-parties.md`
4. **Polyfills inutiles** servis aux navigateurs modernes → `universal/bundle.md`, `build-config.md`
5. **Code mort** non éliminé par tree shaking → `universal/bundle.md`, `build-config.md`

**Audits Lighthouse à lire** :
- `total-blocking-time`
- `bootup-time` (parse/compile JS par script)
- `mainthread-work-breakdown` (répartition par catégorie)
- `third-party-summary`
- `legacy-javascript`

---

### FCP — First Contentful Paint

**Définition** : temps avant le premier rendu de contenu (texte, image, SVG, canvas non blanc).

**Seuils** : ≤ 1.8s = 🟢 Good · 1.8–3s = 🟠 Needs improvement · > 3s = 🔴 Poor

**Causes probables** :
1. **CSS render-blocking** dans le `<head>` (feuilles entières au lieu de critical CSS) → `universal/bundle.md`, `universal/network.md`
2. **TTFB élevé** (serveur lent, pas d'edge caching, SSR coûteux) → `universal/network.md`, `frameworks/{vue-nuxt|react-next}.md`
3. **Web fonts** qui retardent le rendu (FOIT sans `font-display`) → `universal/fonts.md`
4. **JS render-blocking** dans le head sans `defer`/`async` → `universal/bundle.md`

**Audits Lighthouse à lire** :
- `first-contentful-paint`
- `render-blocking-resources`
- `unminified-css`, `unminified-javascript`
- `server-response-time`
- `redirects` (chain de redirects qui retarde le HTML)

---

### Speed Index

**Définition** : vitesse à laquelle le contenu visible est progressivement peint pendant le chargement (calculé via captures vidéo).

**Seuils** : ≤ 3.4s = 🟢 Good · 3.4–5.8s = 🟠 Needs improvement · > 5.8s = 🔴 Poor

**Causes probables** : combinaison de FCP + LCP + render progressif. Si FCP et LCP sont bons mais SI dégradé, regarder :
1. **CSS qui charge en plusieurs vagues** (split mal calibré) → `universal/bundle.md`, `universal/network.md`
2. **Images qui se chargent en cascade visible** (pas de prioritization) → `universal/images.md`
3. **Animations d'entrée** qui retardent l'apparition (fade-in lent, skeleton trop long) → `universal/runtime.md`
4. **Hydration progressive mal séquencée** → `frameworks/{vue-nuxt|react-next}.md`

---

## Audits Lighthouse "Opportunities" → fichier de référence

Quand Lighthouse liste une opportunité dans le rapport, voici où chercher les fixes :

| Audit Lighthouse | Fichier(s) de référence |
|---|---|
| `unused-javascript` | `universal/bundle.md` |
| `unused-css-rules` | `universal/bundle.md` |
| `unminified-javascript`, `unminified-css` | `build-config.md` |
| `modern-image-formats` | `universal/images.md` |
| `uses-optimized-images` | `universal/images.md` |
| `efficient-animated-content` | `universal/images.md` |
| `offscreen-images` | `universal/images.md` |
| `uses-responsive-images` | `universal/images.md` |
| `preload-fonts` | `universal/fonts.md` |
| `font-display` | `universal/fonts.md` |
| `uses-text-compression` | `universal/network.md`, `build-config.md` |
| `uses-long-cache-ttl` | `universal/network.md` |
| `uses-rel-preconnect` | `universal/network.md` |
| `uses-rel-preload` | `universal/network.md`, `universal/fonts.md` |
| `third-party-summary` | `universal/third-parties.md` |
| `third-party-facades` | `universal/third-parties.md` |
| `legacy-javascript` | `universal/bundle.md`, `build-config.md` |
| `bootup-time` | `universal/bundle.md`, `universal/runtime.md` |
| `mainthread-work-breakdown` | `universal/runtime.md` |
| `dom-size` | `universal/runtime.md`, `frameworks/{vue-nuxt|react-next}.md` |
| `duplicated-javascript` | `universal/bundle.md`, `build-config.md` |
| `non-composited-animations` | `universal/runtime.md` |

---

## Pièges d'interprétation à connaître

1. **Lighthouse en lab ≠ utilisateur réel** : le rapport simule des conditions standardisées (Moto G Power, Slow 4G, CPU throttling 4x). Les chiffres en RUM (CrUX, Web Vitals JS) sont la vérité terrain. **Toujours croiser** quand c'est possible — un site peut être 90/100 en lab et catastrophique en réel (ou inversement).

2. **Variabilité du score** : le perf score Lighthouse peut varier de **±5 points** entre deux runs identiques (jitter CPU, network). Faire 3 runs minimum, garder la médiane. Un audit avant/après doit comparer des médianes, pas des runs uniques.

3. **INP n'est pas mesuré en lab** : Lighthouse renvoie TBT comme proxy. Pour vraiment auditer l'INP, utiliser la Web Vitals Chrome Extension (mode dev) ou les données CrUX (PageSpeed Insights → onglet "Real Experience").

4. **LCP element peut changer entre viewports** : selon mobile/desktop, le LCP n'est pas le même élément. Auditer mobile **et** desktop séparément si la cible est mixte.

5. **"Opportunities" classées par savings estimés ≠ priorités réelles** : Lighthouse classe par "estimated savings" en ms, mais ces estimations sont souvent optimistes (modèle théorique). Croiser avec l'impact réel sur LCP/INP/CLS — un fix qui économise 200ms en théorie mais ne touche pas le LCP path n'apportera rien.

6. **Score 100/100 ≠ site rapide** : un site peut avoir 100/100 sur une page vide et être catastrophique sur la home avec contenu dynamique, recommandations, ads. **Toujours auditer les pages critiques business** (home, landing, PDP, checkout), pas juste l'about page.

7. **Cache warm vs cold** : Lighthouse audit en cold load par défaut (cache vide). En réel, beaucoup d'utilisateurs reviennent et ont du cache. Pour mesurer l'impact du cache, utiliser DevTools en désactivant `Disable cache` ou comparer Lighthouse vs CrUX.

8. **Server response time biaisé par la localisation** : si Lighthouse run depuis un datacenter US et que le serveur est en EU, le TTFB est gonflé. Utiliser PageSpeed Insights (run depuis plusieurs régions) ou WebPageTest avec localisation contrôlée.

9. **Mode incognito recommandé** : extensions Chrome (adblockers, password managers, etc.) faussent les mesures Lighthouse. Toujours auditer en navigation privée ou via PageSpeed Insights.

10. **"Estimated savings" ne s'additionnent pas** : si Lighthouse dit "économie X ms" sur 5 audits différents, le total ne sera pas la somme. Beaucoup de fixes interagissent (ex: réduire le JS améliore aussi le TBT et l'INP). Estimer prudemment.
