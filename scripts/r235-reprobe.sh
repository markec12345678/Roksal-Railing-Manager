#!/bin/bash
# R235 reprobe — čanki, ki niso bili v seji med r235-prod-probe (znani vzorec
# od r230): crm (NEAKTIVEN), logistics (UPOKOJENO), measurements (ARHIVIRANA
# line-through), cv-studio (bbox navy R232), katalog (Inox chip R229).
# Samo bralni pogledi — ZERO-MUTACIJA.
set -u
source /home/z/my-project/scripts/e2e-lib.sh

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

for T in '{"tab":"more","more":"crm"}' '{"tab":"more","more":"logistics"}' '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' '{"tab":"more","more":"cvstudio"}' '{"tab":"more","more":"catalog"}'; do
  eb_dispatch "$T"
  sleep 4
done

OUT=/tmp/r235-reprobe
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/_next/static/chunks/')&&u.endsWith('.js')))" 2>&1 | tail -1 | python3 -c "import sys,json
raw=sys.stdin.read().strip()
try:
  arr=json.loads(raw)
  if isinstance(arr,str): arr=json.loads(arr)
  print('\n'.join(arr))
except Exception:
  print('')" > "$OUT"/chunk-urls.txt
echo "  chunk URLs: $(wc -l < "$OUT"/chunk-urls.txt)"
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
need 'NEAKTIVEN:"bg-muted text-muted-foreground border-border"' "R234 crm NEAKTIVEN žetoni (byte)"
need 'UPOKOJENO:"bg-muted text-muted-foreground border-border"' "R234 logistics UPOKOJENO žetoni (byte)"
need 'bg-muted text-muted-foreground border-border line-through' "R234 measurements ARHIVIRANA žeton (byte)"
need 'bg-roksal-navy text-white hover:bg-roksal-navy/90' "R232 cv-studio bbox žeton (byte)"
need 'bg-muted text-roksal-ink' "R229 Inox chip žeton (byte)"
echo "REPROBE FAIL=$FAIL"
agent-browser close --all > /dev/null 2>&1
echo "=== R235 reprobe KONEC ==="
