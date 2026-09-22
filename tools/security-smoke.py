#!/usr/bin/env python3
"""
Varnostni dimni test za Roksal Railing Manager.

Preveri 36 stvari na ŽIVEM strežniku — ne na kodi, kar je edini način, da se
ujame napaka v plasteh (proxy, ruta, piškotek, baza). Napisan je bil prav zato,
ker je prva različica proxy-ja blokirala prijavo samo: 32/36 testov je bilo
zelenih, aplikacija pa neuporabna.

Uporaba:
    python3 tools/security-smoke.py                        # localhost:3000
    BASE_URL=https://roksal.example.si python3 tools/security-smoke.py
    EMAIL=admin@roksal.si PASSWORD=... python3 tools/security-smoke.py

Izhod:
    0 = vse zeleno
    1 = vsaj ena preverba ni uspela

Za preizkus API ključa nastavi API_KEY=rkm_… (ustvari ga z
`bunx tsx tools/create-api-key.ts`). Brez njega se tisti del preskoči.
"""

from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3000").rstrip("/")
EMAIL = os.environ.get("EMAIL", "admin@roksal.si")
PASSWORD = os.environ.get("PASSWORD", "Preizkusno123")
API_KEY = os.environ.get("API_KEY", "")

PROTECTED = [
    "/api/customers", "/api/projects", "/api/inventory", "/api/crm", "/api/suppliers",
    "/api/material-prices", "/api/material-orders", "/api/sync", "/api/sketches",
    "/api/slopes", "/api/photos", "/api/gallery", "/api/documents", "/api/crews",
    "/api/schedules", "/api/calculator", "/api/deal-lock", "/api/bom-draft",
    "/api/bom-refine", "/api/portal", "/api/signature-audit", "/api/ar-snapshots",
    "/api/profili", "/api/measurements?projectId=x",
]

passed = failed = skipped = 0


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def lower(headers):
    """Next 16 pošlje glave z malimi začetnicami ('location'), HTTP/1.1 pa jih
    obravnava kot case-insensitive — zato jih tu normaliziramo, da test ni
    odvisen od velikosti črk (prva različica testa je zaradi tega padla)."""
    out = {}
    for k, v in headers.items():
        out.setdefault(k.lower(), v)
    return out


def call(path, method="GET", body=None, headers=None, follow=False):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    try:
        r = opener.open(req, timeout=60)
        return r.status, lower(r.headers), r.read()[:300]
    except urllib.error.HTTPError as e:
        return e.code, lower(e.headers), e.read()[:300]
    except Exception as e:
        return f"ERR:{type(e).__name__}", {}, str(e)[:120].encode()


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  \u2705 {name}")
    else:
        failed += 1
        print(f"  \u274c {name}   {detail}")


def skip(name, why):
    global skipped
    skipped += 1
    print(f"  \u23ed\ufe0f  {name} — preskočeno ({why})")


def cookie(headers):
    for k, v in headers.items():
        if k.lower() == "set-cookie":
            return v.split(";")[0].split("=", 1)[1]
    return None


print(f"\nVarnostni dimni test → {BASE}\n{'=' * 60}")

print("\n[1] Anonimni dostop do podatkov mora biti zavrnjen")
for p in PROTECTED:
    st, _, _ = call(p)
    check(f"{p} → 401", st == 401, f"dobil {st}")

print("\n[2] Vmesnik brez prijave")
st, h, _ = call("/")
check("GET / preusmeri na /login", st in (301, 302, 307, 308), f"dobil {st}")
check("preusmeritev na /login", "/login" in str(h.get("location", "")))
st, _, _ = call("/login")
check("GET /login → 200", st == 200, f"dobil {st}")
st, _, _ = call("/api")
check("GET /api (health) ostane javen → 200", st == 200, f"dobil {st}")

print("\n[3] Prijava")
st, _, b = call("/api/auth", "POST", {"email": EMAIL, "password": "zagotovo-napacno-geslo"})
check("napačno geslo → 401", st == 401, f"dobil {st}")
st, _, _ = call("/api/auth", "POST", {"email": "ne.obstaja@nikjer.si", "password": "karkoli12"})
check("neobstoječ e-mail → 401 (brez razkritja, kateri obstajajo)", st == 401, f"dobil {st}")
st, h, b = call("/api/auth", "POST", {"email": EMAIL, "password": PASSWORD})
check("pravilno geslo → 200", st == 200, f"dobil {st} {b[:70]}")
tok = cookie(h)
check("vrne sejni piškotek", bool(tok))
if tok:
    raw = [v for k, v in h.items() if k == "set-cookie"]
    check("piškotek je HttpOnly", any("HttpOnly" in v for v in raw))
    check("piškotek je SameSite=Lax", any("SameSite=Lax" in v for v in raw))
    check("piškotek ima Max-Age", any("Max-Age=" in v for v in raw))

auth = {"Cookie": f"roksal_session={tok}"} if tok else {}

print("\n[4] Avtenticiran dostop")
if auth:
    st, _, _ = call("/api/customers", headers=auth)
    check("GET /api/customers s sejo → 200", st == 200, f"dobil {st}")
    st, _, b = call("/api/auth", headers=auth)
    check("GET /api/auth (kdo sem) → 200", st == 200, f"dobil {st}")
    check("vrne vlogo uporabnika", b'"vloga"' in b, str(b)[:60])
else:
    skip("avtenticiran dostop", "prijava ni uspela")

print("\n[5] Ponarejanje žetona")
if tok:
    bad = tok[:-4] + ("AAAA" if not tok.endswith("AAAA") else "BBBB")
    st, _, _ = call("/api/customers", headers={"Cookie": f"roksal_session={bad}"})
    check("spremenjen podpis → 401", st == 401, f"dobil {st}")
    payload = base64.urlsafe_b64encode(
        json.dumps({"sub": "x", "email": "a@b.c", "ime": "x", "vloga": "ADMIN", "exp": 9999999999}).encode()
    ).decode().rstrip("=")
    st, _, _ = call("/api/customers", headers={"Cookie": f"roksal_session={payload}.deadbeef"})
    check("popolnoma ponarejen žeton → 401", st == 401, f"dobil {st}")
    st, _, _ = call("/api/customers", headers={"Cookie": "roksal_session=nesmisel"})
    check("naključen žeton → 401", st == 401, f"dobil {st}")
    st, _, _ = call("/api/customers", headers={"Authorization": f"Bearer {payload}.deadbeef"})
    check("ponarejen Bearer → 401", st == 401, f"dobil {st}")
else:
    skip("ponarejanje žetona", "ni seje")

print("\n[6] API ključ (mobilni klient)")
st, _, _ = call("/api/sync", headers={"Authorization": "Bearer ROKSAL_MOBILE_stara_oblika_kljuca"})
check("STARA oblika ključa (predpona) → 401", st == 401, f"dobil {st} — stari obvod še deluje!")
st, _, _ = call("/api/sync", headers={"Authorization": "Bearer rkm_nakljucninizkikljuc"})
check("naključen rkm_ ključ → 401", st == 401, f"dobil {st}")
if API_KEY:
    st, _, _ = call("/api/sync", headers={"Authorization": f"Bearer {API_KEY}"})
    check("pravi API ključ → 200", st == 200, f"dobil {st}")
    st, _, _ = call("/api/customers", headers={"Authorization": f"Bearer {API_KEY}"})
    check("API ključ NE sme brati CRM → 401/403", st in (401, 403), f"dobil {st}")
else:
    skip("pravi API ključ", "API_KEY ni nastavljen")

print("\n[7] Javne poti, ki morajo ostati javne")
st, _, _ = call("/api/portal/neobstojec-token-12345")
check("portal z napačnim tokenom → 404 (ne 401 in ne podatek)", st == 404, f"dobil {st}")
st, _, _ = call("/portal/neobstojec-token-12345", follow=True)
check("UI portala z napačnim tokenom ne razkrije podatkov", st in (200, 404), f"dobil {st}")

print(f"\n{'=' * 60}")
print(f"  {passed} uspešnih · {failed} neuspešnih · {skipped} preskočenih")
print(f"{'=' * 60}\n")
sys.exit(1 if failed else 0)
