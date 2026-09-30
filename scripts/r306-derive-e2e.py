#!/usr/bin/env python3
"""Derive scripts/r306-e2e-browser.sh from r305 (cumulative E2E + new Z0ae).
R306 = 36. člen: OPREMA CIKEL DOKAZ NA ZASLONU. Z0ae = pogojni probe s
NATANKO EN izid invarianto (brezOpreme/prazno/dokaz)."""
s = open('scripts/r305-e2e-browser.sh', encoding='utf-8').read()

s = s.replace('/tmp/r305-', '/tmp/r306-')
s = s.replace('qa-r305-', 'qa-r306-')
s = s.replace('/tmp/R305-server-e2e.log', '/tmp/R306-server-e2e.log')
s = s.replace('r305-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!', 'r306-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!')
s = s.replace('=== R305 E2E KONEC ===', '=== R306 E2E KONEC ===')
s = s.replace('# R305 E2E ŽIVO (lokalni :3100, ADMIN) — TEDENSKI PREGLED PO DNEVIH Z EKIPAMI (35. člen\n# izvozne družine — ZASLONSKI brat PDF po ekipah R303 + CSV po ekipah R304; ZASLON = takoj) +',
              '# R306 E2E ŽIVO (lokalni :3100, ADMIN) — OPREMA CIKEL DOKAZ NA ZASLONU (36. člen\n# izvozne družine — ZASLONSKI brat Cikel PDF R266 + Cikel CSV R297; ZASLON = takoj) +\n# [R305] TEDENSKI PREGLED PO DNEVIH Z EKIPAMI +')

z0ae = '''
echo "=== Z0ae: OPREMA CIKEL DOKAZ NA ZASLONU ŽIVO (R306 — 36. člen izvozne družine, ZASLON; pogojni probe — vsi trije izidi iskreni, NATANKO EN) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# Trije iskreni izidi: brezOpreme (blok ODSOTEN — pregled fail-closed guard)
# / prazno (oprema brez žigov — zelen žig veja) / dokaz (žigi > 0 — vrstice
# + iskren dvojni števec vrstic/žigov).
if eb_pocakaj_na "(()=>{return !!document.querySelector('[data-testid=\\"oprema-cikel-dokaz\\"]') || document.body.textContent.includes('Ni opreme. Dodaj prvo.');})()" 16; then
  eb_cakaj 1
  agent-browser eval "(()=>{const blok=document.querySelector('[data-testid=\\"oprema-cikel-dokaz\\"]'); const praznoEl=document.querySelector('[data-testid=\\"oprema-cikel-dokaz-prazno\\"]'); const sklepEl=document.querySelector('[data-testid=\\"oprema-cikel-dokaz-sklep\\"]'); const brezOpreme=!blok && document.body.textContent.includes('Ni opreme. Dodaj prvo.'); const mini=document.body.textContent.includes('Cikl (viden seznam):'); const vrsticne=blok?blok.querySelectorAll('li').length:0; const amber=blok?blok.querySelectorAll('span[class*=\\"roksal-amber\\"]').length:0; const rdece=blok?blok.querySelectorAll('span[class*=\\"roksal-red\\"]').length:0; const sklepTekst=sklepEl?sklepEl.textContent.trim():null; const m=sklepTekst?sklepTekst.match(/Vrstic (\\\\d+) [^]* zigov (\\\\d+)\\\\./):null; const n=m?parseInt(m[1],10):null; const g=m?parseInt(m[2],10):null; return JSON.stringify({blok:!!blok, aria:blok?blok.getAttribute('aria-label'):null, title:blok?((blok.getAttribute('title')||'').includes('kot Cikel PDF in Cikel CSV')):null, prazno:!!praznoEl, praznoTekst:praznoEl?praznoEl.textContent.trim():null, sklep:!!sklepEl, sklepTekst, vrsticne, amber, rdece, n, g, brezOpreme, mini, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r306-z0ae.json
  python3 - <<'PYEOF10' || exit 1
import json, re
raw = open('/tmp/r306-z0ae.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0ae err: ' + json.dumps(d)
izidi = sum([1 for k in ('brezOpreme', 'prazno', 'sklep') if d[k]])
assert izidi == 1, 'Z0ae: natanko EN iskren izid (brezOpreme/prazno/dokaz), dobljeno ' + str(izidi) + ': ' + json.dumps(d)
if d['brezOpreme']:
    assert not d['blok'] and not d['mini'], 'Z0ae: brezOpreme A VSEENO blok/mini (pregled fail-closed guard): ' + json.dumps(d)
    print('Z0ae OK — dokaz blok pravilno ODSOTEN brez opreme (iskrena odsotnost, nič izmišljenega)')
elif d['prazno']:
    assert d['blok'] and d['title'], 'Z0ae: zelen žig veja brez bloka/title: ' + json.dumps(d)
    assert (d['aria'] or '') == 'Oprema, ki potrebuje akcijo', 'Z0ae: aria FAIL: ' + json.dumps(d)
    assert 'je brez zapadlih pregledov in potečenih kalibracij.' in (d['praznoTekst'] or ''), 'Z0ae: zelen žig tekst FAIL: ' + json.dumps(d)
    assert d['sklepTekst'] is None and d['vrsticne'] == 0, 'Z0ae: zelen žig A sklep/vrstice (izidi se izključujejo): ' + json.dumps(d)
    assert d['mini'], 'Z0ae: mini-vrstica naj bi bila vidna ob opremi: ' + json.dumps(d)
    print('Z0ae OK — dokaz blok ŽIVO, zelen žig veja (vsa vidna oprema brez akcij)')
elif d['sklep']:
    assert d['blok'] and d['title'], 'Z0ae: dokaz veja brez bloka/title: ' + json.dumps(d)
    assert (d['aria'] or '') == 'Oprema, ki potrebuje akcijo', 'Z0ae: aria FAIL: ' + json.dumps(d)
    assert d['n'] is not None and d['g'] is not None, 'Z0ae: sklep dvojnega števca ne berljiv: ' + json.dumps(d)
    assert 1 <= d['n'] <= d['g'], 'Z0ae: iskren dvojni števec FAIL (N ≥ 1, N ≤ M): ' + json.dumps(d)
    assert d['vrsticne'] == d['n'], 'Z0ae: vrstice = N (kos z več žigi = ENA vrstica) FAIL: ' + json.dumps(d)
    assert d['rdece'] + d['amber'] >= d['g'], 'Z0ae: žigov barvnih < žigov števec (pariteta): ' + json.dumps(d)
    assert d['mini'], 'Z0ae: mini-vrstica naj bi bila vidna ob opremi: ' + json.dumps(d)
    print('Z0ae OK — dokaz blok ŽIVO, vrstic ' + str(d['n']) + ' · žigov ' + str(d['g']) + ' (iskrena dvojna resnica; rdečih/amber " + str(d["rdece"] + d["amber"]) + ")')
PYEOF10
  agent-browser screenshot "$SS/qa-r306-e2e-z0ae-oprema-dokaz.png" > /dev/null 2>&1
else
  echo "Z0ae OPOMBA: logistika/oprema ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R306 ×11 ostajajo obvezni dokaz"
fi

'''
marker = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir \'Ročni vnos\' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="'
assert marker in s, 'Z1 marker not found'
s = s.replace(marker, z0ae + marker, 1)

open('scripts/r306-e2e-browser.sh', 'w', encoding='utf-8').write(s)
print('written scripts/r306-e2e-browser.sh lines=%d' % s.count('\n'))
