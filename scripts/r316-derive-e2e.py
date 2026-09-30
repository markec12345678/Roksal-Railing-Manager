#!/usr/bin/env python3
# R316 — derive r316-e2e-browser.sh iz r315-e2e-browser.sh (generacijski
# vzorec). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed: napačno
# število zadetkov → izpisek + exit 1).
# Transformacije:
#   1. Glava: NOV Z0an opomba (izvoz končne verifikacije kot JSON — 46. člen)
#   2. Generacijske poti: /tmp/r315- → /tmp/r316-, sekret, marker id,
#      screenshot qa-r315 → qa-r316, server log, E2E KONEC label
#   3. Z0an blok: splice PO Z0am screenshot vrstici (izvoz JSON ŽIVO —
#      shema/števci/sklep EN VIR + DETERMINIZEM: dva izvoza bajtno enaka)
#   4. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r315-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r316-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0an opomba (pred Z0am vnosom) ──
zam('#   Z0am: KONČNA VERIFIKACIJA ŽIVO (R315 NOVO — 45. člen issue #1, D7):',
    '#   Z0an: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT JSON ŽIVO (R316 NOVO —\n'
    '#         46. člen issue #1, IZVOZI družina): gumb v končna-verifikacija\n'
    '#         bloku → deterministični JSON (shema + 11 območij + 8 kriterijev\n'
    '#         + sklep WYSIWYG) + DETERMINIZEM ŽIVO (dva izvoza bajtno enaka)\n'
    '#         — EN VIR izvoz, ZERO-MUTACIJA;\n'
    '#   Z0am: KONČNA VERIFIKACIJA ŽIVO (R315 NOVO — 45. člen issue #1, D7):')

# ── 2. Generacijske poti + oznake (PRED spliceom — Z0an nosi r316 poti) ──
# 128 = /tmp/r315- POJAVITVE (ne vrstice! grep -c šteje vrstice — lekcija
# R312/R314/R315 tretjič/četrtič potrjena: kalibracija na pojavitve)
zam('/tmp/r315-', '/tmp/r316-', 128)
zam('r315-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r316-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('/tmp/R315-server-e2e.log', '/tmp/R316-server-e2e.log', 1)
zam('e2e-r315-ne-obstojeci-id', 'e2e-r316-ne-obstojeci-id', 1)
zam('echo "=== R315 E2E KONEC ==="', 'echo "=== R316 E2E KONEC ==="', 1)
zam('qa-r315', 'qa-r316', 2)

# ── 3. Z0an blok: splice PO (preimenovani) Z0am screenshot vrstici ──
SIDRO = 'agent-browser screenshot "$SS/qa-r316-e2e-z0am-verifikacija.png" > /dev/null 2>&1\n'
Z0AN = '''agent-browser screenshot "$SS/qa-r316-e2e-z0am-verifikacija.png" > /dev/null 2>&1

echo "=== Z0an: IZVOZ POROČILA KONČNE VERIFIKACIJE KOT JSON ŽIVO (R316 — 46. člen issue #1: IZVOZI družina; EN VIR deterministični izvoz; ZERO-MUTACIJA) ==="
# Končna verifikacija blok → gumb [aria-label="Izvozi poročilo končne
# verifikacije kot JSON"] → blob ujet prek URL.createObjectURL patcha
# (eb_csv_capture kanon) → parse v brskalniku → shema/števci/sklep = ISTA
# EN VIR resnica kot zaslon (Z0am) + vitest (r316-koncna-verifikacija-json).
# DETERMINIZEM ŽIVO: dva izvoza = bajtno identična vsebina.
# ZERO-MUTACIJA: samo klik izvoza (nič db zapisa).
agent-browser eval "(()=>{window.__kvjson1=null; window.__kvjson2=null; return 'reset';})()" > /dev/null 2>&1
eb_csv_capture kvjson1
eb_klik_gumb "Izvozi poročilo končne verifikacije kot JSON"
eb_pocakaj_na "(()=>{return typeof window.__kvjson1==='string' && window.__kvjson1.length>100;})()" 12
eb_csv_capture kvjson2
eb_klik_gumb "Izvozi poročilo končne verifikacije kot JSON"
eb_pocakaj_na "(()=>{return typeof window.__kvjson2==='string' && window.__kvjson2.length>100;})()" 12
agent-browser eval "(()=>{try{const a=window.__kvjson1, b=window.__kvjson2; const p=JSON.parse(a); const plastiVsota=Object.values(p.poPlasti||{}).reduce((x,y)=>x+y,0); const stPlastiVsota=(p.obmocja||[]).reduce((x,o)=>x+(o.stPlasti||0),0); return JSON.stringify({bajtnoEnako:a===b, shema:p.shema, verzijaSheme:p.verzijaSheme, stObmocij:p.stObmocij, stObmocijZDokazi:p.stObmocijZDokazi, stKriterijev:(p.kriteriji||[]).length, sklepGlava:(p.sklep||'').includes('Končna verifikacija: 11/11 območij z dokaznimi plastmi'), sklepAI:(p.sklep||'').includes('AI-OBVEZNO: 0 — jedro deluje brez AI'), kljuci:Object.keys(p).join('|'), zamik:a.startsWith('{\\n  \\"shema\\"'), posixKonec:a.endsWith('\\n'), plastiVsota, stPlastiVsota, err:window.__err??null});}catch(e){return JSON.stringify({napaka:String(e), err:window.__err??null});}})()" 2>&1 | tail -1 > /tmp/r316-z0an.json
python3 - <<'PYEOFZ0AN' || exit 1
import json
raw = open('/tmp/r316-z0an.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert 'napaka' not in d, 'Z0an JSON parse FAIL: ' + json.dumps(d)
assert d['bajtnoEnako'] is True, 'Z0an DETERMINIZEM FAIL — dva izvoza nista bajtno enaka'
assert d['shema'] == 'roksal-koncna-verifikacija' and d['verzijaSheme'] == 1, 'Z0an shema FAIL: ' + json.dumps(d)
assert d['stObmocij'] == 11 and d['stObmocijZDokazi'] == 11, 'Z0an območja FAIL: ' + json.dumps(d)
assert d['stKriterijev'] == 8, 'Z0an kriteriji FAIL: ' + json.dumps(d)
assert d['sklepGlava'] and d['sklepAI'], 'Z0an sklep WYSIWYG FAIL: ' + json.dumps(d)
assert d['kljuci'] == 'shema|verzijaSheme|sklep|stObmocij|stObmocijZDokazi|stKriterijev|stAiObveznih|poPlasti|obmocja|kriteriji', 'Z0an vrstni red ključev FAIL (determinizem serializacije): ' + json.dumps(d)
assert d['zamik'] and d['posixKonec'], 'Z0an oblika FAIL (2-presledkov zamik + POSIX konec): ' + json.dumps(d)
assert d['plastiVsota'] == d['stPlastiVsota'] and d['plastiVsota'] > 0, 'Z0an plasti vsota FAIL: ' + json.dumps(d)
assert d['err'] is None, 'Z0an err: ' + json.dumps(d)
print('Z0an OK — izvoz končne verifikacije JSON ŽIVO: shema + 11 območij + 8 kriterijev + sklep WYSIWYG + plasti vsota ' + str(d['plastiVsota']) + ' + DETERMINIZEM (dva izvoza bajtno enaka) (46. člen; ZERO-MUTACIJA)')
PYEOFZ0AN
agent-browser screenshot "$SS/qa-r316-e2e-z0an-izvoz-json.png" > /dev/null 2>&1
'''
n = text.count(SIDRO)
if n != 1:
    print(f'FAIL-CLOSED: SIDRO (Z0am screenshot) — najdeno {n}×, pričakovano 1×')
    sys.exit(1)
text = text.replace(SIDRO, Z0AN)

# ── 4. Izhodna-stran asercija (LEKCIJA R310 5/6: vhod + IZHOD) ──
assert 'set -u' in text, 'izhodna asercija: set -u izginil (splice pokvaril strukturo)'
assert text.count('=== Z0an:') == 1, 'izhodna asercija: Z0an telo ni točno 1×'
assert '/tmp/r315-' not in text, 'izhodna asercja: /tmp/r315- ostanki'
assert '/tmp/r316-' in text, 'izhodna asercja: /tmp/r316- poti manjkajo'
assert 'PYEOFZ0AN' in text, 'izhodna asercija: Z0an heredoc manjka'

DOL.write_text(text, encoding='utf-8')
print(f'OK — {DOL.name} zapisan ({len(text.splitlines())} vrstic)')
