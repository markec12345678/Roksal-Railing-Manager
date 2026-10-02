#!/usr/bin/env bash
# r371-vodja-identify.sh — identifikacija 1× navy/40 BrezOffset 'Izvozi *'
# gumba na vodja tabu (D2-stil dokaz — disk resnica pred odločitvijo).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r371id
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi ')).length >= 3;})()" 20
agent-browser eval "JSON.stringify([...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi ')&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).map(b=>({aria:(b.getAttribute('aria-label')||''),tekst:(b.textContent||'').trim().slice(0,30)})))" 2>&1 | tail -1
eb_preberi_kolektor r371id
agent-browser close --all >/dev/null 2>&1
echo "=== R371 vodja-identify KONEC ==="
