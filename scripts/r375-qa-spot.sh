#!/usr/bin/env bash
# r375-qa-spot.sh — R375 produkcija QA spot seja (spot-r167/19;
# ZERO-MUTACIJA — SAMO sonde + navigacijski dispatch, NI klikov na
# destruktivna/mutirajoča gumba; e2e-lib kanon r231). Fokus:
# (a) val 56 POST-deploy verifikacija — 4 needleji r373.tsv (era preverba
#     SEDEMINDVJSETIJNA + OSEMINDVJSETIJNA dokazujeta ŽIVO; ta sonda
#     dokumentira MONTIRANO DOM resnico z mounted + className LOČENO,
#     LEKCIJA R365 (4); VSAKA površina z dispatch + pocakaj — LEKCIJA
#     R370 (6); zaporedje sidro → vrstice → šele nato pogojni vnosi —
#     LEKCIJA R372 (2)):
#     A photos: N1 'Izbriši sliko' (L978 — white RAW, vrata: galerija
#       fotografij izbranega projekta [PhotoTab projectId + loadPhotos]),
#       N2 'Zapri slikanje' (L1414 — white/60 RAW, vrata: cameraOpen
#       prek 'Slikaj' disabled={!projectId}), N3 'Zapri urejevalnik
#       anotacij' (L2048 — white/60 RAW, vrata: annotationPhoto); sidro
#       'Slikaj' VEDNO montirano — disabled stanje dokumentira vrata iz
#       diska (demo seja: Ni projektov → selectedProjectId null);
#     B dashboard: N4 'Pokliči stranko' (L1742 — roksal-green/40 RAW,
#       vrata: projekt vrstica — demo seja 'Ni projektov' [disk
#       resnica, kanon r277] → pričakuj iskreno NEmontirano z razlogom);
#       sidro CSV izvoz (VEDNO) + 'Ni projektov' disk resnica;
# (b) sonde: eb_sonda_navy_stetje + eb_sonda_red_stetje + BELA družina
#     števec (split token — 'ring-white' ≠ 'ring-white/60', meja
#     LEKCIJA R373 (4));
# (c) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R375 QA spot seja (spot-r167/19 — val 56 POST-deploy) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r375err

echo "--- A: photos — sidro 'Slikaj' (VEDNO, disabled=!projectId) → val 56 N1/N2/N3 ---"
eb_dispatch '{"tab":"photos","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.textContent||'').trim()==='Slikaj');})()" 20
agent-browser eval "JSON.stringify({
  slikajMounted: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').trim()==='Slikaj').length,
  slikajDisabled: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').trim()==='Slikaj'&&b.disabled).length,
  dodajGalerijiDisabled: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').trim()==='Dodaj iz galerije'&&b.disabled).length,
  pikaMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši sliko')).length,
  pikaWhiteClass: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši sliko')&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-white')).length,
  pikaOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izbriši sliko')&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length,
  zapriSlikanjeMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Zapri slikanje').length,
  zapriSlikanjeWhite60: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Zapri slikanje'&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-white/60')).length,
  zapriAnotacijeMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Zapri urejevalnik anotacij').length,
  galerijaSlik: [...document.querySelectorAll('main img')].length,
  belaDruzinaGumbi: [...document.querySelectorAll('main button')].filter(b=>['focus-visible:ring-white','focus-visible:ring-white/60'].some(t=>(b.className||'').split(/\\s+/).includes(t))).length,
  belaDruzinaOffset2: [...document.querySelectorAll('main button')].filter(b=>['focus-visible:ring-white','focus-visible:ring-white/60'].some(t=>(b.className||'').split(/\\s+/).includes(t))&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- B: dashboard — sidro CSV izvoz (VEDNO) → val 56 N4 'Pokliči stranko' (vrata: projekt vrstica) ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV'));})()" 30
agent-browser eval "JSON.stringify({
  sidroCsv: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')).length,
  niProjektovDiskResnica: document.body.textContent.includes('Ni projektov'),
  arhivirajVrstice: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt').length,
  pokliciMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Pokliči stranko').length,
  pokliciGreen40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Pokliči stranko'&&(b.className||'').includes('ring-roksal-green/40')).length,
  pokliciOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Pokliči stranko'&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length,
  globalGreen40: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-green/40')).length,
  globalGreen40Offset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-green/40')&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- C: kolektor ---"
eb_preberi_kolektor r375err

agent-browser close --all >/dev/null 2>&1
echo "=== R375 spot KONEC ==="
