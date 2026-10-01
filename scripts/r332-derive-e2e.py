#!/usr/bin/env python3
# R332 — derive r332-e2e-browser.sh iz r331 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: 🆕 Z0az zapis (59. člen potekli opomniki CSV — seed + capture)
#   2. NOVI Z0az blok — PO Z0ay fi, PRED fp-post ODTIS (r332-po-tmp raise →
#      prisiljen re-mount crm → CSV capture bajtno ×2 → BOM/mime/glava EN
#      VIR ×6 VERBATIM + tmp vrstica + meta + DETERMINIZEM ŽIVO → restore)
#   3. Generacijske poti: /tmp/r331- (158) → /tmp/r332- (PO splicu — Z0az
#      blok nosi že r332 poti, SHIFT jih NE dotakne)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r331-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r332-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0az zapis (PO Z0ay bloku, PRED Z0at) ──
zam('''#         BREZ seeda — projekti so ODTIS-varana resnica (r283 referenčni +
#         ODTIS guardi — polna resnica vloge obstaja); ZERO-MUTACIJA;
#   Z0at:''',
'''#         BREZ seeda — projekti so ODTIS-varana resnica (r283 referenčni +
#         ODTIS guardi — polna resnica vloge obstaja); ZERO-MUTACIJA;
#   Z0az: POTEKLI OPOMNIKI CSV ŽIVO S PODATKI (R332 NOVO — 59. člen issue
#         #1, CSV brat PDF R252): r332-po-tmp.cjs raise (determinističen
#         seed — 'R332-TMP-STRANKA (E2E)': stranka s poteklim opomnikom,
#         opomnikDatum fiksni ISO v preteklosti → POTEKEL izračun ŽIVO)
#         → prisiljen re-mount crm (vzorec Z0av/Z0ax) → CSV pill capture
#         ×2 (BOM raw bajti + MIME + glava EN VIR ×6 VERBATIM + tmp
#         vrstica [POTEKEL resnica] + meta Obseg/Sklep/Izvoženo ob +
#         DETERMINIZEM ŽIVO na podatkovnih bajtih) → restore (guard
#         točno 1 vrstica z markerjem — ZERO-MUTACIJA končnega stanja);
#   Z0at:''', 1)

# ── 2. NOVI Z0az blok (PO Z0ay fi, PRED fp-post ODTIS) ──
Z0AZ_BLOK = '''
echo "=== Z0az: POTEKLI OPOMNIKI CSV ŽIVO S PODATKI (R332 — 59. člen issue #1: CSV brat PDF R252; determinističen seed + restore; ZERO-MUTACIJA končnega stanja) ==="
# r332-po-tmp.cjs raise (determinističen seed — vzorec r330-pt-tmp R330:
# začasna stranka 'R332-TMP-STRANKA (E2E)' s poteklim opomnikom —
# opomnikDatum fiksni ISO v preteklosti → /api/crm enrich izračuna
# opomnikStatus='POTEKEL' — ISTI izračun kot žig na kartici) → prisiljen
# re-mount (dispatch measurements → crm — Z0av/Z0ax precedens: SPA montaža
# naloži FRESH /api/crm state, sicer bi bil EN VIR izbor star) → CSV pill
# [aria-label="Izvozi potekle opomnike kot CSV"] → blob ujet prek
# URL.createObjectURL patcha (Z0as/Z0ax kanon) ×2 klikov → BAJTNI dokaz v
# brskalniku: UTF-8 BOM (RAW bajti EF BB BF — LEKCIJA R330 2) + MIME
# text/csv + glava EN VIR ×6 VERBATIM ('"Stranka","Naslov","Telefon",
# "Opomnik","Dni prek","Opis"' — R297 družina: vejica + citiraj, NIČ
# podvojenih glav) + podatkovna vrstica 'R332-TMP-STRANKA (E2E)' (POTEKEL
# resnica — opis + datum) + meta Obseg/Sklep + DETERMINIZEM ŽIVO na
# podatkovnih bajtih: vrstice BREZ 'Izvoženo ob' bajtno enake med klikoma
# (čas izvoza edina razlika; dni prek floor-monotona znotraj dneva;
# f(MNOŽICA) sort EN VIR) → restore (guard točno 1 vrstica z markerjem
# imena — ZERO-MUTACIJA končnega stanja, vzorec R330).
node scripts/r332-po-tmp.cjs raise || exit 1
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 4
if eb_pocakaj_na "(()=>{return !![...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi potekle opomnike kot CSV');})()" 8; then
  agent-browser eval "(()=>{window.__z332pocsvblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__z332pocsvblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
  eb_klik_gumb "Izvozi potekle opomnike kot CSV"
  eb_cakaj 4
  eb_klik_gumb "Izvozi potekle opomnike kot CSV"
  eb_cakaj 4
  agent-browser eval "((async()=>{try{const blobi=window.__z332pocsvblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); const t1=new TextDecoder('utf-8').decode(u1); const t2=new TextDecoder('utf-8').decode(u2); const bomRaw=(u1[0]===0xEF&&u1[1]===0xBB&&u1[2]===0xBF); const vr1=t1.split('\\n'); const vr2=t2.split('\\n'); const tmp=vr1.find(v=>v.includes('R332-TMP-STRANKA (E2E)'))??null; const b1=vr1.filter(v=>!v.startsWith('\\"Izvoženo ob\\"')).join('\\n'); const b2=vr2.filter(v=>!v.startsWith('\\"Izvoženo ob\\"')).join('\\n'); const pod=vr1.filter(v=>v.startsWith('\\"')&&!v.startsWith('\\"Obseg\\"')&&!v.startsWith('\\"Sklep\\"')&&!v.startsWith('\\"Izvoženo ob\\"')&&!v.startsWith('\\"Poteklih\\"')&&!v.startsWith('\\"Najstarejši (dni)\\"')&&!v.startsWith('\\"Povprečno (dni)\\"')).length-1; return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, bom:bomRaw, mime:blobi[0].type||null, glava:vr1[0]??null, tmpVrstica:tmp, obseg:(vr1.find(v=>v.startsWith('\\"Obseg\\"'))??null).slice(0,80), sklepZacetek:(vr1.find(v=>v.startsWith('\\"Sklep\\"'))??null).slice(0,50), izvozenoOb:vr1.find(v=>v.startsWith('\\"Izvoženo ob\\"'))??null, podatkovneBajtnoEnake:b1===b2, vrstic:vr1.length, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r332-z0az.json
  python3 - <<'PYEOFZ0AZ' || exit 1
import json
raw = open('/tmp/r332-z0az.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0az parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0az blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['bom'] is True, 'Z0az BOM FAIL (UTF-8 BOM bajti EF BB BF — formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'text/csv;charset=utf-8', 'Z0az MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 200, 'Z0az prekratek CSV: ' + json.dumps(d)
assert d['glava'] == '"Stranka","Naslov","Telefon","Opomnik","Dni prek","Opis"', 'Z0az glave EN VIR FAIL (VERBATIM PDF autoTable head ×6): ' + json.dumps(d.get('glava'))
assert d['tmpVrstica'] is not None and 'R332-TMP-STRANKA (E2E)' in d['tmpVrstica'], 'Z0az podatkovna vrstica FAIL (tmp stranka manjka): ' + json.dumps(d.get('tmpVrstica'))
assert d['tmpVrstica'] is not None and 'R332 E2E opomnik (potekel)' in d['tmpVrstica'], 'Z0az tmp opis FAIL (POTEKEL resnica — opis manjka): ' + json.dumps(d.get('tmpVrstica'))
assert d['obseg'] is not None and d['obseg'].startswith('"Obseg","Vse stranke s poteklim opomnikom iz /api/crm'), 'Z0az Obseg meta FAIL: ' + json.dumps(d.get('obseg'))
assert d['sklepZacetek'] is not None and d['sklepZacetek'].startswith('"Sklep","'), 'Z0az Sklep meta FAIL: ' + json.dumps(d.get('sklepZacetek'))
assert d['izvozenoOb'] is not None and d['izvozenoOb'].startswith('"Izvoženo ob","'), 'Z0az Izvoženo ob meta FAIL: ' + json.dumps(d.get('izvozenoOb'))
assert d['podatkovneBajtnoEnake'] is True, 'Z0az DETERMINIZEM FAIL — vrstice brez Izvoženo ob niso bajtno enake (f(MNOŽICA) EN VIR sort): ' + json.dumps(d)
assert d['vrstic'] and d['vrstic'] >= 9, 'Z0az vrstic FAIL (glava + podatkovne + meta): ' + json.dumps(d)
assert d['err'] is None, 'Z0az err: ' + json.dumps(d)
print('Z0az OK — potekli opomniki CSV ŽIVO bajtno S PODATKI: BOM + MIME + glava EN VIR ×6 VERBATIM + R332-TMP-STRANKA vrstica (POTEKEL resnica) + meta Obseg/Sklep/Izvoženo ob + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO na podatkovnih bajtih (59. člen)')
PYEOFZ0AZ
  agent-browser screenshot "$SS/qa-r332-e2e-z0az-potekli-csv.png" > /dev/null 2>&1
  node scripts/r332-po-tmp.cjs restore || exit 1
else
  echo "Z0az OPOMBA: Potekli CSV pill ni viden na spot seji (RBAC skoping ali iskren gate) — chunk needleji R332 ostajajo obvezni dokaz"
  node scripts/r332-po-tmp.cjs restore || exit 1
  agent-browser screenshot "$SS/qa-r332-e2e-z0az-pill-ni-viden.png" > /dev/null 2>&1
fi

'''

zam('node scripts/r276-db-e2e.cjs fp > /tmp/r331-fp-post-276.json || exit 1',
    Z0AZ_BLOK + 'node scripts/r276-db-e2e.cjs fp > /tmp/r331-fp-post-276.json || exit 1', 1)

# ── 3. Generacijske poti (PO splicu — Z0az nosi že r332 poti) ──
zam('/tmp/r331-', '/tmp/r332-', 158)
zam('/tmp/R331-server-e2e.log', '/tmp/R332-server-e2e.log', 1)  # uppercase log (LEKCIJA R330 5 — banner žetoni del register resnice)
zam('=== R331 E2E KONEC ===', '=== R332 E2E KONEC ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r332-e2e-browser.sh zapisan ({len(text)} znakov)')
