# Deploy Targets — Reference

> Cibles de déploiement supportées : Vercel, Netlify, registries Docker (GHCR, Docker Hub),
> FTPS/SFTP, rsync-over-SSH. Patterns prêts à intégrer dans un workflow.

**Sources externes utilisées dans ce fichier** — aucun changelog. Les commandes de CLI de
plateforme (Vercel, Netlify) sont la partie la plus volatile : vérifier la commande courante avant
de la produire.

> **Vérification post-déploiement et rollback** : ce fichier décrit comment *pousser* vers une
> cible. Le smoke test qui valide le résultat et le chemin de retour arrière sont dans
> `release-and-delivery.md`. Un déploiement sans les deux est incomplet.

## Sommaire

1. Vercel
2. Netlify
3. Docker — GitHub Container Registry (GHCR)
4. Docker — Docker Hub
5. Docker — patterns communs (multi-arch, cache, tags)
6. **FTPS / SFTP** (hébergement traditionnel : OVH, o2switch, etc.)
7. **rsync-over-SSH** (alternative plus rapide pour gros volumes / déploiements incrémentaux)
8. Tableau récapitulatif secrets requis

---

## 1. Vercel

### Secrets requis

| Secret | Origine |
|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens (scope minimal au projet) |
| `VERCEL_ORG_ID` | Récupéré via `vercel link` → `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Idem |

### Pattern preview (PR)

```yaml
deploy-preview:
  if: github.event_name == 'pull_request'
  runs-on: ubuntu-latest
  timeout-minutes: 10
  permissions:
    contents: read
    pull-requests: write
  env:
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
  steps:
    - uses: actions/checkout@v7

    - name: Install Vercel CLI
      run: pnpm add -g vercel@latest

    - name: Pull Vercel env
      run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}

    - name: Build
      run: vercel build --token=${{ secrets.VERCEL_TOKEN }}

    - name: Deploy
      id: deploy
      run: |
        URL=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
        echo "url=$URL" >> "$GITHUB_OUTPUT"

    - name: Comment PR
      uses: marocchino/sticky-pull-request-comment@5770ad5eb8f42dd2c4f34da00c94c5381e49af88 # v3.0.5
      with:
        message: |
          ✅ Preview deployed: ${{ steps.deploy.outputs.url }}
```

### Pattern prod

```yaml
deploy-prod:
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  needs: [lint, test, build]
  runs-on: ubuntu-latest
  timeout-minutes: 10
  permissions:
    contents: read
  environment:
    name: production
    url: https://app.example.com
  env:
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
  steps:
    - uses: actions/checkout@v7
    - run: pnpm add -g vercel@latest
    - run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
    - run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
    - run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### Points de vigilance Vercel

- Ne **jamais** builder via `pnpm build` puis déployer — Vercel ne ré-applique pas ses
  optimisations. Toujours passer par `vercel build` qui respecte `vercel.json` et les
  env vars du projet.
- Pour les monorepos : utiliser `--cwd ./apps/web` ou définir `Root Directory` dans
  Vercel Dashboard.
- Le `--prebuilt` flag permet d'éviter de re-build côté Vercel (gain de 30-60s).

---

## 2. Netlify

### Secrets requis

| Secret | Origine |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify → User Settings → Personal access tokens |
| `NETLIFY_SITE_ID` | Site Settings → Site information → API ID |

### Pattern preview + prod (un seul job, branche-aware)

```yaml
deploy-netlify:
  needs: build
  runs-on: ubuntu-latest
  timeout-minutes: 10
  permissions:
    contents: read
  env:
    NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
    NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
  steps:
    - uses: actions/checkout@v7
    - uses: actions/download-artifact@v8
      with:
        name: dist
        path: dist

    - name: Install Netlify CLI
      run: pnpm add -g netlify-cli

    # Le titre de PR est une valeur controlee par un tiers : il passe par env:,
    # jamais par interpolation dans le run:. Cf. security-supply-chain.md 8.
    - name: Deploy (preview)
      if: github.event_name == 'pull_request'
      env:
        PR_NUMBER: ${{ github.event.number }}
        PR_TITLE: ${{ github.event.pull_request.title }}
      run: |
        netlify deploy \
          --dir=dist \
          --message="PR #${PR_NUMBER}: ${PR_TITLE}"

    - name: Deploy (prod)
      if: github.ref == 'refs/heads/main' && github.event_name == 'push'
      run: |
        netlify deploy \
          --dir=dist \
          --prod \
          --message="Prod deploy: ${{ github.sha }}"
```

### Pattern avec action officielle

```yaml
- uses: nwtgck/actions-netlify@d22a32a27c918fe470bbc562e984f80ec48c2668 # v4.0.0
  with:
    publish-dir: './dist'
    production-deploy: ${{ github.ref == 'refs/heads/main' }}
    deploy-message: ${{ github.event.head_commit.message }}
    enable-pull-request-comment: true
  env:
    NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
    NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
  timeout-minutes: 5
```

### Points de vigilance Netlify

- Le build se fait côté **CI** (artefact uploadé), pas chez Netlify (sauf si on push
  juste les sources). Choisir une stratégie et s'y tenir.
- Pour Nuxt 3-4 : `NITRO_PRESET=netlify` ou `netlify-edge` selon la cible.
- `_redirects` et `_headers` doivent être présents dans le dossier `publish-dir`.

---

## 3. Docker — GitHub Container Registry (GHCR)

### Secrets requis

Aucun ! `GITHUB_TOKEN` suffit (avec la bonne permission).

### Pattern complet (build + push)

```yaml
build-push:
  runs-on: ubuntu-latest
  timeout-minutes: 20
  permissions:
    contents: read
    packages: write
  steps:
    - uses: actions/checkout@v7

    - uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0

    - uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@dc802804100637a589fabce1cb79ff13a1411302 # v6.2.0
      with:
        images: ghcr.io/${{ github.repository }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=sha,prefix=,format=short
          type=raw,value=latest,enable={{is_default_branch}}

    - name: Build and push
      uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7.3.0
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        platforms: linux/amd64
```

### Points de vigilance GHCR

- `permissions.packages: write` est obligatoire.
- Visibilité de l'image par défaut = privée. Pour la rendre publique :
  `Settings → Packages → ... → Change visibility`.
- L'image est liée au **repo** (pas à l'utilisateur) si on push sous `ghcr.io/<org>/<repo>`.

---

## 4. Docker — Docker Hub

### Secrets requis

| Secret | Origine |
|---|---|
| `DOCKERHUB_USERNAME` | Compte Docker Hub |
| `DOCKERHUB_TOKEN` | Docker Hub → Account Settings → Security → New Access Token (read+write) |

### Pattern

```yaml
build-push:
  runs-on: ubuntu-latest
  timeout-minutes: 20
  permissions:
    contents: read
  steps:
    - uses: actions/checkout@v7
    - uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0

    - uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
      with:
        username: ${{ secrets.DOCKERHUB_USERNAME }}
        password: ${{ secrets.DOCKERHUB_TOKEN }}

    - id: meta
      uses: docker/metadata-action@dc802804100637a589fabce1cb79ff13a1411302 # v6.2.0
      with:
        images: ${{ secrets.DOCKERHUB_USERNAME }}/my-app

    - uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7.3.0
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

### Points de vigilance Docker Hub

- Pas de `GITHUB_TOKEN` ici — il faut un PAT Docker Hub.
- Limite de pull pour les comptes free : penser à un **mirror** ou à GHCR si l'usage est intensif.
- Utiliser un token avec scope **read+write**, jamais le mot de passe du compte.

---

## 5. Docker — patterns communs

### Multi-arch (amd64 + arm64)

```yaml
- uses: docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8 # v4.2.03        # Requis pour cross-build
- uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0
- uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7.3.0
  with:
    context: .
    push: true
    platforms: linux/amd64,linux/arm64
    tags: ${{ steps.meta.outputs.tags }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

> ⚠️ Multi-arch via QEMU : build 2 à 4 fois plus lent. À justifier (production ARM, Mac Apple
> Silicon). **Alternative sans émulation** : construire chaque variante sur un runner de son
> architecture — `ubuntu-24.04` pour amd64, `ubuntu-24.04-arm` pour arm64 — puis fusionner les
> manifestes. Les runners arm64 sont disponibles en dépôt privé ; voir `optimization.md` §6.

### Cache Buildx — 3 stratégies

```yaml
# A. Cache GitHub Actions (recommandé par défaut, gratuit, 10 GB)
cache-from: type=gha
cache-to: type=gha,mode=max

# B. Cache registry (pour partager entre workflows / repos)
cache-from: type=registry,ref=ghcr.io/${{ github.repository }}:buildcache
cache-to: type=registry,ref=ghcr.io/${{ github.repository }}:buildcache,mode=max

# C. Cache inline (dans l'image finale, taille augmentée)
cache-from: type=registry,ref=ghcr.io/${{ github.repository }}:latest
cache-to: type=inline
```

### Tags recommandés (via `metadata-action`)

Pour une image versionnée propre :

```yaml
tags: |
  type=ref,event=branch              # main, develop
  type=ref,event=pr                  # pr-42
  type=semver,pattern={{version}}    # 1.2.3
  type=semver,pattern={{major}}.{{minor}}  # 1.2
  type=sha,prefix=,format=short      # a1b2c3d
  type=raw,value=latest,enable={{is_default_branch}}
```

### Build avec args

```yaml
- uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7.3.0
  with:
    context: .
    build-args: |
      NODE_VERSION=20.11.0
      VITE_API_URL=${{ vars.VITE_API_URL }}
    secrets: |
      "npm_token=${{ secrets.NPM_TOKEN }}"
```

Dans le Dockerfile :

```dockerfile
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) pnpm install
```

→ Le secret n'apparaît jamais dans les layers de l'image.

---

## 6. FTPS / SFTP

Cible classique pour les hébergements mutualisés (OVH, o2switch, Infomaniak, Gandi…) ou pour
les VPS qui ne sont pas conteneurisés. Encore très répandu en France et en Europe pour les
projets PHP/JS traditionnels.

### Secrets requis

| Secret | Note |
|---|---|
| `FTP_SERVER` | `ftps.exemple.com` ou IP |
| `FTP_USERNAME` | User dédié au déploiement (jamais le user root) |
| `FTP_PASSWORD` | Idéalement rotation trimestrielle |
| `FTP_PORT` | 21 (FTPS explicite) ou 990 (FTPS implicite) ou 22 (SFTP) |

### Pattern FTPS — push de l'output build

```yaml
deploy-ftps:
  needs: build
  runs-on: ubuntu-latest
  timeout-minutes: 15
  permissions:
    contents: read
  steps:
    - uses: actions/checkout@v7

    - uses: actions/download-artifact@v8
      with:
        name: build-output
        path: dist/

    - name: Deploy via FTPS
      uses: SamKirkland/FTP-Deploy-Action@3a9c65ae0fc12ac924ccef8afc26941cc43aad0b # v4.4.0
      with:
        server:      ${{ secrets.FTP_SERVER }}
        username:    ${{ secrets.FTP_USERNAME }}
        password:    ${{ secrets.FTP_PASSWORD }}
        port:        ${{ secrets.FTP_PORT }}
        protocol:    ftps                  # ⚠️ ne JAMAIS utiliser 'ftp' en clair
        local-dir:   dist/
        server-dir:  /www/
        dry-run:     false
        log-level:   minimal
        exclude: |
          **/.git*
          **/.github/**
          **/node_modules/**
          **/.env*
```

### Pattern FTPS — archive chiffrée (recommandé pour la prod)

Plutôt que pousser des milliers de fichiers individuels (lent + risque de cohérence partielle),
créer une archive `.tar.gz`, la chiffrer en GPG, et ne pousser qu'un seul fichier. Un script
côté serveur la décompresse atomiquement.

```yaml
- name: Setup GPG
  env:
    GPG_KEY: ${{ secrets.GPG_KEY }}
  run: |
    mkdir -p ~/.gnupg && chmod 700 ~/.gnupg
    echo -e "use-agent\npinentry-mode loopback" > ~/.gnupg/gpg.conf
    echo "allow-loopback-pinentry"               > ~/.gnupg/gpg-agent.conf
    printf '%s' "$GPG_KEY" | gpg --batch --quiet --import

- name: Create encrypted archive
  env:
    GPG_RECIPIENT: ${{ secrets.GPG_RECIPIENT_MAIL }}
    DEPLOY_ENV:    ${{ inputs.environment_name }}
    RUN_ID:        ${{ github.run_id }}
  run: |
    ARCHIVE="app-${DEPLOY_ENV}-${RUN_ID}"
    mkdir -p build/archive
    tar -czf "build/${ARCHIVE}.tar.gz" \
      --exclude='./build' \
      --exclude='./.git' \
      --exclude='./node_modules' \
      --exclude='./.github' \
      .
    gpg --batch --yes --quiet --pinentry-mode loopback \
      --encrypt --recipient "$GPG_RECIPIENT" \
      --output "build/archive/${ARCHIVE}.tar.gz.gpg" \
      "build/${ARCHIVE}.tar.gz"
    rm -rf ~/.gnupg

- name: Upload archive via FTPS
  uses: SamKirkland/FTP-Deploy-Action@3a9c65ae0fc12ac924ccef8afc26941cc43aad0b # v4.4.0
  with:
    server:      ${{ secrets.FTP_SERVER }}
    username:    ${{ secrets.FTP_USERNAME }}
    password:    ${{ secrets.FTP_PASSWORD }}
    port:        ${{ secrets.FTP_PORT }}
    protocol:    ftps
    local-dir:   build/archive/
    server-dir:  /deploy-inbox/
```

> Le serveur de destination doit avoir un cron / inotify watcher qui détecte les nouvelles
> archives, les déchiffre avec la clé privée correspondante, les extrait dans une nouvelle
> release, et bascule un symlink atomique (`current → releases/<run_id>`).

### Pattern SFTP (alternative à FTPS)

Si l'hébergeur supporte SSH, SFTP est préférable (un seul port à ouvrir, chiffrement intégré
à la couche transport, pas de mode actif/passif compliqué).

```yaml
- name: Setup SSH key
  uses: webfactory/ssh-agent@e83874834305fe9a4a2997156cb26c5de65a8555 # v0.10.0
  with:
    ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

- name: Pin host key
  env:
    SSH_KNOWN_HOSTS: ${{ secrets.SSH_KNOWN_HOSTS }}
  run: |
    mkdir -p ~/.ssh && chmod 700 ~/.ssh
    printf '%s\n' "$SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts
    chmod 600 ~/.ssh/known_hosts

- name: SFTP upload
  env:
    SSH_USER: ${{ secrets.SSH_USER }}
    SSH_HOST: ${{ secrets.SSH_HOST }}
  run: |
    sftp -b - "$SSH_USER@$SSH_HOST" <<EOF
    put -r dist/ /var/www/app/
    EOF
```

### Points de vigilance FTPS / SFTP

- **Jamais de FTP clair** (`protocol: ftp` sans le S). Si l'hébergeur ne supporte que FTP clair,
  c'est un signal pour migrer d'hébergeur, pas pour accepter.
- **User FTP dédié** au déploiement, restreint en chroot, jamais le user root.
- **Exclure systématiquement** : `.git`, `.github`, `node_modules`, `.env*`, fichiers de config
  CI (Jenkinsfile, eslint config, etc.). Voir `exclude:` dans l'exemple.
- **Pas de stratégie atomique native** : un push FTPS de 5000 fichiers prend X secondes ; pendant
  ce temps, le site est dans un état partiellement mis à jour. Solution = archive + symlink atomique.
- **Idempotence** : `SamKirkland/FTP-Deploy-Action` fait du diff implicite (state-based). En cas
  de doute (corruption), ajouter `dangerous-clean-slate: true` pour forcer un re-upload complet.

---

## 7. rsync-over-SSH

Alternative à SFTP, plus rapide pour les gros volumes (rsync = diff + compression + transfer).
Recommandé si l'hébergeur supporte SSH et que vous avez 1000+ fichiers à pousser.

### Pattern

```yaml
deploy-rsync:
  needs: build
  runs-on: ubuntu-latest
  timeout-minutes: 15
  permissions:
    contents: read
  steps:
    - uses: actions/checkout@v7

    - uses: actions/download-artifact@v8
      with:
        name: build-output
        path: dist/

    - uses: webfactory/ssh-agent@e83874834305fe9a4a2997156cb26c5de65a8555 # v0.10.0
      with:
        ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

    - name: Pin host key
      env:
        SSH_KNOWN_HOSTS: ${{ secrets.SSH_KNOWN_HOSTS }}
      run: |
        mkdir -p ~/.ssh && chmod 700 ~/.ssh
        printf '%s\n' "$SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts
        chmod 600 ~/.ssh/known_hosts

    - name: rsync deploy
      env:
        SSH_USER: ${{ secrets.SSH_USER }}
        SSH_HOST: ${{ secrets.SSH_HOST }}
      run: |
        rsync -avz --delete \
          --exclude='.git' \
          --exclude='.github' \
          --exclude='node_modules' \
          --exclude='.env*' \
          -e "ssh -o StrictHostKeyChecking=yes" \
          dist/ "$SSH_USER@$SSH_HOST:/var/www/app/"
```

### Flags rsync à connaître

| Flag | Effet |
|---|---|
| `-a` | Archive mode (preserve perms, timestamps, symlinks) |
| `-v` | Verbose (logs lisibles) |
| `-z` | Compression à la volée (gain réseau) |
| `--delete` | Supprime côté distant les fichiers absents en local (⚠️ destructif) |
| `--exclude=` | Pattern à ignorer |
| `--dry-run` | Simulation sans toucher (toujours tester avec ça d'abord) |
| `-i` | Itemize changes (debug fin) |

### Pattern déploiement atomique (zero-downtime)

```bash
RELEASE_DIR="/var/www/releases/$(date +%Y%m%d-%H%M%S)-${GITHUB_SHA::7}"
rsync -avz --delete dist/ "$SSH_USER@$SSH_HOST:$RELEASE_DIR/"
ssh "$SSH_USER@$SSH_HOST" "ln -sfn $RELEASE_DIR /var/www/current && \
  ls -1dt /var/www/releases/* | tail -n +6 | xargs rm -rf"
```

→ Chaque déploiement crée une release isolée, le symlink `current` bascule atomiquement, et les 5
dernières releases sont conservées.

C'est ce qui rend le rollback trivial : repointer le symlink, sans retransférer un octet. La
procédure de bascule inverse est dans `release-and-delivery.md` §2 — la conservation des releases
ne sert à rien si personne n'a écrit et testé le retour arrière.

### Points de vigilance rsync

- `--delete` est **destructif** : tester en `--dry-run` avant le 1er run réel.
- `StrictHostKeyChecking=no` désactive toute vérification de l'hôte → jamais.
- **`ssh-keyscan` n'est pas une vérification, c'est un TOFU** (*trust on first use*) : il accepte
  la clé que le réseau lui présente au moment du run. Sur un runner hébergé, dont le chemin
  réseau n'est pas sous votre contrôle, cela n'écarte pas un man-in-the-middle — cela le rend
  seulement invisible. Récupérer l'empreinte **hors bande** (console de l'hébergeur, ou
  `ssh-keyscan` lancé une fois depuis une machine de confiance, empreinte comparée à celle
  affichée par l'hébergeur), la stocker dans le secret `SSH_KNOWN_HOSTS`, et l'écrire dans
  `~/.ssh/known_hosts` comme ci-dessus. `ssh-keyscan` en CI reste acceptable pour une cible
  non critique ; sur une cible de production, c'est un **P1**.
- La clé SSH doit être dédiée au déploiement (pas une clé personnelle).
- Pour des très gros volumes (>10k fichiers), `rsync` reste plus efficace qu'archive+upload.

---

## 8. Tableau récapitulatif secrets requis

| Cible | Secrets / Tokens | Permissions GitHub |
|---|---|---|
| Vercel | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `contents: read` |
| Netlify | `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` | `contents: read` |
| GHCR | (aucun, `GITHUB_TOKEN` suffit) | `contents: read`, `packages: write` |
| Docker Hub | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | `contents: read` |
| FTPS | `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_PORT` (+ `GPG_KEY`, `GPG_RECIPIENT_MAIL` si archive chiffrée) | `contents: read` |
| SFTP | `SSH_PRIVATE_KEY`, `SSH_USER`, `SSH_HOST`, `SSH_KNOWN_HOSTS` | `contents: read` |
| rsync-over-SSH | `SSH_PRIVATE_KEY`, `SSH_USER`, `SSH_HOST`, `SSH_KNOWN_HOSTS` | `contents: read` |

### Check-list de sécurité avant d'écrire un déploiement

- [ ] Tous les secrets sont dans `Settings → Secrets`, jamais en clair
- [ ] Les `permissions:` sont déclarées explicitement (workflow ou job)
- [ ] Un `environment:` est utilisé pour la prod (avec reviewers si critique)
- [ ] Pas d'interpolation `${{ ... }}` user-controlled dans `run:` (cf. `github-actions.md` §14)
- [ ] `timeout-minutes:` est posé
- [ ] Le déploiement se fait **après** un build validé (lint + test + build OK)
- [ ] Pour Docker : tags versionnés, pas seulement `latest`
