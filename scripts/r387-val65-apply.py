#!/usr/bin/env python3
# r387-val65-apply.py — R387 MANDATORY STIL val 65: AMBER/60 border-pariteta
# (kanon R386 handover kandidat 1 — ZADNJA amber pod-družina; triaža
# r387-triaza.py disk resnica: 2 tarči — obe border-class [notification L748
# border-border/60 + hover:border-roksal-amber/40, photo L2113 nativni
# 'border' s pogojnima veja border-roksal-amber / border-white/20], obe z
# O2; 1 N/A iskreno izključen [photo L2414 — brez borderja in brez
# sorojenca z FB]; 0 anomalij).
#
# LEKCIJA R383 (2) UPOŠTEVANA V APPLY: PAR (light + dark) SKUPAJ v ENEM
# vstavljanju — ' focus-visible:border-roksal-amber/60
# dark:focus-visible:border-roksal-amber/40' (light /60 = ring
# intenziveta; dark /40 po DVEH skladiščih resnice: notification L748
# lasten dark ring JE /40 — FB sledi SVOJI ring pari; crm-tab L811
# 'dark:border-roksal-amber/40' Card — precedens val 64, edina druga
# obstoječa dark amber border intenziteta [/30 je par /50+/30, namenjen
# /50 družini val 63]; /60 NIMA lastnega dark border para v kodebazi →
# /40 UNIFORMNO za celo družino; amber ostane amber v temni temi —
# barva je pomen, NI ink).
#
# LEKCIJA R386 (1) UPOŠTEVANA: lookbehind (?<!dark:) čez VSE preverbe.
# LEKCIJA R368 KANON (PIN SHIFT V ISTI RUNDI): notification L748
# sosednost 'ring-offset-2 dark:focus-visible:ring-roksal-amber/40' je
# PINANA v 11 zamrznjenih needle skriptah (r245–r255 build-needles) —
# val 65 vstavi FB MED offset-2 in dark ring → PIN SHIFT VSEH 11 skript
# V ISTI RUNDI (faza 2 tega skripta, žig [PIN SHIFT R387 val 65]) +
# r368-stil-val51 (C) novObv EVOLVED.
#
# Anchor: 'focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2'
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
SCRIPTS = REPO / "scripts"
SIDRO = "focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2"
VSTAVEK = " focus-visible:border-roksal-amber/60 dark:focus-visible:border-roksal-amber/40"

KONTRAKT = [
    ("photo-tab.tsx", 2113, '              className={`flex h-6 w-9 items-center justify-center rounded-md border text-2xs focus-visible:ring-2 focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2 ${'),
    ("notification-center.tsx", 748, '                      className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-roksal-amber/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2 dark:focus-visible:ring-roksal-amber/40 active:scale-[0.98]"'),
]

# PIN SHIFT kontrakt: 11 zamrznjenih needle skript — STARA sosednost →
# NOVA (FB par med offset-2 in dark ring) + žig v opisu needleja.
PIN_STARE_SKRIPTE = [
    "r245-build-needles.sh", "r246-build-needles.sh", "r247-build-needles.sh",
    "r248-build-needles.sh", "r249-build-needles.sh", "r250-build-needles.sh",
    "r251-build-needles.sh", "r252-build-needles.sh", "r253-build-needles.sh",
    "r254-build-needles.sh", "r255-build-needles.sh",
]
PIN_STAR = 'focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2 dark:focus-visible:ring-roksal-amber/40 active:scale-[0.98]" "R245 notification kartica [PIN SHIFT R368 val 51: offset-2 — izjema zaključena]"'
PIN_NOV = 'focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2 focus-visible:border-roksal-amber/60 dark:focus-visible:border-roksal-amber/40 dark:focus-visible:ring-roksal-amber/40 active:scale-[0.98]" "R245 notification kartica [PIN SHIFT R368 val 51: offset-2; PIN SHIFT R387 val 65: FB amber/60+dark/40]"'

FB60_LIGHT = re.compile(r"(?<!dark:)focus-visible:border-roksal-amber/60")
FB60_DARK = re.compile(r"dark:focus-visible:border-roksal-amber/40")


def main() -> None:
    # ── FAZA 1: INS ×2 (render datoteke) ──
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
        if FB60_LIGHT.search(dejansko):
            sys.exit(f"FAILOVEDANO: {dat}:{n} že nosi FB amber/60 (idempotenca)")
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
    print(f"OK faza 1: {stevec} × INS{VSTAVEK!r} na {len(za_vrstice)} datotekah (in-place)")
    # 3) POST closure + in-place
    for dat, n, _ in KONTRAKT:
        vrs = (ROKSAL / dat).read_text(encoding="utf-8").splitlines()
        vrstica = vrs[n - 1]
        fb = len(FB60_LIGHT.findall(vrstica))
        dk = len(FB60_DARK.findall(vrstica))
        if fb != 1 or dk != 1:
            sys.exit(f"FAILOVEDANO POST closure: {dat}:{n} ima FB={fb} dark={dk} (pričakovano 1/1)")
        if len(vrs) != len(vsebine[dat]):
            sys.exit(f"FAILOVEDANO POST in-place: {dat} število vrstic se je spremenilo")
    print(f"OK faza 1 POST: closure {len(KONTRAKT)}/{len(KONTRAKT)} (FB=1 dark=1) + in-place 0 novih vrstic")

    # ── FAZA 2: PIN SHIFT ×11 zamrznjenih needle skript (kanon R368 —
    #    V ISTI RUNDI, žig) ──
    shiftano = 0
    for ime in PIN_STARE_SKRIPTE:
        p = SCRIPTS / ime
        src = p.read_text(encoding="utf-8")
        if PIN_NOV in src:
            continue  # že shiftano (idempotenca)
        if src.count(PIN_STAR) != 1:
            sys.exit(f"FAILOVEDANO PIN SHIFT: {ime} ima {src.count(PIN_STAR)} starega pina (pričakovano 1)")
        p.write_text(src.replace(PIN_STAR, PIN_NOV, 1), encoding="utf-8")
        shiftano += 1
    print(f"OK faza 2: {shiftano}/{len(PIN_STARE_SKRIPTE)} needle skript PIN SHIFTano (žig [PIN SHIFT R387 val 65])")
    # POST pin-shift preverba: vsakih 11 nosi NOV pin, 0 starih
    for ime in PIN_STARE_SKRIPTE:
        src = (SCRIPTS / ime).read_text(encoding="utf-8")
        if PIN_NOV not in src or PIN_STAR in src:
            sys.exit(f"FAILOVEDANO POST PIN SHIFT: {ime} nima novega pina ALI še nosi starega")
    print("OK faza 2 POST: 11/11 nov pin ŽIVO, star pin mrtev")

    # ── FAZA 3: POST needle-survival — vsi need_static needleji registrov ──
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
    print("OK faza 3: POST needle-survival — vsi register needleji še ŽIVO v src/")
    print("=== r387-val65-apply KONEC ===")


if __name__ == "__main__":
    main()
