#!/usr/bin/env bash
# r361-qa-spot.sh — R361 produkcija QA spot seja (ZERO-MUTACIJA; e2e-lib kanon
# r231; spot-r167 precedens R127/R165/R166/R358/R359/R360). Fokus:
# (a) splošno zdravje po R360 deployu (val 43 invoice aria ŽIVO — chunk_037
#     potrjen direktno s ŠTIRINAJSTIJNO preverbo R361);
# (b) ⭐ val 44 spot: crm-tab ring PARITETA — DOM sken (className contains):
#     pričakovano ≥9 gumbov z focus-visible:ring-offset-2 in 0 × ring-2
#     navy/40 BREZ offseta (iskrena pre-merna resnica: pre-runde je bilo 8
#     brez + 1 z offset-1);
# (c) ⭐ KANON PORABLJEN ob 1. uporabi: kolektor konzolnih napak prek NOVIH
#     e2e-lib pomožnikov eb_kolektor_napak / eb_preberi_kolektor (e2e-lib
#     dedup 1. val — 3. identični inline blok iz r358/r359/r360 utemeljil EN
#     VIR; zamrznjeni skripti NI mutirani); kolektor ŠELE PO prijavi
#     (LEKCIJA R358);
# (d) poll kanon (LEKCIJA R359/R360): ankor = NAJZAKASNEJŠI znani element
#     ('Ni projektov' / 'Izvozi CSV (' / 'AI raba'), ne prva glava.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R361 QA spot seja (spot-r167/3) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
# kolektor konzolnih napak — šele PO prijavi (LEKCIJA R358), prek NOVEGA kanona
eb_kolektor_napak r361err

echo "--- A: dashboard render — POLL do 'Odpri iskalnik' ---"
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 10
agent-browser eval "JSON.stringify({iskalnik:!!document.querySelector('button[aria-label=\"Odpri iskalnik\"]'),glava:document.body.innerText.slice(0,100).replace(/\n/g,' | ')})" 2>&1 | tail -1

echo "--- B: Meritve — POLL do NAJZAKASNEJŠEGA ankorja (praznina ALI tabela) ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Ni projektov') || document.querySelectorAll('table').length > 0;})()" 12
agent-browser eval "JSON.stringify({
  niProjektov: document.body.innerText.includes('Ni projektov'),
  syncAllTitle: (document.querySelector('button[title=\"Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu\"]')!==null),
  verzijeToggleRing: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('focus-visible:ring-offset-2')).length
})" 2>&1 | tail -1

echo "--- C: CRM tab — POLL do izvoznih pillov (NAJZAKASNEJŠI znani ankor) + val 44 ring pariteta ---"
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi CSV ('));})()" 15
agent-browser eval "JSON.stringify({
  csvPill: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi CSV (')),
  potekliPdf: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi potekle opomnike kot PDF'),
  koledarIcs: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi koledar pregledov kot ICS'),
  opomnikPdf: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Pripravi opomnik kot PDF'),
  ringOffset2: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('focus-visible:ring-roksal-navy/40')&&(b.className||'').includes('focus-visible:ring-offset-2')).length,
  ringBrezOffset: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('focus-visible:ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length,
  amberKarticaOffset: [...document.querySelectorAll('div')].some(d=>(d.className||'').includes('focus-visible:ring-roksal-amber')&&(d.className||'').includes('focus-visible:ring-offset-2'))
})" 2>&1 | tail -1

echo "--- D: vodja — POLL do NAJZAKASNEJŠEGA elementa 'AI raba' ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('AI raba');})()" 20
agent-browser eval "JSON.stringify({
  glava: document.body.innerText.includes('Field Manager'),
  aiRaba: document.body.innerText.includes('AI raba — iskrena resnica'),
  csvPills: document.querySelectorAll('button[aria-label*=\"CSV\" i]').length
})" 2>&1 | tail -1

echo "--- E: konzolne napake — PREK NOVEGA KANONA eb_preberi_kolektor ---"
eb_preberi_kolektor r361err

agent-browser close --all >/dev/null 2>&1
echo "=== R361 spot KONEC ==="
