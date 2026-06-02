# Network & Cache — Patterns & Anti-patterns Perf

Ce fichier couvre la couche **réseau et cache** : protocole HTTP, compression, cache headers,
CDN, resource hints, Service Workers, TTFB. C'est ce qui détermine combien de temps les ressources
mettent à arriver — affecte directement **LCP, FCP, TTFB**.

> **Charge** : pertinent dès qu'on audite les performances de transfert, le TTFB, ou que
> Lighthouse remonte des audits réseau (`uses-text-compression`, `uses-long-cache-ttl`,
> `uses-rel-preconnect`, `server-response-time`).

---

## 1. Protocole HTTP

### 1.1 HTTP/1.1 servi alors que HTTP/2 est disponible

❌ **Problème** : HTTP/1.1 limite à ~6 connexions parallèles par origine, head-of-line blocking → cascades visibles dans le waterfall.

✅ **Fix** : activer HTTP/2 (a minima) ou HTTP/3 sur le serveur/CDN
- **Cloudflare, Vercel, Netlify, Fastly** : HTTP/2 et HTTP/3 par défaut
- **nginx** : `listen 443 ssl http2;` (HTTP/2) + module QUIC pour HTTP/3
- **Caddy, Traefik** : HTTP/2 par défaut

✅ **Vérification** : DevTools → Network → colonne "Protocol" doit afficher `h2` ou `h3`. Sinon `http/1.1`.

**Métriques** : LCP (P0), FCP, parallel loading
**Sévérité** : 🔴 P0 si HTTP/1.1 confirmé (rare aujourd'hui, mais arrive sur certains hébergeurs vieillissants)

### 1.2 HTTP/3 (QUIC) non activé

✅ **Pattern moderne** : HTTP/3 sur UDP élimine le head-of-line blocking au niveau transport, gain notable en mobile et réseau instable.

> Cloudflare, Fastly, Vercel, AWS CloudFront supportent HTTP/3. Activer via leur dashboard.

**Métriques** : LCP en mobile/3G/4G instable (P1)
**Sévérité** : 🟡 P2 (gain marginal sur fibre, sensible sur mobile)

### 1.3 Multi-origin abusé (anti-pattern legacy HTTP/1.1)

❌ **Problème** : sharder les assets sur plusieurs sous-domaines (`static1.example.com`, `static2.example.com`) — pattern HTTP/1.1 obsolète qui multiplie les handshakes TLS sous HTTP/2/3.

✅ **Fix** : tout sur une seule origine, laisser HTTP/2/3 multiplexer.

**Sévérité** : 🟠 P1 si pattern détecté

---

## 2. Compression

### 2.1 Pas de compression Brotli/Gzip

❌ **Problème** : HTML/CSS/JS servis non compressés → poids transfert x3-5.

✅ **Fix** : compression activée au niveau serveur ou CDN
- **Brotli** (préféré) : ~15-25% plus petit que gzip pour HTML/CSS/JS
- **Gzip** (fallback) : universel, toujours activer

```nginx
# nginx
gzip on;
gzip_types text/html text/css application/javascript application/json image/svg+xml;
gzip_min_length 1024;
gzip_comp_level 6;

brotli on;
brotli_types text/html text/css application/javascript application/json image/svg+xml;
brotli_comp_level 6;
```

> Vercel, Netlify, Cloudflare, Vercel : compression auto, brotli inclus.
> Nuxt : `nitro.compressPublicAssets: { brotli: true, gzip: true }`.
> Next : `compress: true` (défaut).

**Métriques** : LCP, FCP, TTFB
**Sévérité** : 🔴 P0 — détecté par Lighthouse `uses-text-compression`

### 2.2 Compression appliquée à des assets déjà compressés

❌ **Problème** : compresser à nouveau WOFF2, JPEG, PNG, WebP, AVIF, MP4 → CPU gaspillé pour ~0% de gain.

✅ **Fix** : exclure ces extensions de la compression

```nginx
gzip_types text/html text/css application/javascript application/json image/svg+xml;
# ❌ pas image/jpeg, image/png, image/webp, font/woff2, video/mp4
```

**Sévérité** : 🟢 P3 (CPU server, pas perf front directe)

### 2.3 Niveau de compression mal calibré

❌ **Problèmes** :
- **Niveau trop bas** (gzip 1, brotli 1-3) : transfert plus lourd
- **Niveau trop haut** (gzip 9, brotli 11) : CPU server + latence (compression à la volée)

✅ **Fix** :
- **À la volée** (dynamic responses) : gzip 6, brotli 4-5
- **Statique** (assets pré-compressés au build) : gzip 9, brotli 11 (qualité max)

```ts
// Vite : pré-compression au build
import compression from 'vite-plugin-compression'

export default {
  plugins: [
    compression({ algorithm: 'gzip', threshold: 1024 }),
    compression({ algorithm: 'brotliCompress', threshold: 1024, ext: '.br' })
  ]
}
```

**Sévérité** : 🟡 P2

---

## 3. Cache headers

### 3.1 Pas de `Cache-Control` sur assets statiques

❌ **Problème** : assets re-téléchargés à chaque visite → expérience returning user catastrophique.

✅ **Fix** : `Cache-Control: public, max-age=31536000, immutable` sur assets avec hash dans l'URL

```
# Sur /assets/main-a3f2b9c.js
Cache-Control: public, max-age=31536000, immutable
```

**`immutable`** dit au navigateur : ne re-valide jamais, le contenu ne change pas (l'URL hashée garantit cette propriété).

**Métriques** : LCP/FCP sur visites récurrentes (P0)
**Sévérité** : 🔴 P0 — détecté par Lighthouse `uses-long-cache-ttl`

### 3.2 Cache trop court sur HTML

❌ **Problème** : `Cache-Control: max-age=3600` sur HTML → utilisateur ne voit pas les nouvelles versions pendant 1h.
✅ **Fix** : HTML en `no-cache` + revalidation via ETag, ou court max-age + `must-revalidate`

```
# HTML
Cache-Control: no-cache, must-revalidate
ETag: "a3f2b9c"
```

> `no-cache` ≠ `no-store`. `no-cache` = "vérifie avant d'utiliser" (304 possible). `no-store` = "ne stocke jamais" (à éviter sauf data sensibles).

**Sévérité** : 🟠 P1 selon use case

### 3.3 Cache headers absents sur réponses API

❌ **Problème** : API qui retournent du JSON cacheable (catalogue, config publique) sans `Cache-Control` → tap serveur à chaque requête.

✅ **Fix** : `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` sur les réponses cacheables

**Sévérité** : 🟠 P1 (gain TTFB)

### 3.4 `stale-while-revalidate` sous-utilisé

✅ **Pattern** : `stale-while-revalidate` permet de servir une réponse stale immédiatement, tout en revalidant en arrière-plan. UX instantanée + fraîcheur.

```
Cache-Control: public, max-age=60, stale-while-revalidate=86400
```

→ pendant 60s : cache frais. Entre 60s et 86460s : sert le cache stale + revalide en background. Au-delà : revalidation bloquante.

**Sévérité** : 🟡 P2 (mais gain TTFB perçu énorme)

### 3.5 `Vary: *` ou Vary mal calibré

❌ **Problème** : `Vary: *` → cache jamais hit. `Vary: Cookie` → cache jamais hit en présence de cookies session.
✅ **Fix** : `Vary: Accept-Encoding` (compression) + `Vary: Accept` (formats image négociés). Éviter `Vary: Cookie` si possible.

**Sévérité** : 🟠 P1 sur sites avec sessions

---

## 4. CDN & edge

### 4.1 Pas de CDN devant le serveur d'origine

❌ **Problème** : utilisateurs servis directement depuis le serveur d'origine → latence proportionnelle à la distance géographique. Un utilisateur australien sur un serveur EU = +200-300ms de RTT minimum.

✅ **Fix** : CDN global devant l'origine
- **Vercel, Netlify** : intégré, gratuit jusqu'à un seuil
- **Cloudflare** : couche gratuite généreuse, edge functions
- **AWS CloudFront, Fastly, Bunny.net** : enterprise / haute volumétrie

**Métriques** : LCP (P0), TTFB
**Sévérité** : 🔴 P0 si trafic international sans CDN

### 4.2 CDN sans cache hit ratio mesuré

❌ **Problème** : CDN configuré mais cache hit ratio bas (<50%) → coûts gonflés + perf dégradée.
✅ **Fix** : auditer le cache hit ratio dans le dashboard CDN. Cibler >85% sur assets statiques.

**Causes courantes de miss** :
- Headers `Cache-Control: private` sur assets publics
- Query strings variables non normalisés
- `Vary` mal configuré
- TTL trop courts

**Sévérité** : 🟠 P1

### 4.3 Edge functions non utilisées

✅ **Pattern moderne** : exécuter du code (auth, A/B test, geo redirect, image transforms) **à l'edge** au lieu du serveur d'origine → -200ms latence.
- **Vercel Edge Functions, Cloudflare Workers, Netlify Edge Functions, Fastly Compute@Edge**

```ts
// Vercel Edge Function
export const config = { runtime: 'edge' }
export default async function handler(request) {
  const country = request.geo?.country
  return new Response(`Hello from ${country}`)
}
```

**Métriques** : TTFB (P1)
**Sévérité** : 🟡 P2 (architecture, pas fix simple)

### 4.4 Image optimization à l'edge non utilisée

✅ **Pattern** : Cloudflare Images, Vercel Image Optimization, Imgix → resize/format à la volée à l'edge, cachable, 0 charge serveur d'origine.

> Couvert plus en détail dans `universal/images.md` §7.

---

## 5. Resource hints

### 5.1 Pas de `preconnect` sur origines tierces critiques

❌ **Problème** : connexion DNS + TLS coûte 100-300ms. Sans preconnect, c'est facturé au moment du fetch → cascade.

✅ **Fix** : `preconnect` aux origines tierces utilisées tôt

```html
<link rel="preconnect" href="https://api.example.com">
<link rel="preconnect" href="https://cdn.example.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

> `crossorigin` requis pour origines servant des ressources CORS (fonts, assets crossorigin).

**Métriques** : LCP, FCP
**Sévérité** : 🟠 P1 — détecté par Lighthouse `uses-rel-preconnect`

### 5.2 `preconnect` abusif (>4-5 origines)

❌ **Problème** : preconnect à 10 origines tue les bénéfices (limite navigateur sur connexions parallèles).
✅ **Fix** : `preconnect` aux 2-4 origines critiques. Pour les autres, `dns-prefetch` (plus léger).

```html
<link rel="dns-prefetch" href="https://analytics.example.com">  <!-- ✅ DNS uniquement -->
```

**Sévérité** : 🟠 P1

### 5.3 `preload` mal utilisé

❌ **Problèmes courants** :
- Preload de ressources non utilisées immédiatement → bandwidth gaspillé
- Preload sans `as="..."` → preload ignoré
- Preload de fonts sans `crossorigin` → re-téléchargement (cf `universal/fonts.md` §3.3)

✅ **Fix** : preload UNIQUEMENT pour ressources critiques au LCP

```html
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high">
<link rel="preload" as="font" type="font/woff2" href="/inter-bold.woff2" crossorigin>
```

**Sévérité** : 🔴 P0 si preload manquant sur LCP / 🟠 P1 si preload abusif

### 5.4 `prefetch` pour navigations probables

✅ **Pattern** : `<link rel="prefetch">` télécharge en background avec basse priorité, prêt si l'user navigue

```html
<link rel="prefetch" href="/produits">
```

> Frameworks modernes (Nuxt, Next) le font automatiquement sur les `<NuxtLink>`/`<Link>` visibles.

**Sévérité** : 🟡 P2

### 5.5 `modulepreload` pour ES modules

✅ **Pattern** : `modulepreload` parse + compile les ES modules en avance (équivalent moderne de `preload as="script"` mais optimisé pour les modules).

```html
<link rel="modulepreload" href="/assets/main-a3f2b9c.js">
```

> Vite et Rollup l'injectent automatiquement.

**Sévérité** : 🟡 P2

---

## 6. Service Worker & cache stratégies

### 6.1 Pas de Service Worker pour cache offline / stale-while-revalidate côté client

✅ **Pattern** : SW intercepte les requêtes, sert depuis cache, revalide en background

**Stratégies courantes** :
- **Cache-first** : assets statiques (JS/CSS/images hashés)
- **Network-first** : data dynamiques (avec fallback cache si offline)
- **Stale-while-revalidate** : meilleur compromis pour la plupart des cas
- **Network-only** : auth, mutations (pas cacheables)

✅ **Fix** : Workbox (le standard), `vite-plugin-pwa`, `@vite-pwa/nuxt`, `@ducanh2912/next-pwa`

```ts
// Workbox (Vite PWA)
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'

registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({ cacheName: 'images' })
)
```

**Métriques** : LCP/FCP sur visites récurrentes (P1)
**Sévérité** : 🟠 P1 sur applications visited fréquemment

### 6.2 Service Worker mal invalidé après deploy

❌ **Problème** : SW sert une vieille version après deploy → users bloqués sur ancienne app.
✅ **Fix** : versioning du SW + `skipWaiting()` + `clients.claim()` au deploy. Tester l'invalidation systématiquement.

**Sévérité** : 🔴 P0 si problème (catastrophe UX)

---

## 7. TTFB & temps de réponse serveur

### 7.1 TTFB élevé (>600ms)

❌ **Problème** : `server-response-time` Lighthouse rouge → tout le reste de la perf est plombé.

**Causes courantes** :
1. **Pas de CDN ou cache edge** (cf §4)
2. **SSR coûteux** non caché (cf `frameworks/{vue-nuxt|react-next}.md`)
3. **DB queries N+1** ou non indexées
4. **Cold start** (serverless) — fréquent sur Lambda, Cloud Run, etc.
5. **Geographic distance** entre user et serveur d'origine
6. **Synchronous external calls** dans le path SSR (analytics, CMS lent)

✅ **Fix** : combinaison de cache edge + ISR/SSG quand possible + DB indexes + warm starts

**Métriques** : TTFB (P0), tout en cascade
**Sévérité** : 🔴 P0 si TTFB >600ms en P75

### 7.2 Cold starts sur fonctions serverless

❌ **Problème** : Lambda/Edge Function endormie → 200-2000ms de cold start sur la première requête.
✅ **Fix** :
- Provisioned concurrency (AWS) ou équivalent
- Edge runtimes plus légers (Cloudflare Workers, Vercel Edge — cold start <50ms)
- Warm-up scheduler si pertinent

**Sévérité** : 🟠 P1

---

## 8. Réduction des requêtes

### 8.1 Sous HTTP/2/3 : ne PAS sur-bundler

⚠️ **Changement de paradigme** : sous HTTP/1.1, on cherchait à concaténer (sprite sheets, bundles monolithiques). Sous HTTP/2/3, le multiplexing rend le splitting **viable et préférable** (meilleur cache, parallel loading).

✅ **Fix** : code splitting agressif acceptable sous HTTP/2/3 (cf `universal/bundle.md` §3).

### 8.2 Inline critical CSS

✅ **Pattern** : extraire le CSS critique above-the-fold et l'inline dans le `<head>` → FCP/LCP plus rapides (pas de cascade HTML → CSS)

```html
<head>
  <style>/* Critical CSS inline ~10-15KB */</style>
  <link rel="stylesheet" href="/main.css" media="print" onload="this.media='all'">  <!-- non bloquant -->
</head>
```

> Outils : `critical` (npm), `critters` (par défaut dans Nuxt 3), `next.js: experimental.optimizeCss`.

**Métriques** : FCP (P1), LCP (P1)
**Sévérité** : 🟠 P1 si CSS principal >50KB

### 8.3 Requêtes en chaîne au lieu de parallèles

❌ **Problème** : `await fetch('/a').then(r => fetch('/b'))` → cascade séquentielle alors que les requêtes pourraient être parallèles.
✅ **Fix** : `Promise.all([fetch('/a'), fetch('/b')])`

**Sévérité** : 🟠 P1

---

## 9. Streaming & responses progressives

### 9.1 Pas de streaming SSR

❌ **Problème** : SSR attend toutes les données avant d'envoyer le HTML → TTFB et FCP catastrophiques.
✅ **Fix** : streaming SSR (cf `frameworks/{vue-nuxt|react-next}.md` Suspense).

### 9.2 Server-Sent Events / WebSocket pour updates fréquents

✅ **Pattern** : SSE ou WebSocket pour push server → évite le polling lourd.

```ts
// SSE — léger, unidirectionnel, fonctionne sur HTTP
const events = new EventSource('/api/events')
events.onmessage = (e) => updateUI(JSON.parse(e.data))
```

**Sévérité** : 🟡 P2 (architecture)

---

## 10. Network observability

### 10.1 Pas de monitoring des Core Web Vitals en RUM

✅ **Pattern** : envoyer LCP, INP, CLS, TTFB depuis les vrais users à un backend pour détecter les régressions

```ts
import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals'

const send = (metric) => {
  navigator.sendBeacon('/analytics/vitals', JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    url: location.href,
  }))
}
onCLS(send); onINP(send); onLCP(send); onTTFB(send)
```

**Sévérité** : 🟢 P3 (instrumentation)

### 10.2 Pas de timing headers (Server-Timing)

✅ **Pattern** : `Server-Timing` headers permettent de breakdown le TTFB côté client

```
Server-Timing: db;dur=53, ssr;dur=120, cache;desc="HIT"
```

Visible dans DevTools → Network → Timing → Server Timing.

**Sévérité** : 🟢 P3

---

## Checklist rapide d'audit Network

À l'audit, vérifier systématiquement :

### Protocole
- [ ] HTTP/2 minimum confirmé (DevTools → Network → Protocol = `h2`/`h3`)
- [ ] HTTP/3 activé si CDN le supporte
- [ ] Pas de domain sharding (anti-pattern HTTP/1.1)

### Compression
- [ ] Brotli activé sur HTML/CSS/JS/JSON/SVG
- [ ] Gzip en fallback
- [ ] Compression désactivée sur images / WOFF2 / vidéos

### Cache
- [ ] Assets statiques hashés en `Cache-Control: max-age=31536000, immutable`
- [ ] HTML en `no-cache, must-revalidate`
- [ ] APIs cacheables avec `Cache-Control` adapté
- [ ] `stale-while-revalidate` utilisé sur réponses semi-dynamiques
- [ ] `Vary` correct (`Accept-Encoding`, pas `*`)

### CDN
- [ ] CDN global devant l'origine si trafic international
- [ ] Cache hit ratio >85% sur assets
- [ ] Edge functions évaluées pour auth/redirect/A-B
- [ ] Image optimization edge configurée

### Resource hints
- [ ] `preconnect` aux 2-4 origines critiques
- [ ] `dns-prefetch` sur origines secondaires
- [ ] `preload` sur image LCP + fonts LCP (avec `crossorigin`)
- [ ] Pas de preload abusif

### Service Worker
- [ ] SW configuré pour applications visitées fréquemment
- [ ] Stratégies adaptées (SWR par défaut, network-first pour data)
- [ ] Invalidation testée au deploy

### TTFB
- [ ] TTFB <600ms en P75
- [ ] DB queries indexées
- [ ] Cold starts mitigés (provisioned concurrency / edge runtime)
- [ ] Pas d'appels externes synchrones dans le path SSR

### Critical CSS
- [ ] Critical CSS inline <15KB
- [ ] CSS principal en chargement non bloquant

### Observability
- [ ] Web Vitals JS instrumenté en RUM
- [ ] Server-Timing headers exposés pour debug TTFB
