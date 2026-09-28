#!/usr/bin/env python3
# R242 — pdftotext primerjava 4 artefaktov (lokal a/b + prod a/b):
# pričakovanje iz glifnega zaklepa — vsebinsko ISTO besedilo (isti artikel,
# iste vrstice), razlika SAMO v žigu HH:MM (lokal 06:14, prod 06:16).
import subprocess
import sys
from pathlib import Path

SS = Path('/home/z/my-project/screenshots')
ARTEFAKTI = ['r242-pdf-lokal-a', 'r242-pdf-lokal-b', 'r242-pdf-prod-a', 'r242-pdf-prod-b']

def dekodiraj(name: str) -> bytes:
    b64 = (SS / f'{name}.b64').read_text().strip()
    import base64
    return base64.b64decode(b64)

def tekst(bajti: bytes) -> str:
    p = SS / 'tmp.pdf'
    p.write_bytes(bajti)
    out = subprocess.run(['pdftotext', str(p), '-'], capture_output=True, text=True)
    return out.stdout

def main() -> int:
    besedila = {}
    for name in ARTEFAKTI:
        bajti = dekodiraj(name)
        magic = bajti[:5].decode('ascii')
        print(f'{name}: {len(bajti)} B, magija={magic!r}')
        if magic != '%PDF-':
            print('  NAPAKA: ni PDF'); return 1
        besedila[name] = tekst(bajti)
    print('\n--- tekstovna identičnost (pdftotext -layout ne-rabi; čisti extract) ---')
    ref = 'r242-pdf-lokal-a'
    for name in ARTEFAKTI[1:]:
        print(f'{name} == {ref}: {besedila[name] == besedila[ref]}')
    print('\n--- razlike glede na referenco (lokal-a), po vrsticah ---')
    ref_lines = besedila[ref].splitlines()
    for name in ARTEFAKTI[1:]:
        lines = besedila[name].splitlines()
        razlike = [
            (i, ref_lines[i] if i < len(ref_lines) else '<manjka>', lines[i] if i < len(lines) else '<manjka>')
            for i in range(max(len(ref_lines), len(lines)))
            if (ref_lines[i] if i < len(ref_lines) else None) != (lines[i] if i < len(lines) else None)
        ]
        if not razlike:
            print(f'{name}: NI vrstičnih razlik')
        else:
            for i, a, b in razlike[:10]:
                print(f'{name} vrstica {i}: {a!r} -> {b!r}')
    print('\n--- žig vrstice (osveženo/Generirano) iz referenc ---')
    for name in ARTEFAKTI:
        zigi = [l for l in besedila[name].splitlines() if 'osveženo' in l or 'Generirano' in l]
        print(f'{name}: {zigi}')
    (SS / 'tmp.pdf').unlink(missing_ok=True)
    return 0

if __name__ == '__main__':
    sys.exit(main())
