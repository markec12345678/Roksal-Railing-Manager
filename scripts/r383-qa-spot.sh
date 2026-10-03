#!/usr/bin/env bash
# r383-qa-spot.sh — R383 produkcija QA spot seja (spot-r167/24;
# ZERO-MUTACIJA — SAMO sonde + navigacijski dispatch + Radix meni/dialog
# odpiranje [kanon r186 pointerdown+click] + ENA net-zero localStorage
# semena [stair templates = client-scoped localStorage, BREZ DB klica —
# original vrednost shranjena in obnovljena, dokumentirano]) NIČ klikov
# na odjavo/preklic/brisanje.
# Fokus: val 60 POST-deploy verifikacija — 4 needleji r381.tsv (era
# preverba PETINTRIDESIJNA R382 dokazuje ŽIVO DIREKTNO chunk_015/028/
# 026/045; ta sonda dokumentira MONTIRANO DOM resnico z mounted +
# className LOČENO, LEKCIJA R365 (4)):
#   N1 top-bar navy meni evolved ×3 (L239+L246+L253) + rdeča evolved ×2
#      (L261+L268, val 59+60) — vrata: user meni ODPRT (trigger
#      aria-label="Odjava", pointerdown+click); Escape → od-montiran.
#   N2 audit-trail L310 nativni <button> (razpiranje vnosa) — vrata:
#      projekt detajl (klik prve projektne kartice) → 'Revizijska sled'
#      → dialog z vnosi; dinamična disk resnica (odvisna od št. audit
#      vnosov izbranega projekta — obe veji iskreno poročani).
#   N3 measurements L4020 nativni <button> 'Naloži stopnično predlogo'
#      — vrata: stairTemplates.length > 0 [localStorage
#      'roksal_stair_templates' — NET-ZERO semena: original → seed →
#      verify → obnovitev originala; nič na strežniku].
#   N4 photo L2370 nativni <button> 'Uredi mero' — vrata: odprta slika
#      z ≥1 merjenjem (DB podatki) — iskren poskus + razlog iz vira
#      (kanon r277) če ni dosegljivo.
# Sonde: eb_sonda_navy_stetje + eb_sonda_red_stetje + kolektor ŠELE PO
# prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R383 QA spot seja (spot-r167/24 — val 60 POST-deploy) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r383err

echo "--- A: top-bar user meni ODPRT → N1 navy evolved ×3 + red evolved ×2 + className LOČENO (kanon r186) ---"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!g) return 'trigger-ni-najden'; g.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); g.click(); return 'meni-odprt';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Vse naprave (tudi ta)'));})()" 30
agent-browser eval "JSON.stringify({
  navyEvolved: [...document.querySelectorAll('[role=\"menuitem\"]')].filter(x=>['gap-2','transition-colors','focus-visible:ring-2','focus-visible:ring-roksal-navy/40','focus-visible:ring-offset-2'].every(t=>(x.className||'').split(/\\s+/).includes(t))).length,
  redEvolved: [...document.querySelectorAll('[role=\"menuitem\"]')].filter(x=>['gap-2','transition-colors','focus-visible:ring-2','focus-visible:ring-roksal-red/40','focus-visible:ring-offset-2'].every(t=>(x.className||'').split(/\\s+/).includes(t))).length,
  staraOblika: [...document.querySelectorAll('[role=\"menuitem\"]')].filter(x=>(x.className||'').includes('gap-2 focus-visible:ring-2')).length
})" 2>&1 | tail -1
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'escape-poslan';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "JSON.stringify({ menuitemiPoEscape: document.querySelectorAll('[role=\"menuitem\"]').length })" 2>&1 | tail -1

echo "--- B: dashboard → prva projektna kartica → detajl → 'Revizijska sled' → N2 chevron razpiranje ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi prikazane projekte v CSV'));})()" 30
agent-browser eval "(()=>{let k=[...document.querySelectorAll('main button')].find(b=>(b.className||'').includes('gap-2.5')&&(b.className||'').includes('py-2.5 text-left')); if(!k){k=[...document.querySelectorAll('main div')].find(d=>(d.className||'').includes('justify-between rounded-lg border p-3')&&(d.className||'').includes('cursor-pointer'));} if(!k) return 'kartica-ni-najdena'; k.click(); return 'detajl-odprt';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"dialog\"] button')].some(b=>(b.textContent||'').includes('Revizijska sled'));})()" 30
agent-browser eval "(()=>{const b=[...document.querySelectorAll('[role=\"dialog\"] button')].find(b=>(b.textContent||'').includes('Revizijska sled')); if(!b) return 'gumb-ni-najden'; b.click(); return 'audit-odprt';})()" 2>&1 | tail -1
sleep 2
agent-browser eval "JSON.stringify({
  dialogi: document.querySelectorAll('[role=\"dialog\"]').length,
  auditChevroni: [...document.querySelectorAll('[role=\"dialog\"] button[aria-expanded]')].filter(b=>['transition-colors','focus-visible:ring-2','focus-visible:ring-roksal-navy/40','focus-visible:ring-offset-2'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length,
  auditChevroniSkupaj: document.querySelectorAll('[role=\"dialog\"] button[aria-expanded]').length
})" 2>&1 | tail -1
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'e1';})()" >/dev/null 2>&1
sleep 1
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'e2';})()" >/dev/null 2>&1
sleep 1
agent-browser eval "JSON.stringify({ dialogiPoEscape: document.querySelectorAll('[role=\"dialog\"]').length })" 2>&1 | tail -1

echo "--- C: measurements — N3 'Naloži stopnično predlogo' (localStorage net-zero semena) ---"
agent-browser eval "(()=>{const k='roksal_stair_templates'; window.__origStair=localStorage.getItem(k); localStorage.setItem(k, JSON.stringify([{id:'stair_qa_sonda_r382',naziv:'QA sonda stopnišče R382',skupnaVisinaMm:1000,stStopnic:12,globinaStopniceMm:250,sirinaStopniceMm:90,createdAt:'2026-10-03T00:00:00.000Z'}])); return window.__origStair===null?'original-null-shranjen':'original-obstojec-shranjen';})()" 2>&1 | tail -1
agent-browser eval "location.reload(); 'reload'" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 45
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.textContent||'').includes('Naloži stopnično predlogo'));})()" 30
agent-browser eval "JSON.stringify({
  nalozilePredlogo: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').includes('Naloži stopnično predlogo')).length,
  val60Par: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').includes('Naloži stopnično predlogo')&&['flex-1','text-left','min-w-0','focus-visible:outline-none','transition-colors','focus-visible:ring-2','focus-visible:ring-roksal-navy/40','focus-visible:ring-offset-2','rounded'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length
})" 2>&1 | tail -1
agent-browser eval "(()=>{const k='roksal_stair_templates'; if(window.__origStair===null){localStorage.removeItem(k); return 'original-null-obnovljen';} localStorage.setItem(k, window.__origStair); return 'original-obnovljen';})()" 2>&1 | tail -1

echo "--- D: photos — N4 'Uredi mero' iskren poskus (vrata: odprta slika z merjenjem — DB) ---"
eb_dispatch '{"tab":"photos","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
agent-browser eval "JSON.stringify({
  urediMeroGumbi: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Uredi mero').length,
  val60ParUredi: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Uredi mero'&&['rounded','p-1','transition-colors','focus-visible:ring-2','focus-visible:ring-roksal-navy/40','focus-visible:ring-offset-2'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length
})" 2>&1 | tail -1

echo "--- E: sonde (navy + red stetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- F: kolektor ---"
eb_preberi_kolektor r383err

agent-browser close --all >/dev/null 2>&1
echo "=== R383 spot KONEC ==="
