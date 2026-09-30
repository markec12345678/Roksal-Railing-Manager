#!/usr/bin/env python3
# R254 (P1-d) — IKONSKI aria-hidden detektor: prešteje lucide-react ikone v
# src/**/*.tsx, katerih JSX oznaka NIMA aria-hidden="true".
#
# Skener je oznaka-zaveden (tag-aware): od `<ImeIkone` skenira naprej do
# zaključka oznake (`/>` ali `>`), pri čemer PRAVILNO obdela:
#  • večvrstične oznake (aria-hidden na naslednji vrstici = VŠTETO kot pokrito),
#  • navedene string literale znotraj oznake ('{' '}' v izrazih → čisti skener
#    preskoči JSX izraze z braces globino),
#  • samozaključne in parne oznake.
# Ikone = imena uvožena iz 'lucide-react' v isti datoteki (pravi vir resnice).
# Izhod: JSON {skupaj, manjkajoci, datoteke: [...], seznami per datoteka}.
import json
import os
import re
import sys

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src')

LUCIDE_IMPORT_RE = re.compile(r"import\s*\{([^}]*)\}\s*from\s*['\"]lucide-react['\"]", re.S)


def je_tip_pozicija(src: str, start: int) -> bool:
    """True = `<Ime` v tip/generik poziciji (useState<Layers>) — NI JSX uporaba
    ikone (r254 lekcija; ISTI guard kot v r254-aria-codemod.py)."""
    if start <= 0:
        return False
    return bool(re.match(r'[A-Za-z0-9_$]', src[start - 1]))


def lucide_names(src: str) -> set:
    names = set()
    for m in LUCIDE_IMPORT_RE.finditer(src):
        # R321 — SLEPA PEGA ZAPRTA (odkrita v R319 pri dekompoziciji
        # measurements): vejica v uvoznem komentarju (npr.
        # "CornerDownRight, // P3 — novi ikoni (stopnice, koti, ...)") je
        # razdelila blok pri split(',') in ikona postala NEVIDNA detektorju.
        # Popravek: // komentarji odstranjeni PRED split (uvozni blok med
        # oklepaji ne vsebuje string literal → strip je varen). ISTI popravek
        # v r254-aria-codemod.py in r254-aria-hidden.test.ts — enaka logika
        # v treh virih (kanon ENA resnica).
        block = re.sub(r'//[^\n]*', '', m.group(1))
        for part in block.split(','):
            part = part.strip()
            if not part:
                continue
            # 'Name as Alias' → alias
            alias = part.split(' as ')[-1].strip()
            if re.match(r'^[A-Z][A-Za-z0-9]*$', alias):
                names.add(alias)
    return names


def scan_tag(src: str, start: int) -> int:
    """Vrne indeks ZA zaključkom JSX oznake, ki se začne na `start` ('<').
    Preskoči string literale in JSX izraze {…}. Vrne -1, če ni najden."""
    i = start + 1
    depth_brace = 0
    n = len(src)
    while i < n:
        c = src[i]
        if c in ('"', "'"):
            q = c
            i += 1
            while i < n and src[i] != q:
                if src[i] == '\\':
                    i += 1
                i += 1
            i += 1
            continue
        if c == '`':
            i += 1
            while i < n and src[i] != '`':
                if src[i] == '\\':
                    i += 1
                i += 1
            i += 1
            continue
        if c == '{':
            depth_brace += 1
            i += 1
            continue
        if c == '}':
            depth_brace -= 1
            i += 1
            continue
        if depth_brace == 0:
            if c == '>' and i > start and src[i - 1] == '/':
                return i + 1  # self-closing />
            if c == '>':
                return i + 1  # regular >
        i += 1
    return -1


def file_report(path: str, rel: str) -> dict:
    src = open(path, encoding='utf-8').read()
    names = lucide_names(src)
    out = {'datoteka': rel, 'ikone': len(names), 'manjkajoci': [], 'pokrite': 0}
    if not names:
        return out
    for name in sorted(names):
        for m in re.finditer(r'<' + name + r'\b', src):
            if je_tip_pozicija(src, m.start()):
                continue
            end = scan_tag(src, m.start())
            if end == -1:
                continue
            tag = src[m.start():end]
            if re.search(r'aria-hidden(\s*=|\s*>)', tag):
                out['pokrite'] += 1
            else:
                line = src.count('\n', 0, m.start()) + 1
                out['manjkajoci'].append({'vrstica': line, 'ikona': name})
    return out


def main() -> None:
    rezultati = []
    skupaj_pokrite = 0
    skupaj_manjka = 0
    for root, _dirs, files in os.walk(SRC):
        for f in sorted(files):
            if not f.endswith('.tsx'):
                continue
            p = os.path.join(root, f)
            rel = os.path.relpath(p, os.path.dirname(SRC))
            r = file_report(p, rel)
            skupaj_pokrite += r['pokrite']
            skupaj_manjka += len(r['manjkajoci'])
            if r['manjkajoci'] or True:
                rezultati.append(r)
    print(json.dumps({
        'pokrite': skupaj_pokrite,
        'manjkajoci': skupaj_manjka,
        'datoteke': rezultati,
    }, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
