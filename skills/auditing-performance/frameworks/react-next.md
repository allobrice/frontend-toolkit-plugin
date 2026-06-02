# React / Next — Patterns & Anti-patterns Perf

Ce fichier couvre les spécificités perf des stacks **React 18, React 19, Next 14 et Next 15**.
Chaque pattern indique le problème, la métrique Core Web Vital impactée, le fix et la sévérité.

> **Charge** : ne consulte ce fichier que si la stack détectée est React/Next
> (présence de `next.config.*`, `package.json` avec `react`/`next`, fichiers `.tsx`/`.jsx`).
> Pour Vue/Nuxt, voir `frameworks/vue-nuxt.md`.

> **Note Next** : ce fichier privilégie l'**App Router** (Next 13+ avec RSC). Une section
> dédiée Pages Router est en bas pour les projets legacy.

---

## 1. Server Components & frontière `'use client'` (App Router)

C'est **le** point critique dans Next moderne. Une mauvaise gestion détruit tout le bénéfice des RSC.

### 1.1 `'use client'` trop haut dans l'arbre

❌ **Problème** : marquer un composant parent comme client transforme **toute sa sub-tree** en client → bundle gonflé, hydration de tout, RSC inutilisés.

```tsx
// ❌ ProductPage entier devient client à cause d'un seul bouton interactif
'use client'

export default function ProductPage({ product }) {
  return (
    <div>
      <ProductHero product={product} />     {/* aurait pu être RSC */}
      <ProductDescription product={product} /> {/* aurait pu être RSC */}
      <AddToCartButton product={product} />    {/* seul vrai besoin client */}
    </div>
  )
}
```

✅ **Fix** : isoler `'use client'` au plus bas niveau, garder les parents en RSC

```tsx
// ProductPage reste Server Component
export default function ProductPage({ product }) {
  return (
    <div>
      <ProductHero product={product} />
      <ProductDescription product={product} />
      <AddToCartButton product={product} />  {/* SEUL ce composant a 'use client' */}
    </div>
  )
}

// AddToCartButton.tsx
'use client'
export function AddToCartButton({ product }) { ... }
```

**Métriques** : TBT (P0), LCP (P1), bundle size
**Sévérité** : 🔴 P0 — souvent le plus gros gain sur App Router mal architecturé

### 1.2 Server Component qui ne fait rien d'asynchrone

❌ **Problème** : composant marqué Server mais qui n'a aucun fetch / accès DB → coût net sans bénéfice.
✅ **Fix** : laisser en Server par défaut quand même (pas d'overhead côté client), mais réfléchir à la composition globale.

**Sévérité** : 🟢 P3 (anti-pattern de design plutôt que perf)

### 1.3 Passer de gros props non sérialisables à un Client Component

❌ **Problème** : Next sérialise tous les props passés Server → Client. Passer un gros objet inutilisé gonfle le payload HTML.

✅ **Fix** : ne passer que ce qui est nécessaire au composant client

```tsx
// ❌ tout l'objet sérialisé même si seul le name est utilisé côté client
<ClientButton product={product} />

// ✅ seul le strict nécessaire
<ClientButton productId={product.id} productName={product.name} />
```

**Métriques** : LCP (P1), payload HTML
**Sévérité** : 🟠 P1 sur composants volumineux ou listes

---

## 2. Suspense & Streaming SSR

### 2.1 Pas de `Suspense` → loading bloquant

❌ **Problème** : sans `<Suspense>`, Next attend que **tous** les fetchs soient finis avant de servir le HTML → TTFB et FCP catastrophiques.

```tsx
// ❌ la page entière attend toutes les données
export default async function Page() {
  const [products, recommendations, reviews] = await Promise.all([
    fetchProducts(), fetchRecommendations(), fetchReviews()
  ])
  return <Layout {...{ products, recommendations, reviews }} />
}
```

✅ **Fix** : Suspense par section indépendante → streaming progressif

```tsx
export default function Page() {
  return (
    <>
      <Suspense fallback={<ProductsSkeleton />}><Products /></Suspense>
      <Suspense fallback={<RecsSkeleton />}><Recommendations /></Suspense>
      <Suspense fallback={<ReviewsSkeleton />}><Reviews /></Suspense>
    </>
  )
}
```

**Métriques** : FCP (P0), LCP (P0), TTFB perçu
**Sévérité** : 🔴 P0 sur pages avec multi-fetch

### 2.2 `loading.tsx` absent au niveau route

❌ **Problème** : sans `loading.tsx`, navigation route-to-route bloquée.
✅ **Fix** : fichier `loading.tsx` à chaque niveau de route important.

```
app/
  products/
    [id]/
      page.tsx
      loading.tsx  ← squelette streamé pendant le fetch
```

**Sévérité** : 🟠 P1

### 2.3 Skeleton non dimensionné dans Suspense fallback

❌ **Problème** : fallback de hauteur 0 → CLS énorme quand le contenu apparaît.
✅ **Fix** : skeleton avec `min-height` ou `aspect-ratio` reflétant le contenu final.

**Métriques** : CLS (P0)
**Sévérité** : 🔴 P0

---

## 3. Re-renders & memoization

### 3.1 Inline objets / arrays / fonctions dans les props

❌ **Problème** : nouvelle référence à chaque render → casse `React.memo`, déclenche re-renders inutiles.

```tsx
// ❌ `style` et `onClick` recréés à chaque render
<MyMemoButton style={{ color: 'red' }} onClick={() => doX()} />
```

✅ **Fix** : extraire en constants ou `useCallback`/`useMemo`

```tsx
const buttonStyle = { color: 'red' }  // constant module-level
function Parent() {
  const handleClick = useCallback(() => doX(), [])
  return <MyMemoButton style={buttonStyle} onClick={handleClick} />
}
```

**Métriques** : INP (P1)
**Sévérité** : 🟠 P1 sur composants chers ou listes

### 3.2 Context API pour state à haute fréquence

❌ **Problème** : Context déclenche un re-render de **tous** les consumers à chaque update → catastrophe sur state qui change souvent (form, scroll, mouse).

✅ **Fix** : utiliser une lib state externe (Zustand, Jotai, Valtio) qui permet de souscrire à des slices.

```tsx
// ❌ tous les consumers re-render quand n'importe quel champ change
const FormContext = createContext(form)

// ✅ Zustand avec selector → re-render uniquement si le champ utilisé change
const useForm = create((set) => ({ name: '', email: '', ... }))
const name = useForm(s => s.name)  // re-render seulement si `name` change
```

**Métriques** : INP (P0), TBT
**Sévérité** : 🔴 P0 sur state à haute fréquence

### 3.3 `useState` au mauvais niveau de l'arbre

❌ **Problème** : state placé dans un parent qui re-render toute sa sub-tree alors que seul un enfant l'utilise.
✅ **Fix** : descendre le state au plus près de son usage (state colocation).

**Sévérité** : 🟠 P1

### 3.4 `useEffect` qui re-déclenche en boucle

❌ **Problème** : dépendance objet/array recréée à chaque render → effect en boucle, network spam.

```tsx
// ❌ `options` recréé à chaque render → fetch en boucle
useEffect(() => { fetchData(options) }, [options])
```

✅ **Fix** : `useMemo` sur l'objet, ou dépendances primitives

```tsx
const options = useMemo(() => ({ id, sort }), [id, sort])
useEffect(() => { fetchData(options) }, [options])
```

**Sévérité** : 🔴 P0 (peut tuer le serveur)

### 3.5 `key` manquante ou index dans `.map()`

❌ **Problème** : React ne peut pas réutiliser les nodes → recreation complète à chaque mutation.
✅ **Fix** : key stable, jamais l'index sur listes mutables.

```tsx
{items.map((item) => <Item key={item.id} {...item} />)}  // ✅
```

**Sévérité** : 🟠 P1 sur listes >50

### 3.6 Pas d'usage de `useTransition` / `useDeferredValue` sur updates lourds

❌ **Problème** : input qui filtre une grosse liste → typing laggy.
✅ **Fix React 18+** : marquer l'update comme transition

```tsx
const [filter, setFilter] = useState('')
const [isPending, startTransition] = useTransition()

const handleChange = (e) => {
  startTransition(() => setFilter(e.target.value))  // non-bloquant
}
```

**Métriques** : INP (P0)
**Sévérité** : 🟠 P1 sur features de filtrage/recherche

---

## 4. Data fetching & caching (App Router)

### 4.1 Multiples fetchs des mêmes données dans une page

❌ **Problème** : plusieurs Server Components qui fetchent la même API → N appels.
✅ **Fix Next 14+** : `cache()` de React, ou `unstable_cache` de Next pour mémoïser.

```tsx
import { cache } from 'react'

export const getUser = cache(async (id: string) => {
  return await db.user.findUnique({ where: { id } })
})
// 3 composants appellent getUser('123') → 1 seule requête DB
```

**Métriques** : TTFB (P0)
**Sévérité** : 🔴 P0 sur pages avec composition de Server Components

### 4.2 ISR mal calibré (revalidate trop bas)

❌ **Problème** : `revalidate: 1` → quasi-SSR à chaque requête, perd le bénéfice du cache.
✅ **Fix** : choisir un `revalidate` cohérent avec la fraîcheur réelle nécessaire (60s, 600s, 3600s) ou utiliser `revalidateTag()` à la mutation.

```tsx
// Page avec ISR 1h + revalidation manuelle sur mutation
export const revalidate = 3600

// Dans le Server Action de mutation
import { revalidateTag } from 'next/cache'
revalidateTag('products')
```

**Sévérité** : 🟠 P1

### 4.3 Pas de Route Segment Config explicite

❌ **Problème** : Next devine le rendu (static/dynamic) selon le code → comportement instable au build.
✅ **Fix** : déclarer explicitement par route

```tsx
// app/products/[id]/page.tsx
export const dynamic = 'force-static'    // page statique
export const revalidate = 600             // ISR 10min
export const dynamicParams = true         // accepte de générer à la volée
```

**Sévérité** : 🟡 P2 (qualité plutôt que perf directe, mais évite les surprises)

### 4.4 Server Actions utilisées pour la lecture

❌ **Problème** : Server Actions sont POST-only et **non parallélisables** → utilisées pour du fetch GET, sérialisent les requêtes.
✅ **Fix** : Server Actions UNIQUEMENT pour mutations. Pour la lecture, utiliser `fetch` dans un Server Component.

**Sévérité** : 🟠 P1

---

## 5. Images (`next/image`)

### 5.1 `<img>` natif au lieu de `<Image>`

❌ **Problème** : pas d'optimisation auto (AVIF/WebP, srcset, lazy par défaut, dimensions).
✅ **Fix** : `next/image` partout

```tsx
import Image from 'next/image'

// Image LCP, above-the-fold
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority                          // ← équivalent fetchpriority="high" + preload
  sizes="(max-width: 768px) 100vw, 1200px"
/>

// Image below-the-fold
<Image src="/feature.jpg" alt="..." width={400} height={300} />
```

**Métriques** : LCP (P0), CLS (P0)
**Sévérité** : 🔴 P0 sur LCP image

### 5.2 `priority` non appliqué sur l'image LCP

❌ **Problème** : sans `priority`, Next lazy-load par défaut → LCP retardé.
✅ **Fix** : `priority` sur l'image LCP de chaque page.

**Sévérité** : 🔴 P0

### 5.3 Pas de `sizes` sur images responsive

❌ **Problème** : navigateur télécharge la résolution max par défaut.
✅ **Fix** : toujours fournir `sizes` cohérent avec le layout CSS.

**Sévérité** : 🟠 P1

### 5.4 Domaine d'image non configuré dans `next.config`

❌ **Problème** : images externes sans `images.remotePatterns` → erreur ou non-optimisation.
✅ **Fix** :

```ts
// next.config.ts
export default {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com' }],
    formats: ['image/avif', 'image/webp'],
  }
}
```

**Sévérité** : 🟠 P1

---

## 6. Fonts (`next/font`)

### 6.1 Fonts via `<link>` ou `@import` au lieu de `next/font`

❌ **Problème** : pas d'auto-hosting, pas de subsetting, FOIT/FOUT mal géré, request bloquante.
✅ **Fix** : `next/font` (Google Fonts ou local)

```tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export default function RootLayout({ children }) {
  return <html className={inter.variable}><body>{children}</body></html>
}
```

**Métriques** : LCP (P1), CLS (P0 sans `display: swap`)
**Sévérité** : 🔴 P0 sur sites avec fonts custom

### 6.2 Trop de variantes / weights chargés

❌ **Problème** : importer 8 weights × italic = ~400KB de fonts.
✅ **Fix** : ne charger que les weights réellement utilisés (en général 2-3 max).

**Sévérité** : 🟠 P1

---

## 7. Dynamic imports & code splitting

### 7.1 Composants lourds non dynamiques

❌ **Problème** : éditeur de texte, charting lib, video player → dans le bundle initial.
✅ **Fix** : `next/dynamic`

```tsx
import dynamic from 'next/dynamic'

const RichEditor = dynamic(() => import('@/components/RichEditor'), {
  ssr: false,                          // si lib browser-only
  loading: () => <EditorSkeleton />,   // dimensionné pour éviter CLS
})
```

**Métriques** : TBT (P0), bundle size, LCP indirect
**Sévérité** : 🔴 P0 sur libs >100KB

### 7.2 Import d'une lib entière au lieu de cherry-pick

❌ **Problème** : `import _ from 'lodash'` charge tout (~70KB).
✅ **Fix** : import nommé ou modulaire

```tsx
// ❌ tout lodash
import _ from 'lodash'
_.debounce(fn, 300)

// ✅ uniquement debounce (~2KB)
import debounce from 'lodash/debounce'
// ou mieux : implémenter soi-même si simple
```

**Sévérité** : 🟠 P1

---

## 8. Configuration Next critique

### 8.1 Pas de Turbopack en dev (Next 15+)

✅ **Pattern Next 15+** : Turbopack stable en dev → DX rapide, pas d'impact prod direct mais réduit le risque de pratiques perf-mauvaises (rebuild lent → on évite de tester).

```json
// package.json
"scripts": { "dev": "next dev --turbo" }
```

**Sévérité** : 🟢 P3 (DX)

### 8.2 PPR (Partial Prerendering) non activé sur pages mixtes statique/dynamique

✅ **Pattern Next 14+ experimental, Next 15 stable (canary)** : combine static shell + dynamic islands streamés.

```ts
// next.config.ts
export default {
  experimental: { ppr: true }
}
```

**Métriques** : TTFB (P0), FCP (P0)
**Sévérité** : 🟠 P1 sur sites e-commerce / contenu mixte

### 8.3 Compression non vérifiée

❌ **Problème** : Next compresse par défaut **sauf si tu déploies derrière un reverse proxy** qui ne compresse pas.
✅ **Fix** : vérifier la config de Vercel / nginx / cloudfront → brotli activé.

**Sévérité** : 🔴 P0 si non compressé

### 8.4 `generateStaticParams` absent sur routes dynamiques cacheables

❌ **Problème** : route `[slug]` qui pourrait être SSG → reste dynamic.
✅ **Fix** :

```tsx
export async function generateStaticParams() {
  const products = await getProducts()
  return products.map(p => ({ slug: p.slug }))
}
```

**Sévérité** : 🟠 P1

---

## 9. React 19 & React Compiler

### 9.1 Pas de React Compiler activé (Next 15 + React 19)

✅ **Pattern** : le React Compiler mémoïse automatiquement → moins besoin de `useMemo`/`useCallback` manuels.

```ts
// next.config.ts
export default {
  experimental: { reactCompiler: true }
}
```

**Métriques** : INP (P1), bundle (parfois +)
**Sévérité** : 🟢 P3 — encore experimental, à valider en staging avant prod

### 9.2 `use()` hook pour data fetching côté client

✅ **Pattern React 19** : `use()` permet de consommer une promesse dans un Client Component, intégré à Suspense.

```tsx
'use client'
import { use } from 'react'

function ProductDetails({ productPromise }: { productPromise: Promise<Product> }) {
  const product = use(productPromise)  // suspend pendant le fetch
  return <div>{product.name}</div>
}
```

**Sévérité** : 🟡 P2 (pattern moderne, gain marginal vs `useEffect+useState`)

### 9.3 Form Actions natives (React 19)

✅ **Pattern** : remplacer `onSubmit` + `useState` + fetch par un Server Action via `<form action={action}>` → plus simple, meilleure perf perçue (transitions automatiques).

**Sévérité** : 🟢 P3

---

## 10. Pages Router (legacy)

> Si projet sur Pages Router, voici les points critiques.

### 10.1 `getServerSideProps` au lieu de `getStaticProps`/ISR

❌ **Problème** : SSR à chaque requête alors que le contenu pourrait être statique.
✅ **Fix** : `getStaticProps` + `revalidate` quand possible.

**Sévérité** : 🔴 P0

### 10.2 Pas de `_document` optimisé

✅ **Fix** : preconnect aux origines critiques (fonts, CDN images, API), preload du LCP image.

### 10.3 Migration vers App Router

✅ **Recommandation** : pour un projet perf-critique, migrer vers App Router pour bénéficier des RSC, streaming, PPR. ROI élevé sur projets >moyenne taille.

---

## Checklist rapide d'audit React/Next

À l'audit, vérifier systématiquement :

- [ ] `'use client'` placé au plus bas niveau possible
- [ ] Server Components pour tout ce qui ne nécessite pas d'interactivité
- [ ] Props sérialisés Server → Client minimisés
- [ ] `<Suspense>` autour de chaque fetch indépendant
- [ ] `loading.tsx` à chaque niveau de route important
- [ ] Skeletons dimensionnés (pas de CLS au swap)
- [ ] `cache()` ou `unstable_cache` sur les fetchs partagés
- [ ] Route Segment Config explicite (`dynamic`, `revalidate`)
- [ ] Server Actions UNIQUEMENT pour mutations
- [ ] `next/image` partout, jamais `<img>` sur LCP
- [ ] `priority` sur l'image LCP
- [ ] `sizes` cohérent avec le CSS sur images responsive
- [ ] `next/font` pour toutes les fonts custom
- [ ] Composants lourds (>100KB) en `next/dynamic`
- [ ] Imports cherry-pick (lodash/debounce vs lodash entier)
- [ ] Pas d'inline objects/functions sur composants memoizés
- [ ] Pas de Context API sur state à haute fréquence
- [ ] `useTransition` sur updates de filtrage/recherche
- [ ] Compression vérifiée (brotli/gzip selon hébergeur)
- [ ] PPR activé si Next 14+ (experimental) / 15+ (stable)
- [ ] React Compiler évalué si React 19
