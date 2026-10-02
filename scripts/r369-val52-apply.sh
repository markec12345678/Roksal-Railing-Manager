#!/usr/bin/env bash
# r369-val52-apply.sh — R369 MANDATORY STIL val 52: ring OBLIKOVNA pariteta
# navy+ink PARIŠKIH vrstic (svetlo+temno dvojčki na ISTIH elementih —
# per-barvni split kanon nadaljevanje: navy = val 43–49 [površinsko], red =
# val 50, amber = val 51, navy+ink pari = val 52). Disk resnica
# (scripts/r369-census.py): roksal-ink/40 ×12 = VSI dark: dvojčki navy/40
# na istih vrsticah (termini-card ×6, bottom-nav ×2, notification-center ×3,
# quick-actions-fab ×1) — VSE 12 vrstic brez focus-visible:ring-offset.
# OPERACIJA: 12 × EN ` focus-visible:ring-offset-2` vstavljen TIK ZA
# `focus-visible:ring-roksal-navy/40` na pariški vrstici (offset žeton je
# TEMA-NEODVISEN — pokrije svetlo navy/40 IN temno ink/40 varianto ISTEGA
# elementa; kanon R368 notification L748 'EN offset pokrije svetlo+temno').
# BARVNI ŽIGI bajtno nespremenjeni (shape-only runda); in-place = 0 novih
# vrstic; 0 novih hex; aria/title ZAMRZNJENI (ring-only — val 44–51
# precedens). Stale-pin PRED-SCAN čist: r167 regexa (ink/40 + dark:hover
# sosledje; ink/40 + onClick sosledje) preživita (vstavljanje je ZA
# navy/40, NE za ink/40); r214 števca navy/40=2 in ink/40=2 (bottom-nav)
# nespremenjena (vstavljanje ne doda/odstrani žetonov); r268 pin = team-tab
# (izven tarče); r361 (E) = crm-tab (izven tarče). Determinističen perl z
# FAIL-CLOSED pričakovanimi števci: vsaka substitucija MORA zadeti točno
# pričakovano število vrstic, sicer abort (nikoli tiho delno delo).
set -eu
cd /home/z/my-project/src/components

# Guard pomožna funkcija: preveri število vrstic z OFFSETOM po teku.
# Pričakovani končni števci focus-visible:ring-offset-2 na pariških vrsticah:
#   termini-card.tsx        0 → 6
#   bottom-nav.tsx          0 → 2
#   notification-center.tsx 1 → 4  (L748 amber/60 že nosi iz val 51)
#   quick-actions-fab.tsx   1 → 2  (ostali žetoni iz starejših valov)

# --- 1) termini-card.tsx: 6 pariških vrstic (L336, L352, L398, L417, L431, L442)
perl -pi -e 'if (/focus-visible:ring-roksal-navy\/40/ && /dark:focus-visible:ring-roksal-ink\/40/ && !/focus-visible:ring-offset/) { s/focus-visible:ring-roksal-navy\/40(?! focus-visible:ring-offset)/focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g }' roksal/termini-card.tsx
# --- 2) bottom-nav.tsx: 2 pariški vrstici (L123, L186)
perl -pi -e 'if (/focus-visible:ring-roksal-navy\/40/ && /dark:focus-visible:ring-roksal-ink\/40/ && !/focus-visible:ring-offset/) { s/focus-visible:ring-roksal-navy\/40(?! focus-visible:ring-offset)/focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g }' roksal/bottom-nav.tsx
# --- 3) notification-center.tsx: 3 pariške vrstici (L855, L881, L940)
perl -pi -e 'if (/focus-visible:ring-roksal-navy\/40/ && /dark:focus-visible:ring-roksal-ink\/40/ && !/focus-visible:ring-offset/) { s/focus-visible:ring-roksal-navy\/40(?! focus-visible:ring-offset)/focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g }' roksal/notification-center.tsx
# --- 4) quick-actions-fab.tsx: 1 pariška vrstica (L92)
perl -pi -e 'if (/focus-visible:ring-roksal-navy\/40/ && /dark:focus-visible:ring-roksal-ink\/40/ && !/focus-visible:ring-offset/) { s/focus-visible:ring-roksal-navy\/40(?! focus-visible:ring-offset)/focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2/g }' roksal/quick-actions-fab.tsx

# --- FAIL-CLOSED preverba: pariške vrstice MORAJO vse nositi offset (razcep = 0)
termini=$(rg -c "dark:focus-visible:ring-roksal-ink/40" roksal/termini-card.tsx || true)
navy_ink=$(rg -n "focus-visible:ring-roksal-navy/40" roksal/termini-card.tsx roksal/bottom-nav.tsx roksal/notification-center.tsx roksal/quick-actions-fab.tsx | rg "dark:focus-visible:ring-roksal-ink/40" | rg -cv "focus-visible:ring-offset-2" || true)
if [ "${navy_ink:-0}" != "0" ]; then
  echo "FAILOVEDANO: $navy_ink pariških vrstic ŠE BREZ focus-visible:ring-offset-2 (pričakovano 0) — abort"
  exit 1
fi
echo "=== val 52 perl substitucije izvedene — 12/12 pariških vrstic nosi offset-2 (razcep = 0) ==="
echo "=== nadaljuje census preverba (r369-census.py) + VITEST r369 ==="
