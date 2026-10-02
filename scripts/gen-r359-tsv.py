import pathlib

# r359.tsv — REGISTER needlejev runde R359 (STIL val 42: a11y resnica
# status-orkestracije družine). Kanon R340–R358: TSV, TAB ločilo,
# need_static = ŽIV v čankih, must_miss = NE SME biti prisoten.
# Val 42 je DODATEN (nikar ne menja pinanih nizov — register r350.tsv je
# zamrznjen era-kontrakt): 3 NOVI nizi = era-diskriminatorji.
rows = [
    ("Zapri pogovorno okno — nič se ne arhivira, izbira meritev ostane",
     "R359 val 42 bulk dialog Prekliči title (iskrena posledica; NOV ring v istem commitu)",
     "need_static"),
    ("Zaporedno arhiviraj izbrane meritve — že arhivirane se štejejo kot opravljene (idempotentno)",
     "R359 val 42 bulk dialog Arhiviraj title (iskrena posledica; ring-2 red-500 + offset-2)",
     "need_static"),
    ("Potrdi arhiviranje izbranih meritev v bazo",
     "R359 val 42 bulk dialog Arhiviraj aria (akcija+cilj; vidno besedilo nosi števec)",
     "need_static"),
    ("TODO-R359",
     "R359 — brez razvojnih ostankov",
     "must_miss"),
]
out = pathlib.Path("scripts/qa-needles/r359.tsv")
glava = (
    "# qa-needles/r359.tsv — REGISTER needlejev runde R359 (STIL val 42:\n"
    "# a11y resnica status-orkestracije družine). Kanon R340–R358: TSV, TAB\n"
    "# ločilo, need_static = ŽIV v čankih, must_miss = NE SME biti prisoten.\n"
    "# Val 42 = DODATEN val (pinani nizi starejših registr ostajajo bajtno\n"
    "# identični — 3 NOVI nizi so era-diskriminatorji).\n"
    "# ============================================================================\n"
    "# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO) — kanon R340–R358.\n"
    "#   <needle_string><TAB><opis><TAB><vrsta>\n"
    "# vrsta: need_static (MORA biti ŽIV v čankih) | must_miss (NE SME biti)\n"
    "\n"
    "# ── R359 lastni needleji ──\n"
    "# statične celote (NOVI nizi — era-diskriminatorji):\n"
)
telo = "".join(f"{n}\t{o}\t{v}\n" for n, o, v in rows)
out.write_text(glava + telo, encoding="utf-8")
print("napisano:", out)
