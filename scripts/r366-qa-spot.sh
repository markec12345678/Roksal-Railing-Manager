#!/usr/bin/env bash
# r366-qa-spot.sh — R366 produkcija QA spot seja (spot-r167/11; ZERO-MUTACIJA;
# e2e-lib kanon r231). Fokus:
# (a) val 48 POST-deploy re-proba (logistics-tab): era preverba ŽE dokazala 4/4
#     statične needleje ŽIVO (chunk_041) — ta sonda dokumentira MONTIRANO DOM
#     resnico z mounted + className LOČENO (LEKCIJA R365 (4)): pričakovanje
#     navy/40 brez offseta = 0 na logistika površini (main-scoped); izvozi
#     pilola vedno montirana (samo disabled ob 0 terminih — vrsta iz vira
#     L1982: brez lahkoUpravljaProizvodnjo vrata), status filtre + per-termin
#     akcije pogojne po podatkih (kanon r277 — iskrena praznina z razlogom);
#     VES-dokument števec je ločen (vodja-lupina + tab bar ostanki — znani
#     val 49+ kandidati, LEKCIJA R361 (2));
# (b) val 46 stabilnost (Zaloge) — 2. UPORABA kanona eb_sonda_zaloge;
# (c) val 45 stabilnost (CRM) — kanon eb_sonda_ring_pariteta;
# (d) val 47 stabilnost (Meritve statusChipi — vedno-montirana površina);
# (e) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R366 QA spot seja (spot-r167/11 — val 48 POST-deploy re-proba) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r366err

echo "--- A: Logistika (more/logistics) — val 48 POST-deploy: mounted + className LOČENO ---"
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi vidne termine kot CSV\"]');})()" 20
agent-browser eval "JSON.stringify({
  izvoziCsvMounted: !!document.querySelector('button[aria-label=\"Izvozi vidne termine kot CSV\"]'),
  izvoziCsvOffset2: (document.querySelector('button[aria-label=\"Izvozi vidne termine kot CSV\"]')?.className||'').includes('ring-offset-2'),
  icsKoledarMounted: !!document.querySelector('button[aria-label=\"Izvozi termine montaže kot koledarsko datoteko (.ics)\"]'),
  icsKoledarOffset2: (document.querySelector('button[aria-label=\"Izvozi termine montaže kot koledarsko datoteko (.ics)\"]')?.className||'').includes('ring-offset-2'),
  vozniRedPdfMounted: !!document.querySelector('button[aria-label=\"Izvozi vozni red montaž kot PDF\"]'),
  vozniRedPdfOffset2: (document.querySelector('button[aria-label=\"Izvozi vozni red montaž kot PDF\"]')?.className||'').includes('ring-offset-2'),
  razgledMounted: !!document.querySelector('[aria-label=\"Tedenski razgled — naslednjih 7 dni\"]'),
  mainNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')).length,
  mainOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length,
  mainBrezOffset: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length,
  vesDocNavy40: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')).length,
  vesDocBrezOffset: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1

echo "--- B: Zaloge (inventory) — val 46 stabilnost (2. UPORABA kanona eb_sonda_zaloge) ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_zalogo 15
eb_sonda_zaloge

echo "--- C: CRM — val 45 parity stabilnost (kanon eb_sonda_ring_pariteta) ---"
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_csv_pilli 15
eb_sonda_ring_pariteta

echo "--- D: Meritve — val 47 stabilnost (statusChipi vedno-montirana površina) ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_meritve 15
agent-browser eval "JSON.stringify({
  niProjektov: document.body.textContent.includes('Ni projektov'),
  statusChipi: [...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Filtriraj po statusu')).length,
  statusChipiOffset2: [...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Filtriraj po statusu')&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1

echo "--- E: kolektor ---"
eb_preberi_kolektor r366err

agent-browser close --all >/dev/null 2>&1
echo "=== R366 spot KONEC ==="
