// R210 — CREATED audit za VSA naročila (tudi brez projectId).
// Prej: `if (projectId) { await auditInTx(...) }` — naročila brez projekta so
// ostala BREZ 'Ustvarjeno' dogodka (enovrstična vrzel v sledi, P1 (i) iz R209),
// R209 zgodovina na kartici ga ni nikoli pokazala. AuditLog.projectId je
// nullable (schema) — popravek je čista sprememba pogoja, brez migracije.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const preberi = (rel: string): string => readFileSync(join(root, rel), 'utf8')

describe('R210 — POST /api/material-orders: CREATED audit za VSA naročila', () => {
  const ruta = preberi('src/app/api/material-orders/route.ts')

  it('audit NI več zaklenjen za if (projectId) — pisal naj tudi za naročila brez projekta', () => {
    // Stari vzorec: if (projectId) { await auditInTx( — ne sme več obstajati.
    expect(ruta).not.toMatch(/if \(projectId\) \{\s*\n\s*await auditInTx/)
    // Novi vzorec: projectId se posreduje kot nullable (|| null), ne surovo.
    expect(ruta).toContain('projectId: projectId || null')
    expect(ruta).toContain("akcija: 'MATERIAL_ORDER_CREATED'")
  })

  it('newValue ohranja pripisljivost: orderId + status OSNUTEK + supplierId + skupajCena + items', () => {
    // R210 (E2E lekcija): zgodovinska ruta pripisuje dogodke po TOČNI enakosti
    // parsed orderId + zahteva vsaj EN znani status — CREATED brez statusa bi
    // bil sfiltriran (statusPrej/statusPotem oba null). 'OSNUTEK' je dejstvo.
    expect(ruta).toContain(
      "newValue: { orderId: created.id, status: 'OSNUTEK', supplierId, skupajCena, items: orderItems.length }",
    )
  })

  it('audit ostane v ISTI transakciji kot create (naročilo + sled skupaj, §13)', () => {
    const tx = ruta.indexOf('await tx.materialOrder.create')
    const audit = ruta.indexOf("akcija: 'MATERIAL_ORDER_CREATED'")
    const store = ruta.indexOf('await storeResponseIn(tx, idemKey, 201')
    expect(tx).toBeGreaterThan(-1)
    expect(audit).toBeGreaterThan(tx)
    expect(store).toBeGreaterThan(audit)
  })

  it('R209 regresija: MATERIAL_ORDER_CREATED ostaja v akcijah zgodovinske rute', () => {
    const zgodovina = preberi('src/app/api/material-orders/history/route.ts')
    expect(zgodovina).toContain("'MATERIAL_ORDER_CREATED'")
  })

  it('R209 regresija: PATCH oboogatitev oldValue/newValue { orderId, status } nespremenjena', () => {
    expect(ruta).toContain('oldValue: { orderId: id, status: existing.status }')
    expect(ruta).toContain('newValue: { orderId: id, status }')
    expect(ruta).toContain("akcija: 'MATERIAL_ORDER_STATUS'")
  })

  it('prehodni stroj nespremenjen: PATCH piše audit z existing.status kot starim stanjem', () => {
    expect(ruta).toContain('const existing =')
    expect(ruta).toContain("'MATERIAL_RECEIPT'")
    expect(ruta).toContain("'MATERIAL_RECEIPT_DUPLICATE'")
  })
})
