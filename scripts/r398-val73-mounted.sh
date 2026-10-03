#!/usr/bin/env bash
# r398-val73-mounted.sh — R398 val 73 MONTIRANI dokaz (LOKALNI build —
# prod verifikacija sledi ob R399 52. preverbi, kanon: CSS needle se
# razreši ob R398 deployu; ZERO-MUTACIJA — samo sonde + screenshot).
# Rekurziven CSSOM walk (LEKCIJA R397 (4)) — pričakujemo:
#   root > media[(prefers-reduced-motion: reduce)] > utilities >
#   .animate-fade-in-up,.slide-in-right { animation: none }
#   + .stagger-children>* { opacity:1; animation:none }
#   + val 72 zliti guard bajtno nespremenjen.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

EB_BASE="http://localhost:3100"
agent-browser close --all >/dev/null 2>&1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; exit 1; }
eb_zapri_vodic || true

echo "--- val 73 MONTIRANI dokaz (rekurzivni CSSOM walk: fade-in-up/slide-in-right) ---"
agent-browser eval "JSON.stringify((function(){const zadetki=[];const walk=(pravila,pot)=>{if(!pravila)return;for(const p of pravila){if(p.selectorText&&(p.selectorText.includes('animate-fade-in-up')||p.selectorText.includes('slide-in-right')||p.selectorText.includes('stagger-children'))){zadetki.push(pot+' > '+p.selectorText+' { '+(p.style?p.style.cssText.slice(0,90):'')+' }');}const g=p.cssRules;if(g)walk(g,pot+' > '+(p.selectorText||p.name||p.constructor.name));}};for(const ss of document.styleSheets){let r;try{r=ss.cssRules;}catch(e){continue;}walk(r,'root');}return {stevilo: zadetki.length, pravila: zadetki.slice(0,6)};})())" 2>&1 | tail -1

echo "--- val 73 media-guard pot (pričakujemo media[prefers-reduced-motion] > vstopni guardi) ---"
agent-browser eval "JSON.stringify((function(){const poti=[];const walk=(pravila,pot)=>{if(!pravila)return;for(const p of pravila){if(p.constructor.name==='CSSMediaRule'&&p.conditionText&&p.conditionText.includes('prefers-reduced-motion')){for(const q of p.cssRules){if(q.selectorText&&(q.selectorText.includes('fade-in-up')||q.selectorText.includes('stagger-children'))){poti.push(pot+' > '+q.selectorText+' { '+q.style.cssText+' }');}}}const g=p.cssRules;if(g)walk(g,pot);}};for(const ss of document.styleSheets){let r;try{r=ss.cssRules;}catch(e){continue;}walk(r,'root');}return {stevilo: poti.length, pot: poti[0]||null};})())" 2>&1 | tail -1

echo "--- val 72 med-stražarski rok: zliti guard še ŽIVO v istem dokumentu ---"
agent-browser eval "JSON.stringify((function(){const poti=[];const walk=(pravila)=>{if(!pravila)return;for(const p of pravila){if(p.selectorText&&p.selectorText.includes('badge-pulse')){poti.push(p.selectorText+' { '+p.style.cssText.slice(0,60)+' }');}const g=p.cssRules;if(g)walk(g);}};for(const ss of document.styleSheets){let r;try{r=ss.cssRules;}catch(e){continue;}walk(r);}return {stevilo: poti.length};})())" 2>&1 | tail -1

agent-browser screenshot /tmp/r398-val73-mounted.png 2>&1 | tail -1
agent-browser close --all >/dev/null 2>&1
echo "=== MOUNTED PROBE KONEC (val 73, lokalni build) ==="
