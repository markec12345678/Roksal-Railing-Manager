#!/bin/bash
# R246 prod reprobe — Z8/Z9 dokaza iz r246-prod-qa (izpis je odrezal head):
# Osnutek PDF glifni razred + temna + err null.
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z8: R237 regresija — Osnutek PDF glifni razred ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]');})()" 24
sleep 4
OSN_OK=0
for poskus in 1 2 3; do
  eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
  if eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); return !!p && !p.disabled;})()" 10; then
    OSN_OK=1; echo "  dialog odprt (poskus $poskus)"; break
  fi
  echo "  poskus $poskus: NI — ponovim"; sleep 5
done
[ "$OSN_OK" = "1" ] || { echo "Z8 FAIL: dialog NI odprt"; }
sleep 1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 14
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 14
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false}); const bin=atob(b64); const razredi=[30057,30119,30191,30253]; return JSON.stringify({pdf:true, bajtov:bin.length, razredOk:razredi.includes(bin.length), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z9: temna + err null + health ==="
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 2
agent-browser eval "(()=>{document.documentElement.classList.add('dark'); return 'temna';})()" > /dev/null 2>&1
eb_cakaj 2
agent-browser eval "(()=>{return JSON.stringify({temna:document.documentElement.classList.contains('dark'), err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r246-prod-temna.png" > /dev/null 2>&1
agent-browser eval "(()=>{document.documentElement.classList.remove('dark'); return 'svetla';})()" > /dev/null 2>&1
curl -s --max-time 10 "$PROD/api/public/health"; echo

agent-browser close --all > /dev/null 2>&1
echo "=== R246 REPROBE KONEC ==="
