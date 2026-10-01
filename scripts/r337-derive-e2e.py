#!/usr/bin/env python3
# R337 — derive r337-e2e-browser.sh iz r336 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Z0be blok (AI RABA PREGLED CSV ŽIVO — 64. člen) PO Z0bd bloku
#   2. Z0be opis v glavni Z-listi (PO Z0bd opisu)
#   3. Poti: /tmp/r336- → /tmp/r337- (168 + 2 Z0be), qa-r336- → qa-r337- (6 + 2)
#   4. Server log + footer
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r336-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r337-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Z0be opis v glavni Z-listi (PO Z0bd opisu) ──
zam('''#         (celotna datoteka — močnejši dokaz kot podatkovna-bajtna enakost
#         R330–R335);''',
'''#         (celotna datoteka — močnejši dokaz kot podatkovna-bajtna enakost
#         R330–R335);
#   Z0be: AI RABA PREGLED CSV ŽIVO (R337 NOVO — 64. člen issue #1, CSV brat
#         zaslona ai-raba-dokaz R311): BREZ seeda — READ-ONLY izvoz
#         STATIČNEGA kataloga (ZERO-MUTACIJA trivialno — izvoz NIČ ne piše);
#         dispatch vodja → CSV pill [aria-label="Izvozi pregled AI rabe kot
#         CSV"] → blob ujet prek URL.createObjectURL patcha (Z0bb/Z0bd kanon)
#         ×2 klikov → BAJTNI dokaz v brskalniku: UTF-8 BOM (RAW bajti EF BB
#         BF) + MIME text/csv + glava bloka A + žive AI površine verbatim +
#         meta števci (2 AI · 2 nadomestkov · 3 kandidatov) + 'AI-obveznih;0'
#         (IZPELJAN stAi − stNadomestkov po konstrukciji) + status vrstica
#         (ISTA formula kot zaslon) + kandidati verbatim + Sklep (ISTI niz
#         kot zaslon/testi/docs) + Vir + BREZ 'Izvoženo ob' (brez-časa kanon
#         R334/R336 — katalog je statična resnica repozitorija) +
#         DETERMINIZEM ŽIVO FULL: OBA izvoza BAJTNO enaka (celotna
#         datoteka);''')

# ── 2. Z0be blok PO Z0bd bloku (pred odtis post-checki) ──
zam('''node scripts/r276-db-e2e.cjs fp > /tmp/r336-fp-post-276.json || exit 1''',
'''echo "=== Z0be: AI RABA PREGLED CSV ŽIVO (R337 — 64. člen issue #1: CSV brat zaslona ai-raba-dokaz R311; brez seeda — READ-ONLY izvoz statičnega kataloga; ZERO-MUTACIJA trivialno) ==="
# EN VIR resnica = katalog (statična resnica repozitorija — ISTI vir kot
# zaslon + testi + docs; handler poda že IZRISANI pregled aiRabaCsv(aiRaba))
# — E2E NE seje nič (izvoz je čista projekcija — NIČ DB pisanj); dispatch
# vodja → CSV pill [aria-label="Izvozi pregled AI rabe kot CSV"] → blob
# ujet prek URL.createObjectURL patcha (Z0bb/Z0bc/Z0bd kanon) ×2 klikov →
# BAJTNI dokaz v brskalniku: BOM raw + MIME + glava bloka A + žive AI
# površine verbatim + meta števci + status vrstica + kandidati + Sklep +
# Vir + brez 'Izvoženo ob' + DETERMINIZEM ŽIVO FULL (oba izvoza iz ISTEGA
# kataloga — brez-časa kanon R334/R336).
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
if eb_pocakaj_na "(()=>{return !![...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled AI rabe kot CSV');})()" 8; then
  agent-browser eval "(()=>{window.__z337aiblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__z337aiblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
  eb_klik_gumb "Izvozi pregled AI rabe kot CSV"
  eb_cakaj 2
  eb_klik_gumb "Izvozi pregled AI rabe kot CSV"
  eb_cakaj 2
  agent-browser eval "((async()=>{try{const blobi=window.__z337aiblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); const t1=new TextDecoder('utf-8').decode(u1); const t2=new TextDecoder('utf-8').decode(u2); const bomRaw=(u1[0]===0xEF&&u1[1]===0xBB&&u1[2]===0xBF); const vr1=t1.replace(/^\\uFEFF/,'').split('\\r\\n').filter(v=>v.length>0); return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, bom:bomRaw, mime:blobi[0].type||null, glava:vr1[0]??null, prvaZiva:vr1[1]??null, stevci:(vr1.find(v=>v==='AI površin v živo (z nadomestkom);2')??null), aiObveznih:(vr1.find(v=>v==='AI-obveznih;0')??null), statusVrstica:(vr1.find(v=>v.startsWith('Kandidati — '))??null), kandidatiGlava:(vr1.find(v=>v==='Funkcija;Zakaj;Status')??null), prviKandidat:(vr1.find(v=>v.startsWith('Segmentacija ograje'))??null), sklep:(vr1.find(v=>v.startsWith('Sklep;AI površine: 2'))??null), vir:(vr1.find(v=>v.startsWith('Vir;AI raba pregled'))??null), brezIzvozenoOb:!t1.includes('Izvoženo ob'), determinizemFull:(t1===t2), vrstic:vr1.length, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r336-z0be.json
  python3 - <<'PYEOFZ0BE' || exit 1
import json
raw = open('/tmp/r336-z0be.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0be parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0be blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['bom'] is True, 'Z0be BOM FAIL (UTF-8 BOM bajti EF BB BF — formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'text/csv;charset=utf-8', 'Z0be MIME FAIL: ' + json.dumps(d)
assert d['glava'] == 'Zmožnost (opis);Modul;Nadomestek (brez AI);Nadomestek (modul)', 'Z0be glava FAIL (glava bloka A — kanon R136): ' + json.dumps(d.get('glava'))
assert d['prvaZiva'] is not None and d['prvaZiva'].startswith('VIZ render job (GPU) — iskren stub'), 'Z0be žive FAIL (EN VIR katalog — ISTI opis kot zaslon): ' + json.dumps(d.get('prvaZiva'))
assert d['stevci'] == 'AI površin v živo (z nadomestkom);2', 'Z0be števci FAIL (register R311 — 2 AI z nadomestkom): ' + json.dumps(d.get('stevci'))
assert d['aiObveznih'] == 'AI-obveznih;0', 'Z0be AI-obveznih FAIL (IZPELJAN stAi − stNadomestkov = 0 po konstrukciji): ' + json.dumps(d.get('aiObveznih'))
assert d['statusVrstica'] == 'Kandidati — NE-IMPLEMENTIRANO — kandidat (nič povezano)', 'Z0be status vrstica FAIL (ISTA formula kot zaslon): ' + json.dumps(d.get('statusVrstica'))
assert d['kandidatiGlava'] == 'Funkcija;Zakaj;Status', 'Z0be kandidati glava FAIL: ' + json.dumps(d.get('kandidatiGlava'))
assert d['prviKandidat'] is not None and d['prviKandidat'].startswith('Segmentacija ograje'), 'Z0be kandidati FAIL (EN VIR AI_KANDIDATI — verbatim): ' + json.dumps(d.get('prviKandidat'))
assert d['sklep'] is not None and d['sklep'].startswith('Sklep;AI površine: 2'), 'Z0be Sklep FAIL (EN VIR — ISTI niz kot zaslon/testi/docs): ' + json.dumps(d.get('sklep'))
assert d['vir'] is not None and d['vir'].startswith('Vir;AI raba pregled'), 'Z0be Vir FAIL: ' + json.dumps(d.get('vir'))
assert d['brezIzvozenoOb'] is True, 'Z0be brez-časa kanon FAIL (nič Izvoženo ob — kanon R334/R336, statična resnica kataloga): ' + json.dumps(d)
assert d['determinizemFull'] is True, 'Z0be DETERMINIZEM ŽIVO FULL FAIL — OBA izvoza nista bajtno enaka (brez-časa kanon R334/R336): ' + json.dumps(d)
assert d['bajtov'] > 100, 'Z0be prekratek CSV: ' + json.dumps(d)
assert d['vrstic'] == 15, 'Z0be vrstic FAIL (glava + 2 žive + naslov + meta ×4 + status + glava B + 3 kandidati + Sklep + Vir = 15 ne-praznih): ' + json.dumps(d)
assert d['err'] is None, 'Z0be err: ' + json.dumps(d)
print('Z0be OK — AI raba pregled CSV ŽIVO bajtno: BOM + MIME + glava A + žive EN VIR + števci (2/2/3) + AI-obveznih 0 izpeljan + status formula + kandidati verbatim + Sklep + Vir + brez Izvoženo ob + ' + str(d['bajtov']) + ' bajtov + ' + str(d['vrstic']) + ' vrstic + DETERMINIZEM ŽIVO FULL (64. člen)')
PYEOFZ0BE
  agent-browser screenshot "$SS/qa-r336-e2e-z0be-ai-raba-csv.png" > /dev/null 2>&1
else
  echo "Z0be OPOMBA: AI raba CSV pill ni viden na spot seji (RBAC skoping ali iskren gate) — chunk needleji R337 ostajajo obvezni dokaz"
  agent-browser screenshot "$SS/qa-r336-e2e-z0be-pill-ni-viden.png" > /dev/null 2>&1
fi

node scripts/r276-db-e2e.cjs fp > /tmp/r336-fp-post-276.json || exit 1''')

# ── 3. Poti ──
zam('/tmp/r336-', '/tmp/r337-', 170)
zam('qa-r336-', 'qa-r337-', 8)
zam('/tmp/R336-server-e2e.log', '/tmp/R337-server-e2e.log')

# ── 4. Footer ──
zam('echo "=== R336 E2E KONEC ==="', 'echo "=== R337 E2E KONEC ==="')

# ── 5. čistost: nič nižjih r336 ostankov ──
n = text.count('r336')
if n != 0:
    print(f'FAIL-CLOSED: {n} nižjih r336 ostankov v r337-e2e-browser.sh')
    sys.exit(1)

DOL.write_text(text, encoding='utf-8')
print('r337-e2e-browser.sh: OK (derive iz r336)')
