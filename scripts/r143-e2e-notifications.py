#!/usr/bin/env python3
"""R143 §29 E2E — živi HTTP dokaz celotnega življenjskega cikla obvestil."""
import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:3100"


def call(path, method="GET", body=None, headers=None, verbose=False):
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
    assert st == 200, f"login {email} → {st} {body[:100]}"
    cookie = None
    for k, v in h.items():
        if k.lower() == "set-cookie" and "roksal_session=" in v:
            cookie = v.split(";")[0]
    assert cookie, "brez piškotka"
    return cookie


def auth_h(cookie):
    return {"Cookie": cookie}


results = []

def check(name, cond, detail=""):
    results.append((name, cond, detail))
    print(("  OK  " if cond else "  FAIL") + f" {name}" + (f" — {detail}" if detail else ""))


# --- prijava ---
admin = login("ci@roksal.si", "DimniSmoke139!")
skladisce = login("skladisce.ci@roksal.si", "DimniSmoke139!")

# --- 1: nizek premik zaloge kot ADMIN (inventory.write) → LOW_STOCK vrsta za SKLADISCE ---
# Unique sifra na run (dev peskovnik ostane — precedens R140 testno naročilo):
# brez boja z unikato/FK iz prejšnjih run-ov.
SIFRA = f"R143E2E-{int(__import__('time').time())}"
st, h, body = call("/api/inventory", "POST", {"sifraMateriala": SIFRA, "naziv": "R143 E2E Artikel", "tip": "Inox_vijak", "enota": "kos", "kolicinaZaloga": 4, "minimalnaZaloga": 6}, auth_h(admin))
check("artikel ustvarjen (201)", st == 201, f"st={st}")
inv_id = json.loads(body).get("id") if st == 201 else None

st, h, body = call("/api/inventory", "POST", {"tipPremika": "PORABA", "inventoryId": inv_id, "kolicina": 1}, auth_h(admin))
check("premik PORABA → 201 (4-1=3 < 6)", st == 201, f"st={st}")

# --- 2: SKLADISCE GET → vrstica vidna, dispatch + delivery ack v ISTI zahtevi ---
st, h, body = call("/api/notifications?limit=20", headers=auth_h(skladisce))
rows = json.loads(body).get("notifications", [])
low = [r for r in rows if r["template"] == "LOW_STOCK" and r.get("entityId") == inv_id]
check("SKLADISCE vidi LOW_STOCK vrstico", st == 200 and len(low) == 1, f"st={st} najdenih={len(low)}")
row = low[0] if low else {}
check("status PO GET = DELIVERED (QUEUED→SENT→DELIVERED)", row.get("status") == "DELIVERED", f"status={row.get('status')}")
check("templateVersion = 1", row.get("templateVersion") == 1)
check("correlationId prisoten", bool(row.get("correlationId")))

# idempotentnost: drugi GET ostane DELIVERED (ne nazaj SENT)
st, h, body = call("/api/notifications?limit=20", headers=auth_h(skladisce))
row2 = [r for r in json.loads(body)["notifications"] if r.get("entityId") == inv_id and r["template"] == "LOW_STOCK"][0]
check("drugi GET: status ostaja DELIVERED", row2["status"] == "DELIVERED", f"status={row2['status']}")

# --- 3: ADMIN NE vidi SKLADISCE vrste (obseg vloge) ---
st, h, body = call("/api/notifications?limit=50", headers=auth_h(admin))
admin_rows = [r for r in json.loads(body)["notifications"] if r.get("entityId") == inv_id and r["template"] == "LOW_STOCK"]
check("ADMIN ne vidi tujčene vloge (obseg XOR)", len(admin_rows) == 0, f"najdenih={len(admin_rows)}")

# --- 4: open ack — POST read → OPENED + isRead ---
st, h, body = call("/api/notifications/read", "POST", {"id": row["id"]}, auth_h(skladisce))
check("POST read → 200 + OPENED", st == 200 and json.loads(body).get("status") == "OPENED", f"st={st} {body[:80]}")
st, h, body = call("/api/notifications/read", "POST", {"id": row["id"]}, auth_h(skladisce))
check("še enkrat read = idempotentno 200", st == 200, f"st={st}")

# --- 5: tuj id → 404 (ne razkriva obstoja) ---
st, h, body = call("/api/notifications/read", "POST", {"id": row["id"]}, auth_h(admin))
check("tuj id → 404", st == 404, f"st={st}")

# --- 6: matrica — anon 401 s korelacijo ---
st, h, body = call("/api/notifications")
check("GET anon → 401 + x-correlation-id", st == 401 and len(h.get("x-correlation-id", "")) >= 8, f"st={st}")

print(f"\n{sum(1 for _, c, _ in results if c)}/{len(results)} OK")
exit(0 if all(c for _, c, _ in results) else 1)
