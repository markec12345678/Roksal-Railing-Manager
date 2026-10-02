#!/bin/bash
# R237 prod core — R236 ŽIVO (žig 02:17:36): Dobavitelji PDF pill VIDEN pri
# 0 dobaviteljev (fail-closed prazno stanje ŽIVO — gumb VEDNO viden, R232
# družina) + fail-closed klik → toast + __pdf null + CSV brat regresija.
# Samo bralni pogledi — ZERO-MUTACIJA (brez raise v prodi — r235/r236 pravilo).
set -u
source /home/z/my-project/scripts/e2e-lib.sh

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z1: Material → Dobavitelji — R236 JEDRO: PDF pill VIDEN + CSV brat ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
eb_pocakaj_na "(()=>{const b=[...document.querySelectorAll('button[aria-pressed=\"true\"]')].find(x=>x.textContent.includes('Dobavitelji')); return !!b;})()" 12
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]');})()" 12
agent-browser eval "(()=>{const p=document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]'); const c=document.querySelector('button[aria-label=\"Izvozi dobavitelje kot CSV\"]'); if(!p||!c) return JSON.stringify({pill:false, csv:!!c}); return JSON.stringify({pill:true, csv:true, title:p.getAttribute('title'), disabledP:p.disabled, disabledC:c.disabled, err:window.__err??null});})()" 2>&1 | tail -1

echo "=== Z2: fail-closed klik (0 dobaviteljev v prodi) → toast + __pdf null ==="
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Izvozi dobavitelje kot PDF"
eb_cakaj 3
agent-browser eval "(()=>{const toast=document.body.textContent.includes('Ni dobaviteljev za izvoz'); return JSON.stringify({failClosedToast:toast, pdfNastal:typeof window.__pdf==='string', err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot /home/z/my-project/screenshots/qa-r237-prod-dobavitelji-pdf.png > /dev/null 2>&1

echo "=== Z3: deployed čanki — needleji R236 (fokus revizija + PDF lib) ==="
OUT=/tmp/r237-chunks
mkdir -p "$OUT" && rm -f "$OUT"/chunk-*.js "$OUT"/chunk-urls.txt
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
sleep 3
eb_dispatch '{"tab":"more","more":"material","subTab":"orders"}'
sleep 3
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
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
must_miss() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "STAL : $2  (needle: $1)"; FAIL=1; else echo "OK   : $2 (odsoten — pravilno)"; fi
}
need "Izvozi dobavitelje kot PDF" "R236 PDF pill aria"
need "Dobavitelji kot pravi PDF — arhivski pregled kontaktnih in sodelovalnih podatkov" "R236 PDF pill title"
need "PDF se izvozi, ko je dodan prvi dobavitelj." "R236 fail-closed toast opis"
need "Dobavitelji PDF ni mogoče sestaviti iz tega seznama" "R236 fail-closed TypeError toast"
need "Izvoz PDF ni uspel: " "R236 fail-verbose catch"
need "preveriDobaviteljPdfVnos" "R236 lib preverba"
need "dobaviteljBeseda" "R236 sklanjatev"
need "press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2" "R236 fokus revizija invoice CSV pill [PIN SHIFT R370 val 53: offset-1→2 navy rep normalizacija]"
must_miss "focus-visible:ring-amber-500/50" "invoice amber fokus (unikatna oblika)"
must_miss "focus-visible:ring-emerald-400/50" "Izdaj/Plačan emerald fokus (unikatna oblika)"
echo "NEEDLE FAIL=$FAIL"
curl -s --max-time 10 "https://roksal-railing-manager.vercel.app/api/public/health"; echo
agent-browser close --all > /dev/null 2>&1
echo "=== R237 core KONEC ==="
