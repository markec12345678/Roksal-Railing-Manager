// Roksal Field - API: Signature Audit (V4.1)
// GET /api/signature-audit?projectId=X — pridobi audit trail podpisov za projekt
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
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

    // Ne vračaj signatureImage v seznamu (preveliko) — samo metadata
    const auditsMeta = audits.map((a) => ({
      id: a.id,
      signatureType: a.signatureType,
      signedByName: a.signedByName,
      signedByRole: a.signedByRole,
      hasSignature: !!a.signatureImage,
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

    return NextResponse.json(audit)
  } catch (error) {
    console.error('Signature Audit POST Error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
