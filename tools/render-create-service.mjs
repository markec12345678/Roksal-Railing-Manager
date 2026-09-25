/**
 * Render fallback — ustvari NOV web service za Roksal Railing Manager.
 *
 * Kontekst (R129, worklog): Vercel ostane primarna dostava (veja `main`).
 * Na Renderju teče REZERVNI deployment iz lastne veje `render` (sync workflow
 * `.github/workflows/sync-render-branch.yml` jo ob vsakem pushu na main
 * posodobi na main HEAD). Baza je Render Postgres `roksal-fallback-db`
 * (free, frankfurt) — SAMO NOVI viri, obstoječi servisi uporabnika se
 * NE dotikajo.
 *
 * Ovira iz R129: Render API zahteva plačilno metodo za 2. free web service
 * (workspace že ima `griblje-museum`). Ko lastnik doda kartico
 * (https://dashboard.render.com/billing — free tier ostane brezplačen,
 * kartica je samo preverba), ta skripta konča delo v enem ukazu.
 *
 * Uporaba:
 *   DRY RUN:  RENDER_API_KEY=rnd_... bun tools/render-create-service.mjs
 *   COMMIT:   RENDER_API_KEY=rnd_... bun tools/render-create-service.mjs --commit
 *
 * Fail-closed lastnosti:
 *   - brez RENDER_API_KEY se ustavi;
 *   - obstoječi servis z istim imenom → USTAVI (nikoli dvojnik, nič ne spreminja);
 *   - tuji servisi se NE dotikajo (samo branje seznama);
 *   - skrivnosti se generirajo ob zagonu in se pošljejo IZKLJUČNO Render API-ju
 *     (nikoli izpisane, nikoli shranjene).
 */

import { randomBytes } from 'node:crypto'

const API = 'https://api.render.com/v1'
const SERVICE_NAME = 'roksal-railing-manager'
const DB_NAME = 'roksal-fallback-db'
const BRANCH = 'render'
const REPO = 'https://github.com/markec12345678/Roksal-Railing-Manager'
const COMMIT = process.argv.includes('--commit')

/** @param {string} path @param {RequestInit} [opts] */
async function api(path, opts = {}) {
  const key = process.env.RENDER_API_KEY
  if (!key) {
    console.error('FAIL-CLOSED: manjka RENDER_API_KEY (rnd_...).')
    process.exit(1)
  }
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  })
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 300) }
  }
  if (!res.ok) {
    const msg = typeof body?.message === 'string' ? body.message : JSON.stringify(body)
    if (/payment information/i.test(msg)) {
      console.error(
        'RENDER BLOKIRA: zahtevana je plačilna metoda (2. free web service).\n' +
          '  → Lastnik: https://dashboard.render.com/billing (dodaj kartico;\n' +
          '    free tier ostane brezplačen — kartica je samo preverba),\n' +
          '    nato ponovi ta ukaz.'
      )
    }
    process.exit(1)
  }
  return body
}

const b64 = (n) => randomBytes(n).toString('base64')

async function main() {
  console.log(`Način: ${COMMIT ? 'COMMIT — ustvarjam vir' : 'DRY RUN — ničesar ne ustvarjam (--commit za izvedbo)'}`)

  // 1) Owner
  const owners = await api('/owners?limit=20')
  const owner = owners[0]?.owner
  if (!owner) process.exit(1)
  console.log(`Owner: ${owner.name} (${owner.id})`)

  // 2) Fail-closed: servis z istim imenom nikoli ne sme nastati dvakrat
  const services = await api('/services?limit=20')
  const mine = services.find((s) => s.service?.name === SERVICE_NAME)
  if (mine) {
    console.log(`SERVIS ŽE OBSTAJA: ${mine.service.id} — nič ne ustvarjam (idempotentna zaustavitev).`)
    console.log(`URL: ${mine.service.serviceDetails?.url ?? '(n/a)'}`)
    return
  }
  const foreign = services.map((s) => s.service?.name).filter(Boolean)
  console.log(`Obstoječi servisi (NIČ se jim ne dotikam): ${foreign.join(', ') || '(brez)'}`)

  // 3) Baza: najdi obstoječo ali ustvari NOVO (free, frankfurt)
  const pgList = await api('/postgres?limit=20')
  const pgEntry = pgList.find((p) => p.postgres?.name === DB_NAME)
  let pg = pgEntry?.postgres
  if (pg) {
    console.log(`Baza ŽE OBSTAJA: ${pg.id} (${pg.status}); poteče: ${pg.expiresAt}`)
  } else {
    console.log('Baza ne obstaja — ustvarjam NOVO (free, frankfurt, pg17) …')
    if (!COMMIT) {
      console.log('DRY RUN: baza bi bila ustvarjena (name=' + DB_NAME + '). — konec.')
      return
    }
    pg = await api('/postgres', {
      method: 'POST',
      body: JSON.stringify({
        name: DB_NAME,
        plan: 'free',
        region: 'frankfurt',
        version: '17',
        ownerId: owner.id,
      }),
    })
    console.log(`Baza ustvarjena: ${pg.id} — čakam na "available" …`)
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 10000))
      pg = await api(`/postgres/${pg.id}`)
      if (pg.status === 'available') break
      console.log(`  … ${pg.status}`)
    }
    if (pg.status !== 'available') {
      console.error('FAIL-CLOSED: baza ni postala available v 10 min.')
      process.exit(1)
    }
    console.log(`Baza available; poteče (free plan 30 dni): ${pg.expiresAt}`)
  }

  // 4) Connection string (interno omrežje — servis v isti regiji)
  const ci = await api(`/postgres/${pg.id}/connection-info`)
  if (!ci.internalConnectionString) {
    console.error('FAIL-CLOSED: connection-info brez internalConnectionString.')
    process.exit(1)
  }

  // 5) Payload — identičen R129 pripravljeni konfiguraciji
  const payload = {
    type: 'web_service',
    name: SERVICE_NAME,
    ownerId: owner.id,
    repo: REPO,
    branch: BRANCH,
    autoDeploy: 'yes',
    envVars: [
      { key: 'NODE_VERSION', value: '22' },
      { key: 'DATABASE_URL', value: ci.internalConnectionString },
      { key: 'SESSION_SECRET', value: b64(32) },
      { key: 'NEXTAUTH_SECRET', value: b64(32) },
      { key: 'API_KEY_PEPPER', value: b64(24) },
      { key: 'CRON_SECRET', value: randomBytes(24).toString('hex') },
      { key: 'NEXTAUTH_URL', value: `https://${SERVICE_NAME}.onrender.com` },
      { key: 'ROKSAL_RIGHTS_MODE', value: 'production' },
      { key: 'SEED_ON_DEPLOY', value: 'true' },
      // R137: nastavitvena konzola — lastnikova varovalka za bootstrap/obnovu
      // ADMIN računa. Vrednosti pride iz okolja ob klicu (NIČ v repozitoriju);
      // če nista podani, se env var-i NE nastavijo (konzola izklopljena).
      ...(process.env.ROKSAL_SETUP_TOKEN
        ? [{ key: 'ROKSAL_SETUP_TOKEN', value: process.env.ROKSAL_SETUP_TOKEN }]
        : []),
      ...(process.env.ROKSAL_SETUP_EMAIL
        ? [{ key: 'ROKSAL_SETUP_EMAIL', value: process.env.ROKSAL_SETUP_EMAIL }]
        : []),
      { key: 'NPM_CONFIG_FUND', value: 'false' },
      { key: 'NPM_CONFIG_AUDIT', value: 'false' },
    ],
    serviceDetails: {
      runtime: 'node',
      region: 'frankfurt',
      healthCheckPath: '/api/auth/demo',
      envSpecificDetails: {
        buildCommand: 'npm install --include=dev && npm run build:render',
        startCommand: 'node .next/standalone/server.js',
      },
    },
  }

  console.log('Env ključi (vrednosti skritih):')
  for (const e of payload.envVars) {
    const hidden = e.key === 'DATABASE_URL' || /SECRET|PEPPER|CRON|SETUP_TOKEN/.test(e.key)
    console.log(`  ${e.key} = ${hidden ? '***' : e.value}`)
  }
  console.log(`Build: ${payload.serviceDetails.envSpecificDetails.buildCommand}`)
  console.log(`Start: ${payload.serviceDetails.envSpecificDetails.startCommand}`)
  console.log(`Veja: ${BRANCH} (samo svoja veja — main ostane Vercelu)`)

  if (!COMMIT) {
    console.log('DRY RUN: servis NE bi bil ustvarjen. Za izvedbo ponovi z --commit.')
    return
  }

  // 6) Ustvari servis
  const created = await api('/services', { method: 'POST', body: JSON.stringify(payload) })
  const svc = created.service ?? created
  console.log(`SERVIS USTVARJEN: ${svc.id}`)
  console.log(`URL: ${svc.serviceDetails?.url ?? `https://${SERVICE_NAME}.onrender.com`}`)
  console.log('Prvi deploy se zažene samodejno (autoDeploy). Spremljaj:')
  console.log(`  curl -H "Authorization: Bearer $RENDER_API_KEY" ${API}/services/${svc.id}/deploys?limit=1`)
}

main().catch((e) => {
  console.error('NAPAKA:', e?.message ?? e)
  process.exit(1)
})
