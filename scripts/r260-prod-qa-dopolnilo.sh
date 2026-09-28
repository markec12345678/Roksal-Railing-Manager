#!/bin/bash
# R260 prod QA dopolnilo — CRM + teren dispatch (R253/R252/R250 chunk pokritost)
set -u
source /home/z/my-project/scripts/e2e-lib.sh
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic
OUT=/tmp/r260-prod-chunks2
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
sleep 4
eb_dispatch '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}'
sleep 4
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
need() { if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"; else echo "MISS : $2"; FAIL=1; fi }
need "Izvozi koledar pregledov kot PDF" "R253 pill aria (crm/teren čanki)"
need "Izvozi potekle opomnike kot PDF" "R252 bulk pill aria"
need "Izvozi prihodke kot PDF" "R250 pill aria"
echo "DOPOLNILO FAIL=$FAIL"
agent-browser close --all > /dev/null 2>&1
exit $FAIL
