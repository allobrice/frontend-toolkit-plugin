# Patterns GoF en programmation fonctionnelle

En TypeScript applicatif, **la plupart des patterns GoF se réduisent à une fonction, une closure ou
un objet littéral**. Les classes du livre de 1994 compensaient l'absence de fonctions de première
classe ; TypeScript les a. Ce fichier donne la forme fonctionnelle de chaque pattern — c'est la
forme par défaut, celle à essayer en premier.

> Pour les patterns qui impliquent la réactivité Vue (`ref`, `computed`, composables), voir
> `developing-vue`, référence `composable-patterns.md`. Ici : TS/JS pur, back Node compris.

---

## Strategy — algorithmes interchangeables

**Intention** — choisir un comportement à l'exécution sans que l'appelant connaisse les variantes.

**Forme fonctionnelle** — la stratégie *est* une fonction, passée en paramètre. Pas d'interface,
pas de classe.

```ts
type PricingStrategy = (basePrice: number, quantity: number) => number

const PRICING: Record<string, PricingStrategy> = {
  standard: (price, qty) => price * qty,
  degressive: (price, qty) => price * qty * (qty >= 10 ? 0.9 : 1),
  flat: (price) => price,
}

function computeTotal(strategyName: string, price: number, qty: number): number {
  const strategy = PRICING[strategyName] ?? PRICING.standard!
  return strategy(price, qty)
}
```

**Quand ça ne vaut pas le coup** — deux variantes stables : un ternaire est plus lisible qu'une map.

---

## Factory — créer sans connaître le concret

**Intention** — centraliser la décision « quel objet construire ».

**Forme fonctionnelle** — une table de correspondance, ou une fonction qui retourne le bon
constructeur. Le `satisfies` garde l'inférence des clés tout en validant la forme.

```ts
const HANDLERS = {
  bug: createBugTicket,
  story: createStoryTicket,
  task: createTaskTicket,
} satisfies Record<string, (input: TicketInput) => Ticket>

type TicketKind = keyof typeof HANDLERS

function createTicket(kind: TicketKind, input: TicketInput): Ticket {
  return HANDLERS[kind](input)
}
```

L'intérêt réel n'est pas la « création polymorphe » : c'est d'avoir **un seul endroit** à modifier
quand un type apparaît, au lieu de traquer six `switch`.

**Quand ça ne vaut pas le coup** — un seul type de produit, ou une construction sans branche.

---

## Adapter — traduire une frontière

**Intention** — empêcher un format externe de contaminer le domaine.

**Forme fonctionnelle** — une fonction de mapping pure, placée à la frontière (couche serveur,
client d'API). C'est le pattern le plus rentable de tous en développement applicatif.

```ts
export function toFinding(dto: ApiFinding): Finding {
  return {
    id: dto.finding_id,
    severity: SEVERITY_MAP[dto.level] ?? 'P3',
    summary: dto.short_description.trim(),
    detectedAt: new Date(dto.detected_at),
  }
}

export const toFindings = (dtos: readonly ApiFinding[]): Finding[] => dtos.map(toFinding)
```

**Le test qui prouve qu'il manque** : renommer un champ de l'API casse plus d'un fichier.

---

## Decorator — enrichir sans modifier

**Intention** — ajouter un comportement transverse (mesure, cache, réessai, journalisation) autour
d'une fonction existante.

**Forme fonctionnelle** — une fonction d'ordre supérieur qui prend une fonction et en retourne une
de même signature. Elles se composent.

```ts
function withRetry<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  attempts = 3,
) {
  return async (...args: TArgs): Promise<TResult> => {
    let lastError: unknown
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn(...args)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError
  }
}

function withTiming<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  label: string,
) {
  return async (...args: TArgs): Promise<TResult> => {
    const start = performance.now()
    try {
      return await fn(...args)
    } finally {
      console.warn(`${label}: ${Math.round(performance.now() - start)}ms`)
    }
  }
}

// La signature est préservée : l'appelant ne voit aucune différence.
const fetchPage = withTiming(withRetry(rawFetchPage), 'fetchPage')
```

**La règle d'or** — un décorateur qui change la signature n'est pas un décorateur, c'est une autre
fonction. Le point du pattern est la substituabilité.

**Quand ça ne vaut pas le coup** — un seul usage : mets le `try/catch` dans la fonction.

---

## Observer — notifier sans coupler

**Intention** — plusieurs parties réagissent à un événement sans que l'émetteur les connaisse.

**Forme fonctionnelle** — un émetteur typé au niveau module, dont l'abonnement **retourne sa propre
fonction de désabonnement**.

```ts
export interface AppEvents {
  'ticket:transitioned': { key: string; from: string; to: string }
  'audit:completed': { score: number }
}

type Listener<T> = (payload: T) => void

const listeners = new Map<keyof AppEvents, Set<Listener<never>>>()

export function on<K extends keyof AppEvents>(
  event: K,
  listener: Listener<AppEvents[K]>,
): () => void {
  const set = listeners.get(event) ?? new Set()
  set.add(listener as Listener<never>)
  listeners.set(event, set)
  return () => { set.delete(listener as Listener<never>) }
}

export function emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
  listeners.get(event)?.forEach((listener) => (listener as Listener<AppEvents[K]>)(payload))
}
```

**Deux pièges qui coûtent cher** :

1. **La collection doit être au niveau module.** Créée dans une fonction, chaque appelant obtient
   son propre émetteur isolé et n'entend jamais personne.
2. **Le désabonnement ne doit pas reposer sur la discipline.** Retourner la fonction de nettoyage
   est ce qui rend l'oubli difficile. Sur le serveur, attention aussi à l'état de module partagé
   entre les requêtes.

**Quand ça ne vaut pas le coup** — presque toujours, en fait. Un appel direct, un callback en
paramètre ou un store se tracent statiquement ; un bus d'événements, non. Le réserver aux signaux
réellement transverses (session expirée, notification globale).

---

## Command — encapsuler une action réversible

**Intention** — traiter une action comme une donnée : la stocker, la rejouer, l'annuler.

**Forme fonctionnelle** — un objet de deux closures, qui capturent l'état nécessaire.

```ts
interface Command {
  readonly label: string
  execute: () => void
  undo: () => void
}

function renameCommand(target: { name: string }, next: string): Command {
  const previous = target.name // capturé à la création
  return {
    label: `Renommer en « ${next} »`,
    execute: () => { target.name = next },
    undo: () => { target.name = previous },
  }
}
```

**Quand ça ne vaut pas le coup** — sans undo/redo, sans file d'attente et sans journal d'audit, une
fonction ordinaire suffit.

---

## State — comportement piloté par l'état

**Intention** — remplacer les branches sur des booléens par un état explicite.

**Forme fonctionnelle** — une union discriminée et une fonction de transition pure. Le compilateur
vérifie l'exhaustivité.

```ts
type TicketState =
  | { status: 'new' }
  | { status: 'analyzing'; assignee: string }
  | { status: 'review'; prUrl: string }
  | { status: 'done'; mergedAt: Date }

type TicketEvent =
  | { type: 'ASSIGN'; assignee: string }
  | { type: 'DELIVER'; prUrl: string }
  | { type: 'MERGE'; at: Date }

function transition(state: TicketState, event: TicketEvent): TicketState {
  switch (state.status) {
    case 'new':
      return event.type === 'ASSIGN'
        ? { status: 'analyzing', assignee: event.assignee }
        : state
    case 'analyzing':
      return event.type === 'DELIVER' ? { status: 'review', prUrl: event.prUrl } : state
    case 'review':
      return event.type === 'MERGE' ? { status: 'done', mergedAt: event.at } : state
    case 'done':
      return state
  }
}
```

Les transitions illégales sont **ignorées**, pas exceptionnelles : une machine à états robuste ne
plante pas sur un événement hors séquence. Et `assignee` ou `prUrl` n'existent que dans les états où
ils ont un sens — impossible de lire une URL de PR sur un ticket neuf.

---

## Chain of Responsibility — pipeline de traitement

**Intention** — faire passer une valeur dans une suite de traitements, avec sortie anticipée
possible.

**Forme fonctionnelle** — un `reduce` sur un tableau de fonctions, ou une boucle avec court-circuit.

```ts
type Validator<T> = (value: T) => string | null

const validate = <T>(value: T, ...validators: Validator<T>[]): string | null => {
  for (const check of validators) {
    const error = check(value)
    if (error) return error // court-circuit : la première erreur gagne
  }
  return null
}
```

Sans court-circuit, c'est une simple composition :

```ts
const pipe = <T>(...steps: ((value: T) => T)[]) =>
  (input: T): T => steps.reduce((acc, step) => step(acc), input)

const normalizeSlug = pipe<string>(
  (s) => s.trim(),
  (s) => s.toLowerCase(),
  (s) => s.replace(/\s+/g, '-'),
)
```

---

## Template Method — squelette avec trous

**Intention** — figer l'ordre des étapes, laisser varier leur contenu.

**Forme fonctionnelle** — une fonction qui prend les étapes variables en paramètre.

```ts
interface ImportSteps<TRaw, TDomain> {
  fetch: () => Promise<TRaw[]>
  map: (raw: TRaw) => TDomain
  persist: (items: TDomain[]) => Promise<void>
}

async function runImport<TRaw, TDomain>(steps: ImportSteps<TRaw, TDomain>): Promise<number> {
  const raw = await steps.fetch()
  const items = raw.map(steps.map)
  await steps.persist(items)
  return items.length
}
```

**Attention** — au-delà de trois ou quatre trous, ce n'est plus un squelette : c'est une fonction
ordinaire avec beaucoup de paramètres. Le pattern a disparu, le smell est apparu.

---

## Singleton — instance unique

**Forme fonctionnelle** — **un module ES en est déjà un.** L'IIFE avec `let instance` est du bruit
hérité de langages sans modules.

```ts
// config.ts — évalué une seule fois, partagé par tous les imports.
export const config = Object.freeze({
  apiUrl: process.env.API_URL ?? 'http://localhost:3000',
})
```

⚠️ **Côté serveur, un état mutable au niveau module est partagé entre les requêtes** — donc entre
utilisateurs. C'est une fuite de données, pas un pattern. Le singleton ne convient qu'aux valeurs
immuables et aux ressources réellement globales (pool de connexions).

---

## Memento — instantané d'état

**Forme fonctionnelle** — une pile de copies immuables.

```ts
function createHistory<T>(initial: T, limit = 20) {
  let snapshots: T[] = [structuredClone(initial)]
  let index = 0

  return {
    save(state: T) {
      snapshots = snapshots.slice(0, index + 1)
      snapshots.push(structuredClone(state))
      if (snapshots.length > limit) snapshots.shift()
      index = snapshots.length - 1
    },
    undo(): T | null {
      if (index === 0) return null
      index--
      return structuredClone(snapshots[index]!)
    },
  }
}
```

`structuredClone` gère `Date`, `Map`, `Set` et les cycles — contrairement à
`JSON.parse(JSON.stringify())`, qui les perd ou plante. Il échoue en revanche sur les fonctions et
les proxies : cloner la donnée brute, jamais un objet réactif.

---

## Patterns qui disparaissent en fonctionnel

| Pattern | Ce qui le remplace |
|---|---|
| **Abstract Factory** | un objet littéral de fabriques |
| **Builder** | un objet d'options typé avec champs optionnels |
| **Prototype** | `structuredClone` ou un spread |
| **Facade** | un module qui réexporte — c'est tout |
| **Proxy** | une closure qui mémoïse ou charge à la demande |
| **Iterator** | `for...of`, générateurs, `Symbol.asyncIterator` |
| **Mediator** | un store, ou une fonction qui orchestre |
| **Visitor** | un `switch` exhaustif sur une union discriminée |
| **Flyweight** | une `Map` de cache — et seulement si la mesure le justifie |
| **Bridge** | des génériques |

Si l'un d'eux te semble nécessaire, vérifie d'abord que le besoin n'est pas déjà couvert par la
colonne de droite. Le cas échéant, `patterns-oop.md` donne les critères qui justifient de repasser
à l'objet.
