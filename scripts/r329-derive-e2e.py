#!/usr/bin/env python3
# R329 — derive r329-e2e-browser.sh iz r328 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE;
# LEKCIJA R327 4: zamenjave na fragmentih BREZ backslash-escapov).
# Transformacije:
#   1. Glava: NOVI Z0aw opis (56. člen — PDF determinizem ŽIVO na Z0av podatkih)
#   2. Generacijske poti: /tmp/r328- ×152 → /tmp/r329- (+ R328-server ×1)
#   3. NOVI Z0aw blok — splice PRED restore (Z0av podatki ŠE ŽIVO): PDF
#      capture ×2 (DETERMINIZEM ŽIVO NA BAJTIH; %PDF- magija) → screenshot
#   4. ODTIS 3 → 4 izvozna gumba (NOVI dobavitelji PDF gumb SKRIT pin)
#   5. Screenshot ime + Footer R328 → R329
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r328-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r329-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0aw opis PO Z0av ──
zam('''#   Z0av: PRIMERJAVA DOBAVITELJEV ŽIVO S PODATKI (R328 NOVO — 55. člen
#         issue #1 §5, supplier comparison): r328-cena-tmp.cjs raise
#         (determinističen seed — WPC-120-A: zaprt 10.00 → odprt 12.50 pri
#         'R328-TMP-DOBAVITELJ (E2E)'; fiksni ISO časi) → zgodovina panel
#         + NOVI pod panel CenaDobaviteljiPanel ŽIVO s podatki → CSV izvoz
#         ×2 (bajtna determinizem ŽIVO) → restore → iskrena prazna veja
#         ZNOVA (ZERO-MUTACIJA končnega stanja — restore guard prešteje);''',
'''#   Z0av: PRIMERJAVA DOBAVITELJEV ŽIVO S PODATKI (R328 NOVO — 55. člen
#         issue #1 §5, supplier comparison): r328-cena-tmp.cjs raise
#         (determinističen seed — WPC-120-A: zaprt 10.00 → odprt 12.50 pri
#         'R328-TMP-DOBAVITELJ (E2E)'; fiksni ISO časi) → zgodovina panel
#         + NOVI pod panel CenaDobaviteljiPanel ŽIVO s podatki → CSV izvoz
#         ×2 (bajtna determinizem ŽIVO) → restore → iskrena prazna veja
#         ZNOVA (ZERO-MUTACIJA končnega stanja — restore guard prešteje);
#   Z0aw: PRIMERJAVA DOBAVITELJEV PDF ŽIVO (R329 NOVO — 56. člen issue #1,
#         PDF brat CSV-ju R328): ISTI raise iz Z0av (podatki ŠE ŽIVO pred
#         restore) → PDF izvoz bajtni capture ×2 → %PDF- magija +
#         DETERMINIZEM ŽIVO NA BAJTIH (fiksni formatni žig + FNV soli
#         0xd5–0xd8 — vsebina brez časa); ODTIS 4. gumb SKRIT pin;''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r328-', '/tmp/r329-', 152)
zam('/tmp/R328-server', '/tmp/R329-server', 1)

# ── 3. NOVI Z0aw blok — splice PRED restore (podatki ŠE ŽIVO) ──
Z0AW = r'''

echo "=== Z0aw: PRIMERJAVA DOBAVITELJEV PDF ŽIVO (R329 — 56. člen issue #1: PDF brat CSV-ju R328; ista ravnina Z0av podatkov pred restore; ZERO-MUTACIJA) ==="
# ISTI raise iz Z0av (podatki ŠE ŽIVO pred restore) → PDF izvoz ujet prek
# URL.createObjectURL bajtnega patcha (R235 kanon — BINARNO, ne TextDecoder)
# ×2 klikov → %PDF- magija + DETERMINIZEM ŽIVO NA BAJTIH (dva builda
# istega vhoda = bajtno identična; fiksni formatni žig + FNV soli 0xd5–0xd8
# — vsebina brez časa; filename kanon v unit testih) → restore Z0av
# nadaljuje (ZERO-MUTACIJA končnega stanja nespremenjena).
agent-browser eval "(()=>{window.__zdobpdfblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__zdobpdfblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
eb_klik_gumb "Izvozi primerjavo dobaviteljev kot PDF"
eb_cakaj 4
eb_klik_gumb "Izvozi primerjavo dobaviteljev kot PDF"
eb_cakaj 4
agent-browser eval "((async()=>{try{const blobi=window.__zdobpdfblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); let enako=u1.length===u2.length; if(enako){for(let i=0;i<u1.length;i++){if(u1[i]!==u2[i]){enako=false;break;}}} const magija=String.fromCharCode(u1[0],u1[1],u1[2],u1[3],u1[4]); return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, magija:magija, bajtnoEnako:enako, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r329-z0aw-pdf.json
python3 - <<'PYEOFZ0AWPDF' || exit 1
import json
raw = open('/tmp/r329-z0aw-pdf.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0aw parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0aw blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['magija'] == '%PDF-', 'Z0aw %PDF- magija FAIL (formatna resnica — PDF header bajti): ' + json.dumps(d.get('magija'))
assert d['bajtnoEnako'] is True, 'Z0aw DETERMINIZEM FAIL — dva PDF izvoza nista bajtno enaka (fiksni žig + FNV 0xd5–0xd8 + posredovan pregled): ' + json.dumps(d)
assert d['bajtov'] > 1000, 'Z0aw dolžina FAIL (vsebina ni prazna): ' + str(d['bajtov'])
assert d['err'] is None, 'Z0aw err: ' + json.dumps(d)
print('Z0aw PDF OK — primerjava dobaviteljev PDF ŽIVO bajtno: %PDF- magija + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO NA BAJTIH (56. člen; ZERO-MUTACIJA)')
PYEOFZ0AWPDF
agent-browser screenshot "$SS/qa-r329-e2e-z0aw-dobavitelji-pdf.png" > /dev/null 2>&1

'''
zam('node scripts/r328-cena-tmp.cjs restore || exit 1',
    Z0AW + 'node scripts/r328-cena-tmp.cjs restore || exit 1', 1)

# ── 4. ODTIS 3 → 4 izvozna gumba (NOVI PDF gumb SKRIT pin) ──
zam("dobGumbSkrit:![...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Izvozi primerjavo dobaviteljev kot CSV')), err:window.__err??null})",
    "dobGumbSkrit:![...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Izvozi primerjavo dobaviteljev kot CSV')), dobPdfGumbSkrit:![...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Izvozi primerjavo dobaviteljev kot PDF')), err:window.__err??null})", 1)
zam("""assert d['dobGumbSkrit'] is True, 'Z0av ODTIS dobavitelji CSV gumb SKRIT FAIL: ' + json.dumps(d)""",
    """assert d['dobGumbSkrit'] is True, 'Z0av ODTIS dobavitelji CSV gumb SKRIT FAIL: ' + json.dumps(d)
assert d['dobPdfGumbSkrit'] is True, 'Z0av ODTIS dobavitelji PDF gumb SKRIT FAIL (56. člen — 4. gumb izvozne družine): ' + json.dumps(d)""", 1)
zam("print('Z0av ODTIS OK — po restore iskrena prazna veja ZNOVA (3 izvozna gumba SKRITA + panel odsoten; ZERO-MUTACIJA končnega stanja)')",
    "print('Z0av ODTIS OK — po restore iskrena prazna veja ZNOVA (4 izvozna gumba SKRITA + panel odsoten; ZERO-MUTACIJA končnega stanja)')", 1)

# ── 5. Screenshot ime + Footer ──
zam('qa-r328-e2e', 'qa-r329-e2e', 3)
zam('echo "=== R328 E2E KONEC ==="', 'echo "=== R329 E2E KONEC ==="', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r329-e2e-browser.sh zapisan ({len(text)} znakov)')
