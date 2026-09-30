#!/usr/bin/env python3
# r315-stil-val6.py — MANDATORY STIL val 6 (r162/r308/R310/R311/R312/R313/
# R314 vzorec): inclinometer-tab ×5 (+1 ZAKLENJENA izjema: senzorjska lestvica
# denied=red / unsupported=amber — R308/R311 lekcija) + site-survey-tab ×4
# (+1 ZAKLENJENA izjema: PODLAGA kategorija barv p.barva z rdečim bratom —
# R308/R311 lekcija) + ar-scanner ×3 + pwa-status ×3 + ikona žeton +
# password-change-banner ×3 = 19 dotikov — surove amber → roksal žetoni,
# 0 novih hex. measurements-tab ×5 ostaja R311 ZAKLENJENO (les/WPC kategoriji
# + priporociloColor + senzorjska besedila — že v r311 STRAŽARju).
# NATANKO ena-n-točkovne zamenjave — fail-closed: napačno štetje zadetkov →
# izpisek + exit 1 (kanon r310-migriraj-val3 / r314-stil-val5).

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

# --- inclinometer-tab (5 konverzij: 1 hint + 1 vsebnik + 1 ikona + 2 besedili) ---
# opozorilo: brez vsebnika → besedilo ink (r162; ni del senzorjske lestvice)
zam('inclinometer-tab.tsx',
    'text-center text-2xs text-amber-600 dark:text-amber-400',
    'text-center text-2xs text-roksal-ink',
    1)
# zgodovina NAPAKA alert: vsebnik žeton (temni obrati odveč — žetona dvotematska)
zam('inclinometer-tab.tsx',
    'flex flex-col gap-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5',
    'flex flex-col gap-2 rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 px-3 py-2.5',
    1)
# ikona nosi žeton (r162)
zam('inclinometer-tab.tsx',
    '<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />',
    '<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-roksal-amber" aria-hidden="true" />',
    1)
# naslov opozorila: besedilo ink (r162)
zam('inclinometer-tab.tsx',
    'text-xs font-medium text-amber-800 dark:text-amber-200',
    'text-xs font-medium text-roksal-ink',
    1)
# telo opozorila: besedilo ink (r162)
zam('inclinometer-tab.tsx',
    'text-[11px] text-amber-700 dark:text-amber-300',
    'text-[11px] text-roksal-ink',
    1)

# --- site-survey-tab (4 konverzije: estrih kartica + estrih opomba + warn
#     element + warn besedilo; PODLAGA kategorija ZAKLENJENA) ---
# estrih kartica — precedent calculator val 5 (ista semantika pozornosti)
zam('site-survey-tab.tsx',
    "'border-amber-300 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-950/40'",
    "'border-roksal-amber/40 bg-roksal-amber/10'",
    1)
# estrih opomba: vsebnik žeton + besedilo ink (r162)
zam('site-survey-tab.tsx',
    'rounded-lg bg-amber-100 dark:bg-amber-500/15 px-2.5 py-2 text-2xs font-medium leading-relaxed text-amber-900 dark:text-amber-200',
    'rounded-lg bg-roksal-amber/10 px-2.5 py-2 text-2xs font-medium leading-relaxed text-roksal-ink',
    1)
# estrih opomba ikona: žeton NA ikoni (r162)
zam('site-survey-tab.tsx',
    '<TriangleAlert aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />',
    '<TriangleAlert aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-roksal-amber" />',
    1)
# warn orodje element: vsebnik žeton (material brat že navy žeton)
zam('site-survey-tab.tsx',
    "'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40'",
    "'border-roksal-amber/40 bg-roksal-amber/10'",
    1)
# warn besedilo: ink (vsebnik nosi žeton — r162); ternara izgubi namen →
# poenostavljena v literal (razred enak v OBEH vejah — mrtva ternara izginja)
zam('site-survey-tab.tsx',
    '`block text-[11px] font-bold leading-snug ${item.kind === \'warn\' ? \'text-amber-800 dark:text-amber-200\' : \'text-roksal-ink\'}`',
    '"block text-[11px] font-bold leading-snug text-roksal-ink"',
    1)

# --- ar-scanner (3 konverzije: lowLight značka + zoom accent + zaupanje značka) ---
# lowLight opozorilna značka čez video: solid žeton + belo (bottom-nav/meritve precedens)
zam('ar-scanner.tsx',
    'bg-amber-600/90 text-white border-transparent shadow-md animate-pulse',
    'bg-roksal-amber/90 text-white border-transparent shadow-md animate-pulse',
    1)
# zoom drsnik: accent žeton (site-survey accent-roksal-amber precedens)
zam('ar-scanner.tsx',
    'className="flex-1 accent-amber-500"',
    'className="flex-1 accent-roksal-amber"',
    1)
# zaupanje pod pragom: vsebnik žeton + besedilo ink (STATE_BADGE.NEEDS_CONFIRMATION kanon; zelen brat že žeton)
zam('ar-scanner.tsx',
    ": 'bg-amber-100 text-amber-700',",
    ": 'bg-roksal-amber/15 text-roksal-ink',",
    1)

# --- pwa-status (3 konverzije + ikona žeton: offline baner) ---
zam('pwa-status.tsx',
    'mb-1.5 flex items-center gap-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-amber-900 dark:text-amber-200 shadow-sm',
    'mb-1.5 flex items-center gap-2.5 rounded-xl border border-roksal-amber/40 bg-roksal-amber/10 px-3 py-2 text-roksal-ink shadow-sm',
    1)
# WifiOff ikona podeduje vsebnikovo barvo — žeton NA ikoni (r162, val 5 precedens)
zam('pwa-status.tsx',
    '<WifiOff aria-hidden="true" className="h-4 w-4 shrink-0" />',
    '<WifiOff aria-hidden="true" className="h-4 w-4 shrink-0 text-roksal-amber" />',
    1)
zam('pwa-status.tsx',
    'truncate text-2xs leading-tight text-amber-800 dark:text-amber-200',
    'truncate text-2xs leading-tight text-roksal-ink',
    1)
# čakalna značka: solid žeton + belo (bottom-nav precedens)
zam('pwa-status.tsx',
    'rounded-full bg-amber-500 px-1.5 text-2xs font-bold text-white',
    'rounded-full bg-roksal-amber px-1.5 text-2xs font-bold text-white',
    1)

# --- password-change-banner (3 konverzije: ikona + besedilo + gumb) ---
zam('password-change-banner.tsx',
    'h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400',
    'h-4 w-4 shrink-0 text-roksal-amber',
    1)
zam('password-change-banner.tsx',
    'text-[12px] font-medium text-amber-800 dark:text-amber-200',
    'text-[12px] font-medium text-roksal-ink',
    1)
# solid gumb: žeton + belo + hover /90 (ar-scanner ×4 precedens)
zam('password-change-banner.tsx',
    'h-7 bg-amber-600 text-[11px] text-white hover:bg-amber-700',
    'h-7 bg-roksal-amber text-[11px] text-white hover:bg-roksal-amber/90',
    1)

print('VAL 6 KONČAN — 19 dotikov (18 konverzij + 1 ikona žeton), 0 novih hex')
