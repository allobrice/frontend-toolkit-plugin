# Images — Patterns & Anti-patterns Perf

Ce fichier couvre l'optimisation des images : formats, responsive, lazy loading, priority hints,
prévention du CLS. Les images sont **la cause #1 d'un mauvais LCP** et une source majeure de CLS.

> **Charge** : ce fichier est presque toujours pertinent — quasi tous les projets ont des images.
> Pour les patterns spécifiques aux composants framework (`<NuxtImg>`, `next/image`),
> voir `frameworks/vue-nuxt.md` et `frameworks/react-next.md`. Ce fichier couvre les **principes
> universels** + les patterns hors composants framework.

---

## 1. Formats modernes

### 1.1 JPEG/PNG seuls servis

❌ **Problème** : JPEG ~30% plus lourd que WebP, ~50% plus lourd que AVIF à qualité équivalente.

✅ **Fix** : servir AVIF en priorité, WebP en fallback, JPEG en dernier recours via `<picture>`

```html
<picture>
  <source srcset="/hero.avif" type="image/avif">
  <source srcset="/hero.webp" type="image/webp">
  <img src="/hero.jpg" alt="..." width="1200" height="600">
</picture>
```

> Avec un composant framework (`<NuxtImg format="avif,webp">`, `next/image` config formats),
> c'est automatique.

**Métriques** : LCP (P0)
**Sévérité** : 🔴 P0 sur image LCP, 🟠 P1 sur images below-the-fold

### 1.2 PNG pour photos

❌ **Problème** : PNG sur photos = 2-5x plus lourd que JPEG/WebP pour aucun gain visuel.
✅ **Fix** : PNG **uniquement** pour transparence + flat colors (logos, illustrations vectorisables). Photos → JPEG/WebP/AVIF.

**Sévérité** : 🟠 P1

### 1.3 SVG inline non optimisé

❌ **Problème** : SVG exporté de Figma/Illustrator brut → métadonnées, commentaires, paths non compressés (~10x plus gros que nécessaire).

✅ **Fix** : passer chaque SVG par SVGO (`svgo` CLI ou plugins build : `vite-plugin-svgr`, `vite-svg-loader`).

```bash
npx svgo --multipass icons/*.svg
```

**Sévérité** : 🟡 P2 par icône, 🟠 P1 si beaucoup d'icônes inline

### 1.4 GIF animé pour contenu vidéo

❌ **Problème** : GIF = compression catastrophique (10-100x plus lourd qu'une vidéo équivalente), pas de hardware decoding.

✅ **Fix** : `<video>` autoplay loop muted

```html
<video autoplay loop muted playsinline width="600" height="400" poster="/poster.jpg">
  <source src="/loop.webm" type="video/webm">
  <source src="/loop.mp4" type="video/mp4">
</video>
```

**Métriques** : LCP, transfer size
**Sévérité** : 🔴 P0 si GIF >500KB

---

## 2. Images responsive (srcset / sizes)

### 2.1 Image unique servie à toutes les résolutions

❌ **Problème** : une image 2000px de large servie à un mobile qui n'en affiche que 400px → 4-10x trop de KB.

✅ **Fix** : `srcset` avec densité ou tailles, et `sizes` cohérent avec le CSS

```html
<!-- Par tailles (recommandé) -->
<img
  src="/photo-800.jpg"
  srcset="
    /photo-400.jpg  400w,
    /photo-800.jpg  800w,
    /photo-1200.jpg 1200w,
    /photo-2000.jpg 2000w"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
  alt="..." width="800" height="600">
```

**Métriques** : LCP (P0), transfer size
**Sévérité** : 🔴 P0 sur images >viewport mobile

### 2.2 `sizes` mal calibré

❌ **Problème** : `sizes="100vw"` partout → mobile télécharge la grande version inutilement.
✅ **Fix** : `sizes` doit refléter la **taille CSS réelle** de l'image dans le layout

```html
<!-- Mauvais : 100vw alors que l'image fait 50% du viewport sur desktop -->
<img sizes="100vw" srcset="..." />

<!-- Bon : reflète le CSS réel -->
<img sizes="(max-width: 768px) 100vw, 50vw" srcset="..." />
```

**Sévérité** : 🟠 P1

### 2.3 Art direction non utilisée pour ratios différents

❌ **Problème** : même image en 16:9 servie sur mobile alors qu'un crop carré 1:1 serait plus pertinent → image surdimensionnée + cadrage mauvais.

✅ **Fix** : `<picture>` avec `<source media="...">`

```html
<picture>
  <source media="(max-width: 768px)" srcset="/hero-portrait.webp" type="image/webp">
  <source media="(min-width: 769px)" srcset="/hero-landscape.webp" type="image/webp">
  <img src="/hero-landscape.jpg" alt="..." width="1200" height="600">
</picture>
```

**Sévérité** : 🟡 P2

---

## 3. Lazy loading & eager loading

### 3.1 Image LCP en `loading="lazy"`

❌ **Problème** : marquer l'image LCP en lazy retarde son download → LCP catastrophique.

```html
<!-- ❌ image LCP lazy -->
<img src="/hero.jpg" loading="lazy" alt="..." />
```

✅ **Fix** : `loading="eager"` (défaut) ou pas d'attribut sur l'image LCP. Lazy uniquement below-the-fold.

**Métriques** : LCP (P0)
**Sévérité** : 🔴 P0 — souvent détecté par Lighthouse `lcp-lazy-loaded`

### 3.2 Pas de lazy loading sur images below-the-fold

❌ **Problème** : galerie de 50 images chargées au load → bande passante gaspillée, hydration ralentie.
✅ **Fix** : `loading="lazy"` sur tout ce qui est below-the-fold.

```html
<img src="/feature.jpg" loading="lazy" alt="..." width="400" height="300">
```

**Métriques** : LCP indirect (économie bande passante), TBT
**Sévérité** : 🟠 P1 sur galeries / listes longues

### 3.3 Lazy loading sans placeholder dimensionné

❌ **Problème** : image lazy → div de hauteur 0 → quand l'image charge, layout shift massif.
✅ **Fix** : toujours `width`/`height` ou `aspect-ratio` CSS (voir §6).

**Sévérité** : 🔴 P0 (cause majeure de CLS)

---

## 4. Priority hints (`fetchpriority`, `preload`)

### 4.1 Pas de `fetchpriority="high"` sur image LCP

❌ **Problème** : navigateur découvre l'image LCP en parsant le HTML → download avec priority "auto" → potentiellement après d'autres ressources.

✅ **Fix** : `fetchpriority="high"` sur l'image LCP

```html
<img
  src="/hero.jpg"
  fetchpriority="high"
  alt="..."
  width="1200" height="600">
```

**Métriques** : LCP (P0)
**Sévérité** : 🔴 P0 — détecté par Lighthouse `prioritize-lcp-image`

### 4.2 Preload de l'image LCP dans le `<head>`

✅ **Pattern complémentaire** : preload pour anticiper le download avant que le HTML soit complètement parsé

```html
<link
  rel="preload"
  as="image"
  href="/hero.webp"
  imagesrcset="/hero-800.webp 800w, /hero-1200.webp 1200w"
  imagesizes="(max-width: 768px) 100vw, 1200px"
  fetchpriority="high">
```

> Particulièrement utile pour les images LCP servies via `background-image` CSS (voir §8).

**Sévérité** : 🟠 P1 (gain souvent 100-500ms sur LCP)

### 4.3 `fetchpriority="low"` sur images non critiques

✅ **Pattern** : sur images below-the-fold ou décoratives, baisser la priorité libère la bande passante pour le LCP.

```html
<img src="/decorative.jpg" fetchpriority="low" loading="lazy" alt="">
```

**Sévérité** : 🟢 P3

### 4.4 Trop de preloads concurrents

❌ **Problème** : preloader 5 images "au cas où" → contention bande passante avec le LCP réel.
✅ **Fix** : preload UNIQUEMENT l'image LCP de la page courante.

**Sévérité** : 🟠 P1

---

## 5. Decoding

### 5.1 `decoding="sync"` ou absence sur images below-the-fold

❌ **Problème** : décodage synchrone bloque le main thread (peu sur images petites, sensible sur grandes).
✅ **Fix** : `decoding="async"` sur tout sauf LCP

```html
<img src="/feature.jpg" loading="lazy" decoding="async" alt="...">
```

**Métriques** : INP (P2), TBT
**Sévérité** : 🟢 P3 (gain marginal mais cumulatif sur pages avec beaucoup d'images)

### 5.2 `decoding="async"` sur image LCP

❌ **Problème** : l'image LCP arrive mais reste invisible le temps du décodage async → LCP sous-estimé puis dégradé.
✅ **Fix** : laisser `decoding` par défaut (ou `sync`) sur image LCP.

**Sévérité** : 🟡 P2

---

## 6. Prévention du CLS (dimensions)

### 6.1 `width`/`height` absents

❌ **Problème** : navigateur ne réserve pas l'espace → quand l'image charge, push du contenu en dessous → CLS.

```html
<!-- ❌ pas de dimensions -->
<img src="/photo.jpg" alt="...">
```

✅ **Fix** : toujours fournir `width` et `height` (ratio intrinsèque)

```html
<!-- ✅ ratio préservé même en responsive -->
<img src="/photo.jpg" width="800" height="600" alt="..." style="width:100%; height:auto">
```

**Métriques** : CLS (P0)
**Sévérité** : 🔴 P0 — cause majeure de CLS

### 6.2 `aspect-ratio` CSS comme alternative

✅ **Pattern moderne** : si dimensions intrinsèques inconnues mais ratio connu (placeholder, art direction)

```css
.hero-img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
```

**Sévérité** : équivalent à 6.1

### 6.3 Container fluide sans dimensions enfant

❌ **Problème** : parent `display: flex` qui calcule sa taille selon les enfants → image lazy fait grossir le parent au load.
✅ **Fix** : `min-height` ou `aspect-ratio` sur le container, ou dimensions fixes sur l'enfant.

**Sévérité** : 🟠 P1

---

## 7. CDN & services d'optimisation

### 7.1 Pas d'optimisation à la volée

❌ **Problème** : images statiques dans `/public` servies brutes → pas de format moderne, pas de redimensionnement, pas de compression auto.

✅ **Fix** : utiliser une couche d'optimisation
- **Built-in** : `next/image`, `<NuxtImg>`, Astro Image, SvelteKit `enhanced:img`
- **CDN dédié** : Cloudinary, Imgix, Cloudflare Images, ImageKit
- **Self-hosted** : `imgproxy`, `thumbor`

> Le built-in du framework est presque toujours le meilleur choix (gratuit, intégré, optimisé pour
> le SSR/streaming). CDN externe pertinent si workflow image complexe ou multi-app.

**Sévérité** : 🔴 P0 si projet >50 images sans optim

### 7.2 CDN sans cache long-lived

❌ **Problème** : CDN qui re-download à chaque requête → coût + perf.
✅ **Fix** : `Cache-Control: public, max-age=31536000, immutable` sur images avec hash dans l'URL.

**Sévérité** : 🟠 P1 (couvert plus en détail dans `universal/network.md`)

### 7.3 Optimisation au build vs à la volée

- **Build-time** : SVGO, `vite-imagetools`, Astro Image — optimal pour images statiques connues
- **On-demand** : `next/image` runtime, Cloudinary, etc. — nécessaire pour user uploads

Choisir selon le use case. Mixer les deux est ok.

---

## 8. Background images & cas particuliers

### 8.1 LCP en `background-image` CSS

❌ **Problème** : les images CSS sont découvertes **après** le CSSOM → download retardé → LCP plombé.

✅ **Fix** : préférer `<img>` pour les LCP. Si vraiment besoin de background, **preload** explicite

```html
<link rel="preload" as="image" href="/hero-bg.jpg" fetchpriority="high">
```

**Métriques** : LCP (P0)
**Sévérité** : 🔴 P0

### 8.2 Sprites CSS pour icônes

❌ **Problème** : pattern legacy, charge un fichier monolithique pour 1 icône utilisée.
✅ **Fix** : SVG inline, SVG sprite via `<use>`, ou icon font moderne (sub-set).

**Sévérité** : 🟡 P2

### 8.3 Hero video poster manquant

❌ **Problème** : `<video>` autoplay sans `poster` → écran noir avant que la vidéo soit décodée → LCP dégradé.
✅ **Fix** : toujours fournir `poster="/poster.jpg"` qui devient le LCP element.

**Sévérité** : 🟠 P1

---

## 9. Placeholders (LQIP, BlurHash, dominant color)

### 9.1 Pas de placeholder → flash blanc

❌ **Problème** : image lazy charge → flash blanc → contenu apparaît brusquement → mauvais ressenti UX (et parfois CLS si dimensions absentes).

✅ **Fix** : placeholder léger pendant le chargement
- **Couleur dominante** : ~30 bytes, simple, fonctionne partout (`background-color`)
- **LQIP (Low-Quality Image Placeholder)** : version 20px de l'image, blurry — ~500-1500 bytes
- **BlurHash** : encodage compact ~30 chars, décodé en JS

> `next/image` propose `placeholder="blur"` natif. `<NuxtImg>` propose `placeholder` en prop.

**Sévérité** : 🟢 P3 (UX, gain perceptuel)

### 9.2 Placeholder lourd (>5KB)

❌ **Problème** : LQIP "haute qualité" qui pèse autant que l'image elle-même.
✅ **Fix** : LQIP <2KB, idéalement <500 bytes.

**Sévérité** : 🟡 P2

---

## 10. Compression & qualité

### 10.1 Qualité 100 sur photos

❌ **Problème** : qualité 100 sur JPEG/WebP/AVIF n'apporte rien de visible mais double le poids.
✅ **Fix** : qualité 75-85 est le sweet spot pour photos (imperceptible vs 100, ~50% plus léger).

**Sévérité** : 🟠 P1

### 10.2 Pas de redimensionnement avant upload

❌ **Problème** : photo source 4000×3000 servie pour un thumbnail 200×200 → 60x trop de pixels.
✅ **Fix** : redimensionner au build ou via service à la demande (cf. §7).

**Sévérité** : 🔴 P0 si le poids est significatif

### 10.3 Métadonnées EXIF non strippées

❌ **Problème** : photos source contiennent EXIF (GPS, modèle d'appareil, miniature) → ~10-100KB de "déchet" par image + risque privacy.
✅ **Fix** : strip à l'optimisation (`mozjpeg`, `sharp` avec `withMetadata: false`).

**Sévérité** : 🟡 P2

---

## Checklist rapide d'audit Images

À l'audit, vérifier systématiquement :

- [ ] Image LCP identifiée (Lighthouse `largest-contentful-paint-element`)
- [ ] Image LCP en AVIF/WebP avec fallback JPEG
- [ ] Image LCP **non** lazy
- [ ] Image LCP avec `fetchpriority="high"`
- [ ] Image LCP preload dans le head (si background ou framework spécifique)
- [ ] `width`/`height` ou `aspect-ratio` sur **toutes** les images
- [ ] `srcset` + `sizes` sur images responsive
- [ ] `loading="lazy"` sur images below-the-fold
- [ ] `decoding="async"` sur images non-LCP
- [ ] Pas de GIF >500KB (→ vidéo)
- [ ] PNG uniquement pour transparence + flat colors
- [ ] SVG passés par SVGO
- [ ] CDN ou pipeline d'optimisation en place
- [ ] Background images LCP preloadées
- [ ] Hero videos avec `poster`
- [ ] Placeholders <2KB (couleur dominante, LQIP, BlurHash)
- [ ] Qualité 75-85 sur photos
- [ ] Pas de photos source (4000px+) en production
- [ ] Cache long-lived sur images hashées
