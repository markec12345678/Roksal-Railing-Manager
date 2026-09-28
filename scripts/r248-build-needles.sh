#!/bin/bash
# R248 — build needleji: POVPREČNI RAZPON % (agregat razponske dimenzije —
# vsota razlik / vsota najboljših × 100; KPI box druga vrsta, sklepna
# vrstica, fail-closed odstotek od vsote najboljših 0, legenda formula,
# toast z ISTIM nizom) + (0) R247 % razlika + (1) R246 razponska + (2)
# primerjalni cenik izvoz + (3) [Mandatory] stil: signal barva amber/navy
# (0 novih hex) + (4) regresije R223–R247 (vse pini — cenik, wave 6,
# R243/R242/R241/R240/R239/R238/R237/R236/R235/R234/R233/R227).
# Lekcija r247: string needleji preživijo minifikacijo, identifikatorji NE —
# vsi R248 needleji so STRING LITERALS (KPI label, sklep del, fail-closed
# sporočilo, legenda); povprecniRazponNiz minified ime NI needle.
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

need_static() {
  if grep -rqF -- "$1" .next/static 2>/dev/null; then
    echo "OK   : $2"
  else
    echo "MISS : $2  (needle: $1)"
    FAIL=1
  fi
}

must_miss_static() {
  if grep -rqF -- "$1" .next/static 2>/dev/null; then
    echo "STAL : $2 ŠE VEDNO v static čankih (needle: $1)"; FAIL=1
  else
    echo "OK   : $2 (izginil — pravilno)"
  fi
}

echo "--- R246 razponska dimenzija (primerjalni, klient) ---"
need_static "Najvišja (EUR/enota)" "R246 Najvišja stolpec (CSV+PDF glava)"
need_static "Razlika (EUR/enota)" "R246 Razlika stolpec (CSV+PDF glava)"
need_static "manjka polje prices" "R246 fail-verbose: manjkajoče polje prices"
need_static "brez ujemajoče ponudbe v polju prices" "R246 fail-closed: vrstica brez ponudbe (NIKOLI izmišljena)"
need_static "manjkajoči inventoryId/cena v odgovoru API-ja" "R246 fail-closed: pokvarjena prices vrstica"
need_static "vsota razlik do najvišjih veljavnih cen" "R246 KPI Prihranek podpis (sklepna vrstica)"
need_static "Prihranek" "R246 KPI box label"
echo "--- R248 povprečni razpon (klient) ---"
need_static "Povprečni razpon" "R248 KPI box label (string literal)"
# LEKCIJA r248: minifier ubeži '·' kot \xb7 v TEMPLATE LITERALS (JSX tekst
# in navadni string literali ga ohranijo dobesedno — zato legenda/fail-closed
# gresta skozi, template deli ne). Needleji v template kontekstu NE SMEJO
# prečkati '·'; natančna lokacija (sklep vs toast) ostane dokazana v vitestu
# na viru (oknoMed trditve).
need_static " povprečni razpon " "R248 agregatna resnica v template delih (sklepna vrstica + toast)"
need_static " % najboljše cene " "R248 sklepna vrstica imenovatelj (template del, brez '·')"
need_static "odstotek od vsote najboljših cen 0 ne obstaja" "R248 fail-closed: odstotek od vsote 0 NIKOLI izmišljen"
need_static "· Povprečni razpon = vsota razlik / vsota najboljših" "R248 legenda formula (agregatna resnica — JSX tekst ohrani '·')"
echo "--- R247 % razlika (klient) ---"
need_static "% razlike" "R247 % razlike stolpec (CSV+PDF glava)"
need_static "razpon izražen tudi v odstotkih najboljše cene" "R247 sklepni podpis % resnica"
need_static "odstotek od najboljše cene 0 ne obstaja" "R247 fail-closed: odstotek od nič NIKOLI izmišljen"
# OPOMBA: needle 'razlikaOdstotekNiz(v)' NE PREŽIVI minifikacije (identifikator,
# ne string literal — lekcija r247). EN-prikazna-resnica resnica je dokazana
# (a) na viru: vitest r245 suite 'CSV uporablja razlikaOdstotekNiz' + (b) na
# ODPOSLANEM kodeksu: r247 E2E primerjalni CSV stolpec 7 = '13,5'/'0,0'.
need_static "· % = razpon do najvišje" "R247 legenda % resnica"
need_static "z dobaviteljem in razponom v %" "R247 toast + pill title % resnica"
echo "--- R245 primerjalni cenik (CSV + PDF, klient) ---"
need_static "Izvozi primerjalni cenik kot CSV" "R245 primerjalni CSV pill aria"
need_static "Izvozi primerjalni cenik kot PDF" "R245 primerjalni PDF pill aria"
need_static "Primerjalni-cenik-" "R245 primerjalni filename prefix (CSV+PDF)"
need_static "Ni vpisanih cen za primerjavo" "R245 primerjalni fail-closed toast (0 cen)"
need_static "manjka polje bestPerMaterial" "R245 fail-verbose oblika (manjkajoče polje)"
need_static "PRIMERJALNI CENIK" "R245 primerjalni PDF glava (lib v klientu)"
need_static "najnižja vpisana cena per artikel" "R245 primerjalni PDF iskren podpis"
need_static "Cenik = vse ponudbe · Primerjalni = najnižja per artikel" "R245 legenda izvozne skupine"
echo "--- R245 stil (pill pariteta + press-scale token + portal migracija) ---"
need_static "text-2xs text-muted-foreground" "R245 legenda žetoni"
need "hover:bg-roksal-green/90 press-scale transition-all" "R245 portal Pokliči CTA (token — server chunk)"
need "hover:bg-roksal-navy/90 press-scale transition-all" "R245 portal Email CTA (token — server chunk)"
echo "--- R245 documented exceptions (active:scale ostaja SAMO na NE-CTA karticah) ---"
need_static "hover:-translate-y-0.5 hover:border-roksal-amber/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/60 dark:focus-visible:ring-roksal-amber/40 active:scale-[0.98]" "R245 notification kartica (dokumentirana izjema ostaja)"
echo "--- R244 regresije (cenik + wave 6 + stil) ---"
need_static "Izvozi cenik materiala kot CSV" "R244 cenik CSV pill aria"
need_static "Izvozi cenik materiala kot PDF" "R244 cenik PDF pill aria"
need_static "Cenik-materiala-" "R244 cenik filename prefix (CSV+PDF)"
need_static "Ni vpisanih cen za izvoz" "R244 cenik fail-closed toast (0 cen)"
need_static "Odgovora /api/material-prices ni mogoče prebrati" "R244 cenik fail-verbose oblika"
need_static "CENIK MATERIALA" "R244 cenik PDF glava (lib v klientu)"
need_static "samo trenutno veljavne cene" "R244 cenik PDF iskren podpis"
need_static "Ustvarjanje terminov zahteva pravico" "R244 vodič terminov aria (role=note)"
need_static "Pregled terminov je samo za branje. Ustvarjanje terminov in" "R244 vodič terminov besedilo"
need_static "Upravljanje opreme zahteva pravico" "R244 vodič opreme aria (role=note)"
need_static "Pregled opreme je samo za branje. Dodajanje opreme in statusni" "R244 vodič opreme besedilo"
need_static "Beleženje dogodkov zahteva pravico" "R244 vodič dogodkov aria (role=note)"
need_static "production.manage" "R244 ime pravice v klientu (4 vodiči)"
need_static "flex-1 bg-roksal-navy text-white shadow-sm press-scale" "R244 Nov termin CTA mikro-pritisk"
need_static "w-full bg-roksal-navy text-white shadow-sm press-scale" "R244 Nova oprema CTA mikro-pritisk"
need_static "bg-roksal-navy hover:bg-roksal-navy/90 text-white press-scale" "R244 ekipa dialog CTA mikro-pritisk"
need_static "flex-1 h-9 bg-roksal-navy hover:bg-roksal-navy/90 text-white press-scale" "R244 Shrani meritev CTA mikro-pritisk"
need_static "shadow-sm press-scale btn-shine" "R244 Nov projekt hero CTA (token, brez bespoke trice)"
need_static "accent-roksal-navy" "R244 accent žeton (4 mesta)"
must_miss_static "accent-[#1d2b3e]" "arbitrary accent hex ostane migriran"
echo "--- R243 regresije (wave 5: vlogo-osveščeni vodiči, klient) ---"
need_static "Premiki zaloge so za branje — beleženje zahteva pravico" "R243 vodič premikov aria (role=note)"
need_static "Pregled zaloge je samo za branje" "R243 vodič premikov besedilo"
need_static "inventory.write" "R243 vodič premikov ime pravice v klientu"
need_static "Shranjevanje osnutka naročila zahteva pravico" "R243 vodič Osnutka aria (role=note)"
need_static "Shranjevanje osnutka naročila je pravica" "R243 vodič Osnutka besedilo"
need_static "procurement.create" "R243 vodič Osnutka ime pravice v klientu"
need_static "Dobavitelji so za branje — urejanje zahteva pravico" "R243 vodič dobaviteljev aria (role=note)"
need_static "Pregled dobaviteljev je samo za branje" "R243 vodič dobaviteljev besedilo"
need_static "catalog.manage" "R243 vodič dobaviteljev ime pravice v klientu"
need_static "Vpisi cen zahtevajo pravico" "R243 vodič cen aria (role=note)"
need_static "price.override" "R243 vodič cen ime pravice v klientu"
need_static "bg-roksal-amber hover:bg-roksal-amber/90 text-roksal-navy shadow-sm focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-1 press-scale" "R243 Potrdi premik CTA mikro-pritisk"
need_static "w-full bg-roksal-navy text-white press-scale" "R243 dialog Shrani/Shrani ceno mikro-pritisk"
echo "--- R242/R241/R240 regresije (RBAC ogledalo Naročil/Računov + Moja vloga) ---"
need_static "Pregled naročil je samo za branje" "R242 vlogo-osveščen vodič (samoBranjeNarocil)"
need_static "Naročila so za branje — upravljanje zahteva pravice" "R242 vodič aria-label (role=note)"
need_static "procurement.approve" "R242 ime pravice 1 v klientu"
need_static "procurement.receive" "R242 ime pravice 2 v klientu"
need_static "Pregled računov je samo za branje" "R241 vlogo-osveščen vodič"
need_static "invoices.create / invoices.issue / invoices.cancel" "R241 vodič navaja imena pravic"
need_static "Moja vloga in dovoljenja" "R240 meni item + dialog naslov"
need_static "Branje projektov" "R240 katalog label v klientu"
echo "--- R239/R238 regresije ---"
need "Za to dejanje je potrebna vloga " "R239 denyUnless 403 razlog (server bundle)"
need_static "Projekt ni bil ustvarjen: " "R239 fail-verbose 403 razlog v toastu"
need_static "Izvozi prodajno ploščo kot CSV" "R238 CSV gumb aria"
need_static "Ni projektov na plošči za izvoz" "R238 fail-closed toast"
need_static "text-2xs" "P1-e žeton 2xs"
need_static "text-3xs" "P1-e žeton 3xs"
must_miss_static "text-[10px]" "arbitrary 10px ostane migriran"
must_miss_static "text-[8px]" "arbitrary 8px ostane migriran"
echo "--- Regresije R223–R237 (izvozi družina + geselni žetoni + domov) ---"
need_static "Prenesi naročilnico vidnih artiklov kot PDF" "R237 Osnutek PDF pill"
need_static "osnutek-narocilnica-" "R237 filename prefix"
need_static "Izvozi dobavitelje kot PDF" "R236 Dobavitelji PDF"
need_static "Prenesi naročilnico naročila pri " "R235 Naročilnica pill"
need_static "Izvozi vidno zalogo kot PDF" "R234 Zaloga PDF"
need_static "Ni artiklov za izvoz." "R234 fail-closed toast"
need_static "Ni dobaviteljev za izvoz" "R233 fail-closed toast"
need_static "Brez dobavitelja (" "R227 žig aria"
echo "NEEDLE FAIL=$FAIL"
exit $FAIL
