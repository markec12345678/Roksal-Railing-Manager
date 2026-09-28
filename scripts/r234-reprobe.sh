#!/bin/bash
# R234 reprobe — (a) Naročila toast PO koncu loadinga (Z2b klik je prišel
# sredi fetcha — disabled no-op = zamišljen R232 fail-closed; zdaj klikamo
# PO 'najdeno' + dopustu); (b) 2 chunk-MISSa: Inox chip (catalog) DOM dokaz
# + cv-studio bbox navy byte dokaz (dispatch more naloži dynamic chunk).
set -u
source /home/z/my-project/scripts/e2e-lib.sh
EB_BASE="${EB_BASE:-https://roksal-railing-manager.vercel.app}"
export EB_BASE
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== (a) Naročila CSV toast PO loadingu ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 12
eb_cakaj 3
agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]'); return JSON.stringify({disabled:g?g.disabled:null});})()" 2>&1 | tail -1
eb_klik_gumb "Izvozi naročila kot CSV"
sleep 2.5
agent-browser eval "(()=>{return JSON.stringify({toast:document.body.textContent.includes('Ni naročil za izvoz'), csvNastal:typeof window.__csv==='string', err:window.__err??null});})()" 2>&1 | tail -1

echo "=== (b1) Inox chip DOM dokaz (catalog) ==="
eb_dispatch '{"tab":"more","more":"catalog"}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Inox')||document.body.textContent.includes('WPC');})()" 12
agent-browser eval "(()=>{const chip=[...document.querySelectorAll('span,div,button')].find(e=>e.className&&typeof e.className==='string'&&e.className.includes('bg-muted text-roksal-ink')); return JSON.stringify({inoxChipZeton:!!chip, cls:chip?chip.className.slice(0,80):null, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== (b2) cv-studio bbox navy byte dokaz (dispatch more → dynamic chunk) ==="
eb_dispatch '{"tab":"more","more":"cv-studio"}'
eb_cakaj 5
OUT=/tmp/r234-reprobe
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
echo "  prenesenih: $(ls "$OUT"/chunk-*.js 2>/dev/null | wc -l)"
for n in "bg-roksal-navy text-white hover:bg-roksal-navy/90" "bg-muted text-roksal-ink"; do
  if grep -rqF -- "$n" "$OUT" 2>/dev/null; then echo "OK   : $n"; else echo "MISS : $n"; fi
done

agent-browser close --all > /dev/null 2>&1
echo "=== R234 reprobe KONEC ==="
