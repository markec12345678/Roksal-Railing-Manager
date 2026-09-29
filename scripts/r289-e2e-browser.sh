#!/bin/bash
# R289 E2E ŽIVO (lokalni :3100, ADMIN) — ISKREN PRESEŽEK v zvončku + PRVI
# PRAVI 2-TAB CROSS-TAB E2E (P1-c, odprt od R272+ — agent-browser TABS):
#   H:  higiena — restore r289 + r287 (idempotentno, lekcija 5) + fp-pre ×2;
#   Z0: TAB A BAZA — prijava, CRM tab, zvonček odprt: 0 opomniških vrstic +
#       presežek NIČ (pogojni kanon — iskrena praznina) + pečat 'Osveženo ob'
#       zajet (SheetDescription); Escape zapri;
#   S:  SEED 9 strank (8 POTEKEL + 1 AKTIVEN — r289-db-e2e.cjs);
#   Z1: TAB B PRIČA (agent-browser tab new — NOV zavihek, ISTA seja): zvonček
#       odprt → 6 opomniških vrstic (POTEKEL prioriteta) + 'Presežek:' note z
#       'CRM opomniki +3' (iskren presežek ŽIVO) + pečat B zajet; tab close;
#   Z2: TAB A PROPAGACIJA — fokus nazaj (tab aktivacija + R173 dispatch:
#       window focus + visibilitychange → useRefetchOnFocus) → delta /api/crm
#       = 1 (refetch ŽIVO) → zvonček: 6 vrstic + 'CRM opomniki +3' + pečat
#       SPREMENJEN (A2 ≠ A1) → CROSS-TAB PROPAGACIJA DOKAZANA;
#   Z3: R287 REGRESIJA + POGOJNI KANON ŽIVO — restore r289, seed r287 (2
#       stranki), fokus → refetch → 2 vrstici (POTEKEL red + AKTIVEN amber) +
#       presežek IZGINIL (2 ≤ 6 — note samo ko >cap; iskrena praznina v
#       obratni smeri); Escape;
#   Z4: RESTORE ×2 + fp-post ×2 == fp-pre ×2 (bajtnata identičnost —
#       ZERO-MUTACIJA).
# OPOMBA: deep-link regresija (R288 Z0y) NI ponovljena tu — kanon r288 E2E +
# r288-prod-qa (EXIT=0) jo dokazuje; ta runda se NE dotika vrstic.
# fail-fast || exit 1 (r271 lekcija 4).
set -u
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export SESSION_SECRET="${SESSION_SECRET:-r285-e2e-lokalni-sekret-vsaj-32-znakov-dolg!!}"
export PORT=3100
export EB_BASE="http://127.0.0.1:3100"
export EB_EMAIL="ci@roksal.si"
export EB_GESLO="DimniSmoke139!"

source scripts/e2e-lib.sh

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
sleep 1
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
[ -d .next/standalone/public ] || cp -r public .next/standalone/public
cp .env .next/standalone/.env
setsid node .next/standalone/server.js > /tmp/R289-server-e2e.log 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break; sleep 0.5; done

# Zvonček helperi (r287-prod-qa Z1c vzorec + [data-slot] precizni probe).
zvonek_odpri() {
  agent-browser eval "(()=>{const b=document.querySelector('button[aria-label^=\"Obvestila\"]'); if(!b) return 'BREZ-ZVONČKA'; b.click(); return 'odprto';})()" 2>&1 | tail -1
}
zvonek_desc_pocakaj() {
  eb_pocakaj_na "(()=>{return !!document.querySelector('[data-slot=\"sheet-description\"]');})()" 16
}
opomnik_vrstice() {
  agent-browser eval "JSON.stringify([...document.querySelectorAll('button')].filter(x=>(x.getAttribute('aria-label')||'').includes('— odpre CRM (opomnik)')).length)" 2>&1 | tail -1
}
presezek_note() {
  agent-browser eval "JSON.stringify((()=>{const n=document.querySelector('div[role=\"note\"]'); return n?n.textContent:null;})())" 2>&1 | tail -1
}
zvonek_pecat() {
  agent-browser eval "JSON.stringify((()=>{const d=document.querySelector('[data-slot=\"sheet-description\"]'); if(!d) return null; const m=(d.textContent||'').match(/Osveženo ob (\\d\\d:\\d\\d:\\d\\d)/); return m?m[1]:null;})())" 2>&1 | tail -1
}
crm_fetch_stetje() {
  agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name).filter(u=>u.includes('/api/crm')).length)" 2>&1 | tail -1
}
fokus_dispatch() {
  agent-browser eval "(()=>{window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); return 'dispatchano';})()" 2>&1 | tail -1
}
zvonek_zapri() {
  agent-browser eval "(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return 'esc';})()" 2>&1 | tail -1
  eb_cakaj 2
}

echo "--- H: higiena — RESTORE pred fp-pre (lekcija 5 — idempotentno) ---"
node scripts/r289-db-e2e.cjs restore || exit 1
node scripts/r287-db-e2e.cjs restore || exit 1

echo "--- PRSTNI ODTIS PRE (Customer e2e-r289% + e2e-r287%) ---"
node scripts/r289-db-e2e.cjs fp > /tmp/r289-fp-pre.json || exit 1
node scripts/r287-db-e2e.cjs fp > /tmp/r289-fp-pre-287.json || exit 1
cat /tmp/r289-fp-pre.json /tmp/r289-fp-pre-287.json

echo "--- Z0: TAB A BAZA — prijava + CRM + zvonček (0 opomnikov, brez presežka) ---"
eb_odpri_in_prijavi || { echo "LOGIN FAIL — abort"; agent-browser close --all > /dev/null 2>&1; kill -9 $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u) 2>/dev/null; exit 1; }
eb_zapri_vodic
eb_dispatch '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
eb_cakaj 3
zvonek_odpri
zvonek_desc_pocakaj || { echo "Z0: SheetDescription NI prisoten — abort"; exit 1; }
eb_cakaj 2
Z0_STEV=[$(opomnik_vrstice)]
echo "  Z0 opomniške vrstice: $Z0_STEV"
[ "$(opomnik_vrstice | tr -d '"')" = "0" ] || { echo "Z0 FAIL: pričakovano 0 opomniških vrstic na čistem portfelju — abort"; exit 1; }
Z0_NOTE=$(presezek_note | tr -d '"')
echo "  Z0 presežek note: $Z0_NOTE"
[ "$Z0_NOTE" = "null" ] || { echo "Z0 FAIL: presežek note prisotna na praznem portfelju (kršitev pogojnega kanona) — abort"; exit 1; }
Z0_PECAAT=$(zvonek_pecat | tr -d '"\\')
echo "  Z0 pečat A1: $Z0_PECAAT"
[[ "$Z0_PECAAT" =~ ^[0-9]{2}:[0-9]{2}:[0-9]{2}$ ]] || { echo "Z0 FAIL: pečat NI zajet ($Z0_PECAAT) — abort"; exit 1; }
zvonek_zapri
# R289 — bazni števec /api/crm klicev TAB A (Z2 primerjava: TAB A je v Z1
# HIDDEN — odločitev false, brez fetcha; refetch se sproži ŠELE ob vračanju
# v ospredje).
A1_FETCHI=$(crm_fetch_stetje | tr -d '"')
echo "  Z0 /api/crm bazni števec: $A1_FETCHI"

echo "--- S: SEED 9 strank (8 POTEKEL + 1 AKTIVEN) ---"
node scripts/r289-db-e2e.cjs seed-presezek || exit 1

echo "--- Z1: TAB B PRIČA (agent-browser tab new — PRAVI drugi zavihek) ---"
agent-browser tab new > /dev/null 2>&1 || { echo "TAB NEW FAIL — abort"; exit 1; }
eb_cakaj 1
agent-browser open "$EB_BASE/" > /dev/null 2>&1
eb_pocakaj_na "(()=>{return !!document.querySelector('button[aria-label^=\"Obvestila\"]');})()" 24 || { echo "Z1: app lupina NI naložena v TAB B — abort"; exit 1; }
zvonek_odpri
zvonek_desc_pocakaj || { echo "Z1: SheetDescription NI prisoten v TAB B — abort"; exit 1; }
eb_cakaj 2
Z1_STEV=$(opomnik_vrstice | tr -d '"')
echo "  Z1 opomniške vrstice: $Z1_STEV (pričakovano 6)"
[ "$Z1_STEV" = "6" ] || { echo "Z1 FAIL: pričakovano 6 vrstic (cap), dobljeno $Z1_STEV — abort"; exit 1; }
Z1_NOTE=$(presezek_note | tr -d '"\\')
echo "  Z1 presežek note: $Z1_NOTE"
[[ "$Z1_NOTE" == *'Presežek:'* ]] || { echo "Z1: glava Presežek NI v note — abort"; exit 1; }
[[ "$Z1_NOTE" == *'CRM opomniki +3'* ]] || { echo "Z1: presežek NI 3 — abort"; exit 1; }
echo "Z1 OK — note ŽIVO: Presežek + CRM opomniki +3 (TAB B — mount fetch)"
agent-browser tab close > /dev/null 2>&1 || { echo "TAB CLOSE FAIL — abort"; exit 1; }
eb_cakaj 2

echo "--- Z2: TAB A PROPAGACIJA — AKTIVACIJA (tab t1) → realni visibilitychange/focus → refetch ---"
# Eksplicitna AKTIVACIJA zavihka (tab <id> = bring-to-front) — REALNI dogodki
# (visibilitychange + focus) gredo skozi useRefetchOnFocus (R170/R173/R182
# družina — vse površine). Synthetic dispatch = SAMO rezerva (R173 precedens).
agent-browser tab t1 > /dev/null 2>&1 || { echo "Z2: AKTIVACIJA t1 FAIL — abort"; exit 1; }
eb_cakaj 3
POST=$(crm_fetch_stetje | tr -d '"')
if [ "$((POST-A1_FETCHI))" -lt 1 ]; then
  # Rezerva: len vidnostni prehod — dispatch ponovi do delta>=1 (rate-limit
  # FOKUS_MIN_INTERVAL_MS blokira dvoje; neškodljivo).
  for i in 1 2 3 4; do
    fokus_dispatch > /dev/null
    eb_cakaj 3
    POST=$(crm_fetch_stetje | tr -d '"')
    [ "$((POST-A1_FETCHI))" -ge 1 ] && break
  done
fi
echo "  /api/crm klici: pre=$A1_FETCHI post=$POST (delta $((POST-A1_FETCHI)))"
[ "$((POST-A1_FETCHI))" -ge 1 ] || { echo "Z2 FAIL: refetch-on-focus NI sprožen (delta $((POST-A1_FETCHI)) < 1) — abort"; exit 1; }
zvonek_odpri
zvonek_desc_pocakaj || { echo "Z2: SheetDescription NI prisoten — abort"; exit 1; }
eb_cakaj 2
Z2_STEV=$(opomnik_vrstice | tr -d '"')
echo "  Z2 opomniške vrstice: $Z2_STEV (pričakovano 6)"
[ "$Z2_STEV" = "6" ] || { echo "Z2 FAIL: pričakovano 6 vrstic, dobljeno $Z2_STEV — abort"; exit 1; }
Z2_NOTE=$(presezek_note | tr -d '"\\')
echo "  Z2 presežek note: $Z2_NOTE"
[[ "$Z2_NOTE" == *'CRM opomniki +3'* ]] || { echo "Z2 NOTE FAIL: presežek NI 3 po propagaciji — abort"; exit 1; }
echo "Z2 OK — presežek +3 ŽIVO v TAB A (cross-tab propagacija prek refetch-on-focus)"
Z2_PECAAT=$(zvonek_pecat | tr -d '"\\')
echo "  Z2 pečat A2: $Z2_PECAAT (A1=$Z0_PECAAT)"
[ "$Z2_PECAAT" != "$Z0_PECAAT" ] || { echo "Z2 FAIL: pečat NI spremenjen (A2 == A1) — abort"; exit 1; }

echo "--- Z3: R287 REGRESIJA + POGOJNI KANON — 2 opomnika → presežek IZGINIL ---"
node scripts/r289-db-e2e.cjs restore || exit 1
node scripts/r287-db-e2e.cjs seed-opomniki || exit 1
# Rate-limit FOKUS_MIN_INTERVAL_MS = 30 s (Z2 refetch je pravkar sprožen) —
# izrecno počakaj okno (determinizem; sicer je dispatch brezploden).
sleep 32
fokus_dispatch
eb_cakaj 4
Z3_STEV=$(opomnik_vrstice | tr -d '"')
echo "  Z3 opomniške vrstice: $Z3_STEV (pričakovano 2)"
[ "$Z3_STEV" = "2" ] || { echo "Z3 FAIL: pričakovano 2 vrstici (r287 seed), dobljeno $Z3_STEV — abort"; exit 1; }
Z3_NOTE=$(presezek_note | tr -d '"')
echo "  Z3 presežek note: $Z3_NOTE"
[ "$Z3_NOTE" = "null" ] || { echo "Z3 FAIL: note ostaja ko podatki ne presegajo cap (kršitev pogojnega kanona) — abort"; exit 1; }
zvonek_zapri

echo "--- Z4: RESTORE ×2 + fp-post == fp-pre (ZERO-MUTACIJA) ---"
node scripts/r289-db-e2e.cjs restore || exit 1
node scripts/r287-db-e2e.cjs restore || exit 1
node scripts/r289-db-e2e.cjs fp > /tmp/r289-fp-post.json || exit 1
node scripts/r287-db-e2e.cjs fp > /tmp/r289-fp-post-287.json || exit 1
cmp -s /tmp/r289-fp-pre.json /tmp/r289-fp-post.json || { echo "FP FAIL r289 — abort"; diff /tmp/r289-fp-pre.json /tmp/r289-fp-post.json; exit 1; }
cmp -s /tmp/r289-fp-pre-287.json /tmp/r289-fp-post-287.json || { echo "FP FAIL r287 — abort"; diff /tmp/r289-fp-pre-287.json /tmp/r289-fp-post-287.json; exit 1; }
echo "ODTIS BAJTNATO IDENTIČEN (r289 + r287) — ZERO-MUTACIJA dokazana"

echo "=== ČISTI TEK: kill :3100 + close browser ==="
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do kill -9 "$pid" 2>/dev/null; done
agent-browser close --all > /dev/null 2>&1
echo "=== R289 E2E ŽIVO — EXIT=0 (PRESEŽEK ŽIVO + 2-TAB CROSS-TAB DOKAZAN + R287 REGRESIJA + ZERO-MUTACIJA) ==="
