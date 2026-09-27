#!/usr/bin/env python3
# R226 (f) — drift lekcija R225 številka 1: agent-browser eval zahteva
# EKSPPLICITNO IIFE invokacijo. Predikati v starih E2E skriptih (r220–r224)
# se končajo z `})"` (funkcijski objekt, eval vrne '{}') — popravijo se na
# `})()"`. Varnost: popravimo SAMO nize, ki se končajo `})"`  takoj pred
# zaključnim navedkom, kjer že obstaja oblika `})()"` (že popravljeni se
# ne dotaknemo, ker regex ne doseže `})` + `(`).
import re
import sys
from pathlib import Path

BASE = Path('/home/z/my-project/scripts')
SKRIPTI = [
    'r220-e2e-browser.sh',
    'r221-e2e-browser.sh',
    'r222-e2e-browser.sh',
    'r223-e2e-browser.sh',
    'r224-e2e-browser.sh',
    'r225-e2e-browser.sh',
]
# vrstica mora vsebovati klic eval/pocakaj_na/vnesi_iskalni (kjer gre JS niz)
KLIKI = ('eval "', 'pocakaj_na "', 'vnesi_iskalni "')

def popravi_vrstico(vrstica: str) -> tuple[str, int]:
    """Zamenjaj `})"` z `})()"` — le kadar za navedkom ni že invokacije."""
    stevec = 0
    out = []
    i = 0
    while True:
        j = vrstica.find('})"', i)
        if j == -1:
            out.append(vrstica[i:])
            break
        # kaj je pred `})`? poskrbi, da ni že `})()"` (to se ne ujame — `(` ni `"`)
        out.append(vrstica[i:j])
        out.append('})()"')
        stevec += 1
        i = j + len('})"')
    return ''.join(out), stevec

def main() -> int:
    skupaj = 0
    for ime in SKRIPTI:
        p = BASE / ime
        if not p.exists():
            print(f'MANJKA: {p}')
            continue
        izvorno = p.read_text(encoding='utf-8')
        vrstice = izvorno.split('\n')
        popravljeno = 0
        nove = []
        for vrstica in vrstice:
            if ('})"' in vrstica) and any(k in vrstica for k in KLIKI):
                nova, n = popravi_vrstico(vrstica)
                if n:
                    popravljeno += n
                nove.append(nova)
            else:
                nove.append(vrstica)
        if popravljeno:
            p.write_text('\n'.join(nove), encoding='utf-8')
        print(f'{ime}: popravljenih predikatov {popravljeno}')
        skupaj += popravljeno
    print(f'SKUPAJ: {skupaj}')
    # preverjanje: po popravku ne sme ostati noben `})"` v klicnih vrsticah
    ostanek = 0
    for ime in SKRIPTI:
        p = BASE / ime
        if not p.exists():
            continue
        for vrstica in p.read_text(encoding='utf-8').split('\n'):
            if ('})"' in vrstica) and any(k in vrstica for k in KLIKI):
                ostanek += 1
                print(f'OSTANEK {ime}: {vrstica[:120]}')
    print(f'OSTANKI: {ostanek}')
    return 0 if ostanek == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
