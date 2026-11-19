# Security & Supply Chain — Reference

> Sécurité des workflows GitHub Actions : épinglage, linting, permissions, OIDC, attestations,
> triggers dangereux, SAST/SCA, secret managers. Lue dès qu'un secret, un déploiement ou une
> action tierce entre en jeu.

**Sources de changelog utilisées dans ce fichier**

- <https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/>
- <https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout/>
- <https://github.blog/changelog/2026-06-18-control-who-and-what-triggers-github-actions-workflows/>
- <https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/>
- <https://github.blog/security/supply-chain-security/disrupting-supply-chain-attacks-on-npm-and-github-actions/>
- <https://docs.zizmor.sh/>

## Sommaire

1. Politique d'épinglage des actions
2. Linting de workflows — `actionlint` et `zizmor`
3. Permissions
4. OIDC vers un cloud provider
5. Attestations et provenance
6. Le cache comme frontière de confiance
7. Triggers dangereux
8. Entrées non fiables et injection
9. SAST, SCA, secret scanning
10. Contrôles au niveau organisation
11. Secret managers externes
12. Checklist P0

---

## 1. Politique d'épinglage des actions

| Éditeur | Référence | Raison |
|---|---|---|
| `actions/*`, `github/*` | Tag majeur flottant `@vN` | Éditeur = GitHub. Même surface de confiance que la plateforme elle-même, et le tag majeur reçoit les correctifs de sécurité automatiquement |
| **Tout le reste, `docker/*` inclus** | SHA complet + `# <tag>` | `docker/*` est une organisation tierce, pas GitHub. Le risque démontré vient des actions tierces |

```yaml
- uses: actions/checkout@v7
- uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0
```

Un tag n'est pas immuable : son détenteur peut le repointer sur un autre commit. Un SHA de commit
l'est. C'est toute la différence entre « je fais confiance à ce code » et « je fais confiance à
quiconque contrôle ce tag ».

### Dependabot n'est pas optionnel

Épingler au SHA **sans** mise à jour automatisée fige les vulnérabilités au lieu de les éviter :
le workflow reste sur une version dont une faille est publiée. L'épinglage SHA et Dependabot sont
un seul dispositif en deux morceaux.

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    groups:
      actions-minor:
        patterns: ['*']
        update-types: ['minor', 'patch']
```

Dependabot réécrit le SHA **et** le commentaire de version. Le regroupement des minor/patch évite
une PR par action et par semaine.

En audit : action tierce non épinglée → **P1**. Épinglage SHA sans `dependabot.yml` → **P1**
également, car le dispositif est incomplet.

### Vérifier une version — deux appels, pas un

```bash
gh api repos/OWNER/REPO/releases/latest --jq .tag_name
gh api repos/OWNER/REPO/git/refs/tags --jq '.[].ref'
```

Le second n'est pas redondant : **une release n'implique pas un tag majeur flottant.**
`actions/dependency-review-action` publie jusqu'à `v5.0.0` alors que ses tags majeurs s'arrêtent à
`v3` — écrire `@v5` produit un workflow cassé, il faut `@v5.0.0`. Ne jamais déduire `@vN` d'un
numéro de release.

`scripts/pin-actions.sh` automatise la résolution tag → SHA.

---

## 2. Linting de workflows — `actionlint` et `zizmor`

Deux outils complémentaires, à faire tourner en CI et pas seulement à la main.

| Outil | Ce qu'il voit |
|---|---|
| `actionlint` | Syntaxe du workflow, expressions `${{ }}`, types de contextes, shellcheck sur les `run:`, labels de runners inexistants, inputs d'actions invalides |
| `zizmor` | Analyse statique de sécurité : actions non épinglées, injection de template, triggers dangereux, credentials persistés, permissions excessives |

Aucun des deux ne remplace l'autre : `actionlint` attrape ce qui ne marchera pas, `zizmor` ce qui
marchera trop bien. Un workflow sans l'un des deux → **P1**.

```yaml
lint-workflows:
  runs-on: ubuntu-latest
  timeout-minutes: 10
  permissions:
    contents: read
    security-events: write      # upload du SARIF vers le Security tab
  steps:
    - uses: actions/checkout@v7
      with:
        persist-credentials: false

    - name: actionlint
      uses: raven-actions/actionlint@3d39aea434753780c3b3d4a1a31c854b4dbf49d7 # v2.2.0

    - name: zizmor
      uses: zizmorcore/zizmor-action@3dc1ecc9bcb9e94e9b2c709687979e1298497054 # v0.6.2
      with:
        persona: regular          # 'pedantic' et 'auditor' remontent bien plus : à réserver aux audits
        min-severity: low
```

> Passer par une action épinglée plutôt que par un `bash <(curl ...)`. Un script téléchargé à
> la volée est précisément la dépendance non vérifiée que le reste de ce fichier proscrit, et
> `zizmor` le signale lui-même via son audit `unpinned-tools`.

`zizmor-action` produit un SARIF (`outputs.output-file`), consommable par le Security tab via
`github/codeql-action/upload-sarif` avec une `category` dédiée. Consulter la doc de l'outil pour
le détail des règles : leur nombre et leur nommage évoluent à chaque version, les figer ici les
rendrait faux.

### ⚠️ Sans configuration, ce job contredit la politique d'épinglage

Depuis sa v1.20.0, `zizmor` applique par défaut une politique de **hash-pin sur toutes les
actions**, `actions/*` incluses. La politique retenue ici — tag majeur flottant pour `actions/*`
et `github/*` — déclenche donc un `unpinned-uses` sur chaque `uses: actions/checkout@v7`. Le job
de lint serait rouge en permanence, et une équipe finit toujours par désactiver un contrôle qui
crie à tort.

Poser la politique dans un fichier de configuration, à la racine du dépôt :

```yaml
# zizmor.yml
rules:
  unpinned-uses:
    config:
      policies:
        "actions/*": ref-pin      # tag majeur accepté : éditeur = GitHub
        "github/*": ref-pin
        "*": hash-pin             # tout le reste, docker/* inclus
```

Trois politiques existent : `hash-pin` (SHA obligatoire), `ref-pin` (tag ou SHA), `any` (aucune
exigence). La règle la plus spécifique gagne, indépendamment de l'ordre. Sans règle `"*"`
explicite, un `hash-pin` implicite s'applique à tout ce qui n'est pas matché.

Ce fichier est le point où la politique du projet devient exécutable au lieu de rester une
convention. **Un désaccord entre `zizmor.yml` et la politique documentée est un finding en
soi** : l'un des deux ment.

Pour migrer un dépôt existant, `zizmor --fix` sait hash-pinner automatiquement ; côté
tiers, `pinact` fait la même chose et sait aussi mettre à jour les versions. Le script
`scripts/pin-actions.sh` de ce skill applique la politique arbitrée ici.

`scripts/audit-workflows.sh` lance les deux en local, avant tout audit manuel.

---

## 3. Permissions

### Le défaut est trop large

```yaml
permissions: {}          # au niveau workflow : rien par défaut

jobs:
  build:
    permissions:
      contents: read     # élévation au strict nécessaire, job par job
```

`permissions: {}` puis élévation par job est plus strict qu'un `contents: read` global, qui accorde
la lecture du dépôt à des jobs qui n'en ont pas besoin. Un workflow sans `permissions:` du tout
hérite du défaut du dépôt, souvent en écriture → **P1**.

| Permission | Usage |
|---|---|
| `contents: read` | Checkout |
| `contents: write` | Push, tag, release |
| `packages: write` | Push d'image vers GHCR |
| `pull-requests: write` | Commenter ou labelliser une PR |
| `issues: write` | Commenter une issue |
| `id-token: write` | OIDC vers un cloud provider, signature Sigstore |
| `attestations: write` | Persister une attestation |
| `artifact-metadata: write` | Créer l'enregistrement de stockage d'artefact (attestations) |
| `security-events: write` | Upload de SARIF vers le Security tab |
| `deployments: write` | API Deployments |

---

## 4. OIDC vers un cloud provider

OIDC supprime les credentials longue durée : le workflow échange un JWT signé par GitHub contre
des credentials temporaires émis par le cloud.

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@e6de054238d6b7531b4efff3b6587d9aade6a06c # v6.2.3
    with:
      role-to-assume: arn:aws:iam::123456789012:role/gha-deploy
      aws-region: eu-west-3

  - uses: azure/login@f5d393ae46f8fde4be8b75f32e3fc50e654ad0ca # v3.0.1
    with:
      client-id: ${{ vars.AZURE_CLIENT_ID }}
      tenant-id: ${{ vars.AZURE_TENANT_ID }}
      subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

  - uses: google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093 # v3
    with:
      workload_identity_provider: projects/123/locations/global/workloadIdentityPools/gha/providers/github
      service_account: gha-deploy@my-project.iam.gserviceaccount.com
```

Les identifiants de rôle ne sont pas des secrets : ils passent par `vars`, pas `secrets`.

### ⚠️ Immutable subject claims — piège actif

Le claim `sub` du JWT, sur lequel reposent les trust policies cloud, change de format :

```
avant : repo:octocat/my-repo:ref:refs/heads/main
après  : repo:octocat@123456/my-repo@456789:ref:refs/heads/main
```

Les identifiants numériques immuables du propriétaire et du dépôt sont insérés après leurs noms,
séparés par `@`. Objectif : un token reste lié au dépôt d'origine même si son nom est réutilisé
plus tard par quelqu'un d'autre.

| Situation | Format |
|---|---|
| Dépôt existant, non renommé | Ancien format, inchangé |
| Dépôt **créé** après le 15/07/2026 | Nouveau format, automatique |
| Dépôt **renommé ou transféré** après le 15/07/2026 | Nouveau format, automatique |
| Opt-in volontaire | Nouveau format |

**Symptôme à reconnaître** : une authentification OIDC qui échoue alors que ni le workflow ni le
rôle IAM n'ont bougé, après un renommage ou un transfert de dépôt. La trust policy filtre sur
l'ancien `sub` et ne matche plus. GitHub expose un endpoint de prévisualisation du claim pour
vérifier le format effectif avant de modifier la configuration cloud.

Corollaire : une trust policy qui matche `sub` par égalité stricte est fragile. Préférer un
filtrage sur `repository_id` / `repository_owner_id` quand le provider le permet.

---

## 5. Attestations et provenance

### Disponibilité — à vérifier avant de recommander

| Contexte | Disponibilité |
|---|---|
| Dépôt **public** | Tous les plans |
| Dépôt **privé ou interne** | **GitHub Enterprise Cloud uniquement** |
| GitHub Enterprise Server | **Non supporté** |

Vérifier le plan avant de proposer des attestations : sur un dépôt privé hors Enterprise Cloud,
c'est une recommandation inapplicable.

### Quelle action utiliser

`actions/attest-build-provenance` n'est, depuis sa v4, qu'un wrapper autour de
[`actions/attest`](https://github.com/actions/attest). Les workflows existants peuvent rester sur
le wrapper ; **toute nouvelle implémentation utilise `actions/attest`**.

```yaml
permissions:
  id-token: write            # mint du token OIDC pour le certificat Sigstore
  attestations: write        # persistance de l'attestation
  artifact-metadata: write   # enregistrement de stockage de l'artefact

steps:
  - uses: actions/attest@v4
    with:
      subject-path: dist/app.tar.gz
```

Sans `sbom-path` ni input de prédicat, l'action génère automatiquement une **provenance SLSA**.
Fournir `sbom-path` bascule en mode SBOM (SPDX ou CycloneDX), fournir `predicate-type` en mode
custom.

### Ce que la provenance ne prouve pas

Une provenance SLSA atteste qu'un artefact a été produit par un run donné, d'un dépôt donné. Elle
**n'atteste pas** que ce workflow était autorisé à produire une release, qu'il tournait depuis une
branche protégée, ni que le commit déclencheur était légitime. Un attaquant capable de déclencher
le workflow de build obtient une provenance parfaitement valide. La provenance complète les
contrôles d'accès, elle ne les remplace pas.

---

## 6. Le cache comme frontière de confiance

Le cache Actions est un canal d'écriture partagé entre workflows du même dépôt. C'est donc un
chemin d'escalade : un trigger peu privilégié qui peut écrire dans le scope de cache de la branche
par défaut empoisonne les entrées que les workflows de release privilégiés vont restaurer. Le code
malveillant n'entre jamais par le dépôt — il entre par le cache.

D'où la restriction en vigueur : les triggers considérés comme non fiables reçoivent un token de
cache **en lecture seule** sur le scope de la branche par défaut.

| Accès | Triggers |
|---|---|
| **Read-write conservé** | `push`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`, et tout trigger dont le scope de cache n'est pas la branche par défaut (`pull_request`, `release`) |
| **Read-only** | `pull_request_target`, `issue_comment`, cascades `workflow_run` issues d'une PR de fork, et tout trigger sans accès en écriture au dépôt |

**L'échec est silencieux** : `actions/cache` logue un avertissement et le job continue sans
sauvegarder. Les *restores* ne sont pas affectés. Conséquence opérationnelle et pattern de
contournement : voir `optimization.md` §2.

---

## 7. Triggers dangereux

`pull_request_target` et `workflow_run` s'exécutent dans le contexte du dépôt de base, avec accès
aux secrets, alors qu'ils sont déclenchés par du contenu issu d'un fork. C'est la faille dite
*pwn request*.

Usages acceptables : labelliser, commenter, trier — rien qui exécute le code de la PR.

```yaml
# OK : aucun checkout du code de la PR
on:
  pull_request_target:
    types: [opened]
permissions:
  pull-requests: write
```

Le garde-fou est désormais dans l'action : depuis sa v7, `actions/checkout` refuse de récupérer le
code d'une PR de fork sous ces deux triggers, protection rétroportée aux majeures supportées.
Détail et opt-out : `github-actions.md` §2.

**Runners self-hosted et PR de fork** : un runner self-hosted est persistant. Du code de fork qui
s'y exécute peut lire ce que le run précédent a laissé, et se maintenir entre les jobs. Ne jamais
exposer un runner self-hosted à des PR de fork sur un dépôt public.

---

## 8. Entrées non fiables et injection

Toute valeur contrôlée par un utilisateur interpolée dans un `run:` est une exécution de shell
arbitraire.

```yaml
# ❌ injection : le titre de PR est du code
- run: echo "Titre : ${{ github.event.pull_request.title }}"

# ✅ passage par une variable d'environnement
- env:
    PR_TITLE: ${{ github.event.pull_request.title }}
  run: echo "Titre : $PR_TITLE"
```

Contextes à traiter comme hostiles : titre et corps de PR ou d'issue, nom de branche, message de
commit, nom d'auteur, label, nom de review, contenu de commentaire. La règle est simple :
**jamais d'interpolation `${{ }}` d'une valeur externe directement dans un `run:`** — toujours via
`env:`, où le shell la traite comme une donnée et non comme du code. `zizmor` détecte ce motif.

---

## 9. SAST, SCA, secret scanning

| Contrôle | Outil | Politique de blocage |
|---|---|---|
| SAST code applicatif | CodeQL (`github/codeql-action@v4`) | Bloquant sur `high` et `critical`, annotation sinon |
| Revue de dépendances sur PR | `actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294` (v5.0.0) | Bloquant sur une licence interdite ou une CVE `high`+ |
| Vulnérabilités d'image | `aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25` (v0.36.0) | Bloquant sur `critical` uniquement — sinon le bruit des CVE de base image paralyse le pipeline |
| Fuite de secrets | Secret scanning + push protection (réglage du dépôt, pas un job) | Bloquant au push |
| Sécurité des workflows | `actionlint` + `zizmor` (§2) | Bloquant sur les findings de sévérité haute |

Le choix de ce qui bloque compte plus que la liste des outils. Un scanner qui remonte 400 findings
non bloquants ne protège personne : il apprend à l'équipe à ignorer les alertes. Mieux vaut deux
contrôles bloquants respectés que six décoratifs.

---

## 10. Contrôles au niveau organisation

Deux leviers hors workflow, à mentionner en audit quand le dépôt appartient à une organisation.

**Action allowlisting** — restreindre les actions et workflows réutilisables autorisés, au niveau
organisation ou dépôt. Disponible sur tous les plans. C'est la défense la plus efficace contre
l'introduction d'une action tierce arbitraire par une PR.

**Workflow execution protections** *(public preview)* — section « Policies » des réglages Actions,
applicable au niveau enterprise, organisation ou dépôt :

- *Actor rules* : qui peut déclencher les workflows — utilisateurs nommés, rôles de dépôt (Read,
  Maintain, Admin), GitHub Apps, Copilot, Dependabot. Le défaut actuel laisse tout utilisateur
  disposant d'un accès en écriture déclencher les workflows.
- *Event rules* : quels événements sont autorisés — `push`, `pull_request`, `pull_request_target`,
  `workflow_dispatch`.

Un mode évaluation permet de visualiser ce qui *serait* bloqué avant d'activer les règles. Le
recommander systématiquement : activer ces règles à l'aveugle sur un dépôt actif casse des
workflows légitimes.

---

## 11. Secret managers externes

GitHub Secrets convient aux credentials **CI** (token de plateforme, registry, FTP, GPG, webhook).
Pour les secrets **applicatifs** (clés d'API métier, credentials de base, clés de chiffrement), un
secret manager externe apporte la rotation centralisée, l'audit trail, le partage hors GitHub
(postes de dev, mobile, autre CI) et un scoping fin.

### 1Password Connect

```yaml
- name: Load secrets from 1Password
  id: op
  uses: 1Password/load-secrets-action@70062d7a876d3eb6334754fa26efd2fbd90c32f2 # v5.0.1
  env:
    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
    FIREBASE_API_KEY: op://prod_env_front/firebase_api_key/password
    API_TOKEN:        op://prod_env_front/api_token/password
  with:
    export-env: false     # défaut ; garde les secrets hors de $GITHUB_ENV
    version: '2.39.0'     # sinon 'latest' : un CLI non épinglé qui manipule des secrets

- name: Build
  env:
    FIREBASE_API_KEY: ${{ steps.op.outputs.FIREBASE_API_KEY }}
    API_TOKEN:        ${{ steps.op.outputs.API_TOKEN }}
  run: pnpm build
```

L'input `version` mérite d'être posé : son défaut est `latest`, donc l'action installe un CLI
1Password dont la version change sans prévenir — un outil non épinglé au milieu d'un pipeline
qui manipule des secrets. `zizmor` le signale via son audit `unpinned-tools`.

Préférer un littéral à une expression : `version: ${{ vars.OP_CLI_VERSION }}` reste signalé,
parce qu'un analyseur statique ne peut pas savoir ce que la variable contient. Le versionnage
du CLI se suit sur les notes de version de 1Password ; Dependabot ne couvre pas cet input.

Côté 1Password : un *Service Account* en lecture seule sur le vault concerné, son token dans
`OP_SERVICE_ACCOUNT_TOKEN`.

> `export-env: true` injecte les secrets dans `$GITHUB_ENV`, donc dans tous les steps suivants,
> y compris ceux qui n'en ont pas besoin. `export-env: false` est le défaut de l'action et le bon
> réglage : scoper via `outputs` step par step.

### HashiCorp Vault

```yaml
- uses: hashicorp/vault-action@892a26828f195e65540a40b4768ae4571f51ebfc # v4.0.0
  with:
    url: https://vault.example.com
    method: jwt                    # auth OIDC : aucun token longue durée côté GitHub
    role: gha-prod-deploy
    secrets: |
      secret/data/prod/firebase api_key | FIREBASE_API_KEY ;
      secret/data/prod/api token        | API_TOKEN
```

`method: jwt` fait valider le JWT GitHub par Vault, qui émet des secrets à durée de vie courte.
Nettement préférable à `method: token`, qui réintroduit un secret longue durée.

### Doppler

```yaml
- uses: dopplerhq/cli-action@4819d808ab99e5cde19a0637a16536a4038fad73 # v4
- env:
    DOPPLER_TOKEN: ${{ secrets.DOPPLER_SERVICE_TOKEN }}
  run: doppler run -- pnpm build
```

`doppler run` injecte toutes les variables du projet dans l'environnement du process : commode,
moins granulaire que les deux approches ci-dessus.

### Quand ça vaut le coup

| Contexte | Recommandation |
|---|---|
| < 5 secrets applicatifs, une seule équipe | GitHub Secrets suffit |
| 5 à 20 secrets, rotation occasionnelle | Les deux se défendent |
| > 20 secrets, plusieurs équipes, rotation fréquente | Secret manager **fortement recommandé** |
| Mêmes secrets sous des noms différents par environnement | Secret manager, ou Environment Secrets |
| Conformité avec audit trail exigé (SOC 2, ISO 27001) | Secret manager |

### Anti-pattern : le préfixe par environnement

```yaml
# ❌ un secret par environnement, multiplié par le nombre de variables
env:
  FIREBASE_API_KEY_PROD:    ${{ secrets.FIREBASE_API_KEY_PROD }}
  FIREBASE_API_KEY_PREPROD: ${{ secrets.FIREBASE_API_KEY_PREPROD }}
  FIREBASE_API_KEY_STAGING: ${{ secrets.FIREBASE_API_KEY_STAGING }}
```

Utiliser des **Environment Secrets** GitHub — chaque environnement porte son jeu sous le *même*
nom — ou un secret manager avec un scoping par vault. Au-delà de 10 secrets applicatifs dans
`secrets.*`, proposer la migration en **P2**.

---

## 12. Checklist P0

À passer avant de valider tout workflow qui touche à un secret ou à un déploiement.

- [ ] Aucun secret, token ni identifiant en clair
- [ ] Aucune interpolation `${{ }}` d'une valeur externe dans un `run:`
- [ ] Aucun `${{ secrets.X }}` dans un `if:`
- [ ] `permissions:` déclaré, et minimal par job
- [ ] Aucun checkout de code de fork sous `pull_request_target` ou `workflow_run`
- [ ] Aucun `allow-unsafe-pr-checkout` sans justification écrite
- [ ] Actions tierces épinglées au SHA, et `dependabot.yml` présent
- [ ] `persist-credentials: false` sauf si un push est nécessaire
- [ ] Déploiement en transport chiffré (jamais de FTP en clair)
- [ ] Aucun `.git`, `.github`, `.env*` ni `node_modules` poussé vers la cible
- [ ] `actionlint` et `zizmor` passent
