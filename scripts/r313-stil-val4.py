#!/usr/bin/env python3
# R313 — MANDATORY STIL val 4: surova amber → roksal žetoni (cv-studio ×26,
# measurement-studio ×5, crm-tab ×7 = 38 mest). NATANKO ena-n-točkovne
# exact-match zamenjave (kanon r310/r312-stil: napačno število zadetkov →
# izpisek + exit 1). 6 izjem ostaja NEDOTAKNjenih in se ZAKLENEJO v r313
# STRAŽAR testu:
#   cv-studio 2094: legend beseda 'amber' obarvana amber (barvna legenda —
#                   R308 lekcija: kategorija/legenda)
#   measurement-studio ×3: STATE_BADGE DETECTED/SCALE_REQUIRED/
#                   USER_REVIEW_REQUIRED — barvno kodirani stanji kakovosti
#                   (red/amber/amber/amber/green lestvica — issue #2 §4)
#   crm-tab 148:    POTENCIALEN — status kategorija med AKTIVEN green /
#                   ARHIVIRAN red (R234 komentar že IZRECNO pusti semantično)
import sys
from pathlib import Path

def zam(pot: str, zamene: list[tuple[str, str, int]]) -> None:
    f = Path(pot)
    vir = f.read_text(encoding="utf-8")
    for staro, novo, pricakuj in zamene:
        n = vir.count(staro)
        if n != pricakuj:
            print(f"NAPAKA: {pot}: pričakovano {pricakuj} zadetkov, najdeno {n}:\n  {staro[:100]}")
            sys.exit(1)
        vir = vir.replace(staro, novo)
    f.write_text(vir, encoding="utf-8")
    print(f"OK: {pot} — {sum(z[2] for z in zamene)} zamenjav")

# --- cv-studio.tsx (26 mest; izjema: legend 2094) ---
zam("src/components/roksal/cv-studio.tsx", [
    # 204: STATE_BADGE.NEEDS_CONFIRMATION — status značka (R311 precedens
    # POTRJENO veja: sorojenci PROPOSED/UNKNOWN že žetoni)
    (
        "NEEDS_CONFIRMATION: { label: 'POTRDITEV', cls: 'border-amber-300 bg-amber-100 text-amber-800' }",
        "NEEDS_CONFIRMATION: { label: 'POTRDITEV', cls: 'border-roksal-amber/40 bg-roksal-amber/10 text-roksal-ink' }",
        1,
    ),
    # 739 + 2686: amber veja pomožne Badge/ternare (emerald/red sorodniki ostanejo)
    (
        "'border-amber-300 bg-amber-50 text-amber-800'",
        "'border-roksal-amber/40 bg-roksal-amber/10 text-roksal-ink'",
        2,
    ),
    # 2617: '2D PRIBLIŽEK' Badge veja (HOMOGRAFIJA emerald ostane)
    (
        "'border-amber-400 bg-amber-100 text-amber-900'",
        "'border-roksal-amber/40 bg-roksal-amber/10 text-roksal-ink'",
        1,
    ),
    # 1961: Badge opozorilo (2xs)
    (
        'border-amber-300 bg-amber-50 text-2xs text-amber-800',
        'border-roksal-amber/40 bg-roksal-amber/10 text-2xs text-roksal-ink',
        1,
    ),
    # 2278: Badge opozorilo (9px, 800)
    (
        'border-amber-300 bg-amber-50 text-[9px] text-amber-800',
        'border-roksal-amber/40 bg-roksal-amber/10 text-[9px] text-roksal-ink',
        1,
    ),
    # 3037: Badge opozorilo (9px, 700)
    (
        'border-amber-300 bg-amber-50 text-[9px] text-amber-700',
        'border-roksal-amber/40 bg-roksal-amber/10 text-[9px] text-roksal-ink',
        1,
    ),
    # 2415: opozorilni vsebnik (celoten razred, p-3)
    (
        'rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-800',
        'rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 p-3 text-[11px] text-roksal-ink',
        1,
    ),
    # 891 + 1970 + 2365: Alert vsebniki (py-2)
    (
        'border-amber-300 bg-amber-50 py-2',
        'border-roksal-amber/40 bg-roksal-amber/10 py-2',
        3,
    ),
    # 1051: Alert vsebnik (role=status, brez py-2)
    (
        '<Alert className="border-amber-300 bg-amber-50" role="status">',
        '<Alert className="border-roksal-amber/40 bg-roksal-amber/10" role="status">',
        1,
    ),
    # 892 + 1052 + 1971 + 2366: ikone (TriangleAlert ×3 + Video)
    (
        'h-4 w-4 text-amber-700',
        'h-4 w-4 text-roksal-amber',
        4,
    ),
    # 1053: AlertTitle (po C je text-amber-900 samo še tukaj)
    (
        '<AlertTitle className="text-amber-900">',
        '<AlertTitle className="text-roksal-ink">',
        1,
    ),
    # 893 + 1054 + 1972 + 2367: AlertDescription telo (po G je 2415 porabljen)
    (
        'text-[11px] text-amber-800"',
        'text-[11px] text-roksal-ink"',
        4,
    ),
    # 1979 + 2567: kratka statusna besedila (R225 precedens žeton besedilo)
    (
        'text-2xs text-amber-700"',
        'text-2xs text-roksal-amber"',
        2,
    ),
    # 2637 + 2644 + 2649: seznam opozorilnih vrstic (po D je 1961 porabljen)
    (
        'text-2xs text-amber-800"',
        'text-2xs text-roksal-ink"',
        3,
    ),
])

# --- measurement-studio.tsx (5 mest; izjeme: STATE_BADGE ×3 lestvica) ---
zam("src/components/roksal/measurement-studio.tsx", [
    # 1549: Badge opozorilo
    (
        'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-[9px] text-amber-700 dark:text-amber-300',
        'border-roksal-amber/40 bg-roksal-amber/10 text-[9px] text-roksal-ink',
        1,
    ),
    # 558: opozorilni vsebnik (p-3)
    (
        'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-[11px] text-amber-800 dark:text-amber-200',
        'border-roksal-amber/40 bg-roksal-amber/10 p-3 text-[11px] text-roksal-ink',
        1,
    ),
    # 696 + 1410: opozorilni vsebnik (p-2)
    (
        'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2 text-[11px] text-amber-800 dark:text-amber-200',
        'border-roksal-amber/40 bg-roksal-amber/10 p-2 text-[11px] text-roksal-ink',
        2,
    ),
    # 439: napaka kataloga (kratko besedilo, standalone)
    (
        'text-[11px] text-amber-800 dark:text-amber-200',
        'text-[11px] text-roksal-ink',
        1,
    ),
])

# --- crm-tab.tsx (7 mest; izjema: POTENCIALEN 148) ---
zam("src/components/roksal/crm-tab.tsx", [
    # 739: Opomniki KPI kartica (R225 precedens border-roksal-amber/30)
    (
        '<Card className="border-amber-200 dark:border-amber-500/30">',
        '<Card className="border-roksal-amber/30">',
        1,
    ),
    # 742: Bell ikona KPI
    (
        'h-3 w-3 text-amber-600 dark:text-amber-400',
        'h-3 w-3 text-roksal-amber',
        1,
    ),
    # 745: KPI števec (velik krepki — R225 precedens žeton besedilo)
    (
        'text-lg font-bold text-amber-700 dark:text-amber-300 tabular-nums',
        'text-lg font-bold text-roksal-amber tabular-nums',
        1,
    ),
    # 1064: Badge Opomnik (ink besedilo na žetonu — R311 značka družina)
    (
        'text-3xs bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 shrink-0',
        'text-3xs bg-roksal-amber/10 text-roksal-ink border-roksal-amber/40 shrink-0',
        1,
    ),
    # 1098: hover Uredi gumb (žeton OBE temi)
    (
        'hover:bg-amber-50 hover:text-roksal-navy dark:hover:bg-amber-500/15 dark:hover:text-amber-300',
        'hover:bg-roksal-amber/10 hover:text-roksal-navy',
        1,
    ),
    # 1184: opomnik vsebnik veja (rdeča veja POTEKEL ostane)
    (
        "'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'",
        "'border-roksal-amber/40 bg-roksal-amber/10'",
        1,
    ),
    # 1187: Bell veja (po 742 je h-3 w-3 prefiks porabljen; ta je v ternariju)
    (
        "'text-amber-600 dark:text-amber-400'",
        "'text-roksal-amber'",
        1,
    ),
])

print("STIL val 4: vse zamenjave natanko ujete (38 mest, 6 izjem ostaja).")
