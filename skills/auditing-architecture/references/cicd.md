# Référence — CI/CD Pipeline

## Structure générale

### Stages attendus
Un pipeline de production doit couvrir dans l'ordre :
1. **Lint / Format** — qualité syntaxique (ESLint, Prettier, hadolint pour Dockerfile)
2. **Test** — unitaires, intégration, coverage minimum
3. **Build** — build de l'application et de l'image Docker
4. **Scan** — analyse de sécurité (image, dépendances)
5. **Push** — push de l'image sur le registry avec tag approprié
6. **Deploy** — déploiement sur l'environnement cible (avec approbation pour prod)

### Checks généraux
- [ ] Le pipeline s'exécute sur chaque PR/MR (pas seulement sur `main`)
- [ ] Les étapes sont parallélisées quand possible (lint + test en parallèle)
- [ ] Pas de déploiement automatique en production sans approbation humaine
- [ ] Les secrets sont dans les variables CI (jamais dans les fichiers de pipeline)
- [ ] Timeouts définis sur les jobs (évite les pipelines bloqués indéfiniment)
- [ ] Cache des dépendances configuré (`node_modules`, `.npm`, layers Docker)

---

## Gestion des images Docker

### Tagging strategy
- [ ] Les images ne sont **jamais** taguées `:latest` seul en prod
- [ ] Stratégie de tag cohérente : `sha-<commit>`, `v1.2.3`, ou `<branch>-<timestamp>`
- [ ] L'image déployée en prod correspond exactement à celle testée en staging
- [ ] Les tags immutables sont utilisés (sha > semver > branch)

```yaml
# ✅ Bon : tag avec SHA Git
IMAGE_TAG: $CI_COMMIT_SHORT_SHA  # GitLab
IMAGE_TAG: ${{ github.sha }}      # GitHub Actions
```

### Registry
- [ ] Un registry privé est utilisé en prod (pas Docker Hub public pour du code propriétaire)
- [ ] L'authentification au registry utilise des credentials CI dédiés (pas personnels)
- [ ] Les images sont scannées avant push (`trivy`, `grype`, `docker scout`)

---

## Sécurité du pipeline

- [ ] Les secrets CI sont scopés par environnement (pas les mêmes tokens dev/prod)
- [ ] Le pipeline ne loggue pas les valeurs des secrets (masquage activé)
- [ ] Les runners/agents CI ne tournent pas en mode privilégié inutilement
- [ ] Les dépendances sont lockées (pas `npm install` sans lockfile)
- [ ] Scan des dépendances vulnérables (`npm audit`, `snyk`, etc.)
- [ ] Vérification que `.env` n'est pas inclus dans l'image buildée

---

## Checks spécifiques GitHub Actions

```yaml
# ✅ Bon : build Docker avec cache et tag SHA
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: registry/app:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
    secrets: |
      npm_token=${{ secrets.NPM_TOKEN }}
```

- [ ] `actions/checkout` utilisé avec `fetch-depth: 0` si besoin de l'historique git
- [ ] Les permissions GitHub token sont minimalistes (`permissions: contents: read`)
- [ ] `docker/setup-buildx-action` utilisé pour activer BuildKit
- [ ] Le cache Docker layers est configuré (`cache-from/cache-to`)

---

## Checks spécifiques GitLab CI

```yaml
# ✅ Bon : build Nuxt en GitLab CI
build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  variables:
    DOCKER_BUILDKIT: "1"
  script:
    - docker build --secret id=npm_token,env=NPM_TOKEN -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
  only:
    - main
    - merge_requests
```

- [ ] `DOCKER_BUILDKIT: "1"` activé
- [ ] `.gitlab-ci.yml` utilise des règles `rules:` plutôt que `only/except` (déprécié)
- [ ] Les artefacts de build ont une `expire_in` définie
- [ ] Le registry GitLab est utilisé (pas Docker Hub pour les images internes)

---

## Nuxt / Node.js en CI

- [ ] Le build Nuxt est exécuté dans le Dockerfile (pas pré-builté puis copié)
- [ ] Les tests sont exécutés contre l'image buildée, pas contre le code source seul
- [ ] La version Node utilisée en CI correspond exactement à celle du Dockerfile
- [ ] `npm ci` est utilisé (pas `npm install`)

---

## Sévérités types

| Finding | Sévérité par défaut |
|---|---|
| Secrets dans les fichiers de pipeline | 🔴 P0 |
| Tag `:latest` pour déploiement prod | 🟠 P1 |
| Pas de scan de sécurité de l'image | 🟠 P1 |
| Déploiement prod sans approbation | 🟠 P1 |
| Image buildée ≠ image déployée | 🔴 P0 |
| Pas de cache Docker layers | 🟡 P2 |
| Pas de tests dans le pipeline | 🔴 P0 |
| Secrets non scopés par environnement | 🟠 P1 |
| Pas de timeout sur les jobs | 🟡 P2 |
