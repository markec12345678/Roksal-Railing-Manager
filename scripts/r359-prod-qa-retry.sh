#!/usr/bin/env bash
# r359-prod-qa-retry.sh — R359 QA-infra hardening (feature runde): RETRY
# ovoj okoli prod-qa faze qa-round.sh — rešuje dokumentiran transient
# (LEKCIJA R358 + R359: Z2 chunk harvest curl ×60 BREZ retry — en transient
# padel chunk = vsi njegovi needleji lažno MISS; tek 1 je failal v DVEH
# zaporednih rundah, oba re-runa zeleno → diagnoza QA-infra, ni code-bug).
#
# NAČELA (iskreno, fail-closed):
#   - zamrznjeni r339-prod-qa.sh NI mutiran (kanon R358: hardening V NOVEM
#     skriptu) — ta ovoj samo PONOVI poizkus celotne prod-qa faze;
#   - do 3 poskusi z deterministično pavzo 5s (nič naključnega);
#   - EXIT 0 ob PRVEM zelenem teku; vsi poskusi poročani (brez tihega
#     ponavljanja); EXIT 1 šele, če VSI 3 poskusi failajo;
#   - uporaba: r359-prod-qa-retry.sh <RUNDA>  (npr. 358).
set -u
cd /home/z/my-project

RUNDA="${1:-}"
if [ -z "$RUNDA" ]; then
  echo "UPORABA: r359-prod-qa-retry.sh <RUNDA>"
  exit 1
fi

poskus=1
while [ "$poskus" -le 3 ]; do
  echo "=== prod-qa poskus $poskus/3 (runda $RUNDA) ==="
  if bash scripts/qa-round.sh "$RUNDA" prod-qa; then
    echo "=== prod-qa ZELEN ob poskusu $poskus (runda $RUNDA) ==="
    exit 0
  fi
  echo "=== prod-qa poskus $poskus FAILAL (znani transient kategorije R358/R359: harvest curl brez retry) ==="
  if [ "$poskus" -lt 3 ]; then
    echo "=== deterministična pavza 5s pred ponovnim poskusom ==="
    sleep 5
  fi
  poskus=$((poskus+1))
done

echo "=== prod-qa FAILAL V VSEH 3 POSKUSIH (runda $RUNDA) — to NI več transient: Glasno fail-closed, pregledati code/deploy ==="
exit 1
