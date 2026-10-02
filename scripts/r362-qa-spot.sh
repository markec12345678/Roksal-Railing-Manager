#!/usr/bin/env bash
# r362-qa-spot.sh — R362 produkcija QA spot seja (ZERO-MUTACIJA; e2e-lib kanon
# r231; spot-r167 precedens). Fokus:
# (a) splošno zdravje po R361 deployu (val 44 crm-tab ring PARITETA ŽIVO —
#     potrjeno direktno s PETNAJSTIJNO preverbo R362: 3/3 chunk_037);
# (b) ⭐ val 43 DOM preverba računovodskih akcij (invoice-manager, montiran v
#     crm-tab): aria 'Izdaj račun — status iz osnutka v izdan', title
#     'Trajno izbriši osnutek računa…', title 'Uredi osnutek…' — POGOJNO
#     renderanje (iskrena praznina brez osnutkov — kanon r277); štejem
#     količine namesto trditev;
# (c) val 44 OZKI obseg re-check (LEKCIJA R361: DOM probe obseg = VES
#     dokument — od 1. teka OZKI selektorji: press-scale pilli + text-[11px]
#     status filter, SAMO znotraj ring-roksal-navy/40 družine);
# (d) NOV surfacespot: Zaloge (inventory) — poll do NAJZAKASNEJŠEGA ankorja;
# (e) kolektor konzolnih napak prek e2e-lib kanona (eb_kolektor_napak /
#     eb_preberi_kolektor), ŠELE PO prijavi (LEKCIJA R358);
# (f) poll kanon (LEKCIJA R359/R360): ankor = NAJZAKASNEJŠI znani element.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R362 QA spot seja (spot-r167/5) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r362err

echo "--- A: dashboard render — POLL do 'Odpri iskalnik' ---"
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 10
agent-browser eval "JSON.stringify({iskalnik:!!document.querySelector('button[aria-label=\"Odpri iskalnik\"]'),glava:document.body.innerText.slice(0,100).replace(/\n/g,' | ')})" 2>&1 | tail -1

echo "--- B: Meritve — POLL do NAJZAKASNEJŠEGA ankorja (praznina ALI tabela) ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Ni projektov') || document.querySelectorAll('table').length > 0;})()" 12
agent-browser eval "JSON.stringify({
  niProjektov: document.body.innerText.includes('Ni projektov'),
  syncAllTitle: (document.querySelector('button[title=\"Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu\"]')!==null)
})" 2>&1 | tail -1

echo "--- C: CRM — POLL izvoznih pillov + val 43 računovodske akcije + val 44 OŽKI ring parity (prek NOVEGA kanona eb_sonda_ring_pariteta — e2e-lib dedup 2. val) ---"
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi CSV ('));})()" 15
agent-browser eval "JSON.stringify({
  csvPill: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi CSV (')),
  izdajAria: [...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izdaj račun — status iz osnutka v izdan').length,
  brisiTitle: [...document.querySelectorAll('button')].filter(b=>(b.title||'')==='Trajno izbriši osnutek računa — brisanje ni možno razveljaviti').length,
  urediTitle: [...document.querySelectorAll('button')].filter(b=>(b.title||'')==='Uredi osnutek — osnutek se odstrani, dialog zapolni polja; shranjevanje ustvari nov račun').length
})" 2>&1 | tail -1
# OŽKA ring-paritetna sonda — EN VIR (R361-qa-spot2 C2 + ta skript = 2. ponovitev bloka)
eb_sonda_ring_pariteta

echo "--- D: Zaloge (NOV surface spot) — POLL do NAJZAKASNEJŠEGA ankorja ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.length > 500;})()" 12
agent-browser eval "JSON.stringify({
  glava: document.body.innerText.slice(0,160).replace(/\n/g,' | '),
  gumbov: document.querySelectorAll('button').length,
  tabel: document.querySelectorAll('table').length,
  zalogeBeseda: document.body.innerText.includes('Zaloge') || document.body.innerText.includes('zalog')
})" 2>&1 | tail -1

echo "--- E: konzolne napake — PREK KANONA eb_preberi_kolektor ---"
eb_preberi_kolektor r362err

agent-browser close --all >/dev/null 2>&1
echo "=== R362 spot KONEC ==="
