#!/bin/bash
# R143 browser prep: svež strežnik + artikel/premik (obvestilo ostane QUEUED za
# brskalniški preizkus: GET → Dostavljeno, klik → Odprto).
cd /home/z/my-project
export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
export PORT=3100

for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
  kill -9 "$pid" 2>/dev/null
done
sleep 1

setsid node .next/standalone/server.js > /tmp/r143-server.log 2>&1 < /dev/null &
sleep 4

python3 - <<'PY'
import json, time, urllib.request, urllib.error

BASE = "http://127.0.0.1:3100"

def call(path, method="GET", body=None, headers=None):
    h = {"Content-Type": "application/json", "Origin": BASE}
    h.update(headers or {})
    req = urllib.request.Request(BASE + path, method=method, headers=h,
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()

def login(email, password):
    st, h, body = call("/api/auth", "POST", {"email": email, "password": password})
    assert st == 200, f"login → {st}"
    for k, v in h.items():
        if k.lower() == "set-cookie" and "roksal_session=" in v:
            return v.split(";")[0]
    raise SystemExit("brez piškotka")

admin = login("ci@roksal.si", "DimniSmoke139!")
sifra = f"R143UI-{int(time.time())}"
st, _, body = call("/api/inventory", "POST", {"sifraMateriala": sifra, "naziv": "R143 UI Artikel", "tip": "Inox_vijak", "enota": "kos", "kolicinaZaloga": 4, "minimalnaZaloga": 6}, {"Cookie": admin})
assert st == 201, f"create → {st} {body[:80]}"
inv_id = json.loads(body)["id"]
st, _, body = call("/api/inventory", "POST", {"tipPremika": "PORABA", "inventoryId": inv_id, "kolicina": 1}, {"Cookie": admin})
assert st == 201, f"movement → {st}"
st, _, body = call("/api/notifications?limit=5", headers={"Cookie": admin})
rows = json.loads(body).get("notifications", [])
mine = [r for r in rows if r.get("entityId") == inv_id]
assert len(mine) == 0, f"ADMIN vidi tujčeno vrstico ({len(mine)}) — obseg pušča!"
print(f"prep OK — artikel {sifra}, obvestilo QUEUED za SKLADISCE (ADMIN obseg izoliran)")
PY
echo "prep_exit=$?"
