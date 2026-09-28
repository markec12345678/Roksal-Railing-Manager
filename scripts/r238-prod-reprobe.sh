#!/bin/bash
# R238 prod reprobe — Z4 fail-closed toast po loadingu (lekcija R234: klik
# med loadingom = disabled no-op; čakanje na prazno stanje 'Ni dobaviteljev.
# Dodaj prvega.' = fetch končan → gumb enabled → klik → toast).
set -u
source /home/z/my-project/scripts/e2e-lib.sh
PROD="https://roksal-railing-manager.vercel.app"

eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; exit 1; }
eb_zapri_vodic

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
echo "=== R238 reprobe KONEC ==="
