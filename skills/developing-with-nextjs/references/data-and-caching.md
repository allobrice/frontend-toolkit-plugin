# Données et cache

Lire les données sur le serveur, à travers une Data Access Layer, puis décider **explicitement** de
ce qui est mis en cache. Ce fichier décrit le modèle **Cache Components** (`cacheComponents: true`,
recommandé depuis 16.4, défaut en 17). Pour une signature précise : `node_modules/next/dist/docs/`.

## Sommaire

1. Data Access Layer de lecture
2. Déduplication par requête : `React.cache`
3. Le modèle Cache Components en une page
4. `'use cache'` : où et comment
5. `cacheLife` : choisir un profil
6. `cacheTag` et invalidation
7. Données runtime : `cookies()`, `headers()`, `searchParams`, `params`
8. Maximiser le static shell
9. Valeurs aléatoires et horodatages : `connection()`
10. Navigation et préchargement
11. Variantes `'use cache: private'` et `'use cache: remote'`
12. Projets sans Cache Components (modèle précédent)
13. Lire les erreurs « blocking route »

---

## 1. Data Access Layer de lecture

Une DAL est un module `server-only` qui **seul** parle à la base ou aux API internes, **vérifie
l'autorisation** et renvoie des **DTO** minimaux.

```ts
// data/projects.ts
import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { getCurrentUser } from './auth'

export type ProjectSummary = { id: string; name: string; updatedAt: Date }

export const getProjectsForCurrentUser = cache(async (): Promise<ProjectSummary[]> => {
  const user = await getCurrentUser()
  if (!user) return []

  const rows = await db.project.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: 'desc' } })
  return rows.map((row) => ({ id: row.id, name: row.name, updatedAt: row.updatedAt }))
})
```

- Les pages et composants appellent la DAL, **jamais** `db` directement.
- La DAL renvoie des types de domaine, pas le type du client de base (Adapter, cf. `developing-react`).
- Une seule approche par projet : DAL **ou** API HTTP externe, pas un mélange.

Détail sécurité (autorisation, DTO, taint) : `security.md`.

---

## 2. Déduplication par requête : `React.cache`

`cache(fn)` mémoïse une fonction **pendant une requête** : plusieurs composants peuvent appeler
`getCurrentUser()` sans multiplier les requêtes, et sans faire descendre `user` en props.

- C'est une déduplication, **pas** un cache entre requêtes.
- Son scope est isolé à l'intérieur d'un `'use cache'` : ne pas s'en servir pour faire entrer une
  donnée dans une fonction cachée (passer un argument).

---

## 3. Le modèle Cache Components en une page

Au build, Next.js rend l'arbre de chaque route et classe chaque partie :

| Ce que fait le composant | Résultat |
|---|---|
| Code synchrone, imports de modules, calcul pur | inclus dans le **static shell** |
| `'use cache'` avec une durée de vie suffisante | inclus dans le static shell (et le prefetch) |
| Donnée non cachée ou API runtime **sous `<Suspense>`** | le `fallback` est dans le shell, le contenu streame à la requête |
| Donnée non cachée ou API runtime **sans `<Suspense>`** | **erreur « blocking route »** au dev / build |

Le shell est servi immédiatement (CDN possible), les trous se remplissent en streaming : c'est le
Partial Prerendering. Rien n'est caché implicitement : un `fetch` ou une requête SQL s'exécute à
chaque requête tant qu'aucun `'use cache'` ne l'enveloppe.

---

## 4. `'use cache'` : où et comment

Trois niveaux, tous sur des fonctions **async** :

```ts
// Niveau donnée — le plus courant, le plus réutilisable
export async function getCategories() {
  'use cache'
  cacheLife('days')
  cacheTag('categories')
  return db.category.findMany()
}
```

```tsx
// Niveau composant — cache le rendu (JSX compris)
async function PopularProducts() {
  'use cache'
  cacheLife('hours')
  const products = await getPopularProducts()
  return <ProductList products={products} />
}
```

```ts
// Niveau fichier — toutes les exportations du module sont cachées (et doivent être async)
'use cache'
```

Règles :

- **Clé de cache** = build + identité de la fonction + arguments sérialisés + variables capturées
  par closure. Deux arguments différents = deux entrées.
- Arguments et valeurs de retour **sérialisables** (pas d'instance de classe, pas d'URL, pas de
  fonction sauf en simple transit).
- `children` et Server Actions peuvent **traverser** un composant caché sans entrer dans la clé, tant
  qu'on ne les inspecte pas : c'est ce qui permet de cacher une coquille et d'y insérer du dynamique.
- Pas de `'use cache'` directement dans le corps d'un Route Handler : l'extraire dans une fonction.
- `'use cache'` n'a aucun effet dans `proxy.ts`.
- Préférer le niveau **donnée** : il se réutilise entre pages, actions et Route Handlers ; le
  niveau composant est réservé à un rendu coûteux et stable.
- **Une fonction `'use cache'` est appelable directement** par un `POST` (référence serveur), même
  non exportée : n'y mettre que des données publiques, projetées en DTO dans la fonction. Données
  par utilisateur : `security.md` §5.

---

## 5. `cacheLife` : choisir un profil

**Toujours un `cacheLife` explicite** dans chaque scope `'use cache'`, appelé dans la fonction
elle-même (pas dans un utilitaire partagé).

| Profil | `stale` (client) | `revalidate` (serveur) | `expire` | Pour |
|---|---|---|---|---|
| `seconds` | 30 s | 1 s | 1 min | quasi temps réel — **exclu du pré-rendu** |
| `minutes` | 5 min | 1 min | 1 h | fils d'actualité |
| `hours` | 5 min | 1 h | 1 j | stock, catalogue |
| `days` | 5 min | 1 j | 1 sem | articles |
| `weeks` | 5 min | 1 sem | 30 j | contenus hebdomadaires |
| `max` | 5 min | 30 j | 1 an | pages légales, archives — à combiner avec `cacheTag` |
| `default` (implicite) | 5 min | 15 min | jamais | à éviter : rendre la durée explicite |

Seuils qui changent le rendu : `revalidate: 0` ou `expire` < 5 min → trou dynamique (mettre un
`<Suspense>`) ; `stale` < 30 s → exclu du prefetch ; `stale` < 5 min → hors App Shell.

Profils métier réutilisables : les déclarer dans `next.config.ts` (`cacheLife: { editorial: {…} }`)
plutôt que de redéfinir les profils intégrés — **et ne pas modifier la config sans validation**.

---

## 6. `cacheTag` et invalidation

Taguer ce qu'une mutation devra invalider, avec des tags **construits par une fonction** pour éviter
les fautes de frappe (DRY) :

```ts
// data/cache-tags.ts
export const productTags = {
  list: (categoryId: string) => `products:category:${categoryId}`,
  detail: (productId: string) => `product:${productId}`,
}

// Donnée publique : DTO public projeté dans la fonction cachée
export async function getProduct(productId: string): Promise<ProductDTO | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(productTags.detail(productId))
  const product = await db.product.findUnique({ where: { id: productId } })
  return product ? toProductDTO(product) : null
}
```

Choix de l'API d'invalidation : `mutations-and-actions.md` §5.

---

## 7. Données runtime

`cookies()`, `headers()`, `searchParams` et les `params` non pré-générés sont **interdits dans un
scope `'use cache'`** — y compris dans les fonctions qu'il appelle (erreur
`next-request-in-use-cache`). Pattern canonique : lire hors cache, passer la valeur en argument.

```tsx
export default function Page() {
  return (
    <Suspense fallback={<RecommendationsSkeleton />}>
      <Recommendations />
    </Suspense>
  )
}

async function Recommendations() {
  const region = (await cookies()).get('region')?.value ?? 'eu' // lecture runtime, hors cache
  const items = await getRecommendations(region)                  // fonction cachée, clé = region
  return <ProductList products={items} />
}

async function getRecommendations(region: string): Promise<ProductDTO[]> {
  'use cache'
  cacheLife('hours')
  const products = await db.product.findMany({ where: { region, featured: true } })
  return products.map(toProductDTO)
}
```

Ne jamais passer une **promesse** runtime (`cookies()` non attendu) à une fonction cachée : le build
attend une valeur qui n'existe pas et se bloque (timeout de 50 s).

---

## 8. Maximiser le static shell

Plus un `await` est profond dans l'arbre, plus le reste est pré-rendu. Ne pas attendre `params`,
`cookies()` ou une donnée en haut d'un layout si seul un sous-composant en a besoin :

```tsx
// app/shop/[slug]/layout.tsx — pas async : n'attend rien lui-même
export default function ShopLayout({ children, params }: LayoutProps<'/shop/[slug]'>) {
  return (
    <div>
      <ShopSidebar />
      <Suspense fallback={<HeadingSkeleton />}>
        <ShopHeading params={params} />
      </Suspense>
      {children}
    </div>
  )
}

async function ShopHeading({ params }: Pick<LayoutProps<'/shop/[slug]'>, 'params'>) {
  const { slug } = await params
  const shop = await getShop(slug)
  return <h1>{shop.name}</h1>
}
```

- `generateStaticParams` pour pré-rendre les valeurs connues ; les autres reçoivent l'App Shell
  puis sont générées en arrière-plan (ISR avec Cache Components, 16.3+).
- `export const ensureStatic = 'navigation' | 'prefetch' | 'shell'` (16.4) sur une page ou un layout
  qui **doit** rester statique (marketing, blog, e-commerce) : le build échoue si un composant
  dynamique s'y glisse.

---

## 9. Valeurs aléatoires et horodatages : `connection()`

`Math.random()`, `Date.now()`, `crypto.randomUUID()` pendant le rendu bloquent le pré-rendu. Deux
choix explicites :

- valeur **par requête** → `await connection()` (de `next/server`) avant l'appel, sous `<Suspense>` ;
- valeur **partagée** jusqu'à revalidation → dans un scope `'use cache'`.

`connection()` est interdit dans `'use cache'` et `'use cache: private'`.

---

## 10. Navigation et préchargement

- Avec `partialPrefetching: true`, `<Link>` précharge l'**App Shell** de la route cible ;
  `prefetch={true}` sur un lien précharge aussi le contenu caché qui dépend de l'URL (`params`,
  `searchParams`). Chaque lien `prefetch` coûte une invocation serveur : le réserver aux
  navigations probables.
- `await navigation()` (16.4) dans un composant l'exclut du prefetch : il ne se rend qu'à la
  navigation réelle (fil de discussion complet, détails coûteux).
- `await prefetch()` (16.4) l'exclut du shell : il ne se rend que lors d'un prefetch explicite.
- Les outils de dev « Instant Insights » et « Navigation Inspector » (16.3) signalent les
  navigations non instantanées ; les verrouiller par un test `instant()` (`testing.md`).

---

## 11. Variantes

| Directive | Stockage | Lit `cookies()` / `headers()` | Quand |
|---|---|---|---|
| `'use cache'` | mémoire de l'instance (LRU), shell pré-rendu, navigateur | non | défaut |
| `'use cache: remote'` | cache handler partagé (Redis, KV…) fourni par la plateforme | non | taux de hit élevé, serverless où la mémoire ne persiste pas ; coût réseau et plateforme |
| `'use cache: private'` | navigateur uniquement (jamais de cache serveur entre requêtes) | **oui** | refactoring §7 impossible, ou exigence de conformité |

En serverless, le cache mémoire par défaut ne survit souvent pas entre requêtes : ce qui compte est
ce qui entre dans le shell pré-rendu. Aucun cache ne survit à un nouveau déploiement.

---

## 12. Projets sans Cache Components

Si `cacheComponents` n'est pas activé, le projet suit le **modèle précédent** (`fetch` avec
`next.revalidate` / `cache`, `export const revalidate`, `export const dynamic`, `unstable_cache`).

- Ne pas activer `cacheComponents` de sa propre initiative : c'est une migration (skill officielle
  `next-cache-components-adoption`, guide « migrating to cache components »).
- Écrire le code dans le style du modèle en place, en lisant le guide
  « caching without cache components » de la doc embarquée.
- Les principes restent : DAL, DTO, `<Suspense>` pour streamer, invalidation ciblée.

---

## 13. Lire les erreurs « blocking route »

Les erreurs de pré-rendu proposent des correctifs étiquetés :

- **[stream]** entourer l'accès d'un `<Suspense fallback>` — défaut pour une donnée personnelle ou fraîche ;
- **[cache]** mettre l'accès en cache avec `'use cache'` — pour une donnée partagée et stable ;
- **[block]** `export const instant = false` — accepter une route bloquante ; **dernier recours**,
  à justifier.

Lire la page `nextjs.org/docs/messages/<code>.md` liée par l'erreur avant de choisir.
`next build --debug-prerender` affiche les sources et continue après la première route en échec.
