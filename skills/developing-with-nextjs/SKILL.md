---
name: developing-with-nextjs
description: >
  Extension Next.js 16+ (App Router, 16.4) de la skill developing-react : Server Components et
  Client Components, frontière 'use client', Cache Components ('use cache', cacheLife, cacheTag,
  Suspense, static shell, Partial Prefetching), Server Functions / Server Actions, Data Access
  Layer, sécurité des données, revalidation (updateTag, revalidateTag, refresh, revalidatePath),
  routing par fichiers (layout, page, loading, error, not-found, route.ts, proxy.ts), metadata,
  next/image, next/font, tests. Architecture SOLID et DRY adaptée au modèle serveur. Utiliser dès
  que le projet contient `next` dans package.json, un dossier app/ avec layout.tsx / page.tsx,
  next.config.ts, 'use client', 'use server', 'use cache', middleware.ts ou proxy.ts. Déclencher
  aussi sur : "Next.js", "App Router", "Server Component", "Server Action", "RSC", "SSR",
  "prerender", "ISR", "revalidate", "route handler", "page Next", "migre vers Next 16",
  "Cache Components", "ma page est lente à naviguer". Toujours combiner avec developing-react.
---

# Next.js 16+ — App Router de production

Cette skill **étend** `developing-react` : tout ce qui y est dit (rendu pur, état minimal, effets
rares, unions discriminées, composition) reste vrai dans un Client Component. Elle ajoute ce qui
change quand une partie de l'arbre s'exécute sur le serveur. **Version de référence : Next.js 16.4**
(octobre 2026), React 19.3. Cache Components y est recommandé pour toute app et deviendra le
défaut en Next.js 17.

## Source de vérité : la doc embarquée

Next.js 16.2+ installe une documentation **calée sur la version du projet** dans
`node_modules/next/dist/docs/` (même arborescence que nextjs.org/docs : `01-app/01-getting-started`,
`02-guides`, `03-api-reference`). Le `AGENTS.md` du projet y renvoie.

- **Signature, option de config, convention de fichier, comportement d'une API** → lire la page
  correspondante dans `node_modules/next/dist/docs/` avant d'écrire. Ne jamais se fier à la mémoire
  pour une API Next : elle change à chaque mineure.
- Message d'erreur `Learn more: https://nextjs.org/docs/messages/...` → lire cette page (non
  embarquée, accessible en `.md`). Elle donne les correctifs canoniques et leurs compromis.
- Cette skill porte **le jugement** (architecture, découpage, sécurité, choix entre plusieurs API)
  — pas le catalogue d'API.

## Principes directeurs

1. **Serveur par défaut, client par nécessité.** Un composant devient Client Component seulement
   pour de l'état, des événements, des effets ou une API navigateur. La frontière `'use client'`
   descend le plus bas possible : une feuille interactive, pas une page.
2. **Les données se lisent sur le serveur**, au plus près du composant qui les affiche, via une
   **Data Access Layer** `server-only` qui authentifie, autorise et renvoie des DTO minimaux.
3. **Toute Server Function est un endpoint public.** Elle valide ses entrées, ré-authentifie,
   vérifie l'autorisation sur la ressource et renvoie le strict nécessaire.
4. **Dynamique par défaut, cache explicite.** Avec Cache Components, rien n'est mis en cache
   implicitement : `'use cache'` + `cacheLife` (+ `cacheTag`) là où c'est voulu, `<Suspense>`
   autour de ce qui doit rester à la requête.
5. **Maximiser le static shell.** Les `await` (données, `params`, `cookies()`…) descendent dans
   l'arbre, derrière une frontière `<Suspense>`, pour que le reste soit pré-rendu et la navigation
   instantanée.
6. **Une mutation invalide précisément** ce qu'elle a changé (`updateTag` pour lire sa propre
   écriture), jamais « tout ».
7. **Le code direct d'abord**, comme dans `developing-react` : une couche, un pattern ou une
   abstraction répond à une douleur constatée.

## Détecter le contexte avant d'écrire

| Signal | Conséquence |
|---|---|
| `next` ≥ 16 dans `package.json` | idiomes de la table ci-dessous ; lire la mineure exacte (16.3 : `catchError`, root params ; 16.4 : `ensureStatic`, `navigation()` / `prefetch()`) |
| `cacheComponents: true` dans `next.config.ts` | modèle Cache Components (`references/data-and-caching.md`) |
| `partialPrefetching: true` | Partial Prefetching actif : App Shell préchargé par défaut, `prefetch` par lien pour le contenu lié à l'URL |
| Ni l'un ni l'autre | **modèle précédent** : ne pas activer Cache Components sans validation ; suivre le guide « caching without cache components » de la doc embarquée |
| `reactCompiler: true` | pas de mémoïsation manuelle (cf. `developing-react`) |
| `middleware.ts` | déprécié (sauf Edge) : signaler la migration vers `proxy.ts`, ne pas la faire d'office |
| Dossier `pages/` | Pages Router : hors périmètre de cette skill, demander avant d'y toucher |
| `next` ≤ 15 | API synchrones et cache implicite : ne pas appliquer les idiomes 16 ; signaler la migration (`next upgrade`) |
| `server-only`, dossier `data/` ou `lib/dal` | une DAL existe : passer par elle, ne pas requêter la base depuis un composant |

## Idiomes Next.js 16 — écrire ça, plus ça

| Écrire | Plus | Depuis |
|---|---|---|
| `const { slug } = await params` ; `await searchParams` | accès synchrone à `params` / `searchParams` | 16.0 |
| `await cookies()`, `await headers()`, `await draftMode()` | appels synchrones | 16.0 |
| `PageProps<'/blog/[slug]'>`, `LayoutProps<'/shop'>` (types générés) | `{ params: { slug: string } }` écrit à la main | 16.0 |
| `proxy.ts` exportant `proxy(request)` | `middleware.ts` / `middleware()` | 16.0 |
| `'use cache'` + `cacheLife('hours')` + `cacheTag('posts')` | `fetch(url, { next: { revalidate } })`, `unstable_cache`, `export const revalidate` (modèle précédent) | 16.0 |
| `updateTag('posts')` dans une Server Action (lire sa propre écriture) | `revalidateTag('posts')` à un argument | 16.0 |
| `revalidateTag('posts', 'max')` (stale-while-revalidate) | `revalidateTag('posts')` sans profil (déprécié) | 16.0 |
| `refresh()` dans une Server Action pour les données non cachées | `router.refresh()` déclenché depuis le client après l'action | 16.0 |
| `await connection()` avant `Math.random()` / `Date.now()` par requête | `export const dynamic = 'force-dynamic'` | 16.0 |
| `reactCompiler: true` (niveau racine de la config) | `experimental.reactCompiler` | 16.0 |
| `default.tsx` explicite dans chaque slot de route parallèle | slot sans `default` (le build échoue) | 16.0 |
| `error.tsx` recevant `{ error: unknown; retry }` | `{ error: Error; reset }` | 16.x — vérifier dans la doc embarquée |
| `catchError(Fallback)` de `next/error` pour une frontière d'erreur de composant avec `retry()` | Error Boundary maison qui intercepte `notFound()` / `redirect()` | 16.3 |
| `import { lang } from 'next/root-params'` puis `await lang()` | `params` du segment racine propagés en props | 16.3 |
| `export const ensureStatic = 'navigation'` sur une page / un layout qui doit rester statique | contrôle manuel en revue | 16.4 |
| `await navigation()` / `await prefetch()` (`next/cache`) pour sortir un contenu d'un préchargement | désactiver le prefetch du lien | 16.4 |

Vérifier dans la doc embarquée toute API de cette table avant de l'utiliser : la mineure du
projet peut différer.

## Arbres de décision

### Server ou Client Component ?

```
Le composant a besoin de useState / useReducer / useEffect / gestionnaires d'événements / API navigateur ?
├── Non → Server Component (défaut). Il peut être async et lire les données.
└── Oui → isoler la plus petite partie interactive dans un fichier 'use client'
    ├── Il doit afficher du contenu serveur ? → le recevoir en children / slot (interleaving)
    ├── Il a besoin de données serveur ? → props sérialisables minimales, ou promesse passée en prop + use()
    └── C'est un provider de Context ? → Client Component qui enveloppe {children}, placé le plus bas possible
```

### Lire une donnée : où et comment ?

```
Lecture de donnée
├── Depuis un Server Component → appel direct à la DAL (await), pas de route API intermédiaire
├── Depuis un Client Component
│   ├── Donnée initiale → la lire dans le Server Component parent, passer en prop (ou promesse + use())
│   └── Donnée qui évolue côté client (polling, recherche instantanée) → Route Handler ou Server Function + TanStack Query
└── Partagée par plusieurs composants d'une même requête → fonction DAL enveloppée dans React.cache (déduplication)
```

### Cacher ou streamer ? (Cache Components)

```
La donnée est-elle la même pour tous les utilisateurs pendant une durée acceptable ?
├── Oui → 'use cache' + cacheLife explicite (+ cacheTag si une mutation doit l'invalider)
│        → incluse dans le static shell si sa durée de vie le permet
│        → renvoyer un DTO public : la fonction est appelable directement
└── Non → dépend de la requête (cookies, headers, searchParams, params non pré-générés) ?
    ├── Donnée publique variant selon une valeur runtime (région, langue) → lire la valeur HORS
    │        cache, la passer en argument à une fonction 'use cache'
    ├── Donnée de l'utilisateur ou soumise à ses droits → pas de cache serveur (DAL directe), ou
    │        'use cache: private' avec l'autorisation dans la fonction
    └── Doit être fraîche à chaque requête → pas de cache ; <Suspense fallback> autour du composant
```

### Après une mutation : quelle API ?

```
├── L'utilisateur doit voir sa propre écriture immédiatement → updateTag(tag)        (Server Action uniquement)
├── Contenu partagé, cohérence à terme acceptable           → revalidateTag(tag, 'max')
├── Données non cachées affichées ailleurs sur la page      → refresh()             (Server Action uniquement)
├── Pas de tag disponible, une route entière à rafraîchir   → revalidatePath(path)
└── Puis naviguer ailleurs                                  → redirect(url) en dernier, hors try/catch
```

### Server Action ou Route Handler ?

```
├── Mutation déclenchée par l'UI de l'app (formulaire, bouton)       → Server Action
├── Endpoint consommé par un tiers (webhook, mobile, autre service)  → Route Handler (route.ts)
├── Lecture depuis un Client Component, appels parallèles, cache HTTP → Route Handler (GET)
└── Réponse non-HTML (fichier, flux, RSS, image OG)                  → Route Handler
```

Les Server Actions sont dispatchées **une à la fois** par le client : ne pas s'en servir pour
charger des données en parallèle.

## Architecture d'un projet

```
app/                      routing uniquement : layout, page, loading, error, not-found, route.ts
  (marketing)/            route groups pour organiser sans toucher l'URL
  dashboard/
    page.tsx              compose des composants de feature ; lit params et appelle la DAL
    actions.ts            'use server' — actions minces qui délèguent à la DAL
features/<domaine>/
  components/             Server Components et Client Components ('use client' explicite)
  form.ts                 types d'état de formulaire et constantes, sans dépendance (importable côté client)
  schemas.ts              schémas de validation (actions, DAL) — ne pas importer depuis un Client Component par commodité
data/ (ou lib/dal/)       import 'server-only' — auth, autorisation, requêtes, DTO
lib/                      utilitaires purs, sans accès aux secrets
proxy.ts                  redirections / réécritures légères ; jamais la seule barrière d'auth
```

Correspondance SOLID :

| Principe | Forme Next.js | Signal de violation |
|---|---|---|
| SRP | `page.tsx` compose, la DAL lit, l'action orchestre, le Client Component interagit | requête SQL, contrôle d'accès et JSX interactif dans le même fichier |
| OCP | composition par `children` / slots, routes parallèles, variantes par composant | une page qui grossit d'un `if` par cas d'usage |
| LSP | Client Components qui enveloppent des natifs restent substituables (cf. `developing-react`) | wrapper qui casse `formAction`, `disabled`, `aria-*` |
| ISP | props d'un Client Component = DTO minimal sérialisable | objet de base de données entier passé à un composant client |
| DIP | composants et actions dépendent de la DAL (contrat), pas du client de base de données | `db.*` ou `process.env.SECRET` importé dans `app/` ou un composant |
| DRY | contraintes et types de formulaire définis une fois (`form.ts`), schéma unique côté serveur ; une fonction DAL réutilisée par pages et actions | la même règle d'autorisation recopiée dans trois actions |

## Rappels critiques

- **JAMAIS** de secret, de client de base de données ou de module `server-only` importé depuis un
  fichier `'use client'`. Seules les variables `NEXT_PUBLIC_*` atteignent le client.
- **JAMAIS** de confiance dans une vérification faite par la page ou le `proxy.ts` pour protéger
  une Server Action : chaque action ré-authentifie et vérifie la propriété de la ressource.
- **JAMAIS** d'enregistrement de base de données brut renvoyé par une action ou passé à un Client
  Component : un DTO.
- **JAMAIS** de donnée protégée renvoyée par une fonction `'use cache'` dont l'autorisation est faite
  par l'appelant : une fonction cachée est appelable directement par `POST`. Cache partagé = DTO
  public ; donnée par utilisateur = pas de cache serveur ou `'use cache: private'` avec
  l'autorisation dedans.
- **JAMAIS** `cookies()`, `headers()` ou `searchParams` lus **dans** une fonction `'use cache'`
  (ni dans ce qu'elle appelle) : les lire à l'extérieur, passer la valeur en argument.
- **JAMAIS** `redirect()` / `notFound()` dans un `try` qui les avalerait : ils fonctionnent en
  levant une exception.
- **JAMAIS** de mutation pendant le rendu (supprimer un cookie, invalider un cache) : une action.
- **TOUJOURS** un `cacheLife` explicite à côté de chaque `'use cache'`.
- **TOUJOURS** un `<Suspense>` autour d'un accès runtime ou d'une donnée non cachée — sinon
  l'erreur « blocking route » au dev / build.
- **TOUJOURS** valider les entrées d'une action (`FormData`, arguments) avec un schéma, et les
  `params` de route (segments `[x]` = entrée utilisateur).
- **TOUJOURS** `next/image` pour les images de contenu, `next/font` pour les polices, `next/link`
  pour la navigation interne.

## Fichiers de référence

| Fichier | Contenu | Quand le lire |
|---|---|---|
| [references/server-client-boundary.md](references/server-client-boundary.md) | `'use client'`, graphe de modules, interleaving, sérialisation des props, providers, librairies tierces, `server-only` | Découpage d'une page, doute sur un composant client |
| [references/data-and-caching.md](references/data-and-caching.md) | DAL de lecture, `React.cache`, Cache Components, `'use cache'` et variantes, `cacheLife`, `cacheTag`, `connection()`, static shell, prefetch, modèle précédent | Toute lecture de données, perf de navigation, erreur « blocking route » |
| [references/mutations-and-actions.md](references/mutations-and-actions.md) | Server Functions, validation, `useActionState` côté serveur, revalidation, `redirect`, cookies, optimiste, Route Handlers | Formulaire, mutation, endpoint |
| [references/routing-and-files.md](references/routing-and-files.md) | Conventions de fichiers, layouts, `loading`, erreurs (`error.tsx`, `catchError`, `global-error`), `not-found`, routes parallèles / interceptées, `proxy.ts`, types de routes, metadata, `generateStaticParams` | Création de routes, erreurs, SEO |
| [references/security.md](references/security.md) | DAL et DTO, auth / autorisation, IDOR, taint, variables d'environnement, `proxy.ts`, CSRF, checklist d'audit | Toute action, tout accès à des données privées, revue de sécurité |
| [references/performance-and-assets.md](references/performance-and-assets.md) | `next/image`, `next/font`, `next/script`, `next/dynamic`, bundle client, React Compiler, navigations instantanées | Lenteur, poids du bundle, Core Web Vitals |
| [references/testing.md](references/testing.md) | Vitest pour Client / Server Components synchrones, DAL et actions en tests unitaires, Playwright et `instant()` pour l'async | Écriture ou revue de tests |
| [references/anti-patterns.md](references/anti-patterns.md) | Catalogue avant / après propre à Next.js | Revue de code, refactoring, migration |

## Frontière avec les autres skills

- **React** (hooks, état, effets, composants clients, formulaires, tests RTL) → `developing-react`,
  toujours chargée avec celle-ci.
- **Typage avancé, validation de schémas** → `developing-typescript`.
- **Styles** (CSS Modules, SCSS, tokens) → `developing-scss`.
- **Audit de performance / Lighthouse** → `auditing-performance` ; **audit SEO** → `auditing-seo`.
- **Conteneurisation** → `containerizing-with-docker` ; **CI/CD** → `setting-up-cicd`.
- **Workflows officiels** de migration (adoption de Cache Components, Partial Prefetching,
  optimisation du bundle) : skills `next-*` de Vercel si installées dans le projet.
- **Conventions du dépôt** → `CLAUDE.md` et `AGENTS.md` du projet, qui priment sur cette skill.
