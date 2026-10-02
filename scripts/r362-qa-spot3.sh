#!/usr/bin/env bash
# r362-qa-spot3.sh — R362 val 45 spot-probe (spot-r167/7): ring PARITETA
# quote-followup izvozne trojice + h-8 akcije trojice + NOVI per-item aria.
# ⏱ ISKREN časovni kontrakt: tekmovan je PRED-deploy baseline (val 45 še NI
# na produ) — pričakovano: pressScaleBrezOffset=3 [izvozna trojica še stari
# razred; h-8 akcije NISO press-scale → niso v tej sondu], aria Pokliči/+3/+7
# ŠE NE OBSTAJA (0). Po zelenem deployu (R363 era preverba statično + ta
# sonda ponovno) pričakovano: pressScaleBrezOffset=0 + vseh 6 novih nizov
# ŽIVO. ZERO-MUTACIJA. 1. UPORABA kanona eb_sonda_ring_pariteta (e2e-lib
# dedup 2. val — LEKCIJA R361: kanon porabljen ob 1. uporabi, ne papir).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R362 val 45 spot (spot-r167/7 — PRED-deploy baseline) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r362err3

echo "--- A: CRM — POLL izvoznih pillov ---"
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi CSV ('));})()" 15

echo "--- B: OŽKA ring-paritetna sonda (1. uporaba kanona) ---"
eb_sonda_ring_pariteta

echo "--- C: val 45 DOM identifikacija — izvozna trojica className + h-8 akcije + NOVI aria ---"
agent-browser eval "JSON.stringify({
  izvoznaTrojicaOffset2: [...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi pregled spomnikov ponudb')||(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazani seznam ponudb v CSV')).map(b=>(b.className||'').includes('ring-offset-2')),
  pokliciAria: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Pokliči — spomnik za ')),
  plus3Aria: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').endsWith(' na +3 dni')),
  plus7Aria: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').endsWith(' na +7 dni')),
  h8Offset2: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('h-8')&&(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length,
  h8BrezOffset: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('h-8')&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1

echo "--- D: kolektor ---"
eb_preberi_kolektor r362err3

agent-browser close --all >/dev/null 2>&1
echo "=== R362 val 45 spot KONEC ==="
