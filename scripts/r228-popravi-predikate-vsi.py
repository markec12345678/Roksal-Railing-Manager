#!/usr/bin/env python3
# R228 (f) — drift lekcija R225 številka 1, GENERALIZIRANI popravljalnik:
# vsi skripti v scripts/ s pocakaj_na/eval JS nizi, ki se končajo `})"`
# (funkcijski objekt, eval vrne '{}') → `})()"` (eksplicitna IIFE
# invokacija). Idempotenten; varnostni filter: samo vrstice s klicem
# pocakaj_na "/eval "/vnesi_iskalni " in brez že prisotne invokacije.
# Pokrije ostanke, ki jih R226 (r220–r225 E2E) in R227 (r227 skripti)
# niso zajele (npr. r221/r222 prod-probe), in vse STAREJŠE skripte.
import re
import sys
from pathlib import Path

BASE = Path('/home/z/my-project/scripts')
VZOREC_KLICA = ('pocakaj_na "', 'eval "', 'vnesi_iskalni "')

def popravi_vrstico(vrstica: str) -> tuple[str, int]:
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
    skripti = sorted(BASE.glob('*.sh')) + sorted(BASE.glob('*.py'))
    popravljeno_skupaj = 0
    dotaknjeni = []
    for pot in skripti:
        if pot.name == 'r228-popravi-predikate-vsi.py':
            continue
        try:
            vrstice = pot.read_text(encoding='utf-8').splitlines(keepends=True)
        except UnicodeDecodeError:
            continue
        nove = []
        popravljeno = 0
        for v in vrstice:
            if any(k in v for k in VZOREC_KLICA) and '})()"' not in v and '})"' in v:
                nv, n = popravi_vrstico(v)
                popravljeno += n
                nove.append(nv)
            else:
                nove.append(v)
        if popravljeno > 0:
            pot.write_text(''.join(nove), encoding='utf-8')
            dotaknjeni.append(f'{pot.name}: {popravljeno}')
            popravljeno_skupaj += popravljeno
    for d in dotaknjeni:
        print(f'OK   : {d}')
    # idempotenčna kontrola: ostankov 0 čez vse skripte
    ostanki = 0
    for pot in sorted(BASE.glob('*.sh')):
        for v in pot.read_text(encoding='utf-8', errors='replace').splitlines():
            if any(k in v for k in VZOREC_KLICA) and '})"' in v and '})()"' not in v:
                ostanki += 1
                print(f'OSTANEK: {pot.name}: {v.strip()[:80]}')
    print('SKUPAJ popravljenih invokacij:', popravljeno_skupaj)
    print('OSTANKOV:', ostanki)
    return 0 if ostanki == 0 else 1

if __name__ == '__main__':
    raise SystemExit(main())
