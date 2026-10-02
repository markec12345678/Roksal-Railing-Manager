#!/usr/bin/env bash
# r375-spot-reprobe.sh — R375 re-proba po LEKCIJI R372 (2): NAJPREJ poll na
# VEDNO montirano sidro (dashboard 'Izvozi prikazane projekte v CSV' —
# R372 kanon; photos 'Slikaj' — PhotoTab orodjarna VEDNO montirana),
# ŠELE NATO probe pogojnih val 56 površin. ZERO-MUTACIJA (samo
# navigacijski dispatch; NI klikov na 'Izbriši sliko'/slikanje — mutacija
# podatkov prepovedana). mounted + className LOČENO (R365 (4)); disk
# resnica 'Ni projektov' dokumentirana (R372 (1) kanon r277); bela
# družina split token števec ('ring-white' ≠ 'ring-white/60').
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R375 spot RE-PROBA (spot-r167/19b — popravljeno zaporedje) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r375err2

echo "--- A1: dashboard — sidro CSV izvoz (VEDNO) → nato val 56 N4 'Pokliči stranko' (L1742) ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV'));})()" 30
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Ni projektov');})()" 20
agent-browser eval "JSON.stringify({
  sidroCsv: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')).length,
  niProjektovDiskResnica: document.body.textContent.includes('Ni projektov'),
  pokliciMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Pokliči stranko').length,
  pokliciGreen40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Pokliči stranko'&&(b.className||'').includes('ring-roksal-green/40')).length,
  pokliciOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Pokliči stranko'&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length,
  globalGreen40: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-green/40')).length,
  globalGreen40Offset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-green/40')&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- A2: photos — sidro 'Slikaj' (VEDNO, disabled=!projectId) → val 56 N1/N2/N3 ---"
eb_dispatch '{"tab":"photos","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.textContent||'').trim()==='Slikaj');})()" 30
eb_cakaj 2
agent-browser eval "JSON.stringify({
  slikajMounted: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').trim()==='Slikaj').length,
  slikajDisabled: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').trim()==='Slikaj'&&b.disabled).length,
  pikaMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši sliko')).length,
  pikaWhiteClass: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši sliko')&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-white')).length,
  zapriSlikanjeMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Zapri slikanje').length,
  zapriAnotacijeMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Zapri urejevalnik anotacij').length,
  galerijaSlik: [...document.querySelectorAll('main img')].length,
  belaDruzinaGumbi: [...document.querySelectorAll('main button')].filter(b=>['focus-visible:ring-white','focus-visible:ring-white/60'].some(t=>(b.className||'').split(/\\s+/).includes(t))).length,
  belaDruzinaOffset2: [...document.querySelectorAll('main button')].filter(b=>['focus-visible:ring-white','focus-visible:ring-white/60'].some(t=>(b.className||'').split(/\\s+/).includes(t))&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- B: kolektor ---"
eb_preberi_kolektor r375err2

agent-browser close --all >/dev/null 2>&1
echo "=== R375 re-proba KONEC ==="
