// Roksal Field - API: Javni portal stranke (token-based, brez avtentikacije)
// GET /api/portal/[token]  ->  javni podatki o projektu
//
// R132 (issue #5 §7): žeton NI več trajni javni ključ.
//   • rate limit (shared po IP — enumeration protection);
//   • življenjski cikl: potek + revokacija + onemogočen portal (src/lib/portal.ts);
//   • VSA neveljavna stanja vrnejo ISTE 404 (enumeration: ne razlikujemo
//     "ne obstaja" od "potekel" od "preklican");
//   • dostopni dnevnik PortalAccess (uspeh IN neuspeh, z hashiranim IP);
//   • minimalni DTO: izbira samo polj, ki jih stranka vidi (brez internih
//     AuditLog surovin, brez cen/zapisov, ki niso namenjeni portalu).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  checkRate,
} from '@/lib/rate-limit'
import {
  MIN_TOKEN_LENGTH,
  PORTAL_LIMIT,
  clientIpOf,
  hashIp,
  logPortalAccess,
  portalValidity,
} from '@/lib/portal'

const COMPANY = {
  ime: 'Roksal d.o.o. Kranj',
  telefon: '+386 4 237 05 50',
  email: 'info@roksal.si',
  naslov: 'Struževo 65, 4000 Kranj',
  website: 'www.roksal.si',
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ipHash = hashIp(clientIpOf(request))
  const userAgent = request.headers.get('user-agent')

  // §7: shared rate limit — PRVI vrsta, pred bazo (pošteno tudi do baze).
  const rate = checkRate(`portal:${ipHash}`, PORTAL_LIMIT)
  if (!rate.ok) {
    await logPortalAccess({ projectId: null, status: 'RATE_LIMITED', ipHash, userAgent })
    return NextResponse.json(
      { error: 'Preveč zahtevkov', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    )
  }

  try {
    const { token } = await params

    if (!token || token.length < MIN_TOKEN_LENGTH) {
      await logPortalAccess({ projectId: null, status: 'INVALID', ipHash, userAgent })
      return NextResponse.json(
        { error: 'Stran ni na voljo', code: 'PORTAL_UNAVAILABLE' },
        { status: 404 },
      )
    }

    // Minimalna izbira (§7: minimalni DTO) — ne `include`, ampak `select`.
    const project = await db.project.findUnique({
      where: { clientToken: token },
      select: {
        id: true,
        nazivProjekta: true,
        status: true,
        datumMontaze: true,
        estimatedPrice: true,
        clientNotes: true,
        clientPortalEnabled: true,
        clientTokenExpiresAt: true,
        clientTokenRevokedAt: true,
        customer: { select: { ime: true, naslov: true } },
        photos: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            kategorija: true,
            imageData: true,
            storageKey: true,
            mime: true,
            opomba: true,
            createdAt: true,
          },
        },
        // Timeline: samo kurirana polja (§7: brez internih AuditLog surovin —
        // v javni odgovor gre izpeljan naslov/opis, nikoli surovi zapis).
        auditLogs: {
          orderBy: { timestamp: 'asc' as const },
          take: 50,
          select: { akcija: true, oldValue: true, newValue: true, timestamp: true },
        },
      },
    })

    if (!project) {
      await logPortalAccess({ projectId: null, status: 'NOT_FOUND', ipHash, userAgent })
      return notFoundResponse()
    }

    const validity = portalValidity(project)
    if (validity !== 'OK') {
      await logPortalAccess({ projectId: project.id, status: validity, ipHash, userAgent })
      return notFoundResponse()
    }

    // Zadnji uspešen dostop — telemetrija za pisarno (best-effort).
    void db.project
      .update({ where: { id: project.id }, data: { clientTokenLastUsedAt: new Date() } })
      .catch((error: unknown) => console.error('[portal] lastUsed ni posodobljen:', error))
    await logPortalAccess({ projectId: project.id, status: 'OK', ipHash, userAgent })

    // Razdeli slike po kategorijah (samo meta + zapuščinski imageData;
    // zapisi z storageKey v JSON ruti NE prenašajo bajtov — stran /portal
    // jih hydrata strežniško prek getObject).
    const byCategory = (kat: string) =>
      project.photos
        .filter((p) => p.kategorija === kat)
        .map((p) => ({
          imageData: p.imageData,
          hasStorage: Boolean(p.storageKey),
          opomba: p.opomba,
          createdAt: p.createdAt.toISOString(),
        }))

    const statusAkcie = project.auditLogs.filter((a) =>
      ['CREATE_PROJECT', 'STATUS_CHANGE', 'PORTAL_ENABLE', 'PORTAL_REGENERATE'].includes(a.akcija)
    )

    const timeline = statusAkcie
      .map((a) => {
        let title = a.akcija
        let description = ''
        try {
          if (a.akcija === 'CREATE_PROJECT' && a.newValue) {
            const v = JSON.parse(a.newValue) as { nazivProjekta?: string }
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
          // Pokvarjen audit zapis ne poruši stranke stranki.
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
      photos: {
        PRED: byCategory('PRED'),
        MED: byCategory('MED'),
        PO: byCategory('PO'),
      },
      timeline,
      company: COMPANY,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Portal [token] GET Error:', error)
    return NextResponse.json(
      { error: 'Napaka pri nalaganju portala', code: 'SERVER_ERROR' },
      { status: 500 },
    )
  }
}

/** §7: vsa neveljavna stanja = ISTA 404 (enumeration protection). */
function notFoundResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Stran ni na voljo', code: 'PORTAL_UNAVAILABLE' },
    { status: 404 },
  )
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
