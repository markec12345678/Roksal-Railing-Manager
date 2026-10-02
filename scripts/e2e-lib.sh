#!/bin/bash
# e2e-lib.sh — R231 (P1-g) — SKUPNA E2E knjižnica: prijava → dispatch → zapri
# vodič (ponavlja se v vsakem E2E skripti od r218). Viri: r230/r231 vzorci +
# lekcije r199/r200 (Radix pointer sekvence), r225/r227 (IIFE predikati),
# r230 lekcija št. 1 (prijava NE pristane na Domovu — ekspliciten dispatch).
#
# UPORABA (v E2E skripti):
#   EB_BASE="${EB_BASE:-http://localhost:3100}" EB_EMAIL=... EB_GESLO=... \
#     source /home/z/my-project/scripts/e2e-lib.sh
#   eb_odpri_in_prijavi || { echo "LOGIN FAIL"; exit 1; }
#   eb_zapri_vodic
#   eb_dispatch '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
#   eb_pocakaj_na "(()=>{return !!document.querySelector('…');})()" 24
#
# LEKCIJE, KI JIH TA KNJIŽNICA ZAPRE (drugačne rabe NISO dovoljene):
#  1. Predikat je VEDNO IIFE — klicatelj poda niz z `})()"` zaključkom
#     (r225/r227 drift lekcija: predikat brez klica vrne funkcijo = '{}' in
#     pocakaj Na UNIKAJ čaka do timeouta).
#  2. Prijava marker: gumb 'Odpri iskalnik' (app-lupina); po prijavi je
#     potrebno eksplicitno navigirati, ker prijava NE pristane na Domovu
#     (r230 lekcija št. 1).
#  3. Uvodni vodič zapiramo ×3 (radix animacije — en klik ni zanesljiv).
#  4. eval izhodi so JSON-kodirani — parser: python3 (r229 lekcija), ne tr/sed.

# Pogoj za nadaljnje čakanje na eval predikat (true → najdeno).
eb_pocakaj_na() {
  local pred="$1" maks="${2:-10}" R
  for i in $(seq 1 "$maks"); do
    R=$(agent-browser eval "$pred" 2>&1 | tail -1)
    if [ "$R" = "true" ]; then echo "  najdeno (poskus $i)"; return 0; fi
    sleep 1.5
  done
  echo "  NI NAJDENO (zadnji: $R)"; return 1
}

# Dispatch navigacije (roksal:navigate — ISTI protokol kot ostali E2E).
eb_dispatch() {
  local detail="$1"
  agent-browser eval "(()=>{window.dispatchEvent(new CustomEvent('roksal:navigate',{detail:$detail})); return 'nav';})()" 2>&1 | tail -1
}

# Zapri uvodni vodič (×3 — radix animacije; en klik ni zanesljiv).
eb_zapri_vodic() {
  local i
  for i in 1 2 3; do
    agent-browser eval "(()=>{const z=document.querySelector('button[aria-label=\"Zapri uvodni vodič\"]'); if(z){z.click(); return 'zaprt';} return 'ni';})()" > /dev/null 2>&1
    sleep 2
  done
}

# Odpri bazo + prijava (privzeto spot seja; LOCAL E2E lahko prekliče z
# EB_EMAIL/EB_GESLO). Vrne 0 ob uspehu (marker: 'Odpri iskalnik').
eb_odpri_in_prijavi() {
  local base="${EB_BASE:-https://roksal-railing-manager.vercel.app}"
  local email="${EB_EMAIL:-spot-r165@roksal.si}"
  local geslo="${EB_GESLO:-SpotR165Qa!Pass}"
  agent-browser close --all > /dev/null 2>&1 || true
  sleep 1
  agent-browser open "$base/login" > /dev/null 2>&1
  agent-browser wait 'input[type="email"]' > /dev/null 2>&1
  sleep 2
  agent-browser fill 'input[type="email"]' "$email" > /dev/null 2>&1
  agent-browser fill 'input[type="password"]' "$geslo" > /dev/null 2>&1
  agent-browser click 'button[type="submit"]' > /dev/null 2>&1
  local i R
  for i in $(seq 1 20); do
    R=$(agent-browser eval "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').includes('Odpri iskalnik'));})()" 2>&1 | tail -1)
    if [ "$R" = "true" ]; then echo "  prijava OK (poskus $i)"; sleep 2; return 0; fi
    sleep 3
  done
  echo "  prijava NI uspela"; return 1
}

# Uspavanje z obrazložitvijo (readability dolgih skript).
eb_cakaj() { local sek="$1"; sleep "$sek"; }

# R232 (P1-d) — zajem CSV izvoza: patcha URL.createObjectURL, da vsebino
# Bloba shrani v globalno spremenljivko `window.__<varname>` (vzorec se
# ponavlja od r226 — zdaj zaprt v knjižnici). UPORABA:
#   eb_csv_capture csv          # patch; kasneje: window.__csv
#   eb_klik ...                 # klik na izvozni gumb
#   eb_pocakaj_na "(()=>{return typeof window.__csv==='string';})()" 10
eb_csv_capture() {
  local varname="$1"
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ new Response(b).text().then(t=>{window.__$varname=t;}); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
}

# R232 (P1-d) — reset zajetega CSV (pred klikom: __<varname>=null).
eb_csv_reset() {
  local varname="$1"
  agent-browser eval "(()=>{window.__$varname=null; return 'reset';})()" 2>&1 | tail -1
}

# R233 (P1-d) — klik gumba po aria-label (ponavlja se od r226; JS .click()
# deluje za controlled onClick gumbe — za Radix DropdownMenu triggerje rabiš
# pointer sekvence r199/r200, ZA TE gumba ta helper NI namenjen).
eb_klik_gumb() {
  local aria="$1"
  agent-browser eval "(()=>{const g=document.querySelector('button[aria-label=\"$aria\"]'); if(!g) return 'ni gumba'; g.click(); return 'klik';})()" 2>&1 | tail -1
}

# R234 (P1-d) — čakanje na besedilo v body (body.textContent.includes se
# ponavlja v E2E od r228 — zdaj zaprto v knjižnici). IIFE pogodba OHRANJENA:
# helper SAM ovije tekst v IIFE predikat (r225/r227 lekcija ZAPRTA — klicatelj
# ne more zgraditi predikata brez klica). OMEJITEV: tekst ne sme vsebovati
# enojnega narekovaja (bash → eval escape chaining — r229 lekcija št. 5).
eb_pocakaj_tekst() {
  local tekst="$1" maks="${2:-10}"
  eb_pocakaj_na "(()=>{return document.body.textContent.includes('$tekst');})()" "$maks"
}

# R235 (P1-d) — zajem PDF izvoza na BAJTNI ravni: patcha URL.createObjectURL,
# blob prebere arrayBuffer → Uint8Array → base64 v window.__<varname>.
# RAZLIKA proti eb_csv_capture (Response.text() — zadosten za tekstovne CSV,
# IZGUBLJA/pokvari bajte za BINARNE datoteke): ta helper zajame byte-exact
# (E2E potem dekodira atob() → %PDF magija [37,80,68,70,45] + dolžina).
# Uporaba:  eb_zajem_pdf pdf   → kasneje window.__pdf (base64 niz)
eb_zajem_pdf() {
  local varname="$1"
  agent-browser eval "(()=>{const orig=URL.createObjectURL.bind(URL); URL.createObjectURL=function(b){ b.arrayBuffer().then(buf=>{ const u=new Uint8Array(buf); let s=''; const K=8192; for(let i=0;i<u.length;i+=K){ s+=String.fromCharCode.apply(null,u.subarray(i,Math.min(i+K,u.length))); } window.__$varname=btoa(s); }); return orig(b); }; return 'patched';})()" 2>&1 | tail -1
}

# R361 (e2e-lib dedup 1. val) — kolektor konzolnih napak: window.onerror +
# unhandledrejection → window.__<varname>[]. Identičen inline blok se
# ponavljal v r358/r359/r360 spot skriptah (3. klic = prag LEKCIJA R352 →
# EN VIR kanon). ⚠ KLICATI ŠELE PO prijavi (LEKCIJA R358: eb_odpri_in_prijavi
# svoj open /login WIPE-a kontekst — kolektor pred prijavo ne preživi).
# Uporaba:  eb_kolektor_napak r361err   → kasneje window.__r361err
eb_kolektor_napak() {
  local varname="$1"
  agent-browser eval "(()=>{window.__$varname=[];window.addEventListener('error',e=>window.__$varname.push(String(e.message||e)));window.addEventListener('unhandledrejection',e=>window.__$varname.push('rej:'+String(e.reason)));return 'kolektor';})()" 2>&1 | tail -1
}

# R361 (e2e-lib dedup 1. val) — branje kolektorja: JSON.stringify({napake,
# stevilo}) iz window.__<varname>. IDENTIČEN reader blok se ponavljal v
# r358/r359/r360. Vrne eval izpis — klicatelj sam interpretira (fail-open:
# prazen izpis = kolektor ni bil nameščen, NE tiha '0 napak' resnica).
# IIFE ovojnica OBVEZNA (r231 invariant + LEKCIJA r225/r227: vsak eval v
# knjižnici je klican IIFE — drugačne rabe NISO dovoljene).
eb_preberi_kolektor() {
  local varname="$1"
  agent-browser eval "(()=>{return JSON.stringify({napake:window.__$varname, stevilo:(window.__$varname||[]).length});})()" 2>&1 | tail -1
}

# R362 (e2e-lib dedup 2. val) — OŽKA ring-paritetna sonda: šteje gumbe
# press-scale + status-filter družine z/z brez focus-visible:ring-offset-2
# (navy/40 žeton). Identičen counting blok se ponavljal v r361-qa-spot2.sh
# (C2) in r362-qa-spot.sh (C) — 2. ponovitev → kanon ustvarjen PROAKTIVNO
# (prag LEKCIJE R352 je 3. ponovitev), s PORABO ob 1. uporabi v
# r362-qa-spot3.sh v ISTI rundi (LEKCIJA R361: kanon, ki se ne porabi, je
# le papir). OŽKI obseg = filtriranje po className žetonih, NE štetje celega
# dokumenta brez filtra (LEKCIJA R361: DOM probe obseg = VES dokument).
# IIFE ovojnica OBVEZNA (r231 invariant). Vrne eval izpis JSON — klicatelj
# sam interpretira (fail-open: prazen izpis = sonda ni tekla, NE tiha '0'
# resnica).
eb_sonda_ring_pariteta() {
  agent-browser eval "(()=>{return JSON.stringify({pressScaleOffset2:[...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length,pressScaleBrezOffset:[...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length,statusFilterOffset2:[...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('text-[11px]')&&!(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')&&(b.className||'').includes('ring-offset-2')).length});})()" 2>&1 | tail -1
}

# R363 (e2e-lib dedup 3. val) — poll do CRM izvoznih pillov: identičen
# predikat `[...querySelectorAll('button')].some(aria-label startsWith
# 'Izvozi CSV (')` se je ponavljal ×7 v 5 spot skriptah (r361-qa-spot ×2,
# r361-qa-spot2 ×1, r362-qa-spot ×2, r362-qa-spot2 ×1, r362-qa-spot3 ×1) —
# prag LEKCIJE R352 (3. ponovitev) DOLG presežen → EN VIR. Helper + poraba
# ob 1. uporabi v r363-qa-spot.sh V ISTI rundi (LEKCIJA R362 (3): kanon ne
# sme biti papir); zamrznjeni spot skripti NI mutirani. Uporaba:
#   eb_pocakaj_csv_pilli 15
eb_pocakaj_csv_pilli() {
  local maks="${1:-15}"
  eb_pocakaj_na "(()=>{return [...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')||'').startsWith('Izvozi CSV ('));})()" "$maks"
}

# R364 (e2e-lib dedup 4. val) — poll do inventory površine (h2 'Zaloga'):
# identičen predikat ×2 (r363-qa-spot B, r364-qa-spot B — byte-identičen
# `...querySelectorAll('h2')].some(h=>h.textContent.trim()==='Zaloga')...`)
# + ×1 semantično enakovreden brat z O-R razširitvijo (r362-qa-spot2 D2:
# h2 ALI 'Dodaj gibanje zaloge' gumb — deli isti h2 segment). Kanon
# PROAKTIVNO pri 2. ponovitvi (LEKCIJA R362 (3): prag R352 je 3., a helper
# + 1. uporaba skupaj je čistejša kot čakati; obrat 'papir' lekcije).
# Kanonizirana OBLIKA = preprosta h2 oblika (×2 byte-identični); različica
# z O-R je dokumentirana kot bližnji izstrelek, NE kanon. Zamrznjeni spot
# skripti NI mutirani (kanon R361–R363); poraba ob 1. uporabi v
# r364-qa-spot.sh V ISTI rundi. Uporaba:
#   eb_pocakaj_zalogo 15
eb_pocakaj_zalogo() {
  local maks="${1:-15}"
  eb_pocakaj_na "(()=>{return [...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='Zaloga');})()" "$maks"
}

# R366 (e2e-lib dedup 6. val) — Meritve PRALZNINA/GA poll: predikat
# "Ni projektov ALI tabela>0" byte-identičen v ŠTIRIH zamrznjenih spot
# skriptah (r360-qa-spot2 L19 + r361-qa-spot + r362-qa-spot [maks 12] +
# r365-qa-spot L29 [maks 15]) — prag LEKCIJE R352 (×3) DOLG presežen;
# r366-qa-spot D = 5. ponovitev (ISTI predikat, maks 15). Kanonizirana
# OBLIKA = preprosten predikat SAMO (dispatch ostane ločena kanona
# eb_dispatch — kompozicija klicateljeva; ISTI vzorec kot
# eb_pocakaj_zalogo/eb_pocakaj_csv_pilli); zamrznjeni spot skripti NI
# mutirani (kanon R361–R365); poraba ob 1. uporabi v r366-qa-spot.sh V
# ISTI rundi (LEKCIJA R362 (3): kanon ne sme biti papir). Uporaba:
#   eb_pocakaj_meritve 15
eb_pocakaj_meritve() {
  local maks="${1:-15}"
  eb_pocakaj_na "(()=>{return document.body.textContent.includes('Ni projektov') || document.querySelectorAll('table').length > 0;})()" "$maks"
}

# R365 (e2e-lib dedup 5. val) — inventory SONDA (val 46 paritetna resnica):
# byte-identičen eval blok (md5 d3da517025ad391c3646b0cc572a0045 — 9 polj:
# h2Zaloga + 3 izvozna offseta + dodajGibanje offset/mounted + izvoziCsv
# mounted + sonnaPressScale + sonnaBrezOffset) se je ponovil ×2
# (r363-qa-spot B, r364-qa-spot B); r365-qa-spot B = ×3 ponovitev — prag
# LEKCIJE R352 natanko ob 3. → EN VIR. Kanonizirana OBLIKA = eval JSON
# sonda SAMO (dispatch + poll sta že ločena kanona eb_dispatch/
# eb_pocakaj_zalogo — kompozicija ostane klicateljeva); V REPu je zapisana
# kot ENOVRSTIČNI IIFE eval (r231 invariant — vsaka eval vrstica brez $pred
# nosi `})()"`; ISTI vzorec kot eb_sonda_ring_pariteta) — semantika polj
# byte-navrzkostna z inline blokoma. Zamrznjeni spot skripti NI mutirani
# (kanon R361–R364); poraba ob 1. uporabi v r365-qa-spot.sh V ISTI rundi
# (LEKCIJA R362 (3): kanon ne sme biti papir). Fail-open: prazen izpis =
# sonda ni tekla, NE tiha '0' resnica. Uporaba:
#   eb_sonda_zaloge
eb_sonda_zaloge() {
  agent-browser eval "(()=>{return JSON.stringify({h2Zaloga:[...document.querySelectorAll('h2')].some(h=>h.textContent.trim()==='Zaloga'),izvoziCsvOffset2:(document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot CSV\"]')?.className||'').includes('ring-offset-2'),izvoziPdfOffset2:(document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot PDF\"]')?.className||'').includes('ring-offset-2'),kopirajNarocilnicoOffset2:(document.querySelector('button[aria-label=\"Kopiraj naročilnico vidnih artiklov pod minimalno zalogo\"]')?.className||'').includes('ring-offset-2'),dodajGibanjeOffset2:(document.querySelector('button[aria-label=\"Dodaj gibanje zaloge\"]')?.className||'').includes('ring-offset-2'),dodajGibanjeMounted:!!document.querySelector('button[aria-label=\"Dodaj gibanje zaloge\"]'),izvoziCsvMounted:!!document.querySelector('button[aria-label=\"Izvozi vidno zalogo kot CSV\"]'),sonnaPressScale:[...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')).length,sonnaBrezOffset:[...document.querySelectorAll('button')].filter(b=>(b.className||'').includes('press-scale')&&(b.className||'').includes('ring-roksal-navy/40')&&!(b.className||'').includes('ring-offset')).length});})()" 2>&1 | tail -1
}



# R367 (e2e-lib dedup 7. val) — Meritve statusChipi SONDA (val 47/49
# stabilnost): 2-poljna sonda (statusChipi + statusChipiOffset2, aria
# 'Filtriraj po statusu' startsWith) byte-identična ×2 v zamrznjenih spot
# skriptah (r365-qa-spot D polji 11–12, r366-qa-spot D polja 2–3) —
# PROAKTIVEN kanon pri 2. ponovitvi (LEKCIJA R362 (3): prag R352 je ×3, a
# helper + 1. uporaba skupaj je čistejša — obrat 'papir' lekcije; precedens
# eb_sonda_ring_pariteta R362 in eb_pocakaj_zalogo R364). Kanonizirana
# OBLIKA = samostojen 2-poljni JSON eval (polji sta v inline blokih
# vgrajeni v večje JSON-e — semantika polj byte-navzkostna, ISTI vzorec
# kot eb_sonda_zaloge R365); dispatch + poll ostanejo ločena kanona
# (kompozicija klicateljeva); V REPu ENOVRSTIČNI IIFE eval — r231
# invariant; zamrznjeni spot skripti NI mutirani (kanon R361–R366);
# poraba ob 1. uporabi v r367-qa-spot.sh D V ISTI rundi. Fail-open: prazen
# izpis = sonda ni tekla, NE tiha '0' resnica. Uporaba:
#   eb_sonda_status_chipi
eb_sonda_status_chipi() {
  agent-browser eval "(()=>{return JSON.stringify({statusChipi:[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Filtriraj po statusu')).length,statusChipiOffset2:[...document.querySelectorAll('button')].filter(b=>(b.getAttribute('aria-label')||'').startsWith('Filtriraj po statusu')&&(b.className||'').includes('ring-offset-2')).length});})()" 2>&1 | tail -1
}
