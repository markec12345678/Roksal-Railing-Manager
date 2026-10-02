#!/usr/bin/env bash
# qa-harvest.sh — R359 QA-infra hardening (feature runde): KANONSKI utrjen
# žetev čankov z RETRY — rešuje dokumentiran transient kategoriji R358/R359
# (prod-qa Z2 harvest: curl ×60 brez retry — EN transient padel chunk = vsi
# njegovi needleji lažno MISS; tek 1 je failal v DVEH zaporednih rundah).
#
# NAČELA (iskreno, fail-closed):
#   - zamrznjeni r339-prod-qa.sh NI mutiran (kanon R358: hardening V NOVEM
#     skriptu); ta skript je samostojen in PONOVNO UPORABLJEN — prihodnje
#     era-harvest skripte ga lahko pokličejo namesto lastnega inline curla;
#   - retry ×3 na URL z determinističnim backoffom (1s, 2s — nič naključnega,
#     100% determinizem);
#   - uspeh na URL = ne-prazno telo (binarno varno — čanek se shrani cel);
#   - PARCIALNA ŽETEVA GUARD: manj kot MIN čankov po vseh retryih → EXIT 1
#     z glasnim sporočilom (nikoli tiha delna žeteva);
#   - brez URL datoteke / brez izhodnega imenika → EXIT 1 (fail-closed).
#
# UPORABA: qa-harvest.sh <urls-datoteka> <izhodni-imenik> [min-čankov=30]
# IZHOD:  stdout povzetek; EXIT 0 = žeteva veljavna, EXIT 1 = fail-closed.
set -u

URLS="${1:-}"
OUT="${2:-}"
MIN="${3:-30}"

if [ -z "$URLS" ] || [ -z "$OUT" ]; then
  echo "UPORABA: qa-harvest.sh <urls-datoteka> <izhodni-imenik> [min-čankov=30]"
  exit 1
fi
if [ ! -f "$URLS" ] || [ ! -s "$URLS" ]; then
  echo "FAILOVEDANO: URL datoteka '$URLS' ne obstaja ali je prazna — fail-closed"
  exit 1
fi

rm -rf "$OUT"; mkdir -p "$OUT" || { echo "FAILOVEDANO: izhodni imenik '$OUT' ni mogoč"; exit 1; }

n=0; fail=0; retry=0
while IFS= read -r u; do
  [ -z "$u" ] && continue
  f="$OUT/chunk_$(printf '%03d' "$n").bin"
  ok=0
  poskus=0
  # retry ×3: poskus 1 brez pavze, nato determinističen backoff 1s, 2s
  while [ "$poskus" -lt 3 ]; do
    if [ "$poskus" -gt 0 ]; then
      sleep "$poskus"
      retry=$((retry+1))
    fi
    if curl -sS --max-time 30 -o "$f" "$u" 2>/dev/null && [ -s "$f" ]; then
      ok=1
      break
    fi
    poskus=$((poskus+1))
  done
  if [ "$ok" = "1" ]; then
    n=$((n+1))
  else
    fail=$((fail+1)); rm -f "$f"
    echo "OPOMBA: URL po 3 poskusih še vedno padel: $u"
  fi
done < "$URLS"

echo "ŽETEV: $n čankov OK, $fail failov, $retry retry-jev (kanon qa-harvest.sh R359)"
[ "$n" -lt "$MIN" ] && { echo "FAILOVEDANO: premalo čankov ($n < $MIN) — parcialna žeteva ni veljavna (fail-closed)"; exit 1; }
exit 0
