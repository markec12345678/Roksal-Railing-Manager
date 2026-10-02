#!/usr/bin/env bash
# r367-qa-spot.sh — R367 produkcija QA spot seja (spot-r167/12; ZERO-MUTACIJA;
# e2e-lib kanon r231). Fokus:
# (a) val 49 POST-deploy re-proba (material-intelligence, orders podzavihek):
#     era preverba ŽE dokazala 4/4 statične needleje ŽIVO (chunk_036) — ta
#     sonda dokumentira MONTIRANO DOM resnico z mounted + className LOČENO
#     (LEKCIJA R365 (4)): izvozi naročila CSV pill VEDNO viden (P1-k, vrata
#     iz vira L1548: samo disabled ob loading); chipCls status filter pogojen
#     z orders.length > 0 (vrata L1646 — iskrena praznina 'Ni naročil');
# (b) val 49 POST-deploy (suppliers podzavihek): izvozi dobavitelje CSV (h-8)
#     + PDF (h-6) VEDNO vidna (R236 družina); Nov dobavitelj CTA pogojen z
#     lahkoUpravljaKatalog (fail-closed R242 — iskrena praznina brez pravice);
# (c) val 46 stabilnost (Zaloge) — 3. UPORABA kanona eb_sonda_zaloge;
# (d) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R367 QA spot seja (spot-r167/12 — val 49 POST-deploy re-proba) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r367err

echo "--- A: Material / naročila — val 49 POST-deploy: chipi + izvozni pilli ---"
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 20
agent-browser eval "JSON.stringify({
  nacrtiCsvMounted: !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'),
  nacrtiCsvOffset2: (document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]')?.className||'').includes('ring-offset-2'),
  nacrtiPraznina: document.body.textContent.includes('Ni naročil'),
  chipiSkupinaMounted: !!document.querySelector('[aria-label=\"Filter naročil po statusu\"]'),
  chipiVsi: [...document.querySelectorAll('[aria-label=\"Filter naročil po statusu\"] button')].length,
  chipiOffset2: [...document.querySelectorAll('[aria-label=\"Filter naročil po statusu\"] button')].filter(b=>(b.className||'').includes('ring-offset-2')).length,
  chipiBrezOffset: [...document.querySelectorAll('[aria-label=\"Filter naročil po statusu\"] button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length,
  mainNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')).length,
  mainOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length,
  mainBrezOffset: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1

echo "--- B: Material / dobavitelji — val 49 POST-deploy: izvozna družina + CTA ---"
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot CSV\"]');})()" 20
agent-browser eval "JSON.stringify({
  dobaCsvMounted: !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot CSV\"]'),
  dobaCsvOffset2: (document.querySelector('button[aria-label=\"Izvozi dobavitelje kot CSV\"]')?.className||'').includes('ring-offset-2'),
  dobaPdfMounted: !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]'),
  dobaPdfOffset2: (document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]')?.className||'').includes('ring-offset-2'),
  novDobaviteljMounted: [...document.querySelectorAll('main button')].some(b=>(b.textContent||'').trim().includes('Nov dobavitelj')),
  novDobaviteljOffset2: ([...document.querySelectorAll('main button')].find(b=>(b.textContent||'').trim().includes('Nov dobavitelj'))?.className||'').includes('ring-offset-2'),
  mainNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')).length,
  mainOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length,
  mainBrezOffset: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1

echo "--- C: Meritve — val 47/49 stabilnost (1. UPORABA kanona eb_sonda_status_chipi + 2. uporaba eb_pocakaj_meritve) ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_meritve 15
eb_sonda_status_chipi

echo "--- D: Zaloge — val 46 stabilnost (3. UPORABA kanona eb_sonda_zaloge) ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_zalogo 15
eb_sonda_zaloge

echo "--- E: kolektor ---"
eb_preberi_kolektor r367err

agent-browser close --all >/dev/null 2>&1
echo "=== R367 spot KONEC ==="
