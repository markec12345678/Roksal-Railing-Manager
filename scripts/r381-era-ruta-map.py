#!/usr/bin/env python3
# r381-era-ruta-map.py — R381 FEATURE: era-harvest NEEDLE→RUTA MAPPING
# (handover R380 kandidat 4: "preciznejši server dokaz"). Za vsak
# need_static needle iz registrov r340–r381 poroča KATERA RUTA streže
# needlejev čanek — do zdaj je era žetva poročala SAMO chunk imena
# (chunk_028.bin / hash .js), brez rutove asociacije.
#
# TRI JEZIKA DOKAZA (deterministično, disk-only, lokalni build):
#   1. RUTA-DIREKTNO — needle v route-lokalnem server fajlu
#      (.next/server/app/**/page.js|route.js): ruta iz
#      .next/server/app-paths-manifest.json (obrnjena mapa fajl→ruta);
#   2. RUTA-PREK-IMPORTA — needle v skupnem .next/server/chunks/X.js:
#      najdi route-lokalne fajle, ki X.js DIREKTNO importirajo (grep
#      baznega imena v app/**/page.js|route.js) — enostopenjska
#      asociacija (iskreno omejitev: transzитивni importi niso sledeni);
#   3. PROBE-RUTA — register ima v r380-era-harvest.sh SERVER_PROBE_SPECS
#      par (VAR→register, ruta): needle tega registra dobi probe-ruto
#      (era canon živalski vedenjski dokaz — prod HTTP fail-closed status).
#   Client-only needleji (.next/static/chunks brez server dokaza):
#   'shared-client-chunk' — iskreno (Turbopack skupni čanki nimajo
#   enolične rutove asociacije v manifestih).
#
# Izhod: TSV (runda, needle[:56], dokaz[:40], ruta) + rezime per ruta.
import json
import pathlib
import re
import subprocess
import sys

REPO = pathlib.Path("/home/z/my-project")
SERVER = REPO / ".next/server"
STATIC = REPO / ".next/static/chunks"
REGISTRI = REPO / "scripts/qa-needles"
HARVEST = REPO / "scripts/r381-era-harvest.sh"
REG_OD, REG_DO = 340, 381


def needleji_iz_registrov():
    """(needle, runda) iz need_static vrstic; komentarji izključeni."""
    out = []
    for r in range(REG_OD, REG_DO + 1):
        f = REGISTRI / f"r{r}.tsv"
        if not f.exists():
            continue
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line or line.startswith("#"):
                continue
            deli = line.split("\t")
            if len(deli) >= 3 and deli[2] == "need_static" and deli[0].strip():
                out.append((deli[0], r))
    return out


def ruta_mapa():
    """Obrnjena app-paths-manifest: server fajl (rel pot) → ruta path."""
    m = json.loads((SERVER / "app-paths-manifest.json").read_text(encoding="utf-8"))
    obrat = {}
    for klic, fajl in m.items():
        # klic '/api/production/route' → ruta '/api/production'
        ruta = re.sub(r"/(page|route)$", "", klic)
        obrat[fajl] = ruta
    return obrat


def probe_specs():
    """Parse SERVER_PROBE_SPECS + REG_ map iz r380-era-harvest.sh:
    vrni {register_runda: [rute]}."""
    src = HARVEST.read_text(encoding="utf-8")
    var_reg = {v: int(p[1:]) for v, p in re.findall(r'REG_([A-Z]+)="scripts/qa-needles/(r\d+)\.tsv"', src)}
    specs = re.findall(r'"([A-Z]+)\|([^|]+)\|(\d+)"', src)
    iz_rut = {}
    for var, ruta, _ in specs:
        r = var_reg.get(var)
        if r is not None:
            iz_rut.setdefault(r, [])
            if ruta not in iz_rut[r]:
                iz_rut[r].append(ruta)
    return iz_rut


def grep_f(needle, koren, extra_izkljuci=""):
    """grep -rlF — seznam rel poti (deterministično sortiran)."""
    cmd = ["grep", "-rlF", "--", needle, str(koren)]
    if extra_izkljuci:
        cmd = ["grep", "-rlF", f"--exclude={extra_izkljuci}", "--", needle, str(koren)]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        return []
    return sorted(p for p in r.stdout.splitlines() if p)


def main() -> None:
    if not SERVER.exists():
        sys.exit("FAILOVEDANO: .next/server ne obstaja (najprej svež build — canon)")
    obrat = ruta_mapa()
    probe_rute = probe_specs()
    needleji = needleji_iz_registrov()

    # Predpriprava: route-lokalni fajli + njihova vsebina (za import pregled)
    rutni_fajli = {}
    for rel_fajl, ruta in obrat.items():
        p = SERVER / rel_fajl
        if p.exists():
            rutni_fajli[rel_fajl] = (ruta, p.read_text(encoding="utf-8", errors="replace"))

    vrstice_out = []
    rezime = {}
    for needle, runda in needleji:
        # (a) route-lokalni hit?
        rute = []
        for rel_fajl, (ruta, vsebina) in rutni_fajli.items():
            if needle in vsebina:
                rute.append(ruta + " (ruta-direktno)")
        dokaz = ""
        if not rute:
            # (b) skupni server chunk + import pregled
            server_hits = [p for p in grep_f(needle, SERVER, extra_izkljuci="*.map") if "/chunks/" in p]
            if server_hits:
                ch = pathlib.Path(server_hits[0])
                bazno = ch.name
                importirajo = sorted(
                    ruta for rel_fajl, (ruta, vsebina) in rutni_fajli.items() if bazno in vsebina
                )
                dokaz = f"server-chunk:{bazno[:24]}"
                for b in importirajo:
                    rute.append(b + " (prek-importa)")
                probe = probe_rute.get(runda, [])
                for pb in probe:
                    if pb not in str(rute):
                        rute.append(pb + " (probe)")
                if not rute:
                    rute.append("shared-server-chunk (brez rute)")
            else:
                # (c) client-only?
                client_hits = grep_f(needle, STATIC)
                dokaz = f"client-chunk:{pathlib.Path(client_hits[0]).name[:24]}" if client_hits else "NI-v-lokalnem-buildu"
                probe = probe_rute.get(runda, [])
                rute = [p + " (probe)" for p in probe] or ["shared-client-chunk"]
        if not dokaz:
            dokaz = "ruta-lokalen-fajl"
        ruta_s = ",".join(rute) if rute else "-"
        vrstice_out.append(f"r{runda}\t{needle[:56]}\t{dokaz}\t{ruta_s}")
        glavna = rute[0].split(" (")[0]
        rezime[glavna] = rezime.get(glavna, 0) + 1

    print("=== R381 ERA NEEDLE→RUTA MAPA (preciznejši server dokaz; vir: r340–r381 + lokalni build + probe specs) ===")
    for v in vrstice_out:
        print(v)
    print("=== REZIME PER RUTA (prva asociacija) ===")
    for r in sorted(rezime, key=lambda x: (-rezime[x], x)):
        print(f"{r}: {rezime[r]}")
    print(f"SKUPAJ: {len(vrstice_out)} needlejev; rutov z asociacijo: {sum(1 for v in vrstice_out if 'shared-client' not in v and 'NI-v-lokalnem' not in v)}")


if __name__ == "__main__":
    main()
