# Tests dans un projet Next.js

Les règles de `developing-react` → `references/testing.md` s'appliquent (comportement plutôt
qu'implémentation, requêtes par rôle, `user-event`, MSW). Ce fichier couvre ce que le modèle serveur
change.

## Sommaire

1. Pyramide adaptée à l'App Router
2. Ce que Vitest teste bien
3. Ce que Vitest ne teste pas : Server Components async
4. Tester la DAL et les actions
5. Tests e2e Playwright et `instant()`
6. Le build comme test

---

## 1. Pyramide adaptée à l'App Router

| Niveau | Cible | Outil |
|---|---|---|
| Unitaire | schémas, DTO, mappers, règles d'autorisation, reducers, utilitaires | Vitest |
| Unitaire | DAL et Server Actions (fonctions async) avec dépendances simulées | Vitest |
| Composant | Client Components, Server Components **synchrones** | Vitest + Testing Library |
| Intégration / e2e | pages avec Server Components async, parcours, navigation, cache | Playwright |
| Structure | pré-rendu, frontières `<Suspense>`, types de routes | `next build` |

---

## 2. Ce que Vitest teste bien

- Client Components (formulaires, interactions) : rendre avec une **Server Action simulée** passée
  en prop (`renameAction={vi.fn(async () => ({ status: 'success' }))}`) ou un module mocké.
- Server Components synchrones (présentation pure à partir de props).
- Configuration de référence : guide « Vitest » de la doc embarquée (`@vitejs/plugin-react`,
  `vite-tsconfig-paths`, environnement `jsdom`). Ne pas modifier la config de test sans validation.

Les hooks de `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) se simulent avec
`vi.mock('next/navigation', …)` ; garder ces mocks dans un helper partagé (DRY).

---

## 3. Ce que Vitest ne teste pas : Server Components async

Vitest ne prend pas en charge les Server Components `async`. Ne pas contourner en appelant
`await Page()` et en rendant le résultat : le test ne reflète ni le streaming, ni Suspense, ni le
cache. À la place :

- extraire la logique (lecture, mise en forme, autorisation) en fonctions testées unitairement ;
- garder le composant async mince (il appelle la DAL et rend des composants de présentation testés) ;
- couvrir la page par un test e2e.

---

## 4. Tester la DAL et les actions

Ce sont des fonctions async : les tester directement.

```ts
// data/projects.test.ts
vi.mock('server-only', () => ({}))
vi.mock('./auth', () => ({ requireUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { project: { findUnique: vi.fn(), update: vi.fn() } } }))

it("refuse de renommer le projet d'un autre utilisateur", async () => {
  vi.mocked(requireUser).mockResolvedValue({ id: 'user-1' })
  vi.mocked(db.project.findUnique).mockResolvedValue({ ownerId: 'user-2' })

  await expect(renameProject({ projectId: 'p1', name: 'Nouveau' })).rejects.toBeInstanceOf(ProjectAccessError)
  expect(db.project.update).not.toHaveBeenCalled()
})
```

- Tests prioritaires : **autorisation refusée**, validation refusée, cas nominal, invalidation
  appelée avec le bon tag.
- Mocker `next/cache` (`updateTag`, `revalidateTag`) et `next/navigation` (`redirect`) dans les tests
  d'actions ; vérifier qu'ils sont appelés, pas leur effet.
- `redirect` lève une exception : l'attendre explicitement dans le test.

---

## 5. Tests e2e Playwright et `instant()`

- Parcours critiques (connexion, création, paiement) en e2e, contre un build de production
  (`next build && next start`) pour refléter le pré-rendu et le cache.
- `instant()` de `@next/playwright` (16.3+) vérifie ce qui est visible **immédiatement** pendant une
  navigation, sans attendre le réseau : il verrouille les navigations instantanées contre les
  régressions (un `cookies()` ajouté dans un layout partagé, une frontière `<Suspense>` déplacée).

```ts
import { expect, test } from '@playwright/test'
import { instant } from '@next/playwright'

test('le titre du produit est disponible immédiatement', async ({ page }) => {
  await page.goto('/products/shoes')
  await instant(page, async () => {
    await page.click('a[href="/products/hats"]')
    await expect(page.locator('h1')).toContainText('Casquette')
  })
})
```

- Écriture et maintenance des tests e2e : agents `playwright-test-*`.

---

## 6. Le build comme test

Les types `PageProps` / `LayoutProps` / `RouteContext` sont générés : sur un clone neuf, `tsc
--noEmit` échoue tant que `next typegen` (ou `next dev` / `next build`) n'a pas tourné. Lancer
`next typegen` avant le typecheck si le script du projet ne le fait pas, et le signaler.

Un mock de `next/cache` transforme `'use cache'` en no-op : les tests unitaires ne voient ni les
effets du cache ni l'exposition des fonctions cachées. Compléter par une vérification sur le build
(`next start`) qu'aucune réponse — HTML, payload RSC — ne contient de champ interne ni les données
d'un autre utilisateur.

`next build` est une vérification à part entière en Cache Components : il échoue sur les accès
runtime sans `<Suspense>`, les caches imbriqués mal configurés, les slots sans `default.tsx`,
`ensureStatic` violé et les erreurs de types de routes. Le lancer avant de déclarer une tâche
terminée dès que des routes, des layouts ou du cache sont touchés.
