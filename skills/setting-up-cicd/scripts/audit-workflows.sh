#!/usr/bin/env bash
#
# audit-workflows.sh — lance actionlint puis zizmor sur les workflows d'un dépôt.
#
# Sert à sortir les findings mécaniques d'un audit CI/CD avant toute lecture manuelle :
# syntaxe et expressions (actionlint), sécurité (zizmor). Ce que ces outils trouvent n'a pas
# à être cherché à l'œil ; ce qu'ils ne voient pas — architecture, pertinence des
# environnements, adéquation métier — reste à analyser.
#
# Usage :
#   ./audit-workflows.sh [CHEMIN_DEPOT] [options]
#
# Options :
#   --sarif DOSSIER   Écrit aussi les résultats zizmor en SARIF dans DOSSIER
#   --persona NOM     Persona zizmor : regular (défaut), pedantic, auditor
#   --skip-actionlint N'exécute que zizmor
#   --skip-zizmor     N'exécute qu'actionlint
#   -h, --help        Cette aide
#
# Périmètre : actionlint lit `.github/workflows/` ; zizmor lit en plus les actions
# composites (`.github/actions/**/action.y{a,}ml`, `action.y{a,}ml` à la racine) et
# `.github/dependabot.yml`.
#
# Résolution des outils, dans l'ordre : binaire local, puis uvx, pipx, docker.
# Le script ne tente aucune installation permanente. Les images docker sont épinglées
# par digest ; surcharger via ACTIONLINT_IMAGE / ZIZMOR_IMAGE pour monter de version.
#
# Codes de sortie :
#   0  aucun finding
#   1  au moins un finding remonté
#   2  erreur d'usage, ou aucun outil disponible
#
set -uo pipefail

REPO="."
SARIF_DIR=""
PERSONA="regular"
RUN_ACTIONLINT=1
RUN_ZIZMOR=1
ACTIONLINT_IMAGE="${ACTIONLINT_IMAGE:-rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667}"
ZIZMOR_IMAGE="${ZIZMOR_IMAGE:-ghcr.io/zizmorcore/zizmor:1.30.1@sha256:a2eb396d886c053073405c7a980f2139ba2248ec172243cfa3841e57196e8101}"

die() { printf 'audit-workflows: %s\n' "$1" >&2; exit 2; }
usage() { sed -n '2,/^set -uo/p' "$0" | sed 's/^# \{0,1\}//; $d'; }

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)        usage; exit 0 ;;
    --sarif)          SARIF_DIR="${2:-}"; [ -n "$SARIF_DIR" ] || die "--sarif attend un dossier"; shift 2 ;;
    --persona)        PERSONA="${2:-}"; [ -n "$PERSONA" ] || die "--persona attend une valeur"; shift 2 ;;
    --skip-actionlint) RUN_ACTIONLINT=0; shift ;;
    --skip-zizmor)    RUN_ZIZMOR=0; shift ;;
    -*)               die "option inconnue : $1" ;;
    *)                REPO="$1"; shift ;;
  esac
done

[ -d "$REPO" ] || die "dépôt introuvable : $REPO"
REPO=$(cd "$REPO" && pwd)
WF_DIR="$REPO/.github/workflows"

WF_COUNT=0
[ -d "$WF_DIR" ] && \
  WF_COUNT=$(find "$WF_DIR" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) | wc -l | tr -d ' ')

# Chemins relatifs au dépôt : ils servent tels quels en local et dans le conteneur (/repo)
ACTION_FILES=()
while IFS= read -r f; do
  ACTION_FILES+=("${f#"$REPO"/}")
done < <({
  [ -d "$REPO/.github/actions" ] && \
    find "$REPO/.github/actions" -type f \( -name 'action.yml' -o -name 'action.yaml' \)
  find "$REPO" -maxdepth 1 -type f \( -name 'action.yml' -o -name 'action.yaml' \)
} 2>/dev/null | sort)

if [ "$WF_COUNT" -eq 0 ] && [ "${#ACTION_FILES[@]}" -eq 0 ]; then
  printf 'Aucun workflow ni action composite dans %s — rien à auditer.\n' "$REPO"
  exit 0
fi

printf '=== Audit des workflows — %s ===\n' "$REPO"
printf '%s fichier(s) de workflow, %s action(s) composite(s)\n\n' "$WF_COUNT" "${#ACTION_FILES[@]}"

# Docker ne comprend pas les chemins MSYS (/tmp/..., /c/...) : `pwd -W` donne le chemin
# Windows reel sous Git Bash. MSYS_NO_PATHCONV empeche la reecriture de la cible /repo.
REPO_HOST=$(cd "$REPO" && { pwd -W 2>/dev/null || pwd; })
docker_run() {
  local env_args=()
  [ -n "${GH_TOKEN:-}" ] && env_args=(-e GH_TOKEN)
  MSYS_NO_PATHCONV=1 docker run --rm "${env_args[@]}" -v "$REPO_HOST:/repo" -w /repo "$@"
}

# actionlint refuse de tourner hors d'un depot git : il localise les workflows depuis la
# racine du projet. Le signaler, plutot que de laisser passer une erreur brute.
IS_GIT=0
git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1 && IS_GIT=1

findings=0
ran_any=0

# ---------------------------------------------------------------- actionlint
if [ "$RUN_ACTIONLINT" -eq 1 ] && [ "$WF_COUNT" -eq 0 ]; then
  printf 'NON EXECUTE : actionlint ne lit que .github/workflows, vide ici.\n\n'
  RUN_ACTIONLINT=0
fi
if [ "$RUN_ACTIONLINT" -eq 1 ]; then
  if [ "$IS_GIT" -eq 0 ]; then
    printf 'NON EXECUTE : actionlint exige un depot git (il localise les workflows depuis la
'
    printf 'racine du projet). Lancer git init sur le dossier, ou pointer un vrai depot.

'
    RUN_ACTIONLINT=0
  fi
fi
if [ "$RUN_ACTIONLINT" -eq 1 ]; then
  printf -- '--- actionlint ---\n'
  if command -v actionlint >/dev/null 2>&1; then
    ( cd "$REPO" && actionlint -color ) || findings=1
    ran_any=1
  elif command -v docker >/dev/null 2>&1; then
    printf '(via docker %s)\n' "${ACTIONLINT_IMAGE%%@*}"
    docker_run "$ACTIONLINT_IMAGE" -color || findings=1
    ran_any=1
  else
    printf 'NON EXÉCUTÉ : ni binaire actionlint, ni docker.\n'
    printf 'Installation : https://github.com/rhysd/actionlint/blob/main/docs/install.md\n'
  fi
  printf '\n'
fi

# ---------------------------------------------------------------- zizmor
if [ "$RUN_ZIZMOR" -eq 1 ]; then
  printf -- '--- zizmor (persona: %s) ---\n' "$PERSONA"
  # zizmor n'execute ses audits en ligne que si un token est disponible ; sinon il
  # bascule hors ligne et desactive une partie des regles, silencieusement.
  Z_ARGS=(--persona "$PERSONA")
  Z_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  if [ -z "$Z_TOKEN" ] && command -v gh >/dev/null 2>&1; then
    Z_TOKEN=$(gh auth token 2>/dev/null || true)
  fi
  if [ -n "$Z_TOKEN" ]; then
    export GH_TOKEN="$Z_TOKEN"
    printf '(audits en ligne actifs)\n'
  else
    printf 'ATTENTION : aucun token, zizmor tourne hors ligne et une partie des audits\n'
    printf "ne sera pas executee. Le mentionner dans le rapport.\n"
  fi
  [ "$WF_COUNT" -gt 0 ] && Z_ARGS+=(.github/workflows)
  [ "${#ACTION_FILES[@]}" -gt 0 ] && Z_ARGS+=("${ACTION_FILES[@]}")
  [ -f "$REPO/.github/dependabot.yml" ] && Z_ARGS+=(.github/dependabot.yml)

  run_zizmor() {  # $@ = préfixe de commande
    ( cd "$REPO" && "$@" "${Z_ARGS[@]}" )
    local rc=$?
    if [ -n "$SARIF_DIR" ]; then
      mkdir -p "$SARIF_DIR"
      ( cd "$REPO" && "$@" --format=sarif "${Z_ARGS[@]}" ) > "$SARIF_DIR/zizmor.sarif" 2>/dev/null \
        && printf 'SARIF écrit : %s/zizmor.sarif\n' "$SARIF_DIR" \
        || printf 'SARIF non généré.\n'
    fi
    return $rc
  }

  if command -v zizmor >/dev/null 2>&1; then
    run_zizmor zizmor || findings=1
    ran_any=1
  elif command -v uvx >/dev/null 2>&1; then
    printf '(via uvx)\n'
    run_zizmor uvx zizmor || findings=1
    ran_any=1
  elif command -v pipx >/dev/null 2>&1; then
    printf '(via pipx)\n'
    run_zizmor pipx run zizmor || findings=1
    ran_any=1
  elif command -v docker >/dev/null 2>&1; then
    printf '(via docker %s)\n' "${ZIZMOR_IMAGE%%@*}"
    run_zizmor docker_run "$ZIZMOR_IMAGE" || findings=1
    ran_any=1
  else
    printf 'NON EXÉCUTÉ : ni zizmor, ni uvx, ni pipx, ni docker.\n'
    printf 'Installation : https://docs.zizmor.sh/installation/\n'
  fi
  printf '\n'
fi

# ---------------------------------------------------------------- verdict
printf '=== Verdict ===\n'
if [ "$ran_any" -eq 0 ]; then
  printf "Aucun outil n'a pu être exécuté. Le mentionner explicitement dans le rapport\n"
  printf 'plutôt que de laisser croire à une couverture complète.\n'
  exit 2
fi
if [ "$findings" -eq 0 ]; then
  printf "Aucun finding mécanique. Passer à l'analyse : architecture, environnements, contexte.\n"
  exit 0
fi
printf 'Findings remontés ci-dessus. Les classer avec le barème de\n'
printf 'references/audit-and-reporting.md avant de rédiger le rapport.\n'
exit 1
