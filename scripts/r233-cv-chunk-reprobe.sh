#!/bin/bash
# R233 cv-studio byte reprobe — dispatch more cvstudio (dynamic chunk se
# naloži ob montanji) → zbir čankov seje → grep bbox navy needle.
set -u
PROD="https://roksal-railing-manager.vercel.app"
agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
for i in $(seq 1 20); do
  R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 2>&1 | tail -1)
  [ "$R" = "true" ] && break
  sleep 3
done
sleep 2
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'cvstudio'}})); return 'nav';})()" > /dev/null 2>&1
sleep 6
OUT=/tmp/r233-cv-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/urls.txt
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | python3 -c "import sys,json
raw=sys.stdin.read().strip()
try:
  arr=json.loads(raw)
  if isinstance(arr,str): arr=json.loads(arr)
  print('\n'.join(arr))
except Exception:
  print('')" > "$OUT"/urls.txt
i=0
while read -r url; do
  [ -z "$url" ] && continue
  i=$((i+1)); curl -s --max-time 20 "$url" -o "$OUT/chunk-$i.js"
done < "$OUT"/urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
if grep -rqF 'bg-roksal-navy text-white hover:bg-roksal-navy/90' "$OUT"; then echo "OK: R232 cv-studio bbox navy žeton (byte dokaz)"; else echo "MISS: bbox navy"; fi
if grep -rqF 'min-h-[36px] border-border text-[11px] text-muted-foreground hover:bg-muted' "$OUT"; then echo "OK: R232 Briši žeton (byte dokaz)"; else echo "MISS: Briši žeton"; fi
if grep -rqF 'border-stone-300 bg-stone-100 text-stone-700' "$OUT"; then echo "STAL: PREDLOG stone"; else echo "OK: stone ostanek 0 (byte)"; fi
agent-browser close --all > /dev/null 2>&1
