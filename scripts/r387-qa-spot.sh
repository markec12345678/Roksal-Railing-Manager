#!/usr/bin/env bash
# r387-qa-spot.sh — R387 produkcija QA spot seja (spot-r167/27; ZERO-MUTACIJA
# — SAMO sonde + navigacijski dispatch + Radix meni/dialog odpiranje [kanon
# r186 pointerdown+click]; NIČ klikov na odjavo/preklic/revoke/izvoz/filter
# navigacija — kartice/filtri se samo MERIJO, ne klikne).
# Fokus: val 64 POST-deploy verifikacija — 4 needleji r386.tsv (era preverba
# ŠTIRIDESIJNA R387 dokazuje 163/163 ŽIVO; ta sonda dokumentira MONTIRANO DOM
# resnico z mounted + className LOČENO, LEKCIJA R365 (4)):
#   A 'dashboard' tab → N1 dashboard-tab L1946 'Brez dobavitelja' kartica
#      (aria-label prefix 'Brez dobavitelja (') — val 64 vzorec: O2 +
#      FB amber/40 + dark FB amber/40 na border-roksal-amber/40 kartici.
#      POGOJNA resnica: vidna SAMO če brezDobaviteljaCount > 0 (DB-gnana);
#      iskreno 0 z razlogom, NI fabriciranja.
#   B 'measurements' tab → N2 measurements-tab L3478 'Poglej pripadajočo
#      foto mero' gumb (aria-label prefix 'Poglej pripadajočo foto mero za')
#      — val 64 vzorec + active:scale-[0.96] rep. POGOJNA: isPhoto &&
#      m.photoId; iskreno 0, NI fabriciranja.
#   C 'more' → 'vodja' → N3 vodja-dashboard L2093 'Brez dobavitelja' kartica
#      (rdeči dvojček L2122 FB od val 62) — val 64 vzorec. POGOJNA:
#      stats.brezDobavitelja > 0; iskreno 0, NI fabriciranja.
#   D GLOBALNO: družinski PAR žeton 'focus-visible:border-roksal-amber/40
#      dark:focus-visible:border-roksal-amber/40' — števec prek celotnega DOM
#      (pričakuj N1+N3 vsota na montiranih površinah; needle need_static ×3
#      je era-dokazan).
# Sonde: eb_sonda_navy_stetje + eb_sonda_red_stetje + kolektor ŠELE PO
# prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R387 QA spot seja (spot-r167/27 — val 64 POST-deploy) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r387err

echo "--- A: 'dashboard' tab → N1 'Brez dobavitelja' kartica (L1946) — tokeni LOČENO, NIČ klika ---"
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 4
agent-browser eval "JSON.stringify({
  brezDobaviteljaKartice: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja (')).length,
  val64Par: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja (')&&['flex','w-full','items-center','gap-3','rounded-xl','border','border-roksal-amber/40','bg-roksal-amber/5','p-3','text-left','animate-fade-in-up','cursor-pointer','transition-colors','hover:bg-roksal-amber/10','focus-visible:outline-none','focus-visible:ring-2','focus-visible:ring-roksal-amber/40','focus-visible:ring-offset-2','focus-visible:border-roksal-amber/40','dark:focus-visible:border-roksal-amber/40'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length,
  razlog: 'POGOJNA resnica: kartica vidna SAMO ce brezDobaviteljaCount > 0 (DB-gnana); iskreno 0 = ni artiklov brez dobavitelja — needle ZIVO v buildu (era need_static)'
})" 2>&1 | tail -1

echo "--- B: 'measurements' tab → N2 'Poglej foto mero' (L3478) — tokeni LOČENO ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 4
agent-browser eval "JSON.stringify({
  poglejFotoGumbi: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Poglej pripadajočo foto mero za')).length,
  val64Par: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Poglej pripadajočo foto mero za')&&['flex','items-center','gap-1','rounded-lg','border','border-roksal-amber/30','bg-roksal-amber/5','px-2','py-1','text-[11px]','font-medium','text-roksal-amber','hover:bg-roksal-amber/10','active:scale-[0.96]','focus-visible:ring-2','focus-visible:ring-roksal-amber/40','focus-visible:ring-offset-2','focus-visible:border-roksal-amber/40','dark:focus-visible:border-roksal-amber/40','focus-visible:outline-none'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length,
  razlog: 'POGOJNA resnica: gumb viden SAMO za meritve z isPhoto && photoId — iskreno 0 = ni foto mer v trenutnem seznamu — needle ZIVO v buildu (era need_static)'
})" 2>&1 | tail -1

echo "--- C: 'more' → 'vodja' → N3 'Brez dobavitelja' kartica (L2093) — tokeni LOČENO ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
sleep 4
agent-browser eval "JSON.stringify({
  brezDobaviteljaKartice: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja (')).length,
  val64Par: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Brez dobavitelja (')&&['flex','w-full','cursor-pointer','items-center','gap-2','rounded-xl','border','border-roksal-amber/40','bg-roksal-amber/5','p-3','text-left','shadow-sm','animate-fade-in-up','transition-colors','hover:bg-roksal-amber/10','focus-visible:outline-none','focus-visible:ring-2','focus-visible:ring-roksal-amber/40','focus-visible:ring-offset-2','focus-visible:border-roksal-amber/40','dark:focus-visible:border-roksal-amber/40'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length,
  razlog: 'POGOJNA resnica: kartica vidna SAMO ce stats.brezDobavitelja > 0 (DB-gnana) — iskreno 0 = ni artiklov brez dobavitelja — needle ZIVO v buildu (era need_static)'
})" 2>&1 | tail -1

echo "--- D: GLOBALNO — družinski PAR žeton števec (celoten DOM) ---"
agent-browser eval "JSON.stringify({
  parZeton: document.body.innerHTML.split('focus-visible:border-roksal-amber/40 dark:focus-visible:border-roksal-amber/40').length - 1,
  razlog: 'need_static x3 (era-dokazan); montirane povrsine nosijo zeton po className splitu (A/B/C)'
})" 2>&1 | tail -1

echo "--- E: sonde (navy + red stetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- F: kolektor ---"
eb_preberi_kolektor r387err

agent-browser close --all >/dev/null 2>&1
echo "=== R387 spot KONEC ==="
