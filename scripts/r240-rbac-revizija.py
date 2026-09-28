#!/usr/bin/env python3
# R240 — P1-g: sistemska RBAC revizija vseh pisalnih rut (read-only inventar).
# Za vsako route.ts: katere metode izvaža, ali ima denyUnless / role-gate,
# ali preverja samo authenticate(). Izhod: tabela + kandidati za vrata.
import os, re

API = "/home/z/my-project/src/app/api"

METHODS = ("POST", "PATCH", "PUT", "DELETE")

def route_files():
    for root, _dirs, files in os.walk(API):
        if "route.ts" in files:
            yield os.path.join(root, "route.ts")

def strip_comments(src):
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    src = re.sub(r"^\s*//.*$", "", src, flags=re.M)
    return src

def analyze(path):
    raw = open(path, encoding="utf-8").read()
    src = strip_comments(raw)
    rel = os.path.relpath(path, API).replace(os.sep, "/")
    methods = [m for m in METHODS if re.search(rf"export\s+(?:async\s+)?function\s+{m}\b", src)]
    has_deny = "denyUnless" in src or "denyWithoutPermission" in src
    # role-check signali (poleg denyUnless/denyWithoutPermission):
    # 3. plast = matrika @/lib/access (canManage*/assert*/lacksPermission/
    #    hasPermission/projectWhereForPrincipal) — R240 dopolnitev
    has_role_check = bool(re.search(
        r"requireRole|checkRole|hasRole|vloga\s*===|vloga\s*!=="
        r"|ADMIN|VODJA|MONTER|SKLADISCE"
        r"|canManage|canDelete|assertProjectAccess|assertOwnsProject"
        r"|lacksPermission|hasPermission|apiKeyScopeDenied"
        r"|projectWhereForPrincipal|projectAccessAllowed|@/lib/access", src))
    has_auth = bool(re.search(r"authenticate|getSession|auth\(", src))
    return rel, methods, has_deny, has_role_check, has_auth

def main():
    rows, candidates = [], []
    for p in sorted(route_files()):
        rel, methods, has_deny, has_role, has_auth = analyze(p)
        if not methods:
            continue
        write = any(m in methods for m in METHODS)
        rows.append((rel, ",".join(methods), has_deny, has_role, has_auth))
        # kandidat = pisalna ruta BREZ vsakega vlogovega signala (samo prijava)
        if write and not has_deny and not has_role:
            candidates.append((rel, ",".join(methods)))
    print(f"=== RUTA Z METODAMI: {len(rows)} ===")
    for rel, ms, d, r, a in rows:
        print(f"{'DENY' if d else '----'} {'ROLE' if r else '    '} {'AUTH' if a else 'none'} {ms:22s} {rel}")
    print(f"\n=== KANDIDATI (pisalna, brez denyUnless in brez vlogovih signalov): {len(candidates)} ===")
    for rel, ms in candidates:
        print(f"  {ms:22s} {rel}")

if __name__ == "__main__":
    main()
