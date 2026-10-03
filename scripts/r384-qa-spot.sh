#!/usr/bin/env bash
# r384-qa-spot.sh — R384 produkcija QA spot seja (spot-r167/24; ZERO-MUTACIJA
# — SAMO sonde + navigacijski dispatch + Radix meni/dialog odpiranje [kanon
# r186 pointerdown+click] + ENA net-zero localStorage semena [calc zgodovina
# = client-scoped localStorage, BREZ DB klica — original vrednost shranjena
# in obnovljena, dokumentirano]) NIČ klikov na odjavo/preklic/brisanje
# (dialog zaprem s Escape, NE z 'Zapri' gumbom).
# Fokus: val 61 POST-deploy verifikacija — 4 needleji r383.tsv (era preverba
# SEDEMINTRIDESIJNA R384 dokazuje 151/151 ŽIVO; ta sonda dokumentira
# MONTIRANO DOM resnico z mounted + className LOČENO, LEKCIJA R365 (4)):
#   A 'ekipa' tab → team-tab L497 Button outline 'Izvozi pregled stanja
#      ekipe kot PDF' — val 61 STEP 2 vzorec: O2 + FB navy + dark FB ink.
#   B 'calculator' tab → calculator-tab L4396 Button ghost 'Izvozi
#      zgodovino izračunov kot CSV datoteka' — val 61 STEP 1+2 vzorec
#      (vrata: history.length > 0 — localStorage 'roksal_calc_history'
#      NET-ZERO semena: original → seed → verify → obnovitev originala;
#      nič na strežniku).
#   C top-bar user meni (kanon r186) → 'Aktivne seje' → sessions-dialog
#      L363 Button outline 'Zapri' — val 61 STEP 2 vzorec; Escape →
#      od-montiran (NIČ klika na Zapri — ZERO-MUTACIJA).
#   D 'material' tab → material-intelligence-tab L456 chipCls status
#      filtri (aria-pressed piluli) — val 61 STEP 2 vzorec (template
#      literal); dinamična disk resnica (odvisna od št. naročil na
#      izbranem projektu — obe veji iskreno poročani, kanon r277).
# Sonde: eb_sonda_navy_stetje + eb_sonda_red_stetje + kolektor ŠELE PO
# prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R384 QA spot seja (spot-r167/24 — val 61 POST-deploy) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r384err

echo "--- A: 'ekipa' tab → N2 team PDF izvoz gumb (L497) — tokeni LOČENO ---"
eb_dispatch '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled stanja ekipe kot PDF');})()" 30
agent-browser eval "JSON.stringify({
  pdfGumbi: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled stanja ekipe kot PDF').length,
  val61Par: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled stanja ekipe kot PDF'&&['h-8','px-2.5','press-scale','focus-visible:ring-2','focus-visible:ring-roksal-navy/40','focus-visible:ring-offset-2','focus-visible:border-roksal-navy/40','dark:focus-visible:border-roksal-ink/40'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length
})" 2>&1 | tail -1
agent-browser eval "fetch('/api/users').then(r=>'users.read vrata: HTTP '+r.status+' (0 montiranih = canRead gate, kanon r277)').catch(e=>'users-probe ERR')" 2>&1 | tail -1

echo "--- B: 'calculator' tab → N1 izvoz zgodovine gumb (L4396) — net-zero semena ---"
agent-browser eval "(()=>{const k='roksal_calc_history'; window.__origCalcHist=localStorage.getItem(k); localStorage.setItem(k, JSON.stringify([{id:'qa_sonda_r384',timestamp:'2026-10-03T00:00:00.000Z',mode:'railing',modeLabel:'Razmiki letev',keyResult:'QA sonda R384 (net-zero semena)',inputs:{}}])); return window.__origCalcHist===null?'original-null-shranjen':'original-obstojec-shranjen';})()" 2>&1 | tail -1
agent-browser eval "location.reload(); 'reload'" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 45
eb_dispatch '{"tab":"calculator","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button')].some(b=>(b.getAttribute('aria-label')||'')==='Izvozi zgodovino izračunov kot CSV datoteka');})()" 30
agent-browser eval "JSON.stringify({
  izvozZgodovineGumbi: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi zgodovino izračunov kot CSV datoteka').length,
  val61Par: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi zgodovino izračunov kot CSV datoteka'&&['h-7','px-2','text-2xs','text-roksal-ink','hover:text-roksal-ink','hover:bg-roksal-navy/5','focus-visible:ring-2','focus-visible:ring-roksal-navy/40','focus-visible:ring-offset-2','focus-visible:border-roksal-navy/40','dark:focus-visible:border-roksal-ink/40'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length
})" 2>&1 | tail -1
agent-browser eval "(()=>{const k='roksal_calc_history'; if(window.__origCalcHist===null){localStorage.removeItem(k); return 'original-null-obnovljen';} localStorage.setItem(k, window.__origCalcHist); return 'original-obnovljen';})()" 2>&1 | tail -1

echo "--- C: top-bar user meni → 'Aktivne seje' → N3 Zapri gumb (L363) — tokeni LOČENO ---"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!g) return 'trigger-ni-najden'; g.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); g.click(); return 'meni-odprt';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Aktivne seje'));})()" 30
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Aktivne seje')); if(!m) return 'menuitem-ni-najden'; m.click(); return 'dialog-odprt';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"dialog\"] button')].some(b=>(b.textContent||'').trim()==='Zapri');})()" 30
agent-browser eval "JSON.stringify({
  dialogi: document.querySelectorAll('[role=\"dialog\"]').length,
  zapriGumbi: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>(b.textContent||'').trim()==='Zapri').length,
  val61Par: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>(b.textContent||'').trim()==='Zapri'&&['press-scale','focus-visible:ring-2','focus-visible:ring-roksal-navy/40','focus-visible:ring-offset-2','focus-visible:border-roksal-navy/40','dark:focus-visible:border-roksal-ink/40'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length
})" 2>&1 | tail -1
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'escape-poslan';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "JSON.stringify({ dialogiPoEscape: document.querySelectorAll('[role=\"dialog\"]').length })" 2>&1 | tail -1

echo "--- D: 'material' tab → N4 chipCls status pilule (L456) — tokeni LOČENO ---"
eb_dispatch '{"tab":"more","more":"material","subTab":null,"osnutek":null,"filter":null}'
sleep 3
agent-browser eval "JSON.stringify({
  skupine: [...document.querySelectorAll('[role=\"group\"]')].filter(g=>(g.getAttribute('aria-label')||'')==='Filter naročil po statusu').length,
  pilule: [...document.querySelectorAll('[role=\"group\"]')].filter(g=>(g.getAttribute('aria-label')||'')==='Filter naročil po statusu').flatMap(g=>[...g.querySelectorAll('button[aria-pressed]')]).length,
  val61Par: [...document.querySelectorAll('[role=\"group\"]')].filter(g=>(g.getAttribute('aria-label')||'')==='Filter naročil po statusu').flatMap(g=>[...g.querySelectorAll('button[aria-pressed]')]).filter(b=>['h-7','rounded-full','border','px-3','text-[11px]','font-medium','tabular-nums','transition-colors','focus-visible:outline-none','focus-visible:ring-2','focus-visible:ring-roksal-navy/40','focus-visible:ring-offset-2','focus-visible:border-roksal-navy/40','dark:focus-visible:border-roksal-ink/40'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length,
  praznoStanjeIzberiProjekt: (document.querySelector('main')?.textContent||'').includes('Izberi projekt')
})" 2>&1 | tail -1

echo "--- E: sonde (navy + red stetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- F: kolektor ---"
eb_preberi_kolektor r384err

agent-browser close --all >/dev/null 2>&1
echo "=== R384 spot KONEC ==="
