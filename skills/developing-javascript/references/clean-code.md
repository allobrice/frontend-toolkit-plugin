# Clean Code & Conventions JavaScript

Guide complet des conventions et bonnes pratiques de code propre en JavaScript moderne.

## Table des matières

1. [Conventions de nommage](#conventions-de-nommage)
2. [Structure des fonctions](#structure-des-fonctions)
3. [Organisation des modules](#organisation-des-modules)
4. [Documentation JSDoc](#documentation-jsdoc)
5. [Patterns de conception](#patterns-de-conception)
6. [Anti-patterns à éviter](#anti-patterns-à-éviter)

---

## Conventions de nommage

### Règles générales

```javascript
// Variables et fonctions — camelCase
const userName = 'Alice';
function getUserById(id) { /* ... */ }

// Constantes globales / configuration — SCREAMING_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_TIMEOUT_MS = 5000;

// Classes et constructeurs — PascalCase
class UserService { /* ... */ }
class HttpError extends Error { /* ... */ }

// Fichiers de modules — kebab-case
// user-service.js, api-client.js, date-utils.js

// Booléens — préfixés par is, has, can, should
const isActive = true;
const hasPermission = user.roles.includes('admin');
const canEdit = isActive && hasPermission;
const shouldRetry = attempts < MAX_RETRY_COUNT;

// Fonctions de callback / handler — préfixées par on ou handle
function onUserClick(event) { /* ... */ }
function handleFormSubmit(data) { /* ... */ }

// Fonctions retournant un booléen — préfixées par is, has, can, check
function isValidEmail(email) { /* ... */ }
function hasExpired(token) { /* ... */ }
function canAccessResource(user, resource) { /* ... */ }
```

### Noms expressifs

```javascript
// ❌ Noms vagues ou abréviations obscures
const d = new Date();
const u = getUser();
const tmp = calculate();
const arr = getItems();
const cb = () => {};

// ✅ Noms descriptifs et intentionnels
const createdAt = new Date();
const currentUser = getUser();
const totalPrice = calculateOrderTotal();
const activeProducts = getActiveProducts();
const onItemSelected = (item) => {};

// ❌ Négations dans les noms (charge cognitive)
const isNotEmpty = list.length > 0;
if (!isNotEmpty) { /* confusion */ }

// ✅ Formulation positive
const isEmpty = list.length === 0;
if (isEmpty) { /* clair */ }

// ❌ Noms génériques pour les paramètres de callback
items.map(x => x.name);
items.filter(e => e.active);

// ✅ Noms qui reflètent le domaine
items.map(item => item.name);
users.filter(user => user.active);
orders.reduce((total, order) => total + order.amount, 0);
```

## Structure des fonctions

### Principes

```javascript
// ✅ Fonctions courtes — une seule responsabilité
function formatUserName(user) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function isEligibleForDiscount(user) {
  return user.memberSince < Date.now() - 365 * 24 * 3600 * 1000
    && user.totalPurchases > 100;
}

// ✅ Paramètres limités (3 max) — utiliser un objet au-delà
// ❌ Trop de paramètres
function createUser(name, email, age, role, department, manager) { /* ... */ }

// ✅ Objet de configuration
function createUser({ name, email, age, role = 'user', department, manager = null }) {
  // ...
}

// ✅ Return early — éviter l'imbrication excessive
function processPayment(order) {
  if (!order) throw new Error('Order is required');
  if (order.status !== 'pending') return { success: false, reason: 'Not pending' };
  if (order.total <= 0) return { success: false, reason: 'Invalid total' };

  // Logique principale sans nesting
  const payment = chargeCard(order);
  return { success: true, payment };
}

// ❌ Pyramide of doom
function processPayment(order) {
  if (order) {
    if (order.status === 'pending') {
      if (order.total > 0) {
        const payment = chargeCard(order);
        return { success: true, payment };
      }
    }
  }
}
```

### Arrow functions vs function declarations

```javascript
// ✅ Function declarations pour les fonctions nommées et hoistées
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ Arrow functions pour les callbacks et fonctions courtes
const doubled = numbers.map(n => n * 2);
const isAdult = (age) => age >= 18;

// ✅ Arrow functions quand on veut capturer le this du contexte
class Timer {
  start() {
    this.interval = setInterval(() => {
      this.tick(); // `this` est bien le Timer
    }, 1000);
  }
}

// ❌ Arrow functions pour les méthodes d'objet (pas de this propre)
const obj = {
  value: 42,
  getValue: () => this.value, // ❌ this n'est PAS obj
};

// ✅ Syntaxe courte pour les méthodes
const obj = {
  value: 42,
  getValue() { return this.value; }, // ✅
};
```

## Organisation des modules

### Structure d'un module

```javascript
// ✅ Ordre des imports recommandé
// 1. Modules natifs / Node.js
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// 2. Dépendances externes
import express from 'express';
import { z } from 'zod';

// 3. Modules internes (absolus)
import { UserService } from '@/services/user-service.js';
import { logger } from '@/utils/logger.js';

// 4. Modules relatifs
import { validateInput } from './validators.js';
import { formatDate } from '../utils/date.js';

// --- Corps du module ---

// Constantes
const DEFAULT_PAGE_SIZE = 20;

// Fonctions privées (non exportées)
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// Fonctions / classes exportées
export function createUser(data) {
  // ...
}

// Export par défaut (un seul par fichier, si pertinent)
export default class UserController {
  // ...
}
```

### Patterns d'export

```javascript
// ✅ Exports nommés — préférés (auto-complétion, refactoring)
export function getUser(id) { /* ... */ }
export function listUsers(options) { /* ... */ }
export const USER_ROLES = ['admin', 'user', 'guest'];

// ✅ Export par défaut — pour la classe/fonction principale du module
export default class UserService { /* ... */ }

// ✅ Barrel exports pour les API publiques (index.js)
// services/index.js
export { UserService } from './user-service.js';
export { AuthService } from './auth-service.js';
export { OrderService } from './order-service.js';

// ❌ Éviter les re-exports wildcard
export * from './user-service.js'; // Difficile à suivre, conflits possibles
```

### Un fichier = une responsabilité

```javascript
// ❌ Fichier fourre-tout
// utils.js — contient formatDate, validateEmail, parseCSV, generateId...

// ✅ Fichiers spécialisés
// utils/date.js
export function formatDate(date, locale = 'fr-FR') { /* ... */ }
export function isExpired(date) { /* ... */ }

// utils/validation.js
export function isValidEmail(email) { /* ... */ }
export function isStrongPassword(password) { /* ... */ }

// utils/id.js
export function generateId() { return crypto.randomUUID(); }
```

## Documentation JSDoc

### Fonctions

```javascript
/**
 * Recherche un utilisateur par son identifiant.
 *
 * @param {string} id - Identifiant unique de l'utilisateur (UUID v4).
 * @param {Object} [options] - Options de recherche.
 * @param {boolean} [options.includeInactive=false] - Inclure les utilisateurs désactivés.
 * @param {string[]} [options.fields] - Champs à retourner (tous par défaut).
 * @returns {Promise<User|null>} L'utilisateur trouvé ou null.
 * @throws {ValidationError} Si l'identifiant n'est pas un UUID valide.
 *
 * @example
 * const user = await findUserById('550e8400-e29b-41d4-a716-446655440000');
 * const admin = await findUserById(id, { includeInactive: true });
 */
async function findUserById(id, options = {}) {
  // ...
}
```

### Types et interfaces

```javascript
/**
 * @typedef {Object} User
 * @property {string} id - Identifiant unique (UUID v4).
 * @property {string} name - Nom complet de l'utilisateur.
 * @property {string} email - Adresse email.
 * @property {'admin'|'user'|'guest'} role - Rôle de l'utilisateur.
 * @property {Date} createdAt - Date de création.
 * @property {Date|null} lastLoginAt - Dernière connexion.
 */

/**
 * @typedef {Object} PaginatedResult
 * @template T
 * @property {T[]} items - Éléments de la page courante.
 * @property {number} total - Nombre total d'éléments.
 * @property {number} page - Numéro de page courante.
 * @property {number} pageSize - Taille de la page.
 * @property {boolean} hasMore - S'il reste des pages.
 */
```

## Patterns de conception

### Module Pattern (avec closures)

```javascript
// ✅ Encapsulation via closure
function createCounter(initial = 0) {
  let count = initial;

  return {
    increment() { return ++count; },
    decrement() { return --count; },
    getCount() { return count; },
    reset() { count = initial; },
  };
}

const counter = createCounter(10);
counter.increment(); // 11
// count n'est pas accessible directement
```

### Builder Pattern

```javascript
// ✅ Construction fluide d'objets complexes
class QueryBuilder {
  #table;
  #conditions = [];
  #orderBy = null;
  #limit = null;

  from(table) { this.#table = table; return this; }
  where(condition) { this.#conditions.push(condition); return this; }
  orderBy(field, direction = 'ASC') { this.#orderBy = { field, direction }; return this; }
  limit(n) { this.#limit = n; return this; }

  build() {
    let query = `SELECT * FROM ${this.#table}`;
    if (this.#conditions.length) query += ` WHERE ${this.#conditions.join(' AND ')}`;
    if (this.#orderBy) query += ` ORDER BY ${this.#orderBy.field} ${this.#orderBy.direction}`;
    if (this.#limit) query += ` LIMIT ${this.#limit}`;
    return query;
  }
}

const query = new QueryBuilder()
  .from('users')
  .where('active = true')
  .orderBy('created_at', 'DESC')
  .limit(10)
  .build();
```

### Observer Pattern

```javascript
// ✅ Système d'événements léger
class EventEmitter {
  #listeners = new Map();

  on(event, callback) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(callback);
    return () => this.off(event, callback); // retourne la fonction de nettoyage
  }

  off(event, callback) {
    this.#listeners.get(event)?.delete(callback);
  }

  emit(event, ...args) {
    for (const callback of this.#listeners.get(event) ?? []) {
      callback(...args);
    }
  }
}
```

## Anti-patterns à éviter

### Mutations silencieuses

```javascript
// ❌ Mutation du paramètre d'entrée
function addAdmin(users) {
  users.push({ name: 'Admin', role: 'admin' }); // mute le tableau original !
  return users;
}

// ✅ Retourner une nouvelle valeur
function addAdmin(users) {
  return [...users, { name: 'Admin', role: 'admin' }];
}
```

### Conditions imbriquées excessives

```javascript
// ❌ Arrow hell / callback hell modernisé
const result = data
  ? data.users
    ? data.users.length > 0
      ? data.users[0].name
        ? data.users[0].name.toUpperCase()
        : 'NO NAME'
      : 'EMPTY'
    : 'NO USERS'
  : 'NO DATA';

// ✅ Chaînage optionnel + valeur par défaut
const result = data?.users?.[0]?.name?.toUpperCase() ?? 'NO DATA';
```

### Abus de ternaires

```javascript
// ❌ Ternaires imbriqués illisibles
const label = age < 13 ? 'enfant' : age < 18 ? 'adolescent' : age < 65 ? 'adulte' : 'senior';

// ✅ Fonction ou map explicite
function getAgeLabel(age) {
  if (age < 13) return 'enfant';
  if (age < 18) return 'adolescent';
  if (age < 65) return 'adulte';
  return 'senior';
}
```

### Magic numbers et strings

```javascript
// ❌ Valeurs magiques
if (user.role === 3) { /* ... */ }
setTimeout(fn, 86400000);

// ✅ Constantes nommées
const ROLE_ADMIN = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

if (user.role === ROLE_ADMIN) { /* ... */ }
setTimeout(fn, ONE_DAY_MS);
```

### Catch silencieux

```javascript
// ❌ Erreur avalée silencieusement
try {
  await saveData(data);
} catch (e) {
  // rien...
}

// ✅ Au minimum, logger l'erreur
try {
  await saveData(data);
} catch (error) {
  logger.error('Failed to save data', { error, data });
  // décider : re-throw, valeur par défaut, notification...
}
```
