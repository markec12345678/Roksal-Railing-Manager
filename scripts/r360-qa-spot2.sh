#!/usr/bin/env bash
# r360-qa-spot2.sh — R360 re-probe (iskrenost: 1. tek probe B/D premalo natančni
# — poll ANKOR prešibek: 'Meritve' matcha tab bar (poskus 1 = pred renderjem
# vsebine); 'Field Manager' glava pride PRED lazy sekcijo AI raba/CSV pills).
# LEKCIJA R359 izpopolnjena: poll anchor = NAJZAKASNEJŠI znani element
# (praznina 'Ni projektov' oz. 'AI raba'), ne prva glava. ZERO-MUTACIJA.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R360 QA spot re-probe (spot-r167/2) ==="
agent-browser close --all >/dev/null 2>&1 || true
sleep 1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic

echo "--- B2: Meritve — POLL do praznine ALI vsebine (iskren anchor) ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Ni projektov') || document.querySelectorAll('table').length > 0;})()" 12
agent-browser eval "JSON.stringify({
  niProjektov: document.body.innerText.includes('Ni projektov'),
  syncAllTitle: (document.querySelector('button[title=\"Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu\"]')!==null),
  perDraftTitle: (document.querySelector('button[title=\"Pošlji shranjeno telo osnutka v bazo (neuspeh ostane lokalni osnutek)\"]')!==null),
  discardTitle: (document.querySelector('button[title=\"Odstrani lokalni osnutek — ni bil nikoli poslan v bazo\"]')!==null),
  verzijeToggleRing: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('focus-visible:ring-offset-2')).length
})" 2>&1 | tail -1

echo "--- D2: vodja — POLL do NAJZAKASNEJŠEGA elementa 'AI raba' ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('AI raba');})()" 20
agent-browser eval "JSON.stringify({
  glava: document.body.innerText.includes('Field Manager'),
  katalogPillAria: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('katalog avtomatizacijskih')),
  katalogPillVidno: document.body.innerText.includes('KATALOG'),
  aiRaba: document.body.innerText.includes('AI raba — iskrena resnica'),
  csvPills: document.querySelectorAll('button[aria-label*=\"CSV\" i]').length,
  funkcij: document.body.innerText.includes('funkcij')
})" 2>&1 | tail -1

echo "--- F2: konzolne napake (kolektor; zagnan PO prijavi) ---"
agent-browser eval "JSON.stringify({napake:window.__r360err2||[], stevilo:(window.__r360err2||[]).length})" 2>&1 | tail -1

agent-browser close --all >/dev/null 2>&1
echo "=== R360 re-probe KONEC ==="
