#!/usr/bin/env bash
# r363-qa-spot.sh — R363 produkcija QA spot seja (spot-r167/8; ZERO-MUTACIJA;
# e2e-lib kanon r231). Fokus:
# (a) val 45 post-deploy POTRJENA (R362 spot3 re-run: BrezOffset 3→0,
#     izvoznaTrojicaOffset2 [true×3] — časovni kontrakt izpolnjen; era
#     preverba R363 val 45 ×4 ŽIVO DIREKTNO [chunk_036]);
# (b) ⭐ 1. UPORABA kanona eb_pocakaj_csv_pilli (e2e-lib dedup 3. val —
#     prag ×7 presežen; LEKCIJA R362 (3): kanon porabljen ob 1. uporabi);
# (c) val 46 PRED-deploy baseline (iskren časovni kontrakt): inventory-tab
#     ring pariteta — pričakovano ZDAJ (stara koda na produ): izvozni
#     CSV/PDF pilli + Kopiraj naročilnico + Dodaj gibanje = className BREZ
#     ring-offset-2 [false]; po zelenem deployu (R364 era preverba + ta
#     sonda re-run) pričakovano VSI true. aria ŽE ŽIVO (zamrznjeni nizi);
# (d) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R363 QA spot seja (spot-r167/8 — val 46 PRED-deploy baseline) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r363err

echo "--- A: CRM — POLL izvoznih pillov PREK NOVEGA KANONA (1. uporaba eb_pocakaj_csv_pilli) + val 45 parity re-check ---"
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_csv_pilli 15
eb_sonda_ring_pariteta

echo "--- B: Zaloge (inventory) — POLL do h2 'Zaloga' + val 46 baseline (className offset stanje) ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='Zaloga');})()" 15
agent-browser eval "JSON.stringify({
  h2Zaloga: [...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='Zaloga'),
  izvoziCsvOffset2: (document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot CSV\"]')?.className||'').includes('ring-offset-2'),
  izvoziPdfOffset2: (document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot PDF\"]')?.className||'').includes('ring-offset-2'),
  kopirajNarocilnicoOffset2: (document.querySelector('button[aria-label=\"Kopiraj naročilnico vidnih artiklov pod minimalno zalogo\"]')?.className||'').includes('ring-offset-2'),
  dodajGibanjeOffset2: (document.querySelector('button[aria-label=\"Dodaj gibanje zaloge\"]')?.className||'').includes('ring-offset-2'),
  dodajGibanjeMounted: !!document.querySelector('button[aria-label=\"Dodaj gibanje zaloge\"]'),
  izvoziCsvMounted: !!document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot CSV\"]'),
  sonnaPressScale: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')).length,
  sonnaBrezOffset: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1

echo "--- C: kolektor ---"
eb_preberi_kolektor r363err

agent-browser close --all >/dev/null 2>&1
echo "=== R363 spot KONEC ==="
