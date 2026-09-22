#!/usr/bin/env bash
# Roksal Railing Manager — namestitev v enem koraku
# ---------------------------------------------------------------------------
# Naredi vse, kar je potrebno za delujočo aplikacijo na svežem klonu:
#   odvisnosti → shema baze → demo podatki → .env s skrivnostmi → tvoj račun
#   → API ključ za mobilni klient → preverjanje (tipi + testi)
#
# Uporaba:
#   bash tools/setup.sh                 # interaktivno (vpraša za e-pošto in geslo)
#   ADMIN_EMAIL=ti@roksal.si ADMIN_PASSWORD='MojeGeslo' bash tools/setup.sh
#
# Varno za ponovni zagon: koraki so idempotentni (upsert, mkdir -p, obstoječ .env
# se ne prepiše).

set -euo pipefail
cd "$(dirname "$0")/.."

BUN="$(command -v bun || true)"
RUN() { if [ -n "$BUN" ]; then bun "$@"; else npx "$@"; fi; }

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }

# ── 1. Odvisnosti ─────────────────────────────────────────────────────────────
step "Odvisnosti"
if [ -n "$BUN" ] && [ -f bun.lock ]; then
  bun install --frozen-lockfile && ok "bun install"
else
  npm install --no-audit --no-fund && ok "npm install"
fi

# ── 2. Okolje ─────────────────────────────────────────────────────────────────
step "Okolje (.env)"
if [ -f .env ]; then
  ok ".env že obstaja — ne prepisujem"
else
  cp .env.example .env
  gen() { head -c 32 /dev/urandom | base64 | tr -d '\n=' | head -c "$1"; }
  SESSION_SECRET="$(gen 43)"
  API_KEY_PEPPER="$(gen 32)"
  # macOS sed potrebuje '' za -i; GNU ga ne. Poskusimo oboje.
  sed -i.bak "s|^SESSION_SECRET=\"\"|SESSION_SECRET=\"$SESSION_SECRET\"|" .env \
    && sed -i.bak "s|^API_KEY_PEPPER=\"\"|API_KEY_PEPPER=\"$API_KEY_PEPPER\"|" .env \
    && rm -f .env.bak
  chmod 600 .env
  ok "ustvarjen .env z naključnima SESSION_SECRET in API_KEY_PEPPER (pravice 600)"
fi
# shellcheck disable=SC1091
set -a; . ./.env; set +a

# ── 3. Baza ───────────────────────────────────────────────────────────────────
step "Baza"
mkdir -p db backups
RUN prisma generate >/dev/null && ok "Prisma Client"
RUN prisma db push --skip-generate >/dev/null && ok "shema sinhronizirana"
if [ "${SEED:-1}" = "1" ]; then
  RUN tsx prisma/seed.ts >/dev/null 2>&1 && ok "demo podatki (profili, katalog, stranke)" \
    || warn "seed ni uspel (morda že obstaja) — nadaljujem"
fi

# ── 4. Tvoj račun ─────────────────────────────────────────────────────────────
step "Administratorski račun"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
if [ -z "$ADMIN_EMAIL" ]; then
  printf '  E-pošta administratorja: '; read -r ADMIN_EMAIL
fi
if [ -z "$ADMIN_PASSWORD" ]; then
  printf '  Geslo (vsaj 8 znakov, ne izpiše se): '
  stty -echo 2>/dev/null || true; read -r ADMIN_PASSWORD; stty echo 2>/dev/null || true; echo
fi
if [ "${#ADMIN_PASSWORD}" -lt 8 ]; then
  warn "geslo je prekratko — račun ni ustvarjen. Poženi: npx tsx tools/create-admin.ts $ADMIN_EMAIL"
else
  RUN tsx tools/create-admin.ts "$ADMIN_EMAIL" "$ADMIN_PASSWORD" ADMIN && ok "račun $ADMIN_EMAIL (ADMIN)"
fi

# ── 5. API ključ za mobilni klient ────────────────────────────────────────────
if [ "${CREATE_API_KEY:-1}" = "1" ]; then
  step "API ključ za BalkonAR"
  RUN tsx tools/create-api-key.ts "setup-$(date +%Y%m%d)" | grep -E 'Ključ|ID' || true
  warn "ključ shrani zdaj — v bazi je samo njegov hash"
fi

# ── 6. Preverjanje ────────────────────────────────────────────────────────────
if [ "${SKIP_CHECKS:-0}" != "1" ]; then
  step "Preverjanje"
  if [ -n "$BUN" ]; then bunx tsc --noEmit && ok "tipi: 0 napak"; else npx tsc --noEmit && ok "tipi: 0 napak"; fi
  if [ -n "$BUN" ]; then bun run test 2>&1 | tail -4; else npm test 2>&1 | tail -4; fi
fi

# ── 7. Navodila ───────────────────────────────────────────────────────────────
cat <<'EOF'

════════════════════════════════════════════════════════════════════
  Namestitev končana.

  Zaženi:            bun run dev      (ali: npm run dev)
  Odpri:             http://localhost:3000  → preusmeri na /login

  Preveri varnost:   BASE_URL=http://localhost:3000 \
                       EMAIL=<tvoj e-mail> PASSWORD=<tvoje geslo> \
                       python3 tools/security-smoke.py
                     → pričakovano 77/77 zelenih

  Kopija baze:       npx tsx tools/backup-db.ts
  Nov API ključ:     npx tsx tools/create-api-key.ts "ime"
  Novo geslo:        npx tsx tools/create-admin.ts <email>

  Produkcija:        deploy/README.md
════════════════════════════════════════════════════════════════════
EOF
