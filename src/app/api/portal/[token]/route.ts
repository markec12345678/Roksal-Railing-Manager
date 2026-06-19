// Roksal Field - API: Javni portal stranke (token-based, brez avtentikacije)
// GET /api/portal/[token]  ->  javni podatki o projektu
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const COMPANY = {
  ime: 'Roksal d.o.o. Kranj',
  telefon: '+386 4 237 05 50',
  email: 'info@roksal.si',
  naslov: 'Struževo 65, 4000 Kranj',
  website: 'www.roksal.si',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token || token.length < 8) {
      return NextResponse.json(
        { error: 'Stran ni na voljo', code: 'INVALID_TOKEN' },
        { status: 404 }
      )
    }

    const project = await db.project.findUnique({
      where: { clientToken: token },
      include: {
        customer: true,
        photos: {
          orderBy: { createdAt: 'desc' },
        },
        auditLogs: {
          orderBy: { timestamp: 'asc' },
          take: 50,
        },
      },
    })

    if (!project || !project.clientPortalEnabled) {
      return NextResponse.json(
        { error: 'Stran ni na voljo', code: 'PORTAL_DISABLED' },
        { status: 404 }
      )
    }

    // Razdeli slike po kategorijah
    const photosByCategory = {
      PRED: project.photos
        .filter((p) => p.kategorija === 'PRED')
        .map((p) => ({
          imageData: p.imageData,
          opomba: p.opomba,
          createdAt: p.createdAt.toISOString(),
        })),
      MED: project.photos
        .filter((p) => p.kategorija === 'MED')
        .map((p) => ({
          imageData: p.imageData,
          opomba: p.opomba,
          createdAt: p.createdAt.toISOString(),
        })),
      PO: project.photos
        .filter((p) => p.kategorija === 'PO')
        .map((p) => ({
          imageData: p.imageData,
          opomba: p.opomba,
          createdAt: p.createdAt.toISOString(),
        })),
    }

    // Status timeline iz AuditLog (samo relevantne akcije)
    const statusAkcie = project.auditLogs.filter((a) =>
      ['CREATE_PROJECT', 'STATUS_CHANGE', 'PORTAL_ENABLE', 'PORTAL_REGENERATE'].includes(
        a.akcija
      )
    )

    const timeline = statusAkcie
      .map((a) => {
        let title = a.akcija
        let description = ''
        try {
          if (a.akcija === 'CREATE_PROJECT' && a.newValue) {
            const v = JSON.parse(a.newValue)
            title = 'Projekt ustvarjen'
            description = v.nazivProjekta ?? ''
          } else if (a.akcija === 'STATUS_CHANGE') {
            title = 'Status spremenjen'
            if (a.oldValue && a.newValue) {
              description = `${statusLabel(a.oldValue)} → ${statusLabel(a.newValue)}`
            } else if (a.newValue) {
              description = statusLabel(a.newValue)
            }
          } else if (a.akcija === 'PORTAL_ENABLE') {
            title = 'Portal omogočen'
          } else if (a.akcija === 'PORTAL_REGENERATE') {
            title = 'Povezava obnovljena'
          }
        } catch {
          // ignore parse errors
        }
        return {
          title,
          description,
          timestamp: a.timestamp.toISOString(),
        }
      })
      .filter((t) => t.title)

    const responseData = {
      project: {
        nazivProjekta: project.nazivProjekta,
        status: project.status,
        datumMontaze: project.datumMontaze?.toISOString() ?? null,
        estimatedPrice: project.estimatedPrice ?? null,
        clientNotes: project.clientNotes ?? null,
        customer: {
          ime: project.customer?.ime ?? '',
          naslov: project.customer?.naslov ?? '',
        },
      },
      photos: photosByCategory,
      timeline,
      company: COMPANY,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Portal [token] GET Error:', error)
    return NextResponse.json(
      { error: 'Napaka pri nalaganju portala', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    NACRTOVANO: 'Načrtovano',
    V_TEKU: 'V teku',
    ZAKLJUCENO: 'Zaključeno',
    USTAVLJENO: 'Ustavljeno',
  }
  return map[s] || s
}
