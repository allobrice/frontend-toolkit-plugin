# Idiomes React 19 → 19.3

Référence des API modernes, avec la forme à écrire et ce qu'elle remplace. Vérifier la version
mineure du projet avant d'utiliser une API marquée 19.2 ou 19.3.

## Sommaire

1. Actions et formulaires — `useActionState`, `<form action>`, `useFormStatus`, `useOptimistic`
2. `use()` — promesses et Context
3. `ref` comme prop, callback refs avec cleanup
4. Context rendu directement comme provider
5. Métadonnées de document et ressources
6. `useEffectEvent` (19.2)
7. `<Activity>` (19.2)
8. `<ViewTransition>` et `addTransitionType` (19.3)
9. Fragment refs (19.3)
10. React Compiler 1.0
11. Ce qui a disparu

---

## 1. Actions et formulaires

Une **Action** est une fonction (souvent async) déclenchée dans une transition. React gère pour
elle l'état en attente, les erreurs et les mises à jour optimistes.

### `useActionState`

```ts
const [state, formAction, isPending] = useActionState(action, initialState)
// action: (previousState: State, payload: FormData | P) => State | Promise<State>
```

```tsx
import { useActionState } from 'react'

type SignupState =
  | { status: 'idle' }
  | { status: 'error'; message: string; fieldErrors: Partial<Record<'email' | 'password', string>> }
  | { status: 'success'; email: string }

async function signup(_previous: SignupState, formData: FormData): Promise<SignupState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  const fieldErrors = validateSignup({ email, password })
  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Le formulaire contient des erreurs.', fieldErrors }
  }

  const result = await api.signup({ email, password })
  if (!result.ok) return { status: 'error', message: result.message, fieldErrors: {} }

  return { status: 'success', email }
}

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, { status: 'idle' })

  if (state.status === 'success') return <p role="status">Compte créé pour {state.email}.</p>

  const fieldErrors = state.status === 'error' ? state.fieldErrors : {}

  return (
    <form action={formAction} noValidate>
      <EmailField error={fieldErrors.email} />
      <PasswordField error={fieldErrors.password} />
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Création…' : 'Créer mon compte'}
      </button>
    </form>
  )
}
```

Points clés :

- L'action est **une fonction pure de module**, testable seule, hors du composant.
- L'état est une **union discriminée** : pas de `isLoading` + `error` + `data` corrélés.
- `<form action={fn}>` réinitialise automatiquement les champs **non contrôlés** après succès.
  Pour conserver une saisie après une erreur, renvoyer les valeurs dans l'état et les passer en
  `defaultValue`.
- Hors formulaire, `formAction` s'appelle dans `startTransition(() => formAction(payload))`.

### Pièges des Actions de formulaire

| Piège | Conséquence | Conduite |
|---|---|---|
| Champs modifiables pendant `isPending` | le reset automatique de fin d'Action **efface ce qui a été tapé pendant l'envoi** | `readOnly={isPending}` sur les champs (**pas** `disabled` : un champ désactivé est exclu du `FormData`) ; ou formulaire contrôlé si la saisie pendant l'envoi est un besoin |
| `catch {}` qui transforme toute exception en « échec serveur » | un vrai bug (TypeError) devient un message utilisateur, sans trace | distinguer erreur métier attendue et erreur inattendue ; signaler l'inattendue (`reportError` / logger du projet) |
| Appel réseau sans délai maximal | une promesse qui ne se résout jamais laisse `isPending` à `true` et **bloque les transitions suivantes** | accepter un `signal` dans la fonction d'API et passer `AbortSignal.timeout(ms)` |
| Deux blocs d'erreur (validation / serveur) dont un seul est relié au champ | message d'échec non annoncé avec le champ, duplication | un seul bloc `role="alert"` avec un `id`, référencé par `aria-describedby` dès que l'état n'est pas `idle` ; `aria-invalid` seulement pour l'erreur de validation |
| Prop callback appelée dans une transition mais nommée `onXxx` | le contrat « doit s'exécuter dans une Action » (requis par `useOptimistic`) est invisible | nommer la prop `xxxAction` (convention React 19) et typer son retour `Promise<void>` |
| Clé optimiste différente de la clé confirmée | l'élément est démonté / remonté à la confirmation (perte de focus, animation cassée) | générer l'id côté client et le faire conserver par l'API quand c'est possible |

### `useFormStatus`

Lit l'état du `<form>` parent le plus proche. Doit être appelé dans un **composant enfant** du form.

```tsx
import { useFormStatus } from 'react-dom'

export function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {children}
    </button>
  )
}
```

### `useOptimistic`

```ts
const [optimisticState, addOptimistic] = useOptimistic(state, (current, optimisticValue) => next)
```

```tsx
import { useOptimistic, startTransition } from 'react'

type Todo = { id: string; title: string; isPending?: boolean }

export function TodoList({ todos, onAdd }: { todos: Todo[]; onAdd: (title: string) => Promise<void> }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (current: Todo[], title: string) => [...current, { id: `pending-${title}`, title, isPending: true }],
  )

  function handleAdd(formData: FormData) {
    const title = String(formData.get('title') ?? '').trim()
    if (!title) return
    startTransition(async () => {
      addOptimisticTodo(title)
      await onAdd(title)
    })
  }

  return (
    <>
      <form action={handleAdd}>
        <label htmlFor="new-todo">Nouvelle tâche</label>
        <input id="new-todo" name="title" />
        <button type="submit">Ajouter</button>
      </form>
      <ul>
        {optimisticTodos.map((todo) => (
          <li key={todo.id} aria-busy={todo.isPending}>{todo.title}</li>
        ))}
      </ul>
    </>
  )
}
```

La valeur optimiste disparaît d'elle-même à la fin de la transition : en cas d'échec, `todos` n'a
pas changé et l'UI revient à la vérité, sans rollback manuel.

### Quand garder un formulaire contrôlé

`<form action>` + `FormData` convient à la majorité des formulaires. Garder des inputs contrôlés
quand la valeur pilote l'UI **pendant la saisie** : recherche instantanée, masque de saisie,
champs dépendants, validation à la frappe. Pour un formulaire complexe déjà outillé
(React Hook Form + schéma), ne pas réécrire : réutiliser l'existant.

---

## 2. `use()`

`use` lit une ressource pendant le rendu. Contrairement aux hooks, il **peut être appelé dans une
condition ou une boucle**.

### Promesse

```tsx
import { use, Suspense } from 'react'

function UserName({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise)
  return <span>{user.name}</span>
}

export function Profile({ userPromise }: { userPromise: Promise<User> }) {
  return (
    <ErrorBoundary fallback={<p role="alert">Profil indisponible.</p>}>
      <Suspense fallback={<Spinner label="Chargement du profil" />}>
        <UserName userPromise={userPromise} />
      </Suspense>
    </ErrorBoundary>
  )
}
```

Règle impérative : **la promesse doit être stable**. Une promesse créée pendant le rendu
(`use(fetchUser(id))`) en crée une nouvelle à chaque rendu → boucle de suspension. La créer dans
un loader de route, un gestionnaire d'événement, ou passer par un cache (TanStack Query
`useSuspenseQuery`). En SPA, TanStack Query reste le choix par défaut pour les données serveur ;
`use(promise)` sert quand une promesse stable existe déjà (loader, prop).

### Context

```tsx
function Price({ amount, showCurrency }: { amount: number; showCurrency: boolean }) {
  if (!showCurrency) return <>{amount}</>
  const { currency } = use(LocaleContext) // autorisé après un early return
  return <>{formatMoney(amount, currency)}</>
}
```

---

## 3. `ref` comme prop

`ref` est une prop ordinaire des composants fonctionnels. `forwardRef` est inutile (et sera
déprécié).

```tsx
import { useId, type ComponentProps } from 'react'
import clsx from 'clsx'
import styles from './TextInput.module.scss'

type TextInputProps = ComponentProps<'input'> & { label: string; error?: string }

export function TextInput({ ref, label, error, id, className, ...inputProps }: TextInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      <input
        ref={ref}
        id={inputId}
        className={clsx(styles.input, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && <p id={errorId} className={styles.error}>{error}</p>}
    </div>
  )
}
```

`ComponentProps<'input'>` inclut déjà `ref` en React 19.

### Callback ref avec cleanup

```tsx
<div
  ref={(node) => {
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }}
/>
```

Avec un cleanup retourné, React n'appelle plus la ref avec `null`. En TypeScript, un callback ref
en expression fléchée ne doit **pas** retourner implicitement une valeur (`ref={(n) => (x = n)}`
est refusé) : utiliser un corps entre accolades.

---

## 4. Context comme provider

```tsx
const ThemeContext = createContext<Theme | null>(null)

export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <ThemeContext value={theme}>{children}</ThemeContext>
}

export function useTheme(): Theme {
  const theme = use(ThemeContext)
  if (!theme) throw new Error('useTheme doit être utilisé sous <ThemeProvider>.')
  return theme
}
```

Exposer un **hook d'accès** (`useTheme`) plutôt que le Context brut : il porte le contrôle de
présence et masque l'implémentation.

---

## 5. Métadonnées et ressources

`<title>`, `<meta>` et `<link>` rendus n'importe où sont hissés dans `<head>`.

```tsx
export function ProductPage({ product }: { product: Product }) {
  return (
    <article>
      <title>{`${product.name} — Boutique`}</title>
      <meta name="description" content={product.summary} />
      <h1>{product.name}</h1>
    </article>
  )
}
```

`<title>` attend **une seule chaîne** : composer avec un template literal, pas plusieurs enfants.
Préchargement : `preload`, `preinit`, `prefetchDNS`, `preconnect` depuis `react-dom`.

---

## 6. `useEffectEvent` (19.2)

Sépare la partie **non réactive** d'un effet : elle lit toujours les dernières props / état sans
devenir une dépendance.

```tsx
import { useEffect, useEffectEvent } from 'react'

function ChatRoom({ roomId, theme }: { roomId: string; theme: Theme }) {
  const onConnected = useEffectEvent(() => {
    showNotification('Connecté', theme)
  })

  useEffect(() => {
    const connection = createConnection(roomId)
    connection.on('connected', onConnected)
    connection.connect()
    return () => connection.disconnect()
  }, [roomId]) // `theme` ne reconnecte pas ; `onConnected` n'est jamais une dépendance
}
```

Règles : déclarer l'Effect Event dans le même composant / hook que l'effet ; ne l'appeler que
depuis un effet ; ne jamais le mettre dans un tableau de dépendances ; ne pas s'en servir pour
faire taire le linter quand la valeur doit réellement relancer l'effet.

---

## 7. `<Activity>` (19.2)

```tsx
import { Activity } from 'react'

<Activity mode={activeTab === 'settings' ? 'visible' : 'hidden'}>
  <SettingsPanel />
</Activity>
```

- `hidden` : enfants masqués, **effets démontés**, mises à jour différées, **état conservé**.
- Usages : onglets dont la saisie doit survivre, pré-rendu d'un écran probable, retour arrière
  instantané.
- Ne pas l'utiliser pour tout : un rendu conditionnel simple reste correct quand l'état n'a pas à
  survivre.

---

## 8. `<ViewTransition>` et `addTransitionType` (19.3)

Anime enter / exit / update / shared element via l'API View Transitions du navigateur.
**Ne s'active que pour des mises à jour en transition** (`startTransition`, révélation de
`<Suspense>`, `useDeferredValue`).

```tsx
import { ViewTransition, startTransition, addTransitionType } from 'react'

function goTo(direction: 'next' | 'previous') {
  startTransition(() => {
    addTransitionType(direction)
    setIndex((i) => i + (direction === 'next' ? 1 : -1))
  })
}

<ViewTransition
  enter={{ next: 'slide-from-right', previous: 'slide-from-left' }}
  exit={{ next: 'slide-to-left', previous: 'slide-to-right' }}
>
  <Slide key={index} />
</ViewTransition>
```

Les classes se stylent avec `::view-transition-old(.slide-to-left)` /
`::view-transition-new(...)` et `:active-view-transition-type(next)`. Respecter
`prefers-reduced-motion` dans le SCSS. Props d'événements : `onEnter`, `onExit`, `onUpdate`,
`onShare`.

---

## 9. Fragment refs (19.3)

```tsx
import { Fragment, useRef, useEffect } from 'react'
import type { FragmentInstance } from 'react'

function ResultsGroup({ results, shouldFocus }: Props) {
  const groupRef = useRef<FragmentInstance>(null)

  useEffect(() => {
    if (shouldFocus) groupRef.current?.focus() // focus le premier descendant focusable
  }, [shouldFocus])

  return (
    <Fragment ref={groupRef}>
      {results.map((result) => <ResultCard key={result.id} result={result} />)}
    </Fragment>
  )
}
```

Méthodes : `addEventListener` / `removeEventListener`, `focus` / `focusLast` / `blur`,
`observeUsing(observer)` / `unobserveUsing`, `getClientRects`, `scrollIntoView`. Remplace le `<div>`
ajouté uniquement pour porter une ref. Vérifier le nom exact du type exporté dans `@types/react`
installé.

---

## 10. React Compiler 1.0

Le compilateur mémoïse automatiquement composants et valeurs. Conséquences pour l'écriture :

- Code neuf : **pas** de `useMemo`, `useCallback`, `memo` par défaut. Les garder comme échappatoire
  quand une identité stable est requise (dépendance d'effet tierce, librairie qui compare par
  référence) et que le compilateur ne la garantit pas.
- Code existant : ne pas retirer la mémoïsation en masse sans tests.
- Il suppose un code qui respecte les **règles de React** (rendu pur, pas de mutation de props /
  état, pas de lecture de ref pendant le rendu). Les règles du linter `eslint-plugin-react-hooks`
  (`set-state-in-render`, `set-state-in-effect`, `refs`, `purity`, `immutability`…) le vérifient.
- Installation et config Vite : ne pas les modifier sans validation ; la procédure à jour est sur
  react.dev (`/learn/react-compiler/installation`), elle dépend des versions de Vite et du plugin.
- Vérification : badge « Memo ✨ » dans React DevTools, ou import de `react/compiler-runtime`
  dans le build.

---

## 11. Ce qui a disparu (ne plus écrire)

| Supprimé / déprécié | Remplacement |
|---|---|
| `ReactDOM.render`, `hydrate` | `createRoot`, `hydrateRoot` |
| `propTypes`, `defaultProps` sur fonctions | TypeScript + valeurs par défaut en déstructuration |
| `forwardRef` | `ref` en prop |
| `<Context.Provider>`, `<Context.Consumer>` | `<Context value>`, `use(Context)` |
| Refs chaînes (`ref="input"`) | `useRef` / callback ref |
| `react-test-renderer`, `act` de `react-dom/test-utils` | Testing Library ; `act` importé de `react` |
| `useFormState` (canary) | `useActionState` |
| Class components pour du code neuf | fonctions + hooks (Error Boundary : voir `state-and-data.md`) |
