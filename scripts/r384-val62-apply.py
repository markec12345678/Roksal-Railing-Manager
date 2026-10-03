#!/usr/bin/env python3
# r384-val62-apply.py — R384 MANDATORY STIL val 62: RED/40 border-pariteta
# (kanon R384 handover kandidat 1; triaža r384-triaza.py disk resnica:
# 16 tarč — vse z VIDLJIVIM borderjem [border-roksal-red/N barvni override
# na Button outline ALI eksplicitni border na nativnem gumbu/kartici],
# vse z O2; 9 N/A iskreno izključenih — brez borderja in brez sorojenca
# z FB; 0 anomalij).
#
# LEKCIJA R383 (2) UPOŠTEVANA V APPLY: PAR (light + dark) SKUPAJ v ENEM
# vstavljanju — ' focus-visible:border-roksal-red/40
# dark:focus-visible:border-roksal-red/50' (dark par po precedensu
# team-tab L619 'border-roksal-red/40 dark:border-roksal-red/50'; rdeča
# ostane rdeča v temni temi — ink je navy nevtralni sorojenec, NE rdeči).
#
# Anchor: 'focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2'
# TIK ZA (val 57 kanon R375) — vstavljanje NEKAKOŠ za O2, FB+dark FB.
# In-place: 0 novih vrstic (val 60 kanon). Fail-closed:
#   (1) kontrakt EMBEDDED — bajtno ujemanje proti ponovni izpeljavi
#       (KOLIZIJA premik = glasen abort, kanon r383-val61-apply.py);
#   (2) per-vrstica točno 1 sidro (drugič pojavljanje = abort);
#   (3) POST closure — vsaka spremenjena vrstica točno 1 FB-red par;
#   (4) POST in-place — številnik vrstic na datoteko nespremenjen;
#   (5) POST needle-survival — vsi need_static needleji registrov
#       r347–r383 + NASLEDNICA r363/r364 še ŽIVO v src/ (DEL 2 vzorec).
import pathlib
import re
import sys

REPO = pathlib.Path("/home/z/my-project")
ROKSAL = REPO / "src/components/roksal"
SIDRO = "focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2"
VSTAVEK = " focus-visible:border-roksal-red/40 dark:focus-visible:border-roksal-red/50"

# Kontrakt: (datoteka, št. vrstice, pričakovana vsebina bajtno) — iz
# /tmp/r384-kontrakt.txt (izpeljan iz trenutnega diska PRED apply).
KONTRAKT = [
    ("dashboard-tab.tsx", 1914, "            className=\"h-7 border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("dashboard-tab.tsx", 1987, "          className=\"flex w-full items-center gap-3 rounded-xl border border-roksal-red/20 bg-roksal-red/5 p-3 text-left animate-fade-in-up cursor-pointer transition-colors hover:bg-roksal-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("dashboard-tab.tsx", 2059, "            className=\"h-7 border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("dashboard-tab.tsx", 2185, "                    className=\"h-6 shrink-0 border-roksal-red/40 px-2 text-2xs text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("dashboard-tab.tsx", 2491, "                            className=\"mt-2 h-7 text-[11px] border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("dashboard-tab.tsx", 2635, "                          className=\"mt-2 h-7 text-[11px] border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("floor-plan-tab.tsx", 1731, "              className=\"absolute top-2 left-2 h-7 w-7 border-roksal-red/30 text-roksal-red bg-white/90 focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("inventory-tab.tsx", 1740, "                            className=\"h-7 px-2.5 text-2xs gap-1 border-roksal-red/30 text-roksal-red hover:bg-roksal-red/10 press-scale focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("invoice-manager.tsx", 1351, "                            className=\"h-7 text-xs border-roksal-red/40 text-roksal-ink hover:bg-roksal-red/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("invoice-manager.tsx", 1363, "                            className={`h-7 text-xs border-roksal-red/40 hover:bg-roksal-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2 ${stornoId === inv.id ? 'bg-roksal-red text-white hover:bg-roksal-red/90' : 'text-roksal-ink'}`}"),
    ("measurements-tab.tsx", 5679, "                          className=\"rounded-lg border border-roksal-red/30 bg-roksal-red/5 p-1 text-roksal-red hover:bg-roksal-red/10 focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2 active:scale-[0.96] transition-all duration-150\""),
    ("roksal-catalog.tsx", 201, "              className=\"mt-2 h-7 border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("sessions-dialog.tsx", 316, "                      className=\"h-7 shrink-0 gap-1 border-roksal-red/30 px-2 text-2xs text-roksal-red hover:bg-roksal-red/10 press-scale focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("sessions-dialog.tsx", 348, "                className=\"h-8 gap-1.5 border-roksal-red/30 px-2.5 text-xs text-roksal-red hover:bg-roksal-red/10 press-scale focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("termini-card.tsx", 474, "                className=\"mt-2 h-7 border-roksal-red/40 text-roksal-red hover:bg-roksal-red/10 hover:text-roksal-red focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
    ("vodja-dashboard.tsx", 2122, "              className=\"flex w-full cursor-pointer items-center gap-2 rounded-xl border border-roksal-red/20 bg-roksal-red/5 p-3 text-left shadow-sm animate-fade-in-up transition-colors hover:bg-roksal-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-red/40 focus-visible:ring-offset-2\""),
]

FB_RED_PAT = re.compile(r"(?<!dark:)focus-visible:border-roksal-red/")
DK_RED_PAT = re.compile(r"dark:focus-visible:border-roksal-red/")


def main() -> None:
    vsebine = {}
    ze_parirane = set()
    # 1) kontrakt bajtno (kanon KOLIZIJA premik = glasen abort)
    for dat, n, pricakovano in KONTRAKT:
        if dat not in vsebine:
            vsebine[dat] = (ROKSAL / dat).read_text(encoding="utf-8").splitlines()
        dejansko = vsebine[dat][n - 1]
        parirano = pricakovano.replace(SIDRO, SIDRO + VSTAVEK, 1)
        if dejansko == parirano:
            ze_parirane.add((dat, n))  # ponovni tek po abortu POST faze — preskoči vstavljanje
            continue
        if dejansko != pricakovano:
            sys.exit(f"FAILOVEDANO: kontrakt bajtno NE ujema: {dat}:{n} — disk se je premaknil, osveži triažo")
        if dejansko.count(SIDRO) != 1:
            sys.exit(f"FAILOVEDANO: {dat}:{n} ima {dejansko.count(SIDRO)} sidr (pričakovano 1)")
        if FB_RED_PAT.search(dejansko):
            sys.exit(f"FAILOVEDANO: {dat}:{n} že nosi FB red (idempotenca)")
    # 2) apply — in-place (samo ŠE-NI parirane tarče)
    za_vrstice = {}
    for dat, n, _ in KONTRAKT:
        if (dat, n) in ze_parirane:
            continue
        za_vrstice.setdefault(dat, []).append(n)
    for dat, vrstice in za_vrstice.items():
        for n in vrstice:
            vsebine[dat][n - 1] = vsebine[dat][n - 1].replace(SIDRO, SIDRO + VSTAVEK, 1)
    stevec = sum(len(v) for v in za_vrstice.values())
    for dat, vrs in vsebine.items():
        (ROKSAL / dat).write_text("\n".join(vrs) + "\n", encoding="utf-8")
    print(f"OK: {stevec} × INS{VSTAVEK!r} na {len(za_vrstice)} datotekah (in-place)")
    # 3) POST closure + in-place
    for dat, n, _ in KONTRAKT:
        vrs = (ROKSAL / dat).read_text(encoding="utf-8").splitlines()
        vrstica = vrs[n - 1]
        fb = len(FB_RED_PAT.findall(vrstica))
        dk = len(DK_RED_PAT.findall(vrstica))
        if fb != 1 or dk != 1:
            sys.exit(f"FAILOVEDANO POST closure: {dat}:{n} ima FB={fb} dark={dk} (pričakovano 1/1)")
        if len(vrs) != len(vsebine[dat]):
            sys.exit(f"FAILOVEDANO POST in-place: {dat} število vrstic se je spremenilo")
    print("OK: POST closure 16/16 (FB=1 dark=1) + in-place 0 novih vrstic")
    # 4) POST needle-survival — vsi need_static needleji registrov v src/
    reg_dir = REPO / "scripts/qa-needles"
    mrtvi = 0
    for reg in sorted(reg_dir.glob("r*.tsv")):
        for line in reg.read_text(encoding="utf-8").splitlines():
            if not line.strip() or line.startswith("#") or "\t" not in line:
                continue
            needle = line.split("\t")[0]
            if needle.startswith("TODO-"):
                continue
            hit = any(needle in (ROKSAL / f).read_text(encoding="utf-8") for f in vsebine)
            if not hit:
                # needleji živijo v render .tsx AND server .ts (API rute) —
                # preišči CELOTEN src (tsx + ts), kanon era-harvest DEL 2.
                hit2 = any(
                    needle in p.read_text(encoding="utf-8")
                    for p in (REPO / "src").rglob("*")
                    if p.suffix in (".tsx", ".ts") and p.is_file()
                )
                if not hit2:
                    print(f"MRTELJ: {reg.name}: {needle[:70]}")
                    mrtvi += 1
    if mrtvi:
        sys.exit(f"FAILOVEDANO POST needle-survival: {mrtvi} needlejev mrtvih — EVOLUCIJA obvezna")
    print("OK: POST needle-survival — vsi register needleji še ŽIVO v src/")
    print("=== r384-val62-apply KONEC ===")


if __name__ == "__main__":
    main()
