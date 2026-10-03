#!/usr/bin/env bash
# r396-qa-spot.sh — R396 produkcija QA spot seja (spot-r185/33; ZERO-MUTACIJA
# — SAMO sonde + navigacijski dispatch; NIČ klikov na odjavo/preklic/revoke/
# izvoz/obvestilne vrstice/označi prebrano/katalog pisanja/naročila pisanja;
# setup bootstrapa NIKOLI ne sprožimo).
# Fokus: val 70 POST-deploy verifikacija — 1 ŠIVNI needle r394.tsv ×64
# (focus-visible:outline-hidden + focus-visible:ring-2 +
# focus-visible:ring-roksal-navy/40 — FORCED-COLORS FOKUS PARITETA; build
# dokaz NEODVISNO od DOM: needle ŽIVO na prod CDN v 9/60 čankov prek
# /tmp/r339-chunkurls.txt, R396 tick; era need_static pokrit v 48. preverbi
# r347–r394 ≥189 [R396 prva naloga]). Ta sonda dokumentira MONTIRANO DOM
# resnico z mounted + className LOČENO (LEKCIJA R365 (4)):
#   A prijava → measurements — najgostejša val 70 datoteka (33 fv_hidden)
#     — vsak fv_hidden element nosi ring/border nadomestni indikator
#     (outline-hidden = SAMO forced-colors rezerva; ring PRIMAREN).
#   B inventory — 14 fv_hidden (druga najgostejša meritvena plast).
#   C sonde (navy + red štetje) + kolektor ŠELE PO prijavi (LEKCIJA R358).
#   Podatkovna opomba: meritve/inventar so podatkovno pogojeni — če je
#   seznam prazen, je fv_hidden število 0 ISKRENA resnica (POGOJNA — kanon
#   R392 spot A); needle ŽIVO v prod čankih dokazuje build plast.
set -u
cd /home/z/my-project
source scripts/e2e-lib.sh

echo "=== R396 QA spot seja (spot-r185/33 — val 70 POST-deploy) ==="

echo "--- A: prijava → measurements → fv_hidden mounted (className LOČENO) ---"
agent-browser close --all >/dev/null 2>&1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
eb_zapri_vodic
eb_kolektor_napak r395err
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 6
agent-browser eval "JSON.stringify((function(){
  const vsi=[...document.querySelectorAll('button,a,input,select,textarea,div')].map(d=>typeof d.className==='string'?d.className:'').filter(c=>c.length>0);
  const fv=vsi.filter(c=>c.split(/\\s+/).includes('focus-visible:outline-hidden'));
  const par=vsi.filter(c=>{const t=c.split(/\\s+/);return t.includes('focus-visible:outline-hidden')&&t.includes('focus-visible:ring-2')&&t.includes('focus-visible:ring-roksal-navy/40');});
  const brezInd=vsi.filter(c=>{const t=c.split(/\\s+/);return t.includes('focus-visible:outline-hidden')&&!t.some(x=>x.includes('ring')||x.includes('border'));});
  const stariFv=vsi.filter(c=>c.split(/\\s+/).includes('focus-visible:outline-none'));
  return {fvHiddenMounted: fv.length, sevniNeedleMounted: par.length, brezNadomestila: brezInd.length, stariOutlineNoneOstanek: stariFv.length, razlog: 'VAL 70 MONTIRANO: focus-visible:outline-hidden + ring-navy/40 šivna sekvenca — ring PRIMARNI indikator, outline-hidden SAMO forced-colors rezerva (WCAG 2.4.7); SAMO className MERITEV, NI klikov (ZERO-MUTACIJA)'};
})())" 2>&1 | tail -1

echo "--- B: inventory → fv_hidden mounted (druga plast) ---"
eb_dispatch '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
sleep 6
agent-browser eval "JSON.stringify((function(){
  const vsi=[...document.querySelectorAll('button,a,input,select,textarea,div')].map(d=>typeof d.className==='string'?d.className:'').filter(c=>c.length>0);
  const fv=vsi.filter(c=>c.split(/\\s+/).includes('focus-visible:outline-hidden'));
  const par=vsi.filter(c=>{const t=c.split(/\\s+/);return t.includes('focus-visible:outline-hidden')&&t.includes('focus-visible:ring-2')&&t.includes('focus-visible:ring-roksal-navy/40');});
  return {fvHiddenMounted: fv.length, sevniNeedleMounted: par.length, razlog: 'Inventory — druga najgostejša val 70 plast (14 v renderu); SAMO className MERITEV (inventar za branje — NI urejanja)'};
})())" 2>&1 | tail -1

echo "--- C: sonde (navy + red štetje) ---"
eb_sonda_navy_stetje
eb_sonda_red_stetje

echo "--- D: kolektor ---"
eb_preberi_kolektor r395err

agent-browser close --all >/dev/null 2>&1
echo "=== R396 spot KONEC ==="
