#!/usr/bin/env bash
# r370-qa-spot.sh — R370 produkcija QA spot seja (spot-r167/15;
# ZERO-MUTACIJA; e2e-lib kanon r231). Fokus:
# (a) val 52 POST-deploy re-proba — navy+ink PARIŠKE površine (era preverba
#     TRIINDVJSETIJNA že dokazuje needleje iz registra prek hash rezolucije
#     [3abf34ec… + dc5a9c95… HTTP 200]; ta sonda dokumentira MONTIRANO DOM
#     resnico z mounted + className LOČENO, LEKCIJA R365 (4)):
#     bottom-nav glavni zavihki (L123 — VEDNO montirani), FAB menu item
#     (L92 — pogojen z odprtim menijem), obvestilne kartice (L881 —
#     pogojene s seznamom), 'Označi vse kot prebrano' (L855 — vrata:
#     neprebrana > 0), FAILED_LOGINS_OVERVIEW gumb (L940 — vrata: template),
#     termini-card vrstice (L336/352/398/417/431/442 — vrata: seznam terminov
#     kartice na dashboardu); PRIČAKUJ bottom-nav montiran, ostalo glede na
#     demo podatke (kanon r277 — razlog iz vira, ne tiha 'false');
# (b) sonde: 3. uporaba eb_sonda_navy_stetje (val 47/49/51 stabilnost) +
#     2. uporaba eb_sonda_red_stetje;
# (c) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R370 QA spot seja (spot-r167/15 — val 52 POST-deploy navy+ink pari re-probe) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r370err

echo "--- A: bottom-nav — VEDNO montirane pariške vrstice (L123) ---"
agent-browser eval "JSON.stringify({
  navGumbiNavy40: [...document.querySelectorAll('nav button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')).length,
  navGumbiNavy40Ink40: [...document.querySelectorAll('nav button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('dark:focus-visible:ring-roksal-ink/40')).length,
  navGumbiOffset2: [...document.querySelectorAll('nav button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length,
  navGumbiBrezOffseta: [...document.querySelectorAll('nav button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- B: FAB meni — hitre akcije item (L92, vrata: meni odprt) ---"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Hitre akcije'); if(!z) return 'ni sprožilca'; z.click(); return 'klik';})()" 2>&1 | tail -1
eb_cakaj 2
agent-browser eval "JSON.stringify({
  menuitemMounted: [...document.querySelectorAll('[role=menuitem]')].length,
  menuitemNavy40Ink40: [...document.querySelectorAll('[role=menuitem]')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('dark:focus-visible:ring-roksal-ink/40')).length,
  menuitemOffset2: [...document.querySelectorAll('[role=menuitem]')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Zapri hitre akcije'); if(!z) return 'ni zapiralnika'; z.click(); return 'klik';})()" >/dev/null 2>&1
eb_cakaj 1

echo "--- C: Obvestila — Sheet kartice navy/40 (L881) + Označi vse (L855) + FAILED_LOGINS (L940) ---"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!z) return 'ni zvoncka'; z.click(); return 'klik';})()" 2>&1 | tail -1
eb_cakaj 2
agent-browser eval "JSON.stringify({
  karticeNavy40: [...document.querySelectorAll('[role=\"dialog\"] button, [data-state=\"open\"] button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('dark:focus-visible:ring-roksal-ink/40')).length,
  karticeNavy40Offset2: [...document.querySelectorAll('[role=\"dialog\"] button, [data-state=\"open\"] button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length,
  oznaciVseMounted: [...document.querySelectorAll('[role=\"dialog\"] button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Označi vse kot prebrano')),
  oznaciVseNavy40Ink40: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Označi vse kot prebrano')&&(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('dark:focus-visible:ring-roksal-ink/40')&&(b.className||'').includes('ring-offset-2')).length,
  failedLoginsMounted: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>(b.getAttribute('aria-label')||'')==='Odpri Ekipa — pregled ekipnih računov').length,
  prazenSeznam: document.body.textContent.includes('Ni obvestil') || document.body.textContent.includes('ni obvestil')
})" 2>&1 | tail -1
agent-browser eval "(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" > /dev/null 2>&1
eb_cakaj 1

echo "--- D: dashboard Termini kartica — pariške vrstice (L336/352/398/417/431/442, vrata: seznam terminov) ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  pariNavyInk40: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('dark:focus-visible:ring-roksal-ink/40')).length,
  pariNavyInk40Offset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('dark:focus-visible:ring-roksal-ink/40')&&(b.className||'').includes('ring-offset-2')).length,
  pariBrezOffseta: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('dark:focus-visible:ring-roksal-ink/40')&&!(b.className||'').includes('ring-offset')).length,
  terminiPrazninaRazlog: document.body.textContent.includes('Ni terminov') || document.body.textContent.includes('Brez terminov')
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- E: kolektor ---"
eb_preberi_kolektor r370err

agent-browser close --all >/dev/null 2>&1
echo "=== R370 spot KONEC ==="
