// Roksal Field - API: Signature Audit (V4.1)
// GET /api/signature-audit?projectId=X — pridobi audit trail podpisov za projekt
// R122: podpisi živijo v object storage (R121 vzorec) — meta seznam vrača
// signatureUrl (/api/files/… proxy), "full" branje hidrira data URI iz
// storage (zapuščinski base6 zapisi ostanejo branljivi).
//
// R395 (issue #13, korak R172, §16 — "signature audit DTO ne sme vračati
// nepotrebnih občutljivih polj"): ALLOWLIST kanon deal-lock GET (§17) je
// zdaj ŠE na tej ruti — iz DTO-jev (seznam IN detajl) so ODSTRANJENA polja
// ipAddress/userAgent/deviceFingerprint/geoLatitude/geoLongitude (v BAZI
// ostanejo — revizijska sled NI izbrisana; dostop po potrebi = DBA/audit
// plast, ne aplikacijski API). DODANA pa je §16 veriga: quoteVersionId +
// bomVersionId + documentVersionId (vidljivost verige dokumenta).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError, lacksPermission } from '@/lib/access'
import { getObject, objectUrlFor } from '@/lib/object-storage'

import { zapisOmejitev } from '@/lib/rate-limit'
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

    // R395 §17 (IDOR fix — isti kanon kot deal-lock GET R374): prej je ta
    // ruta preverjala SAMO prijavo — vsak avtenticiran uporabnik je bral
    // podpisno sled TUJEGA projekta. Zdaj: vrata na ravni vira ('read').
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, monterId: true, vodjaId: true, dealLocked: true },
    })
    assertProjectAccess(auth, project, 'read')
    if (!project) {
      return NextResponse.json({ error: 'Projekt ni najden' }, { status: 404 })
    }

    const audits = await db.signatureAudit.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        // §16/§17 ALLOWLIST (isti kanon kot deal-lock GET): BREZ ipAddress/
        // userAgent/deviceFingerprint/geoLatitude/geoLongitude/signatureImage/
        // storageKey/sha256 — z VERIGO (quote/bom/dokument verzije).
        id: true,
        signatureType: true,
        signedByName: true,
        signedByRole: true,
        isValid: true,
        quoteVersionId: true,
        quoteInputHash: true,
        bomVersionId: true,
        documentVersionId: true,
        pdfHash: true,
        createdAt: true,
        // Samo za izpeljavo signatureUrl (iz dto izključeno spodaj):
        storageKey: true,
        signatureImage: true,
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
      // §16 veriga (vidljivost, ne občutljivost):
      quoteVersionId: a.quoteVersionId,
      bomVersionId: a.bomVersionId,
      documentVersionId: a.documentVersionId,
      pdfHash: a.pdfHash,
      isValid: a.isValid,
      createdAt: a.createdAt,
    }))

    return NextResponse.json({
      projectId,
      auditCount: audits.length,
      audits: auditsMeta,
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Signature Audit GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju audit trail-a' }, { status: 500 })
  }
}

// GET s ?id=X&full=true — pridobi posamezni podpis (s sliko)
export async function POST(request: Request) {
  // R191 — val 2 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'signature-audit')
  if (zavrnjeno) return zavrnjeno

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

    // §16 (R395) MINIMALNI detajl DTO: prej `...audit` (surova vrstica —
    // VSA občutljiva polja). Allowlist: ista kot seznam + hidrirana slika.
    return NextResponse.json({
      id: audit.id,
      projectId: audit.projectId,
      signatureType: audit.signatureType,
      signedByName: audit.signedByName,
      signedByRole: audit.signedByRole,
      hasSignature: !!(audit.signatureImage || audit.storageKey),
      signatureImage: signatureData,
      storageMissing,
      mime: audit.mime,
      sizeBytes: audit.sizeBytes,
      // §16 veriga (vidljivost, ne občutljivost):
      quoteVersionId: audit.quoteVersionId,
      quoteInputHash: audit.quoteInputHash,
      bomVersionId: audit.bomVersionId,
      documentVersionId: audit.documentVersionId,
      pdfHash: audit.pdfHash,
      isValid: audit.isValid,
      createdAt: audit.createdAt,
    })
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Signature Audit POST Error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
