import os

dirp = "/home/z/my-project/scripts/qa-needles"
content = """# qa-needles/r357.tsv — REGISTER needlejev runde R357 (FAZA 10
# orkestracija + STIL val 40). Kanon R340–R356: TSV, TAB ločilo,
# need_static = ŽIV v čankih, must_miss = NE SME biti prisoten.
# FAZA 10 ni build-diskriminator (logika, bajtni kontrakt POST;
# predhodnikId = opcionalen ključ) — needleji = val 40 statične celote.
# ============================================================================
# FORMAT (TSV; EN vrstica = EN needle; TAB je LOČILO) — kanon R340–R356.
#   <needle_string><TAB><opis><TAB><vrsta>
# vrsta: need_static (MORA biti ŽIV v čankih) | must_miss (NE SME biti)

# ── R357 lastni needleji ──
# statične celote (NOVI nizi — era-diskriminatorji):
Shrani novo verzijo — predhodna meritev ostane v zgodovini (korekcijska veriga)	R357 val 40 vnos forma submit title verzija veja (POGOJNA title 2 stanji; NOV ring navy/40)	need_static
LiDAR skeniranje meritev — kmalu na voljo	R357 val 40 Scaniraj aria (iskren stub; akcija+cilj+stanje; NOV ring)	need_static
Shrani izmerjeni kot v meritev izbrane lokacije	R357 val 40 InlineKotomer Shrani title (kontekst lokacije; NOV ring)	need_static
TODO-R357	R357 — brez razvojnih ostankov	must_miss
"""
path = os.path.join(dirp, "r357.tsv")
with open(path, "w", encoding="utf-8") as f:
    f.write(content)

# Verify tabs
import subprocess
bad = 0
with open(path, encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if line.startswith("#") or not line.strip():
            continue
        parts = line.rstrip("\n").split("\t")
        if len(parts) != 3:
            bad += 1
            print(f"VRSTICA {i}: NF={len(parts)}")
print("awk NF check:", "ČISTO" if bad == 0 else f"NAPAKE {bad}")
print("need_static:", sum(1 for l in open(path, encoding='utf-8') if not l.startswith('#') and l.strip() and l.rstrip('\n').split('\t')[-1] == 'need_static'))
print("must_miss:", sum(1 for l in open(path, encoding='utf-8') if not l.startswith('#') and l.strip() and l.rstrip('\n').split('\t')[-1] == 'must_miss'))
