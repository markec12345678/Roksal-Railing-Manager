#!/usr/bin/env python3
# r316-stil-val7.py — MANDATORY STIL val 7 (r162/r308/R310/R311/R312/R313/R314/
# R315 vzorec): ZAKLJUČNI val surove amber harmonizacije — 5 dotikov v 4
# datotekah (fence-3d-viewer ×2 ikoni + notification-center ×1 ikona +
# signature-quote ×1 hint + photo-measure ×1 hint), 0 novih hex.
# Vse OSTALE surove amber vrstice v src/components/roksal so SEMANTIČNI
# barvno kodirani sistemi (lestvice/kategorije/palete — R308 lekcija) in
# ostanejo ZAKLENJENI v r316-stil-val7.test.ts GLOBALNI registru.
# Idempotenten: po konverziji vzorci ne obstajajo več → vsak zam mora najti
# natanko 1 zadetek (drugi tek = fail-closed zarja — dokaz izčrpanosti).
import sys

def zam(src, stari, novi, pricakuj):
    n = src.count(stari)
    if n != pricakuj:
        print(f'FAIL: pričakovano {pricakuj} pojavitev, najdeno {n}:\n{stari}')
        sys.exit(1)
    return src.replace(stari, novi)

FENCE = 'src/components/roksal/fence-3d-viewer.tsx'
NOTIF = 'src/components/roksal/notification-center.tsx'
SIGQ = 'src/components/roksal/signature-quote.tsx'
PHM = 'src/components/roksal/photo-measure.tsx'

# 1+2) fence-3d-viewer: 2 ikoni (AlertTriangle loadError + Smartphone AR hint)
#      → roksal-amber žeton (R315 pwa-status WifiOff precedens)
s = open(FENCE, encoding='utf-8').read()
s = zam(s,
        '<AlertTriangle aria-hidden="true" className="h-8 w-8 text-amber-400" />',
        '<AlertTriangle aria-hidden="true" className="h-8 w-8 text-roksal-amber" />',
        1)
s = zam(s,
        '<Smartphone aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />',
        '<Smartphone aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber" />',
        1)
open(FENCE, 'w', encoding='utf-8').write(s)

# 3) notification-center: weather AlertTriangle ikona (dark par odpade —
#    žeton je dvotemen po naravi; r162 lekcija)
s = open(NOTIF, encoding='utf-8').read()
s = zam(s,
        "<AlertTriangle aria-hidden=\"true\" className=\"h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400\" />",
        "<AlertTriangle aria-hidden=\"true\" className=\"h-3 w-3 shrink-0 text-roksal-amber\" />",
        1)
open(NOTIF, 'w', encoding='utf-8').write(s)

# 4) signature-quote: hint besedilo → ink (R315 inclinometer hint precedens:
#    ista oblika 'text-center text-2xs')
s = open(SIGQ, encoding='utf-8').read()
s = zam(s,
        '<p className="text-center text-2xs text-amber-600 dark:text-amber-400">',
        '<p className="text-center text-2xs text-roksal-ink">',
        1)
open(SIGQ, 'w', encoding='utf-8').write(s)

# 5) photo-measure: hint besedilo → ink (R315 hint precedens)
s = open(PHM, encoding='utf-8').read()
s = zam(s,
        '<p className="text-center text-[9px] text-amber-600 dark:text-amber-400">Za shranjevanje izberi projekt.</p>',
        '<p className="text-center text-[9px] text-roksal-ink">Za shranjevanje izberi projekt.</p>',
        1)
open(PHM, 'w', encoding='utf-8').write(s)

print('VAL 7 KONČAN — 5 dotikov (fence-3d-viewer ×2 + notification-center ×1 + signature-quote ×1 + photo-measure ×1)')
