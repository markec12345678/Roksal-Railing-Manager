#!/bin/bash
# R245 prod reprobe 2 — chunk-nivojski dokaz za 2 needle, ki ju prvi pregled
# NI mogel videti (gumba sta kontekstna: 'Povabi' = vrstična akcija, 'Shrani
# meritev' = odprta mera). Obiščem zavihka → prenesem čanke → grep natančnih
# needle nizov iz r244-build-needles ( deploy dokaz, ni UI interakcija).
set -u
source /home/z/my-project/scripts/e2e-lib.sh
OUT=/tmp/r245-chunks2
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 5
eb_dispatch '{"tab":"more","more":"team","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 5
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3

agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | python3 -c "import sys,json
raw=sys.stdin.read().strip()
try:
  arr=json.loads(raw)
  if isinstance(arr,str): arr=json.loads(arr)
  print('\n'.join(arr))
except Exception:
  print('')" > "$OUT"/chunk-urls.txt
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
need "bg-roksal-navy hover:bg-roksal-navy/90 text-white press-scale" "R244 ekipa dialog CTA (Povabi/Ustvari povabilo)"
need "flex-1 h-9 bg-roksal-navy hover:bg-roksal-navy/90 text-white press-scale" "R244 Shrani meritev CTA"
need "Ustvari povabilo" "ekipa dialog vsebina (kontrola, da je pravi chunk)"
echo "NEEDLE FAIL=$FAIL"
agent-browser close --all > /dev/null 2>&1
echo "=== R245 REPROBE2 KONEC ==="
