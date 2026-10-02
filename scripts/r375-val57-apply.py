#!/usr/bin/env python3
# r375-val57-apply.py — R375 MANDATORY STIL val 57: ring↔border OBLIKOVNA
# pariteta navy/40 obrobljenih gumbov v measurements-tab.tsx (NON-ring
# kandidat #1 iz R373 handoverja — disk resnica: 22 tarč; INPUT ×10 ocena
# iz handoverja = disk resnica 4 checkboxi, border-pariteta na native
# accent checkboxih NE smiselna → iskreno dokumentirano izpuščeno;
# amber/red bordered 2 → lastni družini, prihodnji val).
#
# TRANSFORMACIJA: 22 × INS ' focus-visible:border-roksal-navy/40
# dark:focus-visible:border-roksal-ink/40' TIK ZA
# 'focus-visible:ring-roksal-navy/40 focus-visible:ring-offset-2' (kanon
# calculator L4439 precedens: ring → offset → border + dark: ink obramba —
# r166 DARK obrobni stražar: border-roksal-navy/ IZGINE v temni temi
# [#1d2b3e na #1a2744] → dark:focus-visible:border-roksal-ink/40 obvezen;
# FULL vitest tek 1 ujel prvi INS brez dark: — stražar deluje, popravljeno
# V ISTI rundi; outline NI after ring na nobeni tarči — triaža 18 pred /
# 4 brez → NI preurejanja, razliko od val 56 belih RAW). In-place 0 novih
# vrstic; +76 znakov/vrstico (×22 = +1672); 0 novih hex; aria/title
# ZAMRZNJENI; ring ŽE naprej brez dark: variante (PRED disk resnica —
# pariteta ring↔border na SVETLI žeton, border ima POMENJENO dark: obrambo
# po r166 kanonu).
#
# FAIL-CLOSED (transformacijski dokument — LEKCIJA R373 (3)):
#   - tarče izpeljane IZ DISKA vsak tek (nikoli hardcodirane vrstice) —
#     orodje odporno na vrstične številke (KOLIZIJA #17 re-apply kanon);
#   - per-vrstično: sekvenca točno ×1, border ŽE prisoten → abort;
#   - re-run po uspešnem applyu abortira na 'Ni tarč' (idempotenčna zaščita);
#   - amber/red + INPUT checkbowerji + ostale datoteke: NE PADEJO POD
#     transformacijo (ožji obseg navy/40 + border širina + measurements).
import pathlib, re, sys

F = pathlib.Path("/home/z/my-project/src/components/roksal/measurements-tab.tsx")
RING = "focus-visible:ring-roksal-navy/40"
OFFSET = "focus-visible:ring-offset-2"
BORDER = "focus-visible:border-roksal-navy/40"
DARK_BORDER = "dark:focus-visible:border-roksal-ink/40"
SEKVENCA = f"{RING} {OFFSET}"
INS = f" {BORDER} {DARK_BORDER}"
SIRINA = re.compile(r"[\s'\"\{(]border(-[0-9](?:\.\d)?)?[\s'\"\})]")

src = F.read_text(encoding="utf-8")
vrstice = src.split("\n")

tarce = []
for i, l in enumerate(vrstice):
    if RING in l and OFFSET in l and "focus-visible:border" not in l and SIRINA.search(l):
        tarce.append(i)
if not tarce:
    sys.exit("FAILOVEDANO: Ni tarč — bodisi val 57 ŽE apliciran (idempotenca) bodisi disk spremenjen. Nič ne pišem.")
print(f"tarče iz diska: {len(tarce)} vrstic: {[i + 1 for i in tarce]}")
if len(tarce) != 22:
    sys.exit(f"FAILOVEDANO: {len(tarce)} tarč ≠ 22 (disk resnica val 57) — nič ne pišem")

for i in tarce:
    l = vrstice[i]
    if l.count(SEKVENCA) != 1:
        sys.exit(f"FAILOVEDANO: vrstica {i+1}: sekvenca ×{l.count(SEKVENCA)} ≠ ×1")
    if "focus-visible:border" in l:
        sys.exit(f"FAILOVEDANO: vrstica {i+1}: border ŽE prisoten (idempotenca)")
    vrstice[i] = l.replace(SEKVENCA, SEKVENCA + INS, 1)

out = "\n".join(vrstice)

c_novi = out.count(f"{SEKVENCA}{INS}")
c_staro = sum(1 for l in out.split("\n") if SEKVENCA in l and BORDER not in l and SIRINA.search(l) and RING in l and OFFSET in l)
if c_novi != 22:
    sys.exit(f"FAILOVEDANO: PO sekvenc ×{c_novi} ≠ 22")
if c_staro != 0:
    sys.exit(f"FAILOVEDANO: PO preostali gap ×{c_staro} ≠ 0")
if len(out.split("\n")) != len(vrstice):
    sys.exit("FAILOVEDANO: število vrstic spremenjeno (in-place kršitev)")
delta = len(out) - len(src)
if delta != 76 * 22:
    sys.exit(f"FAILOVEDANO: delta {delta} ≠ {76 * 22}")
# (aria/title/hex števec dokazujeta testi r372 per-datoteka — INS ne doda nobenega)
n_amber = out.count("focus-visible:ring-roksal-amber/40")
n_red = out.count("focus-visible:ring-roksal-red/40")
print(f"PO: 22 × '{SEKVENCA}{INS}' · gap 0 · vrstice {len(vrstice)} (in-place) · delta +{delta} · amber/red ring žetoni nespremenjeni ({n_amber}/{n_red})")
F.write_text(out, encoding="utf-8")
print(f"OK: {F} zapisan")
