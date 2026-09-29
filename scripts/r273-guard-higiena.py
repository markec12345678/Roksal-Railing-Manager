#!/usr/bin/env python3
"""R273 P1-b — guard higiena: migracija r265–r270 E2E skript.

Na VSAK python3 klic doda `|| exit 1` (fail-fast — r271 lekcija 4 + r272
lekcija 7: python assert tiho pade skozi = lažno zelena runda). Pravila:
  • heredoc (`python3 ... <<'PYEOF'`) → guard na UKAZNO vrstico, NIKOLI na
    delimiter (r271 lekcija 5 / r272 lekcija 7);
  • enovrstični `python3 -c "..."` → guard na konec vrstice;
  • večvrstični `python3 -c "` → guard na vrstico, kjer se narekovaj ZAPRE
    (štetje odprtih/zaprtih navedkov);
  • `print_mini() { python3 ...; }` → guard pred `; }`;
  • pipeline `cat x | python3 ...` → guard na konec cevi (exit = python);
  • SKIP: vrstice že z guardom, `if cmp -s` sestavljenke (python znotraj
    <( ) diagnostika — exit semantiko nosi if/else), `python3 -m json.tool`
    znotraj <(.
Po vsaki datoteki: `bash -n` sintaksnа preverba (fail-fast migracije).
"""
import re
import subprocess
import sys

GUARD = " || exit 1"
FAILS = []


def count_dq(s: str) -> int:
    """Štetje ne-escapanih dvojnih navedkov."""
    n = 0
    i = 0
    while i < len(s):
        c = s[i]
        if c == "\\":
            i += 2
            continue
        if c == '"':
            n += 1
        i += 1
    return n


def migrate(path: str) -> int:
    lines = open(path, encoding="utf-8").read().split("\n")
    out = []
    guards = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        # python3 klic: na začetku vrstice (opcijsko `cat … | ` ali `fn() { `)
        m = re.match(r"^(\s*(?:cat \S+ \| )?)(python3 )(.*)$", line)
        fn_m = re.match(r"^(\w+\(\) \{ )(python3 )(.*)$", line)
        if fn_m:
            body = fn_m.group(3)
            if "|| exit 1" not in line and not line.rstrip().endswith("; }"):
                # večvrstična funkcija — obdelaj kot običajen klic v telesu
                pass
            if "|| exit 1" not in line and line.rstrip().endswith("; }"):
                new = line.rstrip()[: -len("; }")] + GUARD + "; }"
                out.append(new)
                guards += 1
                i += 1
                continue
        if m:
            prefix, py, rest = m.group(1), m.group(2), m.group(3)
            full = prefix + py + rest
            if "|| exit 1" in line or "if cmp -s" in line:
                out.append(line)
                i += 1
                continue
            if re.search(r"<<'PYEOF'", line):
                out.append(line + GUARD)
                guards += 1
                i += 1
                continue
            # večvrstični -c blok: liho število navedkov = blok odprt
            if count_dq(rest) % 2 == 1:
                out.append(line)
                i += 1
                while i < len(lines):
                    block_line = lines[i]
                    out.append(block_line)
                    i += 1
                    if count_dq(block_line) % 2 == 1:
                        out[-1] = block_line + GUARD
                        guards += 1
                        break
                continue
            # enovrstični klic
            out.append(line + GUARD)
            guards += 1
            i += 1
            continue
        out.append(line)
        i += 1
    open(path, "w", encoding="utf-8").write("\n".join(out))
    r = subprocess.run(["bash", "-n", path], capture_output=True, text=True)
    if r.returncode != 0:
        FAILS.append((path, r.stderr[:400]))
        print(f"{path}: bash -n FAIL ({guards} guardov dodanih — ROLLBACK ročen)")
    else:
        print(f"{path}: bash -n OK, {guards} novih guardov")
    return guards


def main() -> None:
    total = 0
    for name in ["r265", "r266", "r267", "r268", "r269", "r270"]:
        p = f"/home/z/my-project/scripts/{name}-e2e-browser.sh"
        total += migrate(p)
    if FAILS:
        for p, err in FAILS:
            print(f"FAIL {p}: {err}")
        sys.exit(1)
    print(f"SKUPAJ: {total} novih guardov, vse skripte sintaktno ZDRAVE")


if __name__ == "__main__":
    main()
