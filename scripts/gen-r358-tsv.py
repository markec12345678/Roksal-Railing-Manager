import io

# qa-needles/r358.tsv — REGISTER needlejev runde R358 (FAZA 11 repost
# orkestracija + STIL val 41). Kanon R340-R357: TSV, TAB locilo,
# need_static = ZIV v cankih, must_miss = NE SME biti prisoten.
# FAZA 11 ni build-diskriminator (logika, repost teles VERBATIM) —
# needleji = val 41 staticne celote (3 NOVI titleji — era-diskriminatorji).
rows = [
    (
        "Sinhroniziraj vse lokalne osnutke v bazo — zaporedno v determinističnem vrstnem redu",
        "R358 val 41 syncAll title (posledica: zaporedno deterministično; aria ŽE nosi akcija+cilj+števec)",
        "need_static",
    ),
    (
        "Pošlji shranjeno telo osnutka v bazo (neuspeh ostane lokalni osnutek)",
        "R358 val 41 per-draft Sinhroniziraj title (repost telo VERBATIM R152; iskrena posledica)",
        "need_static",
    ),
    (
        "Odstrani lokalni osnutek — ni bil nikoli poslan v bazo",
        "R358 val 41 discard X title (iskrena posledica; aria nosi akcija+cilj)",
        "need_static",
    ),
    (
        "TODO-R358",
        "R358 — brez razvojnih ostankov",
        "must_miss",
    ),
]
with io.open("scripts/qa-needles/r358.tsv", "w", encoding="utf-8", newline="") as f:
    f.write(
        "# qa-needles/r358.tsv — REGISTER needlejev runde R358 (FAZA 11\n"
        "# repost orkestracija + STIL val 41). Kanon R340–R357: TSV, TAB ločilo,\n"
        "# need_static = ŽIV v čankih, must_miss = NE SME biti prisoten.\n"
        "# FAZA 11 ni build-diskriminator (logika, repost teles VERBATIM;\n"
        "# posljiRepostMere = opcionalen predhodnikId + nullable AR/GPS) —\n"
        "# needleji = val 41 statične celote (3 NOVI titleji).\n"
        "# ============================================================================\n"
        "# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO) — kanon R340–R357.\n"
        "#   <needle_string><TAB><opis><TAB><vrsta>\n"
        "# vrsta: need_static (MORA biti ŽIV v čankih) | must_miss (NE SME biti)\n"
        "\n"
        "# ── R358 lastni needleji ──\n"
        "# statične celote (NOVI nizi — era-diskriminatorji):\n"
    )
    for needle, opis, vrsta in rows:
        f.write(f"{needle}\t{opis}\t{vrsta}\n")
print("OK: r358.tsv written")
