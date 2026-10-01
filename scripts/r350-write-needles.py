#!/usr/bin/env python3
# r350-write-needles.py — R350 register (kanon r349-write-needles.py):
# python write z eksplicitnim \t (LEKCIJA R346 1), awk NF=3 preverba.
REG = 'scripts/qa-needles/r350.tsv'

vrstice = [
    '# qa-needles/r350.tsv — REGISTER needlejev runde R350 (measurements FAZA',
    '# 7: ostanki starejše izvozne družine EN VIR → izvoz-csv.ts razširitev',
    '# [STEBRI_CSV_HEADER/zgradiStebriVrstice + ZGODOVINA_CSV_HEADER/',
    '# zgradiZgodovinaVrstice — VERBATIM] + NOV measurements/pdf-seznam.ts',
    '# [buildSeznamPdfDoc + exportSeznamPdf — 85-vrstični inline jsPDF blok',
    '# izluščen; setFileId FNV soli 0xd9–0xdc + setCreationDate kanon r269]',
    '# + STIL val 33: a11y parity skupinske akcije / izbira — bulk orodna',
    '# vrstica 4 brata [Izberi vse / Počisti / Kopiraj / Izbriši izbrane]',
    '# aria+title+ring navy/40 V ISTEM commitu — LEKCIJA R346 kanon).',
    '# ============================================================================',
    '# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO) — kanon R340–R349.',
    '#   <needle_string><TAB><opis><TAB><vrsta>',
    '# vrsta: need_static (MORA biti ŽIV v čankih) | must_miss (NE SME biti)',
    '',
    '# ── R350 lastni needleji ──',
    '# FAZA 7 je premik teles — EDINSTVEN needle = PDF glava string literal',
    '# (modul pdf-seznam.ts; minifikacija ohrani string literale):',
    'ROKSAL — Seznam meritev\tR350 FAZA 7 seznam PDF glava (pdf-seznam.ts, izginil iz taba)\tneed_static',
    '# STIL val 33: aria/title so STATIČNI nizi (ne template literali — ×4',
    '# gumba; parity val 31 brata Izvozi izbrane CSV ostaja v r348 registru):',
    'Izberi vse vidne meritve za skupinske akcije\tR350 val 33 Izberi vse aria\tneed_static',
    'Izberi vse meritve vidnega (filtriranega) seznama\tR350 val 33 Izberi vse title\tneed_static',
    'Počisti izbor izbranih meritev\tR350 val 33 Počisti aria\tneed_static',
    'Odizbori vse izbrane meritve\tR350 val 33 Počisti title\tneed_static',
    'Kopiraj izbrane meritve v ciljni segment\tR350 val 33 Kopiraj aria (vidno besedilo NE razlaga cilja)\tneed_static',
    'Kopiraj izbrane meritve v izbrani ciljni segment\tR350 val 33 Kopiraj title\tneed_static',
    'Izbriši izbrane meritve\tR350 val 33 Izbriši aria\tneed_static',
    'Trajno izbriši vse izbrane meritve\tR350 val 33 Izbriši title\tneed_static',
    'TODO-R350\tR350 — brez razvojnih ostankov\tmust_miss',
]

with open(REG, 'w', encoding='utf-8') as f:
    f.write('\n'.join(vrstice) + '\n')

# preverba: vsa data vrstica = 3 polja (awk NF=3 kanon)
import subprocess
r = subprocess.run(['awk', '-F', '\\t', 'NF!=0 && $0 !~ /^#/ { if (NF != 3) { print "BAD:", NR, NF; exit 1 } }', REG])
if r.returncode != 0:
    raise SystemExit('TSV preverba FAILED')
n_data = sum(1 for l in vrstice if l and not l.startswith('#'))
print(f'OK: {REG} — {n_data} data vrstic (9 need_static + 1 must_miss), NF=3 čisto')
