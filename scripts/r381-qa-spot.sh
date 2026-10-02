#!/usr/bin/env bash
# r381-qa-spot.sh — R381 produkcija QA spot seja (spot-r167/23;
# ZERO-MUTACIJA — SAMO sonde + navigacijski dispatch + Radix meni/dialog
# odpiranje [pointerdown+click kanon r186-prod-probe4]; NIČ KLIKOV na
# odjavo / preklic seje — session mutacija PREPOVEDANA; preklic NIKOLI
# izveden, samo mounted + className resnica).
# Fokus: val 59 POST-deploy verifikacija (runda R381 po KOLIZIJI #22 preimenovana iz R380) — 4 needleji r379.tsv (era
# preverba TRIINTRIDESIJNA R380 dokazuje ŽIVO DIREKTNO chunk_014/031/028;
# ta sonda dokumentira MONTIRANO DOM resnico z mounted + className
# LOČENO, LEKCIJA R365 (4); dispatch + pocakaj VSAKA, LEKCIJA R370 (6)):
#   N1 top-bar CMP par (L261+L268): 'Ta naprava' + 'Vse naprave (tudi ta)'
#      DropdownMenuItem — vrata: user meni ODPRT (kanon r186: trigger
#      aria-label="Odjava" pointerdown+click); pričakuj 2 × red/40+
#      offset-2 pariteta; KLIK NA ODJAVO PREPOVEDAN — samo pregled.
#   N2 sessions-dialog par (L316+L348): 'Prekliči sejo na napravi: ...'
#      (!s.current) + 'Odjavi vse ostale naprave' (ostaliCount > 0) —
#      vrata: dialog ODPRT (meni → 'Aktivne seje'); dinamična disk
#      resnica (odvisna od števila sej spot računa — obe veji iskreno
#      poročani); KLIK NA PREKLIC PREPOVEDAN.
#   N3 dashboard KIT par (L1914+L2059): 'Poskusi znova' error-retry —
#      vrata: invError / narocilaError (fetch napaka) — zdrava seja = 0
#      montiranih (iskreno, kanon r277 + razlog iz vira).
#   N4 termini-card L474 + roksal-catalog L201: 'Poskusi znova'
#      error-retry — vrata: napaka (fetch napaka; termini na dashboard
#      zavihku, catalog na more>catalog) — zdrava seja = 0 montiranih
#      (iskreno, kanon r277 + razlog iz vira).
# Sonde: eb_sonda_navy_stetje + eb_sonda_red_stetje + kolektor konzolnih
# napak ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R381 QA spot seja (spot-r167/23 — val 59 POST-deploy) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r381err

echo "--- A: top-bar user meni ODPRT → N1 MONTIRAN + className LOČENO (kanon r186) ---"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!g) return 'trigger-ni-najden'; g.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); g.click(); return 'meni-odprt';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Vse naprave (tudi ta)'));})()" 30
agent-browser eval "JSON.stringify({
  val59RedMeniItemi: [...document.querySelectorAll('[role=\"menuitem\"]')].filter(x=>(x.className||'').split(/\\s+/).includes('focus-visible:ring-roksal-red/40')).length,
  val59Ring2: [...document.querySelectorAll('[role=\"menuitem\"]')].filter(x=>(x.className||'').split(/\\s+/).includes('focus-visible:ring-roksal-red/40')&&(x.className||'').split(/\\s+/).includes('focus-visible:ring-2')).length,
  val59Offset2: [...document.querySelectorAll('[role=\"menuitem\"]')].filter(x=>(x.className||'').split(/\\s+/).includes('focus-visible:ring-roksal-red/40')&&(x.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length,
  val59Gap2: [...document.querySelectorAll('[role=\"menuitem\"]')].filter(x=>(x.className||'').split(/\\s+/).includes('focus-visible:ring-roksal-red/40')&&(x.className||'').split(/\\s+/).includes('gap-2')).length,
  taNapravaBesedilo: [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Ta naprava')),
  vseNapraveBesedilo: [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Vse naprave (tudi ta)'))
})" 2>&1 | tail -1

echo "--- A2: zapri meni (Escape) → od-montiran dokaz ---"
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'escape-poslan';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "JSON.stringify({ menuitemiPoEscape: document.querySelectorAll('[role=\"menuitem\"]').length })" 2>&1 | tail -1

echo "--- B: meni → 'Aktivne seje' dialog ODPRT → N2 dinamična resnica ---"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!g) return 'trigger-ni-najden'; g.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); g.click(); return 'meni-odprt';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Aktivne seje'));})()" 30
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Aktivne seje')); if(!m) return 'item-ni-najden'; m.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); m.click(); return 'dialog-odprt';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return !!document.querySelector('[role=\"dialog\"]');})()" 30
sleep 2
agent-browser eval "JSON.stringify({
  dialogMontiran: !!document.querySelector('[role=\"dialog\"]'),
  aktivnihSejNapis: ([...document.querySelectorAll('[role=\"dialog\"] p')].map(p=>p.textContent).find(t=>t&&/aktivn(a|ih) sej/.test(t))||''),
  taNapravaBadge: [...document.querySelectorAll('[role=\"dialog\"] span')].filter(s=>s.textContent==='Ta naprava').length,
  prekliciGumbi: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Prekliči sejo na napravi')).length,
  ostaliGumb: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave')).length,
  val59PressScale: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>((b.getAttribute('aria-label')||'').startsWith('Prekliči sejo na napravi')||(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave'))&&(b.className||'').split(/\\s+/).includes('press-scale')).length,
  val59Ring2: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>((b.getAttribute('aria-label')||'').startsWith('Prekliči sejo na napravi')||(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave'))&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-2')).length,
  val59Red40: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>((b.getAttribute('aria-label')||'').startsWith('Prekliči sejo na napravi')||(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave'))&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-roksal-red/40')).length,
  val59Offset2: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>((b.getAttribute('aria-label')||'').startsWith('Prekliči sejo na napravi')||(b.getAttribute('aria-label')||'').startsWith('Odjavi vse ostale naprave'))&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length
})" 2>&1 | tail -1

echo "--- B2: zapri dialog (Escape) ---"
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'escape-poslan';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "JSON.stringify({ dialogPoEscape: !!document.querySelector('[role=\"dialog\"]') })" 2>&1 | tail -1

echo "--- C: dashboard — N3 error-retry iskreno 0 (vrata invError/narocilaError — zdrava seja) ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV'));})()" 30
sleep 2
agent-browser eval "JSON.stringify({
  sidroCsv: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV')).length,
  val59N3montiran: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').includes('Poskusi znova')&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-roksal-red/40')&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length,
  zalogaNapakaBanner: [...document.querySelectorAll('main *')].filter(e=>e.children.length===0&&(e.textContent||'').trim()==='Zaloga ni na voljo').length,
  narocilaNapakaBanner: [...document.querySelectorAll('main *')].filter(e=>e.children.length===0&&(e.textContent||'').trim()==='Naročila niso na voljo').length,
  val59N4TerminiMontiran: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').includes('Poskusi znova')&&(b.className||'').split(/\\s+/).includes('mt-2')).length
})" 2>&1 | tail -1

echo "--- D: catalog (more>catalog) — N4 error-retry iskreno 0 (vrata napaka — zdrava seja) ---"
eb_dispatch '{"tab":"more","more":"catalog","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return !!document.querySelector('input[aria-label=\"Iskanje profilov\"]');})()" 30
sleep 2
agent-browser eval "JSON.stringify({
  katalogMontiran: !!document.querySelector('input[aria-label=\"Iskanje profilov\"]'),
  val59N4KatalogMontiran: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').includes('Poskusi znova')&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-roksal-red/40')&&(b.className||'').split(/\\s+/).includes('focus-visible:ring-offset-2')).length,
  katalogNapakaBanner: [...document.querySelectorAll('main *')].filter(e=>e.children.length===0&&(e.textContent||'').includes('Profilov ni bilo mogoče naložiti')).length
})" 2>&1 | tail -1

echo "--- E: sonde (navy + red stetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- F: kolektor ---"
eb_preberi_kolektor r381err

agent-browser close --all >/dev/null 2>&1
echo "=== R381 spot KONEC ==="
