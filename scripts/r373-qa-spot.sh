#!/usr/bin/env bash
# r373-qa-spot.sh — R373 produkcija QA spot seja (spot-r167/18;
# ZERO-MUTACIJA — SAMO sonde + navigacijski dispatch, NI klikov na
# destruktivna/mutirajoča gumba; e2e-lib kanon r231). Fokus:
# (a) val 55 POST-deploy verifikacija — 4 needleji r372.tsv (era preverba
#     ŠESTINDVJSETIJNA že dokazuje vse 4 ŽIVO DIREKTNO [chunk_028/chunk_023/
#     chunk_026]; ta sonda dokumentira MONTIRANO DOM resnico z mounted +
#     className LOČENO, LEKCIJA R365 (4); VSAKA površina z dispatch +
#     pocakaj — LEKCIJA R370 (6); zaporedje sidro → vrstice → šele nato
#     pogojni vnosi — LEKCIJA R372 (2)):
#     A dashboard: 'Zamujena dobava' (L1987 — SUB O1→O2, vrata:
#       !narocilaLoading && !narocilaError && zamujeneDobaveDomov > 0 —
#       R230 iskren prikaz, brez lažnega 0; sidro 'Arhiviraj projekt');
#     B more→vodja: 'Zamujena dobava' (L2122 — SUB O1→O2, vrata:
#       stats.zamujeneDobave > 0; sidro 'Sistem — zdravje' kartica, VEDNO
#       montirana L2196) + sistem-zdravje 'Poskusi znova' (L228 — vrata:
#       napaka [health-check error stanje] — pričakuj iskreno NEmontirano,
#       kanon r277);
#     C measurements: 'Izbriši meritev' (L3351 — INS offset-2, vrata:
#       merilna vrstica v segmentu/skupini [segMeas.length > 0 /
#       group.measurements]);
# (b) sonde: 6. uporaba eb_sonda_navy_stetje + 5. uporaba
#     eb_sonda_red_stetje;
# (c) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R373 QA spot seja (spot-r167/18 — val 55 POST-deploy) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r373err

echo "--- A: dashboard — 'Zamujena dobava' (L1987, vrata: zamujeneDobaveDomov > 0) ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt');})()" 20
agent-browser eval "JSON.stringify({
  zamujenaMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')).length,
  zamujenaRed40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')&&(b.className||'').includes('ring-roksal-red/40')).length,
  zamujenaOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')&&(b.className||'').includes('ring-offset-2')).length,
  zamujenaOznake: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')).map(b=>b.getAttribute('aria-label')),
  sidroArhiviraj: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt').length,
  globalRed40: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-red/40')).length,
  globalRed40Offset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-red/40')&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- B: more→vodja — 'Zamujena dobava' (L2122, vrata: stats.zamujeneDobave > 0) + sistem-zdravje (L228, vrata: napaka) ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Sistem — zdravje') && [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi ')).length >= 3;})()" 20
agent-browser eval "JSON.stringify({
  sidroZdravjeKartica: document.body.textContent.includes('Sistem — zdravje'),
  vodjaZamujenaMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')).length,
  vodjaZamujenaRed40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')&&(b.className||'').includes('ring-roksal-red/40')).length,
  vodjaZamujenaOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')&&(b.className||'').includes('ring-offset-2')).length,
  vodjaZamujenaOznake: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')).map(b=>b.getAttribute('aria-label')),
  poskusiZnovaMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Ponovno preveri zdravje sistema').length,
  zdravjeNapakaVidna: !!document.querySelector('main [role=\"alert\"]'),
  globalRed40: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-red/40')).length,
  globalRed40Offset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-red/40')&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_red_stetje

echo "--- C: measurements — 'Izbriši meritev' (L3351, vrata: merilna vrstica) ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi preglednico stebrov kot CSV') || document.body.textContent.includes('segment');})()" 20
eb_cakaj 3
agent-browser eval "JSON.stringify({
  izbrisiMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši meritev ')).length,
  izbrisiRed40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši meritev ')&&(b.className||'').includes('ring-roksal-red/40')).length,
  izbrisiOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši meritev ')&&(b.className||'').includes('ring-offset-2')).length,
  izbrisiBrezOffseta: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši meritev ')&&(b.className||'').includes('ring-roksal-red/40')&&!(b.className||'').includes('ring-offset')).length,
  podvojiMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Podvoji meritev ')).length,
  globalRed40: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-red/40')).length,
  globalRed40Offset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-red/40')&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- D: kolektor ---"
eb_preberi_kolektor r373err

agent-browser close --all >/dev/null 2>&1
echo "=== R373 spot KONEC ==="
