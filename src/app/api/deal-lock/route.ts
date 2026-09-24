// Roksal Field - API: Deal Lock (V4.1)
// POST /api/deal-lock — zaklene deal po podpisu, avtomatsko:
//   1. dealLocked = true, dealLockedAt = now
//   2. status = ZA_MONTAZO
//   3. generira BOM draft (ne naročilo)
//   4. zaklene maržo
//   5. ustvari SignatureAudit entries
//   6. AuditLog za sledenje
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'
import { auditInTx } from '@/lib/audit'

interface DealLockRequest {
  projectId: string
  customerName: string
  monterName: string
  customerSignature: string // base64 PNG
  monterSignature: string // base64 PNG
  quoteData: {
    items: Array<{ opis: string; kolicina: string; enota: string; cena: string; skupaj: string }>
    skupajBrezDDV: number
    ddv: number
    skupajZDDV: number
  }
  geoLatitude?: number
  geoLongitude?: number
  pdfHash?: string
}

export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const body = (await request.json()) as DealLockRequest
    const { projectId, customerName, monterName, customerSignature, monterSignature, quoteData } = body

    if (!projectId || !customerSignature || !monterSignature) {
      return NextResponse.json({ error: 'Manjkajo obvezni podatki (projectId, podpisi)' }, { status: 400 })
    }

    // Preveri ali projekt obstaja in ali je že zaklenjen
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }
    // R120 vzorec: zaklep posla je poslovno kritično dejanje → 'update'
    // (lastni monter/vodja ali upravitelj; servisni ključ ne zaklepa poslov).
    assertProjectAccess(auth, project, 'update')
    if (project.dealLocked) {
      return NextResponse.json({ error: 'Deal je že zaklenjen', dealLockedAt: project.dealLockedAt }, { status: 409 })
    }

    // IP + User-Agent iz headers (za audit)
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const deviceFingerprint = crypto
      .createHash('sha256')
      .update(`${ipAddress}|${userAgent}`)
      .digest('hex')
      .slice(0, 16)

    // 1. Generiraj BOM draft (Bill of Materials — ne naročilo)
    const bomDraft = generateBomDraft(quoteData, project.nazivProjekta)
    const bomJson = JSON.stringify(bomDraft)

    // 2. Izračunaj zaklenjeno maržo (poenostavljeno: 30% marža na material)
    const materialCost = quoteData.skupajBrezDDV * 0.6 // 60% material, 40% marža + delo
    const marginLocked = quoteData.skupajBrezDDV - materialCost - (quoteData.skupajBrezDDV * 0.15) // 15% delo, 25% marža

    // Hash podpisanega dokumenta: prioriteta klientov pdfHash (resnična datoteka),
    // sicer determinističen sintetični hash pogodbenih podatkov.
    const pdfHash = body.pdfHash ||
      crypto
        .createHash('sha256')
        .update(`${projectId}|${customerName}|${monterName}|${bomJson}`)
        .digest('hex')

    // 3–5. ATOMSKO: zaklep + podpisna revizija + audit v ENI transakciji.
    // (Prej je bil update ločen od audit-a: padec audit-a je pustil zaklenjen
    // projekt brez revizijskega vnosa in vrnil 500 — E2E veriga (issue #9)
    // je to dokazala na živem strežniku.)
    const actorId = auth.kind === 'user' ? auth.session.sub : null
    const updatedProject = await db.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          dealLocked: true,
          dealLockedAt: new Date(),
          dealSignedBy: customerName,
          dealSignedByMonter: monterName,
          dealSignatureIp: ipAddress,
          dealSignatureDevice: userAgent,
          bomDraftJson: bomJson,
          marginLocked: Math.round(marginLocked * 100) / 100,
          status: 'ZA_MONTAZO',
          estimatedPrice: quoteData.skupajZDDV,
        },
      })

      await tx.signatureAudit.createMany({
        data: [
          {
            projectId,
            signatureType: 'CUSTOMER',
            signedByName: customerName,
            signedByRole: 'stranka',
            signatureImage: customerSignature,
            ipAddress,
            userAgent,
            deviceFingerprint,
            geoLatitude: body.geoLatitude || null,
            geoLongitude: body.geoLongitude || null,
            pdfHash,
          },
          {
            projectId,
            signatureType: 'MONTER',
            signedByName: monterName,
            signedByRole: 'monter',
            signatureImage: monterSignature,
            ipAddress,
            userAgent,
            deviceFingerprint,
            pdfHash,
          },
        ],
      })

      // userId = prijavljeni uporabnik (FK na Profile); servisni ključ → null.
      await auditInTx(tx, {
        request,
        session: auth.kind === 'user' ? auth.session : null,
        userId: actorId,
        projectId,
        akcija: 'DEAL_LOCKED',
        oldValue: { dealLocked: project.dealLocked, status: project.status },
        newValue: {
          customerName,
          monterName,
          skupajZDDV: quoteData.skupajZDDV,
          marginLocked,
          bomItems: bomDraft.items.length,
          pdfHash,
        },
      })

      return updated
    })

    const signatureAuditCount = 2

    return NextResponse.json({
      success: true,
      projectId,
      dealLocked: true,
      dealLockedAt: updatedProject.dealLockedAt,
      status: 'ZA_MONTAZO',
      bomDraft,
      marginLocked: Math.round(marginLocked * 100) / 100,
      pdfHash,
      signatureAuditCount,
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Deal Lock Error:', error)
    return NextResponse.json({ error: 'Napaka pri zaklepu deal-a' }, { status: 500 })
  }
}

// GET — preveri stanje deal lock-a za projekt
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId je obvezen' }, { status: 400 })
    }

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        dealLocked: true,
        dealLockedAt: true,
        dealSignedBy: true,
        dealSignedByMonter: true,
        status: true,
        marginLocked: true,
        bomDraftJson: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }

    const signatures = await db.signatureAudit.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      ...project,
      bomDraft: project.bomDraftJson ? JSON.parse(project.bomDraftJson) : null,
      signatures,
    })
  } catch (error) {
    console.error('Deal Lock GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju deal lock-a' }, { status: 500 })
  }
}

// Helper: generiraj BOM draft iz quote podatkov
function generateBomDraft(quote: DealLockRequest['quoteData'], projectName: string) {
  // Iz postavk izlušči material (poenostavljeno)
  const items: Array<{
    kategorija: string
    naziv: string
    kolicina: number
    enota: string
    opomba?: string
    status: 'DRAFT'
  }> = []

  for (const item of quote.items) {
    const opis = item.opis.toLowerCase()
    // Razpoznaj tip materiala iz opisa
    if (opis.includes('wpc') || opis.includes('letv')) {
      items.push({
        kategorija: 'WPC',
        naziv: 'WPC letve 140×23mm',
        kolicina: parseFloat(item.kolicina) || 1,
        enota: 'm',
        opomba: 'Rezervirati 10% za odrezek',
        status: 'DRAFT',
      })
    }
    if (opis.includes('steb') || opis.includes('profil')) {
      items.push({
        kategorija: 'ALU',
        naziv: 'ALU steber 40×40mm',
        kolicina: parseFloat(item.kolicina) || 1,
        enota: 'kos',
        opomba: 'Vključuje sidranje',
        status: 'DRAFT',
      })
    }
    if (opis.includes('stekl')) {
      items.push({
        kategorija: 'STEKLO',
        naziv: 'Varnostno steklo 15mm',
        kolicina: parseFloat(item.kolicina) || 1,
        enota: 'm²',
        opomba: 'VSG lamirano',
        status: 'DRAFT',
      })
    }
  }

  // Dodaj standardne pomožne materiale
  items.push({
    kategorija: 'PRIPRAVE',
    naziv: 'A2 Inox vijaki',
    kolicina: Math.ceil(quote.skupajBrezDDV / 50), // ocena
    enota: 'kos',
    opomba: '4mm × 40mm',
    status: 'DRAFT',
  })
  items.push({
    kategorija: 'PRIPRAVE',
    naziv: 'Kemični sidri',
    kolicina: Math.ceil(quote.skupajBrezDDV / 200),
    enota: 'kos',
    opomba: 'Hilti HIT ali ekvivalent',
    status: 'DRAFT',
  })

  return {
    projectName,
    generatedAt: new Date().toISOString(),
    quoteTotal: quote.skupajZDDV,
    items,
    status: 'DRAFT' as const,
    notes: 'BOM draft — avtomatsko generiran iz podpisane ponudbe. Ni naročilo.',
  }
}
