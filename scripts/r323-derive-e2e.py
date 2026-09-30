#!/usr/bin/env python3
# R323 — derive r323-e2e-browser.sh iz vzporedne r322 generacije (kanon
# kolizija LEKCIJA 1). VSAKA zamenjava je NATANKO ena-n-točkovna
# (fail-closed; LEKCIJA R312: štetje na POJAVITVE). Transformacije:
#   1. Generacijske poti: /tmp/r322- → /tmp/r323- (138 POJAVITEV) +
#      qa-r322- → qa-r323- (7)
#   2. Glava: Z0as opis v zgodovino verzij (najnovejši PRVI — pred Z0ar)
#   3. NOV Z0as blok: izvoz meritev zmogljivosti CSV ŽIVO — BOM magija +
#      MIME + glave EN VIR pin + Vir niz pin + DETERMINIZEM ŽIVO NA BAJTIH
#      — splice PO Z0ar screenshotu, PRED Z0ah
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r322-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r323-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Generacijske poti ──
zam('/tmp/r322-', '/tmp/r323-', 138)
zam('qa-r322-', 'qa-r323-', 7)
zam('R322-server-e2e.log', 'R323-server-e2e.log', 1)
zam('=== R322 E2E KONEC ===', '=== R323 E2E KONEC ===', 1)

# ── 2. Glava: Z0as opis (najnovejši PRVI) ──
zam('#   Z0ar: IZVOZ MERITEV ZMOGLJIVOSTI KOT PDF ŽIVO (R321 — 50. člen',
    '#   Z0as: IZVOZ MERITEV ZMOGLJIVOSTI KOT CSV ŽIVO (R323 NOVO — 51. člen\n'
    '#         issue #1, IZVOZI družina): gumb v zmogljivost-dokaz bloku →\n'
    '#         deterministični CSV (pregled = POSREDOVANA resnica; CSV NE meri\n'
    '#         znova; EN VIR kontrakt R323 — glave + validacija + formatirajMs\n'
    '#         + Vir niz iz brata; toCsv kanon R136: BOM + podpičje + CRLF) +\n'
    '#         BOM magija NA BAJTIH (EF BB BF) + glave EN VIR pin + DETERMINIZEM\n'
    '#         ŽIVO NA BAJTIH (dva izvoza bajtno enaka) — EN VIR izvoz,\n'
    '#         ZERO-MUTACIJA;\n'
    '#   Z0ar: IZVOZ MERITEV ZMOGLJIVOSTI KOT PDF ŽIVO (R321 — 50. člen')

# ── 3. NOV Z0as blok (splice PO Z0ar screenshotu, PRED Z0ah) ──
Z0AS = """agent-browser screenshot "$SS/qa-r323-e2e-z0ar-izvoz-zmogljivost-pdf.png" > /dev/null 2>&1

echo "=== Z0as: IZVOZ MERITEV ZMOGLJIVOSTI KOT CSV ŽIVO (R323 — 51. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Zmogljivost dokaz blok → gumb [aria-label="Izvozi meritve zmogljivosti kot
# CSV"] → blob ujet prek URL.createObjectURL patcha (Z0aa/Z0ab/Z0ap/Z0aq/Z0ar
# kanon) → BAJTNI dokaz v brskalniku: UTF-8 BOM magija (EF BB BF — String.
# fromCharCode na bajtih, r261/r262 precedens) + MIME text/csv + glave EN VIR
# pin (Operacija;Opis;Modul;… — podpičje, kanon R136) + Vir niz pin
# (MERITVE_ZMOGLJIVOST — isti HEAD = bajtno identičen izvoz) +
# DETERMINIZEM ŽIVO NA BAJTIH: dva izvoza = bajtno identična datoteka (toCsv
# kanon + pregled POSREDOVAN — meritev se izvede ENKRAT ob mountu, stanje
# stabilno med klikoma; kanon 46.–50. člen). ZERO-MUTACIJA: samo klik izvoza
# (nič db zapisa).
agent-browser eval "(()=>{window.__zmcsvblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__zmcsvblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi meritve zmogljivosti kot CSV"
eb_cakaj 3
eb_klik_gumb "Izvozi meritve zmogljivosti kot CSV"
eb_cakaj 3
agent-browser eval "((async()=>{try{const blobi=window.__zmcsvblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} const magija=String.fromCharCode(u1[0],u1[1],u1[2]); const besedilo=new TextDecoder('utf-8').decode(await blobi[0].arrayBuffer()); const vrstice=besedilo.split('\\\\r\\\\n'); return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:magija, mime:blobi[0].type||null, bajtnoEnako:enako, glava:vrstice[0]??null, sklepVrstica:vrstice.find(v=>v.startsWith('Sklep;'))??null, virVrstica:vrstice.find(v=>v.startsWith('Vir;'))??null, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r323-z0as.json
python3 - <<'PYEOFZ0AS' || exit 1
import json
raw = open('/tmp/r323-z0as.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0as parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0as blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == 'ï»¿', 'Z0as BOM magija FAIL (formatna resnica — UTF-8 BOM bajti EF BB BF): ' + json.dumps(d)
assert d['mime'] == 'text/csv;charset=utf-8', 'Z0as MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 500, 'Z0as prekratek CSV: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0as DETERMINIZEM FAIL — dva izvoza nista bajtno enaka (toCsv kanon + posredovan pregled): ' + json.dumps(d)
assert d['glava'] == 'Operacija;Opis;Modul;Iteracij;Najmanj;Mediana;Najvec', 'Z0as glave EN VIR FAIL: ' + json.dumps(d.get('glava'))
assert d['sklepVrstica'] is not None and d['sklepVrstica'].startswith('Sklep;'), 'Z0as sklep vrstica FAIL: ' + json.dumps(d.get('sklepVrstica'))
assert d['virVrstica'] == 'Vir;MERITVE_ZMOGLJIVOST — isti HEAD = bajtno identičen izvoz', 'Z0as Vir niz FAIL: ' + json.dumps(d.get('virVrstica'))
assert d['err'] is None, 'Z0as err: ' + json.dumps(d)
print('Z0as OK — izvoz meritev zmogljivosti CSV ŽIVO: BOM magija + MIME + glave EN VIR + Vir niz + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (dva izvoza bajtno enaka) (51. člen; ZERO-MUTACIJA)')
PYEOFZ0AS
agent-browser screenshot "$SS/qa-r323-e2e-z0as-izvoz-zmogljivost-csv.png" > /dev/null 2>&1

echo "=== Z0ah: MIGRACIJSKI VAL ŽIVO (R310 — EN VIR I/O meja api-telo; 26 handlerjev; ZERO-MUTACIJA) ===\""""

zam('agent-browser screenshot "$SS/qa-r323-e2e-z0ar-izvoz-zmogljivost-pdf.png" > /dev/null 2>&1\n\necho "=== Z0ah: MIGRACIJSKI VAL ŽIVO (R310 — EN VIR I/O meja api-telo; 26 handlerjev; ZERO-MUTACIJA) ==="',
    Z0AS, 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r323-e2e-browser.sh zapisan ({len(text)} znakov)')
