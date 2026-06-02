---
name: developing-javascript
description: "Guide d'expertise JavaScript complet et à jour (ES2024/ES2025+) pour le développement fullstack (navigateur + Node.js). Utiliser ce skill dès que l'utilisateur pose une question sur JavaScript, demande une revue de code JS, veut comprendre un pattern JS, cherche à optimiser du code JS, ou a besoin de conseils sur les bonnes pratiques JavaScript. Couvre : clean code & conventions, patterns modernes, performance & optimisation, sécurité. Même si l'utilisateur ne mentionne pas explicitement 'bonnes pratiques', utiliser ce skill pour toute question JS afin de garantir des réponses alignées avec les standards modernes."
---

# JavaScript Expertise

Guide d'expertise JavaScript complet pour répondre aux questions, expliquer les concepts et guider les choix techniques en JavaScript moderne (ES2024/ES2025+), côté navigateur et Node.js.

## Principes fondamentaux

Toujours respecter ces principes dans les réponses et recommandations :

1. **Immutabilité par défaut** — Utiliser `const` systématiquement, `let` uniquement quand la réassignation est nécessaire. Ne jamais utiliser `var`.
2. **Fonctions pures en priorité** — Privilégier les fonctions sans effets de bord, qui retournent de nouvelles valeurs plutôt que de muter l'existant.
3. **Typage implicite fiable** — Éviter les comparaisons lâches (`==`), toujours utiliser `===`. Exploiter les opérateurs modernes (`?.`, `??`, `??=`).
4. **Gestion d'erreurs explicite** — Toujours gérer les cas d'erreur. Ne jamais avoir de `catch` vide. Utiliser des erreurs typées.
5. **Modularité** — Un fichier = une responsabilité. Utiliser les ES Modules (`import`/`export`).
6. **Lisibilité > Concision** — Le code est lu plus souvent qu'il n'est écrit. Privilégier la clarté.

## Patterns essentiels rapides

### Déclarations et portée

```javascript
// ✅ Toujours const par défaut
const users = [];
const config = Object.freeze({ api: 'https://api.example.com', timeout: 5000 });

// ✅ let uniquement pour les réassignations nécessaires
let currentIndex = 0;
currentIndex += 1;

// ❌ Jamais var — problèmes de hoisting et portée fonction
```

### Déstructuration et valeurs par défaut

```javascript
// ✅ Déstructuration avec valeurs par défaut et renommage
const { name: userName, age = 0, roles: userRoles = [] } = user;

// ✅ Paramètres de fonction avec déstructuration
function createUser({ name, email, role = 'user' } = {}) {
  return { id: crypto.randomUUID(), name, email, role, createdAt: new Date() };
}

// ✅ Déstructuration de tableaux
const [first, second, ...rest] = items;
const [, , third] = coordinates; // ignorer les premiers éléments
```

### Opérateurs modernes

```javascript
// Chaînage optionnel — accès sécurisé aux propriétés imbriquées
const city = user?.address?.city;
const firstRole = user?.roles?.[0];
const result = obj?.method?.();

// Coalescence nulle — valeur par défaut (hors false, 0, '')
const port = config.port ?? 3000;
const name = input ?? 'Anonyme';

// Affectation conditionnelle
options.timeout ??= 5000;    // assigne seulement si null/undefined
cache.data ||= fetchData();  // assigne si falsy
list.length &&= list.filter(Boolean).length; // assigne si truthy

// Opérateur de pipeline (proposition stage 2 — à surveiller)
// value |> fn1 |> fn2  — pas encore standard
```

### Gestion d'erreurs moderne

```javascript
// ✅ Erreurs typées avec cause
class ApiError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
  }
}

// ✅ Try/catch ciblé avec vérification du type
try {
  const data = await fetchUser(id);
} catch (error) {
  if (error instanceof ApiError && error.status === 404) {
    return null;
  }
  throw error; // re-throw les erreurs inattendues
}

// ✅ Promise avec gestion explicite
const result = await fetch(url)
  .then(res => {
    if (!res.ok) throw new ApiError('Request failed', { status: res.status });
    return res.json();
  });
```

### Itération moderne

```javascript
// ✅ Méthodes fonctionnelles pour les transformations
const activeNames = users
  .filter(user => user.active)
  .map(user => user.name);

// ✅ for...of pour les itérations avec effets de bord
for (const user of users) {
  await sendNotification(user);
}

// ✅ Object.entries / Object.fromEntries pour les objets
const uppercased = Object.fromEntries(
  Object.entries(config).map(([key, value]) => [key.toUpperCase(), value])
);

// ❌ Éviter for...in sur les tableaux (itère les propriétés énumérables)
// ❌ Éviter forEach quand map/filter/reduce suffisent
```

## Standards récents — ES2024 / ES2025+

### ES2024 — Fonctionnalités stabilisées

```javascript
// Object.groupBy — regroupement natif
const byStatus = Object.groupBy(tasks, task => task.status);
// { todo: [...], done: [...], inProgress: [...] }

const byRange = Map.groupBy(scores, score =>
  score >= 90 ? 'excellent' : score >= 70 ? 'good' : 'needs-work'
);

// Promise.withResolvers — extraction propre de resolve/reject
const { promise, resolve, reject } = Promise.withResolvers();
setTimeout(() => resolve('done'), 1000);

// String bien formée (Unicode)
const str = 'Hello\uD800World';
str.isWellFormed();   // false
str.toWellFormed();   // 'Hello�World'

// RegExp v flag — opérations sur les ensembles
const emoji = /[\p{Emoji}--\p{ASCII}]/v; // émojis non-ASCII
```

### ES2025 — Nouvelles fonctionnalités

```javascript
// Méthodes Set — opérations ensemblistes natives
const a = new Set([1, 2, 3, 4]);
const b = new Set([3, 4, 5, 6]);

a.union(b);              // Set {1, 2, 3, 4, 5, 6}
a.intersection(b);       // Set {3, 4}
a.difference(b);         // Set {1, 2}
a.symmetricDifference(b); // Set {1, 2, 5, 6}
a.isSubsetOf(b);         // false
a.isDisjointFrom(b);     // false

// Iterator Helpers — chaînage sur les itérateurs
const result = Iterator.from(map.values())
  .filter(v => v > 10)
  .map(v => v * 2)
  .take(5)
  .toArray();

// Promise.try — encapsulation sync/async uniforme
const result = await Promise.try(() => {
  if (cached) return cachedValue;      // synchrone
  return fetchFromServer();            // asynchrone
});

// Gestion explicite des ressources — using
{
  using file = openFile('data.txt');
  using connection = await connectDb();
  // ... utiliser les ressources
} // automatiquement libérées à la sortie du bloc

// Import Attributes (JSON modules)
import config from './config.json' with { type: 'json' };
```

## Arbre de décision rapide

### Choisir la bonne structure de données

```
Besoin d'ordre + index → Array
Besoin de clés uniques → Object ou Map
  → Clés toujours des strings ? → Object
  → Clés de types variés ou besoin de taille ? → Map
Besoin de valeurs uniques → Set
Besoin de clés sans empêcher le garbage collection → WeakMap / WeakSet
Besoin de données structurées et immutables → Object.freeze() ou structuredClone()
```

### Async : quelle approche ?

```
Opérations indépendantes → Promise.all() ou Promise.allSettled()
Première réponse suffit → Promise.race() ou Promise.any()
Opérations séquentielles → for...of + await
Flux continu de données → AsyncGenerator ou ReadableStream
Timeout nécessaire → AbortController + AbortSignal.timeout()
```

## Références détaillées

Pour approfondir chaque domaine, consulter les fichiers de référence :

- **Clean Code & Conventions** — Voir `references/clean-code.md` pour :
  - Conventions de nommage et style
  - Structure des modules et organisation du code
  - Documentation JSDoc
  - Patterns de conception recommandés

- **Patterns modernes** — Voir `references/modern-patterns.md` pour :
  - Async/await avancé (concurrence, annulation, streams)
  - Proxies et métaprogrammation
  - Itérateurs et générateurs
  - Closures et patterns fonctionnels avancés
  - Web APIs modernes

- **Performance & Optimisation** — Voir `references/performance.md` pour :
  - Optimisation mémoire et garbage collection
  - Optimisation du rendu navigateur
  - Node.js : event loop, streams, workers
  - Structures de données performantes
  - Techniques de mesure et profiling

- **Sécurité** — Voir `references/security.md` pour :
  - Prévention XSS et injection
  - Validation et sanitisation des entrées
  - Sécurité Node.js (dépendances, secrets, permissions)
  - Content Security Policy
  - Bonnes pratiques d'authentification côté client

## Rappels critiques

- **TOUJOURS** utiliser `===` et `!==` — jamais `==` ou `!=`
- **TOUJOURS** gérer les erreurs dans les Promises et async/await
- **TOUJOURS** valider les données externes (API, utilisateur, fichiers)
- **PRÉFÉRER** l'immutabilité — `const`, `Object.freeze()`, `structuredClone()`
- **PRÉFÉRER** les méthodes fonctionnelles (`map`, `filter`, `reduce`) aux boucles mutantes
- **ÉVITER** les effets de bord dans les fonctions — les isoler explicitement
- **ÉVITER** `eval()`, `new Function()`, `innerHTML` avec des données non contrôlées
- **UTILISER** les standards récents (ES2024+) plutôt que des polyfills ou des bibliothèques quand le support navigateur le permet
- **DOCUMENTER** les fonctions publiques avec JSDoc (`@param`, `@returns`, `@throws`, `@example`)
