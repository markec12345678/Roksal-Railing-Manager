#!/usr/bin/env bash
# r370-val53-apply.sh — R370 MANDATORY STIL val 53: ring OBLIKOVNA pariteta
# navy/40 OFFSET-1 REP — normalizacija 1→2 (per-barvni split kanon
# nadaljevanje: navy = val 43–49 + val 52 pari, red = val 50, amber =
# val 51, navy offset-1 rep = val 53). Disk resnica (scripts/r369-census.py
# RE-POGNAN v R370): navy/40 gap 65 = NONE ×54 + O1 ×8 + ?INTERP ×3;
# val 53 = O1 ×8 (8 vrstic × 4 datoteke: calculator-tab L4382,
# dashboard-tab L2666, invoice-manager L1045/L1061/L1182,
# vodja-dashboard L1274/L1290/L1306 — VSE focus-visible gumbi z
# `focus-visible:ring-offset-1`; precedens val 47/49/51 normalizacij).
# NONE ×54 in ?INTERP ×3 ostajata ISKRENO izven (val 54+ kandidati;
# D2 spot dokaz: 'Izvozi CSV' dashboard L1678 = shadcn Button + brand
# barvni override = val 52 namerna izjema #1 kit fokus jezik).
# BARVNI ŽIGI bajtno nespremenjeni (shape-only runda); substitucija je
# DOLŽINSKO NEVTRALNA (13 znakov → 13 znakov) = 0 okenskih premikov;
# in-place = 0 novih vrstic; 0 novih hex; aria/title ZAMRZNJENI.
#
# STALE-PINI (RAŠIRJEN PRED-SKAN — LEKCIJA R369 (2): VSI okenski
# kvantifikatorji + VSE hard pin vrste nad 4 tarčnimi datotekami):
# 6 shiftov V ISTI RUNDI z žigi [PIN SHIFT R370 val 53]:
#   (1) r236-dobavitelji-pdf.test.ts L276 — toContain navy/40 offset-1"
#       → offset-2" (vitest hard pin, invoice L1045/L1061/L1182);
#   (2) r236-build-needles.sh L47 — CSV pill need offset-1 → offset-2
#       [LEGACY skript IZVEN trenutne needles verige — proaktiven shift,
#       kanon R368 r244-prod-qa];
#   (3) r236-build-needles.sh L49 — Prejem need offset-1 → offset-2
#       [ŽE ZASTAREL PRED R370: green-50+navy/40 živi na logistics L2417
#       z offset-2 — osvežen na disk resnico, najdba dokumentirana];
#   (4) r236-build-needles.sh L48 — Izdaj/Plačan need: vmesni
#       outline-none+ring-2 segment manjkal v needleju [ŽE ZASTAREL PRED
#       R370 — osvežen na disk resnico L1319/L1339];
#   (5) r237-build-needles.sh L43 — dashboard L2666 need offset-1 → 2;
#   (6) r237-prod-core.sh L64 — CSV pill need offset-1 → offset-2
#       [LEGACY, izven r339-prod-qa verige — proaktiven shift].
# Fail-closed: vsaka substitucija MORA zadeti točno pričakovano število
# vrstic, sicer abort (nikoli tiho delno delo).
set -eu
cd /home/z/my-project

# --- 1) KOMPONENTE: 8 × offset-1→2 na navy/40 fokus vrsticah (dolžinsko nevtralno)
for spec in "calculator-tab.tsx:1" "dashboard-tab.tsx:1" "invoice-manager.tsx:3" "vodja-dashboard.tsx:3"; do
  f="src/components/roksal/${spec%%:*}"; exp="${spec##*:}"
  pred=$(grep "focus-visible:ring-roksal-navy/40" "$f" | grep -c "ring-offset-1" || true)
  if [ "$pred" != "$exp" ]; then echo "FAILOVEDANO: $f pred tekom ima $pred navy/40+offset-1 vrstic (pričakovano $exp) — abort"; exit 1; fi
  perl -pi -e 'if (/focus-visible:ring-roksal-navy\/40/ && /focus-visible:ring-offset-1/) { s/focus-visible:ring-offset-1/focus-visible:ring-offset-2/g }' "$f"
  after=$(grep "focus-visible:ring-roksal-navy/40" "$f" | grep -c "ring-offset-1" || true)
  if [ "$after" != "0" ]; then echo "FAILOVEDANO: $f še ima navy/40+offset-1 vrstice ($after) — abort"; exit 1; fi
done

echo "=== val 53 komponente: 8/8 navy/40 offset-1→2 (razcep = 0) — pokliče r370-pins-shift.py za 6 pinov ==="
python3 scripts/r370-pins-shift.py
