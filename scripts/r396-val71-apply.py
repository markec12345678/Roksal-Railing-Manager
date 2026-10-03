#!/usr/bin/env python3
# r396-val71-apply.py — val 71 DARK-MODE SCROLLBAR PARITETA (FAIL-CLOSED +
# IDEMPOTENTEN, kanon apply skript R383/R392/R394).
#
# DRUŽINA: .scrollbar-thin (×33 rab v app/roksal render plastah) ima SAMO
# svetli palec (#cbd5e1 slate-300) — v temni temi = SVETEL palec na temni
# površini (vidna nekonsistenost). Kodna baza ŽE nosi temno govorico
# družine: .scrollbar-thin-dark (#475569 slate-600 + hover #334155
# slate-700, globals.css STYLE 1) — definirana, a NIKOLI povezana (×0 rab;
# mrtvi CSS). val 71 = poveže obstoječo temno govorico NA .scrollbar-thin
# pod .dark: VREDNOSTI IZ ISTE družine (nič izuma — točno #475569 +
# #334155). Svetla tema: NESPREMENJENA (dodatek je izključno pod .dark).
# CSS-nivojska sprememba — NIČ className žetonov → NIČ needle/window pinov.
#
# POST-zagotovila:
#   1. blok `.dark .scrollbar-thin::-webkit-scrollbar-thumb` obstaja TOČNO ×1
#   2. vrednosti #475569 + #334155 prisotni v novem bloku
#   3. svetli blok .scrollbar-thin::-webkit-scrollbar-thumb (#cbd5e1) bajtno
#      nespremenjen
#   4. .scrollbar-thin-dark blok bajtno nespremenjen (mrtvi CSS ostane,
#      dokumentiran — NIČ brisanja brez naročila)
#   5. idempotenca: 2. tek abort (blok že obstaja)
import pathlib, sys

GS = pathlib.Path('/home/z/my-project/src/app/globals.css')
if not GS.exists():
    sys.exit('FAILOVEDANO: globals.css manjka')

src = GS.read_text()

if '.dark .scrollbar-thin::-webkit-scrollbar-thumb' in src:
    sys.exit('ABORT (idempotenca): .dark .scrollbar-thin blok ŽE obstaja — nič ne delam')

# 3) svetli blok mora biti prisoten v pričakovani obliki (disk resnica PREJ)
SVETLI = """.scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 20px;
  }"""
if SVETLI not in src:
    sys.exit('FAILOVEDANO: svetli .scrollbar-thin thumb blok NI v pričakovani obliki (disk resnica drugačna) — fail-closed abort')

# 4) temna govorica družine mora obstajati (vir vrednosti)
if '#475569' not in src or '#334155' not in src:
    sys.exit('FAILOVEDANO: .scrollbar-thin-dark vrednosti (#475569/#334155) manjkajo — fail-closed abort')

DODATEK = """
  /* val 71 (R396) — DARK-MODE SCROLLBAR PARITETA: .scrollbar-thin je nosil
     svetli palec (#cbd5e1) v OBEH temah — v temni temi svetel palec na
     temni površini (33 rab čez app/roksal). Temna govorica družine ŽE
     obstaja kot .scrollbar-thin-dark (#475569 + hover #334155, STYLE 1
     zgoraj — definirana, a ×0 rab); val 71 jo poveže na .scrollbar-thin
     pod .dark — VREDNOSTI IZ ISTIH ŽETONOV, nič izuma. Svetla tema
     nespremenjena; eksplicitni -dark utility ostane (namenski Always-dark
     primeri). */
  .dark .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: #475569;
  }
  .dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background-color: #334155;
  }
"""

# Vstavi TAKOJ za svetli thumb blok (pred STYLE 1) — družinska soseščina.
锚 = SVETLI + "\n"
if 锚 not in src:
    sys.exit('FAILOVEDANO: vstavitvena točka (svetli blok + presledek) ni najdena')
out = src.replace(锚, 锚 + DODATEK, 1)

# POST-pogoji (fail-closed, pred pisanjem) — ':hover' nosi bazični selektor
# kot PREDPONO podniza, zato štejemo z zaključnim ' {'
assert out.count('.dark .scrollbar-thin::-webkit-scrollbar-thumb {') == 1, 'POST 1 fail'
assert out.count('.dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {') == 1, 'POST 1b fail'
assert '#475569' in DODATEK and '#334155' in DODATEK, 'POST 2 fail'
assert SVETLI in out and out.count(SVETLI) == 1, 'POST 3 fail'
assert out.count('scrollbar-thin-dark::-webkit-scrollbar-thumb {') == 1, 'POST 4 fail'
n_dat = out.count('\n') - src.count('\n')
assert n_dat == DODATEK.count('\n'), 'POST 5 fail (nove vrstice)'

GS.write_text(out)
print(f'OK: val 71 apply — .dark .scrollbar-thin thumb pariteta vstavljena (+{n_dat} vrstic, vrednosti #475569/#334155 iz družine; svetla tema bajtno nespremenjena)')
