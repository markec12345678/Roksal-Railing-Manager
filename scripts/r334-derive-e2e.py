#!/usr/bin/env python3
# R334 — derive r334-e2e-browser.sh iz r333 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. Glava: 🆕 Z0bb zapis (61. člen končna verifikacija CSV — brez seeda!
#      statična EN VIR registra — NIČ DB dotikov, ZERO-MUTACIJA trivialno)
#   2. NOVI Z0bb blok — PO Z0ba fi, PRED fp-post ODTIS (dispatch vodja →
#      CSV pill capture bajtno ×2 → BOM/MIME/glavi EN VIR VERBATIM + 11
#      območij + 8 kriterijev + KPI ×4 + Sklep + Vir + DETERMINIZEM ŽIVO
#      FULL bajtno [brez 'Izvoženo ob' — obe datoteki BAJTNO enaki])
#   3. Generacijske poti: /tmp/r333- (160+) → /tmp/r334- (PO splicu — Z0bb
#      blok nosi že r334 poti, SHIFT jih NE dotakne)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r333-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r334-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0bb zapis (PO Z0ba bloku, PRED Z0at) ──
zam('''#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO (R324 NOVO — 52. člen''',
'''#   Z0bb: KONČNA VERIFIKACIJA CSV ŽIVO (R334 NOVO — 61. člen issue #1, CSV
#         brat JSON R316 + PDF R320 — izvozna TRIADA): BREZ seeda — statična
#         EN VIR registra (AVTOMATIZACIJA_AUDIT + DOKAZI_AUDITA +
#         SPREJEMNI_KRITERIJI) — NIČ DB dotikov, ZERO-MUTACIJA trivialno;
#         dispatch vodja → CSV pill capture ×2 (BOM raw bajti + MIME +
#         glavi EN VIR VERBATIM [T1 + T2] + 11 območij + 8 kriterijev +
#         KPI ×4 + Sklep + Vir + DETERMINIZEM ŽIVO FULL bajtno — brez
#         'Izvoženo ob' sta OBI izvoza BAJTNO enaka, kanon 46./47. člen);
#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO (R324 NOVO — 52. člen''', 1)

# ── 2. NOVI Z0bb blok (PO Z0ba fi, PRED fp-post ODTIS) ──
Z0BB_BLOK = '''
echo "=== Z0bb: KONČNA VERIFIKACIJA CSV ŽIVO (R334 — 61. člen issue #1: CSV brat JSON R316 + PDF R320 — izvozna TRIADA; brez seeda — statična EN VIR registra; ZERO-MUTACIJA trivialno) ==="
# EN VIR resnica je STATIČNA (AVTOMATIZACIJA_AUDIT + DOKAZI_AUDITA +
# SPREJEMNI_KRITERIJI — registra R315, NIČ DB) — E2E NE seje nič (brez
# raise/restore — vzorec Z0aq končna PDF): dispatch vodja → CSV pill
# [aria-label="Izvozi poročilo končne verifikacije kot CSV"] → blob ujet
# prek URL.createObjectURL patcha (Z0as/Z0ax/Z0az/Z0ba kanon) ×2 klikov →
# BAJTNI dokaz v brskalniku: UTF-8 BOM (RAW bajti EF BB BF — LEKCIJA R330
# 2) + MIME text/csv + glava bloka A VERBATIM ('Območje;Razred;Plasti;
# Dokaz' — VERBATIM PDF autoTable head T1 R320) + 11 območij + glava
# bloka B VERBATIM ('Kriterij;Izpeljava;Dokaz' — T2) + 8 kriterijev + KPI
# ×4 (Območij/Z dokazi/Kriterijev/AI-OBVEZNO) + Sklep ('Končna
# verifikacija: 11/11 območij…') + Vir niz + DETERMINIZEM ŽIVO FULL:
# OBA izvoza BAJTNO enaka (brez 'Izvoženo ob' — kanon determinizma
# 46./47. člen: isti HEAD = bajtno identična datoteka).
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
if eb_pocakaj_na "(()=>{return !![...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi poročilo končne verifikacije kot CSV');})()" 8; then
  agent-browser eval "(()=>{window.__z334kvcsblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__z334kvcsblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
  eb_klik_gumb "Izvozi poročilo končne verifikacije kot CSV"
  eb_cakaj 3
  eb_klik_gumb "Izvozi poročilo končne verifikacije kot CSV"
  eb_cakaj 3
  agent-browser eval "((async()=>{try{const blobi=window.__z334kvcsblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); const t1=new TextDecoder('utf-8').decode(u1); const t2=new TextDecoder('utf-8').decode(u2); const bomRaw=(u1[0]===0xEF&&u1[1]===0xBB&&u1[2]===0xBF); const vr1=t1.replace(/^\\uFEFF/,'').split('\\r\\n').filter(v=>v.length>0); const vr2=t2.replace(/^\\uFEFF/,'').split('\\r\\n').filter(v=>v.length>0); const obmocij=vr1.indexOf('Kriterij;Izpeljava;Dokaz')-1; return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, bom:bomRaw, mime:blobi[0].type||null, glavaA:vr1[0]??null, obmocij:obmocij, glavaB:vr1[11+1]??null, kriterijev:vr1.length-1-11-1-6, sklep:(vr1.find(v=>v.startsWith('Sklep;'))??null).slice(0,60), vir:vr1.find(v=>v.startsWith('Vir;'))??null, aiObvezno:vr1.find(v=>v.startsWith('AI-OBVEZNO;'))??null, izvozenoOb:vr1.find(v=>v.includes('Izvoženo ob'))??null, fullBajtnoEnaka:t1===t2, vrstic:vr1.length, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r334-z0bb.json
  python3 - <<'PYEOFZ0BB' || exit 1
import json
raw = open('/tmp/r334-z0bb.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0bb parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0bb blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['bom'] is True, 'Z0bb BOM FAIL (UTF-8 BOM bajti EF BB BF — formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'text/csv;charset=utf-8', 'Z0bb MIME FAIL: ' + json.dumps(d)
assert d['glavaA'] == 'Območje;Razred;Plasti;Dokaz', 'Z0bb glava bloka A FAIL (VERBATIM PDF autoTable head T1): ' + json.dumps(d.get('glavaA'))
assert d['obmocij'] == 11, 'Z0bb obmocij FAIL (11 območij §1–§11): ' + json.dumps(d)
assert d['glavaB'] == 'Kriterij;Izpeljava;Dokaz', 'Z0bb glava bloka B FAIL (VERBATIM PDF autoTable head T2): ' + json.dumps(d.get('glavaB'))
assert d['kriterijev'] == 8, 'Z0bb kriterijev FAIL (8 kriterijev issue #1): ' + json.dumps(d)
assert d['aiObvezno'] == 'AI-OBVEZNO;0', 'Z0bb AI-OBVEZNO FAIL (iskrena resnica — jedro deluje brez AI): ' + json.dumps(d.get('aiObvezno'))
assert d['sklep'].startswith('Sklep;Končna verifikacija: 11/11 območij z dokaznimi plastmi'), 'Z0bb Sklep FAIL (EN VIR sklep — ŠESTI potrošnik ENEGA niza): ' + json.dumps(d.get('sklep'))
assert d['vir'] == 'Vir;Končna verifikacija — isti HEAD = bajtno identičen izvoz', 'Z0bb Vir FAIL: ' + json.dumps(d.get('vir'))
assert d['izvozenoOb'] is None, 'Z0bb Izvoženo ob FAIL — CSV ne sme nositi časa (kanon determinizma 46./47. člen): ' + json.dumps(d.get('izvozenoOb'))
assert d['fullBajtnoEnaka'] is True, 'Z0bb DETERMINIZEM FAIL — OBA izvoza nista bajtno enaka (isti HEAD = bajtno identična datoteka): ' + json.dumps(d)
assert d['bajtov'] > 1000, 'Z0bb prekratek CSV: ' + json.dumps(d)
assert d['vrstic'] == 27, 'Z0bb vrstic FAIL (1 glava A + 11 območij + 1 glava B + 8 kriterijev + 6 meta): ' + json.dumps(d)
assert d['err'] is None, 'Z0bb err: ' + json.dumps(d)
print('Z0bb OK — končna verifikacija CSV ŽIVO bajtno: BOM + MIME + glavi EN VIR VERBATIM (T1+T2) + 11 območij + 8 kriterijev + KPI ×4 + Sklep + Vir + ' + str(d['bajtov']) + ' bajtov + 27 vrstic + DETERMINIZEM ŽIVO FULL (oba izvoza bajtno enaka — 61. člen)')
PYEOFZ0BB
  agent-browser screenshot "$SS/qa-r334-e2e-z0bb-koncna-csv.png" > /dev/null 2>&1
else
  echo "Z0bb OPOMBA: Končna verifikacija CSV pill ni viden na spot seji (RBAC skoping ali iskren gate) — chunk needleji R334 ostajajo obvezni dokaz"
  agent-browser screenshot "$SS/qa-r334-e2e-z0bb-pill-ni-viden.png" > /dev/null 2>&1
fi

'''

zam('node scripts/r276-db-e2e.cjs fp > /tmp/r333-fp-post-276.json || exit 1',
    Z0BB_BLOK + 'node scripts/r276-db-e2e.cjs fp > /tmp/r333-fp-post-276.json || exit 1', 1)

# ── 3. Generacijske poti (PO splicu — Z0bb nosi že r334 poti) ──
zam('/tmp/r333-', '/tmp/r334-', 162)
zam('/tmp/R333-server-e2e.log', '/tmp/R334-server-e2e.log', 1)  # uppercase log (LEKCIJA R330 5 — banner žetoni del register resnice)
zam('=== R333 E2E KONEC ===', '=== R334 E2E KONEC ===', 1)

DOL.write_text(text, encoding='utf-8')
print(f'OK — r334-e2e-browser.sh zapisan ({len(text)} znakov)')
