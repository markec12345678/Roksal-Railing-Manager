#!/usr/bin/env python3
# r396-triaza2.py — R396 druga faza triaže: dark-mode paritete (navy↔ink
# kanon val 52/R369: svetli žeton NOSI dark: ink sorojenca). Kandidati:
#   K5: focus-visible:ring-roksal-navy/* BREZ dark: focus ink parice
#   K6: hover:border-roksal-navy/* BREZ dark:hover:border-roksal-ink/*
#   K7: hover:bg-roksal-navy/* BREZ dark:hover:bg-roksal-ink/*
#   K8: text-roksal-navy BREZ dark:text-roksal-ink (naslovi/poudarki)
# Izhod: števci + datoteka:vrstica.
import re, sys, pathlib
from collections import Counter

ROOT = pathlib.Path('/home/z/my-project')
SRC = ROOT / 'src'
roksal = [p for p in SRC.rglob('*.tsx')]

def classes_of(text):
    for m in re.finditer(r'className=\{?"([^"]+)"', text):
        line = text[:m.start()].count('\n') + 1
        yield line, m.group(1)

k5, k6, k7, k8 = [], [], [], []
for p in sorted(roksal):
    text = p.read_text()
    for line, cs in classes_of(text):
        toks = cs.split()
        # K5: navy focus ring brez ink dark parice (na ISTEM elementu)
        if any(re.fullmatch(r'focus-visible:ring-roksal-navy/\d+', t) for t in toks):
            ima_ink = any(re.fullmatch(r'(focus-visible:)?dark:focus-visible:ring-roksal-ink(/\d+)?', t) or
                          re.fullmatch(r'dark:focus-visible:ring-roksal-ink(/\d+)?', t) for t in toks)
            if not ima_ink:
                k5.append((p.name, line, cs[:110]))
        # K6: navy hover border brez ink dark parice
        if any(re.fullmatch(r'hover:border-roksal-navy(/\d+)?', t) for t in toks):
            ima_ink = any(t.startswith('dark:hover:border-roksal-ink') for t in toks)
            if not ima_ink:
                k6.append((p.name, line, cs[:110]))
        # K7: navy hover bg brez ink dark parice
        if any(re.fullmatch(r'hover:bg-roksal-navy(/\d+)?', t) for t in toks):
            ima_ink = any(t.startswith('dark:hover:bg-roksal-ink') for t in toks)
            if not ima_ink:
                k7.append((p.name, line, cs[:110]))
        # K8: text-navy brez dark:text-ink
        if any(re.fullmatch(r'text-roksal-navy(/\d+)?', t) for t in toks):
            ima_ink = any(t.startswith('dark:text-roksal-ink') for t in toks)
            if not ima_ink:
                k8.append((p.name, line, cs[:110]))

print('=== K5: focus-visible:ring-navy BREZ dark ink parice ===')
c = Counter(f'{x[0]}' for x in k5); print(f'  SKUPAJ: {len(k5)} {dict(c)}')
for x in k5[:8]: print(f'  {x[0]}:{x[1]} {x[2]}')
print('=== K6: hover:border-navy BREZ dark ink parice ===')
c = Counter(f'{x[0]}' for x in k6); print(f'  SKUPAJ: {len(k6)} {dict(c)}')
for x in k6[:8]: print(f'  {x[0]}:{x[1]} {x[2]}')
print('=== K7: hover:bg-navy BREZ dark ink parice ===')
c = Counter(f'{x[0]}' for x in k7); print(f'  SKUPAJ: {len(k7)} {dict(c)}')
for x in k7[:8]: print(f'  {x[0]}:{x[1]} {x[2]}')
print('=== K8: text-navy BREZ dark ink parice ===')
c = Counter(f'{x[0]}' for x in k8); print(f'  SKUPAJ: {len(k8)} {dict(c)}')
for x in k8[:8]: print(f'  {x[0]}:{x[1]} {x[2]}')
