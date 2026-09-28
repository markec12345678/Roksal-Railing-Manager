#!/bin/bash
# R239 prod reprobe — Z4/Z5 MISSa iz core (lekcija R234/R238: klik med
# loadingom = disabled no-op; reprobe čaka na enabled gumb oziroma prazno
# stanje PRED klikom):
#  - R237 regresija: Osnutek dialog PDF pill (počakaj !disabled) + %PDF byte
#  - R236 regresija: Dobavitelji PDF fail-closed pri 0 (počakaj prazno stanje)
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "=== Z4-R: R237 regresija — Osnutek dialog PDF pill (disabled-wait) + %PDF ==="
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{const g=document.querySelector('button[aria-label=\"Shrani naročilnico vidnih artiklov kot osnutek naročila\"]'); return !!g && !g.disabled;})()" 24
eb_klik_gumb "Shrani naročilnico vidnih artiklov kot osnutek naročila"
eb_pocakaj_na "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); const c=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot CSV\"]'); return !!p && !!c && !p.disabled && !c.disabled;})()" 12
sleep 1
agent-browser eval "(()=>{const p=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot PDF\"]'); const c=document.querySelector('button[aria-label=\"Prenesi naročilnico vidnih artiklov kot CSV\"]'); return JSON.stringify({pdfGumb:!!p, csvSorojec:!!c, title:p?p.getAttribute('title'):null, disabledP:p?p.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1
eb_zajem_pdf pdf
eb_csv_reset pdf
eb_klik_gumb "Prenesi naročilnico vidnih artiklov kot PDF"
eb_pocakaj_tekst "Osnutek prenesen v PDF" 12
eb_pocakaj_na "(()=>{return typeof window.__pdf==='string'&&window.__pdf.length>0;})()" 12
agent-browser eval "(()=>{const b64=window.__pdf; if(typeof b64!=='string'||b64.length===0) return JSON.stringify({pdf:false, err:window.__err??null}); const bin=atob(b64); return JSON.stringify({pdf:true, magic:[bin.charCodeAt(0),bin.charCodeAt(1),bin.charCodeAt(2),bin.charCodeAt(3),bin.charCodeAt(4)].join(','), bajtov:bin.length, err:window.__err??null});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/qa-r239-prod-osnutek-pdf.png" > /dev/null 2>&1
agent-browser eval "(()=>{const d=document.querySelector('[data-state=\"open\"]'); if(d){const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); d.dispatchEvent(esc); return 'esc';} return 'ni';})()" > /dev/null 2>&1
eb_cakaj 1

echo "=== Z5-R: R236 regresija — Dobavitelji PDF fail-closed pri 0 (prazno-stanje wait) ==="
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers"}'
eb_pocakaj_tekst "Ni dobaviteljev. Dodaj prvega." 24
eb_zajem_pdf pdfR
eb_csv_reset pdfR
agent-browser eval "(()=>{const p=document.querySelector('button[aria-label=\"Izvozi dobavitelje kot PDF\"]'); return JSON.stringify({pill:!!p, disabled:p?p.disabled:null, err:window.__err??null});})()" 2>&1 | tail -1
eb_klik_gumb "Izvozi dobavitelje kot PDF"
eb_cakaj 3
agent-browser eval "(()=>{const toast=document.body.textContent.includes('Ni dobaviteljev za izvoz'); return JSON.stringify({failClosedToast:toast, pdfNastal:typeof window.__pdfR==='string', err:window.__err??null});})()" 2>&1 | tail -1
curl -s --max-time 10 "$PROD/api/public/health"; echo
agent-browser close --all > /dev/null 2>&1
echo "=== R239 reprobe KONEC ==="
