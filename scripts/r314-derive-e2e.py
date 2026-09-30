#!/usr/bin/env python3
# R314 — derive r314-e2e-browser.sh iz r313-e2e-browser.sh (generacijski
# vzorec). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed: napačno
# število zadetkov → izpisek + exit 1).
# Transformacije:
#   1. Glava: NOV Z0al opomba (audit tabela ŽIVO — 44. člen / Deliverable 4)
#   2. Z0al blok: splice PO Z0ak screenshot vrstici (naslov + 11 območij +
#      razred/impl/dokaz + sklep WYSIWYG '10 DETERMINISTIČNO · 1 AI-OPCIJSKO
#      · AI-OBVEZNO: 0')
#   3. Generacijske poti: /tmp/r313- → /tmp/r314-, sekret, marker id,
#      screenshot qa-r313 → qa-r314, server log, E2E KONEC label
#   4. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r313-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r314-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0al opomba (pred Z0ak vnosom) ──
zam('#   Z0ak: ZMOGLJIVOST DOKAZ ŽIVO (R313 posodobljeno — 43. člen): vodja',
    '#   Z0al: AUDIT DOKAZ ŽIVO (R314 NOVO — 44. člen issue #1, Deliverable 4):\n'
    '#         vodja blok [avtomatizacija-dokaz] — naslov + 11 območij (§1–§11)\n'
    '#         z razredom + impl/dokaz števci + sklep WYSIWYG (EN VIR —\n'
    '#         ZERO-MUTACIJA);\n'
    '#   Z0ak: ZMOGLJIVOST DOKAZ ŽIVO (R313 posodobljeno — 43. člen): vodja')

# ── 3. Generacijske poti + oznake (PRED spliceom — Z0al nosi r314 poti) ──
zam('/tmp/r313-', '/tmp/r314-', 124)
zam('r313-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r314-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('/tmp/R313-server-e2e.log', '/tmp/R314-server-e2e.log', 1)
zam('e2e-r313-ne-obstojeci-id', 'e2e-r314-ne-obstojeci-id', 1)
zam('echo "=== R313 E2E KONEC ==="', 'echo "=== R314 E2E KONEC ==="', 1)
zam('agent-browser screenshot "$SS/qa-r313-e2e-z0ak-zmogljivost.png" > /dev/null 2>&1',
    'agent-browser screenshot "$SS/qa-r314-e2e-z0ak-zmogljivost.png" > /dev/null 2>&1', 1)

# ── 2. Z0al blok: splice PO (preimenovani) Z0ak screenshot vrstici ──
SIDRO = 'agent-browser screenshot "$SS/qa-r314-e2e-z0ak-zmogljivost.png" > /dev/null 2>&1\n'
Z0AL = '''agent-browser screenshot "$SS/qa-r314-e2e-z0ak-zmogljivost.png" > /dev/null 2>&1

echo "=== Z0al: AUDIT DOKAZ NA ZASLONU ŽIVO (R314 — 44. člen issue #1: Deliverable 4; EN VIR WYSIWYG; ZERO-MUTACIJA) ==="
# Vodja pregled → avtomatizacija audit blok [avtomatizacija-dokaz]: naslov +
# 11 območij (§1–§11) z razredom značko + impl/dokaz števci (izračunani iz
# EN VIR poti — tabela ne sme sanjati) + sklep WYSIWYG. Admin seja → vodja
# dostopen; ZERO-MUTACIJA: samo branje DOM — nič fetch mutacij.
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
NAJDEN_Z0AL=0
for poskus in 1 2 3 4 5; do
  eb_cakaj 3
  agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\\"avtomatizacija-dokaz\\"]'); const v=b?b.querySelectorAll('[data-testid=\\"avtomatizacija-vrstica\\"]').length:0; return v===11 ? 'najden' : 'ni';})()" 2>&1 | tail -1 | grep -q najden && { NAJDEN_Z0AL=1; break; }
done
[ "$NAJDEN_Z0AL" = "1" ] || { echo "Z0al FAIL: avtomatizacija-dokaz blok z 11 vrsticami ni izrisan (dispatch?)"; exit 1; }
agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\\"avtomatizacija-dokaz\\"]'); const s=document.querySelector('[data-testid=\\"avtomatizacija-sklep\\"]'); const vr=[...document.querySelectorAll('[data-testid=\\"avtomatizacija-vrstica\\"]')].map(x=>x.textContent||''); return JSON.stringify({naslov:b?.getAttribute('aria-label')??null, vrstice:vr.length, siVrstica:vr.some(t=>t.includes('§1 Photo/VIZ')), seVrstica:vr.some(t=>t.includes('§11 AI fallback architecture')), implDokaz:vr.every(t=>/impl · \\\\d+ dokazov/.test(t)), sklep:s?.textContent??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r314-z0al.json
python3 - <<'PYEOFZ0AL' || exit 1
import json
raw = open('/tmp/r314-z0al.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0al err: ' + json.dumps(d)
assert d['naslov'] == 'Avtomatizacija — audit po območjih', 'Z0al naslov FAIL: ' + json.dumps(d)
assert d['vrstice'] == 11, 'Z0al: pričakovano 11 območij (§1–§11), dobljeno ' + json.dumps(d)
assert d['siVrstica'] and d['seVrstica'], 'Z0al: §1 in §11 vrstici manjkata: ' + json.dumps(d)
assert d['implDokaz'], 'Z0al: vrstica brez impl/dokaz števcev (tabela ne sme sanjati): ' + json.dumps(d)
sk = d['sklep'] or ''
assert 'Audit območij: 11 (§1–§11)' in sk, 'Z0al sklep glava FAIL: ' + json.dumps(d)
assert 'DETERMINISTIČNO: 10' in sk, 'Z0al DETERMINISTICNO 10 FAIL: ' + json.dumps(d)
assert 'SDK: 0' in sk and 'SKRIPTA: 0' in sk, 'Z0al SDK/SKRIPTA ničli FAIL: ' + json.dumps(d)
assert 'AI-OPCIJSKO: 1' in sk, 'Z0al AI-OPCIJSKO 1 FAIL: ' + json.dumps(d)
assert 'AI-OBVEZNO: 0 — jedro deluje brez AI' in sk, 'Z0al AI-OBVEZNO ničla FAIL: ' + json.dumps(d)
print('Z0al OK — audit tabela ŽIVO: 11 območij × (razred + impl/dokaz števci) + sklep WYSIWYG (10 DETERMINISTIČNO · 1 AI-OPCIJSKO · AI-OBVEZNO: 0) (Deliverable 4 na zaslonu; ZERO-MUTACIJA)')
PYEOFZ0AL
agent-browser screenshot "$SS/qa-r314-e2e-z0al-audit.png" > /dev/null 2>&1
'''
n = text.count(SIDRO)
if n != 1:
    print(f'FAIL-CLOSED: Z0ak screenshot sidro — najdeno {n}×, pričakovano 1×')
    sys.exit(1)
text = text.replace(SIDRO, Z0AL)

# ── 4. Izhodna asercija ──
assert '/tmp/r313-' not in text, 'IZHOD: /tmp/r313- ostanki'
assert 'r313-e2e-lokalni-sekret' not in text, 'IZHOD: sekret ostanek'
assert 'R313-server-e2e' not in text, 'IZHOD: server log ostanek'
assert 'Z0al' in text and 'avtomatizacija-dokaz' in text, 'IZHOD: Z0al blok manjka'
assert 'AI-OBVEZNO: 0 — jedro deluje brez AI' in text, 'IZHOD: Z0al sklep assert manjka'
assert 'PYEOFZ0AL' in text, 'IZHOD: Z0al heredoc manjka'
assert 'qa-r314-e2e-z0al-audit.png' in text, 'IZHOD: Z0al screenshot manjka'
DOL.write_text(text, encoding='utf-8')
print(f'OK: {DOL} ({len(text.splitlines())} vrstic)')
