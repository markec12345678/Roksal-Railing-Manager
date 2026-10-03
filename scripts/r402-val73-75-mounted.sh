#!/usr/bin/env bash
# r402-val73-75-mounted.sh — R402 POST-deploy MONTIRANI dokazi za val 73/74/75
# na PRODU (handover NJIOVE R401: "val 73/74/75 POST-deploy MONTIRANI dokazi").
# Kanon: zamrznjeni r398-val73-mounted.sh cilja LOKALNI :3100 — ta NOVA
# skripta (kanon R358: hardening V NOVI skripti) cilja PRODU s prijavo.
# ZERO-MUTACIJA — samo sonde (CSSOM walk + getComputedStyle) + screenshot.
#
# Pričakovano (MONTIRANO na produ, build R401 = 2026-10-03T14:57:03Z):
#   val 73: media[(prefers-reduced-motion: reduce)] nosi
#           .animate-fade-in-up,.slide-in-right { animation:none }
#           + .stagger-children>* { opacity:1; animation:none }
#   val 74: .shimmer pravilo MONTIRANO + nalagalni skelet kartica nosi
#           razred .shimmer (getComputedStyle animationName = shimmer,
#           po potrebi prisotnost pravila v CSSOM — skeleton se montira
#           ob nalaganju; dokaz pravila je dovoljen, element je pogojen)
#   val 75: :root { color-scheme: light } + .dark { color-scheme: dark }
#           (getComputedStyle(documentElement).colorScheme = 'light';
#           hybridna oblika prepovedana — nikjer 'light dark')
set -u
cd /home/z/repo-analysis
source scripts/e2e-lib.sh

EB_BASE="https://roksal-railing-manager.vercel.app"
OUT="/tmp/r402-val-mounted"
mkdir -p "$OUT"

agent-browser close --all >/dev/null 2>&1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; exit 1; }

echo "=== val 73: reduced-motion vstopni animaciji MONTIRANI (CSSOM walk) ==="
agent-browser eval "JSON.stringify((function(){const poti=[];const walk=(pravila)=>{if(!pravila)return;for(const p of pravila){if(p.constructor.name==='CSSMediaRule'&&p.conditionText&&p.conditionText.includes('prefers-reduced-motion')){for(const q of p.cssRules){if(q.selectorText&&q.selectorText.includes('animate-fade-in-up')){poti.push(q.selectorText+' { '+q.style.cssText+' }');}}}const g=p.cssRules;if(g)walk(g);}};for(const ss of document.styleSheets){let r;try{r=ss.cssRules;}catch(e){continue;}walk(r);}return {stevilo: poti.length, prvi: poti[0]||null};})())" 2>&1 | tail -1

echo "=== val 74: .shimmer družina MONTIRANA (CSSOM) ==="
agent-browser eval "JSON.stringify((function(){const zadetki=[];const walk=(pravila)=>{if(!pravila)return;for(const p of pravila){if(p.selectorText&&(p.selectorText.includes('.shimmer')||p.selectorText.includes('.animate-bounce-subtle'))){zadetki.push(p.selectorText+' { '+(p.style?p.style.cssText.slice(0,70):'')+' }');}const g=p.cssRules;if(g)walk(g);}};for(const ss of document.styleSheets){let r;try{r=ss.cssRules;}catch(e){continue;}walk(r);}return {stevilo: zadetki.length, prva: zadetki[0]||null};})())" 2>&1 | tail -1

echo "=== val 74: val 72 guard bajtno (badge-pulse zliti) ==="
agent-browser eval "JSON.stringify((function(){const poti=[];const walk=(pravila)=>{if(!pravila)return;for(const p of pravila){if(p.selectorText&&p.selectorText.includes('badge-pulse')){poti.push(p.selectorText);}const g=p.cssRules;if(g)walk(g);}};for(const ss of document.styleSheets){let r;try{r=ss.cssRules;}catch(e){continue;}walk(r);}return {stevilo: poti.length};})())" 2>&1 | tail -1

echo "=== val 75: color-scheme MONTIRAN (:root light + .dark dark; hybrid prepovedan) ==="
agent-browser eval "JSON.stringify((function(){const cs=getComputedStyle(document.documentElement).colorScheme;const zadetki=[];const walk=(pravila)=>{if(!pravila)return;for(const p of pravila){if(p.selectorText&&(p.selectorText.includes('color-scheme')||((p.style&&p.style.cssText||'').includes('color-scheme')))){zadetki.push(p.selectorText+' { '+p.style.cssText+' }');}const g=p.cssRules;if(g)walk(g);}};for(const ss of document.styleSheets){let r;try{r=ss.cssRules;}catch(e){continue;}walk(r);}return {korenColorScheme: cs, pravila: zadetki.slice(0,4), hibrid: zadetki.some(z=>z.includes('light dark'))};})())" 2>&1 | tail -1

agent-browser screenshot "$OUT/r402-val73-75-prod.png" 2>&1 | tail -1
agent-browser close --all >/dev/null 2>&1
echo "=== r402-val73-75-mounted KONEC (ZERO-MUTACIJA — sonde + screenshot) ==="
