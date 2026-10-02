#!/usr/bin/env bash
# r358-qa-spot.sh — R358 produkcija QA spot seja (ZERO-MUTACIJA; e2e-lib kanon
# r231; spot-r165 precedens R127/R165; pogojni probe kanon r277 — iskrena
# praznina jeVeljaven rezultat). Fokus: (a) splošno zdravje po R357 deployu
# (FAZA 10 gradnik + val 40 družina ŽIVO); (b) fetch-first sken kandidatov
# R358: FAZA 11 re-post tokovi (syncSingleDraft/podvojenost/kopiranje v
# Meritve UI) + inventory/material handlerji; (c) konzolne napake (kolektor
# nameščen PRED prijavo, SPA routing ohrani — nič polnih reloadov).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R358 QA spot seja ==="
agent-browser close --all >/dev/null 2>&1 || true
sleep 1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
# kolektor konzolnih napak — šele PO prijavi (LEKCIJA R358 tek 1: eb_odpri_in_prijavi
# svoj open /login WIPE-a kontekst — kolektor pred prijavo ne preživi; SPA dispatchi
# po prijavi so brez reloadov → kolektor pokrije ves QA obseg)
agent-browser eval "(()=>{window.__r358err=[];window.addEventListener('error',e=>window.__r358err.push(String(e.message||e)));window.addEventListener('unhandledrejection',e=>window.__r358err.push('rej:'+String(e.reason)));return 'kolektor';})()" 2>&1 | tail -1

echo "--- A: dashboard render (spot resnica) ---"
agent-browser eval "JSON.stringify({iskalnik:!!document.querySelector('button[aria-label=\"Odpri iskalnik\"]'),glava:document.body.innerText.slice(0,120).replace(/\n/g,' | ')})" 2>&1 | tail -1

echo "--- B: Meritve tab — FAZA 10 družina + iskrene praznine ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  niProjektov: document.body.innerText.includes('Ni projektov'),
  scanirajAria: (document.querySelector('button[aria-label=\"LiDAR skeniranje meritev — kmalu na voljo\"]')!==null),
  shraniMeritev: document.body.innerText.includes('Shrani meritev'),
  nagibOrKotomer: document.body.innerText.includes('Nagib') || document.body.innerText.includes('Kotomer'),
  laserNote: document.body.innerText.includes('Web Bluetooth ni podprt') || document.body.innerText.includes('Bluetooth')
})" 2>&1 | tail -1

echo "--- C: FAZA 11 sken — re-post tokovi v UI (sync/podvojenost/kopiranje) ---"
agent-browser eval "JSON.stringify({
  syncBesedilo: document.body.innerText.includes('Sinhroniziraj') || document.body.innerText.includes('Sinhronizaci'),
  podvoji: document.body.innerText.includes('Podvoji'),
  kopiraj: document.body.innerText.includes('Kopiraj'),
  osnutkiPanel: document.body.innerText.includes('Osnutki') || document.body.innerText.includes('osnutek')
})" 2>&1 | tail -1

echo "--- D: vodja — izvozna družina + katalog + AI raba ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  katalogPill: (document.querySelector('button[aria-label*=\"avtomatizacijski katalog\" i]')!==null) || document.body.innerText.includes('Avtomatizacijski katalog'),
  katalogRegion: document.body.innerText.includes('funkcij'),
  aiRaba: document.body.innerText.includes('AI raba — iskrena resnica'),
  csvPills: document.querySelectorAll('button[aria-label*=\"CSV\" i]').length
})" 2>&1 | tail -1

echo "--- E: zvonček odpri/zapri (pogojni probe kanon r277) ---"
agent-browser eval "(()=>{const z=document.querySelector('button[aria-label*=\"obvestil\" i], button[aria-label*=\"Obvestil\" i]'); if(z){z.click(); return 'odprt';} return 'ni gumba';})()" 2>&1 | tail -1
eb_cakaj 2
agent-browser eval "(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" 2>&1 | tail -1

echo "--- F: inventory tab — R358 kandidat sken (handlerji/družine) ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  zalogeBesedilo: document.body.innerText.includes('Zaloge') || document.body.innerText.includes('zalog'),
  materialBesedilo: document.body.innerText.includes('Material'),
  gumbiSkupaj: document.querySelectorAll('button').length,
  ariaGumbi: document.querySelectorAll('button[aria-label]').length
})" 2>&1 | tail -1

echo "--- G: konzolne napake + omrežni failovi (kolektor) ---"
agent-browser eval "JSON.stringify({napake:window.__r358err, stevilo:window.__r358err.length})" 2>&1 | tail -1

agent-browser screenshot /tmp/r358-qa-vodja.png >/dev/null 2>&1 || true
agent-browser close --all >/dev/null 2>&1
echo "=== R358 QA spot KONEC ==="
