#!/usr/bin/env bash
# r371-qa-spot.sh — R371 produkcija QA spot seja (spot-r167/16;
# ZERO-MUTACIJA; e2e-lib kanon r231). Fokus:
# (a) val 53 POST-deploy re-proba — navy/40 OFFSET-1 REP površine (era
#     preverba STIRIINDVJSETIJNA že dokazuje vse 4 needleje ŽIVO DIREKTNO
#     [chunk_043/chunk_028/chunk_037]; ta sonda dokumentira MONTIRANO DOM
#     resnico z mounted + className LOČENO, LEKCIJA R365 (4); VSAKA
#     površina z dispatch + pocakaj — LEKCIJA R370 (6)):
#     dashboard 'Izvozi prikazane projekte v CSV' (L1678 — VEDNO montiran;
#     shadcn kit override = namerna izjema #1 — offset NAMERNO 0, dokumentiramo
#     izjemo ŽIVO), vodja izvozni pilli ×3 (L1274/1290/1306 — aria
#     'Izvozi …', pričakuj montirane z offset-2), invoice pilli (crm tab:
#     L1045 'Izvozi račune kot CSV' + L1061 'Izvozi prihodke kot PDF' +
#     L1182 'Izvozi prihodke po mesecih kot CSV' — pogojeni s seznamom
#     računov), calculator 'Zgodovina izračunov' (L4382 — pogojen z
#     zgodovino); PRIČAKUJ vodja/dash/invoice pilli montirani (toolbar),
#     calculator glede na demo zgodovino (kanon r277 — razlog iz vira);
# (b) sonde: 4. uporaba eb_sonda_navy_stetje + 3. uporaba
#     eb_sonda_red_stetje;
# (c) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R371 QA spot seja (spot-r167/16 — val 53 POST-deploy navy O1-rep re-probe) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r371err

echo "--- A: dashboard — Izvozi CSV (kit override, offset NAMERNO 0) + sonde ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV'));})()" 20
agent-browser eval "JSON.stringify({
  izvoziCsvMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')).length,
  izvoziCsvKitOverride: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length,
  izvoziCsvOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- B: vodja — izvozni pilli ×3 (L1274/1290/1306, vrata: more→vodja) ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi ')).length >= 3;})()" 20
agent-browser eval "JSON.stringify({
  vodjaIzvozni: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi ')).length,
  vodjaIzvozniNavy40: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi ')&&(b.className||'').includes('ring-roksal-navy/40')).length,
  vodjaIzvozniOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi ')&&(b.className||'').includes('ring-offset-2')).length,
  vodjaIzvozniBrezOffseta: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi ')&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- C: crm/invoice — pilli (L1045/L1061/L1182, vrata: seznam računov) ---"
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi račune kot CSV');})()" 20
agent-browser eval "JSON.stringify({
  racuniCsvMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi račune kot CSV').length,
  racuniCsvOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi račune kot CSV'&&(b.className||'').includes('ring-offset-2')).length,
  prihodkiPdfMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi prihodke kot PDF').length,
  prihodkiPdfOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi prihodke kot PDF'&&(b.className||'').includes('ring-offset-2')).length,
  meseciCsvMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi prihodke po mesecih kot CSV').length,
  meseciCsvOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi prihodke po mesecih kot CSV'&&(b.className||'').includes('ring-offset-2')).length,
  racuniPrazninaRazlog: document.body.textContent.includes('Ni računov') || document.body.textContent.includes('Brez računov')
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- D: calculator — Zgodovina izračunov (L4382, vrata: zgodovina) ---"
eb_dispatch '{"tab":"calculator","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Zgodovina izračunov') || document.body.textContent.includes('Nov izračun');})()" 20
agent-browser eval "JSON.stringify({
  zgodovinaMounted: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').includes('Zgodovina izračunov')).length,
  zgodovinaOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').includes('Zgodovina izračunov')&&(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- E: kolektor ---"
eb_preberi_kolektor r371err

agent-browser close --all >/dev/null 2>&1
echo "=== R371 spot KONEC ==="
