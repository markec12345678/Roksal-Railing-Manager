// Roksal Field - API: Signature Audit (V4.1)
// GET /api/signature-audit?projectId=X — pridobi audit trail podpisov za projekt
// R122: podpisi živijo v object storage (R121 vzorec) — meta seznam vrača
// signatureUrl (/api/files/… proxy), "full" branje hidrira data URI iz
// storage (zapuščinski base6 zapisi ostanejo branljivi).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError, lacksPermission } from '@/lib/access'
import { getObject, objectUrlFor } from '@/lib/object-storage'

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

    const audits = await db.signatureAudit.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: { nazivProjekta: true, customer: { select: { ime: true, naslov: true } } },
        },
      },
    })

    // Ne vračaj signatureImage v seznamu (preveliko) — samo metadata + URL.
    const auditsMeta = audits.map((a) => ({
      id: a.id,
      signatureType: a.signatureType,
      signedByName: a.signedByName,
      signedByRole: a.signedByRole,
      hasSignature: !!(a.signatureImage || a.storageKey),
      signatureUrl: a.storageKey ? objectUrlFor(a.storageKey) : null,
      storageMode: a.storageKey ? 'object-storage' : a.signatureImage ? 'legacy-base64' : 'none',
      ipAddress: a.ipAddress,
      userAgent: a.userAgent,
      deviceFingerprint: a.deviceFingerprint,
      geoLatitude: a.geoLatitude,
      geoLongitude: a.geoLongitude,
      pdfHash: a.pdfHash,
      isValid: a.isValid,
      createdAt: a.createdAt,
      project: a.project,
    }))

    return NextResponse.json({
      projectId,
      auditCount: audits.length,
      audits: auditsMeta,
    })
  } catch (error) {
    console.error('Signature Audit GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju audit trail-a' }, { status: 500 })
  }
}

// GET s ?id=X&full=true — pridobi posamezni podpis (s sliko)
export async function POST(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // §10 (R135): podpis = documents.sign (teren podpisuje, servis ključ ne).
  if (lacksPermission(auth, 'documents.sign')) {
    return NextResponse.json(
      { error: 'Podpisovanje dokumentov zahteva pravico documents.sign.' },
      { status: 403 }
    )
  }
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    }

    const audit = await db.signatureAudit.findUnique({
      where: { id },
    })

    if (!audit) {
      return NextResponse.json({ error: 'Audit entry ni najden' }, { status: 404 })
    }

    // R122: avtorizacija — podpis je projektni vir (isti pristop kot /api/files).
    const project = await db.project.findUnique({
      where: { id: audit.projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')

    // Hidratacija: object storage → data URI; zapuščinski base6 ostane.
    let signatureData: string | null = audit.signatureImage
    let storageMissing = false
    if (!signatureData && audit.storageKey) {
      const bytes = await getObject(audit.storageKey)
      if (bytes) {
        signatureData = `data:${audit.mime ?? 'image/png'};base64,${bytes.toString('base64')}`
      } else {
        storageMissing = true // iskreno: ne fabriciraj slike
      }
    }

    return NextResponse.json({ ...audit, signatureImage: signatureData, storageMissing })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Signature Audit POST Error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
