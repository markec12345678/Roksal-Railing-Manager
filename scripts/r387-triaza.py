#!/usr/bin/env python3
# r387-triaza.py — R387 disk resnica triaža AMBER/60 border-paritete (val 65
# kandidat, kanon R386 handover kandidat 1 — ZADNJA amber pod-družina;
# LEKCIJA R382 (1): polna triaža PRED scopingom — repvidljivi podnizi ≠
# disk resnica).
#
# VAL 57/61/62/63/64 KANON: element z VIDLJIVIM border-om + focus ring nosi
# ' focus-visible:border-roksal-amber/60' + dark par (LEKCIJA R383 (2): PAR
# že v apply — light + dark SKUPAJ). Dark intenziteta /40 po DVEH
# skladiščih resnice: (a) notification L748 lasten dark ring JE /40
# ('dark:focus-visible:ring-roksal-amber/40' — FB sledi SVOJI ring pari);
# (b) crm-tab L811 'dark:border-roksal-amber/40' Card (precedens val 64 —
# edina obstoječa dark amber border intenziteta, ki NI /30 [audit-trail
# L53 je par /50+/30, namenjen /50 družini]). /60 NIMA lastnega
# obstoječega dark border para v kodebazi → izberemo /40, UNIFORMNO za
# celo družino (kanon: ena dark intenziteta na družino).
#
# DRUŽINA: vrstica z 'focus-visible:ring-roksal-amber/60' light (3 po popisu
# r386-triaza izven-obsega: photo L2113 + L2414, notification L748).
#
# TRIAŽA (deterministična, disk-only, brez mutacij):
#   vrstica z ring-2 + amber/60 BREZ 'focus-visible:border' → element ima
#   VIDLJIV border?  (a) border class, ALI (b) <Button variant="outline">;
#   brez borderja = N/A — RAZEN če PAR-SOROJENEC nosi FB.

import pathlib
import re
import sys

REPO = pathlib.Path("/home/z/my-project")
ROKSAL = REPO / "src/components/roksal"
AMBER60 = "focus-visible:ring-roksal-amber/60"  # light ring — dark: polovica IZKLJUČENA (lookbehind vrstica spodaj)
AMBER60_LIGHT = re.compile(r"(?<!dark:)focus-visible:ring-roksal-amber/60")
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
        # 2) TRIAŽA amber/60 družine
        for i, line in enumerate(vrstice):
            if RING2 not in line or not AMBER60_LIGHT.search(line):
                continue
            if "focus-visible:border" in line:
                continue  # že-parirana (ni pričakovano — 0 po popisu)
            ima_o2 = O2 in line
            dark_ring = re.search(r"dark:focus-visible:ring-roksal-amber/(\d+)", line)
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
                tarce.append((f.name, i + 1, tag, vir or "sorojenec-FB", ima_o2, sor, bratje, dark_ring.group(1) if dark_ring else None))
                per_dat.setdefault(f.name, []).append((i + 1, tag, vir or "sorojenec-FB", ima_o2, sor, bratje))
            else:
                sor = "BREZ-SOROJENCA" if not bratje else "SOROJENEC-BREZ-FB"
                na.append((f.name, i + 1, tag, ima_o2, sor))

    print("=== R387 TRIAŽA AMBER/60 border-pariteta (ring-2 + amber/60, brez focus-visible:border) ===")
    for ime in sorted(per_dat):
        najdene = per_dat[ime]
        print(f"--- {ime}: TARČE={len(najdene)}")
        for ln, tag, vir, o2, sor, bratje in najdene:
            brat_str = "; ".join(f"L{n}({b},FB={('DA' if fb else 'NE')})" for (n, b, fb) in bratje) or "-"
            print(f"   L{ln}: <{tag}> ({vir}) O2={'DA' if o2 else 'NE'} {sor} bratje[{brat_str}]")
    print("--- N/A (brez borderja, brez sorojenca z FB) ---")
    for ime, ln, tag, o2, sor in na:
        print(f"   {ime} L{ln}: <{tag}> O2={'DA' if o2 else 'NE'} {sor}")
    print("--- DARK RING intenzitete na tarčah (anchoring dokaz) ---")
    for t in tarce:
        print(f"   {t[0]} L{t[1]}: dark_ring={'/' + t[7] if t[7] else 'NI (trajno temna površina — brez dark: variant)'}")
    print("=== REZIME ===")
    print(f"TARČE (viden border ALI sorojenec z FB): {len(tarce)}")
    print(f"N/A: {len(na)}")
    brez_o2 = [t for t in tarce if not t[4]]
    print(f"TARČE BREZ O2 (anomalija — val 52 pairing): {len(brez_o2)}")
    viri = {}
    for _, _, _, vir, _, _, _, _ in tarce:
        viri[vir] = viri.get(vir, 0) + 1
    for k in sorted(viri):
        print(f"  vir: {k}: {viri[k]}")
    sor_stat = {}
    for _, _, _, _, _, sor, _, _ in tarce:
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
