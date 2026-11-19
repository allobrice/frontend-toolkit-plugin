# Release & Delivery — Reference

> Ce qui se passe autour du déploiement : vérification post-deploy, rollback, stratégies
> progressives, notifications. Lue dès qu'un workflow déploie quelque chose.

**Sources externes utilisées dans ce fichier**

- <https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/>
- <https://github.com/slackapi/slack-github-action> (inputs v4)

## Sommaire

1. Smoke test post-déploiement
2. Rollback selon la cible
3. Rollback manuel déclenchable
4. Stratégies progressives — et quand elles ne servent à rien
5. Notifications Teams
6. Notifications Slack
7. Notifications Discord
8. Résumé de run

---

## 1. Smoke test post-déploiement

Un déploiement qui se termine « en vert » sans qu'une seule requête ait touché l'application ne
prouve rien : il prouve que le transfert de fichiers a réussi. Le smoke test est ce qui transforme
« déployé » en « fonctionne ».

C'est aussi le prérequis de tout rollback automatique : sans signal d'échec, rien à quoi réagir.

```yaml
- name: Smoke test
  env:
    VERIFY_URL: ${{ inputs.verify_url }}
  run: |
    set -euo pipefail
    for attempt in 1 2 3 4 5; do
      code=$(curl -sS -o /tmp/body -w '%{http_code}' --max-time 10 "$VERIFY_URL/health" || echo 000)
      if [ "$code" = "200" ]; then
        echo "OK au bout de $attempt tentative(s)"
        exit 0
      fi
      echo "Tentative $attempt : HTTP $code"
      sleep $((attempt * 5))     # backoff : 5s, 10s, 15s, 20s
    done
    echo "::error::Smoke test échoué après 5 tentatives sur $VERIFY_URL/health"
    cat /tmp/body || true
    exit 1
```

Trois choix à expliquer :

- **Le backoff progressif** couvre le démarrage de l'application (pool de connexions, cache à
  chaud) sans masquer une panne réelle derrière une attente fixe trop longue.
- **`exit 1` en fin de boucle** : le job doit échouer. Un smoke test qui logue sans faire échouer
  le job est de la décoration.
- **Un endpoint `/health` dédié**, pas la page d'accueil : une home page peut répondre 200 depuis
  un cache CDN alors que l'application est morte. Le health check doit toucher les dépendances
  critiques (base, cache) et n'être pas mis en cache.

`architecture-patterns.md` définit déjà un input `verify_url` sur le workflow réutilisable : c'est
ici qu'il se consomme. Déploiement sans smoke test → **P1**.

---

## 2. Rollback selon la cible

Trois mécanismes, selon la nature de la cible. Le point commun : **le rollback doit être préparé
avant l'incident**, pas improvisé pendant.

### Hébergement fichier (FTPS, rsync) — symlink de release

Le pattern de `deploy-targets.md` §7 crée une release horodatée et bascule un symlink. Il conserve
les cinq dernières : le rollback consiste à repointer le symlink, sans rien retransférer.

```yaml
rollback:
  runs-on: ubuntu-latest
  timeout-minutes: 10
  permissions:
    contents: read
  steps:
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

    - name: Basculer sur la release précédente
      env:
        SSH_TARGET: ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}
      run: |
        ssh "$SSH_TARGET" bash -se <<'REMOTE'
        set -euo pipefail
        current=$(readlink -f /var/www/current)
        previous=$(ls -1dt /var/www/releases/* | grep -v "^$current$" | head -1)
        [ -n "$previous" ] || { echo "Aucune release précédente"; exit 1; }
        ln -sfn "$previous" /var/www/current.tmp
        mv -Tf /var/www/current.tmp /var/www/current   # bascule atomique
        echo "Rollback vers $previous"
        REMOTE
```

`mv -Tf` sur un symlink est atomique : aucune fenêtre où `current` n'existe pas. Un
`rm` suivi d'un `ln` ne l'est pas.

### Conteneurs — re-tag d'une image immuable

Si chaque build pousse une image taguée par SHA de commit, le rollback est un redéploiement d'un
tag antérieur. Aucun rebuild, donc aucun risque de rebâtir autre chose.

```yaml
- name: Rollback vers un SHA connu
  env:
    IMAGE: ghcr.io/${{ github.repository }}
    TARGET_SHA: ${{ inputs.rollback_to }}
  run: |
    docker pull "$IMAGE:$TARGET_SHA"          # échoue tôt si le tag n'existe pas
    kubectl set image deployment/app "app=$IMAGE:$TARGET_SHA"
    kubectl rollout status deployment/app --timeout=120s
```

Corollaire : **ne jamais déployer `latest` en production.** Un tag mobile rend le rollback
impossible, puisqu'il n'existe plus de désignation stable de « la version d'avant ».

### PaaS — rollback natif

Vercel et Netlify conservent les déploiements précédents et savent réattribuer l'alias de
production. C'est le mécanisme à privilégier plutôt que de rejouer un ancien commit : rejouer un
build peut produire un artefact différent (dépendances flottantes, date de build).

Vérifier la commande exacte dans la CLI de la plateforme au moment de l'écrire — c'est la partie
la plus volatile de ce fichier.

---

## 3. Rollback manuel déclenchable

Un rollback automatique ne couvre pas tous les cas : une régression fonctionnelle détectée une
heure après le déploiement ne déclenche aucun signal technique. Il faut donc un chemin manuel,
tracé et rapide.

```yaml
name: Rollback production

on:
  workflow_dispatch:
    inputs:
      target:
        description: 'SHA, tag d''image, ou "previous"'
        type: string
        required: true
      reason:
        description: 'Motif — apparaît dans le journal de déploiement'
        type: string
        required: true

concurrency:
  group: prod_deployment      # même groupe que le déploiement : jamais les deux en même temps
  cancel-in-progress: false
  queue: max

permissions: {}

jobs:
  rollback:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    environment:
      name: production        # conserve les gates d'approbation
    steps:
      - name: Journaliser
        env:
          TARGET: ${{ inputs.target }}
          REASON: ${{ inputs.reason }}
          ACTOR: ${{ github.actor }}
        run: |
          {
            echo "## Rollback production"
            echo "- Cible : \`$TARGET\`"
            echo "- Motif : $REASON"
            echo "- Déclenché par : $ACTOR"
          } >> "$GITHUB_STEP_SUMMARY"
      # …puis le mécanisme de la §2 correspondant à la cible
```

Deux points structurants : **le même groupe de `concurrency` que le déploiement normal**, sinon un
rollback et un déploiement peuvent se croiser ; et le maintien de `environment:`, pour que le
rollback reste tracé dans l'onglet Deployments. Le `reason` obligatoire coûte cinq secondes et
fait toute la valeur du journal en post-mortem.

Déploiement sans mécanisme de rollback documenté → **P1**, avec l'impact DORA correspondant :
MTTR non maîtrisé.

---

## 4. Stratégies progressives — et quand elles ne servent à rien

| Stratégie | Principe | Prérequis réel |
|---|---|---|
| **Blue/green** | Deux environnements complets, bascule atomique du trafic | Un répartiteur de charge, ou un routeur applicatif. Double l'infrastructure |
| **Canary** | 5-10 % du trafic sur la nouvelle version, observation, puis généralisation | Répartition pondérée **et** métriques par version, sinon on ne mesure rien |
| **Dark launch / feature flags** | Le code est déployé, la fonctionnalité reste inactive | Un système de flags, et une discipline de nettoyage des flags morts |
| **A/B testing** | Comparaison de variantes par segment d'utilisateurs | Infrastructure d'analytics — c'est du produit, pas du déploiement |

### Le critère de choix

Ces stratégies répondent à une question précise : *« comment limiter le nombre d'utilisateurs
exposés à une régression avant de la détecter ? »* Elles n'ont d'intérêt que si le rollback est
plus lent que la détection.

- **Rollback en moins d'une minute** (symlink, re-tag d'image) : blue/green et canary
  n'apportent presque rien. Un rollback rapide *est* la stratégie. Investir plutôt dans le smoke
  test et l'observabilité.
- **Rollback lent ou irréversible** (migration de schéma, cache à reconstruire, données déjà
  écrites) : la progressivité devient le seul filet.
- **Feature flags** : le seul de la liste qui garde de la valeur même avec un rollback rapide,
  parce qu'il découple *déployer* de *activer*. C'est aussi le seul qui ne dépend pas de
  l'infrastructure — donc le seul pertinent sur un hébergement mutualisé.

Sur du FTPS mutualisé ou du Vercel, **proposer blue/green ou canary est un mauvais conseil** :
le prérequis d'infrastructure n'existe pas, et le symlink atomique ou le rollback natif couvre déjà
le besoin. Proposer des feature flags, oui.

### La migration de base est le vrai sujet

Aucune stratégie de déploiement ne rattrape une migration destructive : le code revient en arrière,
les données non. La règle qui rend le rollback réellement possible est la **compatibilité
ascendante des migrations** — ajouter avant de lire, arrêter de lire avant de supprimer, en trois
déploiements distincts. C'est une contrainte de conception, pas de YAML, mais c'est ce qui décide
si le rollback marche.

---

## 5. Notifications Teams

### ⚠️ Les connecteurs Office 365 ne fonctionnent plus

Microsoft a **définitivement désactivé** les connecteurs Office 365 de Teams, avec un déploiement
de la désactivation **du 18 au 22 mai 2026**, et une date limite de migration au **18 mai 2026**.

Conséquence directe : tout pattern reposant sur une URL de connecteur — typiquement en
`*.webhook.office.com` — est **mort**. Ne jamais en produire, et le signaler comme cassé en audit.

Le remplacement est un webhook **Power Automate Workflows** (URL en `api.powerautomate.com`,
`api.powerplatform.com` ou `flow.microsoft.com`), créé depuis l'application *Workflows* dans Teams.

### Deux limites à connaître

- Les payloads **MessageCard** sont acceptés par les webhooks Workflows sans reformatage, **mais le
  rendu interactif des boutons ne l'est pas**. Toute carte comportant des boutons ou des champs de
  saisie doit être une **Adaptive Card**.
- L'icône et le nom de bot personnalisés ne sont pas disponibles via webhook : les messages
  s'affichent sous l'identité du bot Workflows.

```yaml
notify-failure:
  needs: [build, deploy]
  if: failure()
  runs-on: ubuntu-latest
  timeout-minutes: 5
  permissions: {}
  steps:
    - name: Notifier Teams
      env:
        TEAMS_WEBHOOK: ${{ secrets.TEAMS_WORKFLOW_WEBHOOK }}
        REPO: ${{ github.repository }}
        REF: ${{ github.ref_name }}
        RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
      run: |
        set -euo pipefail
        # jq construit le JSON : aucune valeur externe n'est interpolée dans le shell
        jq -n \
          --arg repo "$REPO" --arg ref "$REF" --arg url "$RUN_URL" \
          '{
            type: "message",
            attachments: [{
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                type: "AdaptiveCard",
                version: "1.5",
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                body: [
                  { type: "TextBlock", size: "Medium", weight: "Bolder",
                    text: "Échec de déploiement", color: "Attention" },
                  { type: "FactSet", facts: [
                      { title: "Dépôt", value: $repo },
                      { title: "Branche", value: $ref }
                  ]}
                ],
                actions: [
                  { type: "Action.OpenUrl", title: "Voir le run", url: $url }
                ]
              }
            }]
          }' > payload.json

        curl -sS --fail-with-body -X POST \
          -H 'Content-Type: application/json' \
          --data @payload.json "$TEAMS_WEBHOOK"
```

Construire le JSON avec `jq --arg` plutôt qu'avec un `printf` interpolé n'est pas un détail de
style : un nom de branche contenant un guillemet casserait un payload assemblé à la main, et une
valeur contrôlée par un tiers y serait une injection. Même logique que
`security-supply-chain.md` §8.

---

## 6. Notifications Slack

`slackapi/slack-github-action` est en **v4**, avec des changements incompatibles entre v2, v3 et
v4. Un exemple v1 ou v2 trouvé ailleurs ne fonctionnera pas : `webhook-type` est devenu un input à
part entière.

```yaml
- name: Notifier Slack
  uses: slackapi/slack-github-action@dcb1066f776dd043e64d0e8ba94ca15cc7e1875d # v4.0.0
  with:
    webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
    webhook-type: incoming-webhook
    payload: |
      text: "Échec du déploiement sur ${{ github.ref_name }}"
      blocks:
        - type: section
          text:
            type: mrkdwn
            text: "*Échec de déploiement*\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|Voir le run>"
```

| Input | Rôle |
|---|---|
| `webhook` + `webhook-type: incoming-webhook` | Poster un message via un webhook entrant |
| `webhook` + `webhook-type: webhook-trigger` | Déclencher un workflow Slack (Workflow Builder) |
| `method` + `token` | Appeler une méthode de l'API Slack — nécessaire pour répondre en thread ou mettre à jour un message |
| `errors: true` | Fait échouer le step si Slack renvoie une erreur. Le défaut est `false` : la notification échoue en silence |

`errors: true` mérite d'être posé sciemment. Par défaut, une notification qui n'arrive pas ne
casse rien — ce qui est raisonnable pour une alerte, mais signifie qu'on peut perdre des
notifications sans le savoir.

---

## 7. Notifications Discord

Un webhook Discord suffit, aucune action nécessaire.

```yaml
- name: Notifier Discord
  env:
    DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK }}
    REF: ${{ github.ref_name }}
    RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
  run: |
    set -euo pipefail
    jq -n --arg ref "$REF" --arg url "$RUN_URL" \
      '{ content: ("Échec de déploiement sur `" + $ref + "` — " + $url) }' \
      | curl -sS --fail-with-body -X POST -H 'Content-Type: application/json' -d @- "$DISCORD_WEBHOOK"
```

---

## 8. Résumé de run

Avant d'ajouter une notification externe, poser la question : est-ce qu'un
`$GITHUB_STEP_SUMMARY` suffirait ? Il est gratuit, ne nécessite aucun secret, aucune action
tierce, et s'affiche sur la page du run.

```yaml
- name: Résumé de déploiement
  if: always()
  env:
    ENV_NAME: ${{ inputs.environment_name }}
    VERIFY_URL: ${{ inputs.verify_url }}
  run: |
    {
      echo "## Déploiement — $ENV_NAME"
      echo ""
      echo "| Élément | Valeur |"
      echo "|---|---|"
      echo "| Statut | ${{ job.status }} |"
      echo "| Commit | \`${GITHUB_SHA::7}\` |"
      echo "| URL | $VERIFY_URL |"
    } >> "$GITHUB_STEP_SUMMARY"
```

La règle : le résumé de run pour ce qu'on consulte *après coup*, la notification pour ce qui doit
*interrompre* quelqu'un. Notifier chaque succès entraîne l'équipe à filtrer le canal, et l'échec
qui compte se noie avec le reste. Réserver les notifications à `if: failure()`, et éventuellement
aux déploiements de production réussis.
