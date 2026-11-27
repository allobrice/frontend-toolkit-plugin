# Anti-patterns Next.js

Catalogue de revue propre à l'App Router. Les anti-patterns React généraux sont dans
`developing-react` → `references/anti-patterns.md`.

## Sommaire

1. Frontière Server / Client
2. Données
3. Cache
4. Mutations
5. Routing
6. Sécurité
7. Idiomes périmés (Next ≤ 15)

---

## 1. Frontière Server / Client

| Signal | Coût | Correctif |
|---|---|---|
| `'use client'` en tête d'une page ou d'un layout | toute la sous-arborescence part dans le bundle | descendre la frontière sur la feuille interactive |
| Client Component qui importe un Server Component | erreur, ou composant tiré dans le bundle client | le passer en `children` / slot |
| `useEffect` + `fetch` dans un Client Component pour la donnée initiale | cascade, spinner, pas de SSR | lire dans le Server Component parent, passer en prop ou en promesse |
| Provider de Context autour de `<html>` | désoptimise l'arbre | l'envelopper autour de `{children}`, le plus bas possible |
| Composant tiers à hooks utilisé directement dans un Server Component | erreur au rendu | wrapper `'use client'` réexportant le composant |
| `'use client'` ajouté « pour que ça marche » sans besoin d'état ni d'événement | JavaScript inutile | retirer ; corriger la vraie cause |
| Client Component qui importe un type ou une constante depuis `schemas.ts` | toute la librairie de validation dans le bundle client | types et constantes dans un module sans dépendance (`form.ts`) |

---

## 2. Données

| Signal | Coût | Correctif |
|---|---|---|
| `db.*` ou SQL dans un `page.tsx` / composant | autorisation dispersée, fuites | DAL `server-only` |
| Server Component qui `fetch` un Route Handler de la même app | aller-retour HTTP inutile, perte de typage | appeler la DAL directement |
| `await` séquentiels indépendants | cascade | `Promise.all` ou composants distincts sous `<Suspense>` |
| `await params` / `await cookies()` en haut d'un layout | tout le layout devient dynamique | attendre au plus bas, sous `<Suspense>` |
| `user` passé de composant en composant | prop drilling, risque de fuite vers le client | `getCurrentUser()` mémoïsé par `React.cache` |
| Données serveur recopiées dans un store client global | double source de vérité | le serveur est la source ; `refresh()` / `updateTag()` après mutation |

---

## 3. Cache

| Signal | Coût | Correctif |
|---|---|---|
| `'use cache'` sans `cacheLife` | durée implicite, imprévisible en imbrication | `cacheLife` explicite |
| `cookies()` / `headers()` lus dans une fonction `'use cache'` ou ses dépendances | erreur `next-request-in-use-cache` | lire hors cache, passer la valeur en argument |
| Promesse runtime passée à une fonction cachée | build bloqué (timeout) | attendre la valeur avant, passer la valeur |
| Donnée personnelle dans un cache partagé | fuite entre utilisateurs | pas de cache serveur, ou `'use cache: private'` avec autorisation dedans |
| Autorisation faite par l'appelant d'une fonction `'use cache'` qui renvoie la donnée protégée | la fonction est appelable directement par `POST` : contrôle contourné | autorisation et projection DTO **dans** le scope (`security.md` §5) |
| Enregistrement brut renvoyé par une fonction cachée, projeté ensuite | champs internes stockés en cache et exposés en cas d'appel direct | projeter en DTO dans la fonction cachée |
| Composant dynamique sans `<Suspense>` | erreur « blocking route » | `<Suspense>`, ou cache si la donnée est partagée |
| `export const instant = false` pour faire taire l'erreur | navigation bloquante | `stream` ou `cache` ; `block` justifié par écrit |
| Tags écrits en littéraux dispersés | fautes de frappe, invalidations ratées | fabrique de tags centralisée |
| Activation de `cacheComponents` en passant | migration non maîtrisée | migration dédiée, validée |

---

## 4. Mutations

| Signal | Coût | Correctif |
|---|---|---|
| Action sans authentification parce que « la page est protégée » | endpoint public ouvert | ré-authentifier dans l'action / la DAL |
| Authentification sans vérification de propriété | IDOR | contrôler `ownerId` (ou rôle) sur la ressource |
| `formData.get('x') as string` sans validation | entrées arbitraires | schéma partagé client / serveur |
| Action qui renvoie l'enregistrement mis à jour | fuite de champs internes | état minimal |
| `redirect()` dans un `try` | redirection avalée | après le `try`, en dernier |
| `revalidatePath('/')` après chaque mutation | invalide tout, coûteux | `updateTag` ciblé |
| `revalidateTag(tag)` à un argument | déprécié | `updateTag(tag)` ou `revalidateTag(tag, 'max')` |
| `router.refresh()` côté client après l'action | aller-retour supplémentaire | `refresh()` / `updateTag()` dans l'action |
| Server Action utilisée pour lire des données | dispatch séquentiel, pas de cache | Server Component ou Route Handler `GET` |
| Mutation dans le rendu (cookie supprimé selon `searchParams`) | effet de bord sur un `GET` | Server Action |

---

## 5. Routing

| Signal | Coût | Correctif |
|---|---|---|
| Logique métier dans `app/` | routing et domaine mélangés | `features/`, `data/` |
| `loading.tsx` comme seule stratégie de chargement | tout le segment en squelette | `<Suspense>` ciblés |
| Slot parallèle sans `default.tsx` | build en échec (16+) | `default.tsx` qui renvoie `null` ou appelle `notFound()` |
| Types de `params` écrits à la main | dérive avec le routing | `PageProps` / `LayoutProps` / `RouteContext` générés |
| `params` utilisés sans validation | injection, erreurs non gérées | schéma ; `notFound()` si invalide |
| Logique lourde ou requête de base dans `proxy.ts` | latence sur chaque requête | `proxy` léger ; logique dans la DAL |
| Page « introuvable » maison sans `notFound()` | statut 200 sans `noindex`, SEO et monitoring faussés | `notFound()` ; avant tout streaming si un vrai 404 est requis (`routing-and-files.md` §5) |

---

## 6. Sécurité

| Signal | Correctif |
|---|---|
| Secret préfixé `NEXT_PUBLIC_` | variable serveur, lue dans la DAL |
| `process.env.SECRET` lu dans un composant | module de config `server-only` |
| Module serveur importable depuis le client | `import 'server-only'` |
| `proxy.ts` comme unique contrôle d'accès | contrôle dans la DAL et chaque action |
| Webhook sans vérification de signature | vérifier avant tout traitement |
| Détails d'erreur (stack, SQL) renvoyés à l'UI | message générique, détail en logs |

---

## 7. Idiomes périmés (Next ≤ 15 → 16)

| Périmé | Moderne |
|---|---|
| `params.slug` synchrone, `cookies().get()` synchrone | `await params`, `await cookies()` |
| `middleware.ts` / `export function middleware` | `proxy.ts` / `export function proxy` |
| `fetch(url, { next: { revalidate } })`, `unstable_cache`, `export const revalidate` (avec Cache Components) | `'use cache'` + `cacheLife` |
| `export const dynamic = 'force-dynamic'` (avec Cache Components) | `<Suspense>` + `connection()` si nécessaire |
| `experimental.ppr`, `experimental.dynamicIO` | `cacheComponents: true` |
| `experimental.reactCompiler` | `reactCompiler: true` |
| `error.tsx` avec `reset` | `retry` (vérifier dans la doc de la version installée) |
| Error Boundary maison qui avale `notFound()` / `redirect()` | `catchError` (16.3+) |
| `next lint` | ESLint ou Biome directement |
| `serverRuntimeConfig` / `publicRuntimeConfig` | variables d'environnement |
| `images.domains` | `images.remotePatterns` |
| `next/legacy/image` | `next/image` |
| Pages Router (`pages/`, `getServerSideProps`) pour du code neuf | App Router |
