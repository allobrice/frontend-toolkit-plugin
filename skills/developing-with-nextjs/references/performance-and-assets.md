# Performance et ressources

En App Router, la première source de performance est **l'architecture** : moins de JavaScript
client, static shell maximal, données lues au serveur sans cascade. Les composants `next/*`
traitent le reste. Audit complet (Lighthouse, Core Web Vitals) : skill `auditing-performance`.

## Sommaire

1. Ordre des leviers
2. Éviter les cascades de données
3. Réduire le JavaScript client
4. `next/image`
5. `next/font`
6. `next/script` et scripts tiers
7. `next/dynamic` et chargement différé
8. React Compiler
9. Mesurer

---

## 1. Ordre des leviers

1. **Frontière `'use client'` basse** : chaque Client Component inutile est du JavaScript à
   télécharger, parser et hydrater.
2. **Static shell maximal** (`data-and-caching.md` §8) : navigations instantanées, TTFB du CDN.
3. **Pas de cascade** : lectures parallèles, préchargement.
4. **Cache explicite** des données partagées et stables.
5. **Images et polices** via `next/image` et `next/font` (LCP, CLS).
6. **Scripts tiers** différés.
7. **Mémoïsation** : React Compiler, jamais à la main par réflexe.

---

## 2. Éviter les cascades de données

```tsx
// ❌ Séquentiel : la seconde requête attend la première sans en dépendre
const user = await getUser(id)
const orders = await getOrders(id)

// ✅ Parallèle
const [user, orders] = await Promise.all([getUser(id), getOrders(id)])
```

- Mieux encore : **découper en composants** sous des `<Suspense>` distincts, chacun lisant sa donnée
  — ils se rendent en parallèle et streament indépendamment.
- Composants parent / enfant qui attendent chacun leur donnée en série : démarrer la lecture tôt
  (fonction de préchargement qui appelle la fonction DAL mémoïsée sans `await`) ou remonter la
  promesse.
- Pas de `fetch` vers un Route Handler de la même app depuis un Server Component : appeler la DAL.

---

## 3. Réduire le JavaScript client

- Une page entièrement `'use client'` est presque toujours une erreur de découpage.
- Les librairies lourdes (markdown, coloration syntaxique, dates) utilisées pour **afficher**
  restent dans des Server Components : elles ne partent pas dans le bundle.
- Imports nommés et librairies tree-shakables.
- Turbopack Bundle Analyzer (16.1+, enrichi en 16.4) pour identifier les plus gros contributeurs
  par route ; la skill officielle `next-bundle-optimizer` automatise ce diagnostic si elle est
  installée.

---

## 4. `next/image`

```tsx
import Image from 'next/image'

<Image src={product.imageUrl} alt={product.name} width={640} height={480} sizes="(min-width: 768px) 50vw, 100vw" />

// Image LCP au-dessus de la ligne de flottaison
<Image src={hero} alt="" priority sizes="100vw" />
```

- `width` / `height` (ou `fill` + conteneur dimensionné) pour éviter le CLS.
- `sizes` dès que l'image n'occupe pas une largeur fixe, sinon le navigateur télécharge trop gros.
- `priority` (ou l'équivalent documenté dans la version installée) **uniquement** pour l'image LCP.
- `alt` descriptif ; `alt=""` pour une image décorative.
- Images distantes : `images.remotePatterns` (et non `images.domains`, déprécié). Sources locales
  avec query string : `images.localPatterns`. Modifications de config : avec validation.
- Défauts 16 : `qualities: [75]`, `minimumCacheTTL` de 4 h — ne pas passer `quality` hors de la
  liste configurée.

---

## 5. `next/font`

```tsx
// app/fonts.ts
import { Inter } from 'next/font/google'

export const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })

// app/layout.tsx
<html lang="fr" className={inter.variable}>
```

- Polices auto-hébergées au build, sans requête vers Google à l'exécution, sans CLS.
- Déclarer chaque police une seule fois, dans un module partagé ; l'exposer en variable CSS et la
  consommer dans le SCSS (`font-family: var(--font-inter)`).
- `next/font/local` pour une police propriétaire.

---

## 6. `next/script` et scripts tiers

- `strategy="afterInteractive"` (défaut) ou `"lazyOnload"` pour l'analytics, le chat, les widgets ;
  `"beforeInteractive"` seulement pour un script réellement requis avant hydratation.
- Préférer les intégrations officielles (`@next/third-parties`) quand elles existent dans le projet.
- Chaque script tiers est une dette de performance : le justifier.

---

## 7. `next/dynamic` et chargement différé

```tsx
'use client'
import dynamic from 'next/dynamic'

const RichTextEditor = dynamic(() => import('./RichTextEditor'), {
  loading: () => <EditorSkeleton />,
})
```

- Pour un composant client lourd, rarement affiché ou affiché après interaction (éditeur, carte,
  graphique).
- `ssr: false` uniquement dans un Client Component, et seulement pour du code qui ne peut pas
  s'exécuter côté serveur ; React 19.3 propose aussi `use(browser())` pour sortir un composant du
  rendu serveur sous `<Suspense>`.
- Un Server Component n'a pas besoin de `next/dynamic` : il ne part pas dans le bundle.

---

## 8. React Compiler

- `reactCompiler: true` à la racine de `next.config.ts` (stable depuis 16.0, non activé par défaut ;
  compilation plus lente via Babel). Version Rust expérimentale :
  `experimental.turbopackRustReactCompiler` (16.3+).
- Activation = modification de config : avec validation.
- Compilateur actif → pas de `useMemo` / `useCallback` / `memo` dans le code neuf (cf.
  `developing-react` → `references/performance.md`).

---

## 9. Mesurer

- Dev : Instant Insights et Navigation Inspector (16.3+) pour les navigations lentes ; logs de
  requête qui séparent compilation et rendu.
- Build : `next build` affiche le temps par étape et le type de rendu de chaque route ; les routes
  qui ne produisent pas de static shell sont signalées.
- Production : Core Web Vitals réels (RUM) plutôt que le seul Lighthouse local.
- Ne déclarer une optimisation que mesurée avant / après.
