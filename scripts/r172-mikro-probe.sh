#!/bin/bash
# R172 mikro-probe: Logistika chunk regresija (R169 needle 'Vsota predvidenih ur vidnih terminov').
# Razlog: r172-prod-qa.sh ni obiskal Logistike → chunk-24 ni bil zbran → needle NIČ je
# pričakovano (ni zbran, ne manjka). Ta probe dopolni regresijsko verigo.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r172-chunks
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 9
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Montažna orodja')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 5
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Več'||b.textContent.trim()==='Več'); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{const t=[...document.querySelectorAll('button,a')].find(b=>(b.getAttribute('aria-label')||'').includes('Logistika')||b.textContent.trim().includes('Logistika V6')); if(t) t.click(); return !!t;})()" > /dev/null 2>&1
sleep 8
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | tr -d '"\\' | tr ',' '\n' | sed 's/^\[//;s/\]$//' | grep -v '^$' > "$OUT"/logistika-urls.txt
n=0
while read -r url; do [ -z "$url" ] && continue; n=$((n+1)); curl -s "$url" -o "$OUT/log-$n.js"; done < "$OUT"/logistika-urls.txt
echo "logistika chunkov: $n"
for needle in "Vsota predvidenih ur vidnih terminov" "vnos preskočen" "Izvozi termine montaže kot koledarsko datoteko" "roksal-montaze-"; do
  hits=$(grep -l "$needle" "$OUT"/log-*.js 2>/dev/null | tr '\n' ' ')
  echo "  [$needle] -> ${hits:-NIČ}"
done
agent-browser close --all > /dev/null 2>&1 || true
echo "R172 MIKRO-PROBE KONEC"
