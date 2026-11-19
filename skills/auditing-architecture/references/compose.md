# Référence — Docker Compose

## Structure & Configuration

### Services
- [ ] Chaque service a un nom explicite et métier (pas `app1`, `service2`)
- [ ] Les `image:` sont taggés avec une version précise (pas `:latest` pour les services critiques)
- [ ] Les services utilisent `build:` avec un contexte minimal ou une image pre-built en prod
- [ ] `restart: unless-stopped` ou `on-failure:N` configuré sur tous les services
- [ ] `depends_on` avec `condition: service_healthy` (pas juste `depends_on: [db]`)

```yaml
# ✅ Bon : depends_on avec healthcheck
services:
  app:
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
```

### Healthchecks
- [ ] Un `healthcheck` est défini sur chaque service critique (db, cache, app)
- [ ] `start_period` suffisant pour le démarrage (ex: 30s pour une DB, 10s pour Node)
- [ ] La commande de healthcheck est légère (pas de requête lourde)

```yaml
# ✅ Bon : healthcheck PostgreSQL
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

### Réseau & Isolation
- [ ] Les services sont sur un réseau dédié (pas le réseau bridge par défaut)
- [ ] Seuls les services nécessaires exposent des ports sur l'hôte (`ports:`)
- [ ] Les services internes communiquent par leur nom de service (DNS interne Compose)
- [ ] Séparation des réseaux si besoin d'isolation (ex: réseau `frontend` / `backend`)

```yaml
# ✅ Bon : réseaux dédiés
networks:
  frontend:
  backend:
    internal: true   # pas d'accès internet pour le réseau DB/cache
```

### Volumes & Persistance
- [ ] Les volumes nommés sont utilisés pour les données persistantes (pas de bind mounts en prod)
- [ ] Les volumes de données critiques (DB) sont explicitement déclarés dans `volumes:`
- [ ] Pas de bind mount du code source en production (`./src:/app/src`)

### Secrets & Variables
- [ ] Les secrets utilisent `secrets:` Compose ou sont injectés via env (jamais hardcodés)
- [ ] Les variables d'env sont dans un fichier `.env` (hors repo) ou passées via l'orchestrateur
- [ ] Le fichier `docker-compose.yml` ne contient aucun secret en clair

### Resource Limits
- [ ] `deploy.resources.limits` défini pour les services en production (CPU + mémoire)
- [ ] `deploy.resources.reservations` défini pour garantir les ressources minimales

```yaml
# ✅ Bon : limites de ressources
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 128M
```

### Logging
- [ ] Driver de log configuré (`json-file` avec `max-size` et `max-file`, ou `loki`, etc.)
- [ ] Pas de log driver `none` sur les services critiques

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## Sévérités types

| Finding | Sévérité par défaut |
|---|---|
| `depends_on` sans `condition: service_healthy` | 🟠 P1 |
| Pas de healthcheck sur les services | 🟠 P1 |
| Secret en clair dans le fichier Compose | 🔴 P0 |
| Pas de `restart` policy | 🟠 P1 |
| Bind mount du code en prod | 🟠 P1 |
| Pas de resource limits en prod | 🟡 P2 |
| Image `latest` sur service DB/cache | 🟠 P1 |
| DB exposée sur port hôte en prod | 🔴 P0 |
| Pas de réseau dédié | 🟡 P2 |
| Pas de limite de taille des logs | 🟡 P2 |
