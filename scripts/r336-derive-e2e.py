#!/usr/bin/env python3
# R336 — derive r336-e2e-browser.sh iz r335 generacije. VSAKA zamenjava je
# NATANKO ena-n-točkovna (fail-closed; LEKCIJA R312: štetje na POJAVITVE).
# Transformacije:
#   1. /tmp/r335- → /tmp/r336- (vse pojavitve) + qa-r335- → qa-r336-
#   2. Glava: Z0bd opis (63. člen sistem zdravje CSV ŽIVO — brez seeda,
#      READ-ONLY izvoz seje; DETERMINIZEM ŽIVO FULL — brez-časa kanon)
#   3. NOV Z0bd blok PO Z0bc (pred ODTIS post-checks)
#   4. Footer R335 → R336
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r335-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r336-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Poti ──
# POJAVITVENO štetje (LEKCIJA R312): r334→r335 je preimenoval 164 pojavitve,
# nato je Z0bc blok DODAL 2 novo ('/tmp/r335-z0bc.json' — redirect + open v
# python heredocu) → r335 generation = 166; qa-r335-: 2 dedovina + 2 Z0bc
# screenshot imena = 4.
zam('/tmp/r335-', '/tmp/r336-', 166)
zam('qa-r335-', 'qa-r336-', 4)
zam('/tmp/R335-server-e2e.log', '/tmp/R336-server-e2e.log')

# ── 2. Glava: Z0bd opis ──
zam('''#         + DETERMINIZEM ŽIVO: vrstice BREZ 'Izvoženo ob' bajtno enake med
#         obema izvozoma (podatkovni izvoz z referenčnim mesecem — kanon
#         R330–R333);
#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO''',
'''#         + DETERMINIZEM ŽIVO: vrstice BREZ 'Izvoženo ob' bajtno enake med
#         obema izvozoma (podatkovni izvoz z referenčnim mesecem — kanon
#         R330–R333);
#   Z0bd: SISTEM ZDRAVJE CSV ŽIVO (R336 NOVO — 63. člen issue #1, CSV brat
#         zaslona SistemZdravjeCard): BREZ seeda — READ-ONLY izvoz SEJE
#         (ZERO-MUTACIJA trivialno — izvoz NIČ ne piše); dispatch vodja →
#         SistemZdravjeCard CSV pill [aria-label="Izvozi sistem zdravje kot
#         CSV"] → blob ujet prek URL.createObjectURL patcha (Z0bb/Z0bc kanon)
#         ×2 klikov → BAJTNI dokaz v brskalniku: UTF-8 BOM (RAW bajti EF BB
#         BF) + MIME text/csv + glava ('Zaporedna preverba;Odziv (ms)' —
#         kanon R136) + meritve 1..n (ISTI surovi ms kot trak palic) + Baza
#         ('Baza;Baza odgovarja' — BAZA_NIZ EN VIR, ISTI niz kot žeton) +
#         Zgrajeno (ISTI klic zigIzpis kot kartica — fail-soft vzorec R185) +
#         statistika (Najhitrejša/Povprečna/Najpočasnejša (ms) — EN VIR
#         odziviStatistika) + Vir citiran (podpičje → RFC 4180 — LEKCIJA
#         R334 2) + BREZ 'Izvoženo ob' (brez-časa kanon R334/R336 — statičen
#         izvoz te seje) + DETERMINIZEM ŽIVO FULL: OBA izvoza BAJTNO enaka
#         (celotna datoteka — močnejši dokaz kot podatkovna-bajtna enakost
#         R330–R335);
#   Z0at: IZVOZ DNEVNEGA PREGLEDA VODJE KOT PDF ŽIVO''')

# ── 3. Z0bd blok PO Z0bc (pred ODTIS post-checks) ──
zam('''  agent-browser screenshot "$SS/qa-r336-e2e-z0bc-pill-ni-viden.png" > /dev/null 2>&1
fi

node scripts/r276-db-e2e.cjs fp > /tmp/r336-fp-post-276.json || exit 1''',
'''  agent-browser screenshot "$SS/qa-r336-e2e-z0bc-pill-ni-viden.png" > /dev/null 2>&1
fi

echo "=== Z0bd: SISTEM ZDRAVJE CSV ŽIVO (R336 — 63. člen issue #1: CSV brat zaslona SistemZdravjeCard; brez seeda — READ-ONLY izvoz seje; ZERO-MUTACIJA trivialno) ==="
# EN VIR resnica = seja zgodovina zdravja (modul zdravje-zgodovina — ISTI
# vir kot trak palic; kartica jo napaja z vsako uspešno preverbo /api/public/
# health) — E2E NE seje nič (izvoz je čista projekcija seje — NIČ DB
# pisanj); dispatch vodja → SistemZdravjeCard CSV pill [aria-label="Izvozi
# sistem zdravje kot CSV"] → blob ujet prek URL.createObjectURL patcha
# (Z0bb/Z0ba/Z0bc kanon) ×2 klikov → BAJTNI dokaz v brskalniku: BOM raw +
# MIME + glava + meritve + Baza EN VIR + Zgrajeno + statistika EN VIR + Vir
# citiran + brez 'Izvoženo ob' + DETERMINIZEM ŽIVO FULL (oba izvoza iz
# ISTEGA stanja seje — brez-časa kanon R334/R336).
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
if eb_pocakaj_na "(()=>{return !![...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'')==='Izvozi sistem zdravje kot CSV');})()" 8; then
  agent-browser eval "(()=>{window.__z336zdrblobi=[]; const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ try{ if(typeof Blob!=='undefined' && b instanceof Blob) window.__z336zdrblobi.push(b); }catch(e){} return orig(b); }; return 'patched';})()" > /dev/null 2>&1
  eb_klik_gumb "Izvozi sistem zdravje kot CSV"
  eb_cakaj 2
  eb_klik_gumb "Izvozi sistem zdravje kot CSV"
  eb_cakaj 2
  agent-browser eval "((async()=>{try{const blobi=window.__z336zdrblobi??[]; if(blobi.length<2) return JSON.stringify({napaka:'pričakovana 2 bloba, dobljeno '+blobi.length, err:window.__err??null}); const u1=new Uint8Array(await blobi[0].arrayBuffer()); const u2=new Uint8Array(await blobi[1].arrayBuffer()); const t1=new TextDecoder('utf-8').decode(u1); const t2=new TextDecoder('utf-8').decode(u2); const bomRaw=(u1[0]===0xEF&&u1[1]===0xBB&&u1[2]===0xBF); const vr1=t1.replace(/^\\uFEFF/,'').split('\\r\\n').filter(v=>v.length>0); return JSON.stringify({stBlobov:blobi.length, bajtov:u1.length, bom:bomRaw, mime:blobi[0].type||null, glava:vr1[0]??null, prvaMeritev:vr1[1]??null, baza:(vr1.find(v=>v==='Baza;Baza odgovarja')??null), zgrajeno:(vr1.find(v=>v.startsWith('Zgrajeno;'))??null), najhitrejsa:(vr1.find(v=>v.startsWith('Najhitrejša (ms);'))??null), povprecna:(vr1.find(v=>v.startsWith('Povprečna (ms);'))??null), najpocasnejsa:(vr1.find(v=>v.startsWith('Najpočasnejša (ms);'))??null), vir:(vr1.find(v=>v.startsWith('Vir;'))??null), brezIzvozenoOb:!t1.includes('Izvoženo ob'), determinizemFull:(t1===t2), vrstic:vr1.length, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})())" 2>&1 | tail -1 > /tmp/r336-z0bd.json
  python3 - <<'PYEOFZ0BD' || exit 1
import json
raw = open('/tmp/r336-z0bd.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0bd parse FAIL: ' + json.dumps(d)
assert d['stBlobov'] == 2, 'Z0bd blobi FAIL (2 klika = 2 bloba): ' + json.dumps(d)
assert d['bom'] is True, 'Z0bd BOM FAIL (UTF-8 BOM bajti EF BB BF — formatna resnica): ' + json.dumps(d)
assert d['mime'] == 'text/csv;charset=utf-8', 'Z0bd MIME FAIL: ' + json.dumps(d)
assert d['glava'] == 'Zaporedna preverba;Odziv (ms)', 'Z0bd glava FAIL (kanon R136): ' + json.dumps(d.get('glava'))
assert d['prvaMeritev'] is not None and d['prvaMeritev'].startswith('1;'), 'Z0bd meritve FAIL (zaporedna 1..n — ISTI izpisi kot trak palic): ' + json.dumps(d.get('prvaMeritev'))
assert d['baza'] == 'Baza;Baza odgovarja', 'Z0bd Baza FAIL (BAZA_NIZ EN VIR — ISTI niz kot žeton): ' + json.dumps(d.get('baza'))
assert d['zgrajeno'] is not None and d['zgrajeno'].startswith('Zgrajeno;'), 'Z0bd Zgrajeno FAIL (ISTI klic zigIzpis kot kartica — fail-soft R185): ' + json.dumps(d.get('zgrajeno'))
assert d['najhitrejsa'] is not None and d['najhitrejsa'].startswith('Najhitrejša (ms);'), 'Z0bd statistika FAIL (EN VIR odziviStatistika): ' + json.dumps(d.get('najhitrejsa'))
assert d['povprecna'] is not None and d['povprecna'].startswith('Povprečna (ms);'), 'Z0bd povprečna FAIL: ' + json.dumps(d.get('povprecna'))
assert d['najpocasnejsa'] is not None and d['najpocasnejsa'].startswith('Najpočasnejša (ms);'), 'Z0bd najpočasnejša FAIL: ' + json.dumps(d.get('najpocasnejsa'))
assert d['vir'] is not None and d['vir'].startswith('Vir;"Sistem zdravje'), 'Z0bd Vir FAIL (podpičje znotraj → RFC 4180 citiranje — LEKCIJA R334 2): ' + json.dumps(d.get('vir'))
assert d['brezIzvozenoOb'] is True, 'Z0bd brez-časa kanon FAIL (nič Izvoženo ob — kanon R334/R336, statičen izvoz te seje): ' + json.dumps(d)
assert d['determinizemFull'] is True, 'Z0bd DETERMINIZEM ŽIVO FULL FAIL — OBA izvoza nista bajtno enaka (brez-časa kanon R334/R336): ' + json.dumps(d)
assert d['bajtov'] > 100, 'Z0bd prekratek CSV: ' + json.dumps(d)
assert d['vrstic'] >= 8, 'Z0bd vrstic FAIL (glava + ≥1 meritev + prazna + Baza + Zgrajeno + statistika ×3 + Vir): ' + json.dumps(d)
assert d['err'] is None, 'Z0bd err: ' + json.dumps(d)
print('Z0bd OK — sistem zdravje CSV ŽIVO bajtno: BOM + MIME + glava + meritve (ISTI ms kot trak) + Baza EN VIR + Zgrajeno + statistika EN VIR + Vir citiran + brez Izvoženo ob + ' + str(d['bajtov']) + ' bajtov + ' + str(d['vrstic']) + ' vrstic + DETERMINIZEM ŽIVO FULL (63. člen)')
PYEOFZ0BD
  agent-browser screenshot "$SS/qa-r336-e2e-z0bd-sistem-zdravje-csv.png" > /dev/null 2>&1
else
  echo "Z0bd OPOMBA: sistem zdravje CSV pill ni viden na spot seji (RBAC skoping, zgodovina še prazna ali iskren gate) — chunk needleji R336 ostajajo obvezni dokaz"
  agent-browser screenshot "$SS/qa-r336-e2e-z0bd-pill-ni-viden.png" > /dev/null 2>&1
fi

node scripts/r276-db-e2e.cjs fp > /tmp/r336-fp-post-276.json || exit 1''')

# ── 4. Footer ──
zam('echo "=== R335 E2E KONEC ==="', 'echo "=== R336 E2E KONEC ==="')

DOL.write_text(text, encoding='utf-8')
print('r336-e2e-browser.sh: OK (derive iz r335)')
