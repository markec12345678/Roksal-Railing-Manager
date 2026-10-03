#!/usr/bin/env bash
# r386-qa-spot.sh — R386 produkcija QA spot seja (spot-r167/26; ZERO-MUTACIJA
# — SAMO sonde + navigacijski dispatch + Radix meni/dialog odpiranje [kanon
# r186 pointerdown+click]; NIČ klikov na odjavo/preklic/revoke/izvoz —
# dialog zaprem s Escape, NE z gumbom).
# Fokus: val 63 POST-deploy verifikacija — 4 needleji r385.tsv (era preverba
# DEVETINTRIDESIJNA R386 dokazuje 159/159 ŽIVO; ta sonda dokumentira
# MONTIRANO DOM resnico z mounted + className LOČENO, LEKCIJA R365 (4)):
#   A 'more' → 'vodja' → N1 vodja-dashboard L1213 Button outline 'Izvozi
#      dnevni pregled vodje kot CSV' (×4 dvojčki) — val 63 vzorec: O2 +
#      FB amber/50 + dark FB amber/30 na border-roksal-navy/25 gumbu.
#   B ISTA seja → N2 vodja-dashboard L1475 CSV pilule (×9 h-6 izvozi
#      vrstica; vzorec 'Izvozi pregled AI rabe kot CSV' data-testid
#      ai-raba-csv-pill) — val 63 vzorec + dark:border-roksal-ink/25 rep.
#   C 'photos' tab → N3 photo-tab L740 kategorija filtri (aria-pressed ×3,
#      template literal) — val 63 vzorec z FB+dark MED O2 in outline-none.
#   D 'inclinometer' tab → N4 'Poskusi znova naložiti zgodovino nagibov'
#      (L539, Button outline) — NARAVNA VRATA: historyError ≠ null =
#      padel fetch zgodovine nagibov; ZERO-MUTACIJA: napak NI iskreno
#      sprožiti → iskreno 0 s programatskim razlogom (needle ŽIVO v
#      buildu = era need_static dokaz).
# Sonde: eb_sonda_navy_stetje + eb_sonda_red_stetje + kolektor ŠELE PO
# prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R386 QA spot seja (spot-r167/26 — val 63 POST-deploy) ==="
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r386err

echo "--- A: 'more' → 'vodja' → N1 'Izvozi dnevni pregled' (L1213) — tokeni LOČENO, NIČ klika ---"
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
sleep 4
agent-browser eval "JSON.stringify({
  dnevniCsv: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi dnevni pregled vodje kot CSV').length,
  val63Par: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Izvozi dnevni pregled vodje kot CSV'&&['h-8','gap-1.5','border-roksal-navy/25','dark:border-roksal-ink/25','text-xs','text-roksal-ink','press-scale','transition-all','hover:border-roksal-amber','hover:bg-roksal-amber/10','hover:text-roksal-ink','focus-visible:ring-2','focus-visible:ring-roksal-amber/50','focus-visible:ring-offset-2','focus-visible:border-roksal-amber/50','dark:focus-visible:border-roksal-amber/30'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length
})" 2>&1 | tail -1

echo "--- B: ISTA seja → N2 'Izvozi pregled AI rabe' (L1475) — tokeni LOČENO ---"
agent-browser eval "JSON.stringify({
  aiRabaPill: [...document.querySelectorAll('main button')].filter(b=>b.getAttribute('data-testid')==='ai-raba-csv-pill').length,
  val63Par: [...document.querySelectorAll('main button')].filter(b=>b.getAttribute('data-testid')==='ai-raba-csv-pill'&&['h-6','gap-1','border-roksal-navy/25','px-2','text-2xs','text-roksal-ink','press-scale','transition-all','hover:border-roksal-amber','hover:bg-roksal-amber/10','hover:text-roksal-ink','focus-visible:ring-2','focus-visible:ring-roksal-amber/50','focus-visible:ring-offset-2','focus-visible:border-roksal-amber/50','dark:focus-visible:border-roksal-amber/30','dark:border-roksal-ink/25'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length
})" 2>&1 | tail -1

echo "--- C: 'photos' tab → N3 kategorija filtri (L740) — tokeni LOČENO ---"
eb_dispatch '{"tab":"photos","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_pocakaj_na "(()=>{return [...document.querySelectorAll('main button[aria-pressed]')].length > 0;})()" 30
agent-browser eval "JSON.stringify({
  kategorijaGumbi: [...document.querySelectorAll('main button[aria-pressed]')].length,
  val63Par: [...document.querySelectorAll('main button[aria-pressed]')].filter(b=>['rounded-md','border','px-2','py-2','text-[11px]','font-medium','transition-colors','focus-visible:ring-2','focus-visible:ring-roksal-amber/50','focus-visible:ring-offset-2','focus-visible:border-roksal-amber/50','dark:focus-visible:border-roksal-amber/30','focus-visible:outline-none'].every(t=>(b.className||'').split(/\\s+/).includes(t))).length
})" 2>&1 | tail -1

echo "--- D: 'inclinometer' tab → N4 'Poskusi znova nagibe' (L539) — iskrena mounted resnica ---"
eb_dispatch '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 3
agent-browser eval "JSON.stringify({
  poskusiZnovaNagibi: [...document.querySelectorAll('main button')].filter(b=>(b.getAttribute('aria-label')||'')==='Poskusi znova naložiti zgodovino nagibov').length,
  razlog: 'historyError ≠ null zahteva padel fetch zgodovine nagibov na produ — ZERO-MUTACIJA: napak ni iskreno sprožiti; needle ŽIVO v buildu (era need_static)'
})" 2>&1 | tail -1

echo "--- E: sonde (navy + red stetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- F: kolektor ---"
eb_preberi_kolektor r386err

agent-browser close --all >/dev/null 2>&1
echo "=== R386 spot KONEC ==="
