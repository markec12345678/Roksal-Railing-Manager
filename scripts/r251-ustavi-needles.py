#!/usr/bin/env python3
# R251 — ustvari scripts/r251-build-needles.sh iz r250 (isti regresijski sklop)
# in vstavi R251 needle blok PRED R250 blokom (string literal needleji —
# identifikatorje minifier preimenuje, lekcija r247/r248; '·' v JSX tekstu
# ohranjen dobesedno — lekcija r248/r250).
import io

SRC = '/home/z/my-project/scripts/r250-build-needles.sh'
DST = '/home/z/my-project/scripts/r251-build-needles.sh'

blok = '''echo "--- R251 opomnik PDF (klient) ---"
need_static "Pripravi opomnik kot PDF" "R251 opomnik pill aria"
need_static "Terenski list za ponovni kontakt kot pravi PDF" "R251 pill title"
need_static "OPOMNIK" "R251 opomnik PDF glava (lib v klientu)"
need_static "opomnik brez datuma ne nastaja dokumenta" "R251 fail-closed: brez datuma ni dokumenta"
need_static "PDF = terenski list za obisk · Potekel = prek datuma" "R251 legenda (JSX ohrani '·')"
need_static "Opomnik prenešen v PDF" "R251 toast title"
need_static "Opomnik ni nastavljen" "R251 fail-closed toast: brez datuma"
need_static "Opomnik PDF ni mogoče sestaviti iz teh podatkov" "R251 TypeError toast"
need_static "Opomnik-" "R251 filename prefix"
need_static "terenski list za obisk, odgovornost kontakta ostaja na timu" "R251 sklepni podpis"
need_static "Datum opomnika" "R251 KPI label"
need_static "Kontekst sodelovanja" "R251 sekcija konteksta"
'''

with io.open(SRC, 'r', encoding='utf-8') as f:
    vsebina = f.read()

marker = 'echo "--- R250 prihodki PDF (klient) ---"'
if marker not in vsebina:
    raise SystemExit('marker R250 ni najden')

# header komentar zamenjaj (r250 → r251, prihodki → opomnik + regresije)
vsebina = vsebina.replace('# R250 — build needleji: PRIHODKI PDF', '# R251 — build needleji: OPOMNIK PDF (8. člen \'izvozi\' družine — terenski list', 1)

vsebina = vsebina.replace(marker, blok + marker, 1)

with io.open(DST, 'w', encoding='utf-8') as f:
    f.write(vsebina)

print('r251-build-needles.sh ustvarjen, R251 blok vstavljen pred R250')
