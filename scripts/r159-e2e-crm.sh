#!/bin/bash
# R159 — atomski E2E: strežnik + prijava + navigacija (Več → CRM) + preverba
# "Izvozi CSV" gumba. VSE v enem klicu (nauček R157: strežnik NE preživi
# med bash klici; R159: tudi "Application error" je lahko artefakt mrtvega
# strežnika, ne bug kode — zato okno napak lovimo z window.__err).
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r159-atomic-server.log 2>&1 < /dev/null &
SERVER_PID=$!
sleep 5

echo "--- health ---"
curl -s -m 3 http://127.0.0.1:3100/api/auth/demo
echo

echo "--- browser flow (vsi koraki v TEM klicu) ---"
agent-browser open http://127.0.0.1:3100/login >/dev/null 2>&1
agent-browser eval 'window.addEventListener("error", e => { window.__err = e.message }); window.addEventListener("unhandledrejection", e => { window.__err = "REJ: " + (e.reason && e.reason.message || String(e.reason)) }); "ok"' >/dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' >/dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' >/dev/null 2>&1
agent-browser click 'button[type="submit"]' >/dev/null 2>&1
sleep 4
agent-browser eval '(() => { const b=[...document.querySelectorAll("button")].find(x=>(x.getAttribute("aria-label")||"").includes("Montažna orodja")); if(!b) return "NAV-MISSING"; b.click(); return "nav-ok" })()'
sleep 3
agent-browser eval '(() => { const v=[...document.querySelectorAll("button")].find(x=>(x.getAttribute("aria-label")||"")==="Več"); if(!v) return "VEC-MISSING"; v.click(); return "vec-ok" })()'
sleep 2
agent-browser eval '(() => { const c=[...document.querySelectorAll("button")].find(x=>(x.textContent||"").indexOf("CRM stranke")===0); if(!c) return "CRM-TILE-MISSING"; c.click(); return "crm-ok" })()'
sleep 4
echo "--- rezultat ---"
agent-browser eval '(() => { const crashed = document.body.textContent.includes("Application error"); const exp=[...document.querySelectorAll("button")].find(x=>(x.getAttribute("aria-label")||"").indexOf("Izvozi CSV")===0); return JSON.stringify({ crashed, err: window.__err || null, exportButton: exp ? { aria: exp.getAttribute("aria-label"), disabled: exp.disabled, title: exp.getAttribute("title") } : null }) })()'

echo "--- higiena ---"
kill -9 "$SERVER_PID" 2>/dev/null
for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
if ss -tln 2>/dev/null | grep -q ':3100'; then echo "WARNING: port 3100 busy"; else echo "port 3100 free"; fi
