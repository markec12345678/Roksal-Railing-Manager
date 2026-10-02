#!/usr/bin/env python3
# r373-val56-apply.py — val 56 apply (fail-closed per vrstica — kanon
# r371-val54/r372-val55): 8 × INS ' focus-visible:ring-offset-2' TIK ZA
# družinski žeton (precedent val 54/54 INS; +28 znakov per vrstica, 0 novih
# vrstic). TAKRE:
#   white RAW ×3   photo-tab L978 / L1129 / L1137  (črn pregled, bela pika)
#   white/60 RAW ×4 photo-tab L1414 / L2048 / L2061 / L2071
#   roksal-green/40 RAW ×1 dashboard L1742 ('Pokliči stranko')
# Fail-closed preverbe per tarča PRED pisanjem: (1) anchor natanko 1× na
# vrstici; (2) ring-offset ODSOTEN na vrstici; (3) družinski žeton prisoten;
# (4) PO: offset TIK ZA anchor-koncem; (5) datoteka: wcLinije nespremenjeno.
import pathlib, sys

INS = " focus-visible:ring-offset-2"

TARCE = [
    # (datoteka, vrstica, anchor, oznaka) — anchor se konča z žetonom ALI
    # z žetonom + ' focus-visible:outline-none' (beli RAW: vstavimo TIK ZA
    # žetonom, PRED outline — val 54/55 vrstni red: ring → offset → outline)
    ("src/components/roksal/photo-tab.tsx", 978,
     "focus-visible:ring-white focus-visible:outline-none", "white RAW pregled pika", True),
    ("src/components/roksal/photo-tab.tsx", 1129,
     "focus-visible:ring-white focus-visible:outline-none", "white RAW levo puščica", True),
    ("src/components/roksal/photo-tab.tsx", 1137,
     "focus-visible:ring-white focus-visible:outline-none", "white RAW desno puščica", True),
    ("src/components/roksal/photo-tab.tsx", 1414,
     'focus-visible:ring-white/60"', "white/60 RAW zapri slikanje", False),
    ("src/components/roksal/photo-tab.tsx", 2048,
     'focus-visible:ring-white/60"', "white/60 RAW orodjarna shranjuj", False),
    ("src/components/roksal/photo-tab.tsx", 2061,
     'focus-visible:ring-white/60"', "white/60 RAW razveljavi", False),
    ("src/components/roksal/photo-tab.tsx", 2071,
     'focus-visible:ring-white/60"', "white/60 RAW ponovno", False),
    ("src/components/roksal/dashboard-tab.tsx", 1742,
     "focus-visible:ring-roksal-green/40", "green RAW pokliči stranko", False),
]

def main():
    datoteke = sorted({t[0] for t in TARCE})
    wc_pre = {f: len(pathlib.Path(f).read_text(encoding="utf-8").splitlines()) for f in datoteke}

    # PRED-preverbe (vse tarče, ŠE pred kakršnim koli pisanjem)
    for f, ln, anchor, oznaka, pred_outline in TARCE:
        lines = pathlib.Path(f).read_text(encoding="utf-8").splitlines()
        if ln > len(lines):
            sys.exit(f"FAILOVEDANO: {f}:{ln} izven obsega ({len(lines)} vrstic) — {oznaka}")
        v = lines[ln - 1]
        if v.count(anchor) != 1:
            sys.exit(f"FAILOVEDANO: {f}:{ln} anchor število {v.count(anchor)} ≠ 1 — {oznaka}")
        if "focus-visible:ring-offset" in v:
            sys.exit(f"FAILOVEDANO: {f}:{ln} ring-offset ŽE prisoten — {oznaka}")

    # Pisanje ( šele po čistih PRED-preverbah )
    for f, ln, anchor, oznaka, pred_outline in TARCE:
        p = pathlib.Path(f)
        lines = p.read_text(encoding="utf-8").splitlines()
        v = lines[ln - 1]
        if anchor.endswith('"'):
            # anchor vključuje zapirajoči navedek — vstavi PRED navedek
            zeton = anchor[:-1]
            pričakovana = v.replace(zeton + '"', zeton + INS + '"')
        elif pred_outline:
            # beli RAW: offset TIK ZA žetonom, PRED focus-visible:outline-none
            zeton = "focus-visible:ring-white"
            pričakovana = v.replace(zeton + " focus-visible:outline-none",
                                    zeton + INS + " focus-visible:outline-none")
        else:
            pričakovana = v.replace(anchor, anchor + INS)
        lines[ln - 1] = pričakovana
        novo = lines[ln - 1]
        if novo == v:
            sys.exit(f"FAILOVEDANO: {f}:{ln} vstavitve NI bilo — {oznaka}")
        # POST-preverba: offset TIK ZA žetonom (navedek ostane na koncu)
        zeton = anchor.rstrip('"')
        zet_idx = novo.index(zeton)
        if novo[zet_idx + len(zeton): zet_idx + len(zeton) + len(INS)] != INS:
            sys.exit(f"FAILOVEDANO: {f}:{ln} offset NI tik za žetonom — {oznaka}")
        if novo.count("focus-visible:ring-offset-2") != 1:
            sys.exit(f"FAILOVEDANO: {f}:{ln} offset število ≠ 1 po vstavitvi — {oznaka}")
        p.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"OK: {f}:{ln} +28 znakov — {oznaka}")

    # končna preverba: 0 novih vrstic
    for f in datoteke:
        wc_post = len(pathlib.Path(f).read_text(encoding="utf-8").splitlines())
        if wc_post != wc_pre[f]:
            sys.exit(f"FAILOVEDANO: {f} vrstice {wc_pre[f]} → {wc_post} (in-place kršen)")
    print(f"IN-PLACE OK: 0 novih vrstic ({', '.join(f'{f.split('/')[-1]}={wc_pre[f]}' for f in datoteke)})")

if __name__ == "__main__":
    main()
