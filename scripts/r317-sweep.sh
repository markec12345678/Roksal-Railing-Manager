#!/bin/bash
# R317 — interaktivni agent-browser produ QA sweep (domača runda, canoni R316).
# Za vsak tab: eb_dispatch → čakaj → eval {err, dom-anchor}. Izhod: poročilo.
# ZERO-MUTACIJA: samo GET dispeči + DOM branje; nič klikov na mutacijske gumbe.
set -u
source /home/z/my-project/scripts/e2e-lib.sh

sweep_tab() {
  local ime="$1" detail="$2" anchor="$3"
  eb_dispatch "$detail" > /dev/null 2>&1
  sleep 3
  agent-browser eval "JSON.stringify({tab:'$ime', err:window.__err??null, anchor:!!($anchor), url:location.pathname})" 2>&1 | tail -1
}

echo "=== R317 produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="
sweep_tab dashboard '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main")?.textContent?.length > 100'
sweep_tab measurements '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main")?.textContent?.length > 100'
sweep_tab kalkulator '{"tab":"calculator","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main")?.textContent?.includes("Kalkul")'
sweep_tab ar '{"tab":"ar","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab photos '{"tab":"photos","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab crm '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main")?.textContent?.includes("CRM")'
sweep_tab vodja '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("[data-testid=\"koncna-verifikacija-dokaz\"]") !== null'
sweep_tab vodja_json_gumb '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}' '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi poročilo končne verifikacije kot JSON"))'
sweep_tab cvstudio '{"tab":"more","more":"cvstudio","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab ekipa '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab logistics '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab inventory '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab teren '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
sweep_tab inclinometer '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}' 'document.querySelector("main") !== null'
echo "=== KONEC sweep ==="
