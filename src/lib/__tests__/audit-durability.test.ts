// S+9 (issue #4 §13) — Audit durability: kritični dogodki v ISTI transakciji.
// INTEGRACIJSKI testi proti realni PostgreSQL bazi (roksal_test).
import { describe, it, expect, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { auditInTx, audit } from '@/lib/audit'

const createdProjects: string[] = []
const createdCustomers: string[] = []
const auditAkcija = `S9TEST-${randomUUID().slice(0, 8)}`

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { akcija: { startsWith: 'S9TEST-' } } })
  await db.project.deleteMany({ where: { id: { in: createdProjects } } })
  await db.customer.deleteMany({ where: { id: { in: createdCustomers } } })
  await db.$disconnect()
})

async function makeProject() {
  const customer = await db.customer.create({
    data: { ime: `S9-AUD-${randomUUID().slice(0, 8)}`, naslov: 'Test 1' },
  })
  createdCustomers.push(customer.id)
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: 'Audit test' },
  })
  createdProjects.push(project.id)
  return project
}

describe('auditInTx — atomsko s poslovnim dogodkom', () => {
  it('business + audit commitata skupaj', async () => {
    const project = await makeProject()

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.project.update({
        where: { id: project.id },
        data: { status: 'V_TEKU' },
      })
      await auditInTx(tx, {
        userId: null, // sistemski dogodek (schema S+9: userId nullable)
        projectId: project.id,
        akcija: auditAkcija,
        oldValue: 'NACRTOVANO',
        newValue: 'V_TEKU',
      })
      return result
    })
    expect(updated.status).toBe('V_TEKU')

    const logged = await db.auditLog.findFirst({ where: { akcija: auditAkcija } })
    expect(logged).not.toBeNull()
    expect(logged?.projectId).toBe(project.id)
    expect(logged?.userId).toBeNull()
  })

  it('če business pade, audit se ROLLBACKA (dnevnik ne vsebuje fantomskih vnosov)', async () => {
    const project = await makeProject()
    const akcija = `${auditAkcija}-roll`

    await expect(
      db.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: project.id },
          data: { opombe: 'poskus' },
        })
        await auditInTx(tx, {
          userId: null,
          projectId: project.id,
          akcija,
          newValue: 'x',
        })
        // Simulacija napake poslovnega dogodka PO audit vpisu:
        throw new Error('simulirana napaka posla')
      })
    ).rejects.toThrow('simulirana napaka posla')

    const logged = await db.auditLog.findFirst({ where: { akcija } })
    expect(logged).toBeNull() // ni fantomskega audit vnosa
    const fresh = await db.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(fresh.opombe).toBeNull() // posel prav tako rollbackan
  })
})

describe('audit (best-effort) — sistemski dogodki z null userId', () => {
  it('audit brez uporabnika vpše vnos z userId=null (prej FK napaka)', async () => {
    const akcija = `${auditAkcija}-sys`
    await audit({ akcija, newValue: { sistem: true } })
    const logged = await db.auditLog.findFirst({ where: { akcija } })
    expect(logged).not.toBeNull()
    expect(logged?.userId).toBeNull()
    expect(logged?.newValue).toContain('sistem')
  })
})
