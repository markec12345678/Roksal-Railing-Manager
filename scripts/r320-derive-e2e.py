#!/usr/bin/env python3
# R320 — derive r320-e2e-browser.sh iz r318-e2e-browser.sh (generacijski
# vzorec). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed: napačno
# število POJAVITEV → izpisek + exit 1; kalibracija na POJAVITVE — lekcija
# R312/R314/R315/R316/R317/R318).
# Transformacije:
#   1. Glava: NOV Z0aq opomba (izvoz končne verifikacije kot PDF — 49. člen)
#   2. Generacijske poti: /tmp/r318- → /tmp/r320- (134), sekret, marker id,
#      screenshot qa-r318 → qa-r319, server log, E2E KONEC label
#   3. Z0aq blok: splice PO Z0ap screenshot vrstici (izvoz PDF ŽIVO —
#      %PDF- magija + MIME + DETERMINIZEM ŽIVO NA BAJTIH)
#   4. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r318-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r320-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0aq opomba (pred Z0ap vnosom) ──
zam('#   Z0ap: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT PDF ŽIVO (R318 NOVO —',
    '#   Z0aq: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT PDF ŽIVO (R320 NOVO —\n'
    '#         49. člen issue #1, IZVOZI družina): gumb v končna-verifikacija\n'
    '#         bloku → deterministični PDF (fiksni formatni žig + FNV soli\n'
    '#         0xc5–0xc8; brez časa v vsebini; sklep = PETI potrošnik ENEGA\n'
    '#         niza) + %PDF- magija NA BAJTIH + DETERMINIZEM ŽIVO NA BAJTIH\n'
    '#         (dva izvoza bajtno enaka) — EN VIR izvoz, ZERO-MUTACIJA;\n'
    '#   Z0ap: IZVOZ AVTOMATIZACIJSKEGA AUDITA KOT PDF ŽIVO (R318 NOVO —')

# ── 2. Generacijske poti + oznake (PRED spliceom — Z0aq nosi r319 poti) ──
# 134 = /tmp/r318- POJAVITVE (ne vrstice! — lekcija R312/R314/R315/R316/R317/
# R318 ŠESTIČ: kalibracija na pojavitve)
zam('/tmp/r318-', '/tmp/r320-', 134)
zam('r318-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r320-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('/tmp/R318-server-e2e.log', '/tmp/R320-server-e2e.log', 1)
zam('e2e-r318-ne-obstojeci-id', 'e2e-r320-ne-obstojeci-id', 1)
zam('echo "=== R318 E2E KONEC ==="', 'echo "=== R320 E2E KONEC ==="', 1)
zam('qa-r318', 'qa-r319', 5)

# ── 3. Z0aq blok: splice PO (preimenovani) Z0ap screenshot vrstici ──
SIDRO = 'agent-browser screenshot "$SS/qa-r320-e2e-z0ap-izvoz-audit-pdf.png" > /dev/null 2>&1\n'
Z0AQ = SIDRO + '''
echo "=== Z0aq: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT PDF ŽIVO (R320 — 49. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Končna verifikacija blok → gumb [aria-label="Izvozi poročilo končne
# verifikacije kot PDF"] → blob ujet prek URL.createObjectURL patcha
# (Z0aa/Z0ab/Z0ap PDF kanon) → BAJTNI dokaz v brskalniku: %PDF- magija
# (String.fromCharCode — brez TextDecoder, r261/r262 precedens) + MIME
# application/pdf + DETERMINIZEM ŽIVO NA BAJTIH: dva izvoza = bajtno
# identična datoteka (fiksni formatni žig KONCNA_PDF_ZIG_FIKSNI — vsebina
# brez časa; kanon 46./47./48. člen). ZERO-MUTACIJA: samo klik izvoza
# (nič db zapisa).
agent-browser eval "(()=>{window.__kvpdfblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__kvpdfblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi poročilo končne verifikacije kot PDF"
eb_cakaj 3
eb_klik_gumb "Izvozi poročilo končne verifikacije kot PDF"
eb_cakaj 3
agent-browser eval "((async()=>{try{const blobi=window.__kvpdfblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:String.fromCharCode(u1[0],u1[1],u1[2],u1[3],u1[4]), mime:blobi[0].type||null, bajtnoEnako:enako, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r320-z0aq.json
python3 - <<'PYEOFZ0AQ' || exit 1
import json
raw = open('/tmp/r320-z0aq.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0aq parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0aq blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == '%PDF-', 'Z0aq magija FAIL (formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'application/pdf', 'Z0aq MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 10000, 'Z0aq prekratek PDF: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0aq DETERMINIZEM FAIL — dva izvoza nista bajtno enaka (fiksni formatni žig): ' + json.dumps(d)
assert d['err'] is None, 'Z0aq err: ' + json.dumps(d)
print('Z0aq OK — izvoz končne verifikacije PDF ŽIVO: %PDF- magija + MIME + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka) (49. člen; ZERO-MUTACIJA)')
PYEOFZ0AQ
agent-browser screenshot "$SS/qa-r320-e2e-z0aq-izvoz-koncna-pdf.png" > /dev/null 2>&1
'''
n = text.count(SIDRO)
if n != 1:
    print(f'FAIL-CLOSED: Z0aq sidro — najdeno {n}×, pričakovano 1×')
    sys.exit(1)
text = text.replace(SIDRO, Z0AQ)

DOL.write_text(text, encoding='utf-8')
print(f'OK — {DOL.name} zapisan ({len(text.splitlines())} vrstic)')
