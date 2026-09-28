#!/usr/bin/env python3
# R254 (P1-d) — IKONSKI aria-hidden CODEMOD + IZJEME-AUDIT.
#
# AUDIT (najprej): najde ikono-samo interaktivne elemente (<button>/<a>, katerih
#   vsebina je SAMO ena lucide ikona — brez besedila) BREZ aria-label na
#   starševskem elementu — edini primer, kjer bi aria-hidden="true" na ikoni
#   odvzel dostopno ime kontrolniku (izjema, ki jo je treba ročno popraviti
#   — dodati aria-label). Izpiše seznam za pregled.
#
# CODEMOD (potem): v vsaki oznaki lucide ikone, ki NIMA aria-hidden, vstavi
#   ` aria-hidden="true"` takoj za imenom ikone (vrstni red atributov v JSX ni
#   pomemben; minimalen, determinističen diff — ena vrstica per oznaka).
#
# UPORABA:
#   python3 scripts/r254-aria-codemod.py audit     # samo izjeme-audit
#   python3 scripts/r254-aria-codemod.py apply     # codemod + povzetek
import json
import os
import re
import sys

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src')

LUCIDE_IMPORT_RE = re.compile(r"import\s*\{([^}]*)\}\s*from\s*['\"]lucide-react['\"]", re.S)


def lucide_names(src: str) -> set:
    names = set()
    for m in LUCIDE_IMPORT_RE.finditer(src):
        for part in m.group(1).split(','):
            part = part.strip()
            if not part:
                continue
            alias = part.split(' as ')[-1].strip()
            if re.match(r'^[A-Z][A-Za-z0-9]*$', alias):
                names.add(alias)
    return names


def scan_tag(src: str, start: int) -> int:
    """Indeks ZA zaključkom odpiralne JSX oznake na `start` ('<')."""
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
                return i + 1
            if c == '>':
                return i + 1
        i += 1
    return -1


def scan_pair(src: str, open_start: int, tag: str) -> int:
    """Indeks ZA zaključnim `</tag>` — globinsko štetje ujemajočih parov."""
    close_re = re.compile(r'</' + tag + r'>|<' + tag + r'\b')
    depth = 0
    i = open_start
    n = len(src)
    for m in close_re.finditer(src, open_start):
        if m.group(0).startswith('</'):
            depth -= 1
            if depth == 0:
                return m.end()
        else:
            # preskoči self-closing <tag ... />
            end = scan_tag(src, m.start())
            if end > 0 and src[end - 2:end] == '/>':
                continue
            depth += 1
        i = m.end()
    return -1


def file_src(path: str) -> str:
    return open(path, encoding='utf-8').read()


def je_tip_pozicija(src: str, start: int) -> bool:
    """True, če je `<Ime` v TIP/GENERIC poziciji (npr. useState<Layers>), ne v
    JSX — znak PRED `<` je identifier znak (r254 lekcija: codemod je vstavil
    aria-hidden v useState<Layers> generik → sintaksna napaka). JSX oznaka je
    vedno za ({=/> ali belo prosto; tip-generik vedno za identifierjem."""
    if start <= 0:
        return False
    return bool(re.match(r'[A-Za-z0-9_$]', src[start - 1]))


def audit_file(path: str, rel: str, izjeme: list) -> None:
    src = file_src(path)
    names = lucide_names(src)
    if not names:
        return
    for m in re.finditer(r'<(button|a)\b', src):
        if je_tip_pozicija(src, m.start()):
            continue
        open_end = scan_tag(src, m.start())
        if open_end == -1:
            continue
        close_end = scan_pair(src, m.start(), m.group(1))
        if close_end == -1:
            continue
        open_tag = src[m.start():open_end]
        vsebina = src[open_end:close_end]
        ikone_v_vsebini = [n for n in names if re.search(r'<' + n + r'\b', vsebina)]
        if len(ikone_v_vsebini) != 1:
            continue
        # vsebina = samo ikona (dovoljen whitespace) — brez besedila
        brez_ikone = re.sub(r'<[A-Z][A-Za-z0-9]*\b[^>]*(/>|>.*?</[A-Z][A-Za-z0-9]*>)', '', vsebina, flags=re.S)
        if re.search(r'\S', brez_ikone):
            continue
        if not re.search(r'aria-label\s*=', open_tag):
            vrstica = src.count('\n', 0, m.start()) + 1
            izjeme.append({'datoteka': rel, 'vrstica': vrstica, 'element': m.group(1), 'ikona': ikone_v_vsebini[0]})


def codemod_file(path: str, rel: str, popravki: dict) -> None:
    src = file_src(path)
    names = lucide_names(src)
    if not names:
        return
    # zberi vse oznake brez aria-hidden (od zadaj — offseti ostanejo veljavni)
    # GUARD r254: preskoči tip/generik pozicije (<Ime za identifierjem —
    # useState<Layers> NI JSX oznaka; lekcija iz prvega teka codemoda).
    uredi = []
    for name in names:
        for m in re.finditer(r'<' + name + r'\b', src):
            if je_tip_pozicija(src, m.start()):
                continue
            end = scan_tag(src, m.start())
            if end == -1:
                continue
            tag = src[m.start():end]
            if re.search(r'aria-hidden(\s*=|\s*>)', tag):
                continue
            uredi.append((m.start(), m.end()))
    for s, e in sorted(uredi, reverse=True):
        src = src[:e] + ' aria-hidden="true"' + src[e:]
        popravki[rel] = popravki.get(rel, 0) + 1
    if uredi:
        open(path, 'w', encoding='utf-8').write(src)


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else 'audit'
    izjeme = []
    popravki = {}
    for root, _dirs, files in os.walk(SRC):
        for f in sorted(files):
            if not f.endswith('.tsx'):
                continue
            p = os.path.join(root, f)
            rel = os.path.relpath(p, os.path.dirname(SRC))
            if mode == 'audit':
                audit_file(p, rel, izjeme)
            else:
                codemod_file(p, rel, popravki)
    if mode == 'audit':
        print(json.dumps({'izjeme': izjeme, 'stevilo': len(izjeme)}, ensure_ascii=False, indent=1))
    else:
        print(json.dumps({'popravki': popravki, 'skupaj': sum(popravki.values()), 'datotek': len(popravki)}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
