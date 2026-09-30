#!/usr/bin/env python3
# R315 — derive r315-e2e-browser.sh iz r314-e2e-browser.sh (generacijski
# vzorec). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed: napačno
# število zadetkov → izpisek + exit 1).
# Transformacije:
#   1. Glava: NOV Z0am opomba (končna verifikacija ŽIVO — 45. člen / D7)
#   2. Z0am blok: splice PO Z0al screenshot vrstici (naslov + 11 območij +
#      plast chips + 8 kriterijev + sklep WYSIWYG 'vitest, build-needleji,
#      E2E ŽIVO, prod-qa, smoke · AI-OBVEZNO: 0')
#   3. Generacijske poti: /tmp/r314- → /tmp/r315-, sekret, marker id,
#      screenshot qa-r314 → qa-r315, server log, E2E KONEC label
#   4. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r314-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r315-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0am opomba (pred Z0al vnosom) ──
zam('#   Z0al: AUDIT DOKAZ ŽIVO (R314 NOVO — 44. člen issue #1, Deliverable 4):',
    '#   Z0am: KONČNA VERIFIKACIJA ŽIVO (R315 NOVO — 45. člen issue #1, D7):\n'
    '#         vodja blok [koncna-verifikacija-dokaz] — naslov + 11 območij s\n'
    '#         plast chips (vitest · build-needleji · E2E ŽIVO · prod-qa ·\n'
    '#         smoke) + 8 sprejemnih kriterijev z izpeljavo/dokazom + sklep\n'
    '#         WYSIWYG (EN VIR — ZERO-MUTACIJA);\n'
    '#   Z0al: AUDIT DOKAZ ŽIVO (R314 NOVO — 44. člen issue #1, Deliverable 4):')

# ── 3. Generacijske poti + oznake (PRED spliceom — Z0am nosi r315 poti) ──
# 126 = 124 (r313→r314 osnova) + 2 (r314 Z0al blok: eval redirect + python read — LEKCIJA R312: kalibracija na pojavitve)
zam('/tmp/r314-', '/tmp/r315-', 126)
zam('r314-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r315-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('/tmp/R314-server-e2e.log', '/tmp/R315-server-e2e.log', 1)
zam('e2e-r314-ne-obstojeci-id', 'e2e-r315-ne-obstojeci-id', 1)
zam('echo "=== R314 E2E KONEC ==="', 'echo "=== R315 E2E KONEC ==="', 1)
zam('agent-browser screenshot "$SS/qa-r314-e2e-z0al-audit.png" > /dev/null 2>&1',
    'agent-browser screenshot "$SS/qa-r315-e2e-z0al-audit.png" > /dev/null 2>&1', 1)

# ── 2. Z0am blok: splice PO (preimenovani) Z0al screenshot vrstici ──
SIDRO = 'agent-browser screenshot "$SS/qa-r315-e2e-z0al-audit.png" > /dev/null 2>&1\n'
Z0AM = '''agent-browser screenshot "$SS/qa-r315-e2e-z0al-audit.png" > /dev/null 2>&1

echo "=== Z0am: KONČNA VERIFIKACIJA NA ZASLONU ŽIVO (R315 — 45. člen issue #1: Deliverable 7; EN VIR WYSIWYG; ZERO-MUTACIJA) ==="
# Vodja pregled → končna verifikacija blok [koncna-verifikacija-dokaz]:
# naslov + 11 območij s plast chips (5 plasti) + 8 kriterijev z izpeljavo +
# dokazom (poti na disku — verifikacija ne sme sanjati) + sklep WYSIWYG.
# Admin seja → vodja dostopen; ZERO-MUTACIJA: samo branje DOM.
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
NAJDEN_Z0AM=0
for poskus in 1 2 3 4 5; do
  eb_cakaj 3
  agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\\"koncna-verifikacija-dokaz\\"]'); const v=b?b.querySelectorAll('[data-testid=\\"koncna-verifikacija-vrstica\\"]').length:0; return v===11 ? 'najden' : 'ni';})()" 2>&1 | tail -1 | grep -q najden && { NAJDEN_Z0AM=1; break; }
done
[ "$NAJDEN_Z0AM" = "1" ] || { echo "Z0am FAIL: koncna-verifikacija-dokaz blok z 11 vrsticami ni izrisan (dispatch?)"; exit 1; }
agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\\"koncna-verifikacija-dokaz\\"]'); const s=document.querySelector('[data-testid=\\"koncna-verifikacija-sklep\\"]'); const vr=[...document.querySelectorAll('[data-testid=\\"koncna-verifikacija-vrstica\\"]')].map(x=>x.textContent||''); const kr=[...document.querySelectorAll('[data-testid=\\"koncna-verifikacija-kriterij\\"]')].map(x=>x.textContent||''); const chips=b?[...b.querySelectorAll('span[title^=\\"Plast: \\"]')].length:0; return JSON.stringify({naslov:b?.getAttribute('aria-label')??null, vrstice:vr.length, siVrstica:vr.some(t=>t.includes('§1 Photo/VIZ')), seVrstica:vr.some(t=>t.includes('§11 AI fallback architecture')), chips, stKriterijev:kr.length, prviKriterij:kr.some(t=>t.includes('vsako večje področje Roksala je audirano')), zadnjiKriterij:kr.some(t=>t.includes('dokumentacija jasno ločuje')), sklep:s?.textContent??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r315-z0am.json
python3 - <<'PYEOFZ0AM' || exit 1
import json
raw = open('/tmp/r315-z0am.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0am err: ' + json.dumps(d)
assert d['naslov'] == 'Končna verifikacija — dokazne plasti po območjih', 'Z0am naslov FAIL: ' + json.dumps(d)
assert d['vrstice'] == 11, 'Z0am: pričakovano 11 območij (§1–§11), dobljeno ' + json.dumps(d)
assert d['siVrstica'] and d['seVrstica'], 'Z0am: §1 in §11 vrstici manjkata: ' + json.dumps(d)
assert d['chips'] >= 11, 'Z0am: plast chips manjkajo (vsaj 1 na območje): ' + json.dumps(d)
assert d['stKriterijev'] == 8, 'Z0am: pričakovano 8 kriterijev, dobljeno ' + json.dumps(d)
assert d['prviKriterij'] and d['zadnjiKriterij'], 'Z0am: prvi/zadnji kriterij manjka: ' + json.dumps(d)
sk = d['sklep'] or ''
assert 'Končna verifikacija: 11/11 območij z dokaznimi plastmi' in sk, 'Z0am sklep glava FAIL: ' + json.dumps(d)
assert '8 sprejemnih kriterijev' in sk, 'Z0am kriterijev števec FAIL: ' + json.dumps(d)
assert 'plasti v dokazih: vitest, build-needleji, E2E ŽIVO, prod-qa, smoke' in sk, 'Z0am plasti FAIL: ' + json.dumps(d)
assert 'AI-OBVEZNO: 0 — jedro deluje brez AI' in sk, 'Z0am AI-OBVEZNO ničla FAIL: ' + json.dumps(d)
print('Z0am OK — končna verifikacija ŽIVO: 11 območij × plast chips + 8 kriterijev (izpeljava + dokaz) + sklep WYSIWYG (5 plasti · AI-OBVEZNO: 0) (Deliverable 7 na zaslonu; ZERO-MUTACIJA)')
PYEOFZ0AM
agent-browser screenshot "$SS/qa-r315-e2e-z0am-verifikacija.png" > /dev/null 2>&1
'''
n = text.count(SIDRO)
if n != 1:
    print(f'FAIL-CLOSED: Z0al screenshot sidro — najdeno {n}×, pričakovano 1×')
    sys.exit(1)
text = text.replace(SIDRO, Z0AM)

# ── 4. Izhodna asercija ──
assert '/tmp/r314-' not in text, 'IZHOD: /tmp/r314- ostanki'
assert 'r314-e2e-lokalni-sekret' not in text, 'IZHOD: sekret ostanek'
assert 'R314-server-e2e' not in text, 'IZHOD: server log ostanek'
assert 'Z0am' in text and 'koncna-verifikacija-dokaz' in text, 'IZHOD: Z0am blok manjka'
assert 'plasti v dokazih: vitest, build-needleji, E2E ŽIVO, prod-qa, smoke' in text, 'IZHOD: Z0am plasti assert manjka'
assert 'PYEOFZ0AM' in text, 'IZHOD: Z0am heredoc manjka'
assert 'qa-r315-e2e-z0am-verifikacija.png' in text, 'IZHOD: Z0am screenshot manjka'
DOL.write_text(text, encoding='utf-8')
print(f'OK: {DOL} ({len(text.splitlines())} vrstic)')
