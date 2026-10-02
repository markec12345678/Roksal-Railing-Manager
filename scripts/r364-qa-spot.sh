#!/usr/bin/env bash
# r364-qa-spot.sh — R364 produkcija QA spot seja (spot-r167/9; ZERO-MUTACIJA;
# e2e-lib kanon r231). Fokus:
# (a) val 46 POST-deploy re-proba — ČASOVNI KONTRAKT (R363 spot B baseline:
#     izvoziCsv/Pdf/kopirajNarocilnicoOffset2 false + sonnaBrezOffset 15/15 na
#     stari kodi): po zelenem deployu pričakovano VSE true + sonnaBrezOffset 0;
#     dodajGibanjeMounted = per-pravica render (kanon r277) — iskrena praznina
#     če nič ne montira;
# (b) val 45 parity stabilnost (CRM: pressScaleOffset2 9 / BrezOffset 0 /
#     statusFilterOffset2 7 — R363 spot stanje);
# (c) 1. UPORABA kanona eb_pocakaj_zalogo (e2e-lib dedup 4. val — proaktiven
#     pri 2. ponovitvi, LEKCIJA R362 (3); poraba V ISTI rundi) + 2. uporaba
#     eb_pocakaj_csv_pilli (kanon ŽIV — poraba ne pražina);
# (d) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R364 QA spot seja (spot-r167/9 — val 46 POST-deploy re-proba) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r364err

echo "--- A: CRM — val 45 parity re-check (kanon eb_pocakaj_csv_pilli 2. uporaba) ---"
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_csv_pilli 15
eb_sonda_ring_pariteta

echo "--- B: Zaloge (inventory) — val 46 POST-deploy: offset pričakovano VSE true ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_zalogo 15
agent-browser eval "JSON.stringify({
  h2Zaloga: [...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='Zaloga'),
  izvoziCsvOffset2: (document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot CSV\"]')?.className||'').includes('ring-offset-2'),
  izvoziPdfOffset2: (document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot PDF\"]')?.className||'').includes('ring-offset-2'),
  kopirajNarocilnicoOffset2: (document.querySelector('button[aria-label=\"Kopiraj naročilnico vidnih artiklov pod minimalno zalogo\"]')?.className||'').includes('ring-offset-2'),
  dodajGibanjeOffset2: (document.querySelector('button[aria-label=\"Dodaj gibanje zaloge\"]')?.className||'').includes('ring-offset-2'),
  dodajGibanjeMounted: !!document.querySelector('button[aria-label=\"Dodaj gibanje zaloge\"]'),
  izvoziCsvMounted: !!document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot CSV\"]'),
  sonnaPressScale: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')).length,
  sonnaBrezOffset: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1

echo "--- C: kolektor ---"
eb_preberi_kolektor r364err

agent-browser close --all >/dev/null 2>&1
echo "=== R364 spot KONEC ==="
