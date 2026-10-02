#!/usr/bin/env bash
# r377-qa-spot.sh — R377 produkcija QA spot seja (spot-r167/21;
# ZERO-MUTACIJA — SAMO sonde + navigacijski dispatch, NI klikov na
# destruktivna/mutirajoča gumba; e2e-lib kanon r231). Fokus:
# (a) val 57 POST-deploy verifikacija — 4 needleji r375.tsv (era preverba
#     DEVETINDVJSETIJNA dokazuje ŽIVO DIREKTNO v chunk_026 ×4; ta sonda
#     dokumentira MONTIRANO DOM resnico z mounted + className LOČENO,
#     LEKCIJA R365 (4); VSAKA površina z dispatch + pocakaj — LEKCIJA
#     R370 (6); sidro = merilne površine z izbranim projektom):
#     N1 'Status meritve …' chip (L3125 — vrata: vrstica meritve izbranega
#       projekta), N2 'Naloži predlogo meritev …' (L3675 — vrata: predloge
#       projekta), N3 'Dodaj stebriček v segment …' (L4754 — vrata:
#       segmenti izračuna), N4 'Dodaj izračunane WPC palice …' (L4768 —
#       vrata: WPC segmenti). DEMO seja 'Ni projektov' (disk resnica,
#       testid meritve-brez-projektov) → pričakuj VSE 4 iskreno
#       NEmontirane z razlogom iz diska (kanon r277);
# (b) sonde: eb_sonda_navy_stetje + eb_sonda_red_stetje + val 57
#     border-pariteta pokritost med MONTIRANIMI navy gumbi;
# (c) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R377 QA spot seja (spot-r167/21 — val 57 POST-deploy) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r377err

echo "--- A: measurements — sidro 'meritve-brez-projektov' (VEDNO, disk resnica vrata) → val 57 N1/N2/N3/N4 ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('[data-testid=\"meritve-brez-projektov\"]');})()" 30
agent-browser eval "JSON.stringify({
  brezProjektovTestid: document.querySelectorAll('[data-testid=\"meritve-brez-projektov\"]').length,
  niProjektovDiskResnica: document.body.textContent.includes('Ni projektov'),
  kajNaprejAria: !!document.querySelector('[aria-label=\"Kaj naprej\"]'),
  n1StatusChipMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Status meritve')).length,
  n1BorderPariteta: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Status meritve')&&(b.className||'').split(/\\s+/).includes('focus-visible:border-roksal-navy/40')).length,
  n2PredlogaMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Naloži predlogo meritev')).length,
  n2BorderPariteta: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Naloži predlogo meritev')&&(b.className||'').split(/\\s+/).includes('focus-visible:border-roksal-navy/40')).length,
  n3StebriMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Dodaj stebriček v segment')).length,
  n3BorderPariteta: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Dodaj stebriček v segment')&&(b.className||'').split(/\\s+/).includes('focus-visible:border-roksal-navy/40')).length,
  n4WpcMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Dodaj izračunane WPC palice')).length,
  n4BorderPariteta: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Dodaj izračunane WPC palice')&&(b.className||'').split(/\\s+/).includes('focus-visible:border-roksal-navy/40')).length,
  navyMontirani: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').split(/\\s+/).includes('focus-visible:ring-roksal-navy/40')).length,
  navyMontiraniBorderPar: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').split(/\\s+/).includes('focus-visible:ring-roksal-navy/40')&&(b.className||'').split(/\\s+/).includes('focus-visible:border-roksal-navy/40')).length,
  navyMontiraniDarkInk: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').split(/\\s+/).includes('focus-visible:ring-roksal-navy/40')&&(b.className||'').split(/\\s+/).includes('dark:focus-visible:border-roksal-ink/40')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- B: dashboard — kontrolna sonda (spregel val 56 spot B; disk resnica 'Ni projektov') ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV'));})()" 30
agent-browser eval "JSON.stringify({
  sidroCsv: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')).length,
  niProjektovDiskResnica: document.body.textContent.includes('Ni projektov'),
  pocistiIskanjeMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov').length,
  val58TargetTransition: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov'&&(b.className||'').split(/\\s+/).includes('transition-colors')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- C: kolektor ---"
eb_preberi_kolektor r377err

agent-browser close --all >/dev/null 2>&1
echo "=== R377 spot KONEC ==="
