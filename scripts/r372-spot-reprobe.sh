#!/usr/bin/env bash
# r372-spot-reprobe.sh — R372 re-proba po LEKCIJI R370 (6): NAJPREJ poll na
# VEDNO montirano sidro (izvozni CSV gumb — R371 kanon), ŠELE NATO probe
# pogojnih površin; vrstica klikne IZBIRA PROJEKTA PRED iskalnim vnosom
# (r372-qa-spot 1. teek: vrstica ni bila montirana ob pollu [prijava poskus 2,
# počasen fetch] + iskalni filter 'roksal' je izpraznil seznam PRED klikom
# vrstice — zaporedje popravljeno: vrstice → podrobnosti/audit → šele nato
# pogojne površine). ZERO-MUTACIJA; mounted + className LOČENO (R365 (4)).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R372 spot RE-PROBA (spot-r167/17b — popravljeno zaporedje) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r372err2

echo "--- A1: dashboard — sidro 'Izvozi prikazane projekte v CSV' (VEDNO) + vrstični gumbi ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV'));})()" 30
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt');})()" 20
agent-browser eval "JSON.stringify({
  arhivirajMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt').length,
  arhivirajNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  arhivirajOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt'&&(b.className||'').includes('ring-offset-2')).length,
  arhivirajBrezOffseta: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt'&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- A2: klik prve projektne vrstice (izbira + podrobnosti) ---"
agent-browser eval "(()=>{const g=document.querySelector('main button[aria-label=\"Arhiviraj projekt\"]'); if(!g) return 'NOGUMB'; const row=g.closest('.cursor-pointer'); if(!row) return 'NOROW'; row.click(); return 'KLIK';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Odpri revizijsko sled projekta');})()" 15

echo "--- B: revizijska sled — chips L249 (aria-pressed) + razpenjanje L310 (aria-expanded) ---"
eb_klik_gumb "Odpri revizijsko sled projekta"
eb_pocakaj_na "(()=>{const ds=[...document.querySelectorAll('[role=\"dialog\"]')]; const d=ds[ds.length-1]; return !!d && !!d.querySelector('button[aria-pressed]');})()" 15
agent-browser eval "JSON.stringify({
  chipsMounted: [...document.querySelectorAll('[role=\"dialog\"] button[aria-pressed]')].length,
  chipsNavy40: [...document.querySelectorAll('[role=\"dialog\"] button[aria-pressed]')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')).length,
  chipsOffset2: [...document.querySelectorAll('[role=\"dialog\"] button[aria-pressed]')].filter(b=>(b.className||'').includes('ring-offset-2')).length,
  razpenjanjeMounted: [...document.querySelectorAll('[role=\"dialog\"] button[aria-expanded]')].length,
  razpenjanjeNavy40: [...document.querySelectorAll('[role=\"dialog\"] button[aria-expanded]')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')).length,
  razpenjanjeOffset2: [...document.querySelectorAll('[role=\"dialog\"] button[aria-expanded]')].filter(b=>(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
agent-browser press Escape >/dev/null 2>&1; sleep 1
agent-browser press Escape >/dev/null 2>&1; sleep 1

echo "--- C: inclinometer — 'Izvozi terenski pregled nagibov kot PDF' (L341, projekt izbran) ---"
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi terenski pregled nagibov kot PDF');})()" 20
agent-browser eval "JSON.stringify({
  nagibiPdfMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi terenski pregled nagibov kot PDF').length,
  nagibiPdfNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi terenski pregled nagibov kot PDF'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  nagibiPdfOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi terenski pregled nagibov kot PDF'&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- D: measurements — SteberTable CSV (L69) + inline urednika (L131/L185) ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  steberCsvMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi preglednico stebrov kot CSV').length,
  steberCsvNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi preglednico stebrov kot CSV'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  steberCsvOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi preglednico stebrov kot CSV'&&(b.className||'').includes('ring-offset-2')).length,
  inlineUrednikiOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')&&(b.className||'').includes('p-1.5')).length,
  inlineUrednikiBrezOffseta: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')&&(b.className||'').includes('p-1.5')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- E: photos — 'Uredi mero' (L2370) ---"
eb_dispatch '{"tab":"photos","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  urediMeroMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Uredi mero').length,
  urediMeroNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Uredi mero'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  urediMeroOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Uredi mero'&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1

echo "--- F: more→documents — 'Izvozi pregled stanja zapisnika kot PDF' (L531) ---"
eb_dispatch '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  zapisnikPdfMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled stanja zapisnika kot PDF').length,
  zapisnikPdfNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled stanja zapisnika kot PDF'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  zapisnikPdfOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled stanja zapisnika kot PDF'&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- G: more→ekipa — 'Izvozi telemetrijo omejevanja hitrosti kot CSV' (L226, ADMIN) ---"
eb_dispatch '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 4
agent-browser eval "JSON.stringify({
  telemetrijaCsvMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi telemetrijo omejevanja hitrosti kot CSV').length,
  telemetrijaCsvNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi telemetrijo omejevanja hitrosti kot CSV'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  telemetrijaCsvOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi telemetrijo omejevanja hitrosti kot CSV'&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- H: kolektor ---"
eb_preberi_kolektor r372err2

agent-browser close --all >/dev/null 2>&1
echo "=== R372 re-proba KONEC ==="
