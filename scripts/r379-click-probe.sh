#!/usr/bin/env bash
# r378-click-probe.sh — EN hitra seja: login → dashboard → tour-zaprt
# preverba → fill → PRAVI klik → stanje. Diagnostika spot-r167/22 C.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh
eb_odpri_in_prijavi >/dev/null 2>&1 || { echo "LOGIN FAIL"; exit 1; }
eb_zapri_vodic
echo "ozadje: $(agent-browser eval "(()=>{return document.querySelector('div.fixed.inset-0.z-\\\\[100\\\\]') ? 'ODPRT' : 'zaprto-dokazano';})()" 2>&1 | tail -1)"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}' >/dev/null 2>&1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV'));})()" 30
agent-browser fill 'input[placeholder="Išči projekte, stranke..."]' 'klik proba' >/dev/null 2>&1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov');})()" 15
agent-browser eval "$(cat /tmp/probe5.js)" 2>&1 | tail -1
echo "--- PRAVI klik ---"
agent-browser click 'button[aria-label="Počisti iskanje projektov"]' 2>&1 | tail -1
sleep 1
agent-browser eval "(()=>{const i=document.querySelector('input[placeholder=\"Išči projekte, stranke...\"]'); return JSON.stringify({vrednost: i ? i.value : null, gumb: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Počisti iskanje projektov').length});})()" 2>&1 | tail -1
agent-browser close --all >/dev/null 2>&1
