#!/usr/bin/env bash
# r388-qa-spot.sh — R388 produkcija QA spot seja (spot-r167/28; ZERO-MUTACIJA
# — SAMO sonde + navigacijski dispatch + Radix sheet odpiranje [kanon r186];
# NIČ klikov na odjavo/preklic/revoke/izvoz/filter/obvestilne vrstice —
# vrstice se samo MERIJO, ne kliknejo; označevanje prebrano = MUTACIJA — NI).
# Fokus: val 65 POST-deploy verifikacija — 4 needleji r387.tsv (era preverba
# ENAINŠTIRIDESIJNA R388 dokazuje 167/167 ŽIVO; ta sonda dokumentira MONTIRANO
# DOM resnico z mounted + className LOČENO, LEKCIJA R365 (4)):
#   A top-bar → 'Obvestila' sheet (kanon odpiranje) → N1 notification-center
#      L748 vrstica (border-border/60 kartica) — val 65 vzorec: O2 + FB
#      amber/60 + dark FB amber/40 + dark ring /40 + seam MED offset-2 in
#      dark ringom. POGOJNA resnica: vrstice vidne SAMO če obvestila obstajajo
#      (DB-gnana); iskreno 0 z razlogom, NI fabriciranja.
#   B 'measurements' tab → N2 photo L2113 STROKES 'Debelina črte' gumbi
#      (trajno temna površina bg-roksal-navy, brez dark: ring variant) —
#      val 65 vzorec. POGOJNA: uredjevalnik zahteva odprto fotografijo
#      (isPhoto && photoId veriga); iskreno 0, NI fabriciranja.
#   C SEAM adjacency žeton 'dark:focus-visible:border-roksal-amber/40
#      dark:focus-visible:ring-roksal-amber/40' — dokaz vstavitve MED
#      offset-2 in dark ringom (montirana površina A).
#   D GLOBALNO: družinski PAR žeton 'focus-visible:border-roksal-amber/60
#      dark:focus-visible:border-roksal-amber/40' — števec prek celotnega DOM
#      (need_static ×2 je era-dokazan).
# Sonde: eb_sonda_navy_stetje + eb_sonda_red_stetje + kolektor ŠELE PO
# prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R388 QA spot seja (spot-r167/28 — val 65 POST-deploy) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r388err

echo "--- A: top-bar 'Obvestila' sheet → N1 vrstica (L748) — tokeni LOČENO ---"
agent-browser eval "(()=>{const zvon=document.querySelector('button[aria-label^=\"Obvestila\"]'); if(!zvon) return 'zvon ni montiran'; zvon.click(); return 'sheet odprt (kanon odpiranje)';})()" 2>&1 | tail -1
sleep 4
agent-browser eval "JSON.stringify({
  vrstice: [...document.querySelectorAll('main button, [role=dialog] button, [data-radix-sheet] button, body button')].filter(b=>((b.className||'').split(/\\s+/).includes('hover:-translate-y-0.5'))).length,
  val65Par: [...document.querySelectorAll('body button')].filter(b=>((b.className||'').split(/\\s+/).includes('hover:-translate-y-0.5'))&&['group','flex','w-full','items-center','gap-3','rounded-xl','border','border-border/60','bg-card','p-3','text-left','transition-all','hover:border-roksal-amber/40','hover:shadow-sm','focus-visible:outline-none','focus-visible:ring-2','focus-visible:ring-roksal-amber/60','focus-visible:ring-offset-2','focus-visible:border-roksal-amber/60','dark:focus-visible:border-roksal-amber/40','dark:focus-visible:ring-roksal-amber/40','active:scale-[0.98]'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length,
  razlog: 'POGOJNA resnica: L748 vrstice vidne SAMO ce obvestila obstajajo (DB-gnana); iskreno 0 = prazna kopija — needle ZIVO v buildu (era need_static); NI klikov na vrstice (ZERO-MUTACIJA)'
})" 2>&1 | tail -1

echo "--- C: SEAM adjacency žeton (montirana površina A) ---"
agent-browser eval "JSON.stringify({
  seam: document.body.innerHTML.split('dark:focus-visible:border-roksal-amber/40 dark:focus-visible:ring-roksal-amber/40').length - 1,
  razlog: 'seam = dokaz vstavitve FB MED offset-2 in dark ringom (need_static ×1 r387.tsv)'
})" 2>&1 | tail -1

agent-browser eval "(()=>{const x=document.querySelector('[data-radix-sheet-close], [aria-label=\"Zapri\"]'); if(x){x.click(); return 'sheet zaprt';} return 'brez eksplicitnega zapiranja (Escape kanon)';})()" 2>&1 | tail -1

echo "--- B: 'measurements' tab → N2 STROKES 'Debelina črte' (L2113) — tokeni LOČENO ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 4
agent-browser eval "JSON.stringify({
  strokesGumbi: [...document.querySelectorAll('body button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Debelina črte:')).length,
  val65Par: [...document.querySelectorAll('body button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Debelina črte:')&&['flex','h-6','w-9','items-center','justify-center','rounded-md','border','text-2xs','focus-visible:ring-2','focus-visible:ring-roksal-amber/60','focus-visible:ring-offset-2','focus-visible:border-roksal-amber/60','dark:focus-visible:border-roksal-amber/40'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length,
  razlog: 'POGOJNA resnica: STROKES vidni SAMO v odprtem foto uredjevalniku (isPhoto && photoId veriga) — iskreno 0 = ni odprte fotografije — needle ZIVO v buildu (era need_static); NI fabriciranja'
})" 2>&1 | tail -1

echo "--- D: GLOBALNO — družinski PAR žeton števec (celoten DOM) ---"
agent-browser eval "JSON.stringify({
  parZeton: document.body.innerHTML.split('focus-visible:border-roksal-amber/60 dark:focus-visible:border-roksal-amber/40').length - 1,
  razlog: 'need_static x2 (era-dokazan); montirana površina A nosi zeton po className splitu'
})" 2>&1 | tail -1

echo "--- E: sonde (navy + red stetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- F: kolektor ---"
eb_preberi_kolektor r388err

agent-browser close --all >/dev/null 2>&1
echo "=== R388 spot KONEC ==="
