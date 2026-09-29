#!/usr/bin/env python3
"""R275 migrator: r274-e2e-browser.sh → r275-e2e-browser.sh prilagoditve.
Idempotenten: vsaka zamenjava preveri prisotnost vzorca (fail-fast)."""
import sys

p = '/home/z/my-project/scripts/r275-e2e-browser.sh'
s = open(p).read()

repl = [
    ('r274-e2e-lokalni-sekret', 'r275-e2e-lokalni-sekret'),
    ('R274-server-e2e.log', 'R275-server-e2e.log'),
    ('r274-fp-pre.json', 'r275-fp-pre.json'),
    ('r274-fp-post.json', 'r275-fp-post.json'),
    ('r274-z1.json', 'r275-z1.json'),
    ('r274-z1b.json', 'r275-z1b.json'),
    ('r274-z2.json', 'r275-z2.json'),
    ('r274-z2-pdf.json', 'r275-z2-pdf.json'),
    ('r274-z4.json', 'r275-z4.json'),
    ('val274pre', 'val275pre'),
    ('val274', 'val275'),
    ('qa-r274-e2e-', 'qa-r275-e2e-'),
    ('R274 E2E KONEC', 'R275 E2E KONEC'),
    ('R274 E2E ŽIVO (lokalni :3100, ADMIN)', 'R275 E2E ŽIVO (lokalni :3100, ADMIN)'),
    ('=== Z1: Zaloga — R273 pill ŽIVO + mini \'Σ —\' + RED dot + role="status" (a11y sweep) ===',
     '=== Z1: Zaloga — R273 pill ŽIVO + mini \'Σ —\' + RED dot + role="status" + title/cursor-help (R275) ==='),
]
for old, new in repl:
    if old not in s:
        print(f'OPOZORILO: vzorec ni najden (že prestavljen?): {old[:60]}')
        continue
    s = s.replace(old, new)

# Z1 eval: dodaj title + cursor-help polji
old_z1 = "return JSON.stringify({vredRole:!!vredKont, invRole:!!invKont, vredDotRed:vredKont?!!vredKont.querySelector('span[aria-hidden].bg-roksal-red'):false, invDotRed:invKont?!!invKont.querySelector('span[aria-hidden].bg-roksal-red'):false, miniTekst:mini?mini.textContent.trim().slice(0,160):null, legenda, err:window.__err??null});})()\""
new_z1 = "return JSON.stringify({vredRole:!!vredKont, invRole:!!invKont, vredDotRed:vredKont?!!vredKont.querySelector('span[aria-hidden].bg-roksal-red'):false, invDotRed:invKont?!!invKont.querySelector('span[aria-hidden].bg-roksal-red'):false, vredTitle:vredKont?(vredKont.getAttribute('title')||'').includes('Σ — pomeni: nič artiklov nima trenutno veljavne cene'):false, vredHelp:vredKont?vredKont.className.includes('cursor-help'):false, invTitle:invKont?(invKont.getAttribute('title')||'').includes('pod minimumom = akcija naročila'):false, miniTekst:mini?mini.textContent.trim().slice(0,160):null, legenda, err:window.__err??null});})()\""
if old_z1 in s:
    s = s.replace(old_z1, new_z1)
else:
    print('OPOZORILO: Z1 eval vzorec ni najden (že migrirano?)')

# Z1 python: dodaj asercijo title/cursor-help
old_py = "assert d['legenda'], 'Z1 legenda FAIL: '+json.dumps(d)"
new_py = ("assert d['legenda'], 'Z1 legenda FAIL: '+json.dumps(d)\n"
          "assert d['vredTitle'] and d['vredHelp'] and d['invTitle'], 'Z1 title/cursor-help FAIL (R275 razložljivost): '+json.dumps(d)")
if old_py in s and new_py not in s:
    s = s.replace(old_py, new_py)
else:
    print('OPOZORILO: Z1 assert vzorec ni najden (že migrirano?)')

open(p, 'w').write(s)
print('E2E R275 MIGRACIJA KONČANA')
