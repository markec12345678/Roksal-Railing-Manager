#!/usr/bin/env python3
# R330 — derive r330-e2e-browser.sh iz r329 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE;
# LEKCIJA R327 4: zamenjave na fragmentih BREZ backslash-escapov).
# Transformacije:
#   1. Glava: NOVI Z0ax opis (57. člen — projekti-termini CSV ŽIVO, pogojni
#      probe — vsi izidi iskreni)
#   2. Generacijske poti: /tmp/r329- ×154 → /tmp/r330- (+ R329-server ×1)
#   3. NOVI Z0ax blok — splice PRED fp-post ODTIS (logistics tab, ZERO-
#      MUTACIJA: samo 2 klika izvoza — nič db zapisa; pogojna veja: pill
#      viden → bajtni dokaz, ni viden → iskrena OPOMBA + chunk needleji)
#   4. Screenshot ime + Footer R329 → R330
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r329-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r330-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0ax opis PO Z0aw ──
zam('''#   Z0aw: PRIMERJAVA DOBAVITELJEV PDF ŽIVO (R329 NOVO — 56. člen issue #1,
#         PDF brat CSV-ju R328): ISTI raise iz Z0av (podatki ŠE ŽIVO pred
#         restore) → PDF izvoz bajtni capture ×2 → %PDF- magija +
#         DETERMINIZEM ŽIVO NA BAJTIH (fiksni formatni žig + FNV soli
#         0xd5–0xd8 — vsebina brez časa); ODTIS 4. gumb SKRIT pin;''',
'''#   Z0aw: PRIMERJAVA DOBAVITELJEV PDF ŽIVO (R329 NOVO — 56. člen issue #1,
#         PDF brat CSV-ju R328): ISTI raise iz Z0av (podatki ŠE ŽIVO pred
#         restore) → PDF izvoz bajtni capture ×2 → %PDF- magija +
#         DETERMINIZEM ŽIVO NA BAJTIH (fiksni formatni žig + FNV soli
#         0xd5–0xd8 — vsebina brez časa); ODTIS 4. gumb SKRIT pin;
#   Z0ax: PROJEKTI — TERMINI CSV ŽIVO S PODATKI (R330 NOVO — 57. člen issue
#         #1, CSV brat PDF R265): r330-pt-tmp.cjs raise (determinističen
#         seed — 'R330-TMP-PROJEKT (E2E)': 2 termina NAVRTENO 5h /
#         ZAKLJUCENO 8h, fiksni ISO časi) → prisiljen re-mount logistics
#         (vzorec Z0av) → CSV capture ×2 (BOM magija + MIME + glava EN VIR
#         ×8 VERBATIM + DETERMINIZEM ŽIVO na podatkovnih bajtih) → restore
#         → iskrena veja ZNOVA (ZERO-MUTACIJA — restore ODTIS guard);''', 1)

# ── 2. Generacijske poti ──
zam('/tmp/r329-', '/tmp/r330-', 154)
zam('/tmp/R329-server', '/tmp/R330-server', 1)

# ── 3. NOVI Z0ax blok — splice PRED fp-post ODTIS ──
Z0AX = r'''
echo "=== Z0ax: PROJEKTI — TERMINI CSV ŽIVO S PODATKI (R330 — 57. člen issue #1: CSV brat PDF R265; seed+restore ZERO-MUTACIJA) ==="
# r330-pt-tmp.cjs raise (determinističen seed — vzorec r328-cena-tmp R328:
# začasna stranka + projekt 'R330-TMP-PROJEKT (E2E)' + 2 termina — NAVRTENO
# 5h 2026-01-05 / ZAKLJUCENO 8h 2026-01-07; fiksni ISO časi; guardi: projekt
# in stranka ne obstajata) → prisiljen re-mount (dispatch measurements →
# logistics — Z0av precedens: SPA montaža naloži FRESH /api/projects state,
# sicer bi bila EN VIR povezava prekine in termini postali siroti) → CSV
# pill [aria-label="Izvozi pregled projektov in terminov kot CSV"] → blob
# ujet prek URL.createObjectURL patcha (Z0as/Z0aw kanon) ×2 klikov → BAJTNI
# dokaz v brskalniku: UTF-8 BOM (U+FEFF — charCode 65279) + MIME text/csv +
# glava EN VIR ×8 VERBATIM ('"Projekt","Stranka",…' — R297 družina: vejica +
# citiraj, NIČ podvojenih glav) + podatkovna vrstica 'R330-TMP-PROJEKT
# (E2E)' + ure '13' (5+8 — ZAKLJUCENO v vsoti) + meta Obseg/Sklep +
# DETERMINIZEM ŽIVO na podatkovnih bajtih: vrstice BREZ 'Izvoženo ob'
# bajtno enake med klikoma (čas izvoza edina razlika — iskrena meta
# vrstica; f(MNOŽICA) sort EN VIR) → restore (guard točno 2 termina +
# ODTIS prej−2/prej−1 == po — ZERO-MUTACIJA končnega stanja, vzorec R328).
# Pogojna veja (Z0aa/Z0t precedens — eb_pocakaj_na boolean predikat;
# LEKCIJA R330: agent-browser eval stringificira JSON z narekovaji —
# kondicional NE sme igrati na narekovaje): pill ni viden na seji →
# iskrena OPOMBA + RESTORE — chunk needleji R330 ostajajo obvezni dokaz.
node scripts/r330-pt-tmp.cjs raise || exit 1
eb_dispatch '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 4
if eb_pocakaj_na "(()=>{return !![...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi pregled projektov in terminov kot CSV');})()" 8; then
  agent-browser eval "(()=>{window.__zptcsvblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__zptcsvblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
  eb_klik_gumb "Izvozi pregled projektov in terminov kot CSV"
  eb_cakaj 4
  eb_klik_gumb "Izvozi pregled projektov in terminov kot CSV"
  eb_cakaj 4
  agent-browser eval "((async()=>{try{const blobi=window.__zptcsvblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); const t1=new TextDecoder('utf-8').decode(u1); const t2=new TextDecoder('utf-8').decode(u2); const bomRaw=(u1[0]===0xEF&&u1[1]===0xBB&&u1[2]===0xBF); const vr1=t1.split('\n'); const vr2=t2.split('\n'); const tmp=vr1.find(v=>v.includes('R330-TMP-PROJEKT (E2E)'))??null; const b1=vr1.filter(v=>!v.startsWith('\"Izvoženo ob\"')).join('\n'); const b2=vr2.filter(v=>!v.startsWith('\"Izvoženo ob\"')).join('\n'); return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, bom:bomRaw, mime:blobi[0].type||null, glava:vr1[0]??null, tmpVrstica:tmp, obseg:(vr1.find(v=>v.startsWith('\"Obseg\"'))??null).slice(0,80), sklepZacetek:(vr1.find(v=>v.startsWith('\"Sklep\"'))??null).slice(0,50), izvozenoOb:vr1.find(v=>v.startsWith('\"Izvoženo ob\"'))??null, podatkovneBajtnoEnake:b1===b2, vrstic:vr1.length, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r330-z0ax.json
  python3 - <<'PYEOFZ0AX' || exit 1
import json
raw = open('/tmp/r330-z0ax.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0ax parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0ax blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['bom'] is True, 'Z0ax BOM FAIL (UTF-8 BOM bajti EF BB BF — formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'text/csv;charset=utf-8', 'Z0ax MIME FAIL: ' + json.dumps(d)
assert d['bajtov'] > 300, 'Z0ax prekratek CSV: ' + json.dumps(d)
assert d['glava'] == '"Projekt","Stranka","Terminov","Načrtovano","V teku","Zaključeno","Ur","Obdobje"', 'Z0ax glave EN VIR FAIL (VERBATIM PDF autoTable head ×8): ' + json.dumps(d.get('glava'))
assert d['tmpVrstica'] is not None and 'R330-TMP-PROJEKT (E2E)' in d['tmpVrstica'], 'Z0ax podatkovna vrstica FAIL (tmp projekt manjka): ' + json.dumps(d.get('tmpVrstica'))
assert d['tmpVrstica'] is not None and '"2"' in d['tmpVrstica'] and '"13"' in d['tmpVrstica'], 'Z0ax tmp agregat FAIL (2 termina, 13 ur — ZAKLJUCENO v vsoti): ' + json.dumps(d.get('tmpVrstica'))
assert d['obseg'] is not None and d['obseg'].startswith('"Obseg","Vsi projekti z vsaj enim ujemajočim terminom'), 'Z0ax Obseg meta FAIL: ' + json.dumps(d.get('obseg'))
assert d['sklepZacetek'] is not None and d['sklepZacetek'].startswith('"Sklep","'), 'Z0ax Sklep meta FAIL: ' + json.dumps(d.get('sklepZacetek'))
assert d['izvozenoOb'] is not None and d['izvozenoOb'].startswith('"Izvoženo ob","'), 'Z0ax Izvoženo ob meta FAIL: ' + json.dumps(d.get('izvozenoOb'))
assert d['podatkovneBajtnoEnake'] is True, 'Z0ax DETERMINIZEM FAIL — vrstice brez Izvoženo ob niso bajtno enake (f(MNOŽICA) EN VIR sort): ' + json.dumps(d)
assert d['vrstic'] and d['vrstic'] >= 6, 'Z0ax vrstic FAIL (glava + podatkovne + meta): ' + json.dumps(d)
assert d['err'] is None, 'Z0ax err: ' + json.dumps(d)
print('Z0ax OK — projekti-termini CSV ŽIVO bajtno S PODATKI: BOM + MIME + glava EN VIR ×8 VERBATIM + R330-TMP-PROJEKT vrstica (2 termina, 13 ur) + meta Obseg/Sklep/Izvoženo ob + ' + str(d['bajtov']) + ' bajtov + DETERMINIZEM ŽIVO na podatkovnih bajtih (57. člen)')
PYEOFZ0AX
  agent-browser screenshot "$SS/qa-r330-e2e-z0ax-projekti-termini-csv.png" > /dev/null 2>&1
  node scripts/r330-pt-tmp.cjs restore || exit 1
else
  echo "Z0ax OPOMBA: Projekti CSV pill ni viden na spot seji (RBAC skoping ali iskren gate) — chunk needleji R330 ostajajo obvezni dokaz"
  node scripts/r330-pt-tmp.cjs restore || exit 1
  agent-browser screenshot "$SS/qa-r330-e2e-z0ax-pill-ni-viden.png" > /dev/null 2>&1
fi

'''
zam('node scripts/r276-db-e2e.cjs fp > /tmp/r330-fp-post-276.json || exit 1',
    Z0AX + 'node scripts/r276-db-e2e.cjs fp > /tmp/r330-fp-post-276.json || exit 1', 1)

# ── 4. Screenshot ime + Footer ──
zam('qa-r329-e2e', 'qa-r330-e2e', 4)
zam('echo "=== R329 E2E KONEC ==="', 'echo "=== R330 E2E KONEC ==="', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r330-e2e-browser.sh zapisan ({len(text)} znakov)')
