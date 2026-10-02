#!/usr/bin/env bash
# r372-qa-spot.sh — R372 produkcija QA spot seja (spot-r167/17;
# ZERO-MUTACIJA; e2e-lib kanon r231). Fokus:
# (a) val 54 POST-deploy re-proba — 13 SUROVIH brand vrstic (era preverba
#     PETINDVJSETIJNA že dokazuje vse 4 needleje ŽIVO DIREKTNO
#     [chunk_028/chunk_043]; ta sonda dokumentira MONTIRANO DOM resnico z
#     mounted + className LOČENO, LEKCIJA R365 (4); VSAKA površina z
#     dispatch + pocakaj — LEKCIJA R370 (6)):
#     A dashboard: 'Arhiviraj projekt' (L1756 — vrstični gumbi, VEDNO
#       montirani z demo projekti) + iskanje: vnos ≠ prazno → 'Počisti
#       iskanje projektov' (L1628 — natipkamo v iskalni vnos prek native
#       setterja, ZERO-MUTACIJA: samo UI stanje);
#     B podrobnosti → revizijska sled: chips L249 (aria-pressed) + razpenjanje
#       L310 (aria-expanded) — vrata: podrobnosti odprte (klik prve vrstice);
#     C inclinometer: 'Izvozi terenski pregled nagibov kot PDF' (L341 — vrata:
#       projectId izbran v A);
#     D measurements: SteberTable 'Izvozi preglednico stebrov kot CSV' (L69 —
#       vrata: projekt + segment) + inline urednika (inline-inclinometer L131 +
#       inline-kotomer L185 — vrata: inline urejanje odprto, pričakuj iskreno
#       NEmontirano);
#     E photos: 'Uredi mero' (L2370 — vrata: projekt + meritve);
#     F more→documents: 'Izvozi pregled stanja zapisnika kot PDF' (L531 —
#       vrata: projekt, PunchList VEDNO montiran znotraj documents);
#     G calculator: 'Počisti uvoz meritve' (L860 — vrata: importedFromMeasurement)
#       + zgodovina vrstice 'Naloži izračun: …' (L4439 — vrata: history.length > 0,
#       odpremo 'Zgodovina izračunov' preklopnik L4382);
#     H more→ekipa: 'Izvozi telemetrijo omejevanja hitrosti kot CSV' (L226 —
#       vrata: myRole === 'ADMIN');
# (b) sonde: 5. uporaba eb_sonda_navy_stetje + 4. uporaba eb_sonda_red_stetje;
# (c) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R372 QA spot seja (spot-r167/17 — val 54 POST-deploy surove brand vrstice) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r372err

echo "--- A1: dashboard — vrstični gumbi 'Arhiviraj projekt' (L1756) ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt');})()" 20
agent-browser eval "JSON.stringify({
  arhivirajMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt').length,
  arhivirajNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  arhivirajOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt'&&(b.className||'').includes('ring-offset-2')).length,
  arhivirajBrezOffseta: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Arhiviraj projekt'&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- A2: dashboard — iskanje natipkano → 'Počisti iskanje projektov' (L1628) ---"
agent-browser eval "(()=>{const el=[...document.querySelectorAll('main input')].find(i=>(i.placeholder||'').includes('Išči projekte')); if(!el) return 'NOINPUT'; const st=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; st.call(el,'roksal'); el.dispatchEvent(new Event('input',{bubbles:true})); return 'TYPED';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov');})()" 10
agent-browser eval "JSON.stringify({
  pocistiIskanjeMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov').length,
  pocistiIskanjeNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  pocistiIskanjeOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov'&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_klik_gumb "Počisti iskanje projektov"

echo "--- A3: dashboard — klik prve projektne vrstice (izbira projekta + podrobnosti) ---"
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

echo "--- C: inclinometer — 'Izvozi terenski pregled nagibov kot PDF' (L341, vrata: projekt) ---"
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi terenski pregled nagibov kot PDF') || document.body.textContent.includes('Izberi projekt');})()" 20
agent-browser eval "JSON.stringify({
  nagibiPdfMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi terenski pregled nagibov kot PDF').length,
  nagibiPdfNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi terenski pregled nagibov kot PDF'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  nagibiPdfOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi terenski pregled nagibov kot PDF'&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- D: measurements — SteberTable CSV (L69) + inline urednika (L131/L185) ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi preglednico stebrov kot CSV') || document.body.textContent.includes('segment');})()" 20
agent-browser eval "JSON.stringify({
  steberCsvMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi preglednico stebrov kot CSV').length,
  steberCsvNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi preglednico stebrov kot CSV'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  steberCsvOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi preglednico stebrov kot CSV'&&(b.className||'').includes('ring-offset-2')).length,
  inlineNagibMounted: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')&&(b.className||'').includes('p-1.5')).length,
  inlineBrezOffseta: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')&&(b.className||'').includes('p-1.5')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- E: photos — 'Uredi mero' (L2370, vrata: projekt + meritve) ---"
eb_dispatch '{"tab":"photos","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  urediMeroMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Uredi mero').length,
  urediMeroNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Uredi mero'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  urediMeroOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Uredi mero'&&(b.className||'').includes('ring-offset-2')).length,
  photosVrataRazlog: document.body.textContent.includes('Izberi projekt') || document.body.textContent.includes('Brez meritev')
})" 2>&1 | tail -1

echo "--- F: more→documents — 'Izvozi pregled stanja zapisnika kot PDF' (L531) ---"
eb_dispatch '{"tab":"more","more":"documents","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled stanja zapisnika kot PDF') || document.body.textContent.includes('zapisnik');})()" 20
agent-browser eval "JSON.stringify({
  zapisnikPdfMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled stanja zapisnika kot PDF').length,
  zapisnikPdfNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled stanja zapisnika kot PDF'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  zapisnikPdfOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled stanja zapisnika kot PDF'&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- G: calculator — 'Počisti uvoz meritve' (L860) + zgodovina vrstice (L4439) ---"
eb_dispatch '{"tab":"calculator","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Zgodovina izračunov') || document.body.textContent.includes('Nov izračun');})()" 20
agent-browser eval "(()=>{const g=[...document.querySelectorAll('main button')].find(b=>(b.textContent||'').includes('Zgodovina izračunov')); if(!g) return 'NIGUMB'; g.click(); return 'KLIK';})()" 2>&1 | tail -1
eb_cakaj 2
agent-browser eval "JSON.stringify({
  pocistiUvozMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti uvoz meritve').length,
  pocistiUvozOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti uvoz meritve'&&(b.className||'').includes('ring-offset-2')).length,
  zgodovinaVrsticeMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Naloži izračun:')).length,
  zgodovinaVrsticeNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Naloži izračun:')&&(b.className||'').includes('ring-roksal-navy/40')).length,
  zgodovinaVrsticeOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Naloži izračun:')&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- H: more→ekipa — 'Izvozi telemetrijo omejevanja hitrosti kot CSV' (L226, vrata: ADMIN) ---"
eb_dispatch '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi telemetrijo omejevanja hitrosti kot CSV') || document.body.textContent.includes('omejevanje');})()" 20
agent-browser eval "JSON.stringify({
  telemetrijaCsvMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi telemetrijo omejevanja hitrosti kot CSV').length,
  telemetrijaCsvNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi telemetrijo omejevanja hitrosti kot CSV'&&(b.className||'').includes('ring-roksal-navy/40')).length,
  telemetrijaCsvOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi telemetrijo omejevanja hitrosti kot CSV'&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- I: kolektor ---"
eb_preberi_kolektor r372err

agent-browser close --all >/dev/null 2>&1
echo "=== R372 spot KONEC ==="
