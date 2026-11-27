# Hooks custom et patterns

Un hook custom extrait **une** logique avec état ou effet, réutilisable et testable seule. Ce
fichier est le pendant React de `writing-clean-code` : partir d'un symptôme, appliquer le plus
petit correctif.

## Sommaire

1. Quand extraire un hook — et quand ne pas le faire
2. Concevoir l'API d'un hook
3. Symptôme → correctif → pattern
4. Machine à états : `useReducer` + union discriminée
5. Strategy : comportement injecté
6. Adapter : isoler un format externe
7. Decorator : envelopper une Action
8. Command + undo
9. Dépendances injectées (DIP) et testabilité
10. Anti-patterns de hooks

---

## 1. Quand extraire un hook

Extraire quand :

- la même combinaison état + effet apparaît dans **trois** composants (règle de trois) ;
- un composant mélange sa logique d'interaction et son rendu au point de ne plus se lire ;
- la logique mérite un test unitaire indépendant du rendu.

Ne pas extraire :

- une **fonction pure** sans hook à l'intérieur → c'est une fonction utilitaire, pas un hook
  (`formatPrice`, pas `useFormatPrice`) ;
- un unique `useState` renommé (`useToggle` qui ne fait que `useState(false)` n'apporte rien) ;
- un hook « fourre-tout » par écran (`useCheckoutPage`) qui déplace le problème sans le résoudre.

---

## 2. Concevoir l'API d'un hook

- **Nom** : ce que le hook fournit (`useOnlineStatus`, `useCartTotals`), pas comment.
- **Entrées** : un objet d'options dès 2+ paramètres optionnels.
- **Sortie** : un objet nommé (`{ items, add, remove }`) ; un tuple seulement pour une paire
  valeur / setter à la `useState`.
- **Surface minimale** : exposer des actions métier (`addItem`), pas le `dispatch` ni le setter brut.
- **Pas de JSX** : un hook qui retourne des éléments est un composant mal nommé.
- **Cleanup** : tout ce que le hook ouvre, il le ferme.

```tsx
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}
```

---

## 3. Symptôme → correctif → pattern

| Symptôme dans un composant React | Correctif minimal | Pattern si la douleur persiste |
|---|---|---|
| 3+ `useState` booléens corrélés (`isLoading`, `isError`, `isSuccess`) | une union discriminée dans un seul état | machine à états via `useReducer` (§4) |
| `useEffect` qui recalcule une valeur dans un `setState` | calcul pendant le rendu | — |
| `switch (mode)` dans plusieurs gestionnaires | map `mode → handler` | Strategy injectée (§5) |
| Format d'API manipulé dans les composants (`user.first_name`) | fonction de mapping à la frontière | Adapter dans la couche data (§6) |
| Même `try/catch` + `isPending` + toast recopié | `useActionState` / `useTransition` | Decorator d'Action (§7) |
| Annuler / refaire, historique d'éditions | liste d'états précédents | Command + undo (§8) |
| Composant intestable sans réseau | passer le client en paramètre / Context | DIP (§9) |
| Prop drilling sur 4 niveaux | composition (`children`, slots) | Context ciblé + hook d'accès |
| Composant de 300 lignes | extraire les sous-composants de rendu | hooks par préoccupation |

---

## 4. Machine à états : `useReducer` + union discriminée

```tsx
type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; file: File; progress: number }
  | { status: 'done'; url: string }
  | { status: 'failed'; file: File; message: string }

type UploadEvent =
  | { type: 'start'; file: File }
  | { type: 'progress'; progress: number }
  | { type: 'succeed'; url: string }
  | { type: 'fail'; message: string }
  | { type: 'reset' }

function uploadReducer(state: UploadState, event: UploadEvent): UploadState {
  switch (event.type) {
    case 'start':
      return state.status === 'uploading' ? state : { status: 'uploading', file: event.file, progress: 0 }
    case 'progress':
      return state.status === 'uploading' ? { ...state, progress: event.progress } : state
    case 'succeed':
      return state.status === 'uploading' ? { status: 'done', url: event.url } : state
    case 'fail':
      return state.status === 'uploading' ? { status: 'failed', file: state.file, message: event.message } : state
    case 'reset':
      return { status: 'idle' }
    default:
      return assertNever(event)
  }
}
```

Les transitions interdites sont ignorées **dans le reducer** : impossible d'être `done` sans être
passé par `uploading`. Le reducer est une fonction pure, testable sans React. Le hook expose des
actions métier :

```tsx
export function useUpload(uploadFile: UploadFn) {
  const [state, dispatch] = useReducer(uploadReducer, { status: 'idle' })

  async function upload(file: File) {
    dispatch({ type: 'start', file })
    try {
      const url = await uploadFile(file, (progress) => dispatch({ type: 'progress', progress }))
      dispatch({ type: 'succeed', url })
    } catch (error) {
      dispatch({ type: 'fail', message: toErrorMessage(error) })
    }
  }

  return { state, upload, reset: () => dispatch({ type: 'reset' }) }
}
```

---

## 5. Strategy : comportement injecté

Le comportement variable est **une fonction passée en paramètre**, pas une branche interne.

```tsx
type SortStrategy<T> = (a: T, b: T) => number

export const productSorts = {
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
} satisfies Record<string, SortStrategy<Product>>

export type ProductSortKey = keyof typeof productSorts

function ProductGrid({ products, sortKey }: { products: Product[]; sortKey: ProductSortKey }) {
  const sorted = products.toSorted(productSorts[sortKey]) // dérivé pendant le rendu
  return <List items={sorted} getKey={(p) => p.id} renderItem={(p) => <ProductCard product={p} />} />
}
```

Ajouter un tri = ajouter une entrée (OCP). `satisfies` vérifie la forme sans élargir le type des
clés.

---

## 6. Adapter : isoler un format externe

Le format de l'API ne traverse pas la frontière de la couche data.

```ts
// features/users/api.ts
type UserDto = { id: number; first_name: string; last_name: string; created_at: string }

export type User = { id: string; fullName: string; createdAt: Date }

function toUser(dto: UserDto): User {
  return { id: String(dto.id), fullName: `${dto.first_name} ${dto.last_name}`, createdAt: new Date(dto.created_at) }
}

export async function fetchUser(id: string, signal?: AbortSignal): Promise<User> {
  const response = await http.get<UserDto>(`/users/${id}`, { signal })
  return toUser(response)
}
```

Les composants ne connaissent que `User`. Un changement d'API touche **un** fichier. Valider la
réponse (Zod, Valibot) à cette même frontière si l'API n'est pas fiable — voir `developing-typescript`.

---

## 7. Decorator : envelopper une Action

React 19 couvre déjà l'état en attente (`useActionState`, `useTransition`). Le Decorator sert pour
un comportement **transverse** répété : télémétrie, notification d'erreur, retry.

```ts
type Action<A extends unknown[], R> = (...args: A) => Promise<R>

export function withErrorToast<A extends unknown[], R>(action: Action<A, R>, notify: (message: string) => void): Action<A, R> {
  return async (...args) => {
    try {
      return await action(...args)
    } catch (error) {
      notify(toErrorMessage(error))
      throw error
    }
  }
}
```

Fonction d'ordre supérieur pure, hors React, composable : `withErrorToast(withRetry(saveOrder), toast.error)`.

---

## 8. Command + undo

```tsx
type Command<S> = { apply: (state: S) => S; revert: (state: S) => S; label: string }

type History<S> = { present: S; past: Command<S>[]; future: Command<S>[] }

function historyReducer<S>(history: History<S>, event: { type: 'run'; command: Command<S> } | { type: 'undo' } | { type: 'redo' }): History<S> {
  switch (event.type) {
    case 'run':
      return { present: event.command.apply(history.present), past: [...history.past, event.command], future: [] }
    case 'undo': {
      const command = history.past.at(-1)
      if (!command) return history
      return { present: command.revert(history.present), past: history.past.slice(0, -1), future: [command, ...history.future] }
    }
    case 'redo': {
      const [command, ...future] = history.future
      if (!command) return history
      return { present: command.apply(history.present), past: [...history.past, command], future }
    }
  }
}
```

Si les états sont petits et immuables, un simple historique de snapshots (`past: S[]`) est plus
simple que des commandes réversibles : préférer la version la plus simple qui suffit.

---

## 9. Dépendances injectées (DIP) et testabilité

Un composant de présentation ne doit pas importer un client HTTP. Trois niveaux d'injection, du
plus simple au plus structurant :

1. **Prop / paramètre** : `useUpload(uploadFile)`, `<OrderForm onSubmit={submitOrder} />`.
2. **Context de services** pour les dépendances transverses (client API, horloge, analytics) :

```tsx
type Services = { api: ApiClient; now: () => Date }
const ServicesContext = createContext<Services | null>(null)

export function useServices(): Services {
  const services = use(ServicesContext)
  if (!services) throw new Error('useServices doit être utilisé sous <ServicesProvider>.')
  return services
}
```

3. **Couche data** (TanStack Query + fonctions d'API) : les composants appellent `useUserQuery(id)`,
   les tests interceptent le réseau avec MSW.

Ne pas construire de conteneur d'injection : un Context suffit.

---

## 10. Anti-patterns de hooks

| Anti-pattern | Pourquoi | À la place |
|---|---|---|
| Hook appelé dans une condition / boucle | casse l'ordre des hooks | appeler en haut ; `use()` est la seule exception |
| Hook qui retourne du JSX | mélange logique et rendu, remontages | un composant |
| `useEffect` pour exposer une valeur dérivée | rendu supplémentaire, état désynchronisé | calcul pendant le rendu |
| Retourner `dispatch` / setters bruts | fuite de l'implémentation | actions métier nommées |
| Hook qui lit une variable globale mutable | rendu impur, tearing | `useSyncExternalStore` |
| Ref « latest » bricolée pour contourner les deps | complexe, fragile | `useEffectEvent` (19.2+) |
| `useCallback` partout dans un hook | bruit si le compilateur est actif | rien, ou mémoïsation ciblée et justifiée |
