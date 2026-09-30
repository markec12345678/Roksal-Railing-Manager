#!/usr/bin/env python3
# R312 — MANDATORY STIL val 3: surova amber → roksal žetoni (dashboard-tab,
# logistics-tab, webxr-scanner). NATANKO ena-n-točkovne exact-match
# zamenjave (kanon r310-migriraj-val3: napačno štetje zadetkov → izpisek +
# exit 1). 2 izjemi (logistics STATUS_COLORS.V_TEKU + EQUIPMENT_STATUS_COLORS.
# V_SERVISU — kategorije barv med sorodniki, R308 lekcija + R234 komentar)
# ostajata NEDOTAKNjeni in se ZAKLENETA v r312 STRAŽAR testu.
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

# --- dashboard-tab.tsx (16 mest) — IZVEDENO (prvi tek OK) ---
if False:
    zam("src/components/roksal/dashboard-tab.tsx", [
    # Ureja pisarna baner ×2 (svetli surovi + dark žeton dvojček → žeton OBE teme)
    (
        'border border-amber-200 bg-amber-50/70 px-2.5 py-2 dark:border-roksal-amber/25 dark:bg-roksal-amber/10',
        'border border-roksal-amber/40 bg-roksal-amber/10 px-2.5 py-2',
        2,
    ),
    # Info ikona banera ×2 (različni prefiksi razredov)
    (
        'mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-roksal-amber',
        'mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-amber',
        2,
    ),
    # baner naslov ×2
    (
        'text-[11px] font-medium text-amber-800 dark:text-roksal-amber',
        'text-[11px] font-medium text-roksal-ink',
        2,
    ),
    # baner telo ×2
    (
        'text-[11px] text-amber-700/90 leading-relaxed dark:text-roksal-amber/80',
        'text-[11px] text-roksal-ink/80 leading-relaxed',
        2,
    ),
    # expCritical ikona ×1 + mCritical ikona ×1 (isti niz, ${ prefix na isti vrstici)
    (
        "${expCritical ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}",
        "${expCritical ? 'text-roksal-amber' : 'text-muted-foreground'}",
        1,
    ),
    (
        "${mCritical ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}",
        "${mCritical ? 'text-roksal-amber' : 'text-muted-foreground'}",
        1,
    ),
    # expCritical besedilo ×1 + mCritical besedilo ×1 (ločena vrstica v template literal)
    (
        "expCritical ? 'text-amber-600 dark:text-amber-400' : 'text-roksal-ink'",
        "expCritical ? 'text-roksal-amber' : 'text-roksal-ink'",
        1,
    ),
    (
        "mCritical ? 'text-amber-600 dark:text-amber-400' : 'text-roksal-ink'",
        "mCritical ? 'text-roksal-amber' : 'text-roksal-ink'",
        1,
    ),
    # manjkajoči kontakt opozorilo ×1
    (
        'text-2xs text-amber-600 dark:text-amber-400 leading-tight',
        'text-2xs text-roksal-amber leading-tight',
        1,
    ),
    # Info ikona ×2 (različni bloki)
    (
        'h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400',
        'h-3.5 w-3.5 shrink-0 text-roksal-amber',
        2,
    ),
    # Badge Izdana (žeton besedilo — vzorec sorojenca rdečega Badge-a)
    (
        'bg-roksal-amber/15 text-amber-700 dark:text-amber-300 hover:bg-roksal-amber/25',
        'bg-roksal-amber/15 text-roksal-amber hover:bg-roksal-amber/25',
        1,
    ),
])

# --- logistics-tab.tsx (7 harmoniziranih mest; 2 izjemi ostane) — IZVEDENO ---
if False:
    zam("src/components/roksal/logistics-tab.tsx", [
    # gumb 'Začni montažo' (žeton vsebnik — OBE temi)
    (
        'h-6 text-2xs bg-amber-50 dark:bg-amber-950/40 focus-visible:ring-2 focus-visible:ring-roksal-navy/40',
        'h-6 text-2xs bg-roksal-amber/10 focus-visible:ring-2 focus-visible:ring-roksal-navy/40',
        1,
    ),
    # kalibracija-manjka pilona (sorojenec rdeče pilone — samo amber družina v obsegu)
    (
        'inline-flex items-center gap-1 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-amber-800 dark:text-amber-200',
        'inline-flex items-center gap-1 rounded border border-roksal-amber/40 bg-roksal-amber/10 px-1.5 py-0.5 text-roksal-ink',
        1,
    ),
    # pregled zadelju (kratka opozorilna naslova — R225 precedens žeton besedilo)
    (
        "Pregled zadelju{e.nextInspectionAt ? ` (rok ${formatDate(e.nextInspectionAt)})` : ''}</span>",
        "Pregled zadelju{e.nextInspectionAt ? ` (rok ${formatDate(e.nextInspectionAt)})` : ''}</span>",
        1,
    ),
    (
        '<span className="font-semibold text-amber-700 dark:text-amber-300">Pregled zadelju',
        '<span className="font-semibold text-roksal-amber">Pregled zadelju',
        1,
    ),
    (
        '<span className="text-amber-700 dark:text-amber-300">Pregled ni še zabeležen',
        '<span className="text-roksal-amber">Pregled ni še zabeležen',
        1,
    ),
    # QC napake naslov (kratka semibold + ikona deduje žeton)
    (
        '<span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">\n                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" /> Napake:',
        '<span className="inline-flex items-center gap-1 font-semibold text-roksal-amber">\n                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" /> Napake:',
        1,
    ),
    # predaja opomba (daljše telo → ink, r162 lekcija)
    (
        '<p className="mt-1 text-2xs text-amber-700 dark:text-amber-300">\n                    Predaja zahteva PRED in PO fotografijo',
        '<p className="mt-1 text-2xs text-roksal-ink/80">\n                    Predaja zahteva PRED in PO fotografijo',
        1,
    ),
    # checklist opozorilo (kratka semibold + ikona)
    (
        '<span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">\n                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" /> Neizpolnjene postavke potrebujejo opombo',
        '<span className="inline-flex items-center gap-1 font-semibold text-roksal-amber">\n                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" /> Neizpolnjene postavke potrebujejo opombo',
        1,
    ),
])

# --- webxr-scanner.tsx (8 mest) ---
zam("src/components/roksal/webxr-scanner.tsx", [
    (
        "border-amber-500/40 bg-amber-500/10 text-amber-300",
        "border-roksal-amber/40 bg-roksal-amber/10 text-roksal-amber",
        1,
    ),
    (
        'text-center text-[9px] text-amber-300/80',
        'text-center text-[9px] text-roksal-amber/80',
        1,
    ),
    (
        'AlertTriangle aria-hidden="true" className="mx-auto h-10 w-10 text-amber-400"',
        'AlertTriangle aria-hidden="true" className="mx-auto h-10 w-10 text-roksal-amber"',
        1,
    ),
    (
        "supported ? 'border-green-300' : 'border-amber-200'",
        "supported ? 'border-green-300' : 'border-roksal-amber/40'",
        1,
    ),
    (
        "supported ? 'bg-green-100' : 'bg-amber-100'",
        "supported ? 'bg-green-100' : 'bg-roksal-amber/10'",
        1,
    ),
    (
        "supported ? 'text-green-600' : 'text-amber-600'}`",
        "supported ? 'text-green-600' : 'text-roksal-amber'}`",
        2,
    ),
    (
        'text-center text-[9px] text-amber-600',
        'text-center text-[9px] text-roksal-amber',
        1,
    ),
])

print("STIL val 3: vse zamenjave natanko ujete.")
