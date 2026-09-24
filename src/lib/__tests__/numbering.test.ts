// S+9 (issue #4 §12) — Concurrency-safe številčenje računov.
// INTEGRACIJSKI testi proti realni PostgreSQL bazi (roksal_test).
import { describe, it, expect, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import {
  allocateDocumentNumber,
  createWithNumber,
  prefixFor,
  NumberingError,
} from '@/lib/numbering'

const createdInvoices: string[] = []
const createdProjects: string[] = []
const createdCustomers: string[] = []

async function makeProject() {
  const customer = await db.customer.create({
    data: { ime: `S9-NUM-${randomUUID().slice(0, 8)}`, naslov: 'Test 1' },
  })
  createdCustomers.push(customer.id)
  const project = await db.project.create({
    data: { customerId: customer.id, nazivProjekta: 'Številčenje test' },
  })
  createdProjects.push(project.id)
  return project
}

afterAll(async () => {
  await db.invoice.deleteMany({ where: { id: { in: createdInvoices } } })
  await db.project.deleteMany({ where: { id: { in: createdProjects } } })
  await db.customer.deleteMany({ where: { id: { in: createdCustomers } } })
  await db.$disconnect()
})

describe('format številke (združljivost z obstoječimi)', () => {
  it('prefixFor: RACUN=\'\', PREDRACUN=PR-, PREDPLACILNI=PP-, neznan → napaka', () => {
    expect(prefixFor('RACUN')).toBe('')
    expect(prefixFor('PREDRACUN')).toBe('PR-')
    expect(prefixFor('PREDPLACILNI')).toBe('PP-')
    expect(() => prefixFor('NEZNAN')).toThrow(NumberingError)
  })

  it('alokacija vrača obliko "2026-001" / "2026-PR-001" in monotono raste', async () => {
    const year = new Date().getFullYear()
    const numbers: string[] = []
    for (let i = 0; i < 3; i++) {
      const n = await db.$transaction((tx) => allocateDocumentNumber(tx, 'PREDRACUN', year))
      numbers.push(n)
    }
    for (const n of numbers) {
      expect(n).toMatch(new RegExp(`^${year}-PR-\\d{3,}$`))
    }
    const sorted = [...numbers].sort()
    expect(numbers).toEqual(sorted) // monotono naraščajoče
  })
})

describe('createWithNumber — sočasno ustvarjanje računov', () => {
  it('10 vzporednih ustvarjanj → 10 UNIKATNIH številk, nič napak', async () => {
    const project = await makeProject()
    const year = new Date().getFullYear()

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createWithNumber('RACUN', async (tx, stevilka) => {
          const inv = await tx.invoice.create({
            data: {
              projectId: project.id,
              tip: 'RACUN',
              stevilka,
              postavke: JSON.stringify([{ opis: 'x', kolicina: 1, enota: 'kos', cenaNaEnoto: 1, ddvStopnja: 22 }]),
              osnova: 1,
              ddv: 0.22,
              znesek: 1.22,
            },
          })
          createdInvoices.push(inv.id)
          return inv
        })
      )
    )

    const stevilke = results.map((r) => r.stevilka)
    expect(new Set(stevilke).size).toBe(10) // vse unikatne
    for (const s of stevilke) {
      expect(s).toMatch(new RegExp(`^${year}-\\d{3,}$`))
    }

    // Številke so zaporedne (brez vrzeli v tem batchu)
    const nums = stevilke.map((s) => parseInt(s.split('-')[1], 10)).sort((a, b) => a - b)
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i]).toBe(nums[i - 1] + 1)
    }
  })

  it('zaporedna (ne-vzporedna) ustvarjanja tudi dajo unikatne številke', async () => {
    const project = await makeProject()
    const seen = new Set<string>()
    for (let i = 0; i < 5; i++) {
      const inv = await createWithNumber('PREDPLACILNI', async (tx, stevilka) => {
        const created = await tx.invoice.create({
          data: {
            projectId: project.id,
            tip: 'PREDPLACILNI',
            stevilka,
            postavke: JSON.stringify([{ opis: 'x', kolicina: 1, enota: 'kos', cenaNaEnoto: 1, ddvStopnja: 22 }]),
            osnova: 1,
            ddv: 0.22,
            znesek: 1.22,
          },
        })
        createdInvoices.push(created.id)
        return created
      })
      expect(seen.has(inv.stevilka)).toBe(false)
      seen.add(inv.stevilka)
    }
  })
})
