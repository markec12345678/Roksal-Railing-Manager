# Namestitev v produkcijo

Tri poti, po vrsti priporočila.

## A) Najvarneje za začetek: pisarniški računalnik + Tailscale

Nič ni javno. Monterji in pisarna dostopajo preko Tailscale (brezplačno do 100 naprav),
Caddy in HTTPS nista potrebna, napadna površina je nič.

```bash
# na pisarniškem računalniku (Linux/macOS)
git clone https://github.com/markec12345678/Roksal-Railing-Manager.git /opt/roksal
cd /opt/roksal
cp .env.example .env
# uredi .env: DATABASE_URL, SESSION_SECRET (openssl rand -base64 32), API_KEY_PEPPER
bun install
bunx prisma db push
bunx tsx prisma/seed.ts                    # profili in katalog (demo podatki)
bunx tsx tools/create-admin.ts ti@roksal.si   # geslo za prvi račun
bun run build
bun run start                              # http://localhost:3000
```

Namesti Tailscale na računalnik in na telefone monterjev → dostop preko
`http://<tailscale-ip>:3000`. Ko se izkaže, da dela, lahko dodaš javni dostop (pot B).

## B) VPS + Caddy + HTTPS (za dostop od kjerkoli)

```bash
# 1. uporabnik in mapa
sudo useradd -r -m -d /opt/roksal roksal
sudo -u roksal git clone https://github.com/markec12345678/Roksal-Railing-Manager.git /opt/roksal
cd /opt/roksal

# 2. okolje (NE v git!)
sudo -u roksal cp .env.example .env.production
sudo -u roksal nano .env.production
#   DATABASE_URL="postgresql://roksal:GESLO@localhost:5432/roksal"
#     (S+8.2: vir je izključno PostgreSQL — namesti postgres, `sudo -u postgres
#      createdb -O roksal roksal`; prehodni SQLite način ne obstaja več)
#   SESSION_SECRET="$(openssl rand -base64 32)"
#   API_KEY_PEPPER="$(openssl rand -base64 24)"
sudo chmod 600 .env.production && sudo chown roksal:roksal .env.production

# 3. gradnja
sudo -u roksal bun install
sudo -u roksal bunx prisma migrate deploy
sudo -u roksal node prisma/seed.cjs
sudo -u roksal bunx tsx tools/create-admin.ts admin@roksal.si
sudo -u roksal bun run build

# 4. servis
sudo cp deploy/roksal.service /etc/systemd/system/roksal.service
sudo systemctl daemon-reload && sudo systemctl enable --now roksal

# 5. Caddy (HTTPS, varnostne glave, BREZ odprtega proxyja)
sudo apt install caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile      # ← zamenjaj roksal.example.si in e-pošto
sudo systemctl reload caddy

# 6. backup vsako noč
sudo cp tools/backup-db.ts /opt/roksal/tools/
echo "15 3 * * * roksal cd /opt/roksal && bunx tsx tools/backup-db.ts /opt/roksal/backups >> /var/log/roksal-backup.log 2>&1" | sudo tee /etc/cron.d/roksal-backup
```

**Kopije morajo iti izven strežnika** — backup na istem disku ne reši ničesar, če
disk crkne ali če stroj postane žrtev izsiljevalskega virusa. Najlažje: `restic` na
Backblaze B2 (≈ 1 €/mesec) ali `rsync` na NAS.

## C) Docker

`Dockerfile` in `docker-compose.yml` sta v korenu. **Nista preverjena v okolju, kjer
sta bila napisana** (tam ni bilo Dockerja) — preizkusi ju, preden se zaneseš nanju:

```bash
docker compose up -d --build
docker compose logs -f
```

## Po namestitvi — obvezno preveri

```bash
BASE_URL=https://roksal.example.si python3 tools/security-smoke.py
```

Mora vrniti **48/48 zelenih** in exit code 0. Ta skripta preveri, da anonimni
uporabnik dobi 401 na vseh 24 podatkovnih rutah, da ponarejen sejni žeton ne
deluje, da stara oblika API ključa (`ROKSAL_MOBILE_…`) ne deluje več, in da
portal stranke ostaja dostopen s svojim tokenom.

## Nadgradnja

```bash
cd /opt/roksal
sudo -u roksal git pull
sudo -u roksal bun install
sudo -u roksal bunx prisma db push        # previdno: preveri spremembe sheme
sudo -u roksal bun run build
sudo systemctl restart roksal
```

Pred `db push` **naredi backup** (`bunx tsx tools/backup-db.ts`).
