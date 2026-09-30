#!/usr/bin/env python3
# R321 — derive r321-e2e-browser.sh iz r320-e2e-browser.sh (generacijski
# vzorec). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed; LEKCIJA
# R312: štetje na POJAVITVE). Transformacije:
#   1. Generacijske poti: /tmp/r320- → /tmp/r321- (136) + qa-r320- →
#      qa-r321- (6)
#   2. Glava: Z0ar opis v zgodovino verzij (najnovejši PRVI — pred Z0aq)
#   3. NOV Z0ar blok: izvoz meritev zmogljivosti PDF ŽIVO — %PDF- magija +
#      MIME + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka — fiksni
#      formatni žig + pregled POSREDOVAN; meritev ENKRAT ob mountu)
#      — splice PO Z0aq screenshotu, PRED Z0ah
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r320-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r321-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Generacijske poti ──
zam('/tmp/r320-', '/tmp/r321-', 136)
zam('qa-r320-', 'qa-r321-', 6)
zam('R320-server-e2e.log', 'R321-server-e2e.log', 1)
zam('=== R320 E2E KONEC ===', '=== R321 E2E KONEC ===', 1)

# ── 2. Glava: Z0ar opis (najnovejši PRVI) ──
zam('#   Z0aq: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT PDF ŽIVO (R320 NOVO —',
    '#   Z0ar: IZVOZ MERITEV ZMOGLJIVOSTI KOT PDF ŽIVO (R321 NOVO — 50. člen\n'
    '#         issue #1, IZVOZI družina): gumb v zmogljivost-dokaz bloku →\n'
    '#         deterministični PDF (pregled = POSREDOVANA resnica — meritev\n'
    '#         ENKRAT ob mountu, PDF NE meri znova; formatirajMs = EN VIR\n'
    '#         zaslon + PDF; fiksni formatni žig + FNV soli 0xc9–0xcc; brez\n'
    '#         časa v vsebini) + %PDF- magija NA BAJTIH + DETERMINIZEM ŽIVO\n'
    '#         NA BAJTIH (dva izvoza bajtno enaka) — EN VIR izvoz,\n'
    '#         ZERO-MUTACIJA;\n'
    '#   Z0aq: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT PDF ŽIVO (R320 NOVO —')

# ── 3. NOV Z0ar blok (splice PO Z0aq screenshotu, PRED Z0ah) ──
# OPOMBA narekovaji: blok je triple-double Python niz — shell JS eval vrstice
# nosijo enojne narekovaje znotraj dvojnih shell argumentov (ISTI vzorec kot
# Z0aq blok v r320-e2e-browser.sh).
Z0AR = """agent-browser screenshot "$SS/qa-r321-e2e-z0aq-izvoz-koncna-pdf.png" > /dev/null 2>&1

echo "=== Z0ar: IZVOZ MERITEV ZMOGLJIVOSTI KOT PDF ŽIVO (R321 — 50. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Zmogljivost dokaz blok → gumb [aria-label="Izvozi meritve zmogljivosti kot
# PDF"] → blob ujet prek URL.createObjectURL patcha (Z0aa/Z0ab/Z0ap/Z0aq PDF
# kanon) → BAJTNI dokaz v brskalniku: %PDF- magija (String.fromCharCode —
# brez TextDecoder, r261/r262 precedens) + MIME application/pdf +
# DETERMINIZEM ŽIVO NA BAJTIH: dva izvoza = bajtno identična datoteka (fiksni
# formatni žig ZMOGLJIVOST_PDF_ZIG_FIKSNI + pregled POSREDOVAN — meritev se
# izvede ENKRAT ob mountu, stanje stabilno med klikoma; kanon 46.–49. člen).
# ZERO-MUTACIJA: samo klik izvoza (nič db zapisa).
agent-browser eval "(()=>{window.__zmpdfblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__zmpdfblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi meritve zmogljivosti kot PDF"
eb_cakaj 3
eb_klik_gumb "Izvozi meritve zmogljivosti kot PDF"
eb_cakaj 3
agent-browser eval "((async()=>{try{const blobi=window.__zmpdfblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:String.fromCharCode(u1[0],u1[1],u1[2],u1[3],u1[4]), mime:blobi[0].type||null, bajtnoEnako:enako, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r321-z0ar.json
python3 - <<'PYEOFZ0AR' || exit 1
import json
raw = open('/tmp/r321-z0ar.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0ar parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0ar blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == '%PDF-', 'Z0ar magija FAIL (formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'application/pdf', 'Z0ar MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 10000, 'Z0ar prekratek PDF: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0ar DETERMINIZEM FAIL — dva izvoza nista bajtno enaka (fiksni formatni žig + posredovan pregled): ' + json.dumps(d)
assert d['err'] is None, 'Z0ar err: ' + json.dumps(d)
print('Z0ar OK — izvoz meritev zmogljivosti PDF ŽIVO: %PDF- magija + MIME + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka) (50. člen; ZERO-MUTACIJA)')
PYEOFZ0AR
agent-browser screenshot "$SS/qa-r321-e2e-z0ar-izvoz-zmogljivost-pdf.png" > /dev/null 2>&1

echo "=== Z0ah: MIGRACIJSKI VAL ŽIVO (R310 — EN VIR I/O meja api-telo; 26 handlerjev; ZERO-MUTACIJA) ===\""""

zam('agent-browser screenshot "$SS/qa-r321-e2e-z0aq-izvoz-koncna-pdf.png" > /dev/null 2>&1\n\necho "=== Z0ah: MIGRACIJSKI VAL ŽIVO (R310 — EN VIR I/O meja api-telo; 26 handlerjev; ZERO-MUTACIJA) ==="',
    Z0AR, 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r321-e2e-browser.sh zapisan ({len(text)} znakov)')
