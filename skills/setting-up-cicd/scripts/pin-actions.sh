#!/usr/bin/env bash
#
# pin-actions.sh — épingle les actions d'un workflow au SHA de commit de leur tag.
#
# Applique la politique du skill : `actions/*` et `github/*` restent au tag majeur flottant,
# tout le reste — `docker/*` inclus — passe au SHA complet suivi de `# <tag>`.
#
# Fichiers traités : `.github/workflows/*.y{a,}ml`, les actions composites
# `.github/actions/**/action.y{a,}ml`, et `action.y{a,}ml` à la racine du dépôt.
#
# Usage :
#   ./pin-actions.sh [options]
#
# Options :
#   --repo CHEMIN        Dépôt à traiter (défaut : répertoire courant)
#   --apply              Écrit les modifications. SANS cette option, rien n'est modifié.
#   --all                Épingle aussi actions/* et github/* (par défaut : exclues)
#   --allow-dirty        Autorise --apply sur un arbre de travail non committé (déconseillé)
#   -h, --help           Cette aide
#
# Comportement par défaut : DRY-RUN. Le script affiche le diff qu'il produirait et sort.
# Montrer ce diff et obtenir un accord explicite avant de relancer avec --apply.
#
# Ce qui est préservé : fins de ligne CRLF, guillemets autour de la référence, et tout
# commentaire en fin de ligne (seul un numéro de version en tête est remplacé par le tag).
#
# Prérequis : `gh` authentifié (`gh auth status`).
#
# Codes de sortie :
#   0  rien à épingler, ou modifications appliquées
#   1  des épinglages sont proposés (dry-run) — c'est un résultat, pas une erreur
#   2  erreur d'usage, prérequis manquant, ou arbre de travail sale
#
set -uo pipefail

REPO="."
APPLY=0
INCLUDE_OFFICIAL=0
ALLOW_DIRTY=0

die() { printf 'pin-actions: %s\n' "$1" >&2; exit 2; }
usage() { sed -n '2,/^set -uo/p' "$0" | sed 's/^# \{0,1\}//; $d'; }

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)     usage; exit 0 ;;
    --repo)        REPO="${2:-}"; [ -n "$REPO" ] || die "--repo attend un chemin"; shift 2 ;;
    --apply)       APPLY=1; shift ;;
    --all)         INCLUDE_OFFICIAL=1; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    *)             die "option inconnue : $1" ;;
  esac
done

command -v gh >/dev/null 2>&1 || die "gh introuvable. Installer GitHub CLI."
gh auth status >/dev/null 2>&1 || die "gh non authentifié. Lancer : gh auth login"

[ -d "$REPO" ] || die "dépôt introuvable : $REPO"
REPO=$(cd "$REPO" && pwd)

TMP=$(mktemp -d) || die "impossible de créer un répertoire temporaire"
trap 'rm -rf "$TMP"' EXIT

FILES="$TMP/files"
{
  [ -d "$REPO/.github/workflows" ] && \
    find "$REPO/.github/workflows" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \)
  [ -d "$REPO/.github/actions" ] && \
    find "$REPO/.github/actions" -type f \( -name 'action.yml' -o -name 'action.yaml' \)
  find "$REPO" -maxdepth 1 -type f \( -name 'action.yml' -o -name 'action.yaml' \)
} 2>/dev/null | sort > "$FILES"

if [ ! -s "$FILES" ]; then
  printf 'Aucun workflow ni action composite — rien à faire.\n'; exit 0
fi

# --- Garde-fou : pas de réécriture sans point de retour -----------------------
if [ "$APPLY" -eq 1 ] && [ "$ALLOW_DIRTY" -eq 0 ]; then
  if ! git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    die "pas un dépôt git : aucun point de retour. Utiliser --allow-dirty en connaissance de cause."
  fi
  if [ -n "$(git -C "$REPO" status --porcelain -- .github/workflows .github/actions action.yml action.yaml)" ]; then
    die "des fichiers à traiter ont des modifications non committées. Committer d'abord, ou --allow-dirty."
  fi
fi

# --- Le ref est-il un tag, ou une branche ? -----------------------------------
# Un SHA issu d'une branche est bien immuable, mais le commentaire « # main » se lirait
# comme une version alors qu'il n'en est pas une. On le signale au lieu de le maquiller.
is_tag() {        # $1 = owner/repo, $2 = ref
  local slug="$1" ref="$2" cache="$TMP/tags-${1//\//__}"
  if [ ! -f "$cache" ]; then
    gh api "repos/$slug/git/refs/tags" --paginate --jq '.[].ref' 2>/dev/null \
      | sed 's|refs/tags/||' > "$cache" || : > "$cache"
  fi
  grep -Fxq -- "$ref" "$cache"
}

# --- Résolution ref -> SHA, avec mémoïsation ---------------------------------
resolve_sha() {   # $1 = owner/repo, $2 = ref
  local cache="$TMP/sha-${1//\//__}-${2//\//__}" sha
  if [ -f "$cache" ]; then cat "$cache"; return 0; fi
  sha=$(gh api "repos/$1/commits/$2" --jq '.sha' 2>/dev/null)
  [[ $sha =~ ^[0-9a-f]{40}$ ]] || sha=""
  printf '%s' "$sha" > "$cache"
  printf '%s' "$sha"
}

trim() { local s="$1"; s="${s#"${s%%[![:space:]]*}"}"; printf '%s' "${s%"${s##*[![:space:]]}"}"; }

# Commentaire d'origine à conserver après le tag : on retire seulement un numéro de version
# en tête (« # v4.2.0 # Requis » -> « Requis »), et le ref lui-même s'il était recopié.
kept_comment() {  # $1 = commentaire d'origine (avec son #), $2 = ref
  local c ver_re='^v?[0-9][^[:space:]]*'
  c=$(trim "$1"); c=$(trim "${c#\#}")
  [[ $c =~ $ver_re ]] && c=$(trim "${c:${#BASH_REMATCH[0]}}")
  c=$(trim "${c#\#}")
  [ "$c" = "$2" ] && c=""
  [ -n "$c" ] && printf ' # %s' "$c"
}

QC=\[\"\'\]
RE="^([[:space:]]*-?[[:space:]]*uses:[[:space:]]*)(${QC}?)([A-Za-z0-9._-]+/[A-Za-z0-9._/-]+)@([^[:space:]#\"']+)(${QC}?)([[:space:]]*#.*)?\$"
USES_RE='^[[:space:]]*-?[[:space:]]*uses:[[:space:]]*(.*)$'

total=0; pinned=0; skipped=0; failed=0; branch_refs=0; unparsed=0; n=0

printf '=== pin-actions — %s ===\n' "$REPO"
if [ "$APPLY" -eq 1 ]; then
  printf 'Mode : APPLY (les fichiers seront modifiés)\n\n'
else
  printf 'Mode : DRY-RUN (aucune modification)\n\n'
fi

while IFS= read -r file; do
  n=$((n + 1))
  out="$TMP/out-$n"
  rel="${file#"$REPO"/}"
  : > "$out"
  changed=0

  while IFS= read -r line || [ -n "$line" ]; do
    # CRLF : on retire le \r pour l'analyse et on le restitue à l'écriture
    eol=""
    if [[ $line == *$'\r' ]]; then eol=$'\r'; line="${line%$'\r'}"; fi

    if [[ $line =~ $RE ]]; then
      prefix="${BASH_REMATCH[1]}"
      q1="${BASH_REMATCH[2]}"
      path="${BASH_REMATCH[3]}"
      ref="${BASH_REMATCH[4]}"
      q2="${BASH_REMATCH[5]}"
      old_comment="${BASH_REMATCH[6]}"
      total=$((total + 1))

      owner="${path%%/*}"
      rest="${path#*/}"
      slug="$owner/${rest%%/*}"

      # Déjà épinglé : 40 caractères hexadécimaux
      if [[ $ref =~ ^[0-9a-f]{40}$ ]]; then
        skipped=$((skipped + 1)); printf '%s%s\n' "$line" "$eol" >> "$out"; continue
      fi
      # Politique : actions/* et github/* restent au tag majeur, sauf --all
      if [ "$INCLUDE_OFFICIAL" -eq 0 ] && { [ "$owner" = "actions" ] || [ "$owner" = "github" ]; }; then
        skipped=$((skipped + 1)); printf '%s%s\n' "$line" "$eol" >> "$out"; continue
      fi

      sha=$(resolve_sha "$slug" "$ref")
      if [ -z "$sha" ]; then
        printf '  ECHEC   %s: %s@%s — ref introuvable ou dépôt inaccessible\n' "$rel" "$path" "$ref" >&2
        failed=$((failed + 1)); printf '%s%s\n' "$line" "$eol" >> "$out"; continue
      fi

      if is_tag "$slug" "$ref"; then
        comment="$ref"; note=""
      else
        comment="$ref (branche)"
        note="  <-- BRANCHE, pas un tag de release : remplacer par un tag versionné"
        branch_refs=$((branch_refs + 1))
      fi

      printf '%s%s%s@%s%s # %s%s%s\n' "$prefix" "$q1" "$path" "$sha" "$q2" "$comment" \
        "$(kept_comment "$old_comment" "$ref")" "$eol" >> "$out"
      printf '  %-44s -> %s # %s%s\n' "$path@$ref" "${sha:0:12}..." "$comment" "$note"
      pinned=$((pinned + 1)); changed=1
    else
      # Une ligne `uses:` distante non reconnue ne doit pas disparaître du bilan
      if [[ $line =~ $USES_RE ]]; then
        value="${BASH_REMATCH[1]}"; value="${value#[\"\']}"
        case "$value" in
          ./*|docker://*|'#'*|'') ;;
          *) printf '  NON ANALYSÉE  %s: %s\n' "$rel" "$(trim "$line")" >&2
             unparsed=$((unparsed + 1)) ;;
        esac
      fi
      printf '%s%s\n' "$line" "$eol" >> "$out"
    fi
  done < "$file"

  if [ "$changed" -eq 1 ]; then
    if [ "$APPLY" -eq 1 ]; then
      cp "$out" "$file"
    else
      printf '\n--- %s\n' "$rel"; diff -u "$file" "$out" | sed '1,2d'; printf '\n'
    fi
  fi
done < "$FILES"

printf '\n=== Bilan ===\n'
printf 'fichiers analysés      : %d\n' "$n"
printf 'références analysées   : %d\n' "$total"
printf 'à épingler             : %d\n' "$pinned"
printf 'ignorées (politique)   : %d\n' "$skipped"
printf 'échecs de résolution   : %d\n' "$failed"
if [ "$unparsed" -gt 0 ]; then
  printf 'NON ANALYSÉES          : %d - syntaxe non reconnue, à traiter à la main\n' "$unparsed"
fi
if [ "$branch_refs" -gt 0 ]; then
  printf "dont refs de branche   : %d - un SHA de branche est immuable, mais ce n'est pas une version" "$branch_refs"
  printf "\n"
fi

if [ "$pinned" -eq 0 ]; then
  printf '\nRien à épingler.\n'; exit 0
fi
if [ "$APPLY" -eq 1 ]; then
  printf '\nModifications appliquées. Relire le diff git avant de committer.\n'
  printf 'Ne pas oublier .github/dependabot.yml : un SHA sans Dependabot fige les vulnérabilités.\n'
  exit 0
fi
printf '\nDRY-RUN : aucun fichier modifié. Relancer avec --apply après validation du diff.\n'
exit 1
