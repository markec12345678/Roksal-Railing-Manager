#!/usr/bin/env bash
# r369-qa-spot.sh — R369 produkcija QA spot seja (spot-r167/14;
# ZERO-MUTACIJA; e2e-lib kanon r231). Fokus:
# (a) val 51 POST-deploy re-proba — AMBER površine (era preverba DVAINDVJSETIJNA
#     že dokazuje needleje iz registrov; ta sonda dokumentira MONTIRANO DOM
#     resnico z mounted + className LOČENO, LEKCIJA R365 (4)): inclinometer
#     'Vklopi libelo' (vrata: permission === 'idle' — na svežem profilu
#     MONTIRANA; ena od rednih vedno-montiranih amber površin), merilne
#     amber površine 'Poglej foto' + cenovni label (vrata: mera — demo
#     praznina), obvestilna kartica amber/60 (vrata: Sheet odprt + seznam
#     obvestil — demo praznina), viz ročaji plain amber (vrata: projekt
#     odprt — demo brez projektov), photo kategorija/debelina/orodja (vrata:
#     foto urejevalnik odprt — demo brez fotografij); PRIČAKUJ večino
#     iskreno NEmontiranih v demo praznini (kanon r277 — razlog iz vira,
#     ne tiha 'false'); top-bar iskalnik white/60 + ring-offset-0 = VRSTA
#     DOKUMENTIRANA namerna gosta površina (iskalni gumb, vedno montiran);
# (b) FEATURE e2e-lib dedup 9. val: 1. UPORABA kanona eb_sonda_red_stetje
#     (rdeči trio byte-identičen ×2 v r368-qa-spot A/C — md5
#     03c8497dc9baf54c87e78a7dcb6f8ad8; skrajšani par ×3 — md5 640fec6d…,
#     prag R352 izenačen) + 2. uporaba eb_sonda_navy_stetje (val 47/49
#     stabilnost);
# (c) kolektor konzolnih napak — ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R369 QA spot seja (spot-r167/14 — val 51 POST-deploy amber re-probe) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r369err

echo "--- A: Inklinometer — val 51 MONTIRANA amber površina + sonde (rdeči 1. uporaba) ---"
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.body.textContent.includes('Vklopi libelo') || document.body.textContent.includes('Izberite projekt');})()" 20
agent-browser eval "JSON.stringify({
  vklopiLibeloMounted: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').includes('Vklopi libelo')).length,
  vklopiLibeloAmber50: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').includes('Vklopi libelo')&&(b.className||'').includes('ring-roksal-amber/50')).length,
  vklopiLibeloOffset2: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').includes('Vklopi libelo')&&(b.className||'').includes('ring-roksal-amber/50')&&(b.className||'').includes('ring-offset-2')).length,
  iskalnikMounted: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Odpri iskalnik (Ctrl+K)'),
  iskalnikWhite60O0: [...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Odpri iskalnik (Ctrl+K)'&&(b.className||'').includes('ring-white/60')&&(b.className||'').includes('ring-offset-0')).length
})" 2>&1 | tail -1
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- B: Meritve — val 51 pogojne amber površine (vrata iz vira) ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_meritve 15
agent-browser eval "JSON.stringify({
  merCount: [...document.querySelectorAll('main button')].length,
  poglejFotoMounted: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').includes('foto')||(b.getAttribute('aria-label')||'').includes('Fotografij')).length,
  poglejFotoAmber40Offset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-amber/40')&&(b.className||'').includes('ring-offset-2')).length,
  cenovniLabelMounted: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('border-roksal-amber/30')).length,
  merAmber40: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-amber/40')).length,
  merAmber40Offset2: [...document.querySelectorAll('main button')].filter(b=>(b.className||'').includes('ring-roksal-amber/40')&&(b.className||'').includes('ring-offset-2')).length,
  merBrezVsehVratRazlog: document.body.textContent.includes('Ni meritev') || document.body.textContent.includes('Dodaj prvo meritev')
})" 2>&1 | tail -1
eb_sonda_navy_stetje

echo "--- C: Obvestila — Sheet kartica amber/60 (vrata: seznam obvestil) ---"
agent-browser eval "(()=>{const z=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Obvestila')); if(!z) return 'ni zvoncka'; z.click(); return 'klik';})()" 2>&1 | tail -1
eb_cakaj 2
agent-browser eval "JSON.stringify({
  sheetKarticeAmber60: [...document.querySelectorAll('[role=\"dialog\"] button, [data-state=\"open\"] button')].filter(b=>(b.className||'').includes('ring-roksal-amber/60')).length,
  sheetKarticeAmber60Offset2: [...document.querySelectorAll('[role=\"dialog\"] button, [data-state=\"open\"] button')].filter(b=>(b.className||'').includes('ring-roksal-amber/60')&&(b.className||'').includes('ring-offset-2')).length,
  prazenSeznam: document.body.textContent.includes('Ni obvestil') || document.body.textContent.includes('ni obvestil'),
  ponovnoNalozi: [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'')==='Ponovno naloži obvestila')
})" 2>&1 | tail -1
agent-browser eval "(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" > /dev/null 2>&1
eb_cakaj 1

echo "--- D: Viz — ročaji plain amber (vrata: projekt odprt) ---"
eb_dispatch '{"tab":"viz","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  vizPlainAmberMounted: [...document.querySelectorAll('main button')].filter(b=>/focus-visible:ring-roksal-amber(?![-\/])/.test(b.className||'')).length,
  vizPlainAmberOffset2: [...document.querySelectorAll('main button')].filter(b=>/focus-visible:ring-roksal-amber(?![-\/])/.test(b.className||'')&&(b.className||'').includes('ring-offset-2')).length,
  vizPrazninaRazlog: document.body.textContent.includes('Izberite projekt') || document.body.textContent.includes('Ni projektov')
})" 2>&1 | tail -1

echo "--- E: Photo — kategorija/debelina/orodja (vrata: foto urejevalnik) ---"
eb_dispatch '{"tab":"photos","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
agent-browser eval "JSON.stringify({
  fotoKategorijaMounted: [...document.querySelectorAll('main button[aria-pressed]')].filter(b=>['PRED','MED','PO'].includes((b.textContent||'').trim())).length,
  fotoKategorijaOffset2: [...document.querySelectorAll('main button[aria-pressed]')].filter(b=>['PRED','MED','PO'].includes((b.textContent||'').trim())&&(b.className||'').includes('ring-roksal-amber/50')&&(b.className||'').includes('ring-offset-2')).length,
  fotoPrazninaRazlog: document.body.textContent.includes('Ni fotografij') || document.body.textContent.includes('Izberite projekt')
})" 2>&1 | tail -1

echo "--- F: kolektor ---"
eb_preberi_kolektor r369err

agent-browser close --all >/dev/null 2>&1
echo "=== R369 spot KONEC ==="
