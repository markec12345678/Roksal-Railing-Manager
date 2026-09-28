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
