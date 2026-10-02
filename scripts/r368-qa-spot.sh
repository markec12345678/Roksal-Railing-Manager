#!/usr/bin/env bash
# r368-qa-spot.sh — R368 produkcija QA spot seja (spot-r167/13;
# ZERO-MUTACIJA; e2e-lib kanon r231). Fokus:
# (a) val 50 POST-deploy re-proba — RDEČE površine (era preverba ŽE dokazala
#     3/4 needlejev ŽIVO direktno + sketch prek hash rezolucije
#     1085983bcb110e2c.js — ta sonda dokumentira MONTIRANO DOM resnico z
#     mounted + className LOČENO, LEKCIJA R365 (4)): logistics Upokoji
#     (aria startsWith 'Upokoji ' — vrata: oprema z statusom), logistics
#     'Zaključi z override' (vrata: QC dialog + override razlog), photo
#     'Izbriši mero' (vrata: mera z isPhoto && photoId), sketch 'Pobriši
#     celotno skico' (vrata: projekt odprt + strokes — demo brez projektov =
#     kanon r277 iskrena praznina), material cancel dialog destruktivni
#     potrditveni gumb red-600/40 (vrata: cancelDialogOrder !== null —
#     demo brez naročil); PRIČAKUJ večino iskreno NEmontiranih v demo
#     praznini (kanon r277 — razlog iz vira, ne tiha 'false');
# (b) FEATURE e2e-lib dedup 8. val: 1. UPORABA kanona eb_sonda_navy_stetje
#     (3-poljni navy/40 števec byte-identičen ×3 v r366/r367 spotih — md5
#     d1f0004c299648ab1ff88f06bdafc889) na logistiki + meritvah;
# (c) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R368 QA spot seja (spot-r167/13 — val 50 POST-deploy rdeče re-probe) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r368err

echo "--- A: Logistika — val 50 rdeče površine + 1. UPORABA eb_sonda_navy_stetje ---"
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main h1, main h2')].length > 0;})()" 20
eb_sonda_navy_stetje
agent-browser eval "JSON.stringify({
  upokojiMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Upokoji ')).length,
  upokojiOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Upokoji ')&&(b.className||'').includes('ring-red-400/50')&&(b.className||'').includes('ring-offset-2')).length,
  qcOverrideMounted: [...document.querySelectorAll('main button')].some(b=>(b.textContent||'').trim()==='Zaključi z override'),
  mainRed: [...document.querySelectorAll('main button')].filter(b=>/ring-red-\d+\//.test(b.className||'')).length,
  mainRedOffset2: [...document.querySelectorAll('main button')].filter(b=>/ring-red-\d+\//.test(b.className||'')&&(b.className||'').includes('ring-offset-2')).length,
  mainRedBrezOffset: [...document.querySelectorAll('main button')].filter(b=>/ring-red-\d+\//.test(b.className||'')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1

echo "--- B: Meritve — val 50 photo 'Izbriši mero' re-proba + navy sonda 2. uporaba ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_meritve 15
eb_sonda_navy_stetje
agent-browser eval "JSON.stringify({
  izbrisiMeroMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izbriši mero').length,
  izbrisiMeroOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izbriši mero'&&(b.className||'').includes('ring-red-400/50')&&(b.className||'').includes('ring-offset-2')).length,
  mainRed: [...document.querySelectorAll('main button')].filter(b=>/ring-red-\d+\//.test(b.className||'')).length,
  mainRedOffset2: [...document.querySelectorAll('main button')].filter(b=>/ring-red-\d+\//.test(b.className||'')&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1

echo "--- C: Skica + Material status — pogojne površine, iskrena vrata iz vira ---"
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label=\"Izvozi naročila kot CSV\"]');})()" 20
agent-browser eval "JSON.stringify({
  preklicDialogMounted: [...document.querySelectorAll('[role=\"alertdialog\"], [role=\"dialog\"]')].length > 0,
  destruktivniPotrdiMounted: [...document.querySelectorAll('main button')].some(b=>(b.className||'').includes('ring-red-600/40')),
  nacrtiPraznina: document.body.textContent.includes('Ni naročil'),
  mainRed: [...document.querySelectorAll('main button')].filter(b=>/ring-red-\d+\//.test(b.className||'')).length,
  mainRedOffset2: [...document.querySelectorAll('main button')].filter(b=>/ring-red-\d+\//.test(b.className||'')&&(b.className||'').includes('ring-offset-2')).length,
  mainRedBrezOffset: [...document.querySelectorAll('main button')].filter(b=>/ring-red-\d+\//.test(b.className||'')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1

echo "--- D: kolektor ---"
eb_preberi_kolektor r368err

agent-browser close --all >/dev/null 2>&1
echo "=== R368 spot KONEC ==="
