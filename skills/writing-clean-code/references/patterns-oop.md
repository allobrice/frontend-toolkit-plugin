# Patterns GoF en objet — et quand l'objet est le bon outil

`patterns-functional.md` donne la forme par défaut. Ce fichier traite le cas inverse : **quand la
classe bat la fonction**, et à quoi ressemblent alors les patterns.

---

## Le critère de décision

Passer à l'objet quand **au moins deux** de ces conditions sont réunies :

1. **Il y a un état interne à protéger.** Des invariants doivent tenir entre les appels (un solde ne
   peut pas devenir négatif, une connexion ne peut pas être utilisée après fermeture). Une closure
   le fait aussi, mais la classe l'exprime plus lisiblement au-delà de deux ou trois champs.
2. **Plusieurs opérations partagent le même état.** Cinq fonctions qui prennent toutes le même
   contexte en premier paramètre décrivent un objet qui s'ignore.
3. **Il y a un cycle de vie.** Ouvrir/utiliser/fermer, avec des ressources à libérer —
   `[Symbol.dispose]()` en TS 5.2+.
4. **La substituabilité est le sujet.** On veut passer une implémentation parmi plusieurs à travers
   une frontière stable, et la liste des implémentations est destinée à grandir.
5. **L'écosystème l'impose.** Erreurs (`extends Error`), certains ORM, décorateurs, injection de
   dépendances côté Nest/Angular.

À l'inverse, **rester fonctionnel** quand : pas d'état, une seule opération, ou le seul intérêt de
la classe serait de regrouper des fonctions sans état — un module fait ça mieux.

> Le contre-exemple canonique : une classe sans état dont toutes les méthodes sont statiques. C'est
> un module avec des étapes en plus.

---

## Strategy

Justifié en objet quand chaque stratégie porte **sa propre configuration**.

```ts
interface ShippingStrategy {
  readonly label: string
  cost(weightKg: number): number
}

class FlatRateShipping implements ShippingStrategy {
  readonly label = 'Forfait'
  constructor(private readonly rate: number) {}
  cost() { return this.rate }
}

class WeightBasedShipping implements ShippingStrategy {
  readonly label = 'Au poids'
  constructor(
    private readonly perKg: number,
    private readonly minimum: number,
  ) {}
  cost(weightKg: number) { return Math.max(this.perKg * weightKg, this.minimum) }
}

class Checkout {
  constructor(private readonly shipping: ShippingStrategy) {}
  total(subtotal: number, weightKg: number) {
    return subtotal + this.shipping.cost(weightKg)
  }
}
```

Une fonction nue ne pourrait pas porter `label` à côté du calcul. C'est ce **regroupement
état + comportement** qui justifie l'objet — pas le polymorphisme en lui-même.

---

## Factory Method / Abstract Factory

Justifié quand la construction **valide des invariants** et doit pouvoir échouer proprement. Le
constructeur privé garantit qu'aucune instance invalide n'existe.

```ts
class Slug {
  private constructor(readonly value: string) {}

  static create(raw: string): Slug | null {
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, '-')
    return /^[a-z0-9-]+$/.test(normalized) ? new Slug(normalized) : null
  }
}

// Impossible de fabriquer un Slug invalide : `new Slug(...)` est inaccessible.
```

C'est le pattern le plus utile de la famille : il déplace la validation **du site d'appel vers le
type**. Une fois qu'on tient un `Slug`, on sait qu'il est valide, partout, sans revérifier.

---

## Adapter

Justifié quand la cible est une **interface avec plusieurs méthodes**, pas une seule transformation.

```ts
interface KeyValueStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  clear(): Promise<void>
}

class RedisStore implements KeyValueStore {
  constructor(private readonly client: RedisClient) {}
  async get(key: string) { return this.client.get(key) }
  async set(key: string, value: string, ttlSeconds: number) {
    await this.client.setex(key, ttlSeconds, value)
  }
  async clear() { await this.client.flushdb() }
}
```

Pour une seule transformation (DTO → domaine), rester sur une fonction : voir
`patterns-functional.md`.

---

## Decorator

Justifié quand on enveloppe **une interface entière** en préservant son contrat, et que les couches
s'empilent.

```ts
class LoggingStore implements KeyValueStore {
  constructor(
    private readonly inner: KeyValueStore,
    private readonly log: (message: string) => void,
  ) {}

  async get(key: string) {
    const hit = await this.inner.get(key)
    this.log(`cache ${hit ? 'HIT' : 'MISS'} ${key}`)
    return hit
  }
  async set(key: string, value: string, ttl: number) { return this.inner.set(key, value, ttl) }
  async clear() { return this.inner.clear() }
}

const store = new LoggingStore(new RedisStore(client), console.warn)
```

**Le coût** — chaque méthode non décorée doit être réécrite pour déléguer. Au-delà de cinq ou six
méthodes, la délégation devient du bruit : préférer alors un décorateur par fonction.

---

## Observer

Justifié quand l'émetteur porte un état que les abonnés interrogent.

```ts
type Listener<T> = (value: T) => void

class Observable<T> {
  private readonly listeners = new Set<Listener<T>>()

  constructor(private current: T) {}

  get value(): T { return this.current }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener)
    listener(this.current) // émission immédiate de l'état courant
    return () => { this.listeners.delete(listener) }
  }

  next(value: T): void {
    this.current = value
    this.listeners.forEach((listener) => listener(value))
  }
}
```

L'abonnement retourne le désabonnement — même règle qu'en fonctionnel, et pour la même raison :
un abonné qui survit à son propriétaire est une fuite mémoire.

---

## State

Justifié quand chaque état porte **beaucoup de comportement**. Sinon, l'union discriminée de
`patterns-functional.md` est plus légère et donne l'exhaustivité gratuitement.

```ts
interface ConnectionState {
  readonly name: string
  send(payload: string): void
  onOpen?(): ConnectionState
}

class Disconnected implements ConnectionState {
  readonly name = 'disconnected'
  send() { throw new Error('Connexion fermée') }
  onOpen() { return new Connected() }
}

class Connected implements ConnectionState {
  readonly name = 'connected'
  send(payload: string) { socket.send(payload) }
}
```

Le gain : plus aucun `if (state === 'connected')` chez l'appelant. L'état *est* le comportement.

---

## Composite

Le seul pattern que l'objet exprime nettement mieux que le fonctionnel, parce que la récursion
uniforme (feuille et nœud partagent l'interface) est son sujet même.

```ts
interface SizedNode {
  size(): number
}

class FileNode implements SizedNode {
  constructor(private readonly bytes: number) {}
  size() { return this.bytes }
}

class DirectoryNode implements SizedNode {
  constructor(private readonly children: readonly SizedNode[]) {}
  size() { return this.children.reduce((total, child) => total + child.size(), 0) }
}
```

L'appelant traite un fichier et une arborescence exactement pareil. Utile pour les menus, les
arbres de catégories, les structures de documents.

---

## Template Method

Justifié quand la classe de base porte de l'état partagé entre les étapes.

```ts
abstract class Importer<TRaw, TDomain> {
  protected imported = 0

  async run(): Promise<number> {
    const raw = await this.fetch()
    const items = raw.map((item) => this.map(item))
    await this.persist(items)
    this.imported += items.length
    return this.imported
  }

  protected abstract fetch(): Promise<TRaw[]>
  protected abstract map(raw: TRaw): TDomain
  protected abstract persist(items: TDomain[]): Promise<void>
}
```

⚠️ **C'est de l'héritage** — le couplage le plus fort du langage. Une modification de `run()` affecte
toutes les sous-classes, et la LSP est facile à violer. Préférer la version fonctionnelle
(étapes injectées) dès que l'état partagé n'est pas indispensable.

---

## Command

Justifié quand les commandes portent des métadonnées et forment un journal.

```ts
abstract class Command {
  abstract readonly label: string
  readonly issuedAt = new Date()
  abstract execute(): void
  abstract undo(): void
}
```

En pratique, la paire de closures fonctionnelle couvre le besoin dans la quasi-totalité des cas.

---

## Récapitulatif

| Pattern | En objet si… | Sinon |
|---|---|---|
| Strategy | la stratégie porte config ou métadonnées | fonction en paramètre |
| Factory | la construction valide des invariants | map `clé → fabrique` |
| Adapter | la cible est une interface multi-méthodes | fonction de mapping |
| Decorator | on enveloppe une interface entière, en couches | fonction d'ordre supérieur |
| Observer | l'émetteur porte un état interrogeable | émetteur de module |
| State | chaque état porte beaucoup de comportement | union discriminée |
| **Composite** | **toujours** — la récursion uniforme est son sujet | — |
| Template Method | de l'état est partagé entre les étapes | étapes injectées |
| Command | journal, métadonnées, file d'attente | paire de closures |
| Singleton | **jamais** | un module ES |

**Le vrai risque, en objet, n'est pas le pattern : c'est l'héritage.** Préférer la composition
partout où c'est possible ; réserver `extends` aux hiérarchies réelles et stables — et aux erreurs
personnalisées, où le langage l'exige.
