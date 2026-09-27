#!/usr/bin/env python3
# R227 — drift lekcija R225 številka 1 (ponovitev R226 (f)): agent-browser
# eval zahteva EKSPPLICITNO IIFE invokacijo. Predikati v r227 skriptih se
# končajo z `})"` (funkcijski objekt, eval vrne '{}') — popravijo se na
# `})()"`. Idempotentno: že popravljene (`})()"`) regex ne doseže.
# Varnost: popravljamo SAMO vrstice, ki vsebujejo `pocakaj_na "` ali
# `eval "` (kjer gre za JS niz v navedkih).
import re
from pathlib import Path

BASE = Path('/home/z/my-project/scripts')
SKRIPTI = [
    'r227-e2e-browser.sh',
    'r227-prod-probe.sh',
]

VZOREC = re.compile(r'\}\)"')

def popravi_vrstico(vrstica: str) -> tuple[str, int]:
    """Zamenjaj `})"` z `})()"` — le kadar za `})` NI že invokacije `(`."""
    stevec = 0
    out = []
    i = 0
    while True:
        j = vrstica.find('})"', i)
        if j == -1:
            out.append(vrstica[i:])
            break
        out.append(vrstica[i:j])
        out.append('})()"')
        stevec += 1
        i = j + len('})"')
    return ''.join(out), stevec

def main() -> int:
    vse_ok = True
    for ime in SKRIPTI:
        pot = BASE / ime
        if not pot.exists():
            print(f'MISS : {ime} (ne obstaja)')
            vse_ok = False
            continue
        vrstice = pot.read_text(encoding='utf-8').splitlines(keepends=True)
        popravljeno = 0
        nove = []
        for v in vrstice:
            # samo vrstice z JS nizom v pocakaj_na/eval klicu
            if ('pocakaj_na "' in v or 'eval "' in v) and '})()"' not in v and '})"' in v:
                nv, n = popravi_vrstico(v)
                popravljeno += n
                nove.append(nv)
            else:
                nove.append(v)
        pot.write_text(''.join(nove), encoding='utf-8')
        print(f'OK   : {ime} — popravljenih invokacij: {popravljeno}')
    # idempotenčna kontrola: ostankov 0
    ostanki = 0
    for ime in SKRIPTI:
        pot = BASE / ime
        for v in pot.read_text(encoding='utf-8').splitlines():
            if ('pocakaj_na "' in v or 'eval "' in v) and '})"' in v and '})()"' not in v:
                ostanki += 1
                print(f'OSTANEK: {ime}: {v.strip()[:80]}')
    print('OSTANKOV:', ostanki)
    return 0 if (ostanki == 0 and vse_ok) else 1

if __name__ == '__main__':
    raise SystemExit(main())
