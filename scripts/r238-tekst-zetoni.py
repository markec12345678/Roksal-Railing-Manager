#!/usr/bin/env python3
# R238 (P1-e) — mikro tipografska konsolidacija: text-[10px] → text-2xs,
# text-[8px] → text-3xs (žetona --text-2xs/--text-3xs v globals.css @theme).
#
# Varnostne lastnosti:
#  • substring 'text-[10px]' / 'text-[8px]' je unikaten razredni žeton —
#    pojavi se IZKLJUČNO kot razred (className, testne pina, komentarji),
#    nikoli kot del drugega identifikatorja (preverjeno z rg pred zagonom).
#  • variantni prefiksi (sm:text-[10px]) se preslikajo samodejno
#    (substring replace ohranja prefiks).
#  • tailwind-merge klasificira text-2xs/text-3xs kot font-size
#    (isTshirtSize validator) — ISTI konflikt-profil kot arbitrary.
#  • Idempotenten: drugi zagon = 0 sprememb.
#  • Poročilo po datoteki + končna preverjanja (0 ostankov).

from pathlib import Path
import sys

KOREN = Path('/home/z/my-project/src')
PRESLIKAVA = [
    ('text-[10px]', 'text-2xs'),
    ('text-[8px]', 'text-3xs'),
]
PONEDELKI = ('.ts', '.tsx', '.css')

spremenjene = []
skupaj = 0
for pot in sorted(KOREN.rglob('*')):
    if pot.suffix not in PONEDELKI or not pot.is_file():
        continue
    izvorno = pot.read_text(encoding='utf-8')
    besedilo = izvorno
    st_v_datoteki = 0
    for staro, novo in PRESLIKAVA:
        n = besedilo.count(staro)
        if n:
            besedilo = besedilo.replace(staro, novo)
            st_v_datoteki += n
    if st_v_datoteki:
        pot.write_text(besedilo, encoding='utf-8')
        spremenjene.append((str(pot.relative_to(KOREN)), st_v_datoteki))
        skupaj += st_v_datoteki

print(f'Spremenjenih datotek: {len(spremenjene)}, skupaj zadetkov: {skupaj}')
for rel, n in spremenjene:
    print(f'  {n:4d}  {rel}')

# Končna preverjanja: 0 ostankov obeh arbitrary oblik v src/.
ostanki = 0
for pot in KOREN.rglob('*'):
    if pot.suffix not in PONEDELKI or not pot.is_file():
        continue
    vsebina = pot.read_text(encoding='utf-8')
    for staro, _ in PRESLIKAVA:
        if staro in vsebina:
            print(f'OSTANEK: {pot}: {staro}')
            ostanki += 1
if ostanki:
    print(f'NEUSPEH: {ostanki} ostankov')
    sys.exit(1)
print('ČISTO: 0 ostankov arbitrary text-[10px]/text-[8px] v src/.')
