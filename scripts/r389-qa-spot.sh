#!/usr/bin/env bash
# r389-qa-spot.sh — R389 produkcija QA spot seja (spot-r171/29; ZERO-MUTACIJA
# — SAMO sonde + navigacijski dispatch; NIČ klikov na odjavo/preklic/revoke/
# izvoz/obvestilne vrstice/označi prebrano; setup bootstrapa NIKOLAR ne
# sprožimo — done stanje je mutacija lastniškega računa).
# Fokus: val 66 POST-deploy verifikacija — 4 needleji r388.tsv (era preverba
# DVAINŠTIRIDESIJNA R389 dokazuje 171/171 ŽIVO; ta sonda dokumentira MONTIRANO
# DOM resnico z mounted + className LOČENO, LEKCIJA R365 (4)):
#   A (PRED prijavo) /setup javna stran → N1 <Link> CTA (L100) — CTA je
#      renderan SAMO v 'done' stanju (uspešen bootstrap/obnova); ZERO-MUTACIJA
#      ne sproži bootstrapa → iskreno 0 z razlogom; needle ŽIVO v buildu
#      (era need_static ×4).
#   B prijava → dashboard → N2 Badge navy/15 (L1223+L1319, ×2) + N4 red/20
#      (L1238 ternary + L2459 + L2602 + L2936, ×4) — POGOJNE resnice (vrstice
#      DB-gnane / error badge-i); className split celoten span, mounted +
#      className LOČENO.
#   C 'measurements' tab → N3 PO anchor photo L2081 — POGOJNA (odprta
#      fotografija, isPhoto && photoId veriga); iskreno 0 z razlogom.
#   D sonde (navy + red stetje) + kolektor ŠELE PO prijavi (LEKCIJA R358).
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R389 QA spot seja (spot-r171/29 — val 66 POST-deploy) ==="

echo "--- A: /setup (PRED prijavo, javna) → N1 CTA <Link> — POGOJNA 'done' resnica ---"
agent-browser close --all >/dev/null 2>&1
agent-browser open "${EB_BASE:-https://roksal-railing-manager.vercel.app}/setup" >/dev/null 2>&1
sleep 5
agent-browser eval "JSON.stringify({
  n1cta: [...document.querySelectorAll('a')].filter(a=>['rounded-xl','bg-roksal-amber','px-5','text-sm','font-bold','text-white','shadow-md','transition-colors','hover:bg-roksal-amber/90'].every(t=>(a.className||'').split(/\\s+/).includes(t))).length,
  razlog: 'POGOJNA resnica: CTA <Link> renderan SAMO v done stanju (uspesen bootstrap/obnova) — ZERO-MUTACIJA ne sproži bootstrapa; needle ŽIVO v buildu (era need_static, r389-era-harvest EXIT=0 ×2); iskreno 0, NI fabriciranja'
})" 2>&1 | tail -1
agent-browser close --all >/dev/null 2>&1
sleep 1

echo "--- B: prijava → dashboard → N2 navy/15 + N4 red/20 (className LOČENO) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r389err
eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 5
agent-browser eval "JSON.stringify({
  n2Navy: [...document.querySelectorAll('body *')].filter(e=>['text-roksal-ink','transition-colors','hover:bg-roksal-navy/15'].every(t=>(e.className&&typeof e.className==='string'?e.className:'').split(/\\s+/).includes(t))).length,
  n4Red: [...document.querySelectorAll('body *')].filter(e=>['text-roksal-red','transition-colors','hover:bg-roksal-red/20'].every(t=>(e.className&&typeof e.className==='string'?e.className:'').split(/\\s+/).includes(t))).length,
  n2Tokeni: ['text-roksal-ink','transition-colors','hover:bg-roksal-navy/15'].map(t=>[...document.querySelectorAll('body *')].filter(e=>(e.className&&typeof e.className==='string'?e.className:'').split(/\\s+/).includes(t)).length),
  razlog: 'POGOJNE resnice: N2 Badge navy/15 (L1223 termin vrstice + L1319) vidni SAMO s termini na dashboard; N4 red/20 (L1238 ternary + L2459/L2602/L2936 error badge-i) SAMO ob napakah; iskreni številki, NI fabriciranja; needleji ŽIVO v buildu (era need_static)'
})" 2>&1 | tail -1

echo "--- C: 'measurements' tab → N3 PO anchor photo L2081 — POGOJNA ---"
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 5
agent-browser eval "JSON.stringify({
  n3Po: [...document.querySelectorAll('body *')].filter(e=>['hover:bg-roksal-amber/90','transition-colors','disabled:opacity-50'].every(t=>(e.className&&typeof e.className==='string'?e.className:'').split(/\\s+/).includes(t))).length,
  razlog: 'POGOJNA resnica: PO anchor (photo L2081) v foto uredjevalniku (isPhoto && photoId veriga) — brez odprte fotografije iskreno 0; needle ŽIVO v buildu (era need_static); ZERO-MUTACIJA: ne odpiramo/pišemo fotografij'
})" 2>&1 | tail -1

echo "--- D: sonde (navy + red stetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- E: kolektor ---"
eb_preberi_kolektor r389err

agent-browser close --all >/dev/null 2>&1
echo "=== R389 spot KONEC ==="
