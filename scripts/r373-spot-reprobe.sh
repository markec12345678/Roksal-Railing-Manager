#!/usr/bin/env bash
# r373-spot-reprobe.sh — R373 re-proba po LEKCIJI R370 (6) + R372 (2): NAJPREJ
# poll na VEDNO montirano sidro ('Izvozi prikazane projekte v CSV' na
# dashboardu — R372 kanon; 'Sistem — zdravje' kartica na vodji — L2196
# VEDNO montirana), ŠELE NATO probe pogojnih val 55 površin. ZERO-MUTACIJA
# (samo navigacijski dispatch + 1 klik projektne vrstice = UI stanje); NI
# klikov na 'Izbriši/Podvoji meritev' (mutacija podatkov — prepovedano).
# mounted + className LOČENO (R365 (4)); disk resnica 'Ni projektov'
# dokumentirana (R372 (1) kanon r277).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R373 spot RE-PROBA (spot-r167/18b — popravljeno zaporedje) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r373err2

echo "--- A1: dashboard — sidro CSV izvoz (VEDNO) → nato val 55 'Zamujena dobava' (L1987) ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV'));})()" 30
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt');})()" 20
agent-browser eval "JSON.stringify({
  sidroCsv: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')).length,
  arhivirajMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt').length,
  niProjektovDiskResnica: document.body.textContent.includes('Ni projektov'),
  zamujenaMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')).length,
  zamujenaRed40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')&&(b.className||'').includes('ring-roksal-red/40')).length,
  zamujenaOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')&&(b.className||'').includes('ring-offset-2')).length,
  zamujenaOznake: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')).map(b=>b.getAttribute('aria-label'))
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- A2: klik prve projektne vrstice (izbira projekta = UI stanje) ---"
agent-browser eval "(()=>{const g=document.querySelector('main button[aria-label=\"Arhiviraj projekt\"]'); if(!g) return 'NOGUMB'; const row=g.closest('.cursor-pointer'); if(!row) return 'NOROW'; row.click(); return 'KLIK';})()" 2>&1 | tail -1
eb_cakaj 2

echo "--- B: more→vodja — sidro 'Sistem — zdravje' (VEDNO L2196) → val 55 'Zamujena dobava' (L2122) + 'Poskusi znova' (L228, vrata: napaka) ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Sistem — zdravje') && [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi ')).length >= 3;})()" 30
agent-browser eval "JSON.stringify({
  sidroZdravjeKartica: document.body.textContent.includes('Sistem — zdravje'),
  vodjaZamujenaMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')).length,
  vodjaZamujenaRed40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')&&(b.className||'').includes('ring-roksal-red/40')).length,
  vodjaZamujenaOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')&&(b.className||'').includes('ring-offset-2')).length,
  vodjaZamujenaOznake: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')).map(b=>b.getAttribute('aria-label')),
  poskusiZnovaMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Ponovno preveri zdravje sistema').length,
  zdravjeNapakaVidna: !!document.querySelector('main [role=\"alert\"]'),
  zdravjeVsebinaOk: document.body.textContent.includes('Baza odgovarja') || document.body.textContent.includes('ms')
})" 2>&1 | tail -1
eb_sonda_red_stetje

echo "--- C: measurements — 'Izbriši meritev' (L3351, vrata: merilna vrstica) ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi preglednico stebrov kot CSV') || document.body.textContent.includes('segment');})()" 30
eb_cakaj 3
agent-browser eval "JSON.stringify({
  izbrisiMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši meritev ')).length,
  izbrisiRed40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši meritev ')&&(b.className||'').includes('ring-roksal-red/40')).length,
  izbrisiOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši meritev ')&&(b.className||'').includes('ring-offset-2')).length,
  podvojiMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Podvoji meritev ')).length,
  steberCsvMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi preglednico stebrov kot CSV').length,
  niMeritevDiskResnica: document.body.textContent.includes('ni meritev') || document.body.textContent.includes('V tem segmentu ni meritev') || document.body.textContent.includes('Izberi projekt')
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- D: kolektor ---"
eb_preberi_kolektor r373err2

agent-browser close --all >/dev/null 2>&1
echo "=== R373 re-proba KONEC ==="
