#!/usr/bin/env bash
# r361-qa-spot2.sh — R361 re-proba (iskrenost: 1. tek C-probe je imel OBSEG
# mismatch — ringBrezOffset:25 šteje VES dokument [vodja-lupina + tab bar +
# drugi montirani gradniki], ne crm-tab vira; opomnikPdf je per-stranka,
# pogojno renderan [iskrena praznina brez strank — kanon r277]). Re-proba z
# OZKIM obsegom: press-scale pilli = crm-tab izvozni bratje; status filter
# bratje = text-[11px] brez press-scale. LEKCIJA R360 (1): re-probe obvezna
# ob sumu. ZERO-MUTACIJA.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R361 re-proba (spot-r167/4) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r361err2

echo "--- C2: CRM — OZKI obseg (samo crm-tab pilli) ---"
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi CSV ('));})()" 15
agent-browser eval "JSON.stringify({
  pressScaleSkupaj: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')).length,
  pressScaleOffset2: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length,
  pressScaleBrezOffset: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length,
  statusFilterOffset2: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('text-[11px]')&&!(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length,
  csvPillRingOffset2: (document.querySelector('button[aria-label^=\"Izvozi CSV (\"]')?.className||'').includes('ring-offset-2'),
  potekliPdfRingOffset2: (document.querySelector('button[aria-label=\"Izvozi potekle opomnike kot PDF\"]')?.className||'').includes('ring-offset-2'),
  koledarPdfRingOffset2: (document.querySelector('button[aria-label=\"Izvozi koledar pregledov kot PDF\"]')?.className||'').includes('ring-offset-2'),
  strank: document.body.innerText.match(/strank/gi)?.length ?? 0
})" 2>&1 | tail -1

echo "--- E2: kolektor — NOV kanon ---"
eb_preberi_kolektor r361err2

agent-browser close --all >/dev/null 2>&1
echo "=== R361 re-proba KONEC ==="
