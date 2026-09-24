// Ustvari / upravljaj API ključe (R126 — issue #5 §3: API-key lifecycle).
// ---------------------------------------------------------------------------
// V bazi se shrani samo pepper+SHA-256 ključa, zato ga ni mogoče prebrati
// nazaj — če ga izgubiš, rotiraj (--rotate) ali ustvari novega in starega
// prekliči (--revoke). Poln ključ je viden ENKRAT ob ustvarjanju/rotaciji.
//
// Uporaba:
//   bunx tsx tools/create-api-key.ts "Marko - telefon" [--purpose "..."]
//        [--scopes projects:read,photos:write] [--projects id1,id2]
//        [--expires 2027-06-30 | --expires-in-days 365] [--rate-limit 120]
//   bunx tsx tools/create-api-key.ts --list
//   bunx tsx tools/create-api-key.ts --revoke <id>
//   bunx tsx tools/create-api-key.ts --rotate <id> [--expires 2027-06-30]
//
// Scope katalog: src/lib/api-keys.ts. Neznani scope se zavrne (fail-closed).

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createApiKey, rotateApiKey } from '../src/lib/password'
import { API_KEY_SCOPES, DEFAULT_API_KEY_SCOPES, type ApiKeyScope } from '../src/lib/api-keys'

/**
 * Naloži .env, če spremenljivke še ni v okolju (tsx je ne naloži samodejno).
 * BREZ tega bi CLI hashal ključ z napačnim pepperom kot dev strežnik —
 * ključ bi bil v bazi "veljaven", v aplikaciji pa vedno 401 (nevarno zmeda).
 */
function loadEnvFile(): void {
  const envPath = join(process.cwd(), '.env')
  let text: string
  try {
    text = readFileSync(envPath, 'utf8')
  } catch {
    return
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/)
    if (m && process.env[m[1]] === undefined && m[2] !== '') process.env[m[1]] = m[2]
  }
}
loadEnvFile()

const db = new PrismaClient()

function parseArgs(args: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith('--')) continue
    const next = args[i + 1]
    if (next === undefined || next.startsWith('--')) out[arg.slice(2)] = true
    else {
      out[arg.slice(2)] = next
      i++
    }
  }
  return out
}

function parseScopes(raw: string | boolean | undefined): ApiKeyScope[] | null {
  if (raw === true || raw === undefined) return null // privzeti nabor
  const valid = new Set(Object.keys(API_KEY_SCOPES))
  const scopes = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const unknown = scopes.filter((s) => !valid.has(s))
  if (unknown.length > 0) {
    console.error(
      `✗ Neznani scope-i: ${unknown.join(', ')}. Veljavni: ${Object.keys(API_KEY_SCOPES).join(', ')}`,
    )
    process.exit(1)
  }
  if (scopes.length === 0) {
    console.error('✗ Prazna scope lista — ključ brez scope-ov ne dela ničesar. Izpusti --scopes za privzeti nabor.')
    process.exit(1)
  }
  return scopes as ApiKeyScope[]
}

function parseExpiry(opts: Record<string, string | boolean>): Date | null | undefined {
  if (opts.expires !== undefined) {
    const d = new Date(String(opts.expires))
    if (Number.isNaN(d.getTime())) {
      console.error(`✗ Neveljaven datum --expires: ${opts.expires} (pričakujem npr. 2027-06-30)`)
      process.exit(1)
    }
    return d
  }
  if (opts['expires-in-days'] !== undefined) {
    const days = Number(opts['expires-in-days'])
    if (!Number.isInteger(days) || days <= 0) {
      console.error(`✗ --expires-in-days mora biti pozitivno število, ne: ${opts['expires-in-days']}`)
      process.exit(1)
    }
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  }
  return undefined // ni podano
}

function printCreated(name: string, id: string, key: string, purpose?: string | null, scopes?: ApiKeyScope[] | null, expiresAt?: Date | null): void {
  console.log('')
  console.log('  ✓ API ključ ustvarjen')
  console.log('')
  console.log(`    Ime    : ${name}`)
  console.log(`    ID     : ${id}`)
  console.log(`    Ključ  : ${key}`)
  console.log(`    Namens  : ${purpose ?? '(nezapisan)'}`)
  console.log(`    Scope-i: ${(scopes ?? DEFAULT_API_KEY_SCOPES).join(', ')}`)
  console.log(`    Poteče : ${expiresAt ? expiresAt.toISOString().slice(0, 10) : '(nikoli)'}`)
  console.log('')
  console.log('  ⚠ Ključ je viden SAMO zdaj. V bazi je samo njegov hash.')
  console.log('    Vpiši ga v BalkonAR: Nastavitve → Roksal Railing Manager → API ključ.')
  console.log('    Izguba → rotacija: bun run apikey -- ' + `--rotate ${id}`)
  console.log('')
}

async function main() {
  const args = process.argv.slice(2)
  const opts = parseArgs(args)

  if (opts.list) {
    const keys = await db.apiKey.findMany({ orderBy: { createdAt: 'desc' } })
    if (keys.length === 0) {
      console.log('Ni API ključev.')
      return
    }
    const now = new Date()
    console.log('ID                       IME                     PREFIX        SCOPE-I                                                  POTECE      ZADNJA UPORABA   STANJE')
    for (const k of keys) {
      const expired = k.expiresAt !== null && k.expiresAt <= now
      const state = k.revokedAt ? 'PREKLICAN' : expired ? 'POTEKEL' : 'ŽIV'
      console.log(
        [
          k.id.padEnd(26),
          k.name.padEnd(24),
          k.keyPrefix.padEnd(14),
          k.scopes.padEnd(57),
          (k.expiresAt ? k.expiresAt.toISOString().slice(0, 10) : '-').padEnd(12),
          (k.lastUsedAt ? k.lastUsedAt.toISOString().slice(0, 16).replace('T', ' ') : 'nikoli').padEnd(17),
          state,
        ].join(''),
      )
      if (k.purpose) console.log(`    namens: ${k.purpose}`)
      if (k.projectScope) console.log(`    omejitev na projekte: ${k.projectScope}`)
      if (k.rotatedFrom) console.log(`    rotacija iz: ${k.rotatedFrom}`)
    }
    return
  }

  if (opts.revoke) {
    const id = String(opts.revoke)
    await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
    console.log(`✓ Preklican ključ ${id}`)
    return
  }

  if (opts.rotate) {
    const id = String(opts.rotate)
    const expiresAt = parseExpiry(opts) // undefined = kot predhodnik
    const created = await rotateApiKey(id, expiresAt !== undefined ? { expiresAt } : {})
    if (!created) {
      console.error(`✗ Ključ ${id} ne obstaja.`)
      process.exit(1)
    }
    console.log('')
    console.log('  ✓ Ključ ROTIRAN: predhodnik je preklican, novi ključ ima iste pravice.')
    printCreated(created.name, created.id, created.key)
    return
  }

  // Prvi pozicijski argument = ime ključa (preskoči --option in njihove vrednosti).
  const VALUE_OPTIONS = new Set(['purpose', 'scopes', 'projects', 'expires', 'expires-in-days', 'rate-limit'])
  let name: string | undefined
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      if (VALUE_OPTIONS.has(args[i].slice(2)) && args[i + 1] !== undefined && !args[i + 1].startsWith('--')) i++
      continue
    }
    name = args[i]
    break
  }
  name ??= `ključ-${new Date().toISOString().slice(0, 10)}`
  const scopes = parseScopes(opts.scopes)
  const expiresAt = parseExpiry(opts)
  const projects = typeof opts.projects === 'string' ? opts.projects.split(',').map((s) => s.trim()).filter(Boolean) : null
  const rateLimit = opts['rate-limit'] !== undefined && opts['rate-limit'] !== true ? Number(opts['rate-limit']) : null

  const created = await createApiKey({
    name,
    purpose: typeof opts.purpose === 'string' ? opts.purpose : null,
    scopes,
    projectScope: projects,
    expiresAt: expiresAt ?? null,
    rateLimitPerMin: rateLimit !== null && Number.isInteger(rateLimit) && rateLimit > 0 ? rateLimit : null,
  })
  printCreated(created.name, created.id, created.key, typeof opts.purpose === 'string' ? opts.purpose : null, scopes, expiresAt ?? null)
}

main()
  .catch((e) => {
    console.error('✗ Napaka:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
