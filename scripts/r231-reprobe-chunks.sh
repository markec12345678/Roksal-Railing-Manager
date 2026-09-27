#!/bin/bash
# R231 reprobe — 3 MISSa iz r231-prod-probe (deal-pipeline 'from-muted' +
# 'ring-muted-foreground/70' + Inox chip 'bg-muted text-roksal-ink'): chunka
# nista bila v seji (deal-pipeline se rendera SAMO v CRM tabu, roksal-catalog
# SAMO v more:'catalog' — R230 vzorec: chunk ni bil v seji != regresija).
# Ta reprobe obišče OBA taba, prenese čanke in pogrubi needleje.
# ZERO-MUTACIJA: samo bralni pogledi.
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r231-chunks2
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt

pocakaj_na() {
  local pred="$1" maks="${2:-10}" R
  for i in $(seq 1 "$maks"); do
    R=$(agent-browser eval "$pred" 2>&1 | tail -1)
    if [ "$R" = "true" ]; then echo "  najdeno (poskus $i)"; return 0; fi
    sleep 1.5
  done
  echo "  NI NAJDENO (zadnji: $R)"; return 1
}

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$PROD/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
sleep 2
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
PRIJAVA="ni"
for i in $(seq 1 20); do
  R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 2>&1 | tail -1)
  if [ "$R" = "true" ]; then echo "  prijava OK (poskus $i)"; PRIJAVA="ok"; break; fi
  sleep 3
done
[ "$PRIJAVA" = "ok" ] || { echo "LOGIN FAIL"; agent-browser close --all > /dev/null 2>&1; exit 1; }
sleep 2
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done

echo "=== CRM tab (deal-pipeline čank) — moreTab ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'crm',subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
pocakaj_na "(()=>{return document.body.textContent.includes('Načrtovano');})()" 15
sleep 4
agent-browser eval "(()=>{const el=document.querySelector('[class*=\"from-muted\"]'); return JSON.stringify({domDokaz:!!el, klas:el?el.className.slice(0,120):null, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | python3 -c "import sys,json
raw=sys.stdin.read().strip()
try:
  arr=json.loads(raw)
  if isinstance(arr,str): arr=json.loads(arr)
  print('\n'.join(arr))
except Exception:
  print('')" >> "$OUT"/chunk-urls.txt
echo "  URLs do zdaj: $(wc -l < "$OUT"/chunk-urls.txt)"

echo "=== Katalog tab (roksal-catalog čank) ==="
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'catalog',subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
sleep 6
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | python3 -c "import sys,json
raw=sys.stdin.read().strip()
try:
  arr=json.loads(raw)
  if isinstance(arr,str): arr=json.loads(arr)
  print('\n'.join(arr))
except Exception:
  print('')" >> "$OUT"/chunk-urls.txt
sort -u "$OUT"/chunk-urls.txt -o "$OUT"/chunk-urls.txt
echo "  unikatnih URLs: $(wc -l < "$OUT"/chunk-urls.txt)"

i=0
while read -r url; do
  [ -z "$url" ] && continue
  i=$((i+1))
  curl -s --max-time 20 "$url" -o "$OUT/chunk-$i.js"
done < "$OUT"/chunk-urls.txt
echo "  prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"

FAIL=0
need() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"; else echo "MISS : $2  (needle: $1)"; FAIL=1; fi
}
need "from-muted" "R230 deal-pipeline NACRTOVANO head žeton"
need "ring-muted-foreground/70" "R230 deal-pipeline NACRTOVANO over žeton"
need "bg-muted text-roksal-ink" "R229 Inox chip žeton"
echo "REPROBE FAIL=$FAIL"
agent-browser close --all > /dev/null 2>&1
echo "=== R231 reprobe KONEC ==="
