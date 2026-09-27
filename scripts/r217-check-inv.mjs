import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const items = await db.inventory.findMany({ select: { id: true, naziv: true, kolicinaZaloga: true, minimalnaZaloga: true, enota: true }, orderBy: { naziv: 'asc' } })
for (const i of items) console.log(`${i.naziv} | zaloga=${i.kolicinaZaloga} min=${i.minimalnaZaloga} enota=${i.enota} | ${i.kolicinaZaloga<=i.minimalnaZaloga?'POD MIN':'nad min'} | id=${i.id}`)
await db.$disconnect()
