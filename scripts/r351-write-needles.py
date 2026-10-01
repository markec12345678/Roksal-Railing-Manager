#!/usr/bin/env python3
# r351-write-needles.py — R351 register (kanon r350-write-needles.py):
# python write z eksplicitnim \t (LEKCIJA R346 1), awk NF=3 preverba.
REG = 'scripts/qa-needles/r351.tsv'

vrstice = [
    '# qa-needles/r351.tsv — REGISTER needlejev runde R351 (pdf-seznam GLIFNI',
    '# POPRAVEK: helvetica → registerSloPdfFonts [Roboto subset latin-ext —',
    '# r269 vzorec; č/š/ž v glavi/povzetku/tabeli sedaj pravilni; ENA',
    '# vsebinska sprememba izvoza iskreno dokumentirana, determinizem čist —',
    '# FontFile2 bajtni dokaz na modulu] + STIL val 34: a11y parity filter',
    '# čipi družine [status čipi ×4 + Foto mere pill] — aria-pressed toggle',
    '# stanje + aria-label z countom + title + izrecen ring navy/40 V ISTEM',
    '# commitu — LEKCIJA R346 kanon).',
    '# ============================================================================',
    '# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO) — kanon R340–R350.',
    '#   <needle_string><TAB><opis><TAB><vrsta>',
    '# vrsta: need_static (MORA biti ŽIV v čankih) | must_miss (NE SME biti)',
    '',
    '# ── R351 lastni needleji ──',
    '# GLIFNI POPRAVEK: NI edinstvenega build needleja (registerSloPdfFonts je',
    '# v measurements čankih ŽE od R269 prek lib/meritve-teren-pdf — iskrena',
    '# omejitev: pokritost = tsc + vitest r351-pdf-font ×10 [FontFile2 bajtni',
    '# dokaz] + E2E regresija). TUDI "ROKSAL — Seznam meritev" ni R350',
    '# diskriminator (string obstaja v tabu že pred R350 — odkrito v R351',
    '# harvestu; ostane v r350 registru kot prisotnost, ne era-diskriminator).',
    '# STIL val 34: statični predponi deli template literalov + celoti:',
    'Filtriraj po statusu: \tR351 val 34 status čipi aria prefix (×4 čipi, template literal)\tneed_static',
    'Pokaži meritve statusa \tR351 val 34 status čipi title prefix (template literal)\tneed_static',
    'Foto mere filter: prikaži samo meritve zajete na foto zavihku\tR351 val 34 foto pill aria (statična celota — NOV niz)\tneed_static',
    'TODO-R351\tR351 — brez razvojnih ostankov\tmust_miss',
]

with open(REG, 'w', encoding='utf-8') as f:
    f.write('\n'.join(vrstice) + '\n')

# preverba: vsa data vrstica = 3 polja (awk NF=3 kanon)
import subprocess
r = subprocess.run(['awk', '-F', '\\t', 'NF!=0 && $0 !~ /^#/ { if (NF != 3) { print "BAD:", NR, NF; exit 1 } }', REG])
if r.returncode != 0:
    raise SystemExit('TSV preverba FAILED')
n_data = sum(1 for l in vrstice if l and not l.startswith('#'))
print(f'OK: {REG} — {n_data} data vrstic (3 need_static + 1 must_miss), NF=3 čisto')
