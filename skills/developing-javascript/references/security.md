# Sécurité JavaScript

Guide complet des bonnes pratiques de sécurité en JavaScript, côté navigateur et Node.js.

## Table des matières

1. [Principes de sécurité](#principes-de-sécurité)
2. [Prévention XSS](#prévention-xss)
3. [Validation et sanitisation](#validation-et-sanitisation)
4. [Sécurité des APIs côté client](#sécurité-des-apis-côté-client)
5. [Sécurité Node.js](#sécurité-nodejs)
6. [Gestion des secrets et données sensibles](#gestion-des-secrets-et-données-sensibles)
7. [Content Security Policy](#content-security-policy)

---

## Principes de sécurité

### Règles fondamentales

1. **Ne jamais faire confiance aux entrées** — Toute donnée venant de l'extérieur (utilisateur, API, URL, fichier) est potentiellement malveillante.
2. **Défense en profondeur** — Valider côté client ET côté serveur. La validation côté client est une commodité, pas une protection.
3. **Principe du moindre privilège** — Donner le minimum d'accès nécessaire.
4. **Échouer de manière sûre** — En cas d'erreur, ne pas exposer d'informations sensibles.

## Prévention XSS

### Injection via innerHTML

```javascript
// ❌ DANGEREUX — injection XSS directe
element.innerHTML = userInput;
// Si userInput = '<img src=x onerror="stealCookies()">' → exécution de code

// ❌ DANGEREUX — même avec des templates
element.innerHTML = `<div class="user">${userName}</div>`;
// Si userName = '"><script>alert("xss")</script>' → XSS

// ✅ Utiliser textContent pour le texte pur
element.textContent = userInput; // aucune interprétation HTML

// ✅ Utiliser le DOM API pour la construction
const div = document.createElement('div');
div.className = 'user';
div.textContent = userName;
container.appendChild(div);

// ✅ Si HTML nécessaire — sanitiser avec DOMPurify ou Sanitizer API
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);

// ✅ Sanitizer API (standard émergent)
const sanitizer = new Sanitizer();
element.setHTML(userInput, { sanitizer });
```

### Injection dans les attributs

```javascript
// ❌ DANGEREUX — injection dans les attributs
element.setAttribute('href', userInput);
// Si userInput = 'javascript:alert("xss")' → exécution

// ✅ Valider les URLs
function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

if (isSafeUrl(userInput)) {
  element.setAttribute('href', userInput);
}

// ❌ DANGEREUX — construction dynamique de HTML avec des données utilisateur
const html = `<a href="${url}" title="${title}">${text}</a>`;

// ✅ Échapper les attributs HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

### Injection via eval et dérivés

```javascript
// ❌ JAMAIS utiliser avec des données non contrôlées
eval(userInput);
new Function(userInput)();
setTimeout(userInput, 1000);   // forme string
setInterval(userInput, 1000);  // forme string

// ✅ Alternatives
// Au lieu de eval pour parser du JSON :
const data = JSON.parse(jsonString);

// Au lieu de new Function pour le templating :
// Utiliser des template literals ou une bibliothèque de templating

// Au lieu de setTimeout avec string :
setTimeout(() => safeFunction(), 1000);
```

## Validation et sanitisation

### Validation des entrées

```javascript
// ✅ Validation de schéma avec Zod (ou similaire)
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase(),
  age: z.number().int().min(0).max(150),
  role: z.enum(['admin', 'user', 'guest']),
  website: z.string().url().optional(),
});

function createUser(input) {
  const validated = UserSchema.parse(input);
  // validated est garanti conforme au schéma
  return saveUser(validated);
}

// ✅ Validation manuelle structurée
function validateEmail(email) {
  if (typeof email !== 'string') return { valid: false, error: 'Email must be a string' };
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0) return { valid: false, error: 'Email is required' };
  if (trimmed.length > 254) return { valid: false, error: 'Email too long' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true, value: trimmed };
}
```

### Protection contre l'injection

```javascript
// ❌ DANGEREUX — concaténation SQL (même côté Node.js)
const query = `SELECT * FROM users WHERE id = '${userId}'`;
// Si userId = "'; DROP TABLE users; --" → injection SQL

// ✅ Requêtes paramétrées (avec n'importe quel driver SQL)
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// ❌ DANGEREUX — interpolation dans les commandes système
import { exec } from 'node:child_process';
exec(`ls ${userInput}`); // injection de commandes

// ✅ Utiliser execFile avec des arguments séparés
import { execFile } from 'node:child_process';
execFile('ls', [userInput]); // l'argument est échappé

// ✅ Encore mieux — éviter les commandes système
import { readdir } from 'node:fs/promises';
const files = await readdir(validatedPath);
```

### Sanitisation des sorties

```javascript
// ✅ Échapper selon le contexte de sortie
// HTML body → escapeHtml()
// HTML attribute → escapeAttr()
// URL → encodeURIComponent()
// CSS → CSS.escape()
// JavaScript string → JSON.stringify()

// ✅ Exemple complet de construction sûre d'URL
function buildSearchUrl(baseUrl, params) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value); // automatiquement encodé
  }
  return url.toString();
}

buildSearchUrl('https://api.example.com/search', {
  q: 'hello world & more',
  page: '1',
});
// "https://api.example.com/search?q=hello+world+%26+more&page=1"
```

## Sécurité des APIs côté client

### Gestion des tokens

```javascript
// ❌ Stocker le token dans localStorage (accessible via XSS)
localStorage.setItem('token', jwt);

// ✅ Préférer les cookies HttpOnly (inaccessibles via JavaScript)
// Côté serveur :
// Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict

// ✅ Si token en mémoire est nécessaire (SPA), le garder en variable
let accessToken = null;

function setToken(token) {
  accessToken = token;
}

function getAuthHeaders() {
  if (!accessToken) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${accessToken}` };
}

// ✅ Refresh token en cookie HttpOnly, access token en mémoire
// Le refresh token survit au rechargement, l'access token non
```

### Protection CSRF

```javascript
// ✅ Inclure un token CSRF dans les requêtes mutantes
async function secureFetch(url, options = {}) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'same-origin', // envoyer les cookies
  });
}

// ✅ Vérifier l'origine des messages postMessage
window.addEventListener('message', (event) => {
  // Toujours vérifier l'origine !
  if (event.origin !== 'https://trusted-domain.com') return;

  // Valider le format du message
  if (typeof event.data !== 'object' || !event.data.type) return;

  handleMessage(event.data);
});
```

### Fetch sécurisé

```javascript
// ✅ Wrapper fetch sécurisé avec timeout, validation, et gestion d'erreurs
async function apiFetch(endpoint, {
  method = 'GET',
  body,
  timeout = 10000,
  expectedStatus = [200, 201],
} = {}) {
  const url = new URL(endpoint, API_BASE_URL);

  // Validation de l'URL
  if (url.origin !== new URL(API_BASE_URL).origin) {
    throw new Error('URL origin mismatch — possible open redirect');
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
    credentials: 'same-origin',
  });

  if (!expectedStatus.includes(response.status)) {
    throw new ApiError(`Unexpected status ${response.status}`, {
      status: response.status,
    });
  }

  // Ne pas exposer les détails d'erreur serveur au client
  const data = await response.json();
  return data;
}
```

## Sécurité Node.js

### Gestion des dépendances

```bash
# ✅ Audit régulier des vulnérabilités
npm audit
npm audit fix

# ✅ Utiliser un lockfile et le vérifier
npm ci  # installation déterministe depuis le lockfile

# ✅ Mettre à jour régulièrement
npx npm-check-updates
```

```javascript
// ✅ Importer uniquement ce qui est nécessaire
import { readFile } from 'node:fs/promises'; // pas import fs from 'fs'

// ✅ Vérifier les permissions (Node.js 20+ Permission Model)
// node --experimental-permission --allow-fs-read=/data app.js
```

### Validation des chemins de fichiers

```javascript
import { resolve, join, relative } from 'node:path';

// ❌ DANGEREUX — path traversal
const filePath = `./uploads/${userInput}`;
// Si userInput = '../../etc/passwd' → accès non autorisé

// ✅ Valider et restreindre le chemin
function safeFilePath(basePath, userPath) {
  const resolved = resolve(basePath, userPath);
  const rel = relative(basePath, resolved);

  // Vérifier que le chemin résolu est bien sous basePath
  if (rel.startsWith('..') || resolve(resolved) !== resolved) {
    throw new Error('Path traversal detected');
  }

  return resolved;
}

const safePath = safeFilePath('/app/uploads', userInput);
```

### Rate limiting et protection DoS

```javascript
// ✅ Rate limiter simple en mémoire
class RateLimiter {
  #requests = new Map();
  #maxRequests;
  #windowMs;

  constructor({ maxRequests = 100, windowMs = 60000 } = {}) {
    this.#maxRequests = maxRequests;
    this.#windowMs = windowMs;
  }

  isAllowed(key) {
    const now = Date.now();
    const requests = this.#requests.get(key) ?? [];

    // Nettoyer les anciennes requêtes
    const recent = requests.filter(time => now - time < this.#windowMs);

    if (recent.length >= this.#maxRequests) {
      return false;
    }

    recent.push(now);
    this.#requests.set(key, recent);
    return true;
  }
}

// Utilisation dans un middleware Express
const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60000 });

app.use((req, res, next) => {
  const key = req.ip;
  if (!limiter.isAllowed(key)) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  next();
});
```

### Sécurisation des en-têtes HTTP

```javascript
// ✅ En-têtes de sécurité essentiels (Express avec Helmet)
import helmet from 'helmet';
app.use(helmet());

// ✅ Configuration manuelle si pas de Helmet
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // désactivé, CSP est préféré
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
```

## Gestion des secrets et données sensibles

### Ne jamais exposer de secrets

```javascript
// ❌ Secrets dans le code source
const API_KEY = 'sk-abc123secret';

// ❌ Secrets dans les variables d'environnement côté client
// REACT_APP_SECRET=xxx  → visible dans le bundle !
// VITE_SECRET=xxx       → visible dans le bundle !

// ✅ Secrets uniquement côté serveur via variables d'environnement
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error('API_KEY environment variable is required');

// ✅ Utiliser un .env avec .gitignore
// .env (non versionné)
// API_KEY=sk-abc123secret

// .gitignore
// .env
// .env.local
// .env.*.local
```

### Gestion sûre des mots de passe (Node.js)

```javascript
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// ✅ Hashage sécurisé
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

// ✅ Vérification en temps constant (protection timing attack)
async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const derivedKey = await scryptAsync(password, salt, 64);
  const storedKey = Buffer.from(hash, 'hex');
  return timingSafeEqual(derivedKey, storedKey);
}
```

### Logs et informations sensibles

```javascript
// ❌ Logger des données sensibles
console.log('User login:', { email, password }); // mot de passe en clair !
console.log('Request:', req.headers); // peut contenir des tokens

// ✅ Masquer les données sensibles
function sanitizeForLog(obj) {
  const sensitive = ['password', 'token', 'secret', 'authorization', 'cookie'];
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) =>
      sensitive.some(s => key.toLowerCase().includes(s))
        ? [key, '***REDACTED***']
        : [key, value]
    )
  );
}

console.log('User login:', sanitizeForLog({ email, password }));
// { email: 'user@example.com', password: '***REDACTED***' }
```

## Content Security Policy

### Configuration CSP

```javascript
// ✅ CSP stricte (recommandée)
// En en-tête HTTP :
// Content-Security-Policy:
//   default-src 'self';
//   script-src 'self' 'nonce-abc123';
//   style-src 'self' 'unsafe-inline';
//   img-src 'self' data: https:;
//   font-src 'self';
//   connect-src 'self' https://api.example.com;
//   frame-ancestors 'none';
//   base-uri 'self';
//   form-action 'self';

// ✅ Générer un nonce par requête
import { randomBytes } from 'node:crypto';

app.use((req, res, next) => {
  const nonce = randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'`
  );
  next();
});

// Dans le template HTML :
// <script nonce="${cspNonce}" src="/app.js"></script>
```

### Trusted Types (protection XSS au niveau navigateur)

```javascript
// ✅ Activer Trusted Types via CSP
// Content-Security-Policy: require-trusted-types-for 'script'

// ✅ Créer une politique Trusted Types
if (window.trustedTypes) {
  const policy = trustedTypes.createPolicy('default', {
    createHTML: (input) => DOMPurify.sanitize(input),
    createScriptURL: (input) => {
      const url = new URL(input, location.origin);
      if (url.origin !== location.origin) {
        throw new Error('Script URL must be same-origin');
      }
      return url.toString();
    },
  });
}
```
