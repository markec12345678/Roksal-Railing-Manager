#!/usr/bin/env bash
# r385-qa-spot.sh — R385 produkcija QA spot seja (spot-r167/25; ZERO-MUTACIJA
# — SAMO sonde + navigacijski dispatch + Radix meni/dialog odpiranje [kanon
# r186 pointerdown+click]; NIČ klikov na odjavo/preklic/brisanje/umik —
# dialog zaprem s Escape, NE z gumbom).
# Fokus: val 62 POST-deploy verifikacija — 4 needleji r384.tsv (era preverba
# OSEMINTRIDESIJNA R385 dokazuje 155/155 ŽIVO; ta sonda dokumentira
# MONTIRANO DOM resnico z mounted + className LOČENO, LEKCIJA R365 (4)):
#   A 'dashboard' tab → N1 dashboard-tab L1914 (bajtni dvojček L2059)
#      Button outline 'Poskusi znova' (zaloga/naročila napakni baner) —
#      val 62 vzorec: O2 + FB red + dark FB red. NARAVNA VRATA: invError /
#      narocilaError ≠ null = padel fetch na produ. ZERO-MUTACIJA: napak
#      NI mogoče iskreno sprožiti brez posredovanja v omrežje → sonda
#      POROČA mounted resnico in RAZLOG (iskreno 0 = kanon r277/R384 A,
#      programatsko dokumentirano V ZAMRZNJENI skripti; needle ŽIVO v
#      buildu = era need_static dokaz).
#   B top-bar user meni (kanon r186) → 'Aktivne seje' → N2 sessions-dialog
#      L316 Button outline 'Prekliči sejo na napravi: …' (per-naprava
#      revoke) — val 62 vzorec z /30 barvnim overrideom. MONTIRAN: QA seja
#      sama sebe vidi v seznamu naprav. NIČ klika na Prekliči (revoke =
#      MUTACIJA) — samo className branje; Escape → dialogi 0.
#   C 'measurements' tab → N3 measurements-tab L5679 nativni gumb
#      'Odstrani osnutek' — val 62 vzorec (eksplicitni border + active:scale
#      rep). NARAVNA VRATA: osnutki so per-projekt localStorage
#      (roksal_measurement_drafts_<projectId>); spot račun ima 0 projektov
#      (kanon r277) → brez selectedProject ni niti ključa niti sekcije →
#      iskreno 0 s programatskim razlogom (dodatno: semena brez projectId
#      NE možna — draftsKey fail-closed vrže 'projectId je obvezen').
#   D 'more' → 'vodja' → N4 vodja-dashboard L2122 kartica 'Zamujena
#      dobava (N)' — val 62 vzorec (eksplicitni border kartice). NARAVNA
#      VRATA: DB-gnana resnica stats.zamujeneDobave > 0; OBE veji iskreno
#      poročani (kanon r277 — disk resnica, ne pričakovanje).
# Sonde: eb_sonda_navy_stetje + eb_sonda_red_stetje + kolektor ŠELE PO
# prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R385 QA spot seja (spot-r167/25 — val 62 POST-deploy) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r385err

echo "--- A: 'dashboard' tab → N1 'Poskusi znova' napakni banerji (L1914/L2059) — iskrena mounted resnica ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return document.querySelectorAll('main button').length > 0;})()" 30
agent-browser eval "JSON.stringify({
  zalogaBaner: (document.querySelector('main')?.textContent||'').includes('Zaloga ni na voljo'),
  narocilaBaner: (document.querySelector('main')?.textContent||'').includes('Naročila niso na voljo'),
  poskusiZnova: [...document.querySelectorAll('main button')].filter(b=>(b.textContent||'').trim()==='Poskusi znova').length,
  razlog: 'invError/narocilaError ≠ null zahteva padel fetch na produ — ZERO-MUTACIJA: napak ni iskreno sprožiti; needle ŽIVO v buildu (era need_static)'
})" 2>&1 | tail -1

echo "--- B: top-bar user meni → 'Aktivne seje' → N2 'Prekliči sejo' (L316) — tokeni LOČENO, NIČ klika ---"
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Odjava'); if(!g) return 'trigger-ni-najden'; g.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); g.click(); return 'meni-odprt';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"menuitem\"]')].some(x=>x.textContent.includes('Aktivne seje'));})()" 30
agent-browser eval "(()=>{const m=[...document.querySelectorAll('[role=\"menuitem\"]')].find(x=>x.textContent.includes('Aktivne seje')); if(!m) return 'menuitem-ni-najden'; m.click(); return 'dialog-odprt';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('[role=\"dialog\"] button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Prekliči sejo na napravi:'));})()" 30
agent-browser eval "JSON.stringify({
  dialogi: document.querySelectorAll('[role=\"dialog\"]').length,
  prekliciGumbi: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Prekliči sejo na napravi:')).length,
  val62Par: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Prekliči sejo na napravi:')&&['h-7','shrink-0','gap-1','border-roksal-red/30','px-2','text-2xs','text-roksal-red','hover:bg-roksal-red/10','press-scale','focus-visible:ring-2','focus-visible:ring-roksal-red/40','focus-visible:ring-offset-2','focus-visible:border-roksal-red/40','dark:focus-visible:border-roksal-red/50'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length,
  val62FB: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Prekliči sejo na napravi:')&&(b.className||'').split(/\\s+/).includes('focus-visible:border-roksal-red/40')).length,
  val62Dark: [...document.querySelectorAll('[role=\"dialog\"] button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Prekliči sejo na napravi:')&&(b.className||'').split(/\\s+/).includes('dark:focus-visible:border-roksal-red/50')).length
})" 2>&1 | tail -1
agent-browser eval "(()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'escape-poslan';})()" 2>&1 | tail -1
sleep 1
agent-browser eval "JSON.stringify({ dialogiPoEscape: document.querySelectorAll('[role=\"dialog\"]').length })" 2>&1 | tail -1

echo "--- C: 'measurements' tab → N3 'Odstrani osnutek' (L5679) — prazno stanje iskreno ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
agent-browser eval "JSON.stringify({
  praznoStanjeIzberiProjekt: (document.querySelector('main')?.textContent||'').includes('Izberi projekt'),
  odstraniOsnutek: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Odstrani osnutek ')).length,
  razlog: 'osnutki = per-projekt localStorage (roksal_measurement_drafts_<projectId>); spot račun 0 projektov (kanon r277) → brez ključa ni sekcije; semena brez projectId NE možna (draftsKey fail-closed)'
})" 2>&1 | tail -1

echo "--- D: 'more' → 'vodja' → N4 'Zamujena dobava' kartica (L2122) — DB resnica OBE veji ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
sleep 4
agent-browser eval "JSON.stringify({
  vodjaPanel: document.querySelectorAll('main').length,
  zamujenaKartica: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')).length,
  val62Par: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Zamujena dobava (')&&['flex','w-full','cursor-pointer','items-center','gap-2','rounded-xl','border','border-roksal-red/20','bg-roksal-red/5','p-3','text-left','shadow-sm','animate-fade-in-up','transition-colors','hover:bg-roksal-red/10','focus-visible:outline-none','focus-visible:ring-2','focus-visible:ring-roksal-red/40','focus-visible:ring-offset-2','focus-visible:border-roksal-red/40','dark:focus-visible:border-roksal-red/50'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length,
  razlog: 'DB-gnana resnica stats.zamujeneDobave > 0 — 0 projektov na spot računu pričakovano 0; OBE veji iskreno (kanon r277)'
})" 2>&1 | tail -1

echo "--- E: sonde (navy + red stetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- F: kolektor ---"
eb_preberi_kolektor r385err

agent-browser close --all >/dev/null 2>&1
echo "=== R385 spot KONEC ==="
