#!/usr/bin/env bash
# r403-auth-probe.sh — R403 AUTH-probe vzorec (handover R402: "strežniški
# needleji — AUTH-probe vzorec (403 body) kot dopolnilni dokaz — odkrito R402").
#
# NAMEN: 6 PENDING strežniških needlejev iz 56. ere (r403-era-harvest.sh,
# iskren 198/204 EXIT=2) NE morejo biti razrešenih prek klient-čankov (server
# koda NIKOLI v .next/static/chunks niti na prod CDN — LEKCIJA R375 (6)) in
# |401 probe je PREPOVEDAN kot deploy-diskriminator (NJIHOVA QA ugotovitev
# R401: middleware 401-catch-all — /api/* neznane poti vračajo ISTI 401 body
# kot žive rute → false-ŽIVO). DOPOLNILNI DOKAZ = auth-razločevalen odgovor:
# prijavljen same-origin probe vrne 403 + needle BESEEDNO v telesu — to
# lahko vrne SAMO deployana ruta (njen kompilirani RBAC vratar), NE pa
# middleware catch-all (ta ne pozna sporočil rut).
#
# KANONI:
#   - ZERO-MUTACIJA: vsi probe-i so vratar-preskusni — pisanja (POST/PATCH)
#     se ZAVRNEJO na RBAC vratih PRED razčlenjevanjem telesa in PRED vsako
#     transakcijo (gate vrstni red v rutah: rate-limit → authenticate →
#     RBAC → telo → transakcija; preverjeno v izvorni kodi R403).
#   - CSRF dvojni žeton (R194): piškotek roksal_csrf je namenoma berljiv iz
#     JS (BREZ HttpOnly) → same-origin eval ga prenese v glavi x-csrf-token.
#   - prijava = spot-r165@roksal.si (MONTER — edini znani QA račun na produ;
#     vodja poverilnice so lastnikova pot, kanon R163).
#   - vzorec R402 AUTH-DOKAZ (r399 N1) — ta skripta ga posploši na vse 4 sonde.
#
# SONDE (vse pričakujejo 403 + specifično sporočilo v telesu):
#   S1 GET    /api/storage/reconcile → r399 N1 (isti čank kot N2 — inference)
#   S2 POST   /api/payments          → r402 N1 (vrata PRED telesom)
#   S3 PATCH  /api/payments/[probe]  → r402 N2 (vrata PRED telesom)
#   S4 PATCH  /api/invoices          → monter 403 iz ISTEGA invoices handlerja
#        (denyUnlessInvoice + N3 409 sta ISTA datoteka → ISTI app-route čank;
#        N3 (409) potrebuje vodja sejo + pravi račun — iskreno: isti-čank
#        sklep + lastnikova pot, NE direktna sonda)
set -u
cd /home/z/repo-analysis
source scripts/e2e-lib.sh

EB_BASE="https://roksal-railing-manager.vercel.app"
OUT="/tmp/r403-auth-probe"
mkdir -p "$OUT"

agent-browser close --all >/dev/null 2>&1
eb_odpri_in_prijavi || { echo "LOGIN FAIL"; exit 1; }

echo "=== S1: GET /api/storage/reconcile — r399 N1 (vodstvo vrata) ==="
agent-browser eval "(async()=>{const r=await fetch('/api/storage/reconcile',{credentials:'same-origin'});const t=await r.text();return JSON.stringify({status:r.status,needle1:t.includes('Spravo shrambe urejajo uporabniki z vodstveno vlogo'),izrezek:t.slice(0,140)});})()" 2>&1 | tail -1

echo "=== S2: POST /api/payments — r402 N1 (invoices.issue vrata, PRED telesom) ==="
agent-browser eval "(async()=>{const c=(document.cookie.match(/(?:^|;\\s*)roksal_csrf=([^;]+)/)||[])[1];const r=await fetch('/api/payments',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','x-csrf-token':c},body:'{}'});const t=await r.text();return JSON.stringify({status:r.status,needle1:t.includes('Beleženje plačil zahteva pravico invoices.issue.'),izrezek:t.slice(0,140)});})()" 2>&1 | tail -1

echo "=== S3: PATCH /api/payments/r403-auth-probe — r402 N2 (vrata PRED telesom/iskanjem) ==="
agent-browser eval "(async()=>{const c=(document.cookie.match(/(?:^|;\\s*)roksal_csrf=([^;]+)/)||[])[1];const r=await fetch('/api/payments/r403-auth-probe',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json','x-csrf-token':c},body:'{}'});const t=await r.text();return JSON.stringify({status:r.status,needle2:t.includes('Prekinitev plačila zahteva pravico invoices.issue.'),izrezek:t.slice(0,140)});})()" 2>&1 | tail -1

echo "=== S4: PATCH /api/invoices — isti-čank dokaz za r402 N3 (denyUnlessInvoice + 409 ista datoteka) ==="
agent-browser eval "(async()=>{const c=(document.cookie.match(/(?:^|;\\s*)roksal_csrf=([^;]+)/)||[])[1];const r=await fetch('/api/invoices',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json','x-csrf-token':c},body:JSON.stringify({id:'r403-auth-probe',status:'PLACAN'})});const t=await r.text();return JSON.stringify({status:r.status,invoicesVrata:t.includes('Računi so uradni dokumenti — potrebna je pravica invoices.issue.'),izrezek:t.slice(0,140)});})()" 2>&1 | tail -1

echo "=== S5: GET /api/payments — GET vrata (dopolnilno: ista ruta kot N1/N2) ==="
agent-browser eval "(async()=>{const r=await fetch('/api/payments',{credentials:'same-origin'});const t=await r.text();return JSON.stringify({status:r.status,izrezek:t.slice(0,140)});})()" 2>&1 | tail -1

agent-browser screenshot "$OUT/r403-auth-probe.png" >/dev/null 2>&1
agent-browser close --all >/dev/null 2>&1
echo "=== r403-auth-probe KONEC (ZERO-MUTACIJA — vsa pisanja zavrnjena na RBAC vratih) ==="
