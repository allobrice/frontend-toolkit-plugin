# Référence — Dockerfile

## Structure & Bonnes pratiques

### Image de base
- [ ] Image de base officielle et taggée avec une version précise (pas `:latest`)
- [ ] Préférer les variantes `alpine` ou `slim` pour réduire la surface d'attaque
- [ ] L'image de base correspond à la version utilisée en dev (cohérence runtime)
- [ ] Pour Node.js : utiliser `node:XX-alpine` ou `node:XX-slim`, jamais `node:latest`

### Multi-stage build
- [ ] Un multi-stage build est utilisé pour séparer build et runtime
- [ ] Le stage final ne contient que les artefacts nécessaires (pas les devDependencies, pas les
  sources, pas les outils de build)
- [ ] Les secrets de build (tokens npm, etc.) sont passés via `--secret` (BuildKit), jamais via ARG

```dockerfile
# ✅ Bon : multi-stage Node.js
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app   # non-root
COPY --from=builder /app/.output ./.output
USER app
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

### Layers & Cache
- [ ] `COPY package*.json` avant `COPY . .` pour maximiser le cache Docker
- [ ] `npm ci` (pas `npm install`) pour un build déterministe
- [ ] `RUN npm ci --only=production` ou séparation install dev/prod
- [ ] Pas de `RUN apt-get update` seul sans `apt-get install` dans la même ligne (cache poisoning)
- [ ] Cleanup dans la même `RUN` que l'install : `&& rm -rf /var/cache/apk/*`

### Sécurité
- [ ] L'application ne tourne **pas** en root (user dédié créé dans le Dockerfile)
- [ ] `.dockerignore` existe et exclut : `node_modules`, `.git`, `.env`, `*.log`, `coverage/`,
  `dist/`, `.nuxt/`
- [ ] Aucun secret dans les layers (même supprimé dans un RUN suivant, il reste dans l'historique)
- [ ] `HEALTHCHECK` défini dans le Dockerfile

```dockerfile
# ✅ Bon : HEALTHCHECK
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
```

### Nuxt 3 / Node.js spécifique
- [ ] Le build Nuxt utilise `nuxt build` et le runner utilise `.output/server/index.mjs`
- [ ] `NODE_ENV=production` est défini dans l'image finale
- [ ] La commande finale est `node` (pas `npm start` qui ajoute un process inutile)
- [ ] `--max-old-space-size` aligné avec la mémoire du container (ex: 512 pour 1Gi RAM)

```dockerfile
# ✅ Nuxt 3 standalone
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"
CMD ["node", ".output/server/index.mjs"]
```

---

## Sévérités types

| Finding | Sévérité par défaut |
|---|---|
| Image `latest` en production | 🟠 P1 |
| Container tournant en root | 🔴 P0 |
| Pas de `.dockerignore` | 🟠 P1 |
| Secret dans un `ARG` ou `ENV` de build | 🔴 P0 |
| Pas de multi-stage build (image bloatée) | 🟠 P1 |
| `npm install` au lieu de `npm ci` | 🟡 P2 |
| Pas de HEALTHCHECK | 🟠 P1 |
| `node_modules` copiés depuis le host | 🔴 P0 |
| `devDependencies` présentes en prod | 🟡 P2 |
| `COPY . .` avant `COPY package.json` | 🟡 P2 |
