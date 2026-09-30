#!/usr/bin/env python3
# R309 popravilo: vstavljen uvoz je pristal ZNOTRAJ večvrstičnega import { }
# bloka v 5 datotekah (transformator je sidral na 'import {'). Popravek:
# odstrani napačno vrstico, ponovno vstavi za PRAVIM koncem uvoznega bloka
# (zadnja vrstica, ki končuje import: enovrstični 'import ... from' ALI '} from').
import pathlib
import re
import sys

KOREN = pathlib.Path('/home/z/my-project')
IMPORT = "import { preberiJsonTelo } from '@/lib/api-telo'"
# konec import stavka: enovrstični ALI zaključna vrstica večvrstičnega
VZOREC_KONCA = re.compile(r"^(?:import [^{]+from '[^']+'|\} from '[^']+')\s*$")

DATOTEKE = [
    'ar-snapshots', 'material-orders', 'measurements',
    'notifications/read', 'portal',
]

def main() -> int:
    for ime in DATOTEKE:
        pot = KOREN / 'src/app/api' / ime / 'route.ts'
        vrste = pot.read_text().splitlines()
        # 1) odstrani vse obstoječe (napačno postavljene) uvozne vrstice
        brez = [l for l in vrste if l.strip() != IMPORT]
        if len(brez) != len(vrste) - 1:
            print(f'FAIL-CLOSED {ime}: pričakovana natanko 1 obstoječa uvozna vrstica, najdenih {len(vrste) - len(brez)}')
            return 1
        # 2) najdi KONEC uvoznega bloka (zadnja zaključna vrstica importa)
        konci = [i for i, l in enumerate(brez) if VZOREC_KONCA.match(l)]
        if not konci:
            print(f'FAIL-CLOSED {ime}: ni zaključka uvoznega bloka')
            return 1
        brez.insert(konci[-1] + 1, IMPORT)
        pot.write_text('\n'.join(brez) + '\n')
        print(f'OK {ime}: uvoz premaknjen za vrstico {konci[-1] + 1}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
