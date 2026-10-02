#!/usr/bin/env bash
# r379-qa-spot.sh — R379 produkcija QA spot seja (spot-r167/22;
# ZERO-MUTACIJA — SAMO sonde + navigacijski dispatch + en klik na
# PURE client-state gumb [počisti iskalno polje — nič persisted,
# ZERO-MUTACIJA varen po handover Nota R377]; e2e-lib kanon r231).
# Fokus: val 58 POST-deploy verifikacija — 1 needle r377.tsv (era
# preverba ENAINTRIDESIJNA dokazuje ŽIVO DIREKTNO v chunk_028; ta
# sonda dokumentira MONTIRANO DOM resnico z mounted + className
# LOČENO, LEKCIJA R365 (4); dispatch + pocakaj VSAKA, LEKCIJA R370 (6)):
#   N1 'Počisti iskanje projektov' (dashboard-tab L1628 — vrata:
#     searchQuery NE-prazno, kanon r277; spot B R377 je dokazal 0
#     montiranih pri praznem iskanju — ta seja ponovi vrata PAZLJIVO:
#     najprej bazna resnica 0, potem fill → montirano, potem klik →
#     od-montirano = funkcionalni dokaz v OBEH smereh).
# Sonde: eb_sonda_navy_stetje + eb_sonda_red_stetje + kolektor
# konzolnih napak ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R379 QA spot seja (spot-r167/22 — val 58 POST-deploy) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r379err

echo "--- A: dashboard — bazna resnica: PRAZNO iskanje → 0 montiranih (vrata kanon r277) ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV'));})()" 30
agent-browser eval "JSON.stringify({
  sidroCsv: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')).length,
  iskalnoPoljeMontirano: !!document.querySelector('input[placeholder=\"Išči projekte, stranke...\"]'),
  iskalnaVrednostPrazna: (document.querySelector('input[placeholder=\"Išči projekte, stranke...\"]')||{}).value === '',
  pocistiIskanjeMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov').length
})" 2>&1 | tail -1

echo "--- B: fill iskalno polje → val 58 N1 MONTIRAN + className LOČENO ---"
agent-browser fill 'input[placeholder="Išči projekte, stranke..."]' 'roksal qa sonda' >/dev/null 2>&1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov');})()" 30
agent-browser eval "JSON.stringify({
  iskalnaVrednost: (document.querySelector('input[placeholder=\"Išči projekte, stranke...\"]')||{}).value,
  pocistiIskanjeMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov').length,
  val58TransitionColors: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov'&&(b.className||'').split(/\\s+/).includes('transition-colors')).length,
  val58Ring2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov'&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-2')).length,
  val58Navy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov'&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-roksal-navy/40')).length,
  val58Offset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov'&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length,
  val58Rounded: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov'&&(b.className||'').split(/\\s+/).includes('rounded')).length
})" 2>&1 | tail -1

echo "--- C: klik 'Počisti iskanje' (PURE client state) → od-montirano = funkcionalni dokaz ---"
# Disk resnica spot-r167/22: dve oviri za PRAVI klik — (1) vodič ozadje se
# lahko odpre POZNO (hladen prod: hidracija + chunk + 1s timer; prekriva
# vse s pointer-events auto), (2) search bar je na začetnem scroll položaju
# POD fixed bottom-nav (z-50) na kratkem viewportu (577px) — pravi
# uporabnik scrolla; sonda naredi ISTO (scrollintoview). Potek:
# (1a) če je ozadje prisotno → zapri prek X (eval, handleSkip);
# (2a) scrollintoview na gumb; (3a) PRAVI klik; ob še vedno blokiranem
# kliku → eval klik s posebno oznako (iskreno poročanje).
agent-browser eval "(()=>{const bd=document.querySelector('div.fixed.inset-0.z-\\\\[100\\\\]'); if(!bd) return 'brez-ozadja'; const x=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(x){x.click(); return 'ozadje-zaprto';} return 'ozadje-brez-x';})()" 2>&1 | tail -1
sleep 1
agent-browser scrollintoview 'button[aria-label="Počisti iskanje projektov"]' >/dev/null 2>&1
sleep 1
if agent-browser click 'button[aria-label="Počisti iskanje projektov"]' >/dev/null 2>&1; then
  echo "pravi klik: OK"
else
  echo "pravi klik: ŠE VEDNO BLOKIRAN (disk resnica) → eval klik (isti onClick handler, iskreno poročanje)"
  agent-browser eval "(()=>{const b=[...document.querySelectorAll('main button')].find(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov'); if(b){b.click(); return 'klik poslan';} return 'gumb ni najden';})()" 2>&1 | tail -1
fi
eb_pocakaj_na "(()=>{return ![...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov');})()" 30
agent-browser eval "JSON.stringify({
  iskalnaVrednostPoKliku: (document.querySelector('input[placeholder=\"Išči projekte, stranke...\"]')||{}).value,
  pocistiIskanjeMountedPoKliku: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov').length
})" 2>&1 | tail -1

echo "--- D: sonde (navy + red stetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- E: kolektor ---"
eb_preberi_kolektor r379err

agent-browser close --all >/dev/null 2>&1
echo "=== R379 spot KONEC ==="
