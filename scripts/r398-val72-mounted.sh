#!/usr/bin/env bash
# r398-val72-mounted.sh — R398 val 72 MONTIRANI dokaz (ZERO-MUTACIJA —
# samo sonde + screenshot; vzorec r397-val71-mounted.sh): rekurziven
# sprehod čez document.styleSheets (LEKCIJA R397 (4): CSSOM probe MORA
# rekurzirati v layer/media bloke — pravilo val 72 živi V
# @media (prefers-reduced-motion: reduce) znotraj @layer utilities;
# vrhovna iteracija = lažno 0). Pričakujemo zliti selector list
# .badge-pulse,.shine-effect:after,.animate-pulse-soft,.shimmer,
# .animate-bounce-subtle { animation: none } pod CSSMediaRule.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

agent-browser close --all >/dev/null 2>&1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; exit 1; }
eb_zapri_vodic

echo "--- val 72 MONTIRANI dokaz (rekurzivni CSSOM walk: badge-pulse) ---"
agent-browser eval "JSON.stringify((function(){const zadetki=[];const walk=(pravila,pot)=>{if(!pravila)return;for(const p of pravila){if(p.selectorText&&p.selectorText.includes('badge-pulse')){zadetki.push(pot+' > '+p.selectorText+' { '+(p.style?p.style.cssText.slice(0,120):'')+' }');}const g=p.cssRules;if(g)walk(g,pot+' > '+(p.selectorText||p.name||p.constructor.name));}};for(const ss of document.styleSheets){let r;try{r=ss.cssRules;}catch(e){continue;}walk(r,'root');}return {stevilo: zadetki.length, pravila: zadetki};})())" 2>&1 | tail -1

echo "--- val 72 media-guard pot (pričakujemo root > @media prefers-reduced-motion > utilities) ---"
agent-browser eval "JSON.stringify((function(){const poti=[];const walk=(pravila,pot)=>{if(!pravila)return;for(const p of pravila){if(p.constructor.name==='CSSMediaRule'&&p.conditionText&&p.conditionText.includes('prefers-reduced-motion')){for(const q of p.cssRules){if(q.selectorText&&q.selectorText.includes('badge-pulse')){poti.push(pot+' > media['+p.conditionText.slice(0,30)+'] > '+q.selectorText+' { '+q.style.cssText+' }');}}}const g=p.cssRules;if(g)walk(g,pot);}};for(const ss of document.styleSheets){let r;try{r=ss.cssRules;}catch(e){continue;}walk(r,'root');}return {stevilo: poti.length, pot: poti[0]||null};})())" 2>&1 | tail -1

echo "--- badge-pulse živ element na plošči (raba disk resnica ×1: dashboard-tab) ---"
agent-browser eval "JSON.stringify((function(){const el=document.querySelector('.badge-pulse');return el?{najden:true,razred:el.className.slice(0,80)}:{najden:false};})())" 2>&1 | tail -1

agent-browser screenshot /tmp/r398-val72-mounted.png 2>&1 | tail -1
agent-browser close --all >/dev/null 2>&1
echo "=== MOUNTED PROBE KONEC (val 72) ==="
