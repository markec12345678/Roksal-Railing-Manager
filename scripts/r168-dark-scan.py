#!/usr/bin/env python3
"""R168 dark-token PREGLED (dry-run privzeto) — najdi kandidate brez dark:.
Družine, ki jih PREJŠNJI sweepi (R162 bg-white, R163 navy obrobe, R165 bg-white,
R166 navy, R167 bg-X-50/100+border+text) NISO pokrile:
  divide-*, ring-*, placeholder:*text-X-*, from-*/to-*/via-* (gradients),
  accent-*, outline-*, text-X-50/100/200 (svetla besedila), bg-X-200.
Izjeme (svetla platna/kamera/zaščiteno jedro) se preskočijo.
Uporaba: python3 r168-dark-scan.py [--commit]
"""
import re
import sys
from pathlib import Path

ROOT = Path('/home/z/my-project')
SRC = ROOT / 'src'

# Zaščiteno / svetla platna / kamera overlayji (precedensi r165/r166/r167)
IZJEME_DATOTEKE = {
    'src/components/viz/',          # ZAŠČITENO jedro (product SDK core)
    'src/components/roksal/cv-studio.tsx',
    'src/components/roksal/fence-3d-viewer.tsx',
    'src/components/roksal/webxr-scanner.tsx',
    'src/components/roksal/ar-scanner.tsx',
    'src/components/roksal/photo-tab.tsx',
    'src/components/roksal/map-measure.tsx',
    'src/components/roksal/floor-plan-tab.tsx',
    'src/components/roksal/sketch-canvas.tsx',
}

# družina → regex za iskanje žetona na vrstici + mirror regex (dark: naslovnik)
VZORCI = {
    'divide': (re.compile(r"(?<![\w-])divide-(?:x|y)?-?\d*-?(?:roksal|gray|slate|stone|zinc|neutral|red|amber|green|blue|purple|violet|emerald|teal|cyan|sky|indigo|fuchsia|pink|rose|orange|lime)-?\d*"), re.compile(r"dark:divide-")),
    'ring': (re.compile(r"(?<![\w-])ring-(?:roksal|gray|slate|stone|zinc|neutral)-\d+"), re.compile(r"dark:ring-")),
    'placeholder': (re.compile(r"placeholder:text-(?:gray|slate|stone|zinc|neutral)-\d+"), re.compile(r"dark:placeholder:text-|dark:text-")),
    'gradient': (re.compile(r"(?:from|to|via)-(?:roksal|gray|slate|stone|zinc|neutral|red|amber|green|blue|purple|violet)-\d+"), re.compile(r"dark:(?:from|to|via)-")),
    'accent': (re.compile(r"(?<![\w-])accent-(?:roksal|gray|slate|stone|zinc|neutral)-\d+"), re.compile(r"dark:accent-")),
    'outline': (re.compile(r"(?<![\w-])outline-(?:roksal|gray|slate|stone|zinc|neutral)-\d+"), re.compile(r"dark:outline-")),
    'text-svetli': (re.compile(r"(?<![\w-])text-(?:gray|slate|stone|zinc|neutral)-(?:50|100|200)\b"), re.compile(r"dark:text-")),
    'bg-200': (re.compile(r"(?<![\w-])bg-(?:gray|slate|stone|zinc|neutral)-(?:200)\b"), re.compile(r"dark:bg-")),
    # R169 — nove družine: SVG fill/stroke + zelo svetle obrobe border-X-100
    'fill': (re.compile(r"(?<![\w-])fill-(?:roksal|gray|slate|stone|zinc|neutral|red|amber|green|blue|purple|violet|emerald|teal|cyan|sky|indigo|fuchsia|pink|rose|orange|lime)-\d+"), re.compile(r"dark:fill-")),
    'stroke': (re.compile(r"(?<![\w-])stroke-(?:roksal|gray|slate|stone|zinc|neutral|red|amber|green|blue|purple|violet|emerald|teal|cyan|sky|indigo|fuchsia|pink|rose|orange|lime)-\d+"), re.compile(r"dark:stroke-")),
    'border-100': (re.compile(r"(?<![\w-])border-(?:gray|slate|stone|zinc|neutral)-(?:100)\b"), re.compile(r"dark:border-")),
    # R170 — nove družine: svetla ozadja bg-X-50/100 + border-X-300
    # (aktivacija/m/[token] javne strani — bg-stone-100 poln zaslon brez dark:)
    'bg-svetli': (re.compile(r"(?<![\w-])bg-(?:gray|slate|stone|zinc|neutral)-(?:50|100)\b"), re.compile(r"dark:bg-")),
    'border-300': (re.compile(r"(?<![\w-])border-(?:gray|slate|stone|zinc|neutral)-(?:300)\b"), re.compile(r"dark:border-")),
    # R170 — izrecni SVETLI ring-offset (R168 fix nastavi privzeti na
    # --background; izrecen ring-offset-X/white ga PREZRI in vrne beli halo)
    'ring-offset': (re.compile(r"(?<![\w-])ring-offset-(?:white|(?:gray|slate|stone|zinc|neutral)-\d+)"), re.compile(r"dark:ring-offset-")),
    # R171 — nove družine: border-X-200 (vrzel med obstoječima 100/300),
    # temna besedila text-X-700/800/900 (na temnem ozadju neberljiva brez
    # dark: ogledala), decoration-/caret- barvne družine + senca z barvno
    # sestavino shadow-X-... (svetle sence na temnem = neviden/umazan rob).
    'border-200': (re.compile(r"(?<![\w-])border-(?:gray|slate|stone|zinc|neutral)-(?:200)\b"), re.compile(r"dark:border-")),
    'text-temni': (re.compile(r"(?<![\w-])text-(?:gray|slate|stone|zinc|neutral)-(?:700|800|900)\b"), re.compile(r"dark:text-")),
    'decoration': (re.compile(r"(?<![\w-])decoration-(?:roksal|gray|slate|stone|zinc|neutral|red|amber|green|blue|purple|violet|emerald|teal|cyan|sky|indigo|fuchsia|pink|rose|orange|lime)-\d+"), re.compile(r"dark:decoration-")),
    'caret': (re.compile(r"(?<![\w-])caret-(?:roksal|gray|slate|stone|zinc|neutral|red|amber|green|blue|purple|violet|emerald|teal|cyan|sky|indigo|fuchsia|pink|rose|orange|lime)-\d+"), re.compile(r"dark:caret-")),
    'shadow': (re.compile(r"(?<![\w-])shadow-(?:roksal|gray|slate|stone|zinc|neutral|red|amber|green|blue|purple|violet|emerald|teal|cyan|sky|indigo|fuchsia|pink|rose|orange|lime)-\d+"), re.compile(r"dark:shadow-")),
    # R172 — nove BARVNE družine (gray/stone družine že pokrite zgoraj; to so
    # kromatične palete — bg-red-50/border-amber-200/text-purple-800 brez
    # dark: ogledala = svetel madež v temni). Mirror dovoljuje VARIJANTNE
    # predpone (dark:hover:bg- — nauček R167: plain pravilo ne ulovi hover:).
    'bg-barvni-svetli': (re.compile(r"(?<![\w-])bg-(?:red|amber|green|blue|purple|violet|emerald|teal|cyan|sky|indigo|fuchsia|pink|rose|orange|lime|yellow)-(?:50|100|200)\b"), re.compile(r"dark:(?:[\w-]+:)*bg-")),
    'border-barvni': (re.compile(r"(?<![\w-])border-(?:red|amber|green|blue|purple|violet|emerald|teal|cyan|sky|indigo|fuchsia|pink|rose|orange|lime|yellow)-(?:100|200|300)\b"), re.compile(r"dark:(?:[\w-]+:)*border-")),
    'text-barvni-temni': (re.compile(r"(?<![\w-])text-(?:red|amber|green|blue|purple|violet|emerald|teal|cyan|sky|indigo|fuchsia|pink|rose|orange|lime|yellow)-(?:600|700|800|900)\b"), re.compile(r"dark:(?:[\w-]+:)*text-")),
    'selection': (re.compile(r"selection:(?:bg|text)-(?:roksal|gray|slate|stone|zinc|neutral|red|amber|green|blue|purple|violet|emerald|teal|cyan|sky|indigo|fuchsia|pink|rose|orange|lime)-\d+"), re.compile(r"dark:selection:|dark:(?:[\w-]+:)*(?:bg|text)-")),
}

def je_izjema(p: Path) -> bool:
    rel = str(p.relative_to(ROOT))
    return any(rel.startswith(iz) or rel == iz.rstrip('/') for iz in IZJEME_DATOTEKE)

def main() -> None:
    commit = '--commit' in sys.argv
    zadetki: dict[str, list[tuple[Path, int, str, str]]] = {}
    for p in sorted(SRC.rglob('*.tsx')) + sorted(SRC.rglob('*.ts')):
        if '__tests__' in p.parts or je_izjema(p):
            continue
        if not (p.name.endswith('.tsx') or 'components' in p.parts):
            continue  # svetli žetoni so relevantni samo v komponentah
        try:
            vrstice = p.read_text(encoding='utf-8').splitlines()
        except Exception:
            continue
        for i, vrsta in enumerate(vrstice, 1):
            if vrsta.strip().startswith('*') or vrsta.strip().startswith('//'):
                continue  # komentarji
            # R174 — POKVARJEN MIRROR (novo družina): dvojni poševnici v
            # opacity modifierju (`dark:bg-X-950/40/60`) = Tailwind ne generira
            # razreda → svetel madež v temni temi. Vedno napaka (noben legitimen
            # primer ne obstaja) — mirror ni potreben.
            for m in re.finditer(r"dark:[\w-]+-[\w-]+/\d+/\d+", vrsta):
                zadetki.setdefault('pokvarjen-mirror', []).append(
                    (p, i, m.group(0), vrsta.strip()[:110]))
            for druzina, (vz, mirror) in VZORCI.items():
                for m in vz.finditer(vrsta):
                    zeton = m.group(0)
                    # vrstica z dark: naslovnikom za TA družino je namerna
                    if mirror.search(vrsta):
                        continue
                    zadetki.setdefault(druzina, []).append((p, i, zeton, vrsta.strip()[:110]))

    if not zadetki:
        print('NIČ kandidatov — vse družine pokrite.')
        return
    for druzina, seznam in sorted(zadetki.items()):
        print(f"\n=== {druzina}: {len(seznam)} zadetkov ===")
        for p, i, zeton, vrsta in seznam[:25]:
            print(f"  {p.relative_to(ROOT)}:{i}  [{zeton}]")
            print(f"      {vrsta}")
        if len(seznam) > 25:
            print(f"  … in še {len(seznam) - 25}")
    skupaj = sum(len(s) for s in zadetki.values())
    vrstice_zadete = {(str(p), i) for s in zadetki.values() for p, i, _, _ in s}
    print(f"\nSKUPAJ: {skupaj} kandidatov v {len(vrstice_zadete)} vrsticah")
    print(f"commit={commit}")

if __name__ == '__main__':
    main()
