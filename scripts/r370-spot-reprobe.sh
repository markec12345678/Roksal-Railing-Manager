#!/usr/bin/env bash
# r370-spot-reprobe.sh — dopolnilna sonde: A-section ponovitev S dispatch+wait
# (izkrena napaka r370-qa-spot.sh A: brez dispatch/poll — surface ni bil
# montiran; LEKCIJA: vsaka površinska sonda rabi dispatch + pocakaj) +
# identifikacija 1× navy/40 BrezOffset gumba na dashboardu (val 53 disk
# resnica) + FAB re-proba.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r370err2

echo "--- A2: dashboard dispatch + pocakaj → bottom-nav ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('nav button')].length > 0;})()" 20
agent-browser eval "JSON.stringify({
  navGumbi: [...document.querySelectorAll('nav button')].length,
  navGumbiNavy40: [...document.querySelectorAll('nav button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')).length,
  navGumbiNavy40Ink40: [...document.querySelectorAll('nav button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('dark:focus-visible:ring-roksal-ink/40')).length,
  navGumbiOffset2: [...document.querySelectorAll('nav button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length,
  navGumbiBrezOffseta: [...document.querySelectorAll('nav button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- FAB re-proba (sprožilec na dashboardu) ---"
agent-browser eval "JSON.stringify({
  fabSprozilec: [...document.querySelectorAll('button')].filter(b=>['Hitre akcije','Zapri hitre akcije'].includes(b.getAttribute('aria-label')||'')).map(b=>b.getAttribute('aria-label')),
  fabNavy40Ink40: [...document.querySelectorAll('button')].filter(b=>['Hitre akcije','Zapri hitre akcije'].includes(b.getAttribute('aria-label')||'')&&(b.className||'').includes('ring-roksal-navy/40')).length,
  fabOffset2: [...document.querySelectorAll('button')].filter(b=>['Hitre akcije','Zapri hitre akcije'].includes(b.getAttribute('aria-label')||'')&&(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length
})" 2>&1 | tail -1

echo "--- D2: navy/40 BrezOffset gumbi na dashboardu — identifikacija (aria + tekst) ---"
agent-browser eval "JSON.stringify([...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).map(b=>({aria:(b.getAttribute('aria-label')||''),tekst:(b.textContent||'').trim().slice(0,40),ink:(b.className||'').includes('dark:focus-visible:ring-roksal-ink/40')})))" 2>&1 | tail -1

echo "--- E2: kolektor ---"
eb_preberi_kolektor r370err2
agent-browser close --all >/dev/null 2>&1
echo "=== R370 re-proba KONEC ==="
