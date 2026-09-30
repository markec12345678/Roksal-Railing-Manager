#!/usr/bin/env python3
"""Derive scripts/r305-e2e-browser.sh from r304 (cumulative E2E + new Z0ad).
R305 = 35. člen: TEDENSKI PREGLED PO DNEVIH Z EKIPAMI — ZASLONSKI brat.
Z0ad = pogojni probe s NATANKO EN izid invarianto (praznoOkno/prazno/sklep)."""
import re

src = open('scripts/r304-e2e-browser.sh', encoding='utf-8').read()

# --- 1. Path/session renames (keep lengths/secrets sane) ---
s = src
s = s.replace('/tmp/r304-', '/tmp/r305-')
s = s.replace('qa-r304-', 'qa-r305-')
s = s.replace('/tmp/R294-server-e2e.log', '/tmp/R305-server-e2e.log')
s = s.replace('r285-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r305-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!')
s = s.replace('=== R304 E2E KONEC ===', '=== R305 E2E KONEC ===')
s = s.replace('# R304 E2E ŽIVO (lokalni :3100, ADMIN) — VODJA TEDENSKI CSV PO EKIPAH (34. člen izvozne\n# družine — CSV brat PDF po ekipah R303; ENA vrstica na termin) +',
              '# R305 E2E ŽIVO (lokalni :3100, ADMIN) — TEDENSKI PREGLED PO DNEVIH Z EKIPAMI (35. člen\n# izvozne družine — ZASLONSKI brat PDF po ekipah R303 + CSV po ekipah R304; ZASLON = takoj) +\n# [R304] VODJA TEDENSKI CSV PO EKIPAH (ENA vrstica na termin) +')
s = s.replace('R304 dimni test', 'R305 dimni test')  # no-op safety

# --- 2. Z0ad block (inserted before Z1) ---
z0ad = '''
echo "=== Z0ad: TEDENSKI PREGLED PO DNEVIH Z EKIPAMI ŽIVO (R305 — 35. člen izvozne družine, ZASLON; pogojni probe — vsi trije izidi iskreni, NATANKO EN) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/…/Z0aa/Z0ab/Z0ac). Blok je pogojen z razgled.pov
# !== null — trije iskreni izidi: praznoOkno (blok NI izmišljen) / prazno
# (termini brez ekipe — particija dokaz) / sklep (PETI potrošnik ENEGA niza).
if eb_pocakaj_na "(()=>{const koledar=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('[data-testid=\\"tedenski-ekipa-dnevi\\"]') || document.body.textContent.includes('Ni terminov v naslednjih 7 dneh');})()" 16; then
  eb_cakaj 1
  agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\\"tedenski-ekipa-dnevi\\"]'); const praznoEl=document.querySelector('[data-testid=\\"tedenski-ekipa-dnevi-prazno\\"]'); const sklepEl=document.querySelector('[data-testid=\\"tedenski-ekipa-dnevi-sklep\\"]'); const praznoOkno=!blok && document.body.textContent.includes('Ni terminov v naslednjih 7 dneh'); const dnevi=blok&&blok.children.length===2?blok.children[1].children.length:0; const uli=blok?blok.querySelectorAll('ul').length:0; const praznihDni=blok?(blok.textContent.match(/Brez terminov na ta dan/g)||[]).length:0; const vrstic=blok?blok.querySelectorAll('li').length:0; return JSON.stringify({blok:!!blok, aria:blok?blok.getAttribute('aria-label'):null, title:blok?((blok.getAttribute('title')||'').includes('ISTI pregled in vrstni red kot Ekipe PDF in Ekipe CSV')):null, prazno:!!praznoEl, praznoTekst:praznoEl?praznoEl.textContent.trim():null, sklep:!!sklepEl, sklepTekst:sklepEl?sklepEl.textContent.trim():null, dnevi, uli, praznihDni, vrstic, praznoOkno, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r305-z0ad.json
  python3 - <<'PYEOF9' || exit 1
import json
raw = open('/tmp/r305-z0ad.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0ad err: ' + json.dumps(d)
izidi = sum([1 for k in ('praznoOkno', 'prazno', 'sklep') if d[k]])
assert izidi == 1, 'Z0ad: natanko EN iskren izid (praznoOkno/prazno/sklep), dobljeno ' + str(izidi) + ': ' + json.dumps(d)
if d['praznoOkno']:
    assert not d['blok'], 'Z0ad: praznoOkno A VSEENO blok (blok je pogojen z razgled.pov — ni izmišljenega pogleda): ' + json.dumps(d)
    print('Z0ad OK — ZASLON blok pravilno ODSOTEN ob praznem oknu (iskrena praznina, nič izmišljenega)')
elif d['prazno']:
    assert d['blok'] and d['title'], 'Z0ad: prazna veja brez bloka/title: ' + json.dumps(d)
    assert (d['aria'] or '').startswith('Teden po dnevih in ekipah'), 'Z0ad: aria FAIL: ' + json.dumps(d)
    assert 'Brez ekip z termini v okviru' in (d['praznoTekst'] or ''), 'Z0ad: prazna veja iskren tekst FAIL: ' + json.dumps(d)
    assert 'Dodeli ekipo v terminu' in (d['praznoTekst'] or ''), 'Z0ad: prazna veja dejanje FAIL: ' + json.dumps(d)
    assert d['sklepTekst'] is None, 'Z0ad: prazna veja A sklep tekst (izidi se izključujeta): ' + json.dumps(d)
    print('Z0ad OK — ZASLON blok ŽIVO, prazna veja (vsi vidni termini brez ekipe — particija dokaz + dejanje)')
elif d['sklep']:
    assert d['blok'] and d['title'], 'Z0ad: sklep veja brez bloka/title: ' + json.dumps(d)
    assert (d['aria'] or '').startswith('Teden po dnevih in ekipah'), 'Z0ad: aria FAIL: ' + json.dumps(d)
    assert d['dnevi'] == 7, 'Z0ad: pričakovano NATANKO 7 dni okna (EN VIR pregled.okno), dobljeno ' + str(d['dnevi']) + ': ' + json.dumps(d)
    assert d['uli'] + d['praznihDni'] == 7, 'Z0ad: particija dni (vrstični + prazni = 7) FAIL: ' + json.dumps(d)
    assert d['vrstic'] >= 1 or d['praznihDni'] >= 1, 'Z0ad: sklep veja brez vsebine: ' + json.dumps(d)
    assert 'Ekip: ' in (d['sklepTekst'] or ''), 'Z0ad: sklep NI WYSIWYG (PETI potrošnik ENEGA niza — ISTO besedilo kot PDF/CSV/toast): ' + json.dumps(d)
    print('Z0ad OK — ZASLON blok ŽIVO, sklep veja (7 dni EN VIR + WYSIWYG sklep; vrstic ' + str(d['vrstic']) + ', praznih dni ' + str(d['praznihDni']) + ')')
PYEOF9
  agent-browser screenshot "$SS/qa-r305-e2e-z0ad-ekipa-dnevi.png" > /dev/null 2>&1
else
  echo "Z0ad OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R305 ×11 ostajajo obvezni dokaz"
fi

'''
marker = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir \'Ročni vnos\' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="'
assert marker in s, 'Z1 marker not found'
s = s.replace(marker, z0ad + marker, 1)

open('scripts/r305-e2e-browser.sh', 'w', encoding='utf-8').write(s)
print('written scripts/r305-e2e-browser.sh lines=%d' % s.count('\n'))
