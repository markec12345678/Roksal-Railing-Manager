#!/usr/bin/env bash
# r365-qa-spot.sh — R365 produkcija QA spot seja (spot-r167/10; ZERO-MUTACIJA;
# e2e-lib kanon r231). Fokus:
# (a) val 47 POST-deploy re-proba (measurements-tab): era preverba ŽE dokazala
#     4/4 statične needleje ŽIVO (chunk_026) — ta sonda dokumentira MONTIRANO
#     DOM resnico: 3 vedno-montirani press-scale navy/40 izvozna pilola
#     (terenski pregled PDF / zapisni list PDF / zapisni list CSV — ŠTEJANO
#     IZ DISKA, LEKCIJA R364 (4)) vsi z ring-offset-2 → sonnaBrezOffset = 0;
#     per-row/form gumbi pogojni (kanon r277 — iskrena praznina);
# (b) val 46 parity stabilnost (Zaloge) — 1. UPORABA kanona eb_sonda_zaloge
#     (e2e-lib dedup 5. val — prag R352 natanko ob ×3: r363 B + r364 B +
#     r365 B byte-identični md5 d3da517025ad391c3646b0cc572a0045; poraba V
#     ISTI rundi, LEKCIJA R362 (3));
# (c) val 45 parity stabilnost (CRM: pressScaleOffset2 9 / BrezOffset 0 /
#     statusFilterOffset2 7 — R363/R364 spot stanje) + 3. uporaba
#     eb_pocakaj_csv_pilli (kanon ŽIV);
# (d) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R365 QA spot seja (spot-r167/10 — val 47 POST-deploy re-proba) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r365err

echo "--- A: Meritve (measurements) — val 47 POST-deploy: 3 izvozna pilola offset-2, BrezOffset 0 ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Ni projektov') || document.querySelectorAll('table').length > 0;})()" 15
agent-browser eval "JSON.stringify({
  niProjektov: document.body.textContent.includes('Ni projektov'),
  tabela: document.querySelectorAll('table').length > 0,
  terenskiPregledPdfMounted: !!document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]'),
  terenskiPregledPdfOffset2: (document.querySelector('button[aria-label=\"Izvozi terenski pregled meritev kot PDF\"]')?.className||'').includes('ring-offset-2'),
  zapisniListPdfMounted: !!document.querySelector('button[aria-label=\"Izvozi terenski zapisni list kot PDF\"]'),
  zapisniListPdfOffset2: (document.querySelector('button[aria-label=\"Izvozi terenski zapisni list kot PDF\"]')?.className||'').includes('ring-offset-2'),
  zapisniListCsvMounted: !!document.querySelector('button[aria-label=\"Izvozi terenski zapisni list kot CSV\"]'),
  zapisniListCsvOffset2: (document.querySelector('button[aria-label=\"Izvozi terenski zapisni list kot CSV\"]')?.className||'').includes('ring-offset-2'),
  sonnaPressScale: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')).length,
  sonnaBrezOffset: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length,
  statusChipi: [...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Filtriraj po statusu')).length,
  statusChipiOffset2: [...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Filtriraj po statusu')&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1

echo "--- B: Zaloge (inventory) — val 46 stabilnost (1. UPORABA kanona eb_sonda_zaloge) ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_zalogo 15
eb_sonda_zaloge

echo "--- C: CRM — val 45 parity stabilnost (kanon eb_pocakaj_csv_pilli 3. uporaba) ---"
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_csv_pilli 15
eb_sonda_ring_pariteta

echo "--- D: kolektor ---"
eb_preberi_kolektor r365err

agent-browser close --all >/dev/null 2>&1
echo "=== R365 spot KONEC ==="
