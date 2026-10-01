#!/usr/bin/env python3
# R333 — derive r333-e2e-browser.sh iz r332 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: 🆕 Z0ba zapis (60. člen pozicija dobaviteljev CSV — seed +
#      capture)
#   2. NOVI Z0ba blok — PO Z0az fi, PRED fp-post ODTIS (r333-pz-tmp raise →
#      prisiljen re-mount material suppliers → CSV capture bajtno ×2 →
#      BOM/MIME/glava EN VIR ×6 VERBATIM + tmp vrstica + meta + DETERMINIZEM
#      ŽIVO → restore)
#   3. Generacijske poti: /tmp/r332- (160) → /tmp/r333- (PO splicu — Z0ba
#      blok nosi že r333 poti, SHIFT jih NE dotakne)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r332-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r333-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0ba zapis (PO Z0az bloku, PRED Z0at) ──
zam('''#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO (R324 NOVO — 52. člen''',
'''#   Z0ba: POZICIJA DOBAVITELJEV CSV ŽIVO S PODATKI (R333 NOVO — 60. člen
#         issue #1, CSV brat PDF R264): r333-pz-tmp.cjs raise
#         (determinističen seed — 'R333-TMP-DOBAVITELJ (E2E)': dobavitelj z
#         2 veljavnima cenama [100 + 125, fiksni ISO veljavnostOd, odprta
#         okna] na DVEH obstoječih artiklih — prva dva po id ASC;
#         material_price_no_overlap invarianta: ENA odprta cena per
#         (inventoryId, supplierId) — 2 ceni na ISTEM artiklu bi bile
#         pokvaren vir, R333 lekcija 1) → prisiljen re-mount material
#         suppliers (vzorec Z0av/Z0ax/Z0az) → CSV pill capture ×2 (BOM raw
#         bajti + MIME + glava EN VIR ×6 VERBATIM + tmp vrstica [pozicijska
#         resnica — 2 ponudbi] + meta Obseg/Sklep/Izvoženo ob + DETERMINIZEM
#         ŽIVO na podatkovnih bajtih) → restore (guard ×2: točno 2 ceni po
#         IDENTITETI supplierId + točno 1 dobavitelj z markerjem —
#         ZERO-MUTACIJA končnega stanja);
#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO (R324 NOVO — 52. člen''', 1)

# ── 2. NOVI Z0ba blok (PO Z0az fi, PRED fp-post ODTIS) ──
Z0BA_BLOK = '''
echo "=== Z0ba: POZICIJA DOBAVITELJEV CSV ŽIVO S PODATKI (R333 — 60. člen issue #1: CSV brat PDF R264; determinističen seed + restore; ZERO-MUTACIJA končnega stanja) ==="
# r333-pz-tmp.cjs raise (determinističen seed — vzorec r332-po-tmp R332:
# začasni dobavitelj 'R333-TMP-DOBAVITELJ (E2E)' z 2 veljavnima cenama
# [100 + 125 — fiksni ISO veljavnostOd, odprta okna] na DVEH obstoječih
# artiklih — prva dva po id ASC; material_price_no_overlap invarianta:
# ENA odprta cena per (inventoryId, supplierId) — zato DVA artikla, NE dva
# ceni na enem; pozicijska resnica: 2 ponudbi dobavitelja, best/mesto od
# žive konkurence — ISKRENO, brez trdih pričakovanj o mestu) → prisiljen
# re-mount (dispatch measurements → material suppliers — Z0av/Z0ax/Z0az
# precedens: SPA montaža naloži FRESH /api/material-prices odgovor, sicer
# bi bil EN VIR presek star) → CSV pill [aria-label="Izvozi pozicijo
# dobaviteljev kot CSV"] → blob ujet prek URL.createObjectURL patcha
# (Z0as/Z0ax/Z0az kanon) ×2 klikov → BAJTNI dokaz v brskalniku: UTF-8 BOM
# (RAW bajti EF BB BF — LEKCIJA R330 2) + MIME text/csv + glava EN VIR ×6
# VERBATIM ('"Dobavitelj","Ponudb","Najnižjih","Višjih","Povprečni
# odstopek (%)","Najširši razpon (%)"' — VERBATIM PDF autoTable head R264)
# + podatkovna vrstica 'R333-TMP-DOBAVITELJ (E2E)' (2 ponudbi —
# determinističen števec: točno 2 tmp ceni po IDENTITETI supplierId) + meta
# Obseg/Sklep + DETERMINIZEM ŽIVO na podatkovnih bajtih: vrstice BREZ
# 'Izvoženo ob' bajtno enake med klikoma (čas izvoza edina razlika;
# f(MNOŽICA) sort EN VIR) → restore (guard ×2: točno 2 ceni po
# IDENTITETI + točno 1 dobavitelj z markerjem imena — ZERO-MUTACIJA
# končnega stanja, vzorec R330/R332).
node scripts/r333-pz-tmp.cjs raise || exit 1
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
eb_cakaj 4
if eb_pocakaj_na "(()=>{return !![...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi pozicijo dobaviteljev kot CSV');})()" 8; then
  agent-browser eval "(()=>{window.__z333pozcsvblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__z333pozcsvblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
  eb_klik_gumb "Izvozi pozicijo dobaviteljev kot CSV"
  eb_cakaj 4
  eb_klik_gumb "Izvozi pozicijo dobaviteljev kot CSV"
  eb_cakaj 4
  agent-browser eval "((async()=>{try{const blobi=window.__z333pozcsvblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); const t1=new TextDecoder('utf-8').decode(u1); const t2=new TextDecoder('utf-8').decode(u2); const bomRaw=(u1[0]===0xEF&&u1[1]===0xBB&&u1[2]===0xBF); const vr1=t1.split('\\n'); const vr2=t2.split('\\n'); const tmp=vr1.find(v=>v.startsWith('\\"R333-TMP-DOBAVITELJ (E2E)\\"'))??null; const b1=vr1.filter(v=>!v.startsWith('\\"Izvoženo ob\\"')).join('\\n'); const b2=vr2.filter(v=>!v.startsWith('\\"Izvoženo ob\\"')).join('\\n'); const metaZacetki=['\\"Obseg\\"','\\"Dobaviteljev\\"','\\"Ponudb\\"','\\"Brez alternative\\"','\\"Najnižjih pozicij\\"','\\"Višjih pozicij\\"','\\"Sklep\\"','\\"Izvoženo ob\\"']; const pod=vr1.filter(v=>v.startsWith('\\"')&&!metaZacetki.some(m=>v.startsWith(m))).length-1; return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, bom:bomRaw, mime:blobi[0].type||null, glava:vr1[0]??null, tmpVrstica:tmp, obseg:(vr1.find(v=>v.startsWith('\\"Obseg\\"'))??null).slice(0,90), sklepZacetek:(vr1.find(v=>v.startsWith('\\"Sklep\\"'))??null).slice(0,50), izvozenoOb:vr1.find(v=>v.startsWith('\\"Izvoženo ob\\"'))??null, podatkovneBajtnoEnake:b1===b2, podatkovnih:pod, vrstic:vr1.length, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r333-z0ba.json
  python3 - <<'PYEOFZ0BA' || exit 1
import json
raw = open('/tmp/r333-z0ba.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0ba parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0ba blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['bom'] is True, 'Z0ba BOM FAIL (UTF-8 BOM bajti EF BB BF — formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'text/csv;charset=utf-8', 'Z0ba MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 200, 'Z0ba prekratek CSV: ' + json.dumps(d)
assert d['glava'] == '"Dobavitelj","Ponudb","Najnižjih","Višjih","Povprečni odstopek (%)","Najširši razpon (%)"', 'Z0ba glave EN VIR FAIL (VERBATIM PDF autoTable head ×6): ' + json.dumps(d.get('glava'))
assert d['tmpVrstica'] is not None and d['tmpVrstica'].startswith('"R333-TMP-DOBAVITELJ (E2E)","2",'), 'Z0ba podatkovna vrstica FAIL (tmp dobavitelj z točno 2 ponudbama manjka): ' + json.dumps(d.get('tmpVrstica'))
assert d['obseg'] is not None and d['obseg'].startswith('"Obseg","Vsi dobavitelji z vsaj eno veljavno ponudbo iz /api/material-prices'), 'Z0ba Obseg meta FAIL: ' + json.dumps(d.get('obseg'))
assert d['sklepZacetek'] is not None and d['sklepZacetek'].startswith('"Sklep","'), 'Z0ba Sklep meta FAIL: ' + json.dumps(d.get('sklepZacetek'))
assert d['izvozenoOb'] is not None and d['izvozenoOb'].startswith('"Izvoženo ob","'), 'Z0ba Izvoženo ob meta FAIL: ' + json.dumps(d.get('izvozenoOb'))
assert d['podatkovneBajtnoEnake'] is True, 'Z0ba DETERMINIZEM FAIL — vrstice brez Izvoženo ob niso bajtno enake (f(MNOŽICA) EN VIR sort): ' + json.dumps(d)
assert d['podatkovnih'] is not None and d['podatkovnih'] >= 1, 'Z0ba podatkovnih FAIL (vsaj tmp vrstica): ' + json.dumps(d)
assert d['vrstic'] and d['vrstic'] >= 10, 'Z0ba vrstic FAIL (glava + podatkovne + meta): ' + json.dumps(d)
assert d['err'] is None, 'Z0ba err: ' + json.dumps(d)
print('Z0ba OK — pozicija dobaviteljev CSV ŽIVO bajtno S PODATKI: BOM + MIME + glava EN VIR ×6 VERBATIM + R333-TMP-DOBAVITELJ vrstica (2 ponudbi) + meta Obseg/Sklep/Izvoženo ob + ' + str(d['bajtov']) + ' bajtov + ' + str(d['podatkovnih']) + ' podatkovnih vrstic + DETERMINIZEM ŽIVO na podatkovnih bajtih (60. člen)')
PYEOFZ0BA
  agent-browser screenshot "$SS/qa-r333-e2e-z0ba-pozicija-csv.png" > /dev/null 2>&1
  node scripts/r333-pz-tmp.cjs restore || exit 1
else
  echo "Z0ba OPOMBA: Pozicija CSV pill ni viden na spot seji (RBAC skoping ali iskren gate) — chunk needleji R333 ostajajo obvezni dokaz"
  node scripts/r333-pz-tmp.cjs restore || exit 1
  agent-browser screenshot "$SS/qa-r333-e2e-z0ba-pill-ni-viden.png" > /dev/null 2>&1
fi

'''

zam('node scripts/r276-db-e2e.cjs fp > /tmp/r332-fp-post-276.json || exit 1',
    Z0BA_BLOK + 'node scripts/r276-db-e2e.cjs fp > /tmp/r332-fp-post-276.json || exit 1', 1)

# ── 3. Generacijske poti (PO splicu — Z0ba nosi že r333 poti) ──
zam('/tmp/r332-', '/tmp/r333-', 160)
zam('/tmp/R332-server-e2e.log', '/tmp/R333-server-e2e.log', 1)  # uppercase log (LEKCIJA R330 5 — banner žetoni del register resnice)
zam('=== R332 E2E KONEC ===', '=== R333 E2E KONEC ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r333-e2e-browser.sh zapisan ({len(text)} znakov)')
