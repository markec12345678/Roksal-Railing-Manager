#!/bin/bash
# qa.sh — R319 — PARAMETRIZIRAN QA DISPATCHER (konsolidacija ~891 skriptov).
# ============================================================================
# PROBLEM (LEKCIJA iz analize R319): scripts/ vsebuje ~891 datotek
# (r121→r317), vsaka runda rodi 5–9 novih (build-needles, run-smoke,
# e2e-browser, prod-qa, …). Ni bilo NOBEGA vstopna točke — katera skripta
# je "trenutna" je bilo implicitno znanje.
#
# REŠITEV: ta dispatcher je ENA vstopna točka. Skripte r121–r317 ostajajo
# ZAMRZNJENI dokazi (kanon: needleji/sestav se nikoli ne brišejo) —
# dispatcher jih le POIŠČE in zažene po rundi + fazi.
#
# UPORABA:
#   scripts/qa.sh list                    # vse runde s štirimi fazami
#   scripts/qa.sh latest                  # številka zadnje runde
#   scripts/qa.sh needles [runda]         # rN-build-needles.sh  (default: latest)
#   scripts/qa.sh smoke   [runda]         # rN-run-smoke.sh      (default: latest)
#   scripts/qa.sh e2e     [runda]         # rN-e2e-browser.sh    (default: latest)
#   scripts/qa.sh prodqa  [runda]         # rN-prod-qa.sh        (default: latest)
#   scripts/qa.sh chain   [runda]         # needles + smoke zaporedno (najhitrejši
#                                         #   lokalni dokaz nove runde)
#
# PRENOSLJIVOST (znani dolg LEKCIJA): starejše skripte hardkodirajo
# /home/z/my-project. Če ta repozitorij NI tam, dispatcher naredi
# TRANSPARENTNO substitucijo v začasni kopiji (sed + obvezen `bash -n`
# sintaksni pregled) — zamrznjeni originali ostanejo NEPOVRNJENI.
#
# FAIL-CLOSED: neznana faza → exit 2; neznana runda/manjkajoča skripta →
# exit 3; substitucija pokvari sintakso → exit 4 (nikoli tiho naprej).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEGACY_ROOT="/home/z/my-project"

# ── Discovery ────────────────────────────────────────────────────────────────

# Zadnja runda = največje rN med rN-build-needles.sh (vsaka runda IMA needles).
latest_round() {
  ls -1 "$REPO/scripts" 2>/dev/null \
    | grep -E '^r[0-9]+-build-needles\.sh$' \
    | sed -E 's/^r([0-9]+)-.*/\1/' \
    | sort -n | tail -1
}

# Preslikava faza → datotečni vzorec (EN VIR: imena po kanonu rund).
script_for() {
  local faza="$1" runda="$2"
  case "$faza" in
    needles) echo "scripts/r${runda}-build-needles.sh" ;;
    smoke)   echo "scripts/r${runda}-run-smoke.sh" ;;
    e2e)     echo "scripts/r${runda}-e2e-browser.sh" ;;
    prodqa)  echo "scripts/r${runda}-prod-qa.sh" ;;
    *)       echo "" ;;
  esac
}

usage() {
  cat <<'EOF'
qa.sh — parametriziran QA dispatcher (R319)

  scripts/qa.sh list                  vse runde s štirimi fazami
  scripts/qa.sh latest                številka zadnje runde
  scripts/qa.sh needles [runda]       build-needleji (regresija builda)
  scripts/qa.sh smoke   [runda]       dimni test standalone :3100
  scripts/qa.sh e2e     [runda]       brskalniški E2E (ŽIVO)
  scripts/qa.sh prodqa  [runda]       produkcijski QA (POST-commit; EPOCH)
  scripts/qa.sh chain   [runda]       needles + smoke zaporedno

Runda je NEOBAVEZNA — privzeto ZADNJA (latest). Zamrznjene skripte se NE
brišejo (kanon); dispatcher jih le poišče po rundi + fazi.
EOF
}

# ── Zagon ene skripte (prenosljivo) ──────────────────────────────────────────

run_script() {
  local target="$1"; shift
  [ -f "$REPO/$target" ] || { echo "MANJKA: $target (exit 3)"; exit 3; }

  # Prenosljivost: REPO ni na legacy poti → substitucija v temp kopiji.
  if [ "$REPO" != "$LEGACY_ROOT" ] && grep -q "$LEGACY_ROOT" "$REPO/$target"; then
    local tmp
    tmp="$(mktemp /tmp/roksal-qa-rXXXXXX.sh)"
    # Nadomesti LE legacy pot (skripte po njej delujejo relativno — cd znotraj).
    sed "s|$LEGACY_ROOT|$REPO|g" "$REPO/$target" > "$tmp"
    if ! bash -n "$tmp"; then
      echo "SUBSTITUCIJA POKVARILA SINTAKSO — odklon (fail-closed, exit 4)"
      rm -f "$tmp"
      exit 4
    fi
    echo "[qa.sh] prenosljiv zagon: $LEGACY_ROOT → $REPO (temp kopija; original nedotaknjen)"
    bash "$tmp" "$@"
    local rc=$?
    rm -f "$tmp"
    return "$rc"
  fi
  bash "$REPO/$target" "$@"
}

# ── Glavni tok ───────────────────────────────────────────────────────────────

[ $# -ge 1 ] || { usage; echo; echo "MANJKA FAZA (exit 2)"; exit 2; }
FAZA="$1"; shift || true

case "$FAZA" in
  -h|--help|help)
    usage
    exit 0
    ;;
  latest)
    L="$(latest_round)"
    [ -n "$L" ] || { echo "NI RUND (manjka r*-build-needles.sh) — exit 3"; exit 3; }
    echo "$L"
    ;;
  list)
    printf '%-6s %-9s %-7s %-6s %-7s\n' "runda" "needles" "smoke" "e2e" "prodqa"
    for r in $(ls -1 "$REPO/scripts" | grep -E '^r[0-9]+-build-needles\.sh$' | sed -E 's/^r([0-9]+)-.*/\1/' | sort -n); do
      printf '%-6s %-9s %-7s %-6s %-7s\n' \
        "r$r" \
        "$([ -f "$REPO/scripts/r${r}-build-needles.sh" ] && echo DA || echo —)" \
        "$([ -f "$REPO/scripts/r${r}-run-smoke.sh" ] && echo DA || echo —)" \
        "$([ -f "$REPO/scripts/r${r}-e2e-browser.sh" ] && echo DA || echo —)" \
        "$([ -f "$REPO/scripts/r${r}-prod-qa.sh" ] && echo DA || echo —)"
    done
    ;;
  needles|smoke|e2e|prodqa)
    RUNDA="${1:-$(latest_round)}"
    [ -n "$RUNDA" ] || { echo "NI RUND — exit 3"; exit 3; }
    TARGET="$(script_for "$FAZA" "$RUNDA")"
    [ -n "$TARGET" ] || { usage; exit 2; }
    echo "[qa.sh] faza=$FAZA runda=$RUNDA → $TARGET"
    run_script "$TARGET"
    ;;
  chain)
    RUNDA="${1:-$(latest_round)}"
    [ -n "$RUNDA" ] || { echo "NI RUND — exit 3"; exit 3; }
    echo "[qa.sh] chain r$RUNDA: needles → smoke"
    run_script "$(script_for needles "$RUNDA")"
    run_script "$(script_for smoke "$RUNDA")"
    ;;
  *)
    usage
    echo
    echo "NEZNANA FAZA: $FAZA (exit 2)"
    exit 2
    ;;
esac
