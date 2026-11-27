# Frontière Server / Client

Les layouts et les pages sont des **Server Components** par défaut. `'use client'` déclare une
frontière dans le **graphe de modules** : le fichier marqué, tout ce qu'il importe et tout ce qu'il
rend directement partent dans le bundle client.

## Sommaire

1. Ce qui force un Client Component
2. Pousser la frontière vers les feuilles
3. Interleaving : du serveur dans du client
4. Props qui traversent la frontière
5. Passer une promesse : streaming vers le client
6. Context et providers
7. Librairies tierces
8. Empoisonnement d'environnement : `server-only`, `client-only`, variables d'environnement

---

## 1. Ce qui force un Client Component

| Besoin | Client Component ? |
|---|---|
| `useState`, `useReducer`, `useOptimistic`, `useActionState` | oui |
| `useEffect`, `useLayoutEffect`, refs DOM | oui |
| `onClick`, `onChange`, tout gestionnaire d'événement | oui |
| `window`, `localStorage`, `navigator`, `IntersectionObserver` | oui |
| `useRouter`, `usePathname`, `useSearchParams` | oui |
| Lire la base, un secret, un fichier, `cookies()` | **non** — Server Component |
| Afficher des données | **non** |
| `<form action={serverAction}>` sans état client | **non** — fonctionne sans JavaScript |
| `<Link>`, `<Image>` | **non** |

Un composant sans hook ni événement n'a **pas** besoin de `'use client'`, même s'il est importé par
un Client Component (il sera alors inclus dans le bundle client, ce qui est un autre problème : §2).

---

## 2. Pousser la frontière vers les feuilles

```tsx
// ❌ Toute la page part dans le bundle client pour un champ de recherche
'use client'
export default function ProductsPage() { … }

// ✅ La page reste serveur ; seule la feuille interactive est cliente
// app/products/page.tsx (Server Component)
import { SearchBox } from '@/features/products/components/SearchBox'
import { ProductGrid } from '@/features/products/components/ProductGrid'

export default async function ProductsPage(props: PageProps<'/products'>) {
  return (
    <>
      <SearchBox />
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}
```

```tsx
// features/products/components/SearchBox.tsx
'use client'

export function SearchBox() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // …
}
```

Règle : `'use client'` sur le fichier **le plus bas** qui en a besoin. Un composant de layout
(`Header`, `Sidebar`) reste serveur et rend des îlots clients (`UserMenu`, `ThemeToggle`).

---

## 3. Interleaving : du serveur dans du client

Un Client Component **ne peut pas importer** un Server Component, mais il peut en **recevoir** un en
`children` ou en prop : le Server Component est rendu sur le serveur et passé comme résultat.

```tsx
// features/cart/components/CartDrawer.tsx
'use client'

export function CartDrawer({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        {trigger}
      </button>
      <dialog open={isOpen}>{children}</dialog>
    </>
  )
}

// app/layout.tsx (Server Component)
<CartDrawer trigger="Panier">
  <CartContents /> {/* Server Component async : lit la DAL */}
</CartDrawer>
```

C'est le pattern central de l'App Router : l'**interactivité** vient du client, le **contenu** du
serveur. Il remplace la plupart des besoins de « fetch côté client ».

---

## 4. Props qui traversent la frontière

Les props passées d'un Server à un Client Component sont **sérialisées** dans le payload RSC et
**visibles dans le navigateur**.

| Autorisé | Interdit |
|---|---|
| primitives, objets simples, tableaux, `Date`, `Map`, `Set` | instances de classe, fonctions ordinaires |
| éléments JSX (`children`, slots) | symboles |
| Server Functions (`'use server'`) | secrets, jetons, enregistrements de base complets |
| promesses (lues avec `use()` côté client) | — |

- Passer un **DTO minimal** : `{ name, avatarUrl }`, jamais l'objet `user` de la base (ISP + sécurité).
- Le type des props d'un Client Component documente ce qui fuit vers le client : le garder étroit.
- Nommer `xxxAction` une prop fonction qui est une Server Action (convention React 19).

---

## 5. Passer une promesse : streaming vers le client

Pour qu'un Client Component affiche une donnée serveur sans bloquer le rendu du parent :

```tsx
// Server Component
export default function Page() {
  const statsPromise = getStats() // pas d'await : la promesse part en prop
  return (
    <Suspense fallback={<StatsSkeleton />}>
      <StatsChart statsPromise={statsPromise} />
    </Suspense>
  )
}

// Client Component
'use client'
export function StatsChart({ statsPromise }: { statsPromise: Promise<Stats> }) {
  const stats = use(statsPromise)
  return <Chart data={stats} />
}
```

La promesse est créée sur le serveur, donc **stable** : pas de boucle de suspension.

---

## 6. Context et providers

Le Context n'existe pas dans les Server Components. Un provider est un Client Component qui
enveloppe `{children}` :

```tsx
// app/providers/ThemeProvider.tsx
'use client'

const ThemeContext = createContext<Theme | null>(null)

export function ThemeProvider({ initialTheme, children }: { initialTheme: Theme; children: ReactNode }) {
  const [theme, setTheme] = useState(initialTheme)
  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
}
```

- Le placer **le plus bas possible** (autour de `{children}` dans le `<body>`, ou d'une section),
  pas autour de `<html>` : le reste de l'arbre reste optimisable.
- Les Server Components ne lisent pas le Context : ils lisent la DAL (`getCurrentUser()` mémoïsé
  par `React.cache`).
- Données serveur dans un Context : passer une **promesse** au provider et la lire avec `use()`
  dans les consommateurs.

---

## 7. Librairies tierces

Un composant tiers qui utilise des hooks sans déclarer `'use client'` casse dans un Server
Component. L'envelopper une fois :

```tsx
// components/vendor/Carousel.tsx
'use client'
export { Carousel } from 'acme-carousel'
```

---

## 8. Empoisonnement d'environnement

- `import 'server-only'` en tête de tout module qui touche la base, un secret ou une API interne :
  importer ce module depuis le client échoue **au build**.
- `import 'client-only'` pour un module qui touche `window`.
- Seules les variables `NEXT_PUBLIC_*` sont incluses dans le bundle client ; les autres deviennent
  une chaîne vide côté client. Ne jamais préfixer `NEXT_PUBLIC_` une valeur secrète.
- Lire `process.env` **uniquement** dans la DAL ou un module de configuration serveur, validé au
  démarrage par un schéma.
