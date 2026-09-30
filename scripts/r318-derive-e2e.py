#!/usr/bin/env python3
# R318 — derive r318-e2e-browser.sh iz r317-e2e-browser.sh (generacijski
# vzorec). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed: napačno
# število POJAVITEV → izpisek + exit 1; kalibracija na POJAVITVE — lekcija
# R312/R314/R315/R316/R317).
# Transformacije:
#   1. Glava: NOV Z0ap opomba (izvoz avtomatizacijskega audita kot PDF —
#      48. člen)
#   2. Generacijske poti: /tmp/r317- → /tmp/r318- (132), sekret, marker id,
#      screenshot qa-r317 → qa-r318, server log, E2E KONEC label
#   3. Z0ap blok: splice PO Z0ao screenshot vrstici (izvoz PDF ŽIVO —
#      %PDF- magija + MIME + DETERMINIZEM ŽIVO NA BAJTIH: dva izvoza
#      bajtno enaka — PRVI PDF z živim bajtnim determinizmom v družini)
#   4. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r317-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r318-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0ap opomba (pred Z0ao vnosom) ──
zam('#   Z0ao: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT CSV ŽIVO (R317 NOVO —',
    '#   Z0ap: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT PDF ŽIVO (R318 NOVO —\n'
    '#         48. člen issue #1, IZVOZI družina): gumb v avtomatizacija-dokaz\n'
    '#         bloku → deterministični PDF (fiksni formatni žig + FNV soli\n'
    '#         0xc1–0xc4; brez časa v vsebini) + %PDF- magija NA BAJTIH +\n'
    '#         DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka — prvi\n'
    '#         PDF z živim bajtnim determinizmom v družini) — EN VIR izvoz,\n'
    '#         ZERO-MUTACIJA;\n'
    '#   Z0ao: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT CSV ŽIVO (R317 NOVO —')

# ── 2. Generacijske poti + oznake (PRED spliceom — Z0ap nosi r318 poti) ──
# 132 = /tmp/r317- POJAVITVE (ne vrstice! rg -c šteje vrstice — lekcija
# R312/R314/R315/R316/R317: kalibracija na pojavitve)
zam('/tmp/r317-', '/tmp/r318-', 132)
zam('r317-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r318-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('/tmp/R317-server-e2e.log', '/tmp/R318-server-e2e.log', 1)
zam('e2e-r317-ne-obstojeci-id', 'e2e-r318-ne-obstojeci-id', 1)
zam('echo "=== R317 E2E KONEC ==="', 'echo "=== R318 E2E KONEC ==="', 1)
zam('qa-r317', 'qa-r318', 4)

# ── 3. Z0ap blok: splice PO (preimenovani) Z0ao screenshot vrstici ──
SIDRO = 'agent-browser screenshot "$SS/qa-r318-e2e-z0ao-izvoz-audit-csv.png" > /dev/null 2>&1\n'
Z0AP = SIDRO + '''
echo "=== Z0ap: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT PDF ŽIVO (R318 — 48. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Avtomatizacija blok → gumb [aria-label="Izvozi avtomatizacijski audit kot
# PDF"] → blob ujet prek URL.createObjectURL patcha (Z0aa/Z0ab PDF kanon) →
# BAJTNI dokaz v brskalniku: %PDF- magija (String.fromCharCode — brez
# TextDecoder, r261/r262 precedens) + MIME application/pdf + DETERMINIZEM
# ŽIVO NA BAJTIH: dva izvoza = bajtno identična datoteka (fiksni formatni
# žig AUDIT_PDF_ZIG_FIKSNI — vsebina brez časa; kanon 46./47. člen, zdaj
# prvič za PDF). ZERO-MUTACIJA: samo klik izvoza (nič db zapisa).
agent-browser eval "(()=>{window.__auditpdfblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__auditpdfblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi avtomatizacijski audit kot PDF"
eb_cakaj 3
eb_klik_gumb "Izvozi avtomatizacijski audit kot PDF"
eb_cakaj 3
agent-browser eval "((async()=>{try{const blobi=window.__auditpdfblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:String.fromCharCode(u1[0],u1[1],u1[2],u1[3],u1[4]), mime:blobi[0].type||null, bajtnoEnako:enako, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r318-z0ap.json
python3 - <<'PYEOFZ0AP' || exit 1
import json
raw = open('/tmp/r318-z0ap.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0ap parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0ap blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == '%PDF-', 'Z0ap magija FAIL (formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'application/pdf', 'Z0ap MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 10000, 'Z0ap prekratek PDF: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0ap DETERMINIZEM FAIL — dva izvoza nista bajtno enaka (fiksni formatni žig): ' + json.dumps(d)
assert d['err'] is None, 'Z0ap err: ' + json.dumps(d)
print('Z0ap OK — izvoz avtomatizacijskega audita PDF ŽIVO: %PDF- magija + MIME + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka — prvi PDF z živim bajtnim determinizmom) (48. člen; ZERO-MUTACIJA)')
PYEOFZ0AP
agent-browser screenshot "$SS/qa-r318-e2e-z0ap-izvoz-audit-pdf.png" > /dev/null 2>&1
'''
n = text.count(SIDRO)
if n != 1:
    print(f'FAIL-CLOSED: Z0ap sidro — najdeno {n}×, pričakovano 1×')
    sys.exit(1)
text = text.replace(SIDRO, Z0AP)

DOL.write_text(text, encoding='utf-8')
print(f'OK — {DOL.name} zapisan ({len(text.splitlines())} vrstic)')
