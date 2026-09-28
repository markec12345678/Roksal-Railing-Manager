#!/usr/bin/env python3
# R254 (P1-d) — POPRAVILO DUPLIKATOV: codemod je vstavil aria-hidden="true"
# v oznake, ki so že imele GOLI aria-hidden (boolean okrajšava, brez ="true")
# — dedup regex `aria-hidden(\s*=|\s*>)` ni prepoznal `aria-hidden className`
# oblike → TS17001 'multiple attributes with the same name'.
# Popravilo: v vsaki oznaki, ki vsebuje VALUIRAN aria-hidden="true" IN goli
# aria-hidden, odstrani goli (valuiran ostane — enaka resnica, en atribut).
# Idempotentno; uporablja ISTI scan_tag skener kot codemod.
import json
import os
import re

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src')

LUCIDE_IMPORT_RE = re.compile(r"import\s*\{([^}]*)\}\s*from\s*['\"]lucide-react['\"]", re.S)


def lucide_names(src: str) -> set:
    names = set()
    for m in LUCIDE_IMPORT_RE.finditer(src):
        for part in m.group(1).split(','):
            alias = part.strip().split(' as ')[-1].strip()
            if re.match(r'^[A-Z][A-Za-z0-9]*$', alias):
                names.add(alias)
    return names


def scan_tag(src: str, start: int) -> int:
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


BARE_RE = re.compile(r'(?<![A-Za-z0-9_$-])aria-hidden(?!\s*=)(?![\w-])')


def popravi_file(path: str) -> int:
    src = open(path, encoding='utf-8').read()
    names = lucide_names(src)
    if not names:
        return 0
    oznake = []
    for name in names:
        for m in re.finditer(r'<' + name + r'\b', src):
            end = scan_tag(src, m.start())
            if end == -1:
                continue
            oznake.append((m.start(), end))
    # od zadaj, da offseti ostanejo veljavni
    n_popravk = 0
    for s, e in sorted(set(oznake), reverse=True):
        tag = src[s:e]
        if 'aria-hidden="true"' not in tag and 'aria-hidden={true}' not in tag:
            continue
        nov, st = BARE_RE.subn('', tag)
        if st > 0:
            src = src[:s] + nov + src[e:]
            n_popravk += st
    if n_popravk:
        open(path, 'w', encoding='utf-8').write(src)
    return n_popravk


def main() -> None:
    popravki = {}
    for root, _dirs, files in os.walk(SRC):
        for f in sorted(files):
            if not f.endswith('.tsx'):
                continue
            p = os.path.join(root, f)
            rel = os.path.relpath(p, os.path.dirname(SRC))
            n = popravi_file(p)
            if n:
                popravki[rel] = n
    print(json.dumps({'popravki': popravki, 'skupaj': sum(popravki.values())}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
