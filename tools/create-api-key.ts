// Ustvari API ključ za mobilni klient (BalkonAR) in ga izpiše ENKRAT.
// ---------------------------------------------------------------------------
// V bazi se shrani samo SHA-256 ključa, zato ga ni mogoče prebrati nazaj —
// če ga izgubiš, ustvari novega in starega prekliči.
//
// Uporaba:
//   bunx tsx tools/create-api-key.ts "Marko - telefon"
//   bunx tsx tools/create-api-key.ts --list
//   bunx tsx tools/create-api-key.ts --revoke <id>

import { PrismaClient } from '@prisma/client'
import { createApiKey } from '../src/lib/password'

const db = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)

  if (args[0] === '--list') {
    const keys = await db.apiKey.findMany({ orderBy: { createdAt: 'desc' } })
    if (keys.length === 0) {
      console.log('Ni API ključev.')
      return
    }
    console.log('ID                       IME                     PREFIX        ZADNJA UPORABA   PREKLICAN')
    for (const k of keys) {
      console.log(
        [
          k.id.padEnd(26),
          k.name.padEnd(24),
          k.keyPrefix.padEnd(14),
          (k.lastUsedAt ? k.lastUsedAt.toISOString().slice(0, 16).replace('T', ' ') : 'nikoli').padEnd(17),
          k.revokedAt ? 'DA' : '',
        ].join(''),
      )
    }
    return
  }

  if (args[0] === '--revoke') {
    const id = args[1]
    if (!id) {
      console.error('Uporaba: bunx tsx tools/create-api-key.ts --revoke <id>')
      process.exit(1)
    }
    await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } })
    console.log(`✓ Preklican ključ ${id}`)
    return
  }

  const name = args[0] ?? `ključ-${new Date().toISOString().slice(0, 10)}`
  const created = await createApiKey(name)
  console.log('')
  console.log('  ✓ API ključ ustvarjen')
  console.log('')
  console.log(`    Ime : ${created.name}`)
  console.log(`    ID  : ${created.id}`)
  console.log(`    Ključ: ${created.key}`)
  console.log('')
  console.log('  ⚠ Ključ je viden samo zdaj. V bazi je samo njegov hash.')
  console.log('    Vpiši ga v BalkonAR: Nastavitve → Roksal Railing Manager → API ključ.')
  console.log('')
}

main()
  .catch((e) => {
    console.error('✗ Napaka:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
