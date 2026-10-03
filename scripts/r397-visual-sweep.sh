#!/usr/bin/env bash
# r397-visual-sweep.sh — R397 agent-browser QA + val 71 POST-deploy MONTIRANI
# dokaz (kanon popravljen: samo isti-origin location.reload() — NIKOLI open
# localhost, LEKCIJA R396 (4); ZERO-MUTACIJA — samo sonde + dispatch + screenshot).
#
# val 71 mounted dokaz (handover R396 (D)): CSS-nivojski needle je ŽIVO na
# prod CDN (5fc36b66bd1b4dfb.css — curl grep, ločen dokaz); MONTIRANI dokaz =
# document.styleSheets pravilo `.dark .scrollbar-thin::-webkit-scrollbar-thumb`
# prisotno v ŽIVEM dokumentu v temni temi + dark screenshoti (::-webkit-
# scrollbar-thumb NI berljiv prek getComputedStyle — pravilo v styleSheets
# + pikselni palec na sliki = iskren montirani dokaz, brez izuma).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

agent-browser close --all >/dev/null 2>&1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; exit 1; }
eb_zapri_vodic

echo "--- light: dashboard ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 4
agent-browser screenshot /tmp/r397-dash-light.png 2>&1 | tail -1

echo "--- dark preklop (isti origin: localStorage + reload) ---"
agent-browser eval "localStorage.setItem('theme','dark');location.reload();'reload'" >/dev/null 2>&1
sleep 7
agent-browser eval "JSON.stringify({htmlClass: document.documentElement.className, bodyBg: getComputedStyle(document.body).backgroundColor})" 2>&1 | tail -1

echo "--- val 71 MONTIRANI dokaz: pravilo v document.styleSheets ---"
agent-browser eval "JSON.stringify((function(){const zelja='.dark .scrollbar-thin::-webkit-scrollbar-thumb';let najdeno=[];for(const ss of document.styleSheets){let pravila;try{pravila=ss.cssRules;}catch(e){continue;}if(!pravila)continue;for(const p of pravila){if(p.selectorText&&p.selectorText.includes('scrollbar-thin')&&p.selectorText.includes('.dark')){najdeno.push(p.selectorText+' { '+(p.style?p.style.cssText.slice(0,60):'')+' }');}}}return {stevilo: najdeno.length, prva: najdeno[0]||null};})())" 2>&1 | tail -1

agent-browser screenshot /tmp/r397-dash-dark.png 2>&1 | tail -1

echo "--- dark: kalkulator + inventar (QA pregled) ---"
eb_dispatch '{"tab":"calculator","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 5
agent-browser screenshot /tmp/r397-calc-dark.png 2>&1 | tail -1
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 5
agent-browser screenshot /tmp/r397-inv-dark.png 2>&1 | tail -1

echo "--- nazaj na light (pomožna seja čista) ---"
agent-browser eval "localStorage.setItem('theme','light');'reset'" >/dev/null 2>&1
agent-browser close --all >/dev/null 2>&1
echo "=== SWEEP KONEC ==="
