#!/usr/bin/env python3
# r383-val61-dark-fix.py — R383 POPRAVEK val 61 STEP 2: R166 DARK
# obrobni stražar (kanon R163–R166) je ujel, da val 61 INS ni vnesel
# dark: variante. VAL 57 PRECEDENS vstavlja PAR:
#   ' focus-visible:border-roksal-navy/40 dark:focus-visible:border-roksal-ink/40'
# val 61 STEP 2 je vnesel SAMO light polovico na 134 vrstic → ta skripta
# DODA dark polovico (' dark:focus-visible:border-roksal-ink/40') takoj
# za light na VSEH 134 STEP 2 vrsticah (kontrakt iz r382-val61-apply).
# Fail-closed: kontrakt bajtno, per-vrstica točno 1 light FB brez dark,
# POST: 0 vrstic z light-FB brez dark + in-place + needle survival.
import pathlib
import re
import sys

REPO = pathlib.Path("/home/z/my-project")
ROKSAL = REPO / "src/components/roksal"
NAVY = "focus-visible:ring-roksal-navy/40"
RING2 = "focus-visible:ring-2"
O2 = "focus-visible:ring-offset-2"
FB_LIGHT = "focus-visible:border-roksal-navy/40"
FB_DARK = "dark:focus-visible:border-roksal-ink/40"
TAG_PAT = re.compile(r"<([A-Za-z][A-Za-z0-9.]*)")
BORDER_PAT = re.compile(r"(?<![\w-])(border(?:-[a-zA-Z0-9./\[\]%-]+)?)(?![\w-])")
FROZEN = {("roksal-catalog.tsx", 95)}

# kontrakt: S2 liste iz r382-val61-apply.py (disk resnica)
apply_src = (REPO / "scripts/r382-val61-apply.py").read_text(encoding="utf-8")
seg = apply_src[apply_src.index("S2_LINije = {"): apply_src.index("# ==== KONEC KONTRAKTA ====")]
S2 = eval(seg.split("=", 1)[1].strip())


def main() -> None:
    skupaj = 0
    vrstice_pred = {}
    for ime, linije in sorted(S2.items()):
        f = ROKSAL / ime
        lines = f.read_text(encoding="utf-8").split("\n")
        vrstice_pred[ime] = len(lines)
        for ln in linije:
            v = lines[ln - 1]
            c_light = v.count(FB_LIGHT)
            c_dark = v.count(FB_DARK)
            if c_light != 1 or c_dark != 0:
                sys.exit(f"ABORT: {ime}:L{ln} light={c_light} (≠1) dark={c_dark} (≠0) — nepričakovano stanje")
            lines[ln - 1] = v.replace(FB_LIGHT, FB_LIGHT + " " + FB_DARK, 1)
            skupaj += 1
        f.write_text("\n".join(lines), encoding="utf-8")
    print(f"APPLY OK: {skupaj} × INS dark polovica (najpričakovano 134)")

    # POST: vsa 134 nosita par; in-place; needle survival
    for ime, linije in sorted(S2.items()):
        lines = (ROKSAL / ime).read_text(encoding="utf-8").split("\n")
        for ln in linije:
            v = lines[ln - 1]
            if v.count(FB_LIGHT) != 1 or v.count(FB_DARK) != 1:
                sys.exit(f"POST FAILOVEDANO: {ime}:L{ln} par niComplete")
        if len(lines) != vrstice_pred[ime]:
            sys.exit(f"POST FAILOVEDANO: {ime} vrstice {len(lines)} ≠ {vrstice_pred[ime]}")
    registri = sorted((REPO / "scripts/qa-needles").glob("r3*.tsv"))
    drevo = {str(p): p.read_text(encoding="utf-8", errors="replace") for p in sorted((REPO / "src").rglob("*.ts*"))}
    skupaj_n = mrtvi = 0
    for reg in registri:
        for line in reg.read_text(encoding="utf-8").splitlines():
            if not line or line.startswith("#"):
                continue
            deli = line.split("\t")
            if len(deli) >= 3 and deli[2] == "need_static" and deli[0].strip():
                skupaj_n += 1
                if not any(deli[0] in v for v in drevo.values()):
                    mrtvi += 1
    if mrtvi:
        sys.exit(f"POST FAILOVEDANO: {mrtvi} needlejev mrtev")
    print(f"POST OK: par na vseh {skupaj}, in-place dokaz, {skupaj_n - mrtvi}/{skupaj_n} needlejev ŽIVIH")
    print("=== r383-val61-dark-fix KONEC ===")


if __name__ == "__main__":
    main()
