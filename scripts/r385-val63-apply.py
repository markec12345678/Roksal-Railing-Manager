#!/usr/bin/env python3
# r385-val63-apply.py — R385 MANDATORY STIL val 63: AMBER/50 border-pariteta
# (kanon R385 handover kandidat 1; triaža r385-triaza.py disk resnica:
# 15 tarč — vse z VIDLJIVIM borderjem [14 border-class: vodja ×13
# border-roksal-navy/25 + hover:border-roksal-amber + photo L740 nativni
# 'border' + 1 outline-variant: inclinometer L539 <Button variant="outline">],
# vse z O2; 3 N/A iskreno izključenih [inclinometer L433, inventory L1229,
# photo L1162 — brez borderja in brez sorojenca z FB]; 8 izven obsega
# [amber/40 + amber/60 pod-družini — prihodnja vala]; 0 anomalij).
#
# LEKCIJA R383 (2) UPOŠTEVANA V APPLY: PAR (light + dark) SKUPAJ v ENEM
# vstavljanju — ' focus-visible:border-roksal-amber/50
# dark:focus-visible:border-roksal-amber/30' (dark par po ISTEM pravilu
# kot rdeča val 62: sledi družinskemu obstoječemu light+dark border paru
# z ISTO light intenziveto — amber: audit-trail-dialog L53
# 'border-roksal-amber/50 dark:border-roksal-amber/30' → dark /30; amber
# ostane amber v temni temi — barva je pomen [nizka zaloga / opozorilo],
# NI ink — ink je navy nevtralni sorojenec).
#
# Anchor: 'focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2'
# TIK ZA (val 57 kanon R375) — vstavljanje NEKAKOŠ za O2, FB+dark FB.
# In-place: 0 novih vrstic (val 60 kanon). Fail-closed:
#   (1) kontrakt EMBEDDED — bajtno ujemanje proti ponovni izpeljavi
#       (KOLIZIJA premik = glasen abort, kanon r384-val62-apply.py);
#   (2) per-vrstica točno 1 sidro (drugič pojavljanje = abort);
#   (3) POST closure — vsaka spremenjena vrstica točno 1 FB-amber par;
#   (4) POST in-place — številnik vrstic na datoteko nespremenjen;
#   (5) POST needle-survival — vsi need_static needleji registrov še ŽIVO
#       v src/ (.tsx + .ts, LEKCIJA R384 (4)).
# LEKCIJA R384 (2): FB/dark patterna rabita NEGATIVE LOOKBEHIND —
# 'dark:focus-visible:border-roksal-amber/30' VSEBUJE podniz
# 'focus-visible:border-roksal-amber/' (lažna kršitev closure brez (?<!dark:)).
# LEKCIJA R384 (3): idempotenca je MED-vrstična — že-parirano stanje =
# pricakovano.replace(SIDRO, SIDRO+VSTAVEK, 1) (sidro je sredinski),
# ponovni tek izključi že-parirane iz vstavljanja.
import pathlib
import re
import sys

REPO = pathlib.Path("/home/z/my-project")
ROKSAL = REPO / "src/components/roksal"
SIDRO = "focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2"
VSTAVEK = " focus-visible:border-roksal-amber/50 dark:focus-visible:border-roksal-amber/30"

# Kontrakt: (datoteka, št. vrstice, pričakovana vsebina bajtno) — iz
# izpeljave iz trenutnega diska PRED apply (r385-triaza.py 15 tarč).
KONTRAKT = [
    ("inclinometer-tab.tsx", 539, '                className="shrink-0 transition-colors hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2"'),
    ("photo-tab.tsx", 740, '                  className={`rounded-md border px-2 py-2 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 focus-visible:outline-none ${'),
    ("vodja-dashboard.tsx", 1213, '          className="h-8 gap-1.5 border-roksal-navy/25 dark:border-roksal-ink/25 text-xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2"'),
    ("vodja-dashboard.tsx", 1229, '          className="h-8 gap-1.5 border-roksal-navy/25 dark:border-roksal-ink/25 text-xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2"'),
    ("vodja-dashboard.tsx", 1241, '          className="ml-auto h-8 gap-1.5 border-roksal-navy/25 dark:border-roksal-ink/25 text-xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2"'),
    ("vodja-dashboard.tsx", 1258, '          className="h-8 gap-1.5 border-roksal-navy/25 dark:border-roksal-ink/25 text-xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2"'),
    ("vodja-dashboard.tsx", 1475, '            className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"'),
    ("vodja-dashboard.tsx", 1549, '              className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"'),
    ("vodja-dashboard.tsx", 1563, '              className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"'),
    ("vodja-dashboard.tsx", 1646, '            className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"'),
    ("vodja-dashboard.tsx", 1657, '            className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"'),
    ("vodja-dashboard.tsx", 1672, '            className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"'),
    ("vodja-dashboard.tsx", 1744, '            className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"'),
    ("vodja-dashboard.tsx", 1755, '            className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"'),
    ("vodja-dashboard.tsx", 1771, '            className="h-6 gap-1 border-roksal-navy/25 px-2 text-2xs text-roksal-ink press-scale transition-all hover:border-roksal-amber hover:bg-roksal-amber/10 hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 dark:border-roksal-ink/25"'),
]

FB_AMBER_PAT = re.compile(r"(?<!dark:)focus-visible:border-roksal-amber/")
DK_AMBER_PAT = re.compile(r"dark:focus-visible:border-roksal-amber/")


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
        if FB_AMBER_PAT.search(dejansko):
            sys.exit(f"FAILOVEDANO: {dat}:{n} že nosi FB amber (idempotenca)")
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
        fb = len(FB_AMBER_PAT.findall(vrstica))
        dk = len(DK_AMBER_PAT.findall(vrstica))
        if fb != 1 or dk != 1:
            sys.exit(f"FAILOVEDANO POST closure: {dat}:{n} ima FB={fb} dark={dk} (pričakovano 1/1)")
        if len(vrs) != len(vsebine[dat]):
            sys.exit(f"FAILOVEDANO POST in-place: {dat} število vrstic se je spremenilo")
    print(f"OK: POST closure {len(KONTRAKT)}/{len(KONTRAKT)} (FB=1 dark=1) + in-place 0 novih vrstic")
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
                # preišči CELOTEN src (tsx + ts), kanon era-harvest DEL 2 /
                # LEKCIJA R384 (4).
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
    print("=== r385-val63-apply KONEC ===")


if __name__ == "__main__":
    main()
