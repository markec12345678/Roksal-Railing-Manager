#!/bin/bash
# R235 — build needleji: NAROČILNICA PDF iz naročila (gumb pill + fail-verbose
# toasti + lib dokument + ENA resnica delegacija + filename slug) +
# measurements UI površine gray → žetoni (P1-f) + negativni + regresije
# R228–R234. Lekcije r229/r230: scope SAMO .next/static + .next/server;
# needle oblike KOMPIRIRANE (string literali preživijo minifikacijo);
# single quotes obvezni (backticki = command substitution).
set -u
cd /home/z/my-project
FAIL=0

need() {
  if grep -rqF -- "$1" .next/static .next/server 2>/dev/null; then
    echo "OK   : $2"
  else
    echo "MISS : $2  (needle: $1)"
    FAIL=1
  fi
}

must_miss() {
  if grep -rqF -- "$1" .next/static 2>/dev/null; then
    echo "MISS : $2  ŠE VEDNO v static čankih (needle: $1)"; FAIL=1
  else
    echo "OK   : $2 (izginil — pravilno)"
  fi
}

echo "--- R235 pozitivni (Naročilnica PDF — gumb/handler) ---"
need 'Prenesi naročilnico naročila pri' "R235 PDF pill aria (delci — template literal)"
need 'Naročilnica kot pravi PDF za dobavitelja — determinističen dokument iz postavk' "R235 PDF pill title"
need 'Naročilnice PDF ni mogoče sestaviti iz tega naročila' "R235 fail-closed toast title (delegirani TypeError)"
need 'Prenos PDF ni uspel: ' "R235 fail-verbose catch"
need 'prenesena v PDF' "R235 uspeh toast (delci)"
need 'prava priloga za dobavitelja' "R235 uspeh toast opis"

echo "--- R235 pozitivni (lib narocilnica-pdf — dokument) ---"
need 'NAROČILNICA' "R235 PDF naslov (glava)"
need 'Dobavitelj: ' "R235 dobavitelj vrstica (2. vrstica tekstovne brata)"
need 'Povzetek naročila' "R235 KPI sekcija"
need 'narocilnica-' "R235 filename prefix (slug + stamp)"
need 'dobaviteljSlug' "R235 slug funkcija (eksportirana — preživi ime)"

echo "--- R235 pozitivni (stil — measurements UI površine žetoni) ---"
need 'bg-muted border border-border p-2 text-center' "R235 status števec škatle žetoni"
need 'font-bold text-muted-foreground line-through' "R235 ARHIVIRANA vrednost žeton + line-through semantika"
need 'border-border bg-muted text-muted-foreground cursor-not-allowed' "R235 glasovni gumb disabled žetoni"

echo "--- R235 negativni (gray unikati izginili; lekcija r234: unikatni med seboj) ---"
must_miss 'text-gray-500 dark:text-gray-400 uppercase tracking-wide' "Osnutki label gray (unikatna oblika)"
must_miss 'text-gray-400 uppercase tracking-wide' "Arhivirane label gray (unikatna oblika)"
must_miss 'font-bold text-gray-600 dark:text-gray-400' "Osnutki vrednost gray (unikatna oblika)"
must_miss 'font-bold text-gray-400 line-through' "Arhivirane vrednost gray (unikatna oblika)"
must_miss 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 text-gray-400 cursor-not-allowed' "glasovni disabled gray (unikatna oblika)"
# DRUGO/SEGMENT/beton legende OSTANEJO (r231 dokumentirana izjema) — zato
# njihovih nizov NI med negativnimi (file-wide negativa bi lažala — r234 lekcija 3).

echo "--- Regresije (R228-R234) ---"
need 'Izvozi vidno zalogo kot PDF' "R234 Zaloga PDF gumb aria"
need 'STANJE ZALOGE' "R234 PDF dokument naslov"
need 'Izvoz PDF ni uspel:' "R234 fail-verbose catch"
need 'NEAKTIVEN:"bg-muted text-muted-foreground border-border"' "R234 crm NEAKTIVEN žetoni (kompilirana oblika)"
need 'UPOKOJENO:"bg-muted text-muted-foreground border-border"' "R234 logistics UPOKOJENO žetoni (kompilirana oblika)"
need 'bg-muted text-muted-foreground border-border line-through' "R234 measurements ARHIVIRANA statusColors žeton"
need 'Izvozi dobavitelje kot CSV' "R233 Dobavitelji CSV gumb"
need 'Ni dobaviteljev za izvoz' "R233 fail-closed toast"
need '"Opombe","Pretekel rok"]' "R231 CSV glava ZADNJI stolpec"
need 'Izvozi naročila kot CSV' "R231/R232 naročila CSV gumb"
need 'Ni naročil za izvoz' "R232 fail-closed toast (0 naročil)"
need 'Zamujena dobava (' "R230 Domov kartica aria (delci)"
need 'Pretekel rok' "R229 badge tekst"
need '"Opozorila","Zamujena dobava"' "R228 vodja CSV vrstica"
need 'prices===0?"DA":"NE"' "R226 Zaloga CSV stolpec"
need '— brez vpisane nabavne cene' "R227 naročilnica oznaka"
need 'from-muted' "R230 deal-pipeline žeton"
need 'bg-roksal-navy text-white hover:bg-roksal-navy/90' "R232 cv-studio bbox aktivni žeton"
need 'bg-muted text-roksal-ink' "R229 Inox chip žeton"

if [ "$FAIL" = "1" ]; then
  echo "R235 NEEDLEJI: NEUSPEH"; exit 1
fi
echo "R235 NEEDLEJI: VSI OK"
