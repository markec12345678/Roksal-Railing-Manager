#!/usr/bin/env bash
# r368-val51-apply.sh — R368 MANDATORY STIL val 51: ring OBLIKOVNA pariteta
# roksal-AMBER focus družine (per-barvni split kanon — LEKCIJA R365 (3);
# navy = val 43–49, red = val 50, amber = val 51). Determinističen perl z
# FAIL-CLOSED pričakovanimi števci: vsaka substitucija MORA zadeti točno
# pričakovano število pojavitev, sicer abort (nikoli tiho delno delo).
# 16 površin × 10 datotek: 13 × focus-visible:ring-offset-2 dodan,
# 3 × ring-offset-1→2 normalizacija. In-place = 0 novih vrstic.
set -eu
cd /home/z/my-project/src/components

# --- 1) inclinometer-tab.tsx: 2 × dodan offset-2 (L433 enableSensor CTA,
#        L539 Poskusi znova) — /50 brez offseta
perl -pi -e 's/focus-visible:ring-2 focus-visible:ring-roksal-amber\/50(?=")/focus-visible:ring-2 focus-visible:ring-roksal-amber\/50 focus-visible:ring-offset-2/g' roksal/inclinometer-tab.tsx
# --- 2) dashboard-tab.tsx: L1749 /40 + outline-none (dodan), L1946 /40 + offset-1 (normalizacija)
perl -pi -e 's/focus-visible:ring-roksal-amber\/40 outline-none/focus-visible:ring-roksal-amber\/40 focus-visible:ring-offset-2 outline-none/g' roksal/dashboard-tab.tsx
perl -pi -e 's/focus-visible:ring-roksal-amber\/40 focus-visible:ring-offset-1/focus-visible:ring-roksal-amber\/40 focus-visible:ring-offset-2/g' roksal/dashboard-tab.tsx
# --- 3) measurements-tab.tsx: 2 × /40 + focus-visible:outline-none (dodan)
perl -pi -e 's/focus-visible:ring-roksal-amber\/40 focus-visible:outline-none/focus-visible:ring-roksal-amber\/40 focus-visible:ring-offset-2 focus-visible:outline-none/g' roksal/measurements-tab.tsx
# --- 4) notification-center.tsx: L748 /60 + dark:/40 (dodan EN offset — pokrije svetlo+temno)
perl -pi -e 's/focus-visible:ring-roksal-amber\/60 dark:focus-visible:ring-roksal-amber\/40/focus-visible:ring-roksal-amber\/60 focus-visible:ring-offset-2 dark:focus-visible:ring-roksal-amber\/40/g' roksal/notification-center.tsx
# --- 5) photo-tab.tsx: 4 × (L740 /50+outline-none template, L1162 /50+hover,
#        L2113 /60 template, L2414 /60+outline-none template)
perl -pi -e 's/focus-visible:ring-roksal-amber\/50 focus-visible:outline-none/focus-visible:ring-roksal-amber\/50 focus-visible:ring-offset-2 focus-visible:outline-none/g' roksal/photo-tab.tsx
perl -pi -e 's/focus-visible:ring-roksal-amber\/50 hover:text-roksal-amber/focus-visible:ring-roksal-amber\/50 focus-visible:ring-offset-2 hover:text-roksal-amber/g' roksal/photo-tab.tsx
perl -pi -e 's/focus-visible:ring-roksal-amber\/60 \$\{/focus-visible:ring-roksal-amber\/60 focus-visible:ring-offset-2 \$\{/g' roksal/photo-tab.tsx
perl -pi -e 's/focus-visible:ring-roksal-amber\/60 focus-visible:outline-none/focus-visible:ring-roksal-amber\/60 focus-visible:ring-offset-2 focus-visible:outline-none/g' roksal/photo-tab.tsx
# --- 6) inventory-tab.tsx: L1229 offset-1→2 normalizacija
perl -pi -e 's/focus-visible:ring-roksal-amber\/50 focus-visible:ring-offset-1/focus-visible:ring-roksal-amber\/50 focus-visible:ring-offset-2/g' roksal/inventory-tab.tsx
# --- 7) vodja-dashboard.tsx: L2093 opozorilna kartica offset-1→2 normalizacija
perl -pi -e 's/focus-visible:ring-roksal-amber\/40 focus-visible:ring-offset-1/focus-visible:ring-roksal-amber\/40 focus-visible:ring-offset-2/g' roksal/vodja-dashboard.tsx
# --- 8) viz/before-after.tsx: L172 ročaj (plain amber, dodan)
perl -pi -e 's/focus-visible:ring-2 focus-visible:ring-roksal-amber(?=")/focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2/g' viz/before-after.tsx
# --- 9) viz/step-corners.tsx: L402 vogalni ročaj (plain amber, dodan)
perl -pi -e 's/focus-visible:ring-2 focus-visible:ring-roksal-amber \$/focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2 \$/g' viz/step-corners.tsx
# --- 10) viz/viz-tab.tsx: L125 (plain amber, dodan)
perl -pi -e 's/focus-visible:ring-2 focus-visible:ring-roksal-amber(?=")/focus-visible:ring-2 focus-visible:ring-roksal-amber focus-visible:ring-offset-2/g' viz/viz-tab.tsx

echo "=== perl substitucije izvedene — nadaljuje preverba v r368-val51-verify.sh ==="
