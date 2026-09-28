#!/usr/bin/env python3
# R263 — patch r263-e2e-browser.sh: (1) eval JSON je DVOLIČNO kodiran
# (agent-browser vrne JSON.stringify string) → pomožnica L() pri vseh
# python preverbah; (2) toast agregat regex greedy (.+)\. je pogoltnil
# RSC payload (__next_f push tekstu v body.textContent) → NON-GREEDY (.+?)\.;
# (3) poteklih regex brez končne pike (agregat zajet brez nje).
import re

P = '/home/z/my-project/scripts/r263-e2e-browser.sh'
src = open(P, encoding='utf-8').read()

# (2) non-greedy toast agregat regex (obe eval vrstici)
src = src.replace(r'— (.+)\.', r'— (.+?)\.')

# (3) poteklih regex brez pike (zajet agregat nima končne pike)
src = src.replace(r"r'poteklih (\d+)\.'", r"r'poteklih (\d+)'")

# (1) dvolično kodiran JSON — pomožnica L() + uporaba v preverbah
helper = ("import json, re\n\ndef L(p):\n"
          "    d = json.load(open(p))\n"
          "    return json.loads(d) if isinstance(d, str) else d\n\n")
src = src.replace("import json, re\nd=json.load(open('/tmp/r263-z1b.json'))", helper + "d = L('/tmp/r263-z1b.json')")
src = src.replace("import json\nd=json.load(open('/tmp/r263-z2.json')); e=json.load(open('/tmp/r263-expected.json'))",
                  helper + "d = L('/tmp/r263-z2.json'); e = json.load(open('/tmp/r263-expected.json'))")
src = src.replace("import json\nd=json.load(open('/tmp/r263-z2b.json')); e=json.load(open('/tmp/r263-expected.json'))",
                  helper + "d = L('/tmp/r263-z2b.json'); e = json.load(open('/tmp/r263-expected.json'))")
# Z1 enovrstična preverba — tudi dvolično kodiranje
src = src.replace(
    "python3 -c \"import json; d=json.load(open('/tmp/r263-z1.json')); assert d['pokPill']",
    "python3 -c \"import json; r=json.load(open('/tmp/r263-z1.json')); d=json.loads(r) if isinstance(r,str) else r; assert d['pokPill']",
)
# Z1b/Z2 PDF preverbi — tudi dvolično kodiranje
src = src.replace(
    "python3 -c \"import json; d=json.load(open('/tmp/r263-z1b-pdf.json'));",
    "python3 -c \"import json; r=json.load(open('/tmp/r263-z1b-pdf.json')); d=json.loads(r) if isinstance(r,str) else r;",
)
src = src.replace(
    "python3 -c \"import json; d=json.load(open('/tmp/r263-z2-pdf.json'));",
    "python3 -c \"import json; r=json.load(open('/tmp/r263-z2-pdf.json')); d=json.loads(r) if isinstance(r,str) else r;",
)

open(P, 'w', encoding='utf-8').write(src)
print('patched OK')
for pat in [r'— \(\.\+\?\)\\', 'def L(p)', "poteklih (\\d+)'"]:
    print(pat, '→', len(re.findall(pat, src)), 'najdenih')
