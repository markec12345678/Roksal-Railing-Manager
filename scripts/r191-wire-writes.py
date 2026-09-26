#!/usr/bin/env python3
"""R191 — val 2: zapisOmejitev guard v VSE preostale mutirajoče rute.

Robustno: najde vsak `export async function <METHOD>(` in vstavi guard
takoj za odpirajočim `{` telesa funkcije (podpira enovrstične signature,
večvrstične parametre in povratne tipa `: Promise<NextResponse>`).
"""
import os, re, sys

root = 'src/app/api'
IMPORT_LINE = "import { zapisOmejitev } from '@/lib/rate-limit'"
GUARD_T = ("  // R191 — val 2 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)\n"
           "  const zavrnjeno = zapisOmejitev(request, '{ruta}')\n"
           "  if (zavrnjeno) return zavrnjeno\n")
METHODS = ('POST', 'PATCH', 'DELETE', 'PUT')


def ruta_ime(path: str) -> str:
    rel = path[len('src/app/api/'):-len('/route.ts')]
    return rel


def vstavi_guard(src: str, ruta: str):
    """Vrni (nov_src, št_vstavljenih). Idempotentno na nivoju datoteke."""
    out = []
    pos = 0
    n = 0
    pat = re.compile(r'export async function (POST|PATCH|DELETE|PUT)\(')
    while True:
        m = pat.search(src, pos)
        if not m:
            out.append(src[pos:])
            break
        # najdi zapirajoci oklepaj seznama parametrov
        depth = 1
        i = m.end()
        while i < len(src) and depth > 0:
            if src[i] == '(':
                depth += 1
            elif src[i] == ')':
                depth -= 1
            i += 1
        # preskoči opcijski povratni tip do '{'
        while i < len(src) and src[i] != '{':
            i += 1
        if i >= len(src):
            out.append(src[pos:])
            break
        body_start = i + 1
        out.append(src[pos:body_start])
        out.append('\n' + GUARD_T.format(ruta=ruta).rstrip('\n') + '\n')
        n += 1
        pos = body_start
    return ''.join(out), n


def main():
    total_files = 0
    total_guards = 0
    for dirpath, _, files in os.walk(root):
        for f in sorted(files):
            if f != 'route.ts':
                continue
            path = os.path.join(dirpath, f)
            src = open(path).read()
            if 'checkRate' in src or 'zapisOmejitev' in src:
                continue
            has_mutation = re.search(r'export async function (?:POST|PATCH|DELETE|PUT)\(', src)
            if not has_mutation:
                continue
            ruta = ruta_ime(path)
            # 1) import za zadnjo import vrstico
            import_ends = [m.end() for m in re.finditer(r"^import .*?from ['\"].*['\"]\s*$", src, re.M)]
            if not import_ends:
                print(f"NAPAKA: ni importov: {path}"); sys.exit(1)
            src = src[:import_ends[-1]] + '\n' + IMPORT_LINE + src[import_ends[-1]:]
            # 2) guardi
            src, n = vstavi_guard(src, ruta)
            open(path, 'w').write(src)
            total_files += 1
            total_guards += n
            print(f"OK {path.replace('src/app/api/','')} ({n} guardov, ruta '{ruta}')")
    print(f"SKUPAJ: {total_files} datotek, {total_guards} guardov")


main()
