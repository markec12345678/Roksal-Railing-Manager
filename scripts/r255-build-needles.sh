#!/bin/bash
# R255 — build needleji: (11) VOZNI RED MONTAŽ PDF (logistika — terenski list
# ekipe, kronološki red; EN VIR = normalizirajTermin) + F2 žeton navy-soft
# (to-[#2a3f5f] → to-roksal-navy-soft — EXACT vrednost, 1 arbitrary hex manj) +
# (4) R254 aria/žetoni + (13) R253 koledar pregledov + (11) R252 potekli
# opomniki + (9) R251 opomnik + (7) R250 prihodki + (6) R249 največji razpon +
# ... + regresije R223–R249.
# Lekcija r247/r248: string needleji preživijo minifikacijo, identifikatorji
# NE; minifier ubeži '·' kot \xb7 v TEMPLATE LITERALS — needleji so STRING
# LITERALS (legenda je JSX tekst — '·' ohranjen dobesedno, vzorec r250–r255).
# LEKCIJA R255: needle probe za žetone v dynamic-import tabih zahteva dispatch
# TISTEGA taba pred zbiranjem čankov (site-survey accent-roksal-amber lažni
# MISS v prod QA dokler teren dispatch ni bil dodan).
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

echo "--- R255 F2 žeton navy-soft (klient) ---"
must_miss_static "to-[#2a3f5f]" "arbitrary gradient hex ostane migriran na to-roksal-navy-soft (EXACT vrednost — 1 hex manj)"
need_static "to-roksal-navy-soft" "R255 gradient žeton (top-bar + floor-plan CardHeader — EXACT #2a3f5f)"
echo "--- R255 vozni red montaž PDF (klient) ---"
need_static "Izvozi vozni red montaž kot PDF" "R255 pill aria"
need_static "Vozni red montaž kot terenski list (kronološki red)" "R255 pill title"
need_static "VOZNI RED MONTAŽ" "R255 PDF glava"
need_static "prazen vozni red ne nastaja dokumenta" "R255 fail-closed: prazen vozni red"
need_static "CSV = prikazani termini · ICS = koledar v telefonu · PDF = vozni red (kronološki)" "R255 legenda izvozne skupine"
need_static "Vozni red prenešen v PDF" "R255 toast title"
need_static "Ni vidnih terminov montaže" "R255 fail-closed toast"
need_static "PDF se izvozi, ko je vpisan prvi termin montaže." "R255 fail-closed toast opis"
need_static "Vozni-red-montaz-" "R255 filename prefix"
need_static "kronološki red (najbližji termin prvi)" "R255 sklepni podpis"
need_static "vir = vidni termini logistike." "R255 sklep vir resnica"
need_static '"Načrtovane ure"' "R255 KPI label (ure — vozniRedUreKpi; minifier dvojni navedki)"
need_static '"Zaključenih"' "R255 KPI label (zaključenih; minifier dvojni navedki)"
need_static '"Datum","Čas","Projekt","Stranka","Ekipa","Status","Ure","Lokacija"' "R255 tabela 8 stolpcev (minifier: dvojni navedki brez presledkov — R253 lekcija 2)"
need_static "status mora biti VERBATIM iz API-ja" "R255 fail-closed: neznan status → TypeError"
echo "--- R246 razponska dimenzija (primerjalni, klient) ---"
need_static "Najvišja (EUR/enota)" "R246 Najvišja stolpec (CSV+PDF glava)"
need_static "Razlika (EUR/enota)" "R246 Razlika stolpec (CSV+PDF glava)"
need_static "manjka polje prices" "R246 fail-verbose: manjkajoče polje prices"
need_static "brez ujemajoče ponudbe v polju prices" "R246 fail-closed: vrstica brez ponudbe (NIKOLI izmišljena)"
need_static "manjkajoči inventoryId/cena v odgovoru API-ja" "R246 fail-closed: pokvarjena prices vrstica"
need_static "vsota razlik do najvišjih veljavnih cen" "R246 KPI Prihranek podpis (sklepna vrstica)"
need_static "Prihranek" "R246 KPI box label"
echo "--- R254 P1-d aria + žetonske migracije (klient) ---"
must_miss_static "accent-[#f59e0b]" "arbitrary amber hex ostane migriran na accent-roksal-amber (EXACT vrednost)"
must_miss_static "bg-[#f7f9ff]" "arbitrary bg hex ostane migriran na bg-roksal-bg (EXACT vrednost)"
need_static "accent-roksal-amber" "R254 site-survey accent žeton (EXACT roksal-amber #f59e0b)"
need_static "bg-roksal-bg" "R254 landing page žeton (EXACT roksal-bg #f7f9ff)"
echo "--- R253 koledar pregledov PDF (klient) ---"
need_static "Izvozi koledar pregledov kot PDF" "R253 pill aria"
need_static "Koledar pregledov kot PDF časovna vrsta (vsi vpisani datumi, najbližji prvi)" "R253 pill title"
need_static "KOLEDAR PREGLEDOV" "R253 PDF glava"
need_static "prazen koledar ne nastaja dokumenta" "R253 fail-closed: prazen koledar"
need_static "koledar je izpeljava iz opomnikStatus" "R253 fail-closed: NI vnos"
need_static "prazna množica ne nastaja dokumenta" "R253 fail-closed: povzetek prazne množice"
need_static "Potekel = prek datuma · Koledar = vsi vpisani pregledi (časovna vrsta)" "R253 legenda dodatek (R252 needle nepoškodovan)"
need_static "Koledar pregledov prenešen v PDF" "R253 toast title"
need_static "Ni vpisanih pregledov" "R253 fail-closed toast"
need_static "PDF se izvozi, ko je vpisan prvi datum pregleda." "R253 fail-closed toast opis"
need_static "Koledar-pregledov-" "R253 filename prefix"
need_static "koledarski red (najbližji pregled prvi)" "R253 sklepni podpis"
need_static "V tem tednu" "R253 KPI label"
need_static "\"Status\",\"Dni do\",\"Opis\"" "R253 tabela 7 stolpcev"
echo "--- R252 potekli opomniki PDF (klient) ---"
need_static "Izvozi potekle opomnike kot PDF" "R252 pill aria"
need_static "Potekli opomniki kot akcijski PDF seznam za pisarno" "R252 pill title"
need_static "POTEKLI OPOMNIKI" "R252 PDF glava"
need_static "prazen seznam ne nastaja dokumenta" "R252 fail-closed: prazen seznam"
need_static "seznam je izpeljava iz opomnikStatus" "R252 fail-closed: nepotečen vnos"
need_static "max prazne množice ne obstaja" "R252 fail-closed: povzetek prazne množice"
need_static "CSV = prikazani seznam · PDF = potekli opomniki (akcija) · Potekel = prek datuma" "R252 legenda"
need_static "Potekli opomniki prenešeni v PDF" "R252 toast title"
need_static "Ni poteklih opomnikov" "R252 fail-closed toast"
need_static "Potekli-opomniki-" "R252 filename prefix"
need_static "akcijski seznam za pisarno (najstarejši prvi)" "R252 sklepni podpis"
need_static "vir = opomnikStatus iz CRM" "R252 sklep vir resnica"
need_static "Najstarejši (dni)" "R252 KPI label"
need_static "Akcija za pisarno" "R252 sekcija"
echo "--- R251 opomnik PDF (klient) ---"
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
echo "--- R250 prihodki PDF (klient) ---"
need_static "Izvozi prihodke kot PDF" "R250 prihodki pill aria"
need_static "PRIHODKI" "R250 prihodki PDF glava (lib v klientu)"
need_static "prazen seznam ne nastaja dokumenta" "R250 fail-closed: prazen seznam (družinsko pravilo)"
need_static "PLACAN brez placanoAt je inkonzistenca" "R250 fail-closed: statusna inkonzistenca NIKOLI tiho spregledana"
need_static "· Odprto = izdano, neplačano · Zapadlo = prek roka" "R250 legenda (JSX ohrani '·')"
need_static "Prihodki prenešeni v PDF" "R250 toast title"
need_static " €, odprto " "R250 toast agregat (template del, brez '·')"
need_static "računov prek roka" "R250 sklepna vrstica zapadlo resnica"
need_static "(izključeni iz zneskov)" "R250 sklepna vrstica iskren storno podpis"
echo "--- R249 največji razpon (klient) ---"
need_static "Največji razpon" "R249 KPI box label (string literal)"
need_static "največji razpon " "R249 sklepna vrstica najširša resnica (template del, brez '·')"
need_static " %, največji " "R249 toast agregat del (vejica po r248 lekciji — brez '·')"
need_static "prazen seznam nima največjega razpona" "R249 fail-closed: max prazne množice ne obstaja"
need_static "max prazne množice ne obstaja" "R249 fail-closed: -Infinity laž poimenovana"
need_static "· Največji razpon = najširši % med artikli" "R249 legenda najširša resnica (JSX ohrani '·')"
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
need_static "hover:-translate-y-0.5 hover:border-roksal-amber/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-roksal-amber/60 focus-visible:ring-offset-2 focus-visible:border-roksal-amber/60 dark:focus-visible:border-roksal-amber/40 dark:focus-visible:ring-roksal-amber/40 active:scale-[0.98]" "R245 notification kartica [PIN SHIFT R368 val 51: offset-2; PIN SHIFT R387 val 65: FB amber/60+dark/40]"
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
need_static "bg-roksal-amber hover:bg-roksal-amber/90 text-roksal-navy shadow-sm focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-2 press-scale" "R243 Potrdi premik CTA mikro-pritisk [PIN SHIFT R368 val 51: offset-1→2 amber pariteta]"
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
