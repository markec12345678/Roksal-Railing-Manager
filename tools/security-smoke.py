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
    "/api/railing-layout", "/api/quote", "/api/audit", "/api/auth/password",
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
    # R130 (issue #5 §6): proxy zavrača mutacije brez veljavnega izvora. Brskalnik
    # na vsaki mutaciji sam pošlje Origin — zato ga tudi ta klient pošlje (isti
    # izvor), razen če ga posamezen test eksplicitno preglasi (npr. z zlonamernim).
    if method.upper() not in ("GET", "HEAD", "OPTIONS") and not any(
        k.lower() == "origin" for k in (headers or {})
    ):
        req.add_header("Origin", BASE)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    try:
        r = opener.open(req, timeout=60)
        # Celega telesa, ne prirezanega: prirejanje na 300 bajtov je prejšnjo
        # različico te skripte zrušilo pri json.loads() na odzivu razporeda.
        # Za izpis se reže šele v `check(detail=…)`.
        return r.status, lower(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, lower(e.headers), e.read()[:500]
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

print("\n[8] Nove rute: razpored ograje in ponudba")
RECT = [
    {"xM": 0, "yM": 0, "zM": 0},
    {"xM": 4, "yM": 0, "zM": 0},
    {"xM": 4, "yM": 0, "zM": -1.5},
    {"xM": 0, "yM": 0, "zM": -1.5},
]
st, _, _ = call("/api/railing-layout", "POST", {"points": RECT, "closed": True})
check("POST /api/railing-layout brez prijave → 401", st == 401, f"dobil {st}")
st, _, _ = call("/api/quote", "POST", {"points": RECT, "closed": True})
check("POST /api/quote brez prijave → 401", st == 401, f"dobil {st}")
if auth:
    st, _, b = call("/api/railing-layout", "POST", {"points": RECT, "closed": True}, headers=auth)
    check("razpored s sejo → 200", st == 200, f"dobil {st} {str(b)[:80]}")
    if st == 200:
        d = json.loads(b)
        check("razpored: 4 robovi", len(d["layout"]["edges"]) == 4, str(len(d["layout"]["edges"])))
        check("razpored: 10 panelov", len(d["layout"]["panels"]) == 10, str(len(d["layout"]["panels"])))
        check("razpored: skupaj 11.000 mm", abs(d["summary"]["totalRunMm"] - 11000) < 1, str(d["summary"]["totalRunMm"]))
        check("razpored: rezalni seznam ni prazen", len(d["cutList"]) > 0)
    st, _, b = call("/api/quote", "POST", {"points": RECT, "closed": True}, headers=auth)
    check("ponudba s sejo → 200", st == 200, f"dobil {st} {str(b)[:80]}")
    if st == 200:
        q = json.loads(b)["quote"]
        check("ponudba: skupaj > 0", q["total"] > 0, str(q["total"]))
        check("ponudba: DDV 22 %", abs(q["vatAmount"] - q["netTotal"] * 0.22) < 0.05, str(q["vatAmount"]))
        check("ponudba: vsota postavk = bruto",
              abs(sum(i["total"] for i in q["items"]) - q["grossTotal"]) < 0.05,
              f'{sum(i["total"] for i in q["items"])} vs {q["grossTotal"]}')
    # Neveljaven vhod mora biti zavrnjen, ne izračunan
    st, _, _ = call("/api/railing-layout", "POST", {"points": RECT, "closed": True,
                                                    "spec": {"heightMm": "visoko"}}, headers=auth)
    check("neveljavna konfiguracija (heightMm: niz) → 400", st == 400, f"dobil {st}")
    st, _, _ = call("/api/railing-layout", "POST", {"points": RECT[:1], "closed": True}, headers=auth)
    check("ena sama točka → 400", st == 400, f"dobil {st}")
    st, _, b = call("/api/quote", "POST", {"points": RECT, "closed": True,
                                           "prices": {"total": 1, "glassPerM2": 999}}, headers=auth)
    check("podtaknjen 'total' v ceniku se ignorira", st == 200 and json.loads(b)["quote"]["total"] < 100000,
          f"dobil {st}")
else:
    skip("nove rute s sejo", "prijava ni uspela")

print("\n[9] Vloge")
MONTER_EMAIL = os.environ.get("MONTER_EMAIL", "")
MONTER_PASSWORD = os.environ.get("MONTER_PASSWORD", "")
if MONTER_EMAIL and MONTER_PASSWORD:
    st, h, _ = call("/api/auth", "POST", {"email": MONTER_EMAIL, "password": MONTER_PASSWORD})
    mtok = cookie(h)
    check(f"prijava monterja ({MONTER_EMAIL}) → 200", st == 200, f"dobil {st}")
    if mtok:
        mauth = {"Cookie": f"roksal_session={mtok}"}
        st, _, _ = call("/api/customers", headers=mauth)
        check("monter LAHKO bere stranke → 200", st == 200, f"dobil {st}")
        st, _, _ = call("/api/material-prices", "POST", {"cena": 1}, headers=mauth)
        check("monter NE sme pisati cen → 403", st == 403, f"dobil {st}")
        st, _, _ = call("/api/suppliers", "POST", {"ime": "test"}, headers=mauth)
        check("monter NE sme ustvarjati dobaviteljev → 403", st == 403, f"dobil {st}")
        st, _, _ = call("/api/inventory", "POST", {"sifraMateriala": "X"}, headers=mauth)
        check("monter NE sme dodajati zalog → 403", st == 403, f"dobil {st}")
        if auth:
            st, _, _ = call("/api/material-prices", "POST", {"cena": 1}, headers=auth)
            check("admin sme pisati cene → ni 403", st != 403, f"dobil {st}")
else:
    skip("vloge", "MONTER_EMAIL/MONTER_PASSWORD nista nastavljena")

print("\n[10] Omejevanje hitrosti prijave")
probe = "ratelimit-probe@neobstaja.si"
codes = [call("/api/auth", "POST", {"email": probe, "password": "napacno"})[0] for _ in range(13)]
check("prvih 10 poskusov → 401", all(c == 401 for c in codes[:10]), str(codes[:10]))
check("11. poskus → 429 (preveč poskusov)", codes[10] == 429, f"dobil {codes[10]}")
check("12. in 13. poskus → 429", codes[11] == 429 and codes[12] == 429, str(codes[11:]))
st2, h2, _ = call("/api/auth", "POST", {"email": probe, "password": "napacno"})
check("429 vsebuje Retry-After", "retry-after" in {k.lower() for k in h2}, str(list(h2.keys())))
# Drug e-naslov ni prizadet — omejitev je po (IP + e-naslov)
st3, _, _ = call("/api/auth", "POST", {"email": "drug-probe@neobstaja.si", "password": "napacno"})
check("omejitev je po e-naslovu, ne samo po IP", st3 == 401, f"dobil {st3}")

print("\n[11] Demo dostop (R127 — issue #5 §1: demo NI production ADMIN)")
# GET zastavica pove, ali je demo v tem okolju sploh omogočen; test je zato
# iskren v obeh okoljih: razvoj (vklopljen → MONTER) in produkcija (403).
st, _, b = call("/api/auth/demo")
check("GET /api/auth/demo \u2192 200", st == 200, f"dobil {st}")
flag = None
if st == 200:
    try:
        flag = json.loads(b).get("enabled")
    except Exception:
        flag = None
check("GET zastavica nosi 'enabled' (boolean)", isinstance(flag, bool), str(flag))
st, _, b = call("/api/auth/demo", "POST")
if flag:
    check("demo POST \u2192 200 ali 429 (rate limit)", st in (200, 429), f"dobil {st}")
    vloga = None
    if st == 200:
        try:
            vloga = json.loads(b).get("user", {}).get("vloga")
        except Exception:
            pass
    if st == 200:
        check("demo vloga je MONTER \u2014 NIKOLI ADMIN (#5 \u00a71)", vloga == "MONTER", f"dobil {vloga}")
else:
    check("demo POST \u2192 403 (produkcija/off \u2014 fail-closed)", st == 403, f"dobil {st}")
# Prijava prek /login forme z demo ra\u010dunom mora ZAMUDITI: geslo ne obstaja
# (null/random) \u2014 edini vhod je demo gumb, kadar je vklopljen.
st, _, _ = call("/api/auth", "POST", {"email": "demo@roksal.si", "password": "karkoli-neobstaja-2026"})
check("demo prijava prek /login forme \u2192 401", st == 401, f"dobil {st}")

print("\n[12] CSRF / Origin (R130 \u2014 issue #5 \u00a76: mutacije morajo dokazati izvor)")
# Brskalnik pošlje Origin na VSAKI mutaciji; proxy ga preveri proti Host/x-forwarded-host.
# Zlonameren izvor → 403 (plast deluje PRED prijavo, zato ne porabi rate limita).
st, _, _ = call("/api/auth", "POST", {"email": EMAIL, "password": "x"}, headers={"Origin": "https://zlonameren.example"})
check("cross-origin POST (tuj Origin) \u2192 403", st == 403, f"dobil {st}")
st, _, _ = call("/api/auth", "POST", {"email": EMAIL, "password": "x"}, headers={"Origin": BASE})
check("isti izvor (Origin = strežnik) doseže ruto \u2192 401", st == 401, f"dobil {st} — ruta mora biti dosežena")
# Brez Origin in brez Bearer → fail-closed 403 (brskalnik to pri mutaciji ne more storiti).
try:
    raw_req = urllib.request.Request(BASE + "/api/auth", data=json.dumps({"email": EMAIL, "password": "x"}).encode(), method="POST")
    raw_req.add_header("Content-Type", "application/json")
    raw_op = urllib.request.build_opener(NoRedirect)
    raw_st = raw_op.open(raw_req, timeout=60).status
except urllib.error.HTTPError as e:
    raw_st = e.code
check("mutacija BREZ Origin/Referer/Bearer \u2192 403 (fail-closed)", raw_st == 403, f"dobil {raw_st}")
# Bearer klient je izjema (ločena obravnava po §6): tuj Origin ne škodi, ključ je pa napačen → 401.
st, _, _ = call("/api/sync", headers={"Origin": "https://zlonameren.example", "Authorization": "Bearer rkm_nakljucninizkikljuc"})
check("Bearer ključ je izjema — doseže auth (401 za napačen ključ)", st == 401, f"dobil {st}")
# Varne metode ostanejo nedotaknjene tudi z tujim Origin (branje ni CSRF površina).
st, _, _ = call("/api/projects", headers={"Origin": "https://zlonameren.example"})
check("GET z tujim Origin ostane običajen anon (401)", st == 401, f"dobil {st}")

print("\n[13] Cache glave (R131 \u2014 issue #5 \u00a75: privatni API podatki niso javno cacheirani)")
# Proxy nastavi `Cache-Control: no-store` na VSEH /api/* odgovorih (izjema:
# /api/files/*, ki imajo lastno `private, max-age=3600` politiko). Preverimo
# tri anon dostopne površine — 401 zaščitena ruta, javni health, demo vrata.
st, hd, _ = call("/api/projects")
check("anon GET /api/projects (401) nosi Cache-Control: no-store",
      st == 401 and "no-store" in hd.get("cache-control", ""), f"{st} cache-control={hd.get('cache-control')!r}")
st, hd, _ = call("/api")
check("GET /api (javni health) nosi Cache-Control: no-store",
      st == 200 and "no-store" in hd.get("cache-control", ""), f"{st} cache-control={hd.get('cache-control')!r}")
st, hd, _ = call("/api/auth/demo")
check("GET /api/auth/demo nosi Cache-Control: no-store",
      st == 200 and "no-store" in hd.get("cache-control", ""), f"{st} cache-control={hd.get('cache-control')!r}")

print(f"\n{'=' * 60}")
print(f"  {passed} uspešnih · {failed} neuspešnih · {skipped} preskočenih")
print(f"{'=' * 60}\n")
sys.exit(1 if failed else 0)
