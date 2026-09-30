#!/usr/bin/env python3
# r314-stil-val5.py — MANDATORY STIL val 5 (r162/r308/R310/R311/R312/R313 vzorec):
#   calculator-tab ×8 vrstic + post-signature-panel ×7 + photo-tab ×5
#   (2 izrecni izjemi ZAKLENJENI: photo-tab KATEGORIJE MED značka + stats.med
#   KPI števec — barvno kodirana kategorija faze PRED blue / MED amber / PO
#   green, R308/R312 lekcija; vse ostalo → roksal žetoni, 0 novih hex).
# NATANKO ena-n-točkovne zamenjave — fail-closed: napačno štetje zadetkov →
# izpisek + exit 1 (kanon r310-migriraj-val3 / r312-stil-val3 / r313-stil-val4).

import sys
from pathlib import Path

KOREN = Path('/home/z/my-project/src/components/roksal')

def zam(pot: str, staro: str, novo: str, pricakuj: int) -> None:
    f = KOREN / pot
    v = f.read_text(encoding='utf-8')
    n = v.count(staro)
    if n != pricakuj:
        print(f'FAIL: {pot}: pričakovano {pricakuj}× zadetkov za vzorec '
              f'({staro[:60]}…), najdeno {n} — brez pisanja')
        sys.exit(1)
    f.write_text(v.replace(staro, novo), encoding='utf-8')
    print(f'  OK {pot}: {n}× {staro[:56]}')

# --- calculator-tab (8 vrstic: 2× card, 2× ikona, 2× opomba, 1× gumb, 1× warn) ---
zam('calculator-tab.tsx',
    "'border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/40'",
    "'border-roksal-amber/40 bg-roksal-amber/10'",
    2)
zam('calculator-tab.tsx',
    "'text-amber-600 dark:text-amber-400'",
    "'text-roksal-amber'",
    2)
zam('calculator-tab.tsx',
    "'font-medium text-amber-800 dark:text-amber-200'",
    "'font-medium text-roksal-ink'",
    2)
zam('calculator-tab.tsx',
    "'border-amber-300 bg-white text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300 hover:border-amber-400 dark:hover:border-amber-700'",
    "'border-roksal-amber/40 bg-background text-roksal-ink hover:border-roksal-amber'",
    1)
# zamrzovalna globina opozorilo: besedilo ink (r162), žeton NA ikoni
zam('calculator-tab.tsx',
    'text-[11px] leading-snug text-amber-700 dark:text-amber-300',
    'text-[11px] leading-snug text-roksal-ink',
    1)
zam('calculator-tab.tsx',
    '<AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />',
    '<AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber" />',
    1)

# --- post-signature-panel (7 vrstic, nič izjem) ---
zam('post-signature-panel.tsx',
    '"border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40"',
    '"border-roksal-amber/40 bg-roksal-amber/10"',
    1)
zam('post-signature-panel.tsx',
    'h-8 w-8 mx-auto text-amber-500 dark:text-amber-400 mb-2',
    'h-8 w-8 mx-auto text-roksal-amber mb-2',
    1)
zam('post-signature-panel.tsx',
    'text-sm font-medium text-amber-900 dark:text-amber-200',
    'text-sm font-medium text-roksal-ink',
    1)
zam('post-signature-panel.tsx',
    'text-xs text-amber-700 dark:text-amber-300 mt-1',
    'text-xs text-roksal-ink/80 mt-1',
    1)
zam('post-signature-panel.tsx',
    '"border-amber-200 dark:border-amber-800"',
    '"border-roksal-amber/40"',
    1)
zam('post-signature-panel.tsx',
    'h-4 w-4 text-amber-600 dark:text-amber-400',
    'h-4 w-4 text-roksal-amber',
    1)
zam('post-signature-panel.tsx',
    'rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2 text-2xs text-amber-800 dark:text-amber-200',
    'rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 p-2 text-2xs text-roksal-ink',
    1)

# --- photo-tab (5 harmoniziranih + 2 IZRECNI izjemi ZAKLENJENI) ---
zam('photo-tab.tsx',
    'rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800',
    'rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 p-3 text-xs text-roksal-ink',
    1)
zam('photo-tab.tsx',
    '<AlertTriangle aria-hidden="true" className="mb-1 inline h-3.5 w-3.5" />',
    '<AlertTriangle aria-hidden="true" className="mb-1 inline h-3.5 w-3.5 text-roksal-amber" />',
    1)
zam('photo-tab.tsx',
    'h-10 w-10 text-amber-400',
    'h-10 w-10 text-roksal-amber',
    1)
zam('photo-tab.tsx',
    'rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-2xs text-amber-900',
    'rounded-md border border-roksal-amber/40 bg-roksal-amber/10 px-2 py-1.5 text-2xs text-roksal-ink',
    1)
zam('photo-tab.tsx',
    'border-t border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900',
    'border-t border-roksal-amber/40 bg-roksal-amber/10 px-3 py-2 text-[11px] text-roksal-ink',
    1)
zam('photo-tab.tsx',
    'hover:bg-amber-100',
    'hover:bg-roksal-amber/25',
    1)

# --- končna preverba: ostanki surove amber po datotekah (izjeme izrecne) ---
import re
SUROVA = re.compile(r'amber-(50|100|200|300|400|500|600|700|800|900|950)\b')
IZJEME = {
    'photo-tab.tsx': [
        "{ id: 'MED', label: 'Med montažo', short: 'Med', cls: 'bg-amber-100 text-amber-800' },",
        '<div className="text-base font-bold text-amber-700">{stats.med}</div>',
    ],
}
napake = 0
for dat in ['calculator-tab.tsx', 'post-signature-panel.tsx', 'photo-tab.tsx']:
    vir = (KOREN / dat).read_text(encoding='utf-8')
    vrstice = [v.strip() for v in vir.split('\n')
               if SUROVA.search(v) and 'roksal-amber' not in v]
    dovoljene = IZJEME.get(dat, [])
    ostalo = [v for v in vrstice if v not in dovoljene]
    print(f'  {dat}: surovih vrstic {len(vrstice)} (izjem {len([v for v in vrstice if v in dovoljene])})')
    if ostalo:
        for v in ostalo:
            print(f'    OSTANEK {dat}: {v[:100]}')
        napake += 1
if napake:
    print(f'FAIL: {napake} datotek z neočakanimi ostanki')
    sys.exit(1)
print('r314-stil-val5: VSE ZELENO (20 harmoniziranih vrstic, 2 izjemi zaklenjeni)')
