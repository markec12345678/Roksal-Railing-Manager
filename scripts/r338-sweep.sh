#!/bin/bash
# R338 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R338: PRODUKT = zadnji zeleni deploy R336 (r336-prod-qa LIVE veja
# EXIT=0 — build 09:02:11.761Z > R336 commit meja 09:01:46 [29ad578] —
# R334+R335+R336 dev ŽIVO SKUPAJ na produ; kanon R280/R284 UNION harvest
# potrjen; NJIHOV R337 [1a3e776 — 64. člen AI raba pregled CSV] + MOJA R338
# dekompozicija dev commita čakata Vercel deploy — Vercel limit vzorec;
# naslednji zeleni deploy nosi VSE generacije R290+…+R338; sweep spot R338
# run: R337 pill anchor = iskren PENDING dokaz [NI bug]; r338-prod-qa
# pričakuje LIVE ob zelenem deployu):
#   - R318/R320/R321/R323/R324/R326/R327/R328/R329/R330/R331/R332/R333/
#     R334/R335 gumbi — pričakovano LIVE (regresija; build 07:58 nosi
#     R334+R335 dev)
#   - R336 "Sistem zdravje CSV" gumb — pričakovano LIVE (regresija; build
#     09:02 nosi R336 dev)
#   - R337 "AI raba pregled CSV" gumb — pričakovano MISS (stale produ; LIVE
#     ob deployu — EPOCH pogoj, NI bug)
#   - R338 = DEKOMPOZICIJA runda (vzorec R322/R325) — BREZ novih gumbov,
#     sweep seznam NESPREMENJEN (NJIHOVA R337 je dodala ai-raba vnos —
#     dedovina, ostaja; 31 vnosov)
#   - R338 premik-needleji = r338-build-needles (vsebina ŽIVA v čankih —
#     ne DOM gumbi)
#   DEDOVINA KOLIZIJE #7: vzporedna lastniška R325 = PRIROJENIŠKA
#     dekompozicija FAZA 2 — brez novih gumbov (ČIST premik; measurements/
#     calculator tabi ŽE v sweep listi — pokritost nespremenjena)
set -u
source /home/z/my-project/scripts/e2e-lib.sh

sweep_tab() {
  local ime="$1" detail="$2" anchor="$3"
  eb_dispatch "$detail" > /dev/null 2>&1
  sleep 3
  agent-browser eval "JSON.stringify({tab:'$ime', err:window.__err??null, anchor:!!($anchor), url:location.pathname})" 2>&1 | tail -1
}

echo "=== R338 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="
sweep_tab dashboard '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main")?.textContent?.length > 100'
sweep_tab measurements '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main")?.textContent?.length > 100'
sweep_tab kalkulator '{"tab":"calculator","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main")?.textContent?.includes("Kalkul")'
sweep_tab ar '{"tab":"ar","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab photos '{"tab":"photos","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab crm '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main")?.textContent?.includes("CRM")'
sweep_tab vodja '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("[data-testid=\"koncna-verifikacija-dokaz\"]") !== null'
sweep_tab vodja_json_gumb '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi poročilo končne verifikacije kot JSON"))'
sweep_tab vodja_audit_pdf_gumb_R318 '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi avtomatizacijski audit kot PDF"))'
sweep_tab vodja_koncna_pdf_gumb_R320 '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi poročilo končne verifikacije kot PDF"))'
sweep_tab vodja_zmoglj_pdf_gumb_R321 '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi meritve zmogljivosti kot PDF"))'
sweep_tab vodja_zmoglj_csv_gumb_R323 '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi meritve zmogljivosti kot CSV"))'
sweep_tab vodja_dnevni_pdf_gumb_R324_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi dnevni pregled vodje kot PDF"))'
sweep_tab cena_zgo_csv_gumb_R326_EPOCH '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi zgodovino cen materiala kot CSV"))'
sweep_tab cena_zgo_pdf_gumb_R327_EPOCH '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi zgodovino cen materiala kot PDF"))'
sweep_tab cena_dobavitelji_csv_gumb_R328_EPOCH '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi primerjavo dobaviteljev kot CSV"))'
sweep_tab cena_dobavitelji_pdf_gumb_R329_EPOCH '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi primerjavo dobaviteljev kot PDF"))'
sweep_tab projekti_termini_csv_gumb_R330_EPOCH '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled projektov in terminov kot CSV"))'
sweep_tab ponudbe_spomniki_csv_gumb_R331_EPOCH '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled spomnikov ponudb kot CSV"))'
sweep_tab potekli_opomniki_csv_gumb_R332_EPOCH '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi potekle opomnike kot CSV"))'
sweep_tab pozicija_dobaviteljev_csv_gumb_R333_EPOCH '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pozicijo dobaviteljev kot CSV"))'
# 🐛 R335 QA-ORODJE POPRAVEK (LEKCIJA R334 1): dispatch je bil '{"tab":"vodja",…}'
# — vodja NI top-level tab → iskren OPOMNA fallback → anchor FALSE tudi ob
# LIVE deployu; popravljen na '{"tab":"more","more":"vodja",…}' (ISTI obrazec
# kot ostale vodja vrstice zgoraj).
sweep_tab koncna_verifikacija_csv_gumb_R334_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi poročilo končne verifikacije kot CSV"))'
sweep_tab vodja_mesecni_csv_gumb_R335_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi mesečno poročilo vodje kot CSV"))'
sweep_tab sistem_zdravje_csv_gumb_R336_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi sistem zdravje kot CSV"))'
# R337 (64. člen): AI raba pregled CSV gumb — vodja dispatch; anchor = pill
# aria (EPOCH pogoj — stale produ → MISS je iskreno PENDING, NI bug)
sweep_tab ai_raba_csv_gumb_R337_EPOCH '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled AI rabe kot CSV"))'
sweep_tab cvstudio '{"tab":"more","more":"cvstudio","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab ekipa '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab logistics '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab inventory '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab teren '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab inclinometer '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
echo "=== KONEC sweep ==="
