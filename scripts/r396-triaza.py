#!/usr/bin/env python3
# r396-triaza.py — R396 sveža stil triaža (kanon runda: triaža PRED izbiro
# val 71). Pregleda roksal render plast (src) po kandidatnih družinah:
#   K1: duration-* konsistenca Card hover družina (handover kandidat 1)
#   K2: goli outline-none vnosna polja focus: paradigma (handover kandidat 2)
#   K3: ring-offset dark-mode vrzel — ring-offset-N BREZ dark:ring-offset
#       (Tailwind gotcha: --tw-ring-offset-color privzeto #fff → v temnem
#       načinu je 2px odmik BEL obroček na temnem ozadju — REALNA vidna
#       napaka, če obstaja)
#   K4: hover:scale BREZ transition-transform pokritosti (kanon r392 —
#       kontrolni cenzus, pričakovano 0 po val 69/r392)
# Izhod: per-kandidat števci + seznam zadetkov (datoteka:vrstica).
import re, sys, pathlib

ROOT = pathlib.Path('/home/z/my-project')
SRC = ROOT / 'src'
if not SRC.exists():
    sys.exit('FAILOVEDANO: src/ ne obstaja (napačno drevo?)')

files = [p for p in SRC.rglob('*.tsx') if 'roksal' in str(p) or True]
roksal = [p for p in SRC.rglob('*.tsx') if str(p).startswith(str(SRC))]

def classes_of(text):
    # element-točna className span parser (kanon LEKCIJA R388 (1))
    for m in re.finditer(r'className=\{?"([^"]+)"', text):
        line = text[:m.start()].count('\n') + 1
        yield line, m.group(1)

k1_hit, k2_hit, k3_hit, k4_hit = [], [], [], []
cls_all = []
for p in sorted(roksal):
    if '/app/' in str(p) and 'roksal' not in str(p):
        pass
    text = p.read_text()
    for line, cs in classes_of(text):
        toks = cs.split()
        cls_all.append((p, line, toks))
        # K1: transition z duration
        if any(t.startswith('duration-') for t in toks):
            k1_hit.append((p.name, line, [t for t in toks if t.startswith('duration-') or t.startswith('transition')]))
        # K2: goli outline-none (focus: paradigma, brez focus-visible:)
        if 'outline-none' in toks and not any(t.startswith('focus-visible:') for t in toks):
            k2_hit.append((p.name, line, cs[:90]))
        # K3: ring-offset-N brez dark:ring-offset(-...)? in brez ring-offset-<barva>
        for t in toks:
            mro = re.fullmatch(r'ring-offset-(\d)', t)
            if mro:
                ima_dark = any(x.startswith('dark:ring-offset') for x in toks)
                ima_barvo = any(re.fullmatch(r'(dark:)?ring-offset-[a-z]', x) for x in toks if 'ring-offset-' in x and not re.fullmatch(r'ring-offset-\d', x))
                if not ima_dark and not ima_barvo:
                    k3_hit.append((p.name, line, t, cs[:110]))
        # K4: hover:scale brez transform pokritosti (kontrola)
        if any(t.startswith('hover:scale-') for t in toks):
            pokrito = any(t.startswith('transition-transform') or t.startswith('transition-[') for t in toks)
            if not pokrito:
                k4_hit.append((p.name, line, cs[:90]))

print('=== K1: duration-* najdeni (kontekst transition) ===')
from collections import Counter
c1 = Counter(str(x[2]) for x in k1_hit)
for k, v in sorted(c1.items()):
    print(f'  ×{v}: {k[:130]}')

print('=== K2: goli outline-none roksal (focus: paradigma) ===')
c2 = Counter(f'{x[0]}' for x in k2_hit)
print(f'  SKUPAJ: {len(k2_hit)} (datoteke: {dict(c2)})')

print('=== K3: ring-offset-N BREZ dark:ring-offset / ring-offset-barve ===')
c3 = Counter(f'{x[0]} {x[2]}' for x in k3_hit)
for k, v in sorted(c3.items()):
    print(f'  ×{v}: {k}')
print(f'  SKUPAJ: {len(k3_hit)}')

print('=== K4: hover:scale brez transform pokritosti (kontrolni cenzus) ===')
print(f'  SKUPAJ: {len(k4_hit)}')
for x in k4_hit[:10]:
    print(f'  {x[0]}:{x[1]} {x[2]}')
