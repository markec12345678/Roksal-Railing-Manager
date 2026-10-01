#!/bin/bash
# R332 — interaktivni agent-browser produ QA sweep (kanon R316/R317/R322).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
# 🆕 R332: PRODUKT JE R331 LIVE (r331-prod-qa LIVE veja — build 03:18:37.240Z
# > R331 dev commit eeecf2b push 03:18:18, 19 s = R331 build ŽIVO [58. člen
# Ponudbe CSV + val 18 LIVE]; r331-prod-qa POST-commit LIVE potrdil R331
# needles ×2 + UNION harvest 441 OK/0 MISS; sweep spot R332: R331 pill
# anchor TRUE — LIVE na produ potrdil; R331 worklog commit bb0b5ba deploy
# čaka — Vercel kvota/kanon UNION harvest):
#   - R318/R320/R321/R323/R324/R326/R327/R328/R329/R330/R331 gumbi —
#     pričakovano LIVE (regresija; R331 Ponudbe CSV PRISTAL — sweep +
#     prod-qa LIVE dokaz)
#   - R331 "Ponudbe CSV" gumb — pričakovano LIVE (build 03:18:37 nosi R331
#     dev vsebino — spot anchor TRUE)
#   - R332 "Potekli CSV" gumb — pričakovano MISS (stale produ; LIVE ob
#     deployu — EPOCH pogoj, NI bug)
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

echo "=== R324 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="
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
sweep_tab cvstudio '{"tab":"more","more":"cvstudio","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab ekipa '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab logistics '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab inventory '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab teren '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab inclinometer '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
echo "=== KONEC sweep ==="
