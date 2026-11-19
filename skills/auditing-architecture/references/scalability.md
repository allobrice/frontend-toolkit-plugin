# Référence — Scalabilité & Résilience

## Scalabilité horizontale

### Statelessness
- [ ] L'application est stateless : aucune donnée de session stockée en mémoire du process
- [ ] Les sessions sont stockées dans un backing service partagé (Redis, DB)
- [ ] Les fichiers uploadés sont stockés dans un storage externe (S3, GCS, etc.), pas le filesystem local
- [ ] Plusieurs instances peuvent tourner en parallèle sans conflit
- [ ] Pas de cron jobs internes qui tourneraient en doublon sur plusieurs instances
  (utiliser un scheduler distribué ou un seul worker dédié)

### Cache
- [ ] Un cache est utilisé pour les données coûteuses (Redis, Memcached, cache HTTP)
- [ ] Le cache a une stratégie d'invalidation définie (TTL, invalidation event-driven)
- [ ] Les headers de cache HTTP sont corrects pour les assets statiques (`Cache-Control`)
- [ ] Le cache n'est pas utilisé comme source de vérité (fallback DB si miss)

### Base de données
- [ ] Un pool de connexions est configuré (évite l'ouverture d'une connexion par requête)
- [ ] La taille du pool est adaptée au nombre d'instances prévues et aux limites DB
- [ ] Les requêtes fréquentes ont des index appropriés
- [ ] Les migrations DB sont backward-compatible (zero-downtime deployment possible)

```ts
// ✅ Bon : pool de connexions Prisma/Node
const db = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL }
  },
  log: ['error'],
  // Prisma gère le pool automatiquement, configurer via URL:
  // ?connection_limit=10&pool_timeout=10
})
```

---

## Résilience

### Health checks
- [ ] Un endpoint `/health` (ou `/healthz`) est exposé et répond 200 si l'app est prête
- [ ] Le health check vérifie les dépendances critiques (DB, cache) sans être trop lourd
- [ ] Un endpoint `/ready` séparé de `/live` si Kubernetes (liveness vs readiness)

```ts
// ✅ Bon : health check Node.js/Nitro
export default defineEventHandler(async () => {
  const dbOk = await checkDb()
  if (!dbOk) throw createError({ statusCode: 503, message: 'DB unavailable' })
  return { status: 'ok', timestamp: new Date().toISOString() }
})
```

### Graceful shutdown
- [ ] L'app écoute `SIGTERM` et `SIGINT`
- [ ] Sur shutdown : arrêt du serveur HTTP (plus de nouvelles requêtes), fin des requêtes en cours,
  fermeture des connexions DB/Redis, puis `process.exit(0)`
- [ ] Timeout de shutdown défini (ex: 30s max avant force kill)

### Timeouts & Circuit breakers
- [ ] Tous les appels à des services externes ont un timeout défini
- [ ] Les erreurs de services externes sont isolées (une panne tiers ne fait pas tomber l'app entière)
- [ ] Retry avec backoff exponentiel sur les opérations idempotentes

### Logging & Observabilité
- [ ] Logs structurés en JSON avec niveaux (`error`, `warn`, `info`, `debug`)
- [ ] Chaque log inclut : timestamp, niveau, message, contexte (requestId, userId si dispo)
- [ ] Les erreurs incluent le stack trace
- [ ] Un système de centralisation des logs est en place (ou prévu) : ELK, Loki, Datadog, etc.
- [ ] Des métriques applicatives sont exposées (Prometheus `/metrics`, ou APM)
- [ ] Des alertes sont configurées sur les erreurs critiques

---

## Spécifique Nuxt / Node.js

- [ ] Le rendu SSR utilise un cache HTTP (Varnish, Nginx, ou `s-maxage` sur les routes Nuxt)
- [ ] Les routes Nuxt SSR coûteuses utilisent `useAsyncData` avec `getCachedData` ou un cache Nitro
- [ ] Le serveur Nitro est configuré avec `compression: true` pour la prod
- [ ] Les assets statiques (`.output/public`) sont servis par un CDN ou Nginx, pas Node

```ts
// ✅ Nuxt 3 : cache de route Nitro
export default defineNuxtConfig({
  nitro: {
    routeRules: {
      '/api/products/**': { cache: { maxAge: 60 } },
      '/_nuxt/**': { headers: { 'cache-control': 'max-age=31536000,immutable' } }
    }
  }
})
```

---

## Sévérités types

| Finding | Sévérité par défaut |
|---|---|
| Sessions en mémoire process (app multi-instance) | 🔴 P0 |
| Fichiers uploadés sur filesystem local | 🟠 P1 |
| Pas de pool de connexions DB | 🟠 P1 |
| Pas d'endpoint /health | 🟠 P1 |
| Pas de graceful shutdown | 🟠 P1 |
| Appels externes sans timeout | 🟠 P1 |
| Pas de logs structurés | 🟡 P2 |
| Assets statiques servis par Node en prod | 🟡 P2 |
| Pas de stratégie de cache définie | 🟡 P2 |
| Migrations DB non backward-compatible | 🟠 P1 |
