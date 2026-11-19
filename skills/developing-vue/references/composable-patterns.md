# Patterns GoF adaptés aux composables Vue 3.5

> **Posture** : un pattern est une **réponse à une douleur constatée**, jamais une étape du workflow.
> On écrit d'abord la version directe. Si elle devient illisible, dupliquée ou intestable, *alors*
> on nomme le pattern qui la range. Identifier un pattern avant d'écrire la première ligne produit
> de la sur-ingénierie — c'est l'anti-pattern n°1 de ce domaine.

Trois questions avant d'appliquer quoi que ce soit :

1. **Est-ce que Vue le fait déjà ?** `computed` remplace la moitié des Observer, un module ES *est*
   un Singleton, Pinia *est* un Store + Observer, `useAsyncData`/`useFetch` *sont* déjà un
   Decorator de chargement.
2. **Ai-je besoin de réactivité ?** Sinon, ce n'est pas un composable : c'est une fonction pure dans
   `utils/`. Préfixer `use` une fonction sans état réactif est un faux composable.
3. **Y a-t-il au moins deux cas d'usage réels ?** Un seul appelant → inline le code.

---

## Strategy — algorithmes interchangeables

Quand plusieurs algorithmes servent le même but et que le choix est fait à l'exécution (tri,
filtrage, formatage selon le contexte).

```ts
// composables/useSortStrategy.ts
import { computed, ref, type Ref } from 'vue'

export type SortStrategy<T> = (items: T[]) => T[]

export function useSortStrategy<T, K extends string>(
  items: Ref<readonly T[]>,
  strategies: Record<K, SortStrategy<T>>,
  initial: K,
) {
  const active = ref(initial) as Ref<K>

  // On copie avant de trier : sort() mute, et items est une source readonly.
  const sorted = computed(() => strategies[active.value]([...items.value]))

  return {
    sorted,
    active: computed(() => active.value),
    setStrategy: (name: K) => { active.value = name },
  }
}
```

```ts
const { sorted, setStrategy } = useSortStrategy(users, {
  alphabetical: (u) => u.sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  recent: (u) => u.sort((a, b) => b.createdAt - a.createdAt),
}, 'alphabetical')
```

Les stratégies sont passées par l'appelant, pas figées dans le composable : c'est ce qui le rend
réutilisable. Un composable qui embarque ses propres stratégies en dur n'est qu'un `switch`.

---

## Chain of Responsibility — validation séquentielle

Plusieurs règles s'appliquent dans l'ordre, la première qui échoue arrête la chaîne.

**Ce n'est pas un composable** : aucune réactivité en jeu. Une fonction pure, testable sans monter
de composant.

```ts
// utils/validation.ts
export type Validator<T> = (value: T) => string | null

export function chain<T>(...validators: Validator<T>[]) {
  return {
    validate(value: T): string | null {
      for (const validate of validators) {
        const error = validate(value)
        if (error) return error
      }
      return null
    },
    and(...next: Validator<T>[]) {
      return chain(...validators, ...next)
    },
  }
}

export const required = (label: string): Validator<string> =>
  (v) => v.trim() ? null : `${label} est obligatoire`

export const minLength = (n: number): Validator<string> =>
  (v) => v.length >= n ? null : `${n} caractères minimum`
```

```ts
const emailRules = chain(required('L\'email'), minLength(5))
const error = computed(() => emailRules.validate(email.value))
```

---

## Adapter — frontière avec l'API

Isole le format du backend du modèle métier du front. Une seule fonction de mapping, un seul endroit
à changer quand l'API bouge.

**Pas de composable ici non plus** — c'est une transformation pure.

```ts
// app/utils/adapters/user.ts
import type { ApiUser } from '~/types/api'
import type { User } from '~/types/domain'

export function toUser(dto: ApiUser): User {
  return {
    id: dto.user_id,
    name: `${dto.first_name} ${dto.last_name}`.trim(),
    email: dto.email_address,
    createdAt: new Date(dto.created_at),
  }
}

export const toUsers = (dtos: readonly ApiUser[]): User[] => dtos.map(toUser)
```

En Nuxt, l'adapter vit idéalement dans `server/` (adapté une fois côté serveur, jamais dans le
payload d'hydratation) — cf. `server/utils/pageAdapter.ts` dans le front AlloVoisins.

---

## Decorator — envelopper une action asynchrone

Ajoute `isPending` / `error` autour d'une action impérative (soumission, suppression) sans que
chaque composant réinvente le `try/finally`.

```ts
// composables/useAsyncAction.ts
import { readonly, ref } from 'vue'

export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const isPending = ref(false)
  const error = ref<Error | null>(null)

  async function execute(...args: TArgs): Promise<TResult | undefined> {
    isPending.value = true
    error.value = null
    try {
      return await action(...args)
    } catch (cause) {
      error.value = cause instanceof Error ? cause : new Error(String(cause))
      return undefined
    } finally {
      isPending.value = false
    }
  }

  return { execute, isPending: readonly(isPending), error: readonly(error) }
}
```

⚠️ **En Nuxt, pour du chargement de données, `useAsyncData` / `useFetch` font déjà tout ça** (SSR,
dédoublonnage, cache de payload). Ce composable ne sert que pour les actions déclenchées par
l'utilisateur.

---

## Lazy loading — charger une ressource au premier besoin

```ts
// composables/useLazyResource.ts
import { readonly, ref, shallowRef } from 'vue'

export function useLazyResource<T>(fetcher: () => Promise<T>) {
  const data = shallowRef<T | null>(null)
  const isLoading = ref(false)
  let inFlight: Promise<T> | null = null

  async function load(): Promise<T> {
    if (data.value !== null) return data.value
    if (inFlight) return inFlight // dédoublonne les appels concurrents

    isLoading.value = true
    inFlight = fetcher()
      .then((result) => { data.value = result; return result })
      .finally(() => { isLoading.value = false; inFlight = null })

    return inFlight
  }

  function invalidate() {
    data.value = null
    inFlight = null
  }

  return { data: readonly(data), isLoading: readonly(isLoading), load, invalidate }
}
```

🔴 **L'erreur à ne jamais commettre** — déclencher le chargement *depuis* un `computed` :

```ts
// ❌ Effet de bord + mutation des dépendances DANS un computed :
//    boucle réactive, avertissement Vue, comportement non déterministe en SSR.
const data = computed(() => {
  if (!isLoaded.value) {
    fetcher().then((r) => { cache.value = r; isLoaded.value = true })
  }
  return cache.value
})
```

Un `computed` est **pur** : il dérive, il ne déclenche rien et ne mute rien. Le chargement se fait
dans un appel explicite (`load()`), un `watchEffect`, ou un hook de cycle de vie.

---

## Command + Memento — undo / redo

Chaque action sait se rejouer et s'annuler. À réserver aux éditeurs, sélections multiples et
formulaires longs — pas à un CRUD ordinaire.

```ts
// composables/useCommandHistory.ts
import { computed, ref, shallowRef } from 'vue'

export interface Command {
  execute: () => void
  undo: () => void
}

export function useCommandHistory(limit = 50) {
  const history = shallowRef<Command[]>([])
  const index = ref(-1)

  const canUndo = computed(() => index.value >= 0)
  const canRedo = computed(() => index.value < history.value.length - 1)

  function execute(command: Command) {
    command.execute()
    const next = history.value.slice(0, index.value + 1)
    next.push(command)
    // Historique borné : sans limite, un éditeur fuit en mémoire sur une longue session.
    history.value = next.length > limit ? next.slice(next.length - limit) : next
    index.value = history.value.length - 1
  }

  function undo() {
    if (!canUndo.value) return
    history.value[index.value]!.undo()
    index.value--
  }

  function redo() {
    if (!canRedo.value) return
    index.value++
    history.value[index.value]!.execute()
  }

  return { execute, undo, redo, canUndo, canRedo }
}
```

**Memento** (snapshots d'état complet) est l'alternative quand écrire un `undo()` par action est
trop coûteux. Cloner avec `structuredClone(toRaw(state.value))` — `toRaw` est obligatoire, un proxy
réactif n'est pas clonable. Ne jamais utiliser `JSON.parse(JSON.stringify())` : perd `Date`, `Map`,
`Set`, `undefined` et casse sur les cycles.

Le compromis : Command = mémoire faible, code par action ; Memento = code trivial, mémoire lourde.

---

## State machine — comportement piloté par l'état

Quand un composant accumule les booléens (`isLoading && !hasError && isDirty`), c'est le signal
qu'un état fini unique doit les remplacer.

```ts
// composables/useStateMachine.ts
import { computed, ref, type Ref } from 'vue'

export function useStateMachine<S extends string, E extends string>(
  initial: S,
  transitions: Record<S, Partial<Record<E, S>>>,
) {
  const current = ref(initial) as Ref<S>

  function send(event: E): boolean {
    const next = transitions[current.value][event]
    if (!next) return false // transition invalide : on ignore, on ne crashe pas
    current.value = next
    return true
  }

  return {
    state: computed(() => current.value),
    is: (candidate: S) => current.value === candidate,
    send,
  }
}
```

Les génériques `S` / `E` sont inférés depuis l'appel, donc chaque machine a **ses** états typés —
un type `State` figé dans le composable ne survit pas au deuxième cas d'usage :

```ts
const connection = useStateMachine('disconnected', {
  disconnected: { CONNECT: 'connecting' },
  connecting: { SUCCESS: 'connected', ERROR: 'disconnected' },
  connected: { DISCONNECT: 'disconnected', ERROR: 'reconnecting' },
  reconnecting: { SUCCESS: 'connected', ERROR: 'disconnected' },
} as const)
```

---

## Observer / event bus — en dernier recours

> ⚠️ **Dans ~90 % des cas, l'event bus est le mauvais outil.** Parent ↔ enfant → props / emits.
> Ancêtre → descendants → `provide` / `inject`. État partagé → Pinia. Le bus ne se justifie que
> pour un signal transverse, non hiérarchique et sans état : session expirée, notification globale.
> Son coût : un flux impossible à tracer statiquement.

Le point critique : **un seul bus**, au niveau module. Créer la `Map` *dans* le composable donne à
chaque appelant son propre bus isolé — il n'émet alors vers personne.

```ts
// app/utils/eventBus.ts
export interface AppEvents {
  'session:expired': void
  'cart:updated': { itemCount: number }
}

type Handler<T> = (payload: T) => void

// ✅ Portée module : partagé par toute l'application.
const listeners = new Map<keyof AppEvents, Set<Handler<never>>>()

export function on<K extends keyof AppEvents>(
  event: K,
  handler: Handler<AppEvents[K]>,
): () => void {
  const set = listeners.get(event) ?? new Set()
  set.add(handler as Handler<never>)
  listeners.set(event, set)
  return () => { set.delete(handler as Handler<never>) }
}

export function emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]) {
  listeners.get(event)?.forEach((handler) => (handler as Handler<AppEvents[K]>)(payload))
}
```

Le désabonnement ne doit jamais reposer sur la discipline de l'appelant :

```ts
// composables/useAppEvent.ts
import { onScopeDispose } from 'vue'
import { on, type AppEvents } from '~/utils/eventBus'

export function useAppEvent<K extends keyof AppEvents>(
  event: K,
  handler: (payload: AppEvents[K]) => void,
) {
  onScopeDispose(on(event, handler))
}
```

`onScopeDispose` plutôt que `onUnmounted` : il fonctionne dans tout `effectScope`, y compris hors
composant. En SSR, garder le bus côté client uniquement (`import.meta.client`) — un `Map` au niveau
module est partagé entre les requêtes sur le serveur.

---

## Patterns écartés, et pourquoi

| Pattern | Pourquoi il ne mérite pas de code en Vue 3 |
|---|---|
| **Singleton** | Un module ES est déjà un singleton. L'IIFE `let instance` est du bruit — et en SSR, c'est une fuite d'état entre requêtes. |
| **Factory** | `defineAsyncComponent` + `<component :is>` couvrent le besoin. Une map `type → composant` suffit, ce n'est pas une factory. |
| **Builder** | Rare côté front. Un objet de config typé avec des champs optionnels est plus lisible qu'une API fluide. |
| **Prototype** | `structuredClone(toRaw(x))`, une ligne. |
| **Template Method** | Cinq callbacks optionnels en paramètres = une fonction ordinaire déguisée. |
| **Mediator** | Un store Pinia le fait mieux, avec devtools et typage. |
| **Iterator** | `for...of`, générateurs, ou pagination via `useAsyncData`. |
| **Facade / Composite** | À n'introduire que si le besoin apparaît vraiment (arbres de catégories, agrégation de plusieurs composables). Ne pas préinstaller. |
| **Proxy** | Remplacé ici par `useLazyResource`, qui répond au besoin réel sans le nom. |

Pour les patterns hors Vue (TS/JS pur, en objet comme en fonctionnel), les principes SOLID et le
catalogue des code smells, voir la skill `writing-clean-code`.
