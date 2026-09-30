#!/usr/bin/env python3
# R313 — derive r313-e2e-browser.sh iz r312-e2e-browser.sh (generacijski
# vzorec). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed: napačno
# število zadetkov → izpisek + exit 1).
# Transformacije:
#   1. Glava: Z0ak opomba posodobljena (10 meritev — +2 PDF, 1808 iteracij)
#   2. Z0ak blok: vrstice 8 → 10, sklep '8 operacij · 1800 iteracij' →
#      '10 operacij · 1808 iteracij', + PDF vrstica assert (Deliverable 6
#      razširitev ŽIVO)
#   3. Generacijske poti: /tmp/r312- → /tmp/r313-, sekret, marker id
#   4. Izhodna-stran asercija (LEKCIJA R310 5/6)
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r312-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r313-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0ak opomba ──
zam('#   Z0ak: ZMOGLJIVOST DOKAZ ŽIVO (R312 NOVO — 42. člen issue #1): vodja\n#         blok [zmogljivost-dokaz] — naslov + 8 realnih meritev (min/mediana/\n#         max ms, vsi izhodi preverjeni) + sklep WYSIWYG (ZERO-MUTACIJA);',
    '#   Z0ak: ZMOGLJIVOST DOKAZ ŽIVO (R313 posodobljeno — 43. člen): vodja\n#         blok [zmogljivost-dokaz] — naslov + 10 realnih meritev (min/mediana/\n#         max ms, vsi izhodi preverjeni; +2 PDF meritve) + sklep WYSIWYG\n#         (ZERO-MUTACIJA);')

# ── 2. Z0ak blok: 8 → 10 vrstic + PDF assert ──
zam("return v===8 ? 'najden' : 'ni'", "return v===10 ? 'najden' : 'ni'", 1)
zam('[ "$NAJDEN_Z0AK" = "1" ] || { echo "Z0ak FAIL: zmogljivost-dokaz blok z 8 meritvami ni izrisan (useEffect meritev teče? dispatch?)"; exit 1; }',
    '[ "$NAJDEN_Z0AK" = "1" ] || { echo "Z0ak FAIL: zmogljivost-dokaz blok z 10 meritvami ni izrisan (useEffect meritev teče? dispatch?)"; exit 1; }')
zam('calculatorVrstica:vr.some(t=>t.includes(\'Kalkulator razmikov letvic\')), aiVrstica:vr.some(t=>t.includes(\'AI raba pregled\')), sklep:s?.textContent??null, err:window.__err??null});})()',
    'calculatorVrstica:vr.some(t=>t.includes(\'Kalkulator razmikov letvic\')), aiVrstica:vr.some(t=>t.includes(\'AI raba pregled\')), pdfVrstica:vr.some(t=>t.includes(\'Konflikti PDF dokument\'))&&vr.some(t=>t.includes(\'Računi po projektih PDF\')), sklep:s?.textContent??null, err:window.__err??null});})()')
zam("assert d['calculatorVrstica'] and d['aiVrstica'], 'Z0ak: ključni vrstici manjkata: ' + json.dumps(d)",
    "assert d['calculatorVrstica'] and d['aiVrstica'], 'Z0ak: ključni vrstici manjkata: ' + json.dumps(d)\nassert d['pdfVrstica'], 'Z0ak: PDF meritvi manjkata (R313 — Deliverable 6 razširitev): ' + json.dumps(d)")
zam("assert d['vrstice'] == 8, 'Z0ak: pričakovano 8 meritev, dobljeno '",
    "assert d['vrstice'] == 10, 'Z0ak: pričakovano 10 meritev, dobljeno '")
zam("assert re.match(r'Merjeno na tej napravi: 8 operacij · 1800 iteracij · vsi izhodi preverjeni', sk), 'Z0ak sklep struktura FAIL: ' + json.dumps(d)",
    "assert re.match(r'Merjeno na tej napravi: 10 operacij · 1808 iteracij · vsi izhodi preverjeni', sk), 'Z0ak sklep struktura FAIL: ' + json.dumps(d)")
zam("print('Z0ak OK — meritve zmogljivosti ŽIVO: 8 realnih meritev × (min/mediana/max ms) + vsi izhodi preverjeni + sklep WYSIWYG (Deliverable 6 na zaslonu; ZERO-MUTACIJA)')",
    "print('Z0ak OK — meritve zmogljivosti ŽIVO: 10 realnih meritev × (min/mediana/max ms; +2 PDF) + vsi izhodi preverjeni + sklep WYSIWYG (Deliverable 6 + razširitev na zaslonu; ZERO-MUTACIJA)')")

# ── 3. Generacijske poti + oznake ──
zam('/tmp/r312-', '/tmp/r313-', 124)
zam('r312-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r313-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('/tmp/R312-server-e2e.log', '/tmp/R313-server-e2e.log', 1)
zam('e2e-r312-ne-obstojeci-id', 'e2e-r313-ne-obstojeci-id', 1)
zam('echo "=== Z0aj: AI RABA DOKAZ NA ZASLONU ŽIVO (R311 — 41. člen issue #1: Deliverable 5 na zaslonu; EN VIR WYSIWYG; ZERO-MUTACIJA; regresija) ==="',
    'echo "=== Z0aj: AI RABA DOKAZ NA ZASLONU ŽIVO (R311 — 41. člen issue #1: Deliverable 5 na zaslonu; EN VIR WYSIWYG; ZERO-MUTACIJA; regresija) ==="', 1)  # oznaka ostane (zgodovinska)
zam('echo "=== R312 E2E KONEC ==="', 'echo "=== R313 E2E KONEC ==="', 1)
zam('agent-browser screenshot "$SS/qa-r312-e2e-z0ak-zmogljivost.png" > /dev/null 2>&1',
    'agent-browser screenshot "$SS/qa-r313-e2e-z0ak-zmogljivost.png" > /dev/null 2>&1', 1)

# ── 4. Izhodna asercija ──
assert '/tmp/r312-' not in text, 'IZHOD: /tmp/r312- ostanki'
assert 'r312-e2e-lokalni-sekret' not in text, 'IZHOD: sekret ostanek'
assert 'R312-server-e2e' not in text, 'IZHOD: server log ostanek'
assert "v===10" in text and '10 operacij · 1808 iteracij' in text, 'IZHOD: Z0ak 10-op posodobitev manjka'
assert "d['vrstice'] == 10" in text, 'IZHOD: vrstice==10 assert manjka'
assert '1810' not in text, 'IZHOD: zastarel 1810 sklepi'
assert 'pdfVrstica' in text, 'IZHOD: PDF assert manjka'
DOL.write_text(text, encoding='utf-8')
print(f'OK: {DOL} ({len(text.splitlines())} vrstic)')
