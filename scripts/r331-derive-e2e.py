#!/usr/bin/env python3
# R331 — derive r331-e2e-browser.sh iz r330 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE;
# LEKCIJA R327 4: zamenjave na fragmentih BREZ backslash-escapov).
# Transformacije:
#   1. Glava: NOVI Z0ay opis (58. člen — ponudbe-spomniki CSV ŽIVO s stanjem
#      resnice vloge; brez seeda — ODTIS-varani projekti obstajajo)
#   2. Generacijske poti: /tmp/r330- ×156 → /tmp/r331- (+ R330-server ×1)
#   3. NOVI Z0ay blok — splice PRED fp-post ODTIS (crm tab, ZERO-MUTACIJA:
#      samo 2 klika izvoza — nič db zapisa; pogojna veja — eb_pocakaj_na
#      boolean predikat, LEKCIJA R330 1)
#   4. Screenshot ime + Footer R330 → R331
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r330-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r331-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0ay opis PO Z0ax ──
zam('''#   Z0ax: PROJEKTI — TERMINI CSV ŽIVO S PODATKI (R330 NOVO — 57. člen issue
#         #1, CSV brat PDF R265): r330-pt-tmp.cjs raise (determinističen
#         seed — 'R330-TMP-PROJEKT (E2E)': 2 termina NAVRTENO 5h /
#         ZAKLJUCENO 8h, fiksni ISO časi) → prisiljen re-mount logistics
#         (vzorec Z0av) → CSV capture ×2 (BOM magija + MIME + glava EN VIR
#         ×8 VERBATIM + DETERMINIZEM ŽIVO na podatkovnih bajtih) → restore
#         → iskrena veja ZNOVA (ZERO-MUTACIJA — restore ODTIS guard);''',
'''#   Z0ax: PROJEKTI — TERMINI CSV ŽIVO S PODATKI (R330 NOVO — 57. člen issue
#         #1, CSV brat PDF R265): r330-pt-tmp.cjs raise (determinističen
#         seed — 'R330-TMP-PROJEKT (E2E)': 2 termina NAVRTENO 5h /
#         ZAKLJUCENO 8h, fiksni ISO časi) → prisiljen re-mount logistics
#         (vzorec Z0av) → CSV capture ×2 (BOM magija + MIME + glava EN VIR
#         ×8 VERBATIM + DETERMINIZEM ŽIVO na podatkovnih bajtih) → restore
#         → iskrena veja ZNOVA (ZERO-MUTACIJA — restore ODTIS guard);
#   Z0ay: PONUDBE — SPOMNIKI CSV ŽIVO S PODATKI (R331 NOVO — 58. člen issue
#         #1, CSV brat PDF R267): crm tab → quote-followup kartica → CSV
#         pill capture ×2 (BOM raw bajti + MIME + glava EN VIR ×8 VERBATIM
#         + meta Obseg/Sklep + DETERMINIZEM ŽIVO na podatkovnih bajtih);
#         BREZ seeda — projekti so ODTIS-varana resnica (r283 referenčni +
#         ODTIS guardi — polna resnica vloge obstaja); ZERO-MUTACIJA;''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r330-', '/tmp/r331-', 156)
zam('/tmp/R330-server', '/tmp/R331-server', 1)

# ── 3. NOVI Z0ay blok — splice PRED fp-post ODTIS ──
Z0AY = r'''
echo "=== Z0ay: PONUDBE — SPOMNIKI CSV ŽIVO S PODATKI (R331 — 58. člen issue #1: CSV brat PDF R267; brez seeda — ODTIS-varana resnica; ZERO-MUTACIJA) ==="
# CRM tab → quote-followup kartica → CSV pill [aria-label="Izvozi pregled
# spomnikov ponudb kot CSV"] → blob ujet prek URL.createObjectURL patcha
# (Z0as/Z0ax kanon) ×2 klikov → BAJTNI dokaz v brskalniku: UTF-8 BOM (RAW
# bajti EF BB BF — LEKCIJA R330 2: TextDecoder stripa U+FEFF) + MIME
# text/csv + glava EN VIR ×8 VERBATIM ('"Projekt","Stranka","Status",…' —
# R297 družina: vejica + citiraj, NIČ podvojenih glav) + podatkovne vrstice
# (resnica vloge — polna resnica, tudi podpisane) + meta Obseg/Sklep +
# DETERMINIZEM ŽIVO na podatkovnih bajtih: vrstice BREZ 'Izvoženo ob'
# bajtno enake med klikoma (čas izvoza edina razlika; f(MNOŽICA) sort EN
# VIR). ZERO-MUTACIJA: samo kliki izvoza (nič db zapisa); BREZ seeda —
# projekti so ODTIS-varana resnica (r283 referenčni projekt + ODTIS guardi).
# Pogojna veja (Z0aa/Z0t precedens — eb_pocakaj_na boolean predikat;
# LEKCIJA R330 1: agent-browser eval stringificira JSON z narekovaji —
# kondicional NE sme igrati na narekovaje): pill ni viden na seji →
# iskrena OPOMBA — chunk needleji R331 ostajajo obvezni dokaz.
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 4
if eb_pocakaj_na "(()=>{return !![...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled spomnikov ponudb kot CSV');})()" 8; then
  agent-browser eval "(()=>{window.__zpscsvblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__zpscsvblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
  eb_klik_gumb "Izvozi pregled spomnikov ponudb kot CSV"
  eb_cakaj 4
  eb_klik_gumb "Izvozi pregled spomnikov ponudb kot CSV"
  eb_cakaj 4
  agent-browser eval "((async()=>{try{const blobi=window.__zpscsvblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); const t1=new TextDecoder('utf-8').decode(u1); const t2=new TextDecoder('utf-8').decode(u2); const bomRaw=(u1[0]===0xEF&&u1[1]===0xBB&&u1[2]===0xBF); const vr1=t1.split('\n'); const vr2=t2.split('\n'); const b1=vr1.filter(v=>!v.startsWith('\"Izvoženo ob\"')).join('\n'); const b2=vr2.filter(v=>!v.startsWith('\"Izvoženo ob\"')).join('\n'); const pod=vr1.filter(v=>v.startsWith('\"')).length-1; return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, bom:bomRaw, mime:blobi[0].type||null, glava:vr1[0]??null, podatkovnih:pod, obseg:(vr1.find(v=>v.startsWith('\"Obseg\"'))??null).slice(0,80), sklepZacetek:(vr1.find(v=>v.startsWith('\"Sklep\"'))??null).slice(0,60), izvozenoOb:vr1.find(v=>v.startsWith('\"Izvoženo ob\"'))??null, podatkovneBajtnoEnake:b1===b2, vrstic:vr1.length, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r331-z0ay.json
  python3 - <<'PYEOFZ0AY' || exit 1
import json
raw = open('/tmp/r331-z0ay.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0ay parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0ay blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['bom'] is True, 'Z0ay BOM FAIL (UTF-8 BOM bajti EF BB BF — formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'text/csv;charset=utf-8', 'Z0ay MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 300, 'Z0ay prekratek CSV: ' + json.dumps(d)
assert d['glava'] == '"Projekt","Stranka","Status","Spomnik","Stanje","Opomba","Montaža","Podpis"', 'Z0ay glave EN VIR FAIL (VERBATIM PDF autoTable head ×8): ' + json.dumps(d.get('glava'))
assert d['podatkovnih'] >= 1, 'Z0ay podatkovne vrstice FAIL (resnica vloge — vsaj 1 ponudba): ' + json.dumps(d)
assert d['obseg'] is not None and d['obseg'].startswith('"Obseg","Vse ponudbe iz /api/projects'), 'Z0ay Obseg meta FAIL: ' + json.dumps(d.get('obseg'))
assert d['sklepZacetek'] is not None and d['sklepZacetek'].startswith('"Sklep","'), 'Z0ay Sklep meta FAIL: ' + json.dumps(d.get('sklepZacetek'))
assert d['izvozenoOb'] is not None and d['izvozenoOb'].startswith('"Izvoženo ob","'), 'Z0ay Izvoženo ob meta FAIL: ' + json.dumps(d.get('izvozenoOb'))
assert d['podatkovneBajtnoEnake'] is True, 'Z0ay DETERMINIZEM FAIL — vrstice brez Izvoženo ob niso bajtno enake (f(MNOŽICA) EN VIR sort): ' + json.dumps(d)
assert d['vrstic'] and d['vrstic'] >= 5, 'Z0ay vrstic FAIL (glava + podatkovne + meta): ' + json.dumps(d)
assert d['err'] is None, 'Z0ay err: ' + json.dumps(d)
print('Z0ay OK — ponudbe-spomniki CSV ŽIVO bajtno S PODATKI: BOM + MIME + glava EN VIR ×8 VERBATIM + ' + str(d['podatkovnih']) + ' podatkovnih vrstic (polna resnica vloge) + meta Obseg/Sklep/Izvoženo ob + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO na podatkovnih bajtih (58. člen)')
PYEOFZ0AY
  agent-browser screenshot "$SS/qa-r331-e2e-z0ay-ponudbe-spomniki-csv.png" > /dev/null 2>&1
else
  echo "Z0ay OPOMBA: Ponudbe CSV pill ni viden na spot seji (RBAC skoping ali iskren gate) — chunk needleji R331 ostajajo obvezni dokaz"
  agent-browser screenshot "$SS/qa-r331-e2e-z0ay-pill-ni-viden.png" > /dev/null 2>&1
fi

'''
zam('node scripts/r276-db-e2e.cjs fp > /tmp/r331-fp-post-276.json || exit 1',
    Z0AY + 'node scripts/r276-db-e2e.cjs fp > /tmp/r331-fp-post-276.json || exit 1', 1)

# ── 4. Screenshot ime + Footer ──
zam('qa-r330-e2e', 'qa-r331-e2e', 6)
zam('echo "=== R330 E2E KONEC ==="', 'echo "=== R331 E2E KONEC ==="', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r331-e2e-browser.sh zapisan ({len(text)} znakov)')
