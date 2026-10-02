#!/usr/bin/env bash
# r362-qa-spot2.sh — R362 re-proba (iskrenost: 1. tek je imel 3 nepreciznosti —
# LEKCIJA R360: re-probe obvezna ob sumu):
#   1) iskalnik:false — eksakten match je failal, ker je RESNIČNI aria
#      'Odpri iskalnik (Ctrl+K)' (top-bar.tsx:173); poll includes je zadel.
#      NI bug — sonda popravljena na eksakten resnični niz.
#   2) pressScaleBrezOffset:3 — OŽKI obseg šteje VES dokument (LEKCIJA R361);
#      3 tujcev je treba IDENTIFICIRATI (aria/innerTekst), da ugotovimo, ali
#      so crm-tab družina (potem je to REALEN parity miss → val 45) ali tujje
#      (top-bar / fab / drugi montirani gradniki — dokumentirano, ne bug).
#   3) Zaloge probe — napačen ankor ('Zaloge' ne obstaja; h2 je 'Zaloga',
#      aria 'Dodaj gibanje zaloge') + šibek poll (length>500). Re-probe z
#      MOČNIMA ankorjema iz vira.
# ZERO-MUTACIJA.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R362 re-proba (spot-r167/6) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r362err2

echo "--- A2: dashboard — eksakten resnični aria 'Odpri iskalnik (Ctrl+K)' ---"
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Odpri iskalnik (Ctrl+K)\"]');})()" 10
agent-browser eval "JSON.stringify({iskalnikEksaktno: !!document.querySelector('button[aria-label=\"Odpri iskalnik (Ctrl+K)\"]')})" 2>&1 | tail -1

echo "--- C2: CRM — IDENTIFIKACIJA 3 press-scale navy/40 BREZ offset ---"
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi CSV ('));})()" 15
agent-browser eval "JSON.stringify(
  [...document.querySelectorAll('button')]
    .filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset'))
    .map(b=>(b.getAttribute('aria-label')||b.textContent||'').trim().slice(0,60))
)" 2>&1 | tail -1

echo "--- D2: Zaloge — POLL do MOČNEGA ankorja 'Zaloga' h2 / 'Dodaj gibanje zaloge' ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='Zaloga') || [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Dodaj gibanje zaloge');})()" 15
agent-browser eval "JSON.stringify({
  h2Zaloga: [...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='Zaloga'),
  dodajGibanje: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Dodaj gibanje zaloge'),
  premikiBranje: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Premiki zaloge so za branje — beleženje zahteva pravico'),
  izvoziCsv: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidno zalogo kot CSV'),
  izvoziPdf: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi vidno zalogo kot PDF'),
  kopirajNarocilnico: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Kopiraj naročilnico vidnih artiklov pod minimalno zalogo'),
  tabel: document.querySelectorAll('table').length
})" 2>&1 | tail -1

echo "--- E2: kolektor ---"
eb_preberi_kolektor r362err2

agent-browser close --all >/dev/null 2>&1
echo "=== R362 re-proba KONEC ==="
