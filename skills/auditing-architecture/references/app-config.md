# Référence — Application & Configuration

## Checks généraux

### Variables d'environnement & Secrets
- [ ] Les secrets ne sont jamais hardcodés dans le code ou les Dockerfiles
- [ ] Un `.env.example` existe et est à jour (`.env` dans `.gitignore`)
- [ ] Les variables d'env obligatoires sont validées au démarrage (fail-fast)
- [ ] Distinction claire entre config statique (fichier) et config dynamique (env)
- [ ] Pas de credentials dans les logs au démarrage

### Configuration générale
- [ ] La config respecte les principes 12-factor (config via env, pas de config en dur)
- [ ] Les timeouts sont configurés explicitement (HTTP client, DB, queues)
- [ ] Le mode debug/verbose n'est pas activé en production
- [ ] Les ports exposés sont documentés et intentionnels
- [ ] Les CORS sont configurés restrictement en prod (pas `*`)

### Gestion des erreurs
- [ ] Les erreurs non gérées ont un handler global (uncaughtException, unhandledRejection en Node)
- [ ] Les stack traces ne sont pas exposées en production
- [ ] Un format de log structuré (JSON) est utilisé (pas console.log bruts)

---

## Checks spécifiques Node.js

- [ ] `NODE_ENV=production` est défini en prod (active les optimisations Express, Nuxt, etc.)
- [ ] `node --max-old-space-size` est configuré selon la RAM du container
- [ ] Le processus Node écoute sur `0.0.0.0` et non `localhost` dans un container
- [ ] Graceful shutdown implémenté : écoute `SIGTERM`, ferme les connexions proprement
- [ ] `package-lock.json` ou `yarn.lock` est commité et utilisé au build

```js
// ✅ Bon : graceful shutdown Node.js
process.on('SIGTERM', async () => {
  await server.close()
  await db.disconnect()
  process.exit(0)
})
```

---

## Checks spécifiques Nuxt/Vue

- [ ] `nuxt.config` ne contient pas de secrets (tout ce qui est là va dans le bundle client)
- [ ] Les variables publiques utilisent `NUXT_PUBLIC_` (Nuxt 3) ou `runtimeConfig.public`
- [ ] Les variables privées sont dans `runtimeConfig` (côté serveur uniquement)
- [ ] Le mode de build est explicite : `ssr: true` (SSR), `ssr: false` (SPA), ou `nitro.preset`
  pour SSG
- [ ] `nitro.preset` est configuré pour le target de déploiement (node-server, docker, etc.)
- [ ] Les assets statiques sont servis via CDN ou cache HTTP en prod (pas via Node)

```ts
// ✅ Bon : runtimeConfig Nuxt 3
export default defineNuxtConfig({
  runtimeConfig: {
    dbPassword: process.env.DB_PASSWORD,      // serveur uniquement
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_URL // exposé côté client
    }
  }
})
```

---

## Sévérités types

| Finding | Sévérité par défaut |
|---|---|
| Secret hardcodé dans le code | 🔴 P0 |
| `.env` commité dans git | 🔴 P0 |
| Pas de validation des env au démarrage | 🟠 P1 |
| `NODE_ENV` non défini en prod | 🟠 P1 |
| Secret dans `nuxt.config` exposé au client | 🔴 P0 |
| Pas de graceful shutdown | 🟠 P1 |
| Logs non structurés | 🟡 P2 |
| CORS `*` en prod | 🟠 P1 |
