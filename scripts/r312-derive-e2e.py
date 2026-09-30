#!/usr/bin/env python3
# R312 — derive r312-e2e-browser.sh iz r311-e2e-browser.sh (generacijski
# vzorec). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed: napačno
# število zadetkov → izpisek + exit 1).
# Transformacije:
#   1. Glava: + Z0ak vrstica (meritve zmogljivosti dokaz)
#   2. NOV Z0ak blok: ZMOGLJIVOST DOKAZ ŽIVO (42. člen — blok + 8 meritev z
#      realnimi časi + vsi izhodi preverjeni + sklep WYSIWYG; ZERO-MUTACIJA
#      — samo branje DOM; meritev teče v brskalniku po useEffect)
#   3. Generacijske poti: /tmp/r311- → /tmp/r312-, sekret, marker id
#   4. Izhodna stran asercija (LEKCIJA R310 5/6): datoteka mora biti celovita
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r311-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r312-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0ak vrstica pred Z0aj ──
zam('#   Z0aj: AI RABA DOKAZ ŽIVO (R311 NOVO — 41. člen issue #1): vodja blok',
    '#   Z0ak: ZMOGLJIVOST DOKAZ ŽIVO (R312 NOVO — 42. člen issue #1): vodja\n#         blok [zmogljivost-dokaz] — naslov + 8 realnih meritev (min/mediana/\n#         max ms, vsi izhodi preverjeni) + sklep WYSIWYG (ZERO-MUTACIJA);\n#   Z0aj: AI RABA DOKAZ ŽIVO (R311 — 41. člen issue #1): vodja blok')

# ── 2. NOV Z0ak blok — vstavljen PRED Z0ah ──
Z0AK = '''
echo "=== Z0ak: ZMOGLJIVOST DOKAZ NA ZASLONU ŽIVO (R312 — 42. člen issue #1: Deliverable 6; EN VIR WYSIWYG; ZERO-MUTACIJA) ==="
# Vodja pregled → meritve zmogljivosti blok [zmogljivost-dokaz]: naslov +
# 8 realnih meritev (najmanj/mediana/največ ms — resnično izvajanje jedra na
# fiksnih vhodih, vsak izhod preverjen) + iskren SSR stan → useEffect izris.
# Admin seja → vodja dostopen; ZERO-MUTACIJA: samo branje DOM — nič fetch
# mutacij, odtis ostane. Meritev je strojno odvisna (iskrenost!) — testi
# preverjajo STRUKTURO in NIKOLI natančnih časov.
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
NAJDEN_Z0AK=0
for poskus in 1 2 3 4 5; do
  eb_cakaj 3
  agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\\"zmogljivost-dokaz\\"]'); const v=b?b.querySelectorAll('[data-testid=\\"zmogljivost-vrstica\\"]').length:0; return v===8 ? 'najden' : 'ni';})()" 2>&1 | tail -1 | grep -q najden && { NAJDEN_Z0AK=1; break; }
done
[ "$NAJDEN_Z0AK" = "1" ] || { echo "Z0ak FAIL: zmogljivost-dokaz blok z 8 meritvami ni izrisan (useEffect meritev teče? dispatch?)"; exit 1; }
agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\\"zmogljivost-dokaz\\"]'); const s=document.querySelector('[data-testid=\\"zmogljivost-sklep\\"]'); const vr=[...document.querySelectorAll('[data-testid=\\"zmogljivost-vrstica\\"]')].map(x=>x.textContent||''); const num=/\\\\d+(\\\\.\\\\d+)? \\\\/ \\\\d+(\\\\.\\\\d+)? \\\\/ \\\\d+(\\\\.\\\\d+)? ms/; return JSON.stringify({naslov:b?.getAttribute('aria-label')??null, vrstice:vr.length, vsePreverjene:vr.every(t=>t.includes('· vsi izhodi preverjeni')), casi:vr.every(t=>num.test(t)), calculatorVrstica:vr.some(t=>t.includes('Kalkulator razmikov letvic')), aiVrstica:vr.some(t=>t.includes('AI raba pregled')), sklep:s?.textContent??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r312-z0ak.json
python3 - <<'PYEOFZ0AK' || exit 1
import json, re
raw = open('/tmp/r312-z0ak.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0ak err: ' + json.dumps(d)
assert d['naslov'] == 'Meritve zmogljivosti jedra', 'Z0ak naslov FAIL: ' + json.dumps(d)
assert d['vrstice'] == 8, 'Z0ak: pričakovano 8 meritev, dobljeno ' + json.dumps(d)
assert d['vsePreverjene'], 'Z0ak: vrstice brez preverbe izhoda: ' + json.dumps(d)
assert d['casi'], 'Z0ak: vrstica brez realnih časov (min/mediana/max ms): ' + json.dumps(d)
assert d['calculatorVrstica'] and d['aiVrstica'], 'Z0ak: ključni vrstici manjkata: ' + json.dumps(d)
sk = d['sklep'] or ''
assert re.match(r'Merjeno na tej napravi: 8 operacij · 1800 iteracij · vsi izhodi preverjeni', sk), 'Z0ak sklep struktura FAIL: ' + json.dumps(d)
assert 'strojno odvisna' in sk and 'struktura in izhodi deterministični' in sk, 'Z0ak sklep iskrenost FAIL: ' + json.dumps(d)
print('Z0ak OK — meritve zmogljivosti ŽIVO: 8 realnih meritev × (min/mediana/max ms) + vsi izhodi preverjeni + sklep WYSIWYG (Deliverable 6 na zaslonu; ZERO-MUTACIJA)')
PYEOFZ0AK
agent-browser screenshot "$SS/qa-r312-e2e-z0ak-zmogljivost.png" > /dev/null 2>&1

echo "=== Z0ah: MIGRACIJSKI VAL ŽIVO (R310 — EN VIR I/O meja api-telo; 26 handlerjev; ZERO-MUTACIJA) ==="'''
zam('echo "=== Z0ah: MIGRACIJSKI VAL ŽIVO (R310 — EN VIR I/O meja api-telo; 26 handlerjev; ZERO-MUTACIJA) ==="',
    Z0AK,
    1)

# ── 3. Generacijske poti + oznake ──
zam('/tmp/r311-', '/tmp/r312-', 122)
zam('r311-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r312-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('/tmp/R311-server-e2e.log', '/tmp/R312-server-e2e.log', 1)
zam('echo "=== Z0aj: AI RABA DOKAZ NA ZASLONU ŽIVO (R311 — 41. člen issue #1: Deliverable 5 na zaslonu; EN VIR WYSIWYG; ZERO-MUTACIJA) ==="',
    'echo "=== Z0aj: AI RABA DOKAZ NA ZASLONU ŽIVO (R311 — 41. člen issue #1: Deliverable 5 na zaslonu; EN VIR WYSIWYG; ZERO-MUTACIJA; regresija) ==="', 1)
zam('echo "=== R311 E2E KONEC ==="', 'echo "=== R312 E2E KONEC ==="', 1)

# ── 4. Izhodna asercija (LEKCIJA R310 5/6 — vnosne ne pokrijejo izhoda) ──
assert '/tmp/r311-' not in text, 'IZHOD: /tmp/r311- ostanki'
assert 'r311-e2e-lokalni-sekret' not in text, 'IZHOD: sekret ostanek'
assert 'Z0ak' in text and 'PYEOFZ0AK' in text, 'IZHOD: Z0ak blok manjka'
assert text.count('PYEOFZ0AK') == 2, 'IZHOD: Z0ak heredoc marker (odpri+zapri)'
DOL.write_text(text, encoding='utf-8')
print('OK: r312-e2e-browser.sh napisan (' + str(len(text.splitlines())) + ' vrstic)')
