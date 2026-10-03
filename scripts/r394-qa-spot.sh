#!/usr/bin/env bash
# r394-qa-spot.sh — R394 produkcija QA spot seja (spot-r184/32; ZERO-MUTACIJA
# — SAMO sonde + navigacijski dispatch; NIČ klikov na odjavo/preklic/revoke/
# izvoz/obvestilne vrstice/označi prebrano/katalog pisanja/naročila pisanja;
# setup bootstrapa NIKOLI ne sprožimo).
# Fokus: val 69 POST-deploy verifikacija — 1 ŠIVNI needle r392.tsv ×2
# (45. era preverba PETINŠTIRIDESIJNA dokazuje 184/184 ŽIVO — total iz DISKA
# 184 = 182 + 2, handover aritmetika 183 popravljena GLASNO; ta sonda
# dokumentira MONTIRANO DOM resnico z mounted + className LOČENO,
# LEKCIJA R365 (4)):
#   A prijava → more/material + subTab orders → Card sorojenec L1690
#     (naročila) — šiv transition-colors→transition-[…,box-shadow]
#     (hover:shadow-sm SNAP → gladak); SAMO className split MERITEV.
#   B more/material + subTab suppliers → Card sorojenec L1980 (dobavitelji)
#     — isti needle ×2 pojavitvi; SAMO className split MERITEV.
#   C sonde (navy + red štetje) + kolektor ŠELE PO prijavi (LEKCIJA R358).
#   Podatkovna opomba: naročila/dobavitelji so podatkovno pogojeni — če je
#   seznam prazen, je 0 ISKRENA resnica (POGOJNA — kanon R392 spot A);
#   needle ŽIVO v buildu dokazuje era need_static PETINŠTIRIDESIJNA.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R394 QA spot seja (spot-r184/32 — val 69 POST-deploy) ==="

echo "--- A: prijava → material/orders → Card L1690 šiv (className LOČENO) ---"
agent-browser close --all >/dev/null 2>&1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r394err
eb_dispatch '{"tab":"more","more":"material","subTab":"orders","osnutek":null,"filter":null}'
sleep 6
agent-browser eval "JSON.stringify((function(){
  const cards=[...document.querySelectorAll('div')].filter(d=>{const c=(typeof d.className==='string'?d.className:'').split(/\\s+/);return c.includes('hover:shadow-sm')&&c.includes('hover:border-roksal-navy/25')&&c.includes('dark:hover:border-roksal-ink/25');});
  const sev=[...document.querySelectorAll('div')].filter(d=>{const c=(typeof d.className==='string'?d.className:'').split(/\\s+/);return c.includes('transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow]');});
  const glad=sev.filter(d=>{const c=d.className.split(/\\s+/);return c.includes('hover:shadow-sm')&&c.includes('hover:border-roksal-navy/25')&&c.includes('dark:hover:border-roksal-ink/25');});
  const snap=cards.filter(d=>{const c=d.className.split(/\\s+/);return c.includes('transition-colors')&&!c.includes('transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow]');});
  const prvi=glad[0]||sev[0]||null;
  const tokeni=prvi?['transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow]','hover:border-roksal-navy/25','dark:hover:border-roksal-ink/25','hover:shadow-sm'].map(x=>prvi.className.split(/\\s+/).includes(x)):null;
  return {nadelCardL1690: glad.length, sevSkupaj: sev.length, stariSnapOstanek: snap.length, tokeniPrvi: tokeni, razlog: 'ŠIVNA resnica: Card L1690 nosi nadgrajen seznam transition-[…,box-shadow] ∪ {hover:shadow-sm} — SNAP ne obstaja več; SAMO className MERITEV, NI klikov (naročila pisanja prepovedana — ZERO-MUTACIJA)'};
})())" 2>&1 | tail -1

echo "--- B: material/suppliers → Card L1980 šiv (className LOČENO) ---"
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
sleep 6
agent-browser eval "JSON.stringify((function(){
  const sev=[...document.querySelectorAll('div')].filter(d=>{const c=(typeof d.className==='string'?d.className:'').split(/\\s+/);return c.includes('transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow]');});
  const glad=sev.filter(d=>{const c=d.className.split(/\\s+/);return c.includes('hover:shadow-sm')&&c.includes('hover:border-roksal-navy/25')&&c.includes('dark:hover:border-roksal-ink/25');});
  const prvi=glad[0]||null;
  const tokeni=prvi?['transition-[color,background-color,border-color,text-decoration-color,fill,stroke,box-shadow]','hover:border-roksal-navy/25','dark:hover:border-roksal-ink/25','hover:shadow-sm'].map(x=>prvi.className.split(/\\s+/).includes(x)):null;
  return {nadelCardL1980: glad.length, sevSkupaj: sev.length, tokeniPrvi: tokeni, razlog: 'Card sorojenec ×2 pojavitve — isti šiv na dobaviteljih; SAMO className MERITEV (dobavitelji za branje — NI urejanja)'};
})())" 2>&1 | tail -1

echo "--- C: sonde (navy + red štetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- D: kolektor ---"
eb_preberi_kolektor r394err

agent-browser close --all >/dev/null 2>&1
echo "=== R394 spot KONEC ==="
