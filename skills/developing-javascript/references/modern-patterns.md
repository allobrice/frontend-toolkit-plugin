# Patterns JavaScript Modernes

Guide des patterns avancés en JavaScript moderne (ES2024/ES2025+), couvrant l'asynchrone, la métaprogrammation, les itérateurs et les patterns fonctionnels.

## Table des matières

1. [Async/Await avancé](#asyncawait-avancé)
2. [Concurrence et annulation](#concurrence-et-annulation)
3. [Itérateurs et générateurs](#itérateurs-et-générateurs)
4. [Proxies et métaprogrammation](#proxies-et-métaprogrammation)
5. [Patterns fonctionnels](#patterns-fonctionnels)
6. [Web APIs modernes](#web-apis-modernes)
7. [Patterns Node.js modernes](#patterns-nodejs-modernes)

---

## Async/Await avancé

### Gestion fine de la concurrence

```javascript
// ✅ Promise.all — toutes doivent réussir (fail-fast)
const [users, posts, comments] = await Promise.all([
  fetchUsers(),
  fetchPosts(),
  fetchComments(),
]);

// ✅ Promise.allSettled — toutes s'exécutent, on gère chaque résultat
const results = await Promise.allSettled([
  fetchFromPrimary(),
  fetchFromBackup(),
  fetchFromCache(),
]);

const successful = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);

const failed = results
  .filter(r => r.status === 'rejected')
  .map(r => r.reason);

// ✅ Promise.any — première réussie (ignore les échecs)
const fastest = await Promise.any([
  fetchFromCDN1(resource),
  fetchFromCDN2(resource),
  fetchFromOrigin(resource),
]);

// ✅ Promise.race — première terminée (succès OU échec)
// Utile pour les timeouts
const result = await Promise.race([
  fetchData(),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), 5000)
  ),
]);
```

### Patterns de retry

```javascript
// ✅ Retry avec backoff exponentiel
async function withRetry(fn, { maxAttempts = 3, baseDelay = 1000, maxDelay = 30000 } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      const delay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      await new Promise(resolve => setTimeout(resolve, jitter));
    }
  }
}

// Utilisation
const data = await withRetry(() => fetch(url).then(r => r.json()), {
  maxAttempts: 5,
  baseDelay: 500,
});
```

### Async iterators

```javascript
// ✅ Consommation de flux paginés
async function* fetchAllPages(baseUrl) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${baseUrl}?page=${page}`);
    const data = await response.json();

    yield* data.items;

    hasMore = data.hasMore;
    page++;
  }
}

// Utilisation
for await (const item of fetchAllPages('/api/products')) {
  processItem(item);
}

// ✅ Transformation de flux async
async function* filterAsync(source, predicate) {
  for await (const item of source) {
    if (await predicate(item)) yield item;
  }
}

async function* mapAsync(source, transform) {
  for await (const item of source) {
    yield await transform(item);
  }
}
```

## Concurrence et annulation

### AbortController

```javascript
// ✅ Annulation de requêtes HTTP
const controller = new AbortController();

// Annuler après un timeout
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  return await response.json();
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Requête annulée');
    return null;
  }
  throw error;
}

// ✅ AbortSignal.timeout() — raccourci ES2024
const response = await fetch(url, {
  signal: AbortSignal.timeout(5000), // timeout intégré
});

// ✅ Combinaison de signaux (AbortSignal.any)
const userCancel = new AbortController();
const signal = AbortSignal.any([
  userCancel.signal,
  AbortSignal.timeout(30000),
]);

const response = await fetch(url, { signal });

// ✅ Annulation propagée dans les listeners d'événements
const controller = new AbortController();

element.addEventListener('click', handleClick, { signal: controller.signal });
element.addEventListener('mouseover', handleHover, { signal: controller.signal });

// Nettoyer tous les listeners d'un coup
controller.abort();
```

### Limitation de concurrence

```javascript
// ✅ Pool de concurrence — exécuter N tâches en parallèle max
async function pooled(tasks, concurrency = 5) {
  const results = [];
  const executing = new Set();

  for (const [index, task] of tasks.entries()) {
    const promise = task().then(result => {
      executing.delete(promise);
      return result;
    });

    results[index] = promise;
    executing.add(promise);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// Utilisation : télécharger 100 fichiers, 5 à la fois
const downloads = urls.map(url => () => fetch(url).then(r => r.blob()));
const blobs = await pooled(downloads, 5);
```

### Debounce et Throttle

```javascript
// ✅ Debounce — exécuter après un délai d'inactivité
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ✅ Debounce avec AbortController (annulable)
function debounceAsync(fn, delay) {
  let controller;
  return async function (...args) {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;

    await new Promise(resolve => setTimeout(resolve, delay));
    if (signal.aborted) return;

    return fn.apply(this, args);
  };
}

// ✅ Throttle — exécuter au plus une fois par intervalle
function throttle(fn, interval) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      return fn.apply(this, args);
    }
  };
}
```

## Itérateurs et générateurs

### Itérateurs personnalisés

```javascript
// ✅ Objet itérable personnalisé
class Range {
  constructor(start, end, step = 1) {
    this.start = start;
    this.end = end;
    this.step = step;
  }

  [Symbol.iterator]() {
    let current = this.start;
    const { end, step } = this;

    return {
      next() {
        if (current <= end) {
          const value = current;
          current += step;
          return { value, done: false };
        }
        return { done: true };
      },
    };
  }
}

// Utilisable avec for...of, spread, destructuration
for (const n of new Range(1, 10, 2)) console.log(n); // 1, 3, 5, 7, 9
const nums = [...new Range(1, 5)]; // [1, 2, 3, 4, 5]
```

### Générateurs

```javascript
// ✅ Générateur pour séquences infinies
function* fibonacci() {
  let a = 0, b = 1;
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// Avec les Iterator Helpers (ES2025)
const first10 = Iterator.from(fibonacci()).take(10).toArray();

// ✅ Générateur pour le parcours d'arbre
function* traverseTree(node) {
  yield node;
  for (const child of node.children ?? []) {
    yield* traverseTree(child);
  }
}

// ✅ Générateur comme machine à états
function* stateMachine() {
  let state = 'idle';

  while (true) {
    const event = yield state;

    switch (state) {
      case 'idle':
        if (event === 'START') state = 'running';
        break;
      case 'running':
        if (event === 'PAUSE') state = 'paused';
        if (event === 'STOP') state = 'idle';
        break;
      case 'paused':
        if (event === 'RESUME') state = 'running';
        if (event === 'STOP') state = 'idle';
        break;
    }
  }
}

const machine = stateMachine();
machine.next();           // { value: 'idle' }
machine.next('START');    // { value: 'running' }
machine.next('PAUSE');    // { value: 'paused' }
machine.next('RESUME');   // { value: 'running' }
```

## Proxies et métaprogrammation

### Proxy pour la validation

```javascript
// ✅ Validation automatique des propriétés
function createValidatedObject(schema) {
  return new Proxy({}, {
    set(target, prop, value) {
      const validator = schema[prop];
      if (validator && !validator(value)) {
        throw new TypeError(`Valeur invalide pour "${prop}": ${value}`);
      }
      target[prop] = value;
      return true;
    },
  });
}

const user = createValidatedObject({
  age: (v) => typeof v === 'number' && v >= 0 && v <= 150,
  email: (v) => typeof v === 'string' && v.includes('@'),
  name: (v) => typeof v === 'string' && v.length > 0,
});

user.name = 'Alice';    // OK
user.age = 30;          // OK
user.age = -5;          // TypeError: Valeur invalide pour "age": -5
```

### Proxy pour le logging / observation

```javascript
// ✅ Observer les accès aux propriétés
function createObservable(target, onChange) {
  return new Proxy(target, {
    set(obj, prop, value) {
      const oldValue = obj[prop];
      obj[prop] = value;
      if (oldValue !== value) {
        onChange({ prop, oldValue, newValue: value });
      }
      return true;
    },
    deleteProperty(obj, prop) {
      const oldValue = obj[prop];
      delete obj[prop];
      onChange({ prop, oldValue, newValue: undefined, deleted: true });
      return true;
    },
  });
}

const state = createObservable({ count: 0 }, (change) => {
  console.log(`${change.prop}: ${change.oldValue} → ${change.newValue}`);
});

state.count = 1; // "count: 0 → 1"
```

### Reflect API

```javascript
// ✅ Utiliser Reflect dans les handlers de Proxy
const handler = {
  get(target, prop, receiver) {
    console.log(`Accès à ${String(prop)}`);
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    console.log(`Modification de ${String(prop)}`);
    return Reflect.set(target, prop, value, receiver);
  },
  has(target, prop) {
    console.log(`Vérification de ${String(prop)}`);
    return Reflect.has(target, prop);
  },
};
```

## Patterns fonctionnels

### Composition de fonctions

```javascript
// ✅ Pipe — exécution de gauche à droite
const pipe = (...fns) => (value) => fns.reduce((acc, fn) => fn(acc), value);

const processUser = pipe(
  normalizeEmail,
  validateFields,
  hashPassword,
  saveToDatabase,
);

// ✅ Compose — exécution de droite à gauche
const compose = (...fns) => (value) => fns.reduceRight((acc, fn) => fn(acc), value);

// ✅ Currying
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn(...args);
    return (...moreArgs) => curried(...args, ...moreArgs);
  };
}

const add = curry((a, b) => a + b);
const add10 = add(10);
add10(5); // 15

// ✅ Partial application
function partial(fn, ...presetArgs) {
  return (...laterArgs) => fn(...presetArgs, ...laterArgs);
}

const fetchJSON = partial(fetch, { headers: { 'Content-Type': 'application/json' } });
```

### Memoization

```javascript
// ✅ Cache simple avec Map
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

// ✅ Cache avec TTL et taille maximale
function memoizeWithTTL(fn, { ttl = 60000, maxSize = 100 } = {}) {
  const cache = new Map();

  return function (...args) {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.time < ttl) {
      return cached.value;
    }

    const result = fn.apply(this, args);
    cache.set(key, { value: result, time: Date.now() });

    // Éviction LRU simplifiée
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  };
}
```

## Web APIs modernes

### Structured Clone

```javascript
// ✅ Copie profonde native (remplace JSON.parse(JSON.stringify()))
const original = { date: new Date(), nested: { map: new Map([['a', 1]]) } };
const clone = structuredClone(original);

// Clone profond, préserve les types Date, Map, Set, ArrayBuffer, etc.
clone.nested.map.set('b', 2);
console.log(original.nested.map.has('b')); // false — pas de mutation
```

### Temporal API (proposition avancée, à suivre)

En attendant la stabilisation de Temporal, utiliser les bonnes pratiques Date :

```javascript
// ✅ Manipulations de dates fiables
const now = Date.now(); // timestamp, pas new Date() pour les comparaisons
const iso = new Date().toISOString(); // format standardisé

// ✅ Formatter avec Intl
const formatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
});
formatter.format(new Date()); // "17 février 2026 à 14:30"

// ✅ Relative time formatting
const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
rtf.format(-1, 'day');   // "hier"
rtf.format(3, 'month');  // "dans 3 mois"
```

### Intl API complète

```javascript
// ✅ Formater des nombres / monnaies
new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
  .format(1234.56); // "1 234,56 €"

// ✅ Formater des listes
new Intl.ListFormat('fr-FR', { style: 'long', type: 'conjunction' })
  .format(['Alice', 'Bob', 'Charlie']); // "Alice, Bob et Charlie"

// ✅ Pluralisation
const pr = new Intl.PluralRules('fr-FR');
const suffixes = { one: 'élément', other: 'éléments' };
const count = 5;
`${count} ${suffixes[pr.select(count)]}`; // "5 éléments"

// ✅ Segmentation de texte (pour le NLP, la recherche, etc.)
const segmenter = new Intl.Segmenter('fr-FR', { granularity: 'word' });
const words = [...segmenter.segment('Bonjour le monde')]
  .filter(s => s.isWordLike)
  .map(s => s.segment); // ['Bonjour', 'le', 'monde']
```

## Patterns Node.js modernes

### Top-level await et modules ES

```javascript
// ✅ Top-level await dans les modules ES
// config.js
const response = await fetch(process.env.CONFIG_URL);
export const config = await response.json();

// ✅ Import dynamique conditionnel
const db = process.env.DB_TYPE === 'postgres'
  ? await import('./adapters/postgres.js')
  : await import('./adapters/sqlite.js');
```

### Node.js API avec préfixe node:

```javascript
// ✅ Toujours utiliser le préfixe node: (clarté, performance)
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

// ✅ Timer promises
await delay(1000); // sleep propre, pas de new Promise + setTimeout
```

### Streams modernes

```javascript
// ✅ Web Streams API (compatible navigateur + Node.js)
const readable = new ReadableStream({
  start(controller) {
    controller.enqueue('Hello');
    controller.enqueue(' World');
    controller.close();
  },
});

// ✅ Transform streams
const uppercase = new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(chunk.toUpperCase());
  },
});

const result = readable
  .pipeThrough(uppercase)
  .pipeThrough(new TextEncoderStream());
```
