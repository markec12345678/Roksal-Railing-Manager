#!/usr/bin/env python3
"""R288: izpelji r288-e2e-browser.sh iz r287 (kanon gen-* — r287 lekcija 3).
Spremembe:
  1. glava — R288 opis + Z0y korak v seznamu;
  2. Z0z obogaten z Z0y korakom (deep-link ŽIVO): po CRM tab preverbi —
     detail Sheet stranke odprt (SheetTitle = seed ime) + opomniška kartica
     ('Opomnik potekel') + ZAPRI (sr-only 'Zapri') + poudarjena vrstica
     (border-roksal-amber/60 + bg-roksal-amber/5 + title 'Poudarjeno iz
     zvončka (opomnik)') + AKTIVEN vrstica NI poudarjena;
  3. /tmp + screenshot imena r287 → r288 (unikatna ostala imena ista);
  4. strežnik log ime."""
import re

SRC = '/home/z/my-project/scripts/r287-e2e-browser.sh'
DST = '/home/z/my-project/scripts/r288-e2e-browser.sh'
src = open(SRC).read()

# 1) Glava — prvi blok (do 'set -u')
glava = '''#!/bin/bash
# R288 E2E ŽIVO (lokalni :3100, ADMIN) — OPOMNIK DEEP-LINK ((k) dopolnitev
# R287: signal → dejanje → CILJ) + INVENTURA CSV + ZAPISNI LIST PDF/CSV + zgodovina verzij:
#   Z0z: ZVONČEK OPOMNIK ŽIVO (R287 regresija): zvonček odprt → POTEKEL
#        vrstica (red, prioriteta) + AKTIVEN (amber); klik na POTEKEL →
#        CRM tab (R182 protokol);
#   Z0y: DEEP-LINK ŽIVO (R288 NOVO): detail Sheet stranke SAMODEJNO odprt
#        (SheetTitle = 'E2E R287 Potekel Opomnik' — dvo-dogodkovni protokol
#        R214 vzorec: navigate crm + roksal:select-crm) + opomniška kartica
#        ('Opomnik potekel' — POTEKEL red resnica) + ZAPRI gumb → poudarjena
#        vrstica v CRM seznamu (border-roksal-amber/60 + bg-roksal-amber/5 +
#        title 'Poudarjeno iz zvončka (opomnik)' — D6 stil, 0 novih hex) +
#        AKTIVEN vrstica NI poudarjena (izrecna izbira — nikoli razsuta);
#   Z1: verzija pill 'v1' + vir 'Ročni vnos' + R269 mini title ŽIVO
#       (r276 projekt — regresija + R283 STIL); VIRI MINI amber (delna
#       pokritost — samo MANUAL — iskrena resnica r276 seeda);
#   Z1r: REF PROJEKT (e2e-r283-ref-proj) — VIRI MINI ŽIVO + GREEN pika +
#       vir pilli ×3 + R269 mini + osnutek žeton title (R283 regresija);
#   Z1s: SYNC ŽIG ŽIVO (r281 projekt — R281 regresija);
#   Z1m: F2 SYNC MINI-Vrstica ŽIVO (R282 regresija);
#   Z2: Popravi tok ŽIVO (R276 regresija — v2 pill, v1 ostane);
#   Z2b: TERENSKI PDF ŽIVO (R269 regresija);
#   Z2z: ZAPISNI LIST PDF ŽIVO (R284 regresija);
#   Z2x: INVENTURA PREGLED CSV ŽIVO (R286 regresija);
#   Z2y: ZAPISNI LIST CSV ŽIVO (R285 regresija);
#   Z3: panel zgodovine + R277 STIL;
#   Z4: regresije — R272/R271 pilli ŽIVO (projekt-gated);
#   Z5: temna + err null.
# ZERO-MUTACIJA: restore → fp-pre → seed → ... → restore → fp-post
# (bajtnata identičnost). fail-fast || exit 1 (r271 lekcija 4).
set -u
'''
src = re.sub(r'^#!/bin/bash\n(?:#[^\n]*\n)*set -u\n', glava, src, count=1)

# 3) /tmp + screenshot imena
src = src.replace('/tmp/R287-server-e2e.log', '/tmp/R288-server-e2e.log')
src = src.replace('/tmp/r287-fp-pre.json', '/tmp/r288-fp-pre.json')
src = src.replace('/tmp/r287-fp-post.json', '/tmp/r288-fp-post.json')
src = src.replace('/tmp/r287-z0z.json', '/tmp/r288-z0z.json')
src = src.replace('/tmp/r287-z0z-crm.json', '/tmp/r288-z0z-crm.json')
src = src.replace('/tmp/r286-z1.json', '/tmp/r288-z1.json')
src = src.replace('/tmp/r286-z1r.json', '/tmp/r288-z1r.json')
src = src.replace('/tmp/r286-z1s.json', '/tmp/r288-z1s.json')
src = src.replace('/tmp/r286-z1m.json', '/tmp/r288-z1m.json')
src = src.replace('/tmp/r286-z2-pas.json', '/tmp/r288-z2-pas.json')
src = src.replace('/tmp/r286-z2.json', '/tmp/r288-z2.json')
src = src.replace('/tmp/r286-z2b.json', '/tmp/r288-z2b.json')
src = src.replace('/tmp/r286-z2z.json', '/tmp/r288-z2z.json')
src = src.replace('/tmp/r286-z2x-ui.json', '/tmp/r288-z2x-ui.json')
src = src.replace('/tmp/r286-z2x.json', '/tmp/r288-z2x.json')
src = src.replace('/tmp/r286-z2y.json', '/tmp/r288-z2y.json')
src = src.replace('/tmp/r286-z3.json', '/tmp/r288-z3.json')
src = src.replace('/tmp/r286-z5.json', '/tmp/r288-z5.json')
src = src.replace('/tmp/r286-fp-pre-276.json', '/tmp/r288-fp-pre-276.json')
src = src.replace('/tmp/r286-fp-pre-281.json', '/tmp/r288-fp-pre-281.json')
src = src.replace('/tmp/r286-fp-pre-283.json', '/tmp/r288-fp-pre-283.json')
src = src.replace('/tmp/r286-fp-post-276.json', '/tmp/r288-fp-post-276.json')
src = src.replace('/tmp/r286-fp-post-281.json', '/tmp/r288-fp-post-281.json')
src = src.replace('/tmp/r286-fp-post-283.json', '/tmp/r288-fp-post-283.json')
src = src.replace('qa-r287-e2e-z0z-zvoncek.png', 'qa-r288-e2e-z0z-zvoncek.png')
src = src.replace('qa-r287-e2e-z0z-crm.png', 'qa-r288-e2e-z0y-deeplink.png')
src = src.replace('qa-r286-e2e-z1.png', 'qa-r288-e2e-z1.png')
src = src.replace('qa-r286-e2e-z1r-ref.png', 'qa-r288-e2e-z1r-ref.png')
src = src.replace('qa-r286-e2e-sync.png', 'qa-r288-e2e-sync.png')
src = src.replace('qa-r286-e2e-sync-mini.png', 'qa-r288-e2e-sync-mini.png')
src = src.replace('qa-r286-e2e-v2.png', 'qa-r288-e2e-v2.png')
src = src.replace('qa-r286-e2e-teren-pdf.png', 'qa-r288-e2e-teren-pdf.png')
src = src.replace('qa-r286-e2e-zapisni-pdf.png', 'qa-r288-e2e-zapisni-pdf.png')
src = src.replace('qa-r286-e2e-inventura-csv.png', 'qa-r288-e2e-inventura-csv.png')
src = src.replace('qa-r286-e2e-zapisni-csv.png', 'qa-r288-e2e-zapisni-csv.png')
src = src.replace('qa-r286-e2e-panel.png', 'qa-r288-e2e-panel.png')
src = src.replace('=== R287 E2E KONEC ===', '=== R288 E2E KONEC ===')

# 2) Z0y — vstavi ZA screenshotom z0z-crm (pred '=== Z1:')
z0y = '''agent-browser screenshot "$SS/qa-r288-e2e-z0y-deeplink.png" > /dev/null 2>&1

echo "=== Z0y: DEEP-LINK ŽIVO — detail Sheet samodejno odprt + poudarjena vrstica (R288) ==="
eb_pocakaj_na "(()=>{const t=[...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik'); return t;})()" 20
eb_cakaj 1
agent-browser eval "(()=>{const tit=[...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik'); const kartica=document.body.textContent.includes('Opomnik potekel'); const opis=document.body.textContent.includes('E2E pokliči nazaj (potekel)'); return JSON.stringify({tit, kartica, opis, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r288-z0y-sheet.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r288-z0y-sheet.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['tit'] and d['kartica'] and d['opis'], 'Z0y Sheet FAIL (deep-link ni odprl detaila): ' + json.dumps(d)
assert d['err'] is None, 'Z0y err: ' + json.dumps(d)
print('Z0y OK — deep-link detail Sheet ŽIVO (SheetTitle + opomniška kartica POTEKEL — dvo-dogodkovni R214 vzorec)')
PYEOF
agent-browser eval "(()=>{const g=[...document.querySelectorAll('button')].find(x=>{const s=x.querySelector('.sr-only'); return s&&s.textContent.trim()==='Zapri'&&x.closest('[data-slot=\"sheet-content\"]');}); if(!g) { const g2=[...document.querySelectorAll('[data-radix-collection-item], button')].filter(x=>{const s=x.querySelector('.sr-only'); return s&&s.textContent.trim()==='Zapri';}).pop(); if(!g2) return 'BREZ-ZAPRI'; g2.click(); return 'zapri-fallback'; } g.click(); return 'zapri';})()" 2>&1 | tail -1
eb_pocakaj_na "(()=>{return ![...document.querySelectorAll('h2')].some(x=>x.textContent.trim()==='E2E R287 Potekel Opomnik');})()" 14
agent-browser eval "(()=>{const vrstica=[...document.querySelectorAll('[role=\"button\"]')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Stranka E2E R287 Potekel Opomnik')); const akt=[...document.querySelectorAll('[role=\"button\"]')].find(x=>(x.getAttribute('aria-label')||'').startsWith('Stranka E2E R287 Aktiven Opomnik')); const poud=vrstica?vrstica.className.includes('border-roksal-amber/60'):false; const polnilo=vrstica?vrstica.className.includes('bg-roksal-amber/5'):false; const tit=vrstica?vrstica.getAttribute('title'):null; const aktCista=akt?!akt.className.includes('border-roksal-amber/60'):true; return JSON.stringify({najdena:!!vrstica, poud, polnilo, tit, aktCista, err:window.__err??null});})()" 2>&1 | tail -1 | tee /tmp/r288-z0y-poudarek.json
python3 - <<'PYEOF' || exit 1
import json
raw = open('/tmp/r288-z0y-poudarek.json').read().strip()
d = json.loads(raw)
if isinstance(d, str): d = json.loads(d)
assert d['najdena'], 'Z0y vrstica FAIL (seed stranka ni v CRM seznamu): ' + json.dumps(d)
assert d['poud'] and d['polnilo'], 'Z0y poudarek FAIL (roksal-amber obroba+polnilo): ' + json.dumps(d)
assert d['tit'] == 'Poudarjeno iz zvončka (opomnik)', 'Z0y title FAIL: ' + json.dumps(d)
assert d['aktCista'], 'Z0y AKTIVEN vrstica NE SME biti poudarjena: ' + json.dumps(d)
assert d['err'] is None, 'Z0y err: ' + json.dumps(d)
print('Z0y OK — poudarjena vrstica ŽIVO (roksal-amber obroba+polnilo+title; AKTIVEN NE poudarjena — izrecna izbira)')
PYEOF
agent-browser screenshot "$SS/qa-r288-e2e-z0y-poudarek.png" > /dev/null 2>&1
'''

anchor = 'agent-browser screenshot "$SS/qa-r288-e2e-z0z-crm.png" > /dev/null 2>&1'
# screenshot ime je že zamenjano na z0y-deeplink — torej anchor po zamenjavi:
anchor = 'agent-browser screenshot "$SS/qa-r288-e2e-z0y-deeplink.png" > /dev/null 2>&1'
assert anchor in src, 'anchor za Z0y ni najden'
src = src.replace(anchor, anchor + '\n\n' + z0y, 1)

open(DST, 'w').write(src)
print('r288-e2e-browser.sh zapisan')

import subprocess
r = subprocess.run(['bash', '-n', DST], capture_output=True, text=True)
print('bash -n:', 'OK' if r.returncode == 0 else r.stderr)
