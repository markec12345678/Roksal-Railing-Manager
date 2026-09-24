// R121 (issue #7, točka 4) — DB ZAKON: Project.mobileProjectId je UNIQUE.
// Replay/vzporedni sync NE SME ustvariti dvojnika — drugi INSERT PADA s
// Prisma P2002 (ruto pretvori v idempotentno posodobitev, glej /api/sync).
// INTEGRACIJSKI test proti realni PostgreSQL bazi (roksal_test).
import { describe, it, expect, afterAll } from 'vitest'
import { db } from '@/lib/db'

const MOBILE_ID = `R121-${Date.now()}-${Math.floor(Math.random() * 1e9).toString(36)}`
const createdProjects: string[] = []
const createdCustomers: string[] = []

afterAll(async () => {
  await db.project.deleteMany({ where: { id: { in: createdProjects } } })
  await db.customer.deleteMany({ where: { id: { in: createdCustomers } } })
  await db.$disconnect()
})

async function makeCustomer() {
  const c = await db.customer.create({
    data: { ime: `R121-UNIQ-${Math.random().toString(36).slice(2, 10)}`, naslov: 'Test 1' },
  })
  createdCustomers.push(c.id)
  return c
}

describe('R121 — mobileProjectId unique constraint (DB zakon)', () => {
  it('prvi vnos z mobileProjectId uspe, DVOJNIK PADA s P2002', async () => {
    const customer = await makeCustomer()

    const first = await db.project.create({
      data: { customerId: customer.id, nazivProjekta: 'R121 prvi', mobileProjectId: MOBILE_ID },
    })
    createdProjects.push(first.id)

    let code: string | undefined
    try {
      await db.project.create({
        data: { customerId: customer.id, nazivProjekta: 'R121 dvojni (mora pasti)', mobileProjectId: MOBILE_ID },
      })
    } catch (e) {
      code = (e as { code?: string }).code
    }
    expect(code).toBe('P2002')

    // Invarianta: natanko EN projekt z tim mobileProjectId.
    const all = await db.project.findMany({ where: { mobileProjectId: MOBILE_ID } })
    expect(all).toHaveLength(1)
    expect(all[0].nazivProjekta).toBe('R121 prvi')
  })

  it('več projektov BREZ mobileProjectId (NULL) ostane dovoljenih', async () => {
    const customer = await makeCustomer()
    const a = await db.project.create({ data: { customerId: customer.id, nazivProjekta: 'R121 null-A' } })
    const b = await db.project.create({ data: { customerId: customer.id, nazivProjekta: 'R121 null-B' } })
    createdProjects.push(a.id, b.id)
    // Nič ne je padlo — NULL vrednosti se ne štejejo za duplikate.
    expect(a.id).not.toBe(b.id)
  })
})
