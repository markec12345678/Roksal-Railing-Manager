#!/bin/bash
# R133 FULL RUN (en klic — peskovnik ubija ozadnje procese med klici):
# 1. zaženi embedded PG (:5433), 2. pripravi VODJA račun, 3. dev strežnik,
# 4. API E2E + brskalniški pregled kartice.
set -e
cd /home/z/my-project

# --- embedded PG ---
(bun tools/pg.ts start > /tmp/pg.log 2>&1 &)
for i in $(seq 1 40); do
  sleep 2
  (echo > /dev/tcp/localhost/5433) 2>/dev/null && break
done
(echo > /dev/tcp/localhost/5433) 2>/dev/null || { echo "PG NI UP"; tail -5 /tmp/pg.log; exit 1; }
echo "PG up"

export DATABASE_URL="postgresql://roksal:roksal@localhost:5433/roksal_dev"
npx prisma generate > /dev/null 2>&1 || true
npx prisma migrate deploy 2>&1 | tail -1
node prisma/seed.cjs 2>&1 | tail -1
bunx tsx tools/create-admin.ts r133-vodja@roksal.si 'R133VodjaPass!' VODJA 'R133 Vodja' 2>&1 | tail -1

# --- dev strežnik ---
(npx next dev > /tmp/devserver.log 2>&1 &)
for i in $(seq 1 45); do
  sleep 2
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 4 http://localhost:3000/api 2>/dev/null || echo 000)
  if [ "$CODE" = "200" ]; then echo "server up (${i})"; break; fi
done
[ "$CODE" = "200" ] || { echo "server NI up"; tail -20 /tmp/devserver.log; exit 1; }

# --- API E2E ---
bash scripts/r133-e2e.sh

echo "=== R133 FULL RUN USPEŠEN ==="
