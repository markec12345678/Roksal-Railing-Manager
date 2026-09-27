#!/bin/bash
# R229 Z6 dopolnilo — deployed čanki needleji (ločen tek, Z1-Z5 že zeleni).
set -u
PROD="https://roksal-railing-manager.vercel.app"
OUT=/tmp/r229-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt

pocakaj_na() {
  local pred="$1" maks="${2:-10}" R
  for i in $(seq 1 "$maks"); do
    R=$(agent-browser eval "$pred" 2>&1 | tail -1)
    if [ "$R" = "true" ]; then return 0; fi
    sleep 1.5
  done
  return 1
}

# seja je že na /login (odprta v debugu) — prijava
agent-browser eval "(()=>{return !!document.querySelector('input[type=\"email\"]');})()" > /dev/null 2>&1 || { agent-browser open "$PROD/login" > /dev/null 2>&1; agent-browser wait 'input[type="email"]' > /dev/null 2>&1; }
sleep 1
agent-browser fill 'input[type="email"]' 'spot-r165@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'SpotR165Qa!Pass' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 20 || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
sleep 2
for i in 1 2 3; do
  agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
  sleep 2
done
# vodja (vodja-dashboard + vodja-csv + boss-report-pdf čanki) + Zaloga
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'vodja'}})); return 'vodja';})()" > /dev/null 2>&1
sleep 4
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'inventory',more:null,subTab:null,osnutek:null,filter:null}})); return 'nav';})()" > /dev/null 2>&1
sleep 4
# team-tab (žetoni čanki)
agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:{tab:'more',more:'team'}})); return 'team';})()" > /dev/null 2>&1
sleep 4

agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | python3 -c "import sys,json
raw=sys.stdin.read().strip()
try:
  arr=json.loads(raw)
  if isinstance(arr,str): arr=json.loads(arr)
  print('\n'.join(arr))
except Exception:
  print('')" > "$OUT"/chunk-urls.txt
echo "chunk URLs: $(wc -l < "$OUT"/chunk-urls.txt)"
i=0
while read -r url; do
  [ -z "$url" ] && continue
  i=$((i+1))
  curl -s --max-time 20 "$url" -o "$OUT/chunk-$i.js"
done < "$OUT"/chunk-urls.txt
echo "prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"

FAIL=0
need() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"; else echo "MISS : $2  (needle: $1)"; FAIL=1; fi
}
need "Zamujena dobava — " "R228 vodja kartica naslov"
need "odpre Material → Naročila" "R228 kartica aria dejanje"
need "Obljubljeni datum dobave je pretekel, naročilo pa še ni prejeto" "R228 kartica title"
need "steviloZamujenihDobav" "R228 lib števec (client čanki)"
need "'Opozorila', 'Zamujena dobava'" "R228 CSV vrstica (IZVOŽENO = ZASLON)"
need "z pretečenim rokom dobave — izterjaj dobavo pri dobavitelju" "R228 PDF opozorila vrstica"
need "bg-muted text-muted-foreground" "R228 team-tab žetoni"
if grep -rqF -- "border-stone-200 dark:border-stone-700" "$OUT" 2>/dev/null; then
  echo "MISS : team-tab stone dvojček ŠE VEDNO v odposlanih čankih"; FAIL=1
else
  echo "OK   : team-tab stone dvojček izginil iz odposlanih čankov"
fi
echo "NEEDLE FAIL=$FAIL"
agent-browser close --all > /dev/null 2>&1
