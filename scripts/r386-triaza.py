#!/usr/bin/env python3
# r386-triaza.py — R386 disk resnica triaža AMBER/40 border-paritete (val 64
# kandidat, kanon R386 handover kandidat 1; LEKCIJA R382 (1): polna triaža
# PRED scopingom — repvidljivi podnizi ≠ disk resnica).
#
# VAL 57/61/62/63 KANON (R375/R383/R384/R385): element z VIDLJIVIM border-om
# + focus ring nosi ' focus-visible:border-roksal-amber/40' + dark par
# ' dark:focus-visible:border-roksal-amber/40' (LEKCIJA R383 (2): PAR že v
# apply — light + dark SKUPAJ; dark polovica po družinskem precedensu z
# ISTO intenziveto: crm-tab L811 'dark:border-roksal-amber/40' Card —
# edini obstoječi dark amber/40 border v kodebazi; light /40 = ring
# intenziveta; amber ostane amber v temni temi — barva je pomen [nizka
# zaloga / opozorilo], NI ink — ink je navy nevtralni sorojenec).
#
# DRUŽINA: vrstica z 'focus-visible:ring-roksal-amber/40' (5 po popisu;
# /50 je ZAKLJUČENA z val 63 [15 × INS], /60 ostaja izven obsega —
# prihodnji val; kanon ena-intenziveta-na-val).
#
# PAR-SOROJENCI DETEKCIJA (LEKCIJA R382 (2) kanon + R384 živi čuvaj):
# sorojenec dobi FB, če brat nosi — 'ISTI jezik čez kontekste'.
#
# TRIAŽA (deterministična, disk-only, brez mutacij):
#   vrstica z ring-2 + amber/40 BREZ 'focus-visible:border' → element ima
#   VIDLJIV border?  (a) border class, ALI (b) <Button variant="outline">;
#   brez borderja = N/A — RAZEN če PAR-SOROJENEC nosi FB.

import pathlib
import re
import sys

REPO = pathlib.Path("/home/z/my-project")
ROKSAL = REPO / "src/components/roksal"
AMBER40 = "focus-visible:ring-roksal-amber/40"  # light ring — dark: polovica IZKLJUČENA (lookbehind vrstica spodaj)
AMBER_ALL = re.compile(r"focus-visible:ring-roksal-amber/(\d+)")
AMBER40_LIGHT = re.compile(r"(?<!dark:)focus-visible:ring-roksal-amber/40")
RING2 = "focus-visible:ring-2"
O2 = "focus-visible:ring-offset-2"
FB_PAT = re.compile(r"focus-visible:border-")
TAG_PAT = re.compile(r"<([A-Za-z][A-Za-z0-9.]*)")
BORDER_PAT = re.compile(r"(?<![\w-])(border(?:-[a-zA-Z0-9./\[\]%-]+)?)(?![\w-])")
BARVE = ["roksal-navy", "roksal-red", "roksal-amber"]


def normaliziraj_barvo(vrstica: str) -> str:
    out = vrstica
    for b in BARVE:
        out = out.replace(b, "{BARVA}")
    return out


def klasificiraj(vrstice, idx):
    for j in range(idx, max(-1, idx - 40), -1):
        m = TAG_PAT.search(vrstice[j])
        if m:
            return m.group(1), vrstice[j]
    return "?", ""


def ima_border(vrstica: str) -> bool:
    toks = BORDER_PAT.findall(vrstica)
    return any(t == "border" or (t.startswith("border-") and "focus-visible" not in t and not t.startswith("border-dashed-none")) for t in toks)


def main() -> None:
    # 1) INDEKS: za vsako datoteko — normalizirane izvedljive vrstice z ring-2
    #    (sorojenski register: (file, normalizirana) → [(št. vrstice, barva, ima_FB)])
    sorojenci_index = {}
    tarce = []
    na = []
    izven = []  # amber/40 + amber/60 pod-družini (izven obsega val 63)
    per_dat = {}
    for f in sorted(ROKSAL.glob("*.tsx")):
        vrstice = f.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(vrstice):
            if RING2 not in line or "focus-visible:ring-" not in line:
                continue
            norm = normaliziraj_barvo(line)
            barve = [b for b in BARVE if b in line]
            barva = barve[0] if barve else "?"
            sorojenci_index.setdefault((f.name, norm), []).append((i + 1, barva, bool(FB_PAT.search(line))))
        # 2) TRIAŽA amber/50 družine
        for i, line in enumerate(vrstice):
            if RING2 not in line or not AMBER40_LIGHT.search(line):
                continue
            if "focus-visible:border" in line:
                continue  # že-parirana (ni pričakovano — 0 po popisu)
            ima_o2 = O2 in line
            tag, tagline = klasificiraj(vrstice, i)
            var_line = ima_border(line)
            var_variant = "outline" in tagline and tag == "Button"
            if not var_variant and tag == "Button":
                for j in range(i, max(-1, i - 6), -1):
                    if 'variant="outline"' in vrstice[j]:
                        var_variant = True
                        break
            # sorojenec: ista normalizirana struktura, DRUGA barva
            norm = normaliziraj_barvo(line)
            bratje = [(n, b, fb) for (n, b, fb) in sorojenci_index.get((f.name, norm), []) if n != i + 1]
            brat_fb = any(fb for (_, _, fb) in bratje)
            vir = "border-class" if var_line else ("outline-variant" if var_variant else None)
            if vir or brat_fb:
                sor = "BREZ-SOROJENCA" if not bratje else ("SOROJENEC-Z-FB" if brat_fb else "SOROJENEC-BREZ-FB")
                tarce.append((f.name, i + 1, tag, vir or "sorojenec-FB", ima_o2, sor, bratje))
                per_dat.setdefault(f.name, []).append((i + 1, tag, vir or "sorojenec-FB", ima_o2, sor, bratje))
            else:
                sor = "BREZ-SOROJENCA" if not bratje else "SOROJENEC-BREZ-FB"
                na.append((f.name, i + 1, tag, ima_o2, sor))
        # 3) IZVEN obsega: amber/40 + amber/60 ring vrstice (disk resnica —
        #    dokumentirane za prihodnja vala; NIČ mutacij na njih v val 63)
        for i, line in enumerate(vrstice):
            if RING2 not in line:
                continue
            m = AMBER_ALL.search(line)
            if m and m.group(1) != "40":
                # light ring NI /40 → izven obsega val 64 (50 = zaključen
                # val 63; 60 = prihodnji val)
                izven.append((f.name, i + 1, m.group(1), bool(ima_border(line)), bool(FB_PAT.search(line))))
                continue
            m2 = re.search(r"dark:focus-visible:ring-roksal-amber/(\d+)", line)
            if m2 and not AMBER40_LIGHT.search(line):
                # dark-only ring par (notification L748: light /60 + dark /40)
                izven.append((f.name, i + 1, f"60+dark/{m2.group(1)}", bool(ima_border(line)), bool(FB_PAT.search(line))))

    print("=== R386 TRIAŽA AMBER/40 border-pariteta (ring-2 + amber/40, brez focus-visible:border) ===")
    for ime in sorted(per_dat):
        najdene = per_dat[ime]
        print(f"--- {ime}: TARČE={len(najdene)}")
        for ln, tag, vir, o2, sor, bratje in najdene:
            brat_str = "; ".join(f"L{n}({b},FB={('DA' if fb else 'NE')})" for (n, b, fb) in bratje) or "-"
            print(f"   L{ln}: <{tag}> ({vir}) O2={'DA' if o2 else 'NE'} {sor} bratje[{brat_str}]")
    print("--- N/A (brez borderja, brez sorojenca z FB) ---")
    for ime, ln, tag, o2, sor in na:
        print(f"   {ime} L{ln}: <{tag}> O2={'DA' if o2 else 'NE'} {sor}")
    print("--- IZVEN OBSEGA val 64 (amber/50 ZAKLJUČEN val 63 + amber/60 prihodnji val) ---")
    for ime, ln, int_, bord, fb in izven:
        print(f"   {ime} L{ln}: ring amber/{int_} border={'DA' if bord else 'NE'} FB={'DA' if fb else 'NE'}")
    print("=== REZIME ===")
    print(f"TARČE (viden border ALI sorojenec z FB): {len(tarce)}")
    print(f"N/A: {len(na)}")
    print(f"IZVEN (amber/50+/60): {len(izven)}")
    brez_o2 = [t for t in tarce if not t[4]]
    print(f"TARČE BREZ O2 (anomalija — val 52 pairing): {len(brez_o2)}")
    viri = {}
    for _, _, _, vir, _, _, _ in tarce:
        viri[vir] = viri.get(vir, 0) + 1
    for k in sorted(viri):
        print(f"  vir: {k}: {viri[k]}")
    sor_stat = {}
    for _, _, _, _, _, sor, _ in tarce:
        sor_stat[sor] = sor_stat.get(sor, 0) + 1
    for k in sorted(sor_stat):
        print(f"  sorojenci: {k}: {sor_stat[k]}")
    # fail-closed: vsaka tarča MORA imeti O2 (val 52 pairing kanon) — sicer
    # glasno abort (kontrakt ne sme parirati borderja na elementu brez O2).
    if brez_o2:
        for t in brez_o2:
            print(f"FAILOVEDANO: tarča brez O2: {t[0]} L{t[1]} — najprej val 52 pairing")
        sys.exit(1)


if __name__ == "__main__":
    main()
