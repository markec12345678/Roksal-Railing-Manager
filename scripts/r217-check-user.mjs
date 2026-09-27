import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const users = await db.profile.findMany({ select: { email: true, vloga: true, deactivatedAt: true } })
console.log(JSON.stringify(users))
await db.$disconnect()
