#!/usr/bin/env python3
# R167 — deterministični dark: token sweep za OBARVANE svetle žetone
# (bg-X-50/100, border-X-200/300/400, text-X-500..900, hover:bg-X-50/100,
# hover:text-X-600/700), ki v TEMNI temi ostanejo svetli madeži (isti razred
# napak kot R163 vodja, R165 bg-white sweep, R166 navy obrobe — dolgi rep).
#
# Naučki R166 VGRAJENI:
#   • VARIANTNE PREDPONE (hover:, group-hover:, md: …): plain pravilo NE sme
#     zadeti žetona z predpono (R166 substring vrzel → podvojeni žetoni).
#     'hover:bg-red-50' obdela SAMO hover pravilo (dark:hover:…); druge
#     predpone (group-hover:, md:, focus: …) se KONSERVATIVNO preskočijo.
#   • OPACITY MODIFIKATOR ('/60'): ogledalo — 'border-violet-200/60' →
#     'border-violet-200/60 dark:border-violet-800/60' (svetla tema PIKČASTO
#     nespremenjena; brez ogledala bi /60 migriral na dark žeton).
#   • Inline vstavljanje takoj za žetonom (quote-varno, brez dedupov).
#   • Idempotentno (žeton, ki že je na vrstici, se ne podvoji).
#   • Vrstica s KAKRŠNIMKOLI 'dark:' = namerna zasnova, ostane.
#
# IZJEME (dokumentirane, NE sweepajo):
#   • src/components/viz/** — ZAŠČITENO jedro (Product SDK / vizualizacija)
#   • cv-studio, fence-3d-viewer, webxr-scanner, ar-scanner, photo-tab,
#     map-measure — svetla platna / kamera overlayji (namerno svetli v obeh
#     temah, dokumentirano v r165/r166 testih)
#   • bottom-nav.tsx — badge 'bg-white text-roksal-navy' na navy pilonu
#   • termini-card.tsx — R166/R167 nova komponenta (ročno obdelana)
#
# Dry-run privzeto; --commit piše.

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

BARVE = (
    'gray|stone|slate|zinc|neutral|red|orange|amber|yellow|lime|green|'
    'emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
)

def _pravilo(vzorec: str, predloga: str, ogledalo_opacity: bool):
    return (re.compile(vzorec), predloga, ogledalo_opacity)

PRAVILA = [
    # bg: dark varianti imajo lasten modifier → brez ogledala
    _pravilo(rf'\bbg-({BARVE})-50\b',        r'dark:bg-\1-950/40', False),
    _pravilo(rf'\bbg-({BARVE})-100\b',       r'dark:bg-\1-500/15', False),
    _pravilo(rf'\bhover:bg-({BARVE})-50\b',  r'dark:hover:bg-\1-950/40', False),
    _pravilo(rf'\bhover:bg-({BARVE})-100\b', r'dark:hover:bg-\1-500/15', False),
    _pravilo(rf'\bhover:text-({BARVE})-600\b', r'dark:hover:text-\1-400', False),
    _pravilo(rf'\bhover:text-({BARVE})-700\b', r'dark:hover:text-\1-300', False),
    # border/text: dark varianti brez modifierja → ogledalo /NN če obstaja
    _pravilo(rf'\bborder-({BARVE})-200(?:/(\d+))?\b', r'dark:border-\1-800', True),
    _pravilo(rf'\bborder-({BARVE})-300(?:/(\d+))?\b', r'dark:border-\1-800', True),
    _pravilo(rf'\bborder-({BARVE})-400(?:/(\d+))?\b', r'dark:border-\1-700', True),
    _pravilo(rf'\btext-({BARVE})-500(?:/(\d+))?\b', r'dark:text-\1-400', True),
    _pravilo(rf'\btext-({BARVE})-600(?:/(\d+))?\b', r'dark:text-\1-400', True),
    _pravilo(rf'\btext-({BARVE})-700(?:/(\d+))?\b', r'dark:text-\1-300', True),
    _pravilo(rf'\btext-({BARVE})-800(?:/(\d+))?\b', r'dark:text-\1-200', True),
    _pravilo(rf'\btext-({BARVE})-900(?:/(\d+))?\b', r'dark:text-\1-200', True),
]

BG_WHITE_DOVOLJENE = {
    'src/components/roksal/punch-list.tsx',
    'src/components/roksal/post-signature-panel.tsx',
}
BG_WHITE_REGEX = re.compile(r'\bbg-white\b(?![-/\w])')

IZKLJUCEK = {
    'src/components/roksal/cv-studio.tsx',
    'src/components/roksal/fence-3d-viewer.tsx',
    'src/components/roksal/webxr-scanner.tsx',
    'src/components/roksal/ar-scanner.tsx',
    'src/components/roksal/photo-tab.tsx',
    'src/components/roksal/map-measure.tsx',
    'src/components/roksal/bottom-nav.tsx',
    'src/components/roksal/termini-card.tsx',
}

def je_komentar_vrstica(vrstica: str) -> bool:
    s = vrstica.lstrip()
    return s.startswith('//') or s.startswith('*') or s.startswith('/*')

def _variantna_predpona(besedilo: str, start: int):
    """Če je pred m.start() ':' (npr. 'hover:text-red-700'), vrne ime
    predpone ('hover', 'group-hover', 'md' …), sicer None."""
    if start == 0 or besedilo[start - 1] != ':':
        return None
    k = start - 1
    while k > 0 and (besedilo[k - 1].isalnum() or besedilo[k - 1] in '-'):
        k -= 1
    return besedilo[k:start - 1]

def _obdelaj_jedro(jedro: str, rel: str):
    """Vrne (nova_vrstica, vstavljeno[]). Plain pravila preskočijo žetone z
    variantno predpono; hover pravila zadenejo tiste z 'hover:' v žetonu."""
    vstavljeno = []

    def pripravi_zeton(m: re.Match, predloga: str, ogledalo: bool) -> str:
        zeton = m.expand(predloga)
        if ogledalo and m.group(2):
            zeton += '/' + m.group(2)
        return zeton

    nova = jedro
    for regex, predloga, ogledalo in PRAVILA:
        izhod = []
        zadnji = 0
        for m in regex.finditer(nova):
            predpona = _variantna_predpona(nova, m.start())
            if predpona is not None:
                # žeton ima variantno predpono (hover:/group-hover:/md: …)
                if predpona != 'hover':
                    continue  # konservativno — ostane brez dark:
                # 'hover:žeton' pusti hover pravilo (spodaj) — plain preskoči
                continue
            zeton = pripravi_zeton(m, predloga, ogledalo)
            if zeton in nova:
                continue  # idempotenca
            izhod.append(nova[zadnji:m.start()])
            izhod.append(m.group(0) + ' ' + zeton)
            vstavljeno.append(zeton)
            zadnji = m.end()
        if izhod:
            izhod.append(nova[zadnji:])
            nova = ''.join(izhod)

    if rel in BG_WHITE_DOVOLJENE:
        izhod = []
        zadnji = 0
        for m in BG_WHITE_REGEX.finditer(nova):
            if nova[m.start() - 1:m.start()] == ':':
                continue  # variantna predpona — preskoči
            if 'dark:bg-card' in nova:
                continue  # idempotenca
            izhod.append(nova[zadnji:m.start()])
            izhod.append(m.group(0) + ' dark:bg-card')
            vstavljeno.append('dark:bg-card')
            zadnji = m.end()
        if izhod:
            izhod.append(nova[zadnji:])
            nova = ''.join(izhod)

    return nova, vstavljeno

def sweep_datoteka(rel: str, commit: bool):
    pot = ROOT / rel
    if not pot.exists():
        return None
    izvorno = pot.read_text(encoding='utf-8')
    nove_vrstice = []
    spremembe = []
    for i, vrstica in enumerate(izvorno.splitlines(keepends=True)):
        jedro = vrstica.rstrip('\r\n')
        zakljucek = vrstica[len(jedro):]
        if (je_komentar_vrstica(jedro) or jedro.lstrip().startswith('import ')
                or 'dark:' in jedro):
            nove_vrstice.append(vrstica)
            continue
        nova, vstavljeno = _obdelaj_jedro(jedro, rel)
        if vstavljeno:
            spremembe.append((i + 1, jedro.strip(), nova.strip()))
            nove_vrstice.append(nova + zakljucek)
        else:
            nove_vrstice.append(vrstica)
    if spremembe and commit:
        pot.write_text(''.join(nove_vrstice), encoding='utf-8')
    return spremembe

def main():
    commit = '--commit' in sys.argv
    komponente = ROOT / 'src' / 'components'
    cilji = []
    for pot in sorted(komponente.rglob('*.tsx')):
        rel = str(pot.relative_to(ROOT))
        if '/viz/' in rel or rel in IZKLJUCEK:
            continue
        cilji.append(rel)

    skupaj = 0
    po_datotekah = {}
    for rel in cilji:
        spremembe = sweep_datoteka(rel, commit)
        if spremembe:
            po_datotekah[rel] = len(spremembe)
            skupaj += len(spremembe)

    nacin = 'COMMIT' if commit else 'DRY-RUN'
    print(f'=== R167 dark: token sweep ({nacin}) ===')
    print(f'Datotek s spremembami: {len(po_datotekah)}, vrstic: {skupaj}')
    for rel, n in sorted(po_datotekah.items(), key=lambda x: -x[1]):
        print(f'  {n:3d}  {rel}')
    print('--- VZORCI (prva sprememba / datoteka, urejeno po imenu) ---')
    for rel in sorted(po_datotekah)[:8]:
        spremembe = sweep_datoteka(rel, False)
        if spremembe:
            ln, prej, potem = spremembe[0]
            print(f'{rel}:{ln}')
            print(f'  PREJ:  {prej[:140]}')
            print(f'  POTEM: {potem[:170]}')

if __name__ == '__main__':
    main()
