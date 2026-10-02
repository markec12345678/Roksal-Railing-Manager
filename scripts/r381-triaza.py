#!/usr/bin/env python3
# r381-triaza.py — R381 disk resnica triaža družine B/transition-colors
# (val 60 kandidat, kanon R380 handover kandidat 1: "nativni <button>
# triaža po kanonu val 58").
#
# OZADJE (disk resnica): r379-census.sh družina B = vrstice z
# 'focus-visible:ring-roksal-navy/40' + 'focus-visible:ring-2' BREZ
# 'transition' NA ISTI VRSTICI = 155 vrstic / 29 datotek. AMPAK: shadcn
# <Button> base (src/components/ui/button.tsx L8) nosi 'transition-all'
# iz baze — vsi <Button> elementi so ŽE animirani → N/A (kanon val 58:
# "KIT nosi transition-all iz baze"). Pravi gap = NATIVNI elementi
# (<button> in drugi ne-Button tagi), kjer className vrstica brez
# transition pomeni BREZ animacije prehoda.
#
# METODA (deterministična, disk-only, brez mutacij):
#   1. za vsako .tsx v src/components/roksal: najdi B vrstice (isti grep
#      kot r379-census.sh družina B);
#   2. za vsako B vrstico SPREHODAJ nazaj po datoteki do NAJBLIŽJE
#      predhodnice, ki ustreza odpirajočemu JSX tagu (<[A-Za-z][A-Za-z0-9.]*)
#      in klasificiraj: native-button (<button), Button (<Button), drugo;
#   3. izpiši triažo per-datoteka + SKUPNO rezime.
# Fail-closed: če B vrstica nima najdenega taga → '?' (glasno).
import pathlib
import re
import sys

REPO = pathlib.Path("/home/z/my-project")
ROKSAL = REPO / "src/components/roksal"

# DVE barvni družini (navy B + red): vrstice z ring-2 + barvni ring BREZ
# 'transition' na vrstici (disk resnica — <Button> nosi transition-all iz
# baze → N/A; nativni tagi brez transition = PRVI VAL 60 TARČE (runda R381)).
BARVNI_RINGI = (
    "focus-visible:ring-roksal-navy/40",
    "focus-visible:ring-roksal-red/40",
)
TAG_PAT = re.compile(r"<([A-Za-z][A-Za-z0-9.]*)")


def klasificiraj(vrstice, idx):
    """Sprehodaj nazaj od idx (0-based) do prvega taga — vrni ime."""
    for j in range(idx, max(-1, idx - 30), -1):
        m = TAG_PAT.search(vrstice[j])
        if m:
            return m.group(1)
    return "?"


def main() -> None:
    datoteke = sorted(ROKSAL.glob("*.tsx"))
    skupno = {"native-button": [], "Button": [], "drugo": [], "?": []}
    per_dat = {}
    for f in datoteke:
        vrstice = f.read_text(encoding="utf-8").splitlines()
        najdene = []
        for i, line in enumerate(vrstice):
            if "focus-visible:ring-2" not in line or "transition" in line:
                continue
            if not any(b in line for b in BARVNI_RINGI):
                continue
            tag = klasificiraj(vrstice, i)
            barva = "navy" if "ring-roksal-navy/40" in line else "red"
            najdene.append((i + 1, tag, barva))
        if najdene:
            ime = f.name
            per_dat[ime] = najdene
            for ln, tag, barva in najdene:
                if tag == "button":
                    skupno["native-button"].append((ime, ln, barva))
                elif tag == "Button":
                    skupno["Button"].append((ime, ln, barva))
                else:
                    skupno["drugo" if tag != "?" else "?"].append((ime, ln, tag, barva))

    print("=== R381 TRIAŽA (ring-2 + navy|red/40 brez transition na vrstici, obe barvni družini) ===")
    for ime in sorted(per_dat):
        najdene = per_dat[ime]
        b = sum(1 for _, t, _ in najdene if t == "button")
        B = sum(1 for _, t, _ in najdene if t == "Button")
        o = sum(1 for ln, t, _ in najdene if t not in ("button", "Button"))
        print(f"--- {ime}: SKUPAJ={len(najdene)} [button={b} Button={B} drugo={o}]")
        for ln, tag, barva in najdene:
            print(f"   L{ln}: <{tag}> {barva}")
    print("=== REZIME ===")
    print(f"native <button>: {len(skupno['native-button'])}  (VAL 60 TARČE (runda R381) — kanon val 58 INS ' transition-colors' PRED focus-visible:ring-2)")
    print(f"<Button> (transition-all iz baze): {len(skupno['Button'])}  (N/A)")
    print(f"drugi tagi: {len(skupno['drugo'])}  (ročni pregled)")
    print(f"neznani: {len(skupno['?'])}  (fail-closed glasno)")
    for ime, ln, barva in skupno["native-button"]:
        print(f"  NATIVNA TARČA {ime}:L{ln} ({barva})")
    for x in skupno["drugo"]:
        print(f"  DRUGO {x[0]}:L{x[1]} <{x[2]}> ({x[3]})")
    for x in skupno["?"]:
        print(f"  NEZNAN {x[0]}:L{x[1]}")


if __name__ == "__main__":
    main()
