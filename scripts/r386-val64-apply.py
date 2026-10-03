#!/usr/bin/env python3
# r386-val64-apply.py — R386 MANDATORY STIL val 64: AMBER/40 border-pariteta
# (kanon R386 handover kandidat 1; triaža r386-triaza.py disk resnica:
# 3 tarče — vse border-class [dashboard L1946 border-roksal-amber/40 kartica,
# measurements L3478 border-roksal-amber/30, vodja L2093 border-roksal-
# amber/40 kartica — rdeči dvojček L2122 ima FB že od val 62], vse z O2;
# 2 N/A iskreno izključena [dashboard L1749, measurements L3329 — brez
# borderja in brez sorojenca z FB]; 21 izven obsega [amber/50 zaključen
# val 63 + amber/60 prihodnji val]; 0 anomalij).
#
# LEKCIJA R383 (2) UPOŠTEVANA V APPLY: PAR (light + dark) SKUPAJ v ENEM
# vstavljanju — ' focus-visible:border-roksal-amber/40
# dark:focus-visible:border-roksal-amber/40' (light /40 = ring intenziveta;
# dark /40 po družinskem precedensu z ISTO intenziveto — crm-tab L811
# 'dark:border-roksal-amber/40' Card, edini obstoječi dark amber/40 border
# v kodebazi; amber ostane amber v temni temi — barva je pomen, NI ink).
#
# LEKCIJA R385 (1) UPOŠTEVANA: r368-stil-val51 (B) N3 pin ['ring-amber/40
# offset-2 outline-none' ×2 = L3329 + L3478] — val 64 prelomi L3478
# adjacency (FB med offset-2 in outline-none), L3329 (N/A) ostane → pin
# 2→1; PIN SHIFT V ISTI RUNDI (r386), + EVOLVED adjacency ×1.
#
# Anchor: 'focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2'
# TIK ZA (val 57 kanon R375). In-place: 0 novih vrstic (val 60 kanon).
# Fail-closed: (1) kontrakt EMBEDDED bajtno; (2) per-vrstica točno 1 sidro;
# (3) POST closure z negativnim lookbehind — LEKCIJA R384 (2); (4) POST
# in-place; (5) POST needle-survival .tsx+.ts — LEKCIJA R384 (4);
# mid-line idempotenca — LEKCIJA R384 (3).
import pathlib
import re
import sys

REPO = pathlib.Path("/home/z/my-project")
ROKSAL = REPO / "src/components/roksal"
SIDRO = "focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2"
VSTAVEK = " focus-visible:border-roksal-amber/40 dark:focus-visible:border-roksal-amber/40"

KONTRAKT = [
    ("dashboard-tab.tsx", 1946, '          className="flex w-full items-center gap-3 rounded-xl border border-roksal-amber/40 bg-roksal-amber/5 p-3 text-left animate-fade-in-up cursor-pointer transition-colors hover:bg-roksal-amber/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2"'),
    ("measurements-tab.tsx", 3478, '                className="flex items-center gap-1 rounded-lg border border-roksal-amber/30 bg-roksal-amber/5 px-2 py-1 text-[11px] font-medium text-roksal-amber hover:bg-roksal-amber/10 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2 focus-visible:outline-none transition-all duration-150"'),
    ("vodja-dashboard.tsx", 2093, '              className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-roksal-amber/40 bg-roksal-amber/5 p-3 text-left shadow-sm animate-fade-in-up transition-colors hover:bg-roksal-amber/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/40 focus-visible:ring-offset-2"'),
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
            ze_parirane.add((dat, n))
            continue
        if dejansko != pricakovano:
            sys.exit(f"FAILOVEDANO: kontrakt bajtno NE ujema: {dat}:{n} — disk se je premaknil, osveži triažo")
        if dejansko.count(SIDRO) != 1:
            sys.exit(f"FAILOVEDANO: {dat}:{n} ima {dejansko.count(SIDRO)} sidr (pričakovano 1)")
        if FB_AMBER_PAT.search(dejansko):
            sys.exit(f"FAILOVEDANO: {dat}:{n} že nosi FB amber (idempotenca)")
    # 2) apply — in-place
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
    print("=== r386-val64-apply KONEC ===")


if __name__ == "__main__":
    main()
