// R179 — E2E priprava: dev-only portal žeton (roksal_dev @ localhost:5433).
// Izbere NAJSTAREJŠI projekt in mu omogoči portal z determinističnim žetonom
// 'r179-qa-portal-zeton' (≥ MIN_TOKEN_LENGTH=8). Samo lokalni dev — produkcija
// NI dotaknjena (red line: žeton obstaja samo v roksal_dev).
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const TOKEN = 'r179-qa-portal-zeton'

async function main() {
  const project = await prisma.project.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, nazivProjekta: true },
  })
  if (!project) throw new Error('roksal_dev: ni projektov za QA žeton')
  await prisma.project.update({
    where: { id: project.id },
    data: {
      clientToken: TOKEN,
      clientPortalEnabled: true,
      clientTokenRevokedAt: null,
      clientTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })
  console.log(`portal QA žeton nastavljen za projekt ${project.id} (${project.nazivProjekta})`)
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
