#!/bin/bash
# R193 E2E ŽIVO: EXIF/GPS stripping na direktni JPEG poti (§37) — POST /api/photos
# z EXIF+GPS sliko → 201 + x-exif-stripped + sha256 ≠ original → GET → preneseni
# bajti BREZ 'Exif' markerja. Plus R192 regresija (429 korelacija ostaja) + javne poti.
set -u
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100
BASE="http://127.0.0.1:3100"
SS=/home/z/my-project/screenshots
mkdir -p "$SS"
B64=$(cat /tmp/r193-exif-b64.txt)

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

export NEXT_PUBLIC_BUILD_STAMP="2026-09-27T08:15:00.000Z"
setsid node .next/standalone/server.js > /tmp/r193-server-e2e.log 2>&1 < /dev/null &
sleep 5

agent-browser close --all > /dev/null 2>&1 || true
sleep 1
agent-browser open "$BASE/login" > /dev/null 2>&1
agent-browser wait 'input[type="email"]' > /dev/null 2>&1
agent-browser fill 'input[type="email"]' 'ci@roksal.si' > /dev/null 2>&1
agent-browser fill 'input[type="password"]' 'DimniSmoke139!' > /dev/null 2>&1
agent-browser click 'button[type="submit"]' > /dev/null 2>&1
sleep 12
echo "--- prijava ---"
agent-browser eval "JSON.stringify({url:location.pathname, err:window.__err??null})()" 2>&1 | tail -1

echo "--- Z1: R192 regresija — 429 korelacija ostane (301x calculator) ---"
agent-browser eval "(async()=>{const izidi={}; let cid=null; for(let i=1;i<=301;i++){ const r=await fetch('/api/calculator',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); izidi[r.status]=(izidi[r.status]||0)+1; if(r.status===429) cid=r.headers.get('x-correlation-id'); } return JSON.stringify({izidi, korelacijaNeprazen:!!cid});})()" 2>&1 | tail -1

echo "--- Z2: EXIF/GPS STRIP ŽIVO — POST /api/photos z EXIF sliko ---"
agent-browser eval "(async()=>{const B64='$B64'; const zig=Date.now(); const c=await fetch('/api/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ime:'r193-e2e-'+zig,naslov:'E2E C ulica 11'})}); const cd=await c.json(); if(!c.ok) return JSON.stringify({korak:'customer',status:c.status}); const p=await fetch('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nazivProjekta:'r193-e2e-'+zig,customerId:cd.id})}); const pd=await p.json(); if(!p.ok) return JSON.stringify({korak:'project',status:p.status}); const r=await fetch('/api/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:pd.id,kategorija:'MED',imageData:'data:image/jpeg;base64,'+B64})}); const rd=await r.json(); if(!r.ok) return JSON.stringify({korak:'photo',status:r.status,rd}); const hashIzvorni=await crypto.subtle.digest('SHA-256', Uint8Array.from(atob(B64), ch=>ch.charCodeAt(0))); const izvorniHex=[...new Uint8Array(hashIzvorni)].map(b=>b.toString(16).padStart(2,'0')).join(''); const g=await fetch('/api/photos?projectId='+encodeURIComponent(pd.id)); const gd=await g.json(); const najdena=(Array.isArray(gd)?gd:[]).find(x=>x.id===rd.id); const preneseni=najdena&&najdena.imageData?najdena.imageData.replace(/^data:[^,]+,/,''):''; const brezExif=preneseni&&!atob(preneseni).includes('Exif'); return JSON.stringify({photoStatus:r.status, exifHeader:r.headers.get('x-exif-stripped'), shaSeRazlikuje:rd.sha256!==izvorniHex, velikostIzvorna:B64.length*3/4|0, velikostShranjena:rd.sizeBytes, brezExifVPrenosenih:brezExif, fotoId:rd.id});})()" 2>&1 | tail -1

echo "--- Z3: PNG pot NE pride cez strip (validate-only ostane) — sketches sintaksna preverba ---"
agent-browser eval "(async()=>{const r=await fetch('/api/sketches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})}); return JSON.stringify({sketchStatus:r.status, niBlokiran:r.status!==429});})()" 2>&1 | tail -1

echo "--- Z4: javne poti + telemetrija ---"
agent-browser eval "(async()=>{const v=await fetch('/api/public/version'); const h=await fetch('/api/public/health'); const s=await fetch('/api/security/rate-limit'); const sd=await s.json(); const tw=(sd.trips||[]).filter(t=>t.kind==='write'); return JSON.stringify({version:v.status, health:h.status, telemetrija:s.status, writeTripi:tw.length>=1});})()" 2>&1 | tail -1
agent-browser screenshot "$SS/e2e-r193-exif.png" > /dev/null 2>&1 && echo "screenshot OK"

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1
ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
agent-browser close --all > /dev/null 2>&1 || true
echo "R193 E2E KONEC"
