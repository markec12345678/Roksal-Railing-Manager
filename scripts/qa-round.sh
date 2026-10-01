#!/usr/bin/env bash
# qa-round.sh — R340 — PARAMETRIZIRAN QA RUNNER ZA RUNDE (konsolidacija 6-a; KOLIZIJA #14: vzporedna lastniška R339 [STIL val 25 + r339-* skripti] pristala med delom — prehodna meja premaknjena 339→340, NJIHOVI r339-* skripti so zdaj delegirana zgodovina)
# ============================================================================
# PROBLEM (odobrena konsolidacija): scripts/ nosi ~809 rundnih skript
# (r121→r338; ~11–12 na rundo: build-needles, run-smoke, sweep, sweep-run,
# e2e-browser, prod-qa, derive-* …). Vsaka runda RE-DERIVIRA ISTO strukturo z
# zamenjano številko runde. Dokaz (diff r337↔r338, preverjeno v tej seji):
#   - run-smoke : spremenjeni SAMO round-žetoni (banner, SESSION_SECRET
#                 prefix, /tmp/r33X-* poti) — telo je statično;
#   - sweep     : spremenjeni SAMO komentarji + banner; seznam vnosov se
#                 DEDI (R337 dodala ai-raba → 31 vnosov, R338 nič);
#   - needles   : struktura identična (AWK varuh → čanki → need_static/
#                 must_miss → delegacija); spremenjen je le PODATEK (needleji).
# Vzdrževalna obremenitev brez dodane vrednosti → od R340 naprej runda
# DODA NEEDLEJE V REGISTER (podatek), ne novo skripto.
#
# REŠITEV (ta skript): EN runner + REGISTRI:
#   scripts/qa-needles/r${RUNDA}.tsv   (TSV: needle<TAB>opis<TAB>vrsta)
#   faze: needles | smoke | sweep | e2e | prod-qa | all  (+ --dry-run)
#
# KANONI, KI JIH TA SKRIPT PONOVAJVA (ISKRENO, fail-closed):
#   - LEKCIJA R289/R299–R321 (ASCII): needleji = ASCII/UTF-8 string literali
#     žive kode (komentarji v buildu ne preživijo minifikacije).
#     Build PREJ pred needleji — runner NE builda, samo GLASNO preveri .next.
#   - Z-STRUCT (r270 lekcija 2): nevarnost se je iz strukture SKRIPTE
#     preselila v strukturo PODATKA (register) → AWK varuh se je preselil z
#     njo: Z-STRUCT-REG (pokvarjene vrstice = 0 ali abort; prazen register =
#     abort; datoteka brez končne nove vrstice = abort — zadnja vrstica se
#     ne sme tiho izgubiti).
#   - UNION harvest (KOLIZIJA #5/#6; kanon R280/R284): noben generacijski
#     needle se ne sme tiho izgubiti — lastni register + VSI dedovi registri
#     ≤ runda + delegacija na zgodovinsko verigo r${P}-build-needles.sh
#     (P < 340; prehod BEZ vzvratne pretvorbe — zgodovina ostaja v
#     zamrznjenih skriptah, kultura dokazov lastnika). Manjkajoča vmesna
#     runda se OPOZORI GLASNO (preskočena številka ≠ tiho izgubljen needle;
#     ločiti ne znamo — zato glasno, ne molče).
#   - LEKCIJA R328 5: sweep NE vsebuje prijave — sejo vzpostavi KLICATELJ
#     (ta runner, pred seznamom).
#   - ZERO-MUTACIJA sweep (kanon R316/R317/R322): samo GET dispeči + DOM
#     branje; nič klikov na mutacijske gumbe. Sweep = POROČILO: izhod
#     pregleda človek, RC ni preverba.
#   - PRENOSLJIVOST: koren repa = git rev-parse --show-toplevel (fallback:
#     dirname te skripte). NIČ hardkodiranih poti v lastni logiki.
#     Zamrznjene skripte hardkodirajo /home/z/my-project → zagon delegiranih
#     gre skoz TRANSPARENTNO substitucijo (sed → temp kopija → obvezen
#     bash -n; original NEPOVRNJEN; vzorec scripts/qa.sh, kanon R319).
#     ISKRENA OMEJITEV substitucije: pokriva LE vrhnjo delegirano skripto.
#     Njeni OTROCI (veriga r324→r323→…) hardkodirajo 'cd /home/z/my-project'
#     v svojih telesih: če legacy pot NE obstaja → njihov cd GLASNO pade in
#     veriga teče v (pravem) cwd; če OBSTOJA kot TUJA mapa → otroci preverjajo
#     NAPAČNO drevo → zato primerjava HEAD glavi spodaj (glasno, nikoli
#     tiho zeleno).
#   - MEJA KONSOLIDACIJE (iskreno): e2e/prod-qa Z-bloki so round-specifična
#     ŽIVA logika (2340/1437 vrstic na rundo) in se NE parameterizirajo v
#     podatke. Faza delegira na r${RUNDA}-*.sh če obstaja; sicer NAJGLASNEJE
#     označen regresijski fallback na najnovejšo skripto ≤ runda (UNION
#     harvest: najnovejša nosi VSE dedne bloke).
#   - ZNANI DOLG (iskreno): gen-r*.py generatorji ostajajo kot zamrznjeni
#     dokazi; od R340 NEUPORABLJENI (rundnih skript ne generiramo več).
#
# ISKRENE DEVIACIJE od r338-* (vse namerno, dokazano v tej seji):
#   (1) smoke: EXIT-trap počisti :3100 tudi ob napaki sredi testa (r338 bi
#       pustil strežnik odprtega); (2) smoke: eksplicitni predpogoji
#       (.next/standalone/server.js + .env) GLASNO padeta namesto zmedenega
#       zastoja; (3) smoke: DATABASE_URL override prek QA_SMOKE_DATABASE_URL
#       (prenosljivost); (4) sweep: 31 vnosov v vzporednih array-ih (omogoči
#       --dry-run naštevanje + ENO mesto za dodajanje; ekvivalenca z r338
#       dokazana z diff — 31/31 vrstic bitno identičnih); (5) needles:
#       AWK Z-STRUCT skripte → Z-STRUCT-REG registra (nevarnost se je
#       preselila v podatek, varuh z njo).
#
# IZHODNE KODE: 0 OK · 1 preverba FAIL · 2 argumenti · 3 odvisnost manjka
# (skripta/orodje) · 4 substitucija pokvari sintakso · 5 pokvarjen register
# (Z-STRUCT-REG) · 6 build manjka (.next) · 7 register runde manjka.
set -u

# ── Odkrivanje korena repozitorija (prenosljivost — deluje kjerkoli) ────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO" ] || [ ! -d "$REPO" ]; then
  REPO="$SCRIPT_DIR/.."
fi
REPO="$(cd "$REPO" && pwd)" || { echo "FAIL: koren repa ($REPO) ni dosegljiv"; exit 3; }

QA_NEEDLES_DIR="$REPO/scripts/qa-needles"
# Legacy pot, ki jo hardkodirajo ZAMRZNJENE skripte (substitucija v temp kopiji).
QA_LEGACY_ROOT="${QA_LEGACY_ROOT:-/home/z/my-project}"
# Prva runda registrske ere (predhodne runde ostajajo v skriptah — dokazi).
REGISTRY_FIRST_ROUND=340
# DEDOVINA sweep: število vnosov, nespremenjeno iz r338-sweep.sh. Posodobi OB
# DODAJANJU vnosa (kanon: vnosi se dedijo, NIKOLI ne brišejo).
EXPECTED_SWEEP_ENTRIES=31

DRY_RUN=0
NEEDLE_FAIL=0
STRAGGLERS=""

# ── Zastavice za preverbo orodij (fail-closed: glasno, ne tiho) ─────────────
zahtevaj_orodje() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "FAIL-CLOSED: orodje '$1' ni na PATH — faza ne more teči (glasno, ne tiho)"
    exit 3
  }
}

# ── Needle funkcije (VERBATIM logika iz r338-build-needles.sh) ──────────────
# grep -rqF -- dobesedno po čankih v $OUT; need_static = MORA biti živ;
# must_miss = NE SME biti prisoten (razvojni ostanki).
need_static() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then echo "OK   : $2"
  else echo "MISS : $2  (needle: $1)"; NEEDLE_FAIL=1; fi
}
must_miss() {
  if grep -rqF -- "$1" "$OUT" 2>/dev/null; then
    echo "HIT  : $2 (needle: $1 — NE SME BITI!)"; NEEDLE_FAIL=1
  else echo "OK   : $2 (odsoten)"; fi
}

# ── Z-STRUCT-REG: AWK strukturni varuh registra (r270 lekcija 2, preseljena
#    iz skripte v PODATEK). Vrne: <vrstic> <need_static> <must_miss>
#    <pokvarjenih>. Pokvarjena = napačno število polj / prazno polje /
#    neznana vrsta. Klicatelj ABORTIRA če pokvarjenih ≠ 0 ali vrstic = 0. ────
validate_registry() {
  local file="$1"
  awk '
    BEGIN { FS = "\t" }
    /^#/     { next }          # komentar (stolpec 1)
    /^[ \t]*$/ { next }        # prazna vrstica
    {
      vrstic++
      if (NF != 3) { pok++; print "  POKVARJENA vrstica " NR ": pričakovani 3 TAB-polja, najdeno " NF > "/dev/stderr"; next }
      if ($1 == "" || $2 == "") { pok++; print "  POKVARJENA vrstica " NR ": prazno needle ali opis polje" > "/dev/stderr"; next }
      if ($3 == "need_static") { ns++; next }
      if ($3 == "must_miss")   { mm++; next }
      pok++; print "  POKVARJENA vrstica " NR ": neznana vrsta \"" $3 "\" (pričakovano need_static|must_miss)" > "/dev/stderr"
    }
    END { printf "%d %d %d %d\n", vrstic + 0, ns + 0, mm + 0, pok + 0 }
  ' "$file"
}

# ── Žetev enega registra: validacija + need_static/must_miss po vrsticah. ────
harvest_registry() {
  local file="$1" X="$2" label="$3"
  # končna nova vrstica (sicer se zadnja vrstica TIHO izgubi — fail-closed)
  if [ -n "$(tail -c 1 "$file")" ]; then
    echo "STRUKTURNA NAPAKA: $file se NE konča z novo vrstico — zadnja vrstica bi se tiho izgubila; abort"
    exit 5
  fi
  local stats VRSTIC NS MM POK
  stats="$(validate_registry "$file")"
  read -r VRSTIC NS MM POK <<<"$stats"
  # varnostna mreža: povzetek mora biti NATANKO štiri števila (diagnoze gredo
  # na stderr; če bi kdaj ušle na stdout, read zloume — zato eksplicitna preverba)
  if ! printf '%s\n' "$stats" | grep -qE '^[0-9]+ [0-9]+ [0-9]+ [0-9]+$'; then
    echo "STRUKTURNA NAPAKA: Z-STRUCT-REG povzetek za r${X} ni štirištevilčni (dobljeno: $stats) — abort"
    exit 5
  fi
  echo "--- Z-STRUCT-REG r${X}: vrstic=${VRSTIC} (need_static=${NS}, must_miss=${MM}), pokvarjenih=${POK} (mora biti 0) ---"
  if [ "$POK" != "0" ]; then
    echo "STRUKTURNA NAPAKA registra r${X} (Z-STRUCT-REG) — abort"
    exit 5
  fi
  if [ "$VRSTIC" -eq 0 ]; then
    echo "STRUKTURNA NAPAKA: prazen register r${X} — vsaj must_miss TODO needle je obvezen (kanon R324–R338); abort"
    exit 5
  fi
  echo "--- R${X} ${label} — needleji iz $file ---"
  local needle desc kind
  while IFS=$'\t' read -r needle desc kind; do
    case "$needle" in
      ''|'#'*) continue ;;                    # komentar / prazna vrstica
    esac
    case "$kind" in
      need_static) need_static "$needle" "$desc" ;;
      must_miss)   must_miss   "$needle" "$desc" ;;
      *)
        # Z-STRUCT-REG bi to že ujel — to je varnostna mreža (fail-closed)
        echo "STRUKTURNA NAPAKA r${X}: vrstica z neznano vrsto \"$kind\" — abort"
        exit 5
        ;;
    esac
  done < "$file"
  echo "R${X} needleji: FAIL=${NEEDLE_FAIL} (${NS} need_static + ${MM} must_miss)"
}

# ── Prenosljiv zagon ZAMRZNJENE skripte (vzorec scripts/qa.sh, kanon R319):
#    če skripta hardkodira legacy pot in repa NI tam → transparentna
#    substitucija v začasni kopiji (sed + obvezen bash -n); original
#    NEPOVRNJEN. Substitucija, ki pokvari sintakso → odklon (exit 4). ────────
run_legacy() {
  local target="$1"
  [ -f "$REPO/$target" ] || { echo "MANJKA: $REPO/$target (exit 3)"; exit 3; }
  if [ "$REPO" != "$QA_LEGACY_ROOT" ] && grep -q "$QA_LEGACY_ROOT" "$REPO/$target"; then
    local tmp
    tmp="$(mktemp /tmp/roksal-qa-round-rXXXXXX.sh)"
    sed "s|$QA_LEGACY_ROOT|$REPO|g" "$REPO/$target" > "$tmp"
    if ! bash -n "$tmp"; then
      echo "SUBSTITUCIJA POKVARILA SINTAKSO ($target) — odklon (fail-closed, exit 4)"
      rm -f "$tmp"
      exit 4
    fi
    echo "[qa-round] prenosljiv zagon: $QA_LEGACY_ROOT → $REPO (temp kopija; zamrznjeni original NEPOVRNJEN)"
    bash "$tmp"
    local rc=$?
    rm -f "$tmp"
    return "$rc"
  fi
  bash "$REPO/$target"
}

# ── ISKRENO opozorilo o legacy poti (pred delegacijo verige): otroci
#    delegirane skripte hardkodirajo 'cd /home/z/my-project' — substitucija
#    pokriva le vrhnjo skripto. Če legacy KLON obstaja in NI ta repa, bo
#    veriga preverjala NAPAČNO drevo → GLASNO primerjamo glavi. ─────────────
legacy_root_opozorilo() {
  if [ "$REPO" = "$QA_LEGACY_ROOT" ]; then return 0; fi
  if [ ! -d "$QA_LEGACY_ROOT" ]; then
    echo "[qa-round] opozorilo: legacy pot $QA_LEGACY_ROOT ne obstaja — otroci delegirane verige ('cd $QA_LEGACY_ROOT') bodo GLASNO padli in tekel v pravem cwd ($REPO)"
    return 0
  fi
  echo "██ OPOMBA (glasno, ne tiho): legacy pot $QA_LEGACY_ROOT OBSTOJA in NI ta repozitorij ($REPO)."
  echo "██ Otroci delegirane verige hardkodirajo 'cd $QA_LEGACY_ROOT' — substitucija pokriva LE vrhnjo skripto,"
  echo "██ zato bo ZGODOVINSKA veriga preverjala čanke LEGACY klona:"
  local lhead rhead
  lhead="$(git -C "$QA_LEGACY_ROOT" rev-parse HEAD 2>/dev/null || echo '?')"
  rhead="$(git -C "$REPO" rev-parse HEAD 2>/dev/null || echo '?')"
  if [ "$lhead" = "$rhead" ]; then
    echo "██   glavi ENAKI ($rhead) — delegirani dokaz je za identično drevo (enakovreden)"
  else
    echo "██   glavi SE RAZLIKUJETA: legacy=$lhead  this-repo=$rhead"
    echo "██   → delegirani dokaz bo za LEGACY drevo, NE za ta repa! (iskreno: NE tiho zeleno)"
  fi
  echo "██ Popravek: QA_LEGACY_ROOT=$REPO bash scripts/qa-round.sh … (ali postavi repo na legacy pot)"
}

# ── Najnovejša r${P}-<vzorec>.sh s P ≤ meja (UNION harvest: najnovejša
#    skripta nosi VSE dedne bloke svoje družine) ─────────────────────────────
najdi_najnovejso() {
  local vzorec="$1" meja="$2"
  ls -1 "$REPO/scripts" 2>/dev/null \
    | grep -E "^r[0-9]+-${vzorec}\.sh$" \
    | sed -E "s/^r([0-9]+)-.*/\1/" \
    | sort -n | awk -v m="$meja" '$1 <= m' | tail -1
}

# ═══════════════════════════════════════════════════════════════════════════
# FAZA: needles — build-needleji iz REGISTRA + UNION harvest + delegacija
# ═══════════════════════════════════════════════════════════════════════════
phase_needles() {
  if [ "$ROUND" -lt "$REGISTRY_FIRST_ROUND" ]; then
    echo "FAIL-CLOSED: registrska era se začne pri r${REGISTRY_FIRST_ROUND}; za zgodovinske runde uporabi scripts/qa.sh (dispatcher, kanon R319) — r${ROUND}.tsv NE obstaja in ga NE ustvarjam vzvratno (kultura dokazov: zgodovina ostaja v zamrznjenih skriptah)"
    exit 7
  fi

  local OUT="/tmp/r${ROUND}-build-chunks"
  local file X

  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY-RUN] needles R${ROUND} (koren repa: $REPO):"
    echo "  1. predpogoj: .next/static/chunks + .next/server (build PREJ pred needleji — kanon; runner NE builda)"
    if [ -d "$REPO/.next/static/chunks" ] || [ -d "$REPO/.next/server" ]; then
      echo "     .next: OBSTOJA (build prisoten)"
    else
      echo "     .next: MANJKA — pravi tek se GLASNO izjalovi (exit 6)"
    fi
    echo "  2. čanki: find .next/static/chunks .next/server -name '*.js' → cp v $OUT (md5 prefix, vzorec r338)"
    echo "  3. UNION harvest registrov r${REGISTRY_FIRST_ROUND}…r${ROUND} (validacija Z-STRUCT-REG je varno branje — izvedena TUKAJ):"
    local stats VRSTIC NS MM POK dry_rc=0
    # shellcheck disable=SC2013  # seq izpiše samo številke — delitev po presledkih je varna
    for X in $(seq "$REGISTRY_FIRST_ROUND" "$ROUND"); do
      file="$QA_NEEDLES_DIR/r${X}.tsv"
      if [ -f "$file" ]; then
        stats="$(validate_registry "$file")"
        read -r VRSTIC NS MM POK <<<"$stats"
        if [ "$X" = "$ROUND" ]; then
          echo "     r${X}: LASTNI register — ${VRSTIC} vrstic (need_static=${NS}, must_miss=${MM}), pokvarjenih ${POK}"
        else
          echo "     r${X}: DEDOVINA register — ${VRSTIC} vrstic (need_static=${NS}, must_miss=${MM}), pokvarjenih ${POK}"
        fi
        if [ "$POK" != "0" ] || [ "$VRSTIC" -eq 0 ]; then dry_rc=5; fi
      elif [ "$X" = "$ROUND" ]; then
        echo "     r${X}: LASTNI register MANJKA ($file) — pravi tek se izjalovi (exit 7)"
        dry_rc=7
      elif [ -f "$REPO/scripts/r${X}-build-needles.sh" ]; then
        echo "     r${X}: nima registra, IMA staro skripto → delegirana (union, prekomerna pokritost OK)"
      else
        echo "     r${X}: OPOZORILO — ne registra ne skripte (preskočena številka ali izgubljen needle; GLASNO, ne tiho)"
      fi
    done
    local anchor
    anchor="$(najdi_najnovejso 'build-needles' "$((REGISTRY_FIRST_ROUND - 1))")"
    if [ -n "$anchor" ]; then
      echo "  4. delegacija: scripts/r${anchor}-build-needles.sh (zgodovinska veriga r${anchor}→…→R227, UNION harvest kanon)"
      legacy_root_opozorilo
    else
      echo "  4. delegacija: MANJKA zgodovinska veriga — pravi tek se izjalovi (exit 3)"
      dry_rc=3
    fi
    echo "  5. soglasje: NEEDLE_FAIL=0 → '=== R${ROUND} BUILD NEEDLES VSE OK ===' sicer exit 1"
    if [ "$dry_rc" != "0" ]; then
      # Iskreno: dry-run konča z ISTO izhodno kodo kot pravi tek, kadar je
      # NAČRT strukturno pokvarjen (register/veriga) — suhi zagon ni potrdilo.
      echo "[DRY-RUN] NAPAKA NAČRTA — pravi tek bi se izjalovil (exit $dry_rc); dry-run konča enako (ne tiho)"
      exit "$dry_rc"
    fi
    return 0
  fi

  cd "$REPO" || { echo "FAIL: cd $REPO"; exit 3; }
  echo "=== R${ROUND} BUILD NEEDLES (register: scripts/qa-needles/) ==="

  # Build PREJ pred needleji (kanon R289/R299–R321) — runner NE builda,
  # samo GLASNO preveri (nikoli tiho naprej v prazne čanke).
  if [ ! -d .next/static/chunks ] && [ ! -d .next/server ]; then
    echo "FAIL-CLOSED: .next manjka — zaženi build PREJ pred needleji (kanon; runner ne builda, ker je build ekspliciten lastnikov korak)"
    exit 6
  fi

  mkdir -p "$OUT" && rm -f "$OUT"/*.js 2>/dev/null

  # Čanki harvest — VERBATIM vzorec r338-build-needles.sh (md5 prefix varuje
  # pred trki imen med static/ in server/).
  find .next/static/chunks .next/server -name '*.js' -type f | while read -r f; do
    cp "$f" "$OUT/$(echo "$f" | md5sum | cut -c1-12)-$(basename "$f")"
  done
  echo "  cankov: $(ls "$OUT"/*.js 2>/dev/null | wc -l)"

  # UNION harvest: lastni register (OBVEZEN) + dedovi registri (vsak obstoječ)
  # + glasna opozorila za luknje. Red: naraščajoče (dedovina pred lastno).
  # shellcheck disable=SC2013  # seq izpiše samo številke — delitev po presledkih je varna
  for X in $(seq "$REGISTRY_FIRST_ROUND" "$ROUND"); do
    file="$QA_NEEDLES_DIR/r${X}.tsv"
    if [ -f "$file" ]; then
      if [ "$X" = "$ROUND" ]; then
        harvest_registry "$file" "$X" "MANDATORY — lastni needleji"
      else
        harvest_registry "$file" "$X" "DEDOVINA — UNION harvest"
      fi
    elif [ "$X" = "$ROUND" ]; then
      echo "FAIL-CLOSED: register $file manjka — runda MORA deklarirati needleje (vsaj must_miss TODO, kanon R324–R338)"
      exit 7
    elif [ -f "$REPO/scripts/r${X}-build-needles.sh" ]; then
      echo "OPOMBA: r${X} nima registra, IMA pa staro skripto — delegirana spodaj (union; prekomerna pokritost je VARNEJŠA od tihe luknje)"
      STRAGGLERS="$STRAGGLERS $X"
    else
      echo "OPOZORILO (glasno, ne tiho): runda r${X} nima ne registra ne skripte — preskočena številka ali izgubljen needle; UNION harvest je ne more pokriti"
    fi
  done

  # Stragglers: stare skripte znotraj registrske ere (npr. vzporedna seja,
  # ki še ni migrirala) — delegiraj vsako (njihova interna veriga pokriva
  # zgodovino; podvajanja so sprejemljiva — varnost > hitrost).
  # shellcheck disable=SC2086  # namerna delitev po presledkih (seznam rund)
  for X in $STRAGGLERS; do
    echo "=== REGRESIJE: delegacija na scripts/r${X}-build-needles.sh (stara skripta v registrski eri — union) ==="
    run_legacy "scripts/r${X}-build-needles.sh" || { echo "REGRESIJA FAIL (r${X})"; exit 1; }
  done

  # ANCHOR: najvišja zgodovinska r${P}-build-needles.sh s P < 340 (danes
  # r338); njena interna veriga pokriva R337→…→R227. Brez nje UNION harvest
  # NIMA hrbtenice → fail-closed.
  local anchor
  anchor="$(najdi_najnovejso 'build-needles' "$((REGISTRY_FIRST_ROUND - 1))")"
  if [ -z "$anchor" ]; then
    echo "FAIL-CLOSED: nisem našel zgodovinske needle verige (r${REGISTRY_FIRST_ROUND}-1 in manj) — UNION harvest brez hrbtenice (exit 3)"
    exit 3
  fi
  echo "=== REGRESIJE: delegacija na scripts/r${anchor}-build-needles.sh [veriga r${anchor}→…→R227 — UNION harvest kanon; noben generacijski needle se ne sme tiho izgubiti] ==="
  legacy_root_opozorilo
  run_legacy "scripts/r${anchor}-build-needles.sh" || { echo "REGRESIJA FAIL (r${anchor} veriga)"; exit 1; }

  if [ "$NEEDLE_FAIL" = "1" ]; then echo "R${ROUND} NEEDLEJI FAIL"; exit 1; fi
  echo "=== R${ROUND} BUILD NEEDLES VSE OK ==="
}

# ═══════════════════════════════════════════════════════════════════════════
# FAZA: smoke — dimni test standalone :3100 (parameteriziran r338-run-smoke)
# ═══════════════════════════════════════════════════════════════════════════
pocisti_port_3100() {
  local pid
  for pid in $(ss -tlnp 2>/dev/null | grep ':3100' | grep -oP 'pid=\K[0-9]+' | sort -u); do
    kill -9 "$pid" 2>/dev/null
  done
}

phase_smoke() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY-RUN] smoke R${ROUND} (koren repa: $REPO):"
    echo "  predpogoji: .next/standalone/server.js + .env (build PREJ — kanon); orodja: node, curl, ss, GNU grep (-P)"
    echo "  env: PORT=3100 · DATABASE_URL=${QA_SMOKE_DATABASE_URL:-postgresql://roksal:roksal@localhost:5433/roksal_dev} · SESSION_SECRET=\${SESSION_SECRET:-R${ROUND}-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!}"
    echo "  zagon: pocisti_port_3100 → setsid node .next/standalone/server.js > /tmp/R${ROUND}-server-smoke.log (EXIT-trap = varnostna mreža)"
    echo "  preverbe (branje + fail-closed meje; NIČ DB mutacij):"
    echo "    1. GET /api/public/health (čakanje do 20×0.5 s + izpis)"
    echo "    2. GET /login → status"
    echo "    3. GET /manifest.webmanifest → status (PWA)"
    echo "    4. POST /api/auth brez Origin → 403 CSRF (fail-closed)"
    echo "    5. prijava (ci@roksal.si) + x-csrf-token → 3× pokvarjen JSON:"
    echo "       /api/calculator '{\"type\":\"railing\",,' · /api/quote '{pokvarjen' · /api/evidence '{pokvarjen'"
    echo "       vsak: 400 + 'Neveljavno telo zahteve' — sicer GLASEN exit 1 (nikoli 500)"
    echo "  /tmp artefakti: /tmp/R${ROUND}-server-smoke.log · /tmp/r${ROUND}-smoke-cookies.txt · /tmp/r${ROUND}-smoke-{telo,quote,evidence}.json"
    echo "  konec: pocisti_port_3100 + preverba 'port 3100 sproščen'"
    return 0
  fi

  zahtevaj_orodje node
  zahtevaj_orodje curl
  zahtevaj_orodje ss
  # GNU grep -P (pid=\K izluščitev — podedovana iz r338-run-smoke)
  grep -qP 'a' <<< 'a' 2>/dev/null || { echo "FAIL-CLOSED: grep -P ni podprt (potrebna GNU različica — vzorec r338-run-smoke)"; exit 3; }

  cd "$REPO" || { echo "FAIL: cd $REPO"; exit 3; }
  echo "=== R${ROUND} dimni test (standalone :3100 + javni health + prijavna rute + PWA manifest; brez DB mutacij) ==="
  if [ ! -f .next/standalone/server.js ]; then
    echo "FAIL-CLOSED: .next/standalone/server.js manjka — zaženi build PREJ (kanon: build pred QA)"
    exit 6
  fi
  if [ ! -f .env ]; then
    echo "FAIL-CLOSED: .env manjka — standalone strežnik ga potrebuje (vzorec r338-run-smoke: cp .env .next/standalone/.env)"
    exit 6
  fi

  export DATABASE_URL="${QA_SMOKE_DATABASE_URL:-postgresql://roksal:roksal@localhost:5433/roksal_dev}"
  export SESSION_SECRET="${SESSION_SECRET:-R${ROUND}-smoke-lokalni-sekret-vsaj-32-znakov-dolg!!}"
  export PORT=3100

  # Čiščenje pred + EXIT-trap (izboljšava nad r338: ob napaki sredi testa
  # strežnik NE ostane odprt — iskrena deviacija, dokumentirana v glavi)
  pocisti_port_3100
  trap pocisti_port_3100 EXIT
  sleep 1

  mkdir -p .next/standalone/.next
  cp -r .next/static .next/standalone/.next/static
  [ -d .next/standalone/public ] || cp -r public .next/standalone/public
  cp .env .next/standalone/.env
  setsid node .next/standalone/server.js > "/tmp/R${ROUND}-server-smoke.log" 2>&1 < /dev/null &
  local i
  for i in $(seq 1 20); do
    curl -s -o /dev/null --max-time 2 http://127.0.0.1:3100/api/public/health > /dev/null 2>&1 && break
    sleep 0.5
  done

  echo "--- health ---"
  curl -s --max-time 10 http://127.0.0.1:3100/api/public/health; echo
  echo "--- /login (GET status) ---"
  curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://127.0.0.1:3100/login
  echo "--- PWA manifest ---"
  curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 http://127.0.0.1:3100/manifest.webmanifest
  echo "--- auth brez Origin = 403 CSRF (fail-closed) ---"
  curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/auth -H 'Content-Type: application/json' -d '{"email":"x@y.z","geslo":"n"}'

  # Meja ŽIVO na standalone: pokvarjen JSON → 400 { error }, nikoli 500
  # (dvojni podpis: prijava izda roksal_csrf piškotek; mutacije morajo poslati
  # x-csrf-token z isto vrednostjo — brskalnik samodejno, curl ročno).
  local COOKIE="/tmp/r${ROUND}-smoke-cookies.txt" CSRF
  curl -s -c "$COOKIE" -o /dev/null -w "login=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/auth -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{"email":"ci@roksal.si","password":"DimniSmoke139!"}'
  CSRF="$(grep roksal_csrf "$COOKIE" | awk '{print $7}')"

  echo "--- meja ŽIVO na standalone: calculator pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
  curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o "/tmp/r${ROUND}-smoke-telo.json" -w "calculator-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/calculator -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{"type":"railing",,'
  grep -qF 'Neveljavno telo zahteve' "/tmp/r${ROUND}-smoke-telo.json" && echo "meja ovojnica OK (400 + { error })" || { echo "FAIL-CLOSED: ovojnica manjka"; exit 1; }

  echo "--- meja ŽIVO val-3: quote pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
  curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o "/tmp/r${ROUND}-smoke-quote.json" -w "quote-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/quote -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{pokvarjen'
  grep -qF 'Neveljavno telo zahteve' "/tmp/r${ROUND}-smoke-quote.json" && echo "val-3 ovojnica OK (400 + { error } — ISTA EN VIR)" || { echo "FAIL-CLOSED: val-3 ovojnica manjka"; exit 1; }

  echo "--- meja ŽIVO val-3 regresija: evidence pokvarjen JSON (prijavljen) → 400, nikoli 500 ---"
  curl -s -b "$COOKIE" -H "x-csrf-token: $CSRF" -o "/tmp/r${ROUND}-smoke-evidence.json" -w "evidence-pokvarjen=%{http_code}\n" --max-time 10 -X POST http://127.0.0.1:3100/api/evidence -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3100" -d '{pokvarjen'
  grep -qF 'Neveljavno telo zahteve' "/tmp/r${ROUND}-smoke-evidence.json" && echo "val-3 evidence ovojnica OK (400 + { error } — ISTA EN VIR)" || { echo "FAIL-CLOSED: val-3 evidence ovojnica manjka"; exit 1; }

  pocisti_port_3100
  sleep 1
  ss -tlnp 2>/dev/null | grep ':3100' || echo "port 3100 sproščen"
  echo "--- R${ROUND} SMOKE KONEC ---"
}

# ═══════════════════════════════════════════════════════════════════════════
# FAZA: sweep — produ QA sweep DOM-zdravje (ZERO-MUTACIJA; parameteriziran
# r338-sweep + klicatelj seje iz r338-sweep-run — LEKCIJA R328 5)
# ═══════════════════════════════════════════════════════════════════════════
# DEDOVINA: 31 vnosov NESPREMENJENIH iz r338-sweep.sh (R337 je dodala
# ai-raba vnos — zadnja sprememba seznama). Kanon: seznam se DEDI; NOVE
# runde dodajajo vnose SAMO TUKAJ (eno mesto resnice) + posodobijo
# EXPECTED_SWEEP_ENTRIES. BRISANJE vnosa je PREPUŠČENO (nikoli).
SWEEP_NAMES=(
  dashboard
  measurements
  kalkulator
  ar
  photos
  crm
  vodja
  vodja_json_gumb
  vodja_audit_pdf_gumb_R318
  vodja_koncna_pdf_gumb_R320
  vodja_zmoglj_pdf_gumb_R321
  vodja_zmoglj_csv_gumb_R323
  vodja_dnevni_pdf_gumb_R324_EPOCH
  cena_zgo_csv_gumb_R326_EPOCH
  cena_zgo_pdf_gumb_R327_EPOCH
  cena_dobavitelji_csv_gumb_R328_EPOCH
  cena_dobavitelji_pdf_gumb_R329_EPOCH
  projekti_termini_csv_gumb_R330_EPOCH
  ponudbe_spomniki_csv_gumb_R331_EPOCH
  potekli_opomniki_csv_gumb_R332_EPOCH
  pozicija_dobaviteljev_csv_gumb_R333_EPOCH
  koncna_verifikacija_csv_gumb_R334_EPOCH
  vodja_mesecni_csv_gumb_R335_EPOCH
  sistem_zdravje_csv_gumb_R336_EPOCH
  ai_raba_csv_gumb_R337_EPOCH
  cvstudio
  ekipa
  logistics
  inventory
  teren
  inclinometer
)
SWEEP_DETAILS=(
  '{"tab":"dashboard","more":null,"subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"measurements","more":null,"subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"calculator","more":null,"subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"ar","more":null,"subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"photos","more":null,"subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"crm","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"material","subTab":"suppliers","osnutek":null,"filter":null}'
  '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"vodja","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"cvstudio","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"ekipa","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"logistics","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"inventory","more":null,"subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"more","more":"teren","subTab":null,"osnutek":null,"filter":null}'
  '{"tab":"inclinometer","more":null,"subTab":null,"osnutek":null,"filter":null}'
)
SWEEP_ANCHORS=(
  'document.querySelector("main")?.textContent?.length > 100'
  'document.querySelector("main")?.textContent?.length > 100'
  'document.querySelector("main")?.textContent?.includes("Kalkul")'
  'document.querySelector("main") !== null'
  'document.querySelector("main") !== null'
  'document.querySelector("main")?.textContent?.includes("CRM")'
  'document.querySelector("[data-testid=\"koncna-verifikacija-dokaz\"]") !== null'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi poročilo končne verifikacije kot JSON"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi avtomatizacijski audit kot PDF"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi poročilo končne verifikacije kot PDF"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi meritve zmogljivosti kot PDF"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi meritve zmogljivosti kot CSV"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi dnevni pregled vodje kot PDF"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi zgodovino cen materiala kot CSV"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi zgodovino cen materiala kot PDF"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi primerjavo dobaviteljev kot CSV"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi primerjavo dobaviteljev kot PDF"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled projektov in terminov kot CSV"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled spomnikov ponudb kot CSV"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi potekle opomnike kot CSV"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pozicijo dobaviteljev kot CSV"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi poročilo končne verifikacije kot CSV"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi mesečno poročilo vodje kot CSV"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi sistem zdravje kot CSV"))'
  '[...document.querySelectorAll("button")].some(b=>(b.getAttribute("aria-label")||"").includes("Izvozi pregled AI rabe kot CSV"))'
  'document.querySelector("main") !== null'
  'document.querySelector("main") !== null'
  'document.querySelector("main") !== null'
  'document.querySelector("main") !== null'
  'document.querySelector("main") !== null'
  'document.querySelector("main") !== null'
)

# sweep_tab — VERBATIM vzorec r338-sweep.sh: eb_dispatch → čakaj → eval
# {err, dom-anchor}. ZERO-MUTACIJA: samo GET dispeči + DOM branje.
sweep_tab() {
  local ime="$1" detail="$2" anchor="$3"
  eb_dispatch "$detail" > /dev/null 2>&1
  sleep 3
  agent-browser eval "JSON.stringify({tab:'$ime', err:window.__err??null, anchor:!!($anchor), url:location.pathname})" 2>&1 | tail -1
}

phase_sweep() {
  # Strukturni varuh dedovanega seznama: tiha okrnitev (trganje array-a,
  # pozabljen vnosek) je nemogoča — dolžine morajo SOGLASNO biti 31.
  if [ "${#SWEEP_NAMES[@]}" -ne "$EXPECTED_SWEEP_ENTRIES" ] \
     || [ "${#SWEEP_DETAILS[@]}" -ne "$EXPECTED_SWEEP_ENTRIES" ] \
     || [ "${#SWEEP_ANCHORS[@]}" -ne "$EXPECTED_SWEEP_ENTRIES" ]; then
    echo "STRUKTURNA NAPAKA: sweep seznami niso skladni (${#SWEEP_NAMES[@]}/${#SWEEP_DETAILS[@]}/${#SWEEP_ANCHORS[@]} — pričakovano $EXPECTED_SWEEP_ENTRIES); abort"
    exit 5
  fi

  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY-RUN] sweep R${ROUND} (produ; EB_BASE privzeto iz e2e-lib: ${EB_BASE:-https://roksal-railing-manager.vercel.app}):"
    echo "  1. sejo vzpostavi KLICATELJ (LEKCIJA R328 5): eb_odpri_in_prijavi + eb_zapri_vodic (orodje: agent-browser)"
    echo "  2. sweep_tab × ${EXPECTED_SWEEP_ENTRIES} (DEDOVINA seznam iz r338-sweep.sh — NESPREMENJEN):"
    local i
    for i in "${!SWEEP_NAMES[@]}"; do
      printf '     %2d. %-42s → %s\n' "$((i + 1))" "${SWEEP_NAMES[$i]}" "${SWEEP_DETAILS[$i]}"
    done
    echo "  3. agent-browser close --all; sweep = POROČILO (kanon r316–r338): izhod pregleda človek, RC ni preverba"
    return 0
  fi

  zahtevaj_orodje agent-browser
  cd "$REPO" || { echo "FAIL: cd $REPO"; exit 3; }
  # shellcheck source=scripts/e2e-lib.sh
  source "$REPO/scripts/e2e-lib.sh" || { echo "FAIL-CLOSED: e2e-lib.sh se ni naložil"; exit 3; }

  echo "=== R${ROUND} produ QA sweep — DOM zdravje po tabih (ZERO-MUTACIJA) ==="
  echo "(kanon r316/r317/r322; seznam ${EXPECTED_SWEEP_ENTRIES} vnosov DEDOVINA iz r338-sweep.sh)"
  eb_odpri_in_prijavi || { echo "LOGIN FAIL"; agent-browser close --all >/dev/null 2>&1; exit 1; }
  eb_zapri_vodic

  local i
  for i in "${!SWEEP_NAMES[@]}"; do
    sweep_tab "${SWEEP_NAMES[$i]}" "${SWEEP_DETAILS[$i]}" "${SWEEP_ANCHORS[$i]}"
  done

  echo "=== KONEC sweep ==="
  agent-browser close --all >/dev/null 2>&1
}

# ═══════════════════════════════════════════════════════════════════════════
# FAZA: e2e / prod-qa — DELEGIACIJA (round-specifična ŽIVA logika se NE
# parameterizira — iskrena meja konsolidacije, glava zgoraj)
# ═══════════════════════════════════════════════════════════════════════════
# GLASNI fallback banner — nikoli tiho: povedati mora, KAJ teče, ZAKAJ in
# KAJ NE pokriva (fail-closed komunikacija, kanon "vsak dokaz, ki ga ni, mora
# biti viden").
e2e_fallback_banner() {
  local P="$1"
  echo "████████████████████████████████████████████████████████████████"
  echo "██ OPOMBA (GLASNO, ne tiho — kanon fail-closed):"
  echo "██ runda R${ROUND} NIMA lastne e2e skripte (scripts/r${ROUND}-e2e-browser.sh)."
  echo "██ Zagon: najnovejša scripts/r${P}-e2e-browser.sh = REGRESIJSKA pokritost"
  echo "██ (UNION harvest — nosi VSE dedne Z-bloke do r${P})."
  echo "██ TO NI dokaz za NOVE žive interakcije runde R${ROUND}:"
  echo "██   dekompozicijska/regresijska runda (vzorec R322/R325/R338) je pokrita"
  echo "██   z regresijo + build-needleji (iskren razlog: premik bajtno identične"
  echo "██   vsebine nima nove žive interakcije);"
  echo "██   runda z NOVO živo površino MORA dodati lastni e2e dokaz — ta"
  echo "██   fallback tega NE nadomešča."
  echo "████████████████████████████████████████████████████████████████"
}

prodqa_fallback_banner() {
  local P="$1"
  echo "████████████████████████████████████████████████████████████████"
  echo "██ OPOMBA (GLASNO, ne tiho — kanon fail-closed):"
  echo "██ runda R${ROUND} NIMA lastne prod-qa skripte (scripts/r${ROUND}-prod-qa.sh)."
  echo "██ Zagon: najnovejša scripts/r${P}-prod-qa.sh — EPOCH meja = commit meja"
  echo "██ r${P}: če commiti r${P}+1…R${ROUND} (še) niso deplojani, je ISKRENA"
  echo "██ stale/eskalacijska veja PRIČAKOVANA (kanon R258: deployment dogodek,"
  echo "██ NI koda-bug; skripta sama pošteno obravnava obe veji)."
  echo "████████████████████████████████████████████████████████████████"
}

phase_e2e() {
  local target="" P
  if [ -f "$REPO/scripts/r${ROUND}-e2e-browser.sh" ]; then
    target="scripts/r${ROUND}-e2e-browser.sh"
  else
    P="$(najdi_najnovejso 'e2e-browser' "$((ROUND - 1))")"
    if [ -z "$P" ]; then
      echo "FAIL-CLOSED: NOBENEGA e2e skripta ≤ r${ROUND} — e2e faza ne more teči (glasno, ne tiho)"
      exit 3
    fi
    target="scripts/r${P}-e2e-browser.sh"
    e2e_fallback_banner "$P"
  fi
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY-RUN] e2e R${ROUND}: zagon $target (lokalni :3100 ŽIVO; skripta sama vstavi/strežnik počisti; orodja: agent-browser, node, python3)"
    legacy_root_opozorilo
    return 0
  fi
  zahtevaj_orodje agent-browser
  zahtevaj_orodje node
  zahtevaj_orodje python3
  legacy_root_opozorilo
  run_legacy "$target" || { echo "E2E FAIL ($target)"; exit 1; }
  echo "=== [qa-round] R${ROUND} e2e KONEC ($target) ==="
}

phase_prodqa() {
  local target="" P
  if [ -f "$REPO/scripts/r${ROUND}-prod-qa.sh" ]; then
    target="scripts/r${ROUND}-prod-qa.sh"
  else
    P="$(najdi_najnovejso 'prod-qa' "$((ROUND - 1))")"
    if [ -z "$P" ]; then
      echo "FAIL-CLOSED: NOBENEGA prod-qa skripta ≤ r${ROUND} — prod-qa faza ne more teči (glasno, ne tiho)"
      exit 3
    fi
    target="scripts/r${P}-prod-qa.sh"
    prodqa_fallback_banner "$P"
  fi
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY-RUN] prod-qa R${ROUND}: zagon $target (PRODU https://roksal-railing-manager.vercel.app; EPOCH meja = commit runde skripte; orodja: agent-browser, python3, curl)"
    legacy_root_opozorilo
    return 0
  fi
  zahtevaj_orodje agent-browser
  zahtevaj_orodje python3
  zahtevaj_orodje curl
  legacy_root_opozorilo
  run_legacy "$target" || { echo "PROD QA FAIL ($target)"; exit 1; }
  echo "=== [qa-round] R${ROUND} prod-qa KONEC ($target) ==="
}

# ═══════════════════════════════════════════════════════════════════════════
# FAZA: all — zaporedna fail-closed veriga (prva napaka ustavi vse)
# Red: lokalno-build dokazi (needles, smoke) → brskalniški E2E → produkcijska
# faza (prod-qa EPOCH + sweep) na koncu (POST-commit).
# ═══════════════════════════════════════════════════════════════════════════
phase_all() {
  echo "=== [qa-round] R${ROUND} · VSE FAZE (needles → smoke → e2e → prod-qa → sweep; fail-closed veriga) ==="
  echo "--- faza 1/5: needles ---";  phase_needles
  echo "--- faza 2/5: smoke ---";    phase_smoke
  echo "--- faza 3/5: e2e ---";      phase_e2e
  echo "--- faza 4/5: prod-qa ---";  phase_prodqa
  echo "--- faza 5/5: sweep ---";    phase_sweep
  echo "=== [qa-round] R${ROUND} VSE FAZE KONEC ==="
}

# ── Uporaba ─────────────────────────────────────────────────────────────────
usage() {
  cat <<'EOF'
qa-round.sh — parametriziran QA runner za runde (R340, konsolidacija 6-a)

UPORABA:
  bash scripts/qa-round.sh <RUNDA> <FAZA> [--dry-run] [--help]

FAZE:
  needles   build-needleji iz REGISTRA scripts/qa-needles/r${RUNDA}.tsv
            (+ UNION harvest dedovih registrov + delegacija na zgodovinsko
            verigo r338-build-needles.sh → … → R227)
  smoke     dimni test standalone :3100 (health/login/manifest/CSRF/meje ×3)
  sweep     produ QA sweep DOM-zdravje (ZERO-MUTACIJA; 31 dedovih vnosov)
  e2e       brskalniški E2E ŽIVO (delegacija na r${RUNDA}-e2e-browser.sh;
            sicer NAJGLASNEJE označen regresijski fallback)
  prod-qa   produkcijski QA (delegacija; EPOCH meja; alias: prodqa)
  all       needles → smoke → e2e → prod-qa → sweep (fail-closed veriga)

ZASTAVICE:
  --dry-run   nariši načrt (registre VALIDIRA — varno branje), NE izvajaj
  -h|--help   ta pomoč (deluje tudi kot: qa-round.sh 340 needles --help)

REGISTRSKI FORMAT (scripts/qa-needles/r${RUNDA}.tsv; TAB-ločena 3 polja):
  needle_string<TAB>opis<TAB>vrsta        vrsta ∈ need_static | must_miss
  komentarji '#' in prazne vrstice dovoljeni; končaj z novo vrstico;
  presledki v needleju so POMENNI (grep -F dobesedno).
  needle = ASCII/UTF-8 string LITERAL žive kode (komentarji v buildu ne
  preživijo minifikacije — kanon LEKCIJA R289/R299–R321).

IZHODNE KODE: 0 OK · 1 preverba FAIL · 2 argumenti · 3 odvisnost manjka ·
4 substitucija pokvari sintakso · 5 pokvarjen register · 6 build manjka ·
7 register runde manjka

PRIMERI:
  bash scripts/qa-round.sh 340 needles --dry-run    # načrt + validacija registra
  bash scripts/qa-round.sh 340 all                  # polna veriga (build predhodno!)
  bash scripts/qa-round.sh 340 needles              # runda 340: ustvari r340.tsv

ZAMRZNJENA ZGODOVINA: skripte r121–r338 ostajajo NEPOVRNJENI dokazi (kanon:
needleji/sestavi se nikoli ne brišejo) — ta runner jih le DELEGIRA.
Za zgodovinske runde (< 340) uporabi scripts/qa.sh (dispatcher, kanon R319).
EOF
}

# ── Razčlenjevanje argumentov (zastavice kjerkoli; pozicije: RUNDA FAZA) ────
POSITIONAL=()
HELP=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) HELP=1 ;;
    *)         POSITIONAL+=("$arg") ;;
  esac
done

if [ "$HELP" = "1" ]; then
  usage
  # dokaz pravilne razčlenitve (naloga 6-a: --help tudi ZA pozicijami)
  if [ "${#POSITIONAL[@]}" -ge 1 ]; then
    echo
    echo "razčlenjeno iz argumentov: RUNDA=${POSITIONAL[0]} FAZA=${POSITIONAL[1]:-} DRY_RUN=${DRY_RUN}"
  fi
  exit 0
fi

if [ "${POSITIONAL[0]:-}" = "help" ]; then
  usage
  exit 0
fi
if [ "${#POSITIONAL[@]}" -lt 1 ]; then
  usage
  echo
  echo "MANJKA RUNDA (exit 2)"
  exit 2
fi
ROUND="${POSITIONAL[0]}"
if ! [[ "$ROUND" =~ ^[0-9]+$ ]]; then
  echo "RUNDA NI ŠTEVILKA: $ROUND (exit 2)"
  exit 2
fi
ROUND="$((10#$ROUND))"   # obrez vodilne ničle (iskrenost aritmetike: 0339 ≠ oktala)
if [ "${#POSITIONAL[@]}" -lt 2 ]; then
  usage
  echo
  echo "MANJKA FAZA — zavestno NE ugibam privzete faze (fail-closed; npr.: bash scripts/qa-round.sh ${ROUND} needles)"
  exit 2
fi
FAZA="${POSITIONAL[1]}"
case "$FAZA" in
  prodqa) FAZA="prod-qa" ;;   # alias kompatibilen z scripts/qa.sh (kanon R319)
  help)   usage; exit 0 ;;   # prijaznost: 'qa-round.sh 340 help'
esac

cd "$REPO" || { echo "FAIL: cd $REPO"; exit 3; }

echo "[qa-round] runda=R${ROUND} faza=${FAZA} dry_run=${DRY_RUN} repa=${REPO}"

case "$FAZA" in
  needles) phase_needles ;;
  smoke)   phase_smoke ;;
  sweep)   phase_sweep ;;
  e2e)     phase_e2e ;;
  prod-qa) phase_prodqa ;;
  all)     phase_all ;;
  *)
    usage
    echo
    echo "NEZNANA FAZA: $FAZA (exit 2)"
    exit 2
    ;;
esac
exit 0
