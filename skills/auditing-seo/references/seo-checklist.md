# SEO Checklist — Référence détaillée

## Table des matières
1. [Crawlabilité & Indexation](#1-crawlabilité--indexation)
2. [Balises Meta & On-Page](#2-balises-meta--on-page)
3. [Performance & Core Web Vitals](#3-performance--core-web-vitals)
4. [Structure des URLs](#4-structure-des-urls)
5. [Données Structurées](#5-données-structurées-schemaorg)
6. [Rendu JavaScript](#6-rendu-javascript)
7. [Linking interne](#7-linking-interne--architecture)
8. [Contenu](#8-contenu--qualité)
9. [Mobile](#9-mobile--accessibilité-seo)
10. [Sécurité](#10-sécurité--technique)

---

## 1. Crawlabilité & Indexation

### robots.txt
| Contrôle | Criticité | Vérification |
|----------|-----------|--------------|
| Fichier présent à la racine | P1 | GET /robots.txt → 200 |
| Sitemap référencé | P2 | `Sitemap: https://...` présent |
| Aucun blocage involontaire de pages importantes | P0 | `Disallow: /` absent, pas de `/` générique |
| User-agent * couvert | P2 | Règles générales définies |
| Pas de blocage des assets JS/CSS | P1 | Googlebot doit accéder aux ressources |

### sitemap.xml
| Contrôle | Criticité | Vérification |
|----------|-----------|--------------|
| Fichier présent | P1 | GET /sitemap.xml ou /sitemap_index.xml → 200 |
| Format XML valide | P1 | Validation W3C |
| Toutes les URLs canoniques présentes | P1 | Comparer avec pages importantes |
| `<lastmod>` renseigné | P3 | Format ISO 8601 |
| `<priority>` cohérent | P3 | 0.0–1.0, pages importantes = 0.8+ |
| `<changefreq>` réaliste | P3 | Ne pas mettre "always" partout |
| Taille < 50k URLs ou splitté | P2 | Sitemap index si > 50k |
| URLs retournent 200 | P0 | Pas de 301/404 dans le sitemap |
| Pas d'URLs avec noindex dans le sitemap | P1 | Cohérence sitemap ↔ meta robots |

### Balises robots & canonicals
| Contrôle | Criticité | Vérification |
|----------|-----------|--------------|
| Pas de `noindex` involontaire | P0 | Vérifier toutes les pages importantes |
| Canonical self-referencing présent | P2 | `<link rel="canonical" href="URL_exacte">` |
| Pas de canonical pointant vers une 404 | P0 | Vérifier les liens canoniques |
| Pas de chaîne canonical A→B→C | P1 | Canon direct vers l'URL finale |
| Canonical cohérent avec les redirections | P1 | Pas de canonical sur page redirigée |

### Redirections
| Contrôle | Criticité | Vérification |
|----------|-----------|--------------|
| 301 (permanent) et non 302 pour les permanents | P1 | Headers HTTP |
| Pas de chaînes > 2 sauts | P1 | A→B→C = à corriger |
| Pas de redirect loops | P0 | A→B→A |
| HTTP → HTTPS en 301 | P1 | Tous les chemins HTTP redirigent |
| www ↔ non-www cohérent | P1 | Choisir une version canonique |

---

## 2. Balises Meta & On-Page

### Title
| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| Présent sur toutes les pages | P0 | `<title>` non vide |
| Unique par page | P1 | Pas de titles dupliqués |
| Longueur 50–60 caractères | P2 | Éviter la troncature dans les SERPs |
| Mot-clé principal en début | P2 | Ex: "Plombier Paris 75 – Intervention rapide" |
| Pas de keyword stuffing | P1 | Max 2–3 répétitions de termes |
| Format cohérent avec la marque | P3 | Ex: "Page | Marque" |

### Meta Description
| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| Présente sur toutes les pages importantes | P2 | Sinon Google génère la sienne |
| Unique par page | P2 | Pas de descriptions dupliquées |
| Longueur 120–158 caractères | P2 | Éviter la troncature |
| Contient un appel à l'action | P3 | "Découvrez, Réservez, Téléchargez…" |
| Inclut le mot-clé principal | P2 | Google le bolde dans les SERPs |

### Structure H1–H6
| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| Un seul H1 par page | P1 | Pas 0, pas 2 |
| H1 différent du title (mais cohérent) | P3 | Complément, pas copier-coller |
| Hiérarchie logique H1→H2→H3 | P2 | Pas de saut H1→H4 |
| Mots-clés dans les H2/H3 | P2 | Variantes sémantiques |
| Pas de balises h* pour le style (usage CSS) | P1 | Sémantique HTML respectée |

### Open Graph & Social
| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| og:title présent | P2 | Peut différer du title SEO |
| og:description présent | P2 | Idéalement ≤ 200 chars |
| og:image présent et valide | P2 | Min 1200×630px, < 8MB |
| og:url = URL canonique | P2 | Cohérence |
| og:type approprié | P3 | website, article, product… |
| twitter:card défini | P3 | summary_large_image recommandé |

### hreflang (si multilingue)
| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| hreflang sur toutes les variantes linguistiques | P1 | Bidirectionnel obligatoire |
| x-default défini | P2 | Langue par défaut |
| Codes langue ISO 639-1 corrects | P1 | fr, en, de… ou fr-FR, en-US |
| URLs hreflang retournent 200 | P0 | Pas de 404/301 |

---

## 3. Performance & Core Web Vitals

### Seuils cibles (Google PageSpeed / Search Console)

| Métrique | Bon | À améliorer | Mauvais |
|----------|-----|-------------|---------|
| LCP | < 2.5s | 2.5–4s | > 4s |
| INP | < 200ms | 200–500ms | > 500ms |
| CLS | < 0.1 | 0.1–0.25 | > 0.25 |
| TTFB | < 800ms | 800ms–1.8s | > 1.8s |
| FCP | < 1.8s | 1.8–3s | > 3s |

### Images
| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| Attribut `alt` sur toutes les images | P1 | Non vide pour images informatives, `alt=""` pour déco |
| Format moderne (WebP/AVIF) | P2 | Gain 25–50% vs JPEG |
| Dimensions explicites width/height | P1 | Prévient le CLS |
| Lazy loading sur images hors viewport | P2 | `loading="lazy"` |
| LCP image preloaded | P1 | `<link rel="preload" as="image">` |
| Pas d'images surdimensionnées | P2 | Srcset responsive |
| Compression optimale | P2 | Tools: Squoosh, Sharp |

### JavaScript & CSS
| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| Pas de render-blocking scripts | P1 | `defer` ou `async` ou module |
| Code splitting en place | P2 | Bundles par route |
| Arbre de dépendances optimisé | P2 | Pas de lodash entier importé |
| CSS critique inline | P2 | Above-the-fold sans FOUC |
| Pas de CSS inutilisé massif | P2 | PurgeCSS ou équivalent |
| Service Worker / Cache | P3 | Améliore les visites récurrentes |

### Fonts
| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| `font-display: swap` ou `optional` | P2 | Évite le FOIT |
| Self-hosted vs Google Fonts | P2 | Self-host pour TTFB + privacy |
| Preconnect aux origines fonts | P2 | `<link rel="preconnect">` |
| Nombre de variantes limité | P3 | ≤ 2–3 familles, ≤ 4 weights |

---

## 4. Structure des URLs

| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| URLs lisibles et descriptives | P2 | `/services/plomberie` pas `/p?id=42` |
| Lowercase uniquement | P1 | Évite les duplicats |
| Tirets comme séparateurs | P1 | `/mon-article` pas `/mon_article` |
| Pas de paramètres d'URL inutiles | P2 | Canonicals si tracking params |
| Profondeur ≤ 3 niveaux | P2 | `/categorie/sous-cat/article` |
| Longueur < 75 caractères | P3 | Confort utilisateur + SERP |
| Trailing slash cohérent | P1 | Choisir et 301 l'autre |
| Pas d'encodage inutile | P2 | Éviter les `%20` dans les slugs |
| Extension absente ou cohérente | P3 | Pas de .html si non nécessaire |

---

## 5. Données Structurées (Schema.org)

### Types prioritaires selon contexte

| Type de site | Schemas recommandés |
|-------------|---------------------|
| Tout site | Organization, WebSite (+ SearchAction), BreadcrumbList |
| Blog/Article | Article (ou BlogPosting, NewsArticle) |
| E-commerce | Product, Offer, AggregateRating |
| Local business | LocalBusiness (ou spécialisation) + GeoCoordinates |
| FAQ | FAQPage |
| Événements | Event |
| Recettes | Recipe |
| Emploi | JobPosting |

### Contrôles généraux
| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| JSON-LD utilisé (pas Microdata) | P2 | Google préfère JSON-LD |
| Validation sans erreurs | P1 | https://search.google.com/test/rich-results |
| Données cohérentes avec le contenu visible | P0 | Pas de cloaking schema |
| Propriétés requises renseignées | P1 | Cf. schema.org pour chaque type |
| @id unique et stable | P2 | URL canonique de la page |

---

## 6. Rendu JavaScript

### Vue SPA (Client-Side Rendering)
| Contrôle | Criticité | Problème |
|----------|-----------|---------|
| Contenu critique dans le HTML initial | P0 | Sans SSR, Googlebot doit exécuter JS |
| Pre-rendering ou SSG en place | P1 | Pages statiques > crawl JS |
| Pas de contenu important derrière `v-if` initial | P1 | Peut ne pas être crawlé |
| Navigation entre pages = full page ou pushState | P2 | SPA routing doit mettre à jour l'URL |

### Nuxt SSR/SSG
| Contrôle | Criticité | Problème |
|----------|-----------|---------|
| HTML renvoyé contient le contenu | P0 | Vérifier `curl URL` sans JS |
| `useSeoMeta()` ou `useHead()` utilisés | P1 | Meta dynamiques dans le SSR |
| Pas d'erreur d'hydratation | P1 | Mismatch serveur/client = CLS |
| Routes dynamiques dans le sitemap | P1 | `nuxt generate` ou module sitemap |
| `nuxt.config.ts` : ssr: true par défaut | P2 | Sauf si SSG intentionnel |

---

## 7. Linking interne & Architecture

| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| Pas de pages orphelines importantes | P1 | Toute page accessible depuis la nav |
| Profondeur max 3 clics depuis la home | P2 | Audit avec crawler (Screaming Frog) |
| Ancres descriptives | P2 | "Nos services de plomberie" > "cliquez ici" |
| Pas de liens internes cassés (404) | P1 | Crawler ou extension browser |
| Liens vers pages importantes depuis la home | P2 | PageRank interne |
| Pagination : rel canonical vers page 1 | P2 | Évite le contenu dupliqué |
| Breadcrumbs présents + balisés | P2 | UX + Schema BreadcrumbList |

---

## 8. Contenu & Qualité

| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| Contenu dupliqué interne | P1 | Canonicals ou redirections |
| Contenu dupliqué externe | P1 | Canonical vers la source originale |
| Thin content (< 300 mots sur pages importantes) | P2 | Enrichir ou noindex |
| Keyword stuffing | P1 | Densité naturelle < 3% |
| Contenu mis à jour régulièrement | P3 | Signal de fraîcheur |
| Contenu multimédia varié | P3 | Images, vidéos, infographies |

---

## 9. Mobile & Accessibilité SEO

| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| Viewport meta présent | P0 | `<meta name="viewport" content="width=device-width, initial-scale=1">` |
| Responsive design fonctionnel | P0 | Mobile-First indexing Google |
| Tap targets ≥ 48×48px | P1 | Boutons/liens accessibles au doigt |
| Pas de contenu masqué sur mobile | P2 | Google indexe la version mobile |
| Interstitials non intrusifs | P1 | Pop-ups = pénalité possible |
| Texte lisible sans zoom | P2 | Font-size ≥ 16px pour le corps |

---

## 10. Sécurité & Technique

| Contrôle | Criticité | Règle |
|----------|-----------|-------|
| HTTPS actif | P0 | Certificat valide, non expiré |
| HTTP → HTTPS 301 | P1 | Tous les chemins HTTP redirigent |
| Pas de mixed content | P1 | Assets HTTP sur page HTTPS |
| En-têtes sécurité basiques | P3 | HSTS, X-Frame-Options, CSP |
| Pas de fuite d'informations sensibles | P1 | Pas de `.git`, `.env` accessibles |

---

## Outils de référence

| Outil | Usage | URL |
|-------|-------|-----|
| Google Search Console | Données d'indexation réelles | search.google.com/search-console |
| PageSpeed Insights | CWV lab + field data | pagespeed.web.dev |
| Rich Results Test | Validation Schema | search.google.com/test/rich-results |
| Mobile Friendly Test | Test responsive | search.google.com/test/mobile-friendly |
| Screaming Frog | Crawl technique | screamingfrog.co.uk |
| ahrefs / Semrush | Backlinks + mots-clés | (premium) |
| Web.dev Measure | Lighthouse complet | web.dev/measure |
| Schema.org Validator | Validation JSON-LD | validator.schema.org |
