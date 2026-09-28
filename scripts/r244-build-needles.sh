#!/bin/bash
# R244 — build needleji: (1) cenik materiala izvoz (CSV + PDF pilli, fail-closed
# toasti, filename) + (2) P1-i wave 6 RBAC ogledalo na Logistiki (termini +
# oprema: production.manage, 4 vlogo-osveščeni vodiči, 8 obrambni ANDi) +
# (3) stil: press-scale pariteta (Nov termin/Nova oprema CTA + cenik pilli +
# 'Nov projekt' hero + ekipa ×3) + accent-[#1d2b3e] → accent-roksal-navy
# žeton migracija (must-miss) + regresije R223–R243 (vse r243 pini).
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

echo "--- R244 cenik izvoz (CSV + PDF, klient) ---"
need_static "Izvozi cenik materiala kot CSV" "R244 cenik CSV pill aria"
need_static "Izvozi cenik materiala kot PDF" "R244 cenik PDF pill aria"
need_static "Cenik-materiala-" "R244 cenik filename prefix (CSV+PDF)"
need_static "Ni vpisanih cen za izvoz" "R244 cenik fail-closed toast (0 cen)"
need_static "Odgovora /api/material-prices ni mogoče prebrati" "R244 cenik fail-verbose oblika"
need_static "CENIK MATERIALA" "R244 cenik PDF glava (lib v klientu)"
need_static "samo trenutno veljavne cene" "R244 cenik PDF iskren podpis"
echo "--- R244 wave 6 (Logistika RBAC ogledalo, klient) ---"
need_static "Ustvarjanje terminov zahteva pravico" "R244 vodič terminov aria (role=note)"
need_static "Pregled terminov je samo za branje. Ustvarjanje terminov in" "R244 vodič terminov besedilo"
need_static "Upravljanje opreme zahteva pravico" "R244 vodič opreme aria (role=note)"
need_static "Pregled opreme je samo za branje. Dodajanje opreme in statusni" "R244 vodič opreme besedilo"
need_static "Beleženje dogodkov zahteva pravico" "R244 vodič dogodkov aria (role=note)"
need_static "production.manage" "R244 ime pravice v klientu (4 vodiči)"
echo "--- R244 stil (press-scale pariteta + accent žeton migracija) ---"
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
echo "--- R243 stil (press-scale pariteta primarnih CTA v dialogih) ---"
need_static "bg-roksal-amber hover:bg-roksal-amber/90 text-roksal-navy shadow-sm focus-visible:ring-2 focus-visible:ring-roksal-amber/50 focus-visible:ring-offset-1 press-scale" "R243 Potrdi premik CTA mikro-pritisk"
need_static "w-full bg-roksal-navy text-white press-scale" "R243 dialog Shrani/Shrani ceno mikro-pritisk"
echo "--- R242 regresije (RBAC ogledalo Naročil + press-scale) ---"
need_static "Pregled naročil je samo za branje" "R242 vlogo-osveščen vodič (samoBranjeNarocil)"
need_static "procurement.approve" "R242 ime pravice 1 v klientu"
need_static "procurement.receive" "R242 ime pravice 2 v klientu"
need_static "Naročila so za branje — upravljanje zahteva pravice" "R242 vodič aria-label (role=note)"
need "Sprememba naročil je pravica vodstva" "R242 API 403 razlog (server bundle)"
need_static "h-8 text-xs press-scale" "R242 izvozne pilule mikro-pritisk"
need_static "h-6 gap-1 text-2xs press-scale" "R242 dobavitelji PDF pilula mikro-pritisk"
echo "--- R241/R240 regresije (RBAC ogledalo Računov + Moja vloga) ---"
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
