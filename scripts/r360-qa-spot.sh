#!/usr/bin/env bash
# r360-qa-spot.sh — R360 produkcija QA spot seja (ZERO-MUTACIJA; e2e-lib kanon
# r231; spot-r167 precedens R127/R165/R166; pogojni probe kanon r277 — iskrena
# praznina jeVeljaven rezultat). Fokus: (a) splošno zdravje po R359 deployu
# (val 42 title/aria ŽIVO: bulk dialog Prekliči + Arhiviraj, ring parity);
# (b) ⭐ SPOT-PROBE HARDENING (LEKCIJA R359 aplikirana — R360 kandidat):
# fiksna spanja (eb_cakaj 3) → POLL do znane glave (eb_pocakaj_na z znano
# glavo dispatcha) — krhko spanje zamenja determinističen poll; (c) katalog
# pill probe POPRAVLJENA (LEKCIJA R359 (2)): substring mora matchat aria
# ('katalog avtomatizacijskih') ALI vidno besedilo ('KATALOG') — stari
# substring 'avtomatizacijski katalog' ne matcha nobenega; (d) konzolne
# napake (kolektor ŠELE PO prijavi — LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R360 QA spot seja (spot-r167) ==="
agent-browser close --all >/dev/null 2>&1 || true
sleep 1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
# kolektor konzolnih napak — šele PO prijavi (LEKCIJA R358 tek 1)
agent-browser eval "(()=>{window.__r360err=[];window.addEventListener('error',e=>window.__r360err.push(String(e.message||e)));window.addEventListener('unhandledrejection',e=>window.__r360err.push('rej:'+String(e.reason)));return 'kolektor';})()" 2>&1 | tail -1

echo "--- A: dashboard render — POLL do znane glave (hardening: NI fiksnega spanja) ---"
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 10
agent-browser eval "JSON.stringify({iskalnik:!!document.querySelector('button[aria-label=\"Odpri iskalnik\"]'),glava:document.body.innerText.slice(0,120).replace(/\n/g,' | ')})" 2>&1 | tail -1

echo "--- B: Meritve tab — POLL do 'Meritve' glave + val 41/42 družina ŽIVO ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Meritve');})()" 10
agent-browser eval "JSON.stringify({
  niProjektov: document.body.innerText.includes('Ni projektov'),
  syncAllTitle: (document.querySelector('button[title=\"Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu\"]')!==null),
  perDraftTitle: (document.querySelector('button[title=\"Pošlji shranjeno telo osnutka v bazo (neuspeh ostane lokalni osnutek)\"]')!==null),
  discardTitle: (document.querySelector('button[title=\"Odstrani lokalni osnutek — ni bil nikoli poslan v bazo\"]')!==null),
  verzijeToggleRing: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('focus-visible:ring-offset-2')).length
})" 2>&1 | tail -1

echo "--- C: PATCH/status družina — DOM sken (ZERO-MUTACIJA: samo branje) ---"
agent-browser eval "JSON.stringify({
  statusGumbi: document.querySelectorAll('button').length,
  ariaGumbi: document.querySelectorAll('button[aria-label]').length,
  titleGumbi: document.querySelectorAll('button[title]').length,
  arhivirajBesedilo: document.body.innerText.includes('Arhiviraj') || document.body.innerText.includes('arhiviraj')
})" 2>&1 | tail -1

echo "--- D: vodja — POLL do znane glave 'Field Manager' + katalog probe POPRAVLJENA ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
# hardening: poll do znane glave (LEKCIJA R359 — fiksno spanje je krhko)
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Field Manager');})()" 15
agent-browser eval "JSON.stringify({
  glava: document.body.innerText.includes('Field Manager'),
  katalogPillAria: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('katalog avtomatizacijskih')),
  katalogPillVidno: document.body.innerText.includes('KATALOG'),
  aiRaba: document.body.innerText.includes('AI raba — iskrena resnica'),
  csvPills: document.querySelectorAll('button[aria-label*=\"CSV\" i]').length
})" 2>&1 | tail -1

echo "--- E: zvonček odpri/zapri (pogojni probe kanon r277) ---"
agent-browser eval "(()=>{const z=document.querySelector('button[aria-label*=\"obvestil\" i], button[aria-label*=\"Obvestil\" i]'); if(z){z.click(); return 'odprt';} return 'ni gumba';})()" 2>&1 | tail -1
eb_cakaj 2
agent-browser eval "(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" 2>&1 | tail -1

echo "--- F: konzolne napake + omrežni failovi (kolektor) ---"
agent-browser eval "JSON.stringify({napake:window.__r360err, stevilo:window.__r360err.length})" 2>&1 | tail -1

agent-browser screenshot /tmp/r360-qa-vodja.png >/dev/null 2>&1 || true
agent-browser close --all >/dev/null 2>&1
echo "=== R360 QA spot KONEC ==="
