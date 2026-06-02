# Third-Parties — Patterns & Anti-patterns Perf

Ce fichier couvre l'optimisation des **scripts tiers** : analytics, tag managers, A/B testing,
chat widgets, embeds, CMP (consent management). Ce sont souvent les **plus gros pollueurs perf**
sur les sites en production — il n'est pas rare qu'ils représentent **40-60% du JS exécuté**.

> **Charge** : pertinent dès que Lighthouse remonte `third-party-summary` ou `third-party-facades`,
> ou que l'audit révèle des connexions vers des domaines tiers (analytics, tags marketing, chat,
> embeds). Souvent **le domaine où on trouve le plus gros gain rapide**.

---

## 1. Cartographier les third-parties (méthodologie)

Avant tout fix, il faut **savoir ce qui tourne**. Beaucoup d'équipes ont perdu le compte des tags
empilés au fil des années marketing.

### 1.1 Outils d'audit

- **Lighthouse → `third-party-summary`** : breakdown du temps de blocking par tiers
- **Chrome DevTools → Network** : filtrer par domaine tiers
- **WebPageTest → "Domains"** : vue exhaustive des origines contactées
- **Request Map Generator** (web.dev) : visualisation graphique
- **`Performance` tab → Bottom-up** : temps CPU par script tiers

### 1.2 Inventaire à dresser

| Tiers | Domaine | Poids JS | Temps blocking | Critique business ? |
|---|---|---|---|---|
| Google Analytics 4 | google-analytics.com | XX KB | XX ms | Non (peut être différé) |
| Intercom | intercom.io | XX KB | XX ms | Oui (support live) |
| ... | | | | |

> **Règle** : tout tiers qui n'est ni critique ni gating UX doit être **déféré ou lazy**.

---

## 2. Stratégies de chargement

### 2.1 `<script>` synchrone bloquant

❌ **Problème** : `<script src="...">` sans `async`/`defer` bloque le parser HTML → FCP/LCP catastrophiques.

```html
<!-- ❌ bloque le parsing HTML jusqu'au download + exec -->
<script src="https://analytics.example.com/tag.js"></script>
```

✅ **Fix** : `defer` (exec après parsing) ou `async` (exec dès dispo, ordre indéterminé)

```html
<script src="https://analytics.example.com/tag.js" defer></script>
```

| Attribut | Download | Exécution | Ordre garanti | Bloque parser |
|---|---|---|---|---|
| (rien) | sync | immédiat | oui | 🔴 oui |
| `async` | parallèle | dès dispo | non | non |
| `defer` | parallèle | après parsing | oui | non |
| `type="module"` | parallèle | après parsing | oui | non (defer implicite) |

**Règle** : **`defer` par défaut**. `async` uniquement pour scripts vraiment indépendants (analytics, tracking pixels).

**Métriques** : FCP (P0), LCP (P0), TBT
**Sévérité** : 🔴 P0 si scripts bloquants détectés

### 2.2 Chargement à l'idle

✅ **Pattern** : pour tags non critiques (ad pixels, analytics secondaires), différer au `requestIdleCallback`

```ts
function loadOnIdle(src: string) {
  const load = () => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    document.head.appendChild(s)
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(load, { timeout: 3000 })
  } else {
    setTimeout(load, 2000)
  }
}

loadOnIdle('https://pixel.example.com/track.js')
```

**Sévérité** : 🟠 P1

### 2.3 Chargement à l'interaction (façade pattern)

✅ **Pattern** : remplacer un widget tiers lourd par une **façade légère** qui charge le vrai widget au premier clic / hover.

**Cas d'usage typiques** : YouTube embeds, chat widgets, maps embarquées, lecteurs vidéo lourds.

```html
<!-- Façade légère (~5KB) -->
<button class="youtube-facade" data-id="dQw4w9WgXcQ">
  <img src="/yt-poster-dQw4w9WgXcQ.jpg" alt="...">
  <span class="play-button">▶</span>
</button>

<script>
document.querySelector('.youtube-facade').addEventListener('click', (e) => {
  const id = e.currentTarget.dataset.id
  e.currentTarget.outerHTML = `
    <iframe src="https://www.youtube.com/embed/${id}?autoplay=1"
            allow="accelerated-encoding; autoplay" allowfullscreen></iframe>
  `
})
</script>
```

> Libs prêtes : `lite-youtube-embed`, `lite-vimeo-embed`, `react-lite-youtube-embed`.

**Métriques** : LCP (P0), TBT
**Sévérité** : 🔴 P0 sur YouTube/Vimeo embeds (gain souvent 500KB+ → ~5KB)

### 2.4 Chargement à la visibilité (IntersectionObserver)

✅ **Pattern** : pour iframes/widgets below-the-fold, charger uniquement quand l'utilisateur scroll vers eux

```ts
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      loadWidget(entry.target)
      observer.unobserve(entry.target)
    }
  })
}, { rootMargin: '200px' })  // ✅ 200px de marge pour anticiper

document.querySelectorAll('[data-lazy-widget]').forEach(el => observer.observe(el))
```

**Sévérité** : 🟠 P1

---

## 3. Tag Managers (GTM)

### 3.1 GTM avec dizaines de tags accumulés

❌ **Problème** : container GTM avec 50+ tags hérités → 200-500KB de JS exécuté à chaque page, bloque le main thread.

✅ **Fix** :
- **Audit** : lister tous les tags actifs, identifier les obsolètes
- **Nettoyage** : supprimer tags non utilisés (souvent 30-50% du container)
- **Conditionnels** : déclencher tags uniquement sur les pages pertinentes (pas tous sur "All Pages")

**Métriques** : TBT (P0), INP
**Sévérité** : 🔴 P0 si container >300KB

### 3.2 GTM client-only au lieu de server-side

✅ **Pattern moderne** : **server-side GTM** déplace l'exécution des tags du navigateur user vers un serveur Google Cloud → 0 JS supplémentaire côté client.

> Setup non trivial mais ROI élevé : peut faire passer un score Lighthouse de 60 à 85+ sur sites tracking-lourds.

**Sévérité** : 🟠 P1 sur projets perf-critiques avec tracking lourd

### 3.3 GTM chargé en synchrone

❌ **Problème** : snippet GTM dans le `<head>` sans `async` bloque le rendu.
✅ **Fix** : snippet GTM officiel utilise déjà `async`. Vérifier qu'il n'a pas été modifié.

**Sévérité** : 🔴 P0 si modifié en sync

---

## 4. Analytics

### 4.1 Google Analytics 4 chargé sync ou non différé

❌ **Problème** : GA4 (~50KB minified) chargé tôt → impact TBT.
✅ **Fix** : charger après FCP via `requestIdleCallback` ou via GTM bien configuré.

**Sévérité** : 🟠 P1

### 4.2 Multiples solutions analytics empilées

❌ **Problème** : GA + Hotjar + Mixpanel + Amplitude → 200KB+ de tracking redondant.
✅ **Fix** : auditer l'usage réel. Garder 1-2 outils max. Le reste = dette legacy à éliminer.

**Sévérité** : 🟠 P1

### 4.3 Alternatives légères

✅ **Pattern** : pour analytics simples (pageviews, événements basiques), considérer des libs légères et privacy-friendly :
- **Plausible** (~1KB, no cookies)
- **Fathom** (~2KB)
- **Umami** (~2KB, self-hosted)
- **Simple Analytics** (~3KB)

**Trade-off** : moins de features (pas de funnels avancés, pas de retargeting). Acceptable pour beaucoup de sites.

**Sévérité** : 🟢 P3 (choix produit, pas fix court terme)

### 4.4 Hotjar / FullStory / SessionRecording

❌ **Problème** : ces outils chargent **beaucoup** de JS (100-300KB) pour enregistrer chaque interaction.
✅ **Fix** :
- Activer uniquement sur sample (1-10% des sessions)
- Charger après LCP via idle callback
- Désactiver sur pages de checkout / sensibles (perf + RGPD)

**Sévérité** : 🔴 P0 si actif sur 100% des sessions

---

## 5. Marketing & tracking pixels

### 5.1 Pixels de retargeting empilés

❌ **Problème** : Facebook Pixel + LinkedIn Insight + TikTok Pixel + Pinterest + Snap + ... → chaque pixel 30-80KB.
✅ **Fix** :
- Audit ROI réel par canal (souvent 80% des conversions viennent d'1-2 canaux)
- Désactiver les pixels morts
- Server-side tagging quand possible (Conversion API Facebook, etc.)

**Sévérité** : 🟠 P1

### 5.2 Conversion tracking sur toutes les pages

❌ **Problème** : tag de conversion (Google Ads, Bing) chargé partout alors qu'il ne sert que sur thank-you pages.
✅ **Fix** : conditionnel par page via GTM ou trigger spécifique.

**Sévérité** : 🟡 P2

---

## 6. A/B testing & personalization

### 6.1 Anti-flicker snippet bloquant

❌ **Problème** : Optimizely, VWO, Google Optimize (deprecated) utilisent un "anti-flicker snippet" qui **cache la page** jusqu'au chargement de l'A/B test → FCP/LCP retardé de 1-3s.

```html
<!-- ❌ Anti-flicker bloque le render -->
<style>.async-hide { opacity: 0 !important }</style>
<script>(function(a,s,y,n,c,h,i,d,e){...})()</script>
```

✅ **Fix** :
- **Server-side A/B testing** (Vercel Edge Config, Cloudflare Workers, etc.) → 0 flicker, 0 JS client
- Si A/B client : **timeout réduit** (500ms max) sur l'anti-flicker
- A/B uniquement sur pages où le test tourne réellement

**Métriques** : LCP (P0), FCP
**Sévérité** : 🔴 P0 si anti-flicker actif partout

### 6.2 Personalization render-blocking

❌ **Problème** : moteur de perso (Dynamic Yield, Adobe Target) qui réécrit le DOM avant le render → FCP catastrophique.
✅ **Fix** : déplacer en server-side ou edge.

**Sévérité** : 🔴 P0

---

## 7. Customer support widgets (chat)

### 7.1 Intercom / Zendesk / Crisp / Tawk en eager load

❌ **Problème** : ces widgets pèsent 200-500KB et chargent souvent à l'init de la page → TBT majeur, INP dégradé.

✅ **Fix** : **façade pattern** — afficher un bouton statique léger qui charge le vrai widget au premier clic

```html
<button class="chat-trigger" onclick="loadIntercom()">
  💬 Besoin d'aide ?
</button>

<script>
function loadIntercom() {
  // Insertion du snippet officiel Intercom
  window.intercomSettings = { app_id: 'XXX' }
  const s = document.createElement('script')
  s.src = 'https://widget.intercom.io/widget/XXX'
  s.async = true
  document.body.appendChild(s)
  s.onload = () => window.Intercom('show')
}
</script>
```

**Métriques** : TBT (P0), INP
**Sévérité** : 🔴 P0 — gain typique : -300KB JS, -200ms TBT

### 7.2 Chat widget chargé sur toutes les pages

❌ **Problème** : checkout, formulaires de paiement, pages auth → le chat n'a souvent rien à y faire.
✅ **Fix** : conditionnel par page (whitelist plutôt que blacklist).

**Sévérité** : 🟠 P1

---

## 8. Embeds (YouTube, Twitter, Maps, etc.)

### 8.1 YouTube iframe natif

❌ **Problème** : `<iframe src="youtube.com/embed/...">` charge ~500KB de JS YouTube **même sans interaction**.

✅ **Fix** : façade `lite-youtube-embed`

```html
<lite-youtube videoid="dQw4w9WgXcQ" style="background-image:url('/poster.jpg')"></lite-youtube>
```

→ ~5KB de JS au lieu de 500KB. Charge l'iframe réelle au clic.

**Métriques** : LCP (P0), TBT
**Sévérité** : 🔴 P0

### 8.2 Google Maps iframe

❌ **Problème** : `<iframe src="google.com/maps/embed/...">` charge ~400KB.
✅ **Fix** :
- Image statique **Map Static API** (gratuit pour usage faible) avec lien vers la map interactive
- Ou façade qui charge la vraie map au clic

```html
<a href="https://maps.google.com/?q=Lyon">
  <img src="https://maps.googleapis.com/maps/api/staticmap?center=Lyon&zoom=13&size=600x400&key=KEY"
       alt="Carte de Lyon" width="600" height="400" loading="lazy">
</a>
```

**Sévérité** : 🟠 P1

### 8.3 Twitter / Instagram / Facebook embeds

❌ **Problème** : embeds officiels chargent des MB de JS pour 1 post.
✅ **Fix** : screenshot statique du post + lien vers l'original. Ou re-render manuel HTML/CSS minimal.

**Sévérité** : 🟠 P1

### 8.4 Disqus (commentaires)

❌ **Problème** : Disqus = 500KB+ de JS et tracking lourd.
✅ **Fix** : alternatives légères (Giscus via GitHub Discussions, Cusdis, Hyvor Talk) ou commentaires server-side custom.

**Sévérité** : 🟠 P1

---

## 9. Consent Management Platforms (CMP)

### 9.1 CMP render-blocking

❌ **Problème** : OneTrust, Cookiebot, Didomi, Axeptio chargent souvent en sync au plus haut du `<head>` → FCP retardé de 200-800ms.

✅ **Fix** :
- **Self-host le snippet CMP** plutôt que CDN tiers (évite DNS/TLS additionnel)
- **Charger en `async`** quand possible
- **Pré-décider** côté serveur via cookie persistant pour returning users (pas re-charger la CMP)

**Métriques** : FCP (P0), LCP
**Sévérité** : 🔴 P0 si CMP bloque le render

### 9.2 CMP qui bloque les autres scripts en cascade

❌ **Problème** : config "tout déclencher après consent" → cascade : CMP load → consent UI → click user → all scripts load → LCP final.
✅ **Fix** :
- Charger les scripts essentiels (LCP-critical, layout) **avant** la CMP
- Charger uniquement les scripts tracking/marketing après consent

**Sévérité** : 🟠 P1

### 9.3 CMP custom au lieu de SaaS

✅ **Pattern** : pour besoins simples (cookie banner, opt-in/opt-out basique), une CMP custom maison fait <2KB vs 50-200KB pour les SaaS.

> Trade-off : compliance juridique = travail à faire. Les SaaS sont audités juridiquement.

**Sévérité** : 🟢 P3 (choix produit)

---

## 10. Sandboxing avec Partytown

### 10.1 Scripts tiers en main thread alors qu'ils pourraient être en Worker

✅ **Pattern moderne** : **Partytown** déplace les scripts tiers vers un Web Worker → 0 impact main thread, INP préservé

```html
<!-- Partytown intercepte les scripts marqués type="text/partytown" -->
<script type="text/partytown">
  /* GTM, GA, Facebook Pixel, etc. */
</script>
```

**Cas d'usage idéaux** :
- Google Tag Manager
- Google Analytics
- Facebook Pixel
- Hotjar (parfois)

**Limitations** :
- Setup non trivial (proxy de domaines tiers)
- Certains scripts ne fonctionnent pas (besoin DOM direct, timing critique)
- À tester rigoureusement

**Métriques** : TBT (P0), INP
**Sévérité** : 🟠 P1 sur projets perf-critiques avec tracking obligatoire

### 10.2 iframe sandbox pour widgets risqués

✅ **Pattern** : isoler les widgets tiers (chat, ads, embeds) dans un `<iframe sandbox>` → isolation crash + sécurité + parfois meilleure perf via process séparé.

**Sévérité** : 🟢 P3

---

## 11. Budget & monitoring

### 11.1 Pas de performance budget par tiers

✅ **Pattern** : définir un budget JS max par catégorie de tiers et alerter si dépassé

| Catégorie | Budget JS max | Budget temps blocking |
|---|---|---|
| Analytics | 50 KB | 50 ms |
| Marketing pixels | 80 KB total | 100 ms |
| Chat widget | 0 KB initial (façade) | 0 ms initial |
| Tag Manager | 100 KB | 100 ms |
| **Total tiers** | **300 KB** | **300 ms** |

> Outils : Lighthouse CI (cf `build-config.md` §7.1), `bundlesize`, `SpeedCurve`, Calibre.

**Sévérité** : 🟠 P1 (prévention)

### 11.2 Pas de monitoring d'évolution des tiers

❌ **Problème** : un tiers update son script et passe de 80KB à 200KB → personne ne le voit.
✅ **Fix** : alerting sur poids/timing des tiers en RUM (`PerformanceObserver` sur ressources tierces).

**Sévérité** : 🟡 P2

---

## Checklist rapide d'audit Third-Parties

À l'audit, vérifier systématiquement :

### Inventaire
- [ ] Cartographie complète des tiers actifs
- [ ] Identification des tiers obsolètes / non utilisés
- [ ] Évaluation criticité business par tiers

### Stratégies de chargement
- [ ] Aucun script tiers en sync bloquant
- [ ] `defer` par défaut, `async` uniquement si pertinent
- [ ] Tiers non critiques chargés en `requestIdleCallback`
- [ ] Façades pour widgets lourds (YouTube, chat, maps)
- [ ] Lazy loading via IntersectionObserver pour widgets below-the-fold

### Tag manager
- [ ] Container GTM <300KB
- [ ] Tags conditionnels par page (pas "All Pages")
- [ ] Server-side GTM évalué si tracking lourd

### Analytics
- [ ] Une seule solution principale d'analytics
- [ ] Outils session-recording sur sample (<10%)
- [ ] Alternatives légères évaluées (Plausible, Fathom)

### Marketing pixels
- [ ] Pixels morts éliminés
- [ ] Conversion tracking conditionnel (pas global)
- [ ] Server-side tagging quand possible

### A/B testing
- [ ] Pas d'anti-flicker snippet bloquant >500ms
- [ ] A/B server-side ou edge si possible
- [ ] A/B uniquement sur pages testées

### Chat widgets
- [ ] Façade plutôt qu'eager load
- [ ] Conditionnel par page (pas sur checkout, etc.)

### Embeds
- [ ] YouTube en `lite-youtube-embed` ou équivalent
- [ ] Maps en static + lien (sauf besoin interactif)
- [ ] Social embeds remplacés par screenshots

### CMP
- [ ] CMP non bloquante du render
- [ ] Cookie de décision persistant pour returning users
- [ ] Self-host du snippet CMP

### Sandboxing
- [ ] Partytown évalué pour tracking obligatoire
- [ ] iframe sandbox pour widgets risqués

### Monitoring
- [ ] Performance budget par catégorie de tiers
- [ ] Lighthouse CI avec `third-party-summary` track
- [ ] Alerting sur évolution poids tiers
