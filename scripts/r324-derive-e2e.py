#!/usr/bin/env python3
# R324 — derive r324-e2e-browser.sh iz r323 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: Z0at opis (52. člen dnevni pregled PDF ŽIVO)
#   2. Generacijske poti: /tmp/r323- ×140 → /tmp/r324-
#   3. NOV Z0at blok (splice PO Z0as screenshotu): dnevni pregled PDF izvoz
#      ŽIVO — %PDF- magija + MIME application/pdf + DETERMINIZEM ŽIVO NA
#      BAJTIH (dva izvoza bajtno enaka — komponentni EN VIR vhod
#      vodjaIzvozVhod, stanje stabilno med klikoma)
#   4. Footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r323-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r324-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0at opis (vstavljeno PRED Z0ar opisom) ──
zam('#   Z0ar: IZVOZ MERITEV ZMOGLJIVOSTI KOT PDF ŽIVO (R321 — 50. člen',
    '#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO (R324 NOVO — 52. člen\n'
    '#         issue #1, IZVOZI družina): gumb "Dnevni PDF" v glavi "Pregled za\n'
    '#         vodjo" → deterministični PDF (vhod = POSREDOVANA resnica prek\n'
    '#         komponentnega EN VIR helperja vodjaIzvozVhod — ENA preslikava,\n'
    '#         DVA potrošnika [CSV R163 + PDF 52. člen]; EN VIR kontrakt R324\n'
    '#         v bratu R163: glave + validacija + vodjaKpiVrstice + VIR_NIZ;\n'
    '#         FNV soli 0xcd–0xd0; brez časa v vsebini) + %PDF- magija NA\n'
    '#         BAJTIH + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka)\n'
    '#         — EN VIR izvoz, ZERO-MUTACIJA;\n'
    '#   Z0ar: IZVOZ MERITEV ZMOGLJIVOSTI KOT PDF ŽIVO (R321 — 50. člen', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r323-', '/tmp/r324-', 140)

# ── 3. NOV Z0at blok (splice PO Z0as screenshotu) ──
Z0AT = '''
echo "=== Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO (R324 — 52. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# "Pregled za vodjo" glava → gumb [aria-label="Izvozi dnevni pregled vodje
# kot PDF"] → blob ujet prek URL.createObjectURL patcha (Z0ar/Z0as kanon) →
# BAJTNI dokaz v brskalniku: %PDF- magija + MIME application/pdf +
# DETERMINIZEM ŽIVO NA BAJTIH: dva izvoza = bajtno identična datoteka
# (fiksni formatni žig VODJA_PDF_ZIG_FIKSNI + vhod POSREDOVAN prek
# vodjaIzvozVhod — stats/termini/prihodki stabilni med klikoma; kanon
# 46.–51. člen). ZERO-MUTACIJA: samo klik izvoza (nič db zapisa).
agent-browser eval "(()=>{window.__zmdpdfblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__zmdpdfblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi dnevni pregled vodje kot PDF"
eb_cakaj 3
eb_klik_gumb "Izvozi dnevni pregled vodje kot PDF"
eb_cakaj 3
agent-browser eval "((async()=>{try{const blobi=window.__zmdpdfblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:String.fromCharCode(u1[0],u1[1],u1[2],u1[3],u1[4]), mime:blobi[0].type||null, bajtnoEnako:enako, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r324-z0at.json
python3 - <<'PYEOFZ0AT' || exit 1
import json
raw = open('/tmp/r324-z0at.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0at parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0at blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == '%PDF-', 'Z0at magija FAIL (formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'application/pdf', 'Z0at MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 3000, 'Z0at prekratek PDF: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0at DETERMINIZEM FAIL — dva izvoza nista bajtno enaka (fiksni formatni žig + posredovan vhod): ' + json.dumps(d)
assert d['err'] is None, 'Z0at err: ' + json.dumps(d)
print('Z0at OK — izvoz dnevnega pregleda vodje PDF ŽIVO: %PDF- magija + MIME + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka) (52. člen; ZERO-MUTACIJA)')
PYEOFZ0AT
agent-browser screenshot "$SS/qa-r324-e2e-z0at-dnevni-pregled-pdf.png" > /dev/null 2>&1
'''
zam('agent-browser screenshot "$SS/qa-r323-e2e-z0as-izvoz-zmogljivost-csv.png" > /dev/null 2>&1',
    'agent-browser screenshot "$SS/qa-r323-e2e-z0as-izvoz-zmogljivost-csv.png" > /dev/null 2>&1\n' + Z0AT, 1)

# ── 4. Footer ──
zam('echo "=== R323 E2E KONEC ==="', 'echo "=== R324 E2E KONEC ==="', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r324-e2e-browser.sh zapisan ({len(text)} znakov)')
