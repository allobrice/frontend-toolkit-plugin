# Référence — Architecture & Patterns

## Structure du projet

### Organisation du code
- [ ] Séparation claire des responsabilités (présentation / logique métier / accès données)
- [ ] Pas de logique métier dans les contrôleurs/routes (thin controllers)
- [ ] Pas d'accès direct à la DB depuis les composants UI ou les routes HTTP
- [ ] Les dépendances sont injectées, pas instanciées directement (testabilité)
- [ ] Les modules/domaines sont faiblement couplés (changement isolé sans effet de bord)

### 12-Factor App
- [ ] **I. Codebase** : un repo, plusieurs déploiements
- [ ] **III. Config** : config via variables d'env, pas dans le code
- [ ] **IV. Backing services** : DB, cache, queue traités comme des ressources attachables
- [ ] **VI. Processes** : processus stateless (pas de session en mémoire locale)
- [ ] **VII. Port binding** : l'app s'expose elle-même via un port, pas via un serveur app externe
- [ ] **IX. Disposability** : démarrage rapide (<10s idéalement), arrêt graceful
- [ ] **XI. Logs** : traités comme des streams vers stdout (pas écrits dans des fichiers)

### API Design (si applicable)
- [ ] Les endpoints suivent une convention cohérente (RESTful, ou GraphQL, pas les deux en mélange)
- [ ] Versioning de l'API (`/api/v1/`) si API publique ou consommée par des tiers
- [ ] Pagination implémentée sur les listes (pas de `GET /users` qui renvoie 10 000 enregistrements)
- [ ] Les codes HTTP sont sémantiquement corrects (201 pour création, 404 pour not found, etc.)
- [ ] Un contrat API est documenté (OpenAPI/Swagger, ou au minimum des types TypeScript exportés)

---

## Patterns & Anti-patterns

### Patterns recommandés à vérifier
- [ ] **Repository pattern** : abstraction de l'accès aux données
- [ ] **Service layer** : logique métier centralisée
- [ ] **DTO/Schema validation** : validation des inputs à l'entrée (Zod, Joi, Yup, class-validator)
- [ ] **Error handling centralisé** : un seul handler d'erreur global, pas de try/catch partout
- [ ] **Circuit breaker** : sur les appels à des services externes (si applicable)

### Anti-patterns à détecter
- [ ] **God Object** : une classe/module qui fait tout
- [ ] **Magic strings/numbers** : valeurs hardcodées sans constante nommée
- [ ] **Callback hell** : code async non-structuré (vs async/await)
- [ ] **N+1 queries** : requêtes DB dans des boucles
- [ ] **Sync over async** : opérations bloquantes dans un runtime async (Node.js)
- [ ] **Couplage fort sur l'implémentation** : imports directs de classes concrètes

---

## Spécifique Nuxt 3 / Vue

### Architecture Nuxt
- [ ] Séparation claire entre `server/api/` (SSR/API) et `pages/` (UI)
- [ ] Les composables dans `composables/` encapsulent la logique réutilisable
- [ ] Les `server/utils/` contiennent la logique serveur partagée
- [ ] `useAsyncData` / `useFetch` utilisés correctement (pas de fetch dans `mounted`)
- [ ] Pas de code serveur importé côté client (risque d'exposition de secrets)
- [ ] Les plugins sont dans `plugins/` avec convention de nommage `.client.ts` / `.server.ts`

```ts
// ✅ Bon : séparation client/serveur Nuxt
// server/api/users.get.ts  → endpoint SSR
// composables/useUsers.ts  → logique côté client
// components/UserList.vue  → présentation uniquement
```

### State Management (Pinia)
- [ ] Un store par domaine métier (pas un store global fourre-tout)
- [ ] Les stores n'appellent pas directement la DB (passent par l'API Nuxt)
- [ ] `defineStore` avec option setup (Composition API) pour les nouveaux stores
- [ ] Pas de logique de fetching dans les composants (dans les composables ou stores)

---

## Sévérités types

| Finding | Sévérité par défaut |
|---|---|
| Logique métier dans les controllers/routes | 🟠 P1 |
| Accès DB direct dans les composants Vue | 🔴 P0 |
| Pas de validation des inputs | 🟠 P1 |
| Requêtes N+1 identifiées | 🟠 P1 |
| Sessions stockées en mémoire process | 🟠 P1 |
| Code serveur importé côté client (Nuxt) | 🔴 P0 |
| Pas de versioning API (API publique) | 🟡 P2 |
| God module / fichier >500 lignes sans découpage | 🟡 P2 |
| Magic strings/numbers | 🟢 P3 |
