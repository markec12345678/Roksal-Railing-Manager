#!/usr/bin/env bash
# r397-val71-mounted.sh — R397 val 71 MONTIRANI dokaz, popravljeni probe:
# REKURZIVEN sprehod čez document.styleSheets — pravilo val 71 živi V @layer
# utilities bloku (CSSLayerBlockRule), 1. probe (r397-visual-sweep.sh) je
# iteriral samo VRHOVNA pravila → lažno 0. LEKCIJA R397: CSSOM probe MORAJA
# rekurzirati v layer/media/podporne bloke (selectorText je samo na listih).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

agent-browser close --all >/dev/null 2>&1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; exit 1; }
eb_zapri_vodic

agent-browser eval "localStorage.setItem('theme','dark');location.reload();'reload'" >/dev/null 2>&1
sleep 7
echo "--- tema (pričakujemo dark) ---"
agent-browser eval "JSON.stringify({htmlClass: document.documentElement.className})" 2>&1 | tail -1

echo "--- val 71 MONTIRANI dokaz (rekurzivni CSSOM walk) ---"
agent-browser eval "JSON.stringify((function(){const zadetki=[];const walk=(pravila,pot)=>{if(!pravila)return;for(const p of pravila){if(p.selectorText&&p.selectorText.includes('scrollbar-thin')&&p.selectorText.includes('.dark')){zadetki.push(pot+' > '+p.selectorText+' { '+(p.style?p.style.cssText.slice(0,80):'')+' }');}const g=p.cssRules;if(g)walk(g,pot+' > '+(p.selectorText||p.name||p.constructor.name));}};for(const ss of document.styleSheets){let r;try{r=ss.cssRules;}catch(e){continue;}walk(r,'root');}return {stevilo: zadetki.length, prvi: zadetki[0]||null};})())" 2>&1 | tail -1

echo "--- scrollable element za pikselni dokaz (screenshot) ---"
agent-browser eval "(()=>{const el=[...document.querySelectorAll('.scrollbar-thin')].find(x=>x.scrollHeight>x.clientHeight+4);if(!el)return 'ni-aktivnega';el.scrollTop=8;return 'scroll-ok st='+el.className.slice(0,60);})()" 2>&1 | tail -1
sleep 1
agent-browser screenshot /tmp/r397-val71-mounted-dark.png 2>&1 | tail -1

echo "--- nazaj na light (pomožna seja čista) ---"
agent-browser eval "localStorage.setItem('theme','light');'reset'" >/dev/null 2>&1
agent-browser close --all >/dev/null 2>&1
echo "=== MOUNTED PROBE KONEC ==="
