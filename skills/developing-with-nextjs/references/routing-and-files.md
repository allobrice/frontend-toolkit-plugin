# Routing et conventions de fichiers

Le dossier `app/` porte **le routing** ; la logique vit ailleurs (`features/`, `data/`, `lib/`).
Pour la liste exhaustive des conventions et de leurs props : doc embarquée,
`01-app/03-api-reference/03-file-conventions/`.

## Sommaire

1. Conventions de fichiers
2. Layouts, templates, route groups
3. Pages : `params`, `searchParams`, types générés
4. Chargement : `loading.tsx` et `<Suspense>`
5. Erreurs : `error.tsx`, `catchError`, `global-error.tsx`, `not-found.tsx`
6. Routes dynamiques et `generateStaticParams`
7. Routes parallèles et interceptées
8. `proxy.ts`
9. Metadata et SEO
10. Navigation côté client

---

## 1. Conventions de fichiers

| Fichier | Rôle |
|---|---|
| `layout.tsx` | interface partagée persistante ; ne se re-rend pas à la navigation entre ses enfants |
| `page.tsx` | rend une route publique |
| `loading.tsx` | `<Suspense>` automatique autour de la page du segment |
| `error.tsx` | error boundary du segment (Client Component) |
| `global-error.tsx` | error boundary au-dessus du layout racine (inclut `<html>` / `<body>`) |
| `not-found.tsx` | UI de `notFound()` et des URL inconnues |
| `route.ts` | Route Handler (pas au même niveau qu'une `page`) |
| `default.tsx` | rendu par défaut d'un slot de route parallèle — **obligatoire** depuis 16 |
| `template.tsx` | comme un layout, mais remonté à chaque navigation (rarement utile) |
| `proxy.ts` (racine) | interception des requêtes (ex-`middleware.ts`) |
| `opengraph-image.tsx`, `sitemap.ts`, `robots.ts`, `icon.tsx` | fichiers de metadata |

Colocaliser librement des fichiers non routés dans `app/` (seuls `page` et `route` sont publics),
ou préfixer un dossier par `_` pour l'exclure du routing. Préférer `features/` pour la logique.

---

## 2. Layouts, templates, route groups

- Un layout reçoit `children` (et les slots parallèles) ; il ne reçoit **pas** `searchParams`.
- Un layout persiste entre les navigations : ne pas y placer un état qui devrait se réinitialiser
  par page.
- `(groupe)/` organise sans changer l'URL : sections avec layouts différents (`(marketing)`,
  `(app)`), plusieurs layouts racines.
- Le layout racine contient `<html>` et `<body>` ; y placer `next/font` et les providers au plus
  près de `{children}`.

---

## 3. Pages : `params`, `searchParams`, types générés

```tsx
// app/blog/[slug]/page.tsx
export default async function BlogPostPage({ params }: PageProps<'/blog/[slug]'>) {
  const { slug } = await params
  const post = await getPublishedPost(slug)
  if (!post) notFound()
  return <Article post={post} />
}
```

- `params` et `searchParams` sont des **promesses** (16+). Les attendre au plus bas de l'arbre
  (`data-and-caching.md` §8).
- `PageProps<'/route'>`, `LayoutProps<'/route'>`, `RouteContext<'/route'>` sont **globaux**, générés
  par `next dev`, `next build` ou `next typegen` : ne pas réécrire ces types à la main.
- `params` et `searchParams` sont des **entrées utilisateur** : valider (schéma) avant usage,
  surtout pour un filtre, une pagination ou un identifiant.
- Root params (16.3) : `import { lang } from 'next/root-params'` puis `await lang()` lit un
  paramètre du segment racine depuis n'importe quel Server Component, sans prop drilling.

---

## 4. Chargement

- `loading.tsx` = un `<Suspense>` au niveau du segment. Utile comme filet ; préférer des
  `<Suspense>` **ciblés** dans la page autour de chaque partie lente, avec des squelettes de la
  même taille que le contenu final (pas de saut de mise en page).
- Avec Cache Components, un composant dynamique sans `<Suspense>` est une erreur « blocking route » :
  la frontière n'est pas optionnelle.

---

## 5. Erreurs

### `error.tsx` (segment)

```tsx
// app/dashboard/error.tsx
'use client'

import { useEffect } from 'react'

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    reportError(error)
  }, [error])

  return (
    <section role="alert">
      <h2>Le tableau de bord n'a pas pu se charger.</h2>
      <button type="button" onClick={() => retry()}>Réessayer</button>
    </section>
  )
}
```

`error` est typé `unknown` ; `retry()` re-télécharge et re-rend le segment, Server Components
compris. Vérifier les props exactes dans la doc embarquée de la version du projet.

### `catchError` (composant, 16.3+)

Pour une frontière plus fine qu'un segment, sans intercepter `notFound()` / `redirect()` :

```tsx
// features/dashboard/components/WidgetErrorBoundary.tsx
'use client'

import { catchError, type ErrorInfo } from 'next/error'

function WidgetFallback({ title }: { title: string }, { retry }: ErrorInfo) {
  return (
    <div role="alert">
      <p>{title} indisponible.</p>
      <button type="button" onClick={() => retry()}>Réessayer</button>
    </div>
  )
}

export const WidgetErrorBoundary = catchError(WidgetFallback)
```

Préférer `catchError` à une classe Error Boundary maison dans un projet Next 16.3+.

### `global-error.tsx`, `not-found.tsx`

- `global-error.tsx` remplace le layout racine en cas d'erreur : il définit son propre `<html>` /
  `<body>` et doit rester minimal.
- `notFound()` (de `next/navigation`) pour une ressource absente ; `not-found.tsx` au niveau
  pertinent. Ne jamais rendre un « introuvable » maison sans `notFound()`.

### Contrat HTTP du streaming

Dès qu'un fallback `<Suspense>` est envoyé, le statut **200** et les en-têtes sont partis : ils ne
peuvent plus changer. Un `notFound()` déclenché pendant le flux injecte
`<meta name="robots" content="noindex">` au lieu d'un 404, et un `redirect()` devient une redirection
côté client.

| Besoin | Conduite |
|---|---|
| Vrai statut 404 / redirection HTTP (SEO, API, monitoring) | appeler `notFound()` / `redirect()` **avant** tout `await` sous `<Suspense>` et tout fallback, au prix d'une route bloquante pour ce contrôle |
| Shell instantané prioritaire (page privée, non indexée) | accepter 200 + `noindex` ; le documenter dans la restitution |

C'est un arbitrage à expliciter, pas un bug.

Erreurs attendues des actions : valeur de retour (`mutations-and-actions.md` §4).

---

## 6. Routes dynamiques et `generateStaticParams`

- `[slug]`, `[...slug]` (catch-all), `[[...slug]]` (catch-all optionnel).
- `generateStaticParams` pré-rend les valeurs connues au build ; avec Cache Components, les autres
  reçoivent l'App Shell puis sont générées et mises en cache en arrière-plan.
- Ne pas pré-générer des milliers de pages par défaut : les plus visitées, le reste à la demande.

---

## 7. Routes parallèles et interceptées

- Slots `@nom/` rendus simultanément par le layout (tableaux de bord, panneaux).
- **Chaque slot exige un `default.tsx`** (16+) — sinon le build échoue. Renvoyer `null` ou appeler
  `notFound()` pour l'ancien comportement.
- Routes interceptées `(.)photo/[id]` pour une modale qui garde une URL partageable, avec la page
  complète en navigation directe.
- Ne les introduire que pour ces besoins précis : elles complexifient fortement le routing.

---

## 8. `proxy.ts`

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  if (!request.cookies.has('session') && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*'] }
```

- Remplace `middleware.ts` (déprécié sauf runtime Edge) ; s'exécute sur Node.js.
- Usages : redirections, réécritures, en-têtes, redirection optimiste vers la connexion.
- **Pas une barrière de sécurité suffisante** : la DAL et chaque action revérifient l'auth.
- Léger et rapide (il s'exécute avant chaque requête ciblée) : pas de requête de base, pas de logique
  métier ; `matcher` restreint au strict nécessaire.
- Les directives `'use cache'` n'y ont aucun effet.

---

## 9. Metadata et SEO

```tsx
// Statique
export const metadata: Metadata = { title: 'Tarifs', description: 'Nos offres et tarifs.' }

// Dynamique
export async function generateMetadata({ params }: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedPost(slug) // dédupliqué avec la page via React.cache / use cache
  return post ? { title: post.title, description: post.excerpt } : {}
}
```

- `title.template` dans le layout racine pour un suffixe commun.
- Les mêmes règles de pré-rendu s'appliquent à `generateMetadata` (données non cachées → erreurs ou
  streaming de la metadata).
- `sitemap.ts`, `robots.ts`, `opengraph-image.tsx` plutôt que des fichiers écrits à la main.
- Audit complet : skill `auditing-seo`.

---

## 10. Navigation côté client

- `<Link href>` pour toute navigation interne (préchargement, transitions) ; `<a>` pour l'externe.
- `useRouter()` (de `next/navigation`) pour une navigation impérative après une action client ; après
  une Server Action, préférer `redirect()` côté serveur.
- `usePathname`, `useSearchParams` : Client Components uniquement ; `useSearchParams` sans
  `<Suspense>` peut désoptimiser la route.
- Filtres et pagination dans l'URL : `router.replace` avec `startTransition` pour garder l'UI
  réactive pendant le rechargement serveur.
