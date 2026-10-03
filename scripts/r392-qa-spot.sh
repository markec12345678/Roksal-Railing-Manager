#!/usr/bin/env bash
# r392-qa-spot.sh — R392 produkcija QA spot seja (spot-r182/31; ZERO-MUTACIJA
# — SAMO sonde + navigacijski dispatch; NIČ klikov na odjavo/preklic/revoke/
# izvoz/obvestilne vrstice/označi prebrano/katalog pisanja; setup bootstrapa
# NIKOLI ne sprožimo).
# Fokus: val 68 POST-deploy verifikacija — 2 ŠIVNA needleja r391.tsv (44. era
# preverba ŠTIRIDESIJNA dokazuje 182/182 ŽIVO; ta sonda dokumentira MONTIRANO
# DOM resnico z mounted + className LOČENO, LEKCIJA R365 (4)):
#   A prijava → calculator tab → N1 'Nazaj na meritve' (calculator L820) —
#     šiv duration-150→shrink-0 (press-scale odstranjen; active:scale-[0.96]
#     edini mehanizem — dvojni skrček 0.9312 ne obstaja več); SAMO meritev.
#   B inventory tab → N2 'Izvozi inventurni pregled premoženja kot CSV'
#     (inventory L1562) — šiv tabular-nums→focus-visible; SAMO className
#     split MERITEV BREZ klika (klik = CSV izvoz mutacija).
#   C sonde (navy + red štetje) + kolektor ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R392 QA spot seja (spot-r182/31 — val 68 POST-deploy) ==="

echo "--- A: prijava → calculator → N1 calculator L820 šiv (className LOČENO) ---"
agent-browser close --all >/dev/null 2>&1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r392err
eb_dispatch '{"tab":"calculator","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 5
agent-browser eval "JSON.stringify({
  n1Seam: [...document.querySelectorAll('button')].filter(b=>{const c=b.className&&typeof b.className==='string'?b.className:'';const t=c.split(/\\s+/);return ['flex','items-center','gap-1.5','rounded-lg','border','border-roksal-amber/30','bg-roksal-amber/10','px-2.5','py-1.5','text-[11px]','font-medium','text-roksal-ink','hover:bg-roksal-amber/20','active:scale-[0.96]','transition-all','duration-150','shrink-0'].every(x=>t.includes(x))}).length,
  n1PressScale: [...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('hover:bg-roksal-amber/20')&&(b.className||'').includes('press-scale')).length,
  razlog: 'POGOJNA resnica: L820 'Nazaj na meritve' renderan SAMO z importedFromMeasurement (navigacija iz meritev) — ZERO-MUTACIJA ne fabricira uvoza; iskreno 0; press-scale = 0 na celotnem tabu (dvojni mehanizem odstranjen — val 68 živ na produ); needle ŽIVO v buildu (era need_static ŠTIRIDESIJNA 182/182)'
})" 2>&1 | tail -1

echo "--- B: inventory tab → N2 inventory L1562 šiv (className split, BREZ klika — CSV mutacija) ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 5
agent-browser eval "JSON.stringify({
  n2Seam: [...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi inventurni pregled premoženja kot CSV'&&(b.className||'').includes('tabular-nums')&&!(b.className||'').includes('press-scale')&&(b.className||'').includes('active:scale-[0.96]')).length,
  n2Tokeni: (function(){const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Izvozi inventurni pregled premoženja kot CSV'); if(!b) return null; const c=(b.className||'').split(/\\s+/); return ['h-8','shrink-0','gap-1.5','text-[11px]','font-medium','tabular-nums','focus-visible:outline-none','focus-visible:ring-2','focus-visible:ring-roksal-navy/40','focus-visible:ring-offset-2','focus-visible:border-roksal-navy/40','dark:focus-visible:border-roksal-ink/40','active:scale-[0.96]'].map(x=>c.includes(x));})(),
  n2PressScale: (function(){const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')||'')==='Izvozi inventurni pregled premoženja kot CSV'); return b?(b.className||'').includes('press-scale'):null;})(),
  razlog: 'ŠIVNA resnica: 13/13 tokenov LOČENO (tabular-nums focus-visible:... BREZ press-scale + active:scale-[0.96]); NI klika — klik bi izvozil CSV (mutacija); needle ŽIVO v buildu (era need_static)'
})" 2>&1 | tail -1

echo "--- C: sonde (navy + red štetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- D: kolektor ---"
eb_preberi_kolektor r392err

agent-browser close --all >/dev/null 2>&1
echo "=== R392 spot KONEC ==="
