#!/usr/bin/env bash
# r359-qa-spot.sh — R359 produkcija QA spot seja (ZERO-MUTACIJA; e2e-lib kanon
# r231; spot-r166 precedens R127/R165; pogojni probe kanon r277 — iskrena
# praznina jeVeljaven rezultat). Fokus: (a) splošno zdravje po R358 deployu
# (FAZA 11 repost gradnik + val 41 titleji ŽIVO); (b) fetch-first sken R359
# kandidatov: PATCH/status orkestracija (status badge ciklanje, reopen
# dialog, bulk arhiviranje — samo DOM branje, NIČ klikov na mutacijske
# gumbe — ZERO-MUTACIJA); (c) konzolne napake (kolektor ŠELE PO prijavi —
# LEKCIJA R358: eb_odpri_in_prijavi WIPE-a kontekst).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R359 QA spot seja ==="
agent-browser close --all >/dev/null 2>&1 || true
sleep 1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
# kolektor konzolnih napak — šele PO prijavi (LEKCIJA R358 tek 1)
agent-browser eval "(()=>{window.__r359err=[];window.addEventListener('error',e=>window.__r359err.push(String(e.message||e)));window.addEventListener('unhandledrejection',e=>window.__r359err.push('rej:'+String(e.reason)));return 'kolektor';})()" 2>&1 | tail -1

echo "--- A: dashboard render (spot resnica) ---"
agent-browser eval "JSON.stringify({iskalnik:!!document.querySelector('button[aria-label=\"Odpri iskalnik\"]'),glava:document.body.innerText.slice(0,120).replace(/\n/g,' | ')})" 2>&1 | tail -1

echo "--- B: Meritve tab — FAZA 11 + val 41 titleji ŽIVO ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  niProjektov: document.body.innerText.includes('Ni projektov'),
  syncAllTitle: (document.querySelector('button[title=\"Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu\"]')!==null),
  perDraftTitle: (document.querySelector('button[title=\"Pošlji shranjeno telo osnutka v bazo (neuspeh ostane lokalni osnutek)\"]')!==null),
  discardTitle: (document.querySelector('button[title=\"Odstrani lokalni osnutek — ni bil nikoli poslan v bazo\"]')!==null),
  podvoji: document.body.innerText.includes('Podvoji'),
  kopiraj: document.body.innerText.includes('Kopiraj')
})" 2>&1 | tail -1

echo "--- C: PATCH/status družina — DOM sken (ZERO-MUTACIJA: samo branje) ---"
agent-browser eval "JSON.stringify({
  statusGumbi: document.querySelectorAll('button').length,
  ariaGumbi: document.querySelectorAll('button[aria-label]').length,
  titleGumbi: document.querySelectorAll('button[title]').length,
  reopenBesedilo: document.body.innerText.includes('Odpri z razlogom') || document.body.innerText.includes('zgodovina verzij') || document.body.innerText.includes('Zgodovina verzij'),
  arhivirajBesedilo: document.body.innerText.includes('Arhiviraj') || document.body.innerText.includes('arhiviraj')
})" 2>&1 | tail -1

echo "--- D: vodja — izvozna družina + katalog + AI raba ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  katalogPill: (document.querySelector('button[aria-label*=\"avtomatizacijski katalog\" i]')!==null) || document.body.innerText.includes('Avtomatizacijski katalog'),
  aiRaba: document.body.innerText.includes('AI raba — iskrena resnica'),
  csvPills: document.querySelectorAll('button[aria-label*=\"CSV\" i]').length
})" 2>&1 | tail -1

echo "--- E: zvonček odpri/zapri (pogojni probe kanon r277) ---"
agent-browser eval "(()=>{const z=document.querySelector('button[aria-label*=\"obvestil\" i], button[aria-label*=\"Obvestil\" i]'); if(z){z.click(); return 'odprt';} return 'ni gumba';})()" 2>&1 | tail -1
eb_cakaj 2
agent-browser eval "(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" 2>&1 | tail -1

echo "--- F: konzolne napake + omrežni failovi (kolektor) ---"
agent-browser eval "JSON.stringify({napake:window.__r359err, stevilo:window.__r359err.length})" 2>&1 | tail -1

agent-browser screenshot /tmp/r359-qa-vodja.png >/dev/null 2>&1 || true
agent-browser close --all >/dev/null 2>&1
echo "=== R359 QA spot KONEC ==="
