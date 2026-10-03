#!/usr/bin/env bash
# r396-visual-sweep.sh — R396 vizualni lov dark-mode (kanon popravljen:
# samo isti-origin location.reload() — NIKOLI open localhost, LEKCIJA R396).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

agent-browser close --all >/dev/null 2>&1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; exit 1; }
eb_zapri_vodic

echo "--- light: dashboard ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 4
agent-browser screenshot /tmp/r396-dash-light.png 2>&1 | tail -1

echo "--- dark preklop (isti origin: localStorage + reload) ---"
agent-browser eval "localStorage.setItem('theme','dark');location.reload();'reload'" >/dev/null 2>&1
sleep 7
agent-browser eval "JSON.stringify({htmlClass: document.documentElement.className, bodyBg: getComputedStyle(document.body).backgroundColor})" 2>&1 | tail -1
agent-browser screenshot /tmp/r396-dash-dark.png 2>&1 | tail -1

echo "--- dark: kalkulator ---"
eb_dispatch '{"tab":"calculator","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 5
agent-browser screenshot /tmp/r396-calc-dark.png 2>&1 | tail -1

echo "--- dark: inventory ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 5
agent-browser screenshot /tmp/r396-inv-dark.png 2>&1 | tail -1

echo "--- dark: kalkulator focus ring na gumbu (Navidke za prihodnost) ---"
agent-browser eval "JSON.stringify((function(){const b=[...document.querySelectorAll('button')].find(x=>(x.className||'').includes('bg-roksal-navy'));if(!b)return{najden:false};b.focus();const cs=getComputedStyle(b);return {najden:true, outlineStyle: cs.outlineStyle, boxShadow: cs.boxShadow.slice(0,60), classImaFvHidden: (b.className||'').includes('focus-visible:outline-hidden')};})())" 2>&1 | tail -1

echo "--- nazaj na light (pomožna seja čista) ---"
agent-browser eval "localStorage.setItem('theme','light');'reset'" >/dev/null 2>&1
agent-browser close --all >/dev/null 2>&1
echo "=== SWEEP KONEC ==="
