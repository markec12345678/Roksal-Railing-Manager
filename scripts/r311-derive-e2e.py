#!/usr/bin/env python3
# R311 — derive r311-e2e-browser.sh iz r310-e2e-browser.sh (generacijski
# vzorec). VSAKA zamenjava je NATANKO ena-n-točkovna (fail-closed: napačno
# število zadetkov → izpisek + exit 1).
# Transformacije:
#   1. Glava: + Z0aj vrstica (AI raba dokaz)
#   2. NOV Z0aj blok: AI RABA DOKAZ NA ZASLONU ŽIVO (41. člen — naslov + 2
#      živi AI površini z razrešenim nadomestkom + 3 kandidati + sklep
#      WYSIWYG; ZERO-MUTACIJA — samo branje DOM)
#   3. Generacijske poti: /tmp/r310- → /tmp/r311-, sekret, marker id
import sys
from pathlib import Path

VIR = Path('/home/z/my-project/scripts/r310-e2e-browser.sh')
DOL = Path('/home/z/my-project/scripts/r311-e2e-browser.sh')

text = VIR.read_text(encoding='utf-8')

def zam(stari, novi, pricakuj=1):
    global text
    n = text.count(stari)
    if n != pricakuj:
        print(f'FAIL-CLOSED: {stari[:70]!r} — najdeno {n}×, pričakovano {pricakuj}×')
        sys.exit(1)
    text = text.replace(stari, novi)

# ── 1. Glava: Z0aj vrstica pred Z0z (kanon seznama probeov) ──
zam('#   Z0z: ZVONČEK OPOMNIK ŽIVO (R287 regresija): zvonček odprt → POTEKEL',
    '#   Z0aj: AI RABA DOKAZ ŽIVO (R311 NOVO — 41. člen issue #1): vodja blok\n#         [ai-raba-dokaz] — naslov + 2 živi AI površini z razrešenim\n#         nadomestkom + 3 kandidati + sklep WYSIWYG (EN VIR — ZERO-MUTACIJA);\n#   Z0z: ZVONČEK OPOMNIK ŽIVO (R287 regresija): zvonček odprt → POTEKEL')

# ── 2. NOV Z0aj blok — vstavljen PRED Z0ah ──
Z0AJ = '''
echo "=== Z0aj: AI RABA DOKAZ NA ZASLONU ŽIVO (R311 — 41. člen issue #1: Deliverable 5 na zaslonu; EN VIR WYSIWYG; ZERO-MUTACIJA) ==="
# Vodja pregled → AI raba blok [ai-raba-dokaz]: naslov + 2 živi AI površini z
# razrešenim nadomestkom + 3 iskreni kandidati + sklep (lib template literal —
# zaslon nosi EN VIR niz, NIČ dvojnega sklepa). Admin seja → vodja dostopen;
# ZERO-MUTACIJA: samo branje DOM — nič fetch mutacij, odtis ostane.
eb_dispatch '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
NAJDEN_Z0AJ=0
for poskus in 1 2 3 4; do
  eb_cakaj 3
  agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\\"ai-raba-dokaz\\"]'); return b ? 'najden' : 'ni';})()" 2>&1 | tail -1 | grep -q najden && { NAJDEN_Z0AJ=1; break; }
done
[ "$NAJDEN_Z0AJ" = "1" ] || { echo "Z0aj FAIL: ai-raba-dokaz blok ni izrisan (vodja chunk naložen? dispatch?)"; exit 1; }
agent-browser eval "(()=>{const b=document.querySelector('[data-testid=\\"ai-raba-dokaz\\"]'); const s=document.querySelector('[data-testid=\\"ai-raba-sklep\\"]'); const ps=[...(b?.querySelectorAll('p')??[])].map(p=>p.textContent||''); return JSON.stringify({naslov:b?.getAttribute('aria-label')??null, nadom:ps.filter(t=>t.includes('→ nadomestek (brez AI):')).length, kandidati:(b?.querySelectorAll('li')??[]).length, sklep:s?.textContent??null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r311-z0aj.json
python3 - <<'PYEOFZ0AJ' || exit 1
import json
raw = open('/tmp/r311-z0aj.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0aj err: ' + json.dumps(d)
assert d['naslov'] == 'AI raba — iskrena resnica', 'Z0aj naslov FAIL: ' + json.dumps(d)
assert d['nadom'] == 2, 'Z0aj: pričakovano 2 živi AI površini z nadomestkom, dobljeno ' + json.dumps(d)
assert d['kandidati'] == 3, 'Z0aj: pričakovano 3 iskrene kandidatke, dobljeno ' + json.dumps(d)
sk = d['sklep'] or ''
assert 'AI površine: 2' in sk, 'Z0aj sklep resnica 1 FAIL: ' + json.dumps(d)
assert 'kandidati: 3 (ne-implementirani, nič povezano)' in sk, 'Z0aj sklep resnica 2 FAIL: ' + json.dumps(d)
assert 'AI-obveznih: 0 — jedro deluje brez AI' in sk, 'Z0aj sklep ničla FAIL: ' + json.dumps(d)
print('Z0aj OK — AI raba dokaz ŽIVO: naslov + 2 nadomestka + 3 kandidati + sklep WYSIWYG (EN VIR na zaslonu — nič dvojnega sklepa; ZERO-MUTACIJA)')
PYEOFZ0AJ

echo "=== Z0ah: MIGRACIJSKI VAL ŽIVO'''
zam('\necho "=== Z0ah: MIGRACIJSKI VAL ŽIVO', Z0AJ, 1)

# ── 3. Generacijske poti + sekret + marker ──
n_r310 = text.count('/tmp/r310-')
if n_r310 < 20:
    print(f'FAIL-CLOSED: /tmp/r310- samo {n_r310}× — pričakovano ≥20')
    sys.exit(1)
text = text.replace('/tmp/r310-', '/tmp/r311-')
zam('r310-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r311-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 1)
zam('e2e-r310-ne-obstojeci-id', 'e2e-r311-ne-obstojeci-id', 1)
zam('=== R310 E2E KONEC ===', '=== R311 E2E KONEC ===', 1)

# ── Samoidentifikacija + ostanki ──
for ostanek in ('/tmp/r310-', 'r310-e2e-lokalni-sekret', 'e2e-r310-ne-obstojeci'):
    assert ostanek not in text, f'ostanek stare generacije: {ostanek}'
assert 'Z0aj' in text and 'PYEOFZ0AJ' in text, 'Z0aj blok manjka'

DOL.write_text(text, encoding='utf-8')
print(f'OK: {DOL} ({len(text.splitlines())} vrstic)')
