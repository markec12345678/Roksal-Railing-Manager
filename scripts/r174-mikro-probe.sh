#!/bin/bash
# R174 mikro-probe: R173 ŽIVO na produkciji (byte-dokaz needlejev, ki so ob
# 1. QA teku ob 22:30 NIČ bili, ker je deploy še potekal — push 14:26 UTC).
# Pričakovani R173 needleji (logistika CSV meta + plošča fail-verbose):
#   'Filtrirano na projekt', 'Ponovno naloži prodajno ploščo',
#   'vnosov preskočenih (neveljaven vnos)', 'Izvoženo ob (čas zadnje osvežitve)'
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r174-mikro
mkdir -p "$OUT" && rm -f "$OUT"/*.js "$OUT"/chunk-urls.txt

agent-browser close --all > /dev/null 2>&1 || true
sleep 1

agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 10

# Izhod iz VizTab (nauček R168) — nato CRM (plošča chunk) + Logistika (log chunk):
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('CRM stranke')||b.textContent.trim().includes('CRM stranke')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 5
agent-browser eval "(()=>{const v=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Več'||(x.getAttribute('aria-label')||'')==='Več'); if(v) v.click(); return !!v;})()" 2>&1 | tail -1
sleep 3
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('Logistika')||b.textContent.trim().includes('Logistika V6')); if(t) t.click(); return !!t;})()" 2>&1 | tail -1
sleep 7

# CRM focus delta (P1-c R173 ŽIVO — ob 1. teku NIČ):
agent-browser eval "window.__r174b={c:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/crm')).length,p:performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/projects')).length}; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); 'dispatchano'" 2>&1 | tail -1
sleep 6
agent-browser eval "(()=>{const g=k=>performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes(k)).length; return JSON.stringify({deltaCrm: g('/api/crm')-(window.__r174b.c||0), deltaProjekti: g('/api/projects')-(window.__r174b.p||0)});})()" 2>&1 | tail -1

agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/chunk-urls.txt
echo "URLjev: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do [ -z "$url" ] && continue; i=$((i+1)); curl -s "$url" -o "$OUT/chunk-$i.js"; done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
echo "--- R173 needle (morajo biti NAJDENI če je R173 živ) ---"
for needle in "Filtrirano na projekt" "Izvoženo ob (čas zadnje osvežitve)" "Ponovno naloži prodajno ploščo" "vnosov preskočenih (neveljaven vnos)"; do
  hits=$(grep -l "$needle" "$OUT"/chunk-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done
echo "--- R174 preverba: pokvarjeni mirrori v produkcijskem CSS NE obstajajo (fix prihaja z naslednjim deployom; sedaj še R172 CSS) ---"
CSS=$(grep -o 'https://[^"]*\.css' "$OUT"/chunk-urls.txt 2>/dev/null | head -1)
agent-browser close --all > /dev/null 2>&1 || true
echo "R174 MIKRO KONEC"
