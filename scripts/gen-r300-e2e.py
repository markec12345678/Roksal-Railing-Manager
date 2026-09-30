#!/usr/bin/env python3
# R300 — generira scripts/r300-e2e-browser.sh iz r299-e2e-browser.sh:
#  1. NOV Z0w blok: KONFLIKTNA MINI-VRSTICA ŽIVO (30. člen) — pogojna
#     vidnost (razgled.pov !== null): termini obstajajo → mini ŽIVO
#     (role=status + 'Konflikti: ' prepona + zelen/rdeč žig usklajen z
#     besedilom + definicijski naslov z izrečenimi pravili); 0 terminov →
#     iskrena odsotnost (pogojni kanon r277 — obe veji iskreni);
#  2. poti + oznake r299 → r300;
#  3. ZERO-MUTACIJA veriga nespremenjena (fp pre/post ×4 + restore).
SRC = '/home/z/my-project/scripts/r299-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r300-e2e-browser.sh'

s = open(SRC).read()

s = s.replace('/tmp/r299-', '/tmp/r300-')
s = s.replace('qa-r299-e2e-', 'qa-r300-e2e-')
s = s.replace(
    '# R299 E2E ŽIVO (lokalni :3100, ADMIN) — TEDENSKI ICS PO EKIPAH (29. člen\n# izvozne družine — izpeljani brat ICS R298 EN VIR; filter EN VIR\n# tedenskiEkipaImena; X-ROKSAL-EKIPA + UID predpona z FNV-1a hashom) +\n# [kombinirano z R298] TEDENSKI ICS + [kombinirano z R297] OPREMA CIKEL CSV\n# + [kombinirano z R296] KOLEDAR ICS + [kombinirano z R295] KOLEDAR CSV +\n# F2 mini-vrstica + [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev',
    '# R300 E2E ŽIVO (lokalni :3100, ADMIN) — KONFLIKTNA MINI-VRSTICA (30. člen\n# issue #1 §7 branje — bralna stran pravil R142; zrcalo STRAŽAR-\n# sinhronizirano) + [kombinirano z R299] TEDENSKI ICS PO EKIPAH +\n# [kombinirano z R298] TEDENSKI ICS + [kombinirano z R297] OPREMA CIKEL CSV\n# + [kombinirano z R296] KOLEDAR ICS + [kombinirano z R295] KOLEDAR CSV +\n# [kombinirano z R294] OPOMNIK DEEP-LINK ((k) dopolnitev',
)
s = s.replace('echo "=== R299 E2E KONEC ==="', 'echo "=== R300 E2E KONEC ==="')

Z0W = '''echo "=== Z0w: KONFLIKTNA MINI-VRSTICA ŽIVO (R300 — 30. člen issue #1 §7 branje; pogojni probe — obe veji iskreni) ==="
eb_dispatch '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
# LEKCIJA R298 (podzavihek stale state): Z0w klikne 'Koledar' sam v predikatu
# (idempotentno — vzorec Z0t/Z0u/Z0v).
if eb_pocakaj_na "(()=>{const gumbi=[...document.querySelectorAll('button')]; const koledar=gumbi.find(b=>b.textContent.trim()==='Koledar'); if(koledar) koledar.click(); return !!document.querySelector('button[aria-label=\\"Izvozi tedenski pregled monta\\u017e kot ICS koledar\\"]');})()" 16; then
  agent-browser eval "(()=>{const mini=document.querySelector('[data-testid=\\"tedenski-konflikti-mini\\"]'); const sklep=document.querySelector('[data-testid=\\"tedenski-razgled-sklep\\"]'); const terminiViden=!!(sklep&&!sklep.textContent.startsWith('Naslednjih 7 dni brez')); return JSON.stringify({terminiViden, mini:!!mini, role:mini?mini.getAttribute('role'):null, text:mini?mini.textContent.trim():null, zelen:mini?mini.className.includes('text-roksal-green'):null, rdec:mini?mini.className.includes('text-roksal-red'):null, title:mini?((mini.getAttribute('title')||'').includes(' isti poli-odprto pravilo kot API 409')):null, err:window.__err??null});})()" 2>&1 | tail -1 > /tmp/r300-z0w-mini.json
  python3 - <<'PYEOF7' || exit 1
import json
raw = open('/tmp/r300-z0w-mini.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['err'] is None, 'Z0w mini err: ' + json.dumps(d)
if d['terminiViden']:
    assert d['mini'], 'Z0w: termini v oknu A mini-vrstica manjka (kršitev WYSIWYG — pregled mora biti viden): ' + json.dumps(d)
    assert d['role'] == 'status', 'Z0w: role=status manjka: ' + json.dumps(d)
    assert d['text'].startswith('Konflikti: '), 'Z0w: mini besedilo brez prepone Konflikti: : ' + json.dumps(d)
    cisto = d['text'].startswith('Konflikti: 0')
    assert cisto == d['zelen'] and (not cisto) == d['rdec'], 'Z0w: zelen/rde\\u010d \\u017eig ni usklajen z besedilom: ' + json.dumps(d)
    assert d['title'], 'Z0w: definicijski naslov brez izre\\u010denih pravil: ' + json.dumps(d)
    print('Z0w OK — KONFLIKTNA MINI-VRSTICA ŽIVO (' + ('\\u010distost 0 — zelen' if cisto else 'konflikti — rde\\u010d') + ')')
else:
    assert not d['mini'], 'Z0w: 0 terminov A mini-vrstica VIDNA (kršitev pogojne vidnosti — iskrena praznina R295/R296): ' + json.dumps(d)
    print('Z0w OK — 0 terminov na spot seji: mini pogojno skrita (iskrena praznina — pogojni kanon r277)')
PYEOF7
  agent-browser screenshot "$SS/qa-r300-e2e-z0w-konflikti-mini.png" > /dev/null 2>&1
else
  echo "Z0w OPOMBA: logistika/termini ni dosegljiva na spot seji (RBAC skoping?) — chunk needleji R300 ×11 ostajajo obvezni dokaz"
fi

'''

ANCHOR = 'echo "=== Z1: Meritve tab — verzija pill v1 + vir \'Ročni vnos\' + R269 mini title + VIRI MINI amber (r276 — regresija + R283 STIL) ==="'
assert ANCHOR in s, 'anchor Z1 ni najden'
s = s.replace(ANCHOR, Z0W + ANCHOR)

open(DST, 'w').write(s)
print('r300-e2e-browser.sh zgeneriran:', len(s), 'znakov')
