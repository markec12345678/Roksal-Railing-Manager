#!/usr/bin/env python3
# R348 — pisanje scripts/qa-needles/r348.tsv (LEKCIJA R346 1: Write orodje
# TAB→presledki v TSV → python write z eksplicitnim \t je kanon).
# need_static ×5 = val 31 a11y nizi (NOVI minifikacijo-preživeči stringi);
# FAZA 5 = unifikacija stale kopij → NI edinstvenega needleja za SAM premik
# (iskrena omejitev: pokritost = tsc + vitest r348-meritve-faza5 ×18 + E2E).
import io

rows = [
    ("Izvozi vse meritve kot CSV", "R348 val 31 CSV vse meritve aria-label (parity R186 vodja)", "need_static"),
    ("Izvozi pregled meritev kot PDF", "R348 val 31 PDF pregled aria-label", "need_static"),
    ("Izvozi izbrane meritve kot CSV", "R348 val 31 bulk CSV aria-label", "need_static"),
    ("Izvozi zgodovino meritev kot CSV", "R348 val 31 zgodovina CSV aria-label (shadcn Button)", "need_static"),
    ("Izvozi preglednico stebrov kot CSV", "R348 val 31 steber-table CSV aria-label", "need_static"),
    ("TODO-R348", "R348 — brez razvojnih ostankov", "must_miss"),
]
with io.open("/home/z/my-project/scripts/qa-needles/r348.tsv", "w", encoding="utf-8") as f:
    f.write("# qa-needles/r348.tsv — REGISTER needlejev runde R348 (measurements\n")
    f.write("# FAZA 5: EN VIR gradnja starejše družine CSV izvozov\n")
    f.write("# [measurements/izvoz-csv.ts: csvEsc/csvDokument/MERITVE_CSV_HEADER/\n")
    f.write("# zgradiMeritveVrstice — 4 × inline Blob → kanon downloadCsvText,\n")
    f.write("# 15 × inline escape → csvEsc, 4 × inline BOM → csvDokument,\n")
    f.write("# handleExportCSV ≡ handleBulkExportCSV stale telesi → 1 gradnik]\n")
    f.write("# + STIL val 31: a11y parity izvozne družine meritev (5 gumbov).\n")
    f.write("# FORMAT (TSV; TAB ločilo — kanon R340–R347):\n")
    f.write("#   <needle_string><TAB><opis><TAB><vrsta>\n")
    for needle, opis, vrsta in rows:
        f.write(f"{needle}\t{opis}\t{vrsta}\n")
print("written r348.tsv")
