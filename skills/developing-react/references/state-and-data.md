# État et données

Choisir **où** vit chaque donnée, puis la manipuler avec l'outil le plus simple qui suffit.

## Sommaire

1. Les cinq catégories d'état
2. État local : `useState`, `useReducer`, état dérivé
3. Réinitialiser un état : `key`
4. Partager : remonter, composer, Context
5. Stores externes
6. Données serveur : TanStack Query
7. Suspense et Error Boundaries
8. Routing et état d'URL

---

## 1. Les cinq catégories d'état

| Catégorie | Exemples | Outil |
|---|---|---|
| Dérivé | total du panier, liste filtrée, validité d'un formulaire | calcul pendant le rendu |
| Local d'UI | ouvert / fermé, onglet actif, saisie en cours | `useState`, `useReducer` |
| URL | filtres, page, tri, élément sélectionné partageable | paramètres d'URL du router |
| Serveur | utilisateur, commandes, catalogue | TanStack Query (cache, invalidation, retry) |
| Global client | thème, session, préférences, panier hors ligne | Context si rare, store externe si fréquent |

L'erreur la plus courante : copier de l'état serveur dans un `useState` ou un store global, puis
le synchroniser à la main. Le cache serveur **est** la source de vérité.

---

## 2. État local

### Minimal, et rien de dérivé

```tsx
// ❌ État dupliqué, synchronisé par effet
const [items, setItems] = useState<CartItem[]>([])
const [total, setTotal] = useState(0)
useEffect(() => setTotal(sumPrices(items)), [items])

// ✅ Dérivé pendant le rendu
const [items, setItems] = useState<CartItem[]>([])
const total = sumPrices(items)
```

Stocker un **identifiant** plutôt qu'une copie de l'objet sélectionné :

```tsx
const [selectedId, setSelectedId] = useState<string | null>(null)
const selected = items.find((item) => item.id === selectedId) ?? null
```

### Mises à jour

- Mise à jour fonctionnelle quand la valeur suivante dépend de la précédente :
  `setCount((c) => c + 1)`.
- Immutabilité : `toSorted`, `toSpliced`, `with`, spread. Jamais `push` / `sort` sur l'état.
- Initialisation coûteuse paresseuse : `useState(() => parseDraft(storage))`.

### `useReducer`

Passer à `useReducer` quand : 3+ champs évoluent ensemble, les transitions sont contraintes, ou
la logique de mise à jour mérite un test. Patron complet : `hook-patterns.md` §4.

---

## 3. Réinitialiser un état : `key`

```tsx
// ❌ Effet de réinitialisation : un rendu avec l'ancien état, puis un second
useEffect(() => setComment(''), [postId])

// ✅ Nouvelle identité = nouvel état
<CommentForm key={postId} postId={postId} />
```

---

## 4. Partager

Dans l'ordre :

1. **Remonter** l'état au parent commun le plus proche.
2. **Composer** : passer des éléments en `children` / slots pour éviter de traverser des
   intermédiaires qui ne s'en servent pas.
3. **Context** quand des composants éloignés lisent la même donnée qui change peu.

### Context bien découpé

```tsx
type Session = { user: User; permissions: Permission[] }
type SessionActions = { signOut: () => Promise<void> }

const SessionContext = createContext<Session | null>(null)
const SessionActionsContext = createContext<SessionActions | null>(null)

export function SessionProvider({ session, actions, children }: {
  session: Session
  actions: SessionActions
  children: ReactNode
}) {
  return (
    <SessionContext value={session}>
      <SessionActionsContext value={actions}>{children}</SessionActionsContext>
    </SessionContext>
  )
}
```

Règles :

- **Un Context par préoccupation** (session, thème, locale) — pas un `AppContext` global.
- Séparer données et actions quand les consommateurs d'actions ne lisent pas les données.
- Toujours un hook d'accès qui vérifie la présence du provider.
- Context n'est **pas** un gestionnaire d'état : tous les consommateurs re-rendent à chaque
  changement de `value`. Pour un état qui change souvent et qu'on lit par morceaux → store externe.

---

## 5. Stores externes

### `useSyncExternalStore` — s'abonner à une source non React

API navigateur, librairie tierce, store maison :

```tsx
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
```

`getSnapshot` doit retourner une valeur **stable** tant que rien n'a changé (pas un nouvel objet
à chaque appel).

### Zustand — si le projet l'a déjà ou si l'état global est riche et fréquent

```ts
type CartStore = {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (id: string) => void
}

export const useCartStore = create<CartStore>()((set) => ({
  items: [],
  add: (item) => set((state) => ({ items: [...state.items, item] })),
  remove: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
}))

// Sélecteur fin : le composant ne re-rend que si `count` change
const count = useCartStore((state) => state.items.length)
```

Ne pas ajouter Zustand (ni Redux, Jotai…) sans validation : c'est une dépendance et un choix
d'architecture.

---

## 6. Données serveur : TanStack Query

Par défaut pour toute donnée serveur en SPA : cache, déduplication, retry, invalidation,
annulation, états de chargement.

### Organisation

```ts
// features/orders/queries.ts
export const orderKeys = {
  all: ['orders'] as const,
  list: (filters: OrderFilters) => [...orderKeys.all, 'list', filters] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
}

export function orderQueryOptions(id: string) {
  return queryOptions({
    queryKey: orderKeys.detail(id),
    queryFn: ({ signal }) => fetchOrder(id, signal),
  })
}

export function useOrder(id: string) {
  return useSuspenseQuery(orderQueryOptions(id))
}

export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelOrder,
    onSuccess: (_result, id) => queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) }),
  })
}
```

- Fabrique de clés centralisée par feature ; `queryOptions` réutilisable dans les hooks, les
  loaders de route et le préchargement (`queryClient.prefetchQuery`).
- Transmettre `signal` au fetch pour l'annulation.
- `useSuspenseQuery` + `<Suspense>` + Error Boundary pour un code de composant sans branches de
  chargement ; `useQuery` quand le composant doit afficher l'ancien résultat pendant le rechargement.
- Mutations : invalider plutôt que patcher le cache à la main, sauf besoin optimiste.
- Le formulaire peut combiner `useActionState` (état du formulaire) et `mutateAsync` (appel).

---

## 7. Suspense et Error Boundaries

### Placement

Placer les frontières **au niveau de l'unité d'UI qui a du sens seule** : un panneau, une carte,
une section — pas autour de chaque composant, ni une seule autour de l'app.

```tsx
<ErrorBoundary FallbackComponent={SectionError} onReset={reset}>
  <Suspense fallback={<OrdersSkeleton />}>
    <OrdersTable />
  </Suspense>
</ErrorBoundary>
```

### Error Boundary

React ne fournit toujours pas d'Error Boundary en hook. Utiliser `react-error-boundary` si le
projet l'a, sinon une seule classe partagée — la seule classe tolérée dans le code :

```tsx
type ErrorBoundaryProps = { fallback: (error: Error, reset: () => void) => ReactNode; children: ReactNode }
type ErrorBoundaryState = { error: Error | null }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children
  }
}
```

Les Error Boundaries n'attrapent pas les erreurs des gestionnaires d'événements ni du code async
hors rendu : les gérer dans l'Action (état d'erreur) ou la mutation (`onError`).

### Transitions et Suspense

Une mise à jour dans `startTransition` garde l'UI actuelle visible au lieu de réafficher le
fallback : l'utiliser pour les navigations et changements de filtres. `useDeferredValue` pour
une saisie qui pilote un rendu lourd.

---

## 8. Routing et état d'URL

- Réutiliser le router du projet (React Router, TanStack Router). Ne pas en introduire un autre.
- L'état partageable (filtres, page, tri, onglet) vit dans l'URL : il survit au rechargement,
  au partage et au bouton retour.
- Valider / typer les paramètres de recherche à la lecture (schéma), avec des valeurs par défaut.
- Routes chargées paresseusement (`lazy`) ; précharger les données dans le loader de route avec
  `queryClient.ensureQueryData(...)` pour éviter les cascades réseau.
