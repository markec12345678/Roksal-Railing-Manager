// Ustvari ali posodobi uporabnika z geslom.
// ---------------------------------------------------------------------------
// Računov se NAMERNO ne da ustvarjati preko API-ja — prejšnji /api/auth je to
// počel in sicer z vlogo ADMIN, kar je pomenilo, da je bil kdorkoli lahko
// administrator. Ustvarjanje računov je administratorsko opravilo in teče kot
// skripta na strežniku, ne kot javna ruta.
//
// Uporaba:
//   bunx tsx tools/create-admin.ts ime@roksal.si 'MojeGeslo' ADMIN 'Ime Priimek'
//   bunx tsx tools/create-admin.ts            # interaktivno (brez izpisovanja gesla)

import { createInterface } from 'node:readline'
import { PrismaClient, UserRole } from '@prisma/client'
import { hashPassword } from '../src/lib/password'

const db = new PrismaClient()

function ask(question: string, silent = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    if (silent) {
      // stdin brez odmeza: skrijemo vnos, da geslo ne ostane v terminalu in dnevnikih
      const stdin = process.stdin
      const onData = (ch: Buffer) => {
        const s = ch.toString('utf8')
        if (s === '\n' || s === '\r' || s === '\u0004') {
          stdin.removeListener('data', onData)
        } else {
          process.stdout.write('*')
        }
      }
      stdin.on('data', onData)
    }
    rl.question(question, (answer) => {
      rl.close()
      if (silent) process.stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

async function main() {
  let [email, password, role, name] = process.argv.slice(2)

  if (!email) email = await ask('E-pošta: ')
  if (!password) password = await ask('Geslo (vsaj 8 znakov): ', true)
  if (!role) role = await ask('Vloga (ADMIN/VODJA/MONTER/SKLADISCE) [MONTER]: ') || 'MONTER'
  if (!name) name = email.split('@')[0]

  email = email.toLowerCase()
  if (password.length < 8) {
    console.error('✗ Geslo mora imeti vsaj 8 znakov.')
    process.exit(1)
  }
  const validRoles: UserRole[] = ['ADMIN', 'VODJA', 'MONTER', 'SKLADISCE']
  if (!validRoles.includes(role as UserRole)) {
    console.error(`✗ Neznana vloga "${role}". Veljavne: ${validRoles.join(', ')}`)
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)
  const existing = await db.profile.findUnique({ where: { email } })

  if (existing) {
    await db.profile.update({
      where: { id: existing.id },
      data: { passwordHash, vloga: role as UserRole, ime: name || existing.ime },
    })
    console.log(`✓ Posodobljen obstoječi uporabnik: ${email} (${role})`)
  } else {
    await db.profile.create({
      data: { email, ime: name, vloga: role as UserRole, passwordHash },
    })
    console.log(`✓ Ustvarjen uporabnik: ${email} (${role})`)
  }
  console.log('  Geslo je shranjeno kot scrypt hash. Varno ga pozabi — ponastavitev gre skozi to skripto.')
}

main()
  .catch((e) => {
    console.error('✗ Napaka:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
