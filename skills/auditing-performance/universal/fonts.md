# Fonts — Patterns & Anti-patterns Perf

Ce fichier couvre l'optimisation des **fonts custom** : formats, `font-display`, preloading,
subsetting, fallback metrics. Les fonts mal gérées dégradent **LCP** (texte invisible jusqu'au
swap), **CLS** (saut de layout au swap), et **bandwidth** (fichiers lourds).

> **Charge** : pertinent dès qu'il y a des fonts custom dans le projet (Google Fonts, fonts
> auto-hébergées, `@fontsource`, etc.). Pour les patterns spécifiques aux composants framework
> (`next/font`, modules Nuxt fonts), voir `frameworks/{vue-nuxt,react-next}.md`.

---

## 1. Format des fonts

### 1.1 Formats legacy (TTF, OTF, EOT, WOFF) servis aux navigateurs modernes

❌ **Problème** : servir TTF/OTF brut → ~50% plus lourd que WOFF2, parsing plus lent.

✅ **Fix** : **WOFF2 uniquement** (supporté par 97%+ des navigateurs depuis 2017). Fallback WOFF inutile en 2026.

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-regular.woff2') format('woff2');  /* ✅ uniquement WOFF2 */
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

**Sévérité** : 🟠 P1 si TTF/OTF servis

### 1.2 Conversion non faite

❌ **Problème** : fonts livrées par le designer en TTF/OTF, servies telles quelles.
✅ **Fix** : convertir en WOFF2 systématiquement (outils : `fonttools`, `woff2_compress`, ou en ligne).

```bash
# fonttools
pip install fonttools brotli
pyftsubset MyFont.ttf --flavor=woff2 --output-file=MyFont.woff2
```

**Sévérité** : 🔴 P0 si fonts custom non converties

---

## 2. `font-display`

### 2.1 `font-display: block` ou `auto` (= block)

❌ **Problème** : pendant le téléchargement de la font (jusqu'à 3s par défaut), le texte est **invisible** (FOIT — Flash of Invisible Text) → LCP catastrophique sur texte LCP.

```css
@font-face {
  font-family: 'Inter';
  src: url('/inter.woff2') format('woff2');
  /* ❌ pas de font-display = block par défaut */
}
```

✅ **Fix** : `font-display: swap` (montre le fallback immédiatement, swap au load)

```css
@font-face {
  font-family: 'Inter';
  src: url('/inter.woff2') format('woff2');
  font-display: swap;  /* ✅ FOUT acceptable, LCP préservé */
}
```

**Métriques** : LCP (P0), FCP
**Sévérité** : 🔴 P0 — détecté par Lighthouse `font-display`

### 2.2 `font-display: optional` mal utilisé

⚠️ **À considérer** : `optional` est le plus performant (pas de swap = pas de CLS, font utilisée seulement si chargée en <100ms), mais peut afficher la fallback à des users sur connexion lente **pour toute la session**.

✅ **Pattern** : `optional` pour fonts "nice-to-have" non critiques, `swap` par défaut.

```css
/* Police d'icône custom : optional acceptable */
@font-face {
  font-family: 'IconsCustom';
  src: url('/icons.woff2') format('woff2');
  font-display: optional;
}
```

**Sévérité** : 🟡 P2 (choix nuancé)

### 2.3 `font-display: fallback`

⚠️ **À considérer** : compromis entre `swap` (FOUT possible toute la vie de la session) et `optional` (font ignorée si lente). `fallback` donne 100ms de FOIT puis switche en fallback définitif si pas chargé en 3s.

**Recommandation** : rarement le bon choix — préférer `swap` ou `optional` selon le cas.

---

## 3. Preloading des fonts critiques

### 3.1 Pas de preload sur la font LCP

❌ **Problème** : la font est découverte uniquement à la lecture du CSS → cascade :
HTML → CSS → font → render → LCP. Latence cumulée.

✅ **Fix** : preload de la (ou des) font(s) utilisée(s) dans le LCP

```html
<link
  rel="preload"
  as="font"
  type="font/woff2"
  href="/fonts/inter-bold.woff2"
  crossorigin>
```

⚠️ **`crossorigin` obligatoire** même pour fonts same-origin (sinon le preload est ignoré et la font re-téléchargée).

**Métriques** : LCP (P0), FCP
**Sévérité** : 🔴 P0 sur fonts utilisées dans le LCP

### 3.2 Preload de toutes les fonts du site

❌ **Problème** : preloader 5 weights "au cas où" → contention bande passante avec image LCP.
✅ **Fix** : preload **uniquement** les 1-2 fonts utilisées dans le LCP (souvent un weight regular + un bold).

**Sévérité** : 🟠 P1 si bande passante limitée

### 3.3 Preload sans `crossorigin`

❌ **Problème** : preload effectué mais ignoré par le navigateur → font re-téléchargée → preload inutile.
✅ **Fix** : toujours `crossorigin` sur preload de font.

**Sévérité** : 🔴 P0 — le preload ne sert à rien sans

---

## 4. Self-hosting vs CDN tiers (Google Fonts)

### 4.1 Google Fonts via `<link>`

❌ **Problème** : utiliser `<link href="https://fonts.googleapis.com/...">` ajoute :
- Une connexion DNS + TLS supplémentaire (200-500ms en cold)
- Une cascade : HTML → CSS Google → fichier font Google
- Une dépendance externe (non RGPD-compliant en l'état pour l'UE)
- Pas de contrôle sur le cache header

✅ **Fix** : self-host les fonts
- **Manuel** : télécharger via [google-webfonts-helper](https://gwfh.mranftl.com/), servir en local
- **Outils** : `@fontsource/inter` (npm), `next/font/google` (Next), `@nuxtjs/google-fonts` avec `download: true` (Nuxt), `unplugin-fonts`

```ts
// Exemple @fontsource (universal)
import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
```

**Métriques** : LCP (P1), TTFB des fonts
**Sévérité** : 🟠 P1 + risque RGPD (dépend du contexte légal)

### 4.2 Self-hosting sans cache headers long-lived

❌ **Problème** : fonts auto-hébergées sans `Cache-Control` → re-télécharger à chaque visite.
✅ **Fix** : `Cache-Control: public, max-age=31536000, immutable` (cf `universal/network.md`).

**Sévérité** : 🟠 P1

### 4.3 `preconnect` aux origines de font tierces (si conservées)

✅ **Pattern** : si Google Fonts conservées (court terme avant migration), au moins `preconnect`

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

**Sévérité** : 🟡 P2 (mitigation, pas vraie solution)

---

## 5. Subsetting

### 5.1 Font complète chargée pour quelques scripts utilisés

❌ **Problème** : Inter complète = ~120KB par weight (Latin + Cyrillic + Greek + Vietnamese + etc.). Si ton site est uniquement en français, tu charges ~80KB de glyphes inutiles.

✅ **Fix** : subset au build sur les scripts réellement utilisés

```bash
# Latin uniquement (couvre français, anglais, espagnol, italien, etc.)
pyftsubset Inter-Regular.ttf \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
  --flavor=woff2 \
  --output-file=Inter-Regular-latin.woff2
```

> Outils : `pyftsubset` (fonttools), `glyphhanger` (auto-détection des glyphes utilisés), `subfont`.

**Métriques** : LCP (P1), bandwidth
**Sévérité** : 🟠 P1 si fonts non subsettées

### 5.2 Subset par langue active

✅ **Pattern avancé** : si site multilingue, charger les subsets correspondants au `lang` détecté

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;  /* ✅ Latin */
}
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-cyrillic.woff2') format('woff2');
  unicode-range: U+0400-045F, U+0490-0491;  /* ✅ Cyrillique */
}
```

Le navigateur charge **uniquement** les subsets nécessaires aux glyphes utilisés sur la page.

**Sévérité** : 🟡 P2 (gain réel uniquement sur sites multilingues)

---

## 6. Variable fonts

### 6.1 Multiples fichiers statiques au lieu d'une variable font

❌ **Problème** : 6 weights × 2 styles (italic/normal) = 12 fichiers statiques = ~720KB total.
✅ **Fix** : variable font unique = ~150-250KB couvrant tous les weights/styles.

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-variable.woff2') format('woff2-variations');
  font-weight: 100 900;  /* ✅ tous les weights couverts */
  font-style: normal italic;  /* ✅ italique inclus si variable */
  font-display: swap;
}
```

> Note : utile uniquement si tu utilises **plusieurs weights**. Une variable font pour 1 seul weight est plus lourde qu'un fichier statique unique.

**Sévérité** : 🟠 P1 si >3 weights statiques chargés

### 6.2 Variable font pour un seul weight utilisé

❌ **Problème** : variable font ~250KB chargée alors qu'un seul weight 400 est utilisé → ~200KB perdus.
✅ **Fix** : statique single-weight (~30-50KB).

**Sévérité** : 🟡 P2

---

## 7. Match fallback metrics (zéro CLS au swap)

### 7.1 CLS au swap font fallback → font custom

❌ **Problème** : Arial (fallback) et Inter (custom) ont des métriques différentes (line-height, character-width). Au swap, le texte se "réajuste" → CLS.

✅ **Fix moderne** : `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` sur le `@font-face` du fallback

```css
@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial');
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}

body {
  font-family: 'Inter', 'Inter Fallback', sans-serif;
}
```

> Outils pour calculer les métriques : [Fontaine](https://github.com/danielroe/fontaine), [Capsize](https://seek-oss.github.io/capsize/).

> **Note** : `next/font` fait ça automatiquement avec `adjustFontFallback`.

**Métriques** : CLS (P0)
**Sévérité** : 🔴 P0 sur sites avec fonts custom et CLS détecté

### 7.2 Pas de fallback approprié

❌ **Problème** : `font-family: 'Inter'` sans fallback → si Inter ne charge pas, fallback navigateur arbitraire (Times New Roman souvent).

✅ **Fix** : stack de fallback cohérente avec la font custom

```css
/* Sans-serif moderne */
body { font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

/* Serif */
body { font-family: 'Merriweather', Georgia, 'Times New Roman', serif; }

/* Monospace */
code { font-family: 'JetBrains Mono', Menlo, Monaco, Consolas, monospace; }
```

**Sévérité** : 🟠 P1

---

## 8. Quantité de weights & variantes

### 8.1 Surcharge de weights inutiles

❌ **Problème** : charger 8 weights × italic = 16 fichiers = 1-2MB de fonts pour usage marginal.
✅ **Fix** : auditer le CSS réel — la plupart des designs utilisent 2-3 weights max (regular 400 + bold 700, parfois medium 500).

**Sévérité** : 🟠 P1

### 8.2 Italique chargée mais non utilisée

❌ **Problème** : `font-style: italic` jamais utilisé dans le CSS → fichier italique inutile.
✅ **Fix** : auditer avec un grep `font-style: italic` ou via DevTools "Coverage".

**Sévérité** : 🟡 P2

---

## 9. Icon fonts (anti-pattern)

### 9.1 Icon fonts (FontAwesome, Material Icons full set)

❌ **Problème** : icon font complète = ~150-300KB pour parfois 5 icônes utilisées. Plus :
- Pas de redimensionnement vectoriel optimal (subpixel rendering)
- Pas d'a11y native
- FOIT = icônes invisibles ou carrés au load

✅ **Fix moderne** : SVG inline, SVG sprite (`<use href="#icon">`), ou icon component lib (`lucide`, `heroicons`, `phosphor`)

```vue
<!-- ✅ uniquement les icônes utilisées sont bundled -->
<script setup>
import { Search, User } from 'lucide-vue-next'
</script>

<template>
  <Search :size="20" />
</template>
```

**Métriques** : LCP, bundle
**Sévérité** : 🔴 P0 si icon font full chargée

### 9.2 Si vraiment besoin d'icon font : subset

✅ **Fix** : générer un icon font custom contenant uniquement les icônes utilisées (Fontello, IcoMoon).

**Sévérité** : 🟠 P1 (mieux que 9.1 mais SVG reste préférable)

---

## 10. Cache & livraison

### 10.1 Cache header court ou absent

❌ **Problème** : font sans `Cache-Control` long → re-download à chaque visite.
✅ **Fix** : fonts avec hash dans l'URL (immutable) → cache 1 an

```
Cache-Control: public, max-age=31536000, immutable
```

> Couvert plus en détail dans `universal/network.md`.

**Sévérité** : 🟠 P1

### 10.2 Compression gzip/brotli sur WOFF2

❌ **Anti-pattern** : appliquer gzip/brotli sur WOFF2 → **dégrade légèrement** la perf (WOFF2 est déjà compressé, double compression = overhead CPU pour 0 gain).

✅ **Fix** : exclure les fichiers `.woff2` de la compression au niveau du serveur/CDN.

**Sévérité** : 🟢 P3

---

## Checklist rapide d'audit Fonts

À l'audit, vérifier systématiquement :

- [ ] Fonts servies en **WOFF2 uniquement** (pas TTF/OTF/EOT)
- [ ] `font-display: swap` (ou `optional` pour non-critiques) sur **toutes** les `@font-face`
- [ ] Fonts utilisées dans le LCP **preloadées** avec `crossorigin`
- [ ] Pas de preload abusif (max 2-3 fonts)
- [ ] Self-hosting (pas de Google Fonts CDN tiers — RGPD + perf)
- [ ] Cache header long-lived sur fonts
- [ ] Subsets cohérents avec les langues utilisées
- [ ] Variable font si >3 weights utilisés
- [ ] `size-adjust` / `ascent-override` sur fallback pour zéro CLS
- [ ] Stack de fallback cohérente (sans-serif/serif/monospace)
- [ ] 2-3 weights maximum chargés (audit du CSS réel)
- [ ] Italique uniquement si réellement utilisé
- [ ] **Aucune icon font** (préférer SVG)
- [ ] Compression désactivée pour WOFF2
