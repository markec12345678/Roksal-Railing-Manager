// Roksal Field - API: CRM modul (V4.2)
// GET  /api/crm           — seznam strank z LTV, št. projektov, status, opomniki
// GET  /api/crm?id=X      — podrobnosti stranke z zgodovino projektov
// PATCH /api/crm          — posodobi CRM polja (status, opomnik, kontaktna oseba, opombe)
//
// R156 (P1 fix + utrjanje PATCH): prej je PATCH preveril SAMO prijavo — vsak
// avtenticiran principal (tudi SKLADISCE in API ključ!) je lahko prepisal CRM
// polja KATERE KOLI stranke. Zdaj isti vrata kot POST /api/customers:
// canManageCustomers (matrika §10 — MONTER+ ima customers.write, SKLADISCE
// samo read, apikey nima nič). Poleg tega:
//   • status je STROGO enum (AKTIVEN|NEAKTIVEN|POTENCIALEN|ARHIVIRAN) — prej
//     je bil poljuben niz zapisan v bazo (pokvarjeni filter v GET);
//   • datumi so STROGO parsani — neveljaven zapis → 400 (prej tihi Prisma 500
//     ALI Invalid Date);
//   • besedilna polja imajo stripe (isti prag kot UI maxLength) — patološki
//     vnosi ne morejo napreti bazo;
//   • revizija nosi PRAVEGA akterja (seja) + oldValue (prej: userId 'system'
//     brez oldValue — sled ni bila pripisljiva).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { canManageCustomers, actorIdOf } from '@/lib/access'

const CRM_STATUSI = ['AKTIVEN', 'NEAKTIVEN', 'POTENCIALEN', 'ARHIVIRAN'] as const
const MAX_KONTAKTNA = 120
const MAX_KATEGORIJA = 80
const MAX_OPOMNIK_OPIS = 300
const MAX_OPOMBE = 2000

/**
 * R156: stroga (fail-closed) pretvorba neobveznega datumskega polja.
 * undefined = polje NI v zahtevku (ne spreminjaj); null = počisti;
 * niz = ISO ali parsably datum, sicer null → klicatelj vrne 400.
 */
function parseOptionalDate(
  raw: unknown,
  field: string,
): { ok: true; value: Date | null | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined }
  if (raw === null) return { ok: true, value: null }
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, error: `Polje "${field}" mora biti ISO datum ali null` }
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `Polje "${field}" ni veljaven datum` }
  }
  return { ok: true, value: d }
}

/** Stroga (fail-closed) pretvorba neobveznega besedilnega polja s stropom. */
function parseOptionalText(
  raw: unknown,
  field: string,
  max: number,
): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined }
  if (raw === null) return { ok: true, value: null }
  if (typeof raw !== 'string') {
    return { ok: false, error: `Polje "${field}" mora biti niz ali null` }
  }
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { ok: true, value: null }
  if (trimmed.length > max) {
    return { ok: false, error: `Polje "${field}" presega ${max} znakov` }
  }
  return { ok: true, value: trimmed }
}

// GET — seznam strank z CRM podatki
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const status = searchParams.get('status') // AKTIVEN | NEAKTIVEN | POTENCIALEN | ARHIVIRAN
    const opomniki = searchParams.get('opomniki') === 'true' // samo z opomniki

    if (id) {
      // Podrobnosti ene stranke z zgodovino projektov
      const customer = await db.customer.findUnique({
        where: { id },
        include: {
          projects: {
            select: {
              id: true,
              nazivProjekta: true,
              status: true,
              dealLocked: true,
              dealLockedAt: true,
              estimatedPrice: true,
              createdAt: true,
              datumMontaze: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!customer) {
        return NextResponse.json({ error: 'Stranka ni najdena' }, { status: 404 })
      }

      // Izračunaj LTV (Life Time Value)
      const ltv = customer.projects.reduce((sum, p) => sum + (p.estimatedPrice || 0), 0)
      const zaklenjeniProjekti = customer.projects.filter(p => p.dealLocked).length

      return NextResponse.json({
        ...customer,
        ltv,
        zaklenjeniProjekti,
        skupajProjektov: customer.projects.length,
      })
    }

    // Seznam vseh strank z CRM podatki
    const where = {
      ...(status ? { status } : {}),
      ...(opomniki ? { opomnikDatum: { not: null } } : {}),
    }

    const customers = await db.customer.findMany({
      where,
      include: {
        projects: {
          select: {
            id: true,
            estimatedPrice: true,
            dealLocked: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Obogatite z LTV, št. projektov, opomnik status
    const enriched = customers.map((c) => {
      const ltv = c.projects.reduce((sum, p) => sum + (p.estimatedPrice || 0), 0)
      const zaklenjeni = c.projects.filter((p) => p.dealLocked).length
      const zadnjiProjekt = c.projects[0]?.createdAt || null

      // Opomnik status
      let opomnikStatus: 'NI' | 'AKTIVEN' | 'POTEKEL' = 'NI'
      if (c.opomnikDatum) {
        const days = Math.floor((c.opomnikDatum.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (days < 0) opomnikStatus = 'POTEKEL'
        else if (days <= 7) opomnikStatus = 'AKTIVEN'
      }

      return {
        id: c.id,
        ime: c.ime,
        naslov: c.naslov,
        telefon: c.telefon,
        email: c.email,
        status: c.status,
        kontaktnaOseba: c.kontaktnaOseba,
        kategorija: c.kategorija,
        opomnikDatum: c.opomnikDatum,
        opomnikOpis: c.opomnikOpis,
        zadnjiKontakt: c.zadnjiKontakt,
        opombeCRM: c.opombeCRM,
        createdAt: c.createdAt,
        ltv,
        zaklenjeni,
        skupajProjektov: c.projects.length,
        zadnjiProjekt,
        opomnikStatus,
      }
    })

    // Statistike
    const stats = {
      skupno: enriched.length,
      aktivni: enriched.filter((c) => c.status === 'AKTIVEN').length,
      neaktivni: enriched.filter((c) => c.status === 'NEAKTIVEN').length,
      potencialni: enriched.filter((c) => c.status === 'POTENCIALEN').length,
      zOpomniki: enriched.filter((c) => c.opomnikStatus !== 'NI').length,
      potekliOpomniki: enriched.filter((c) => c.opomnikStatus === 'POTEKEL').length,
      skupniLTV: enriched.reduce((sum, c) => sum + c.ltv, 0),
    }

    return NextResponse.json({
      customers: enriched,
      stats,
    })
  } catch (error) {
    console.error('CRM GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju CRM podatkov' }, { status: 500 })
  }
}

// PATCH — posodobi CRM polja stranke
export async function PATCH(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  // R156: CRM pisanje = customers.write (isti prag kot POST /api/customers).
  // Prej: SAMO prijava — SKLADISCE in API ključ sta lahko prepisala CRM.
  if (!canManageCustomers(auth)) {
    return NextResponse.json(
      { error: 'CRM urejajo uporabniki s pravico customers.write (prijava).' },
      { status: 403 },
    )
  }
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const id = typeof body?.id === 'string' ? body.id : null
    if (!body || !id) {
      return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })
    }
    if (body.status !== undefined && body.status !== null) {
      if (typeof body.status !== 'string' || !(CRM_STATUSI as readonly string[]).includes(body.status)) {
        return NextResponse.json(
          { error: `Neveljaven status: dovoljene vrednosti so ${CRM_STATUSI.join(', ')}` },
          { status: 400 },
        )
      }
    }
    const opomnikDatum = parseOptionalDate(body.opomnikDatum, 'opomnikDatum')
    if (!opomnikDatum.ok) return NextResponse.json({ error: opomnikDatum.error }, { status: 400 })
    const zadnjiKontakt = parseOptionalDate(body.zadnjiKontakt, 'zadnjiKontakt')
    if (!zadnjiKontakt.ok) return NextResponse.json({ error: zadnjiKontakt.error }, { status: 400 })
    const kontaktnaOseba = parseOptionalText(body.kontaktnaOseba, 'kontaktnaOseba', MAX_KONTAKTNA)
    if (!kontaktnaOseba.ok) return NextResponse.json({ error: kontaktnaOseba.error }, { status: 400 })
    const kategorija = parseOptionalText(body.kategorija, 'kategorija', MAX_KATEGORIJA)
    if (!kategorija.ok) return NextResponse.json({ error: kategorija.error }, { status: 400 })
    const opomnikOpis = parseOptionalText(body.opomnikOpis, 'opomnikOpis', MAX_OPOMNIK_OPIS)
    if (!opomnikOpis.ok) return NextResponse.json({ error: opomnikOpis.error }, { status: 400 })
    const opombeCRM = parseOptionalText(body.opombeCRM, 'opombeCRM', MAX_OPOMBE)
    if (!opombeCRM.ok) return NextResponse.json({ error: opombeCRM.error }, { status: 400 })

    // R156: revizija z oldValue — preberemo stanje PRED spremembo (fail-closed:
    // neznana stranka → 404, brez lažnega 'uspeha').
    const before = await db.customer.findUnique({
      where: { id },
      select: {
        status: true,
        kontaktnaOseba: true,
        opomnikDatum: true,
        opomnikOpis: true,
        zadnjiKontakt: true,
        opombeCRM: true,
        kategorija: true,
      },
    })
    if (!before) {
      return NextResponse.json({ error: 'Stranka ne obstaja' }, { status: 404 })
    }

    const updated = await db.customer.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status as string } : {}),
        ...(kontaktnaOseba.value !== undefined ? { kontaktnaOseba: kontaktnaOseba.value } : {}),
        ...(opomnikDatum.value !== undefined ? { opomnikDatum: opomnikDatum.value } : {}),
        ...(opomnikOpis.value !== undefined ? { opomnikOpis: opomnikOpis.value } : {}),
        ...(zadnjiKontakt.value !== undefined ? { zadnjiKontakt: zadnjiKontakt.value } : {}),
        ...(opombeCRM.value !== undefined ? { opombeCRM: opombeCRM.value } : {}),
        ...(kategorija.value !== undefined ? { kategorija: kategorija.value } : {}),
      },
    })

    // R156: revizija z oldValue + APPLIED values (§19 vzorec — newValue nosi
    // dejanske nove vrednosti, ne samo imen polj; prej: userId 'system', brez
    // oldValue, brez vsebine spremembe — sled ni bila pripisljiva).
    const spremembe: Record<string, unknown> = {}
    if (body.status !== undefined) spremembe.status = body.status
    if (kontaktnaOseba.value !== undefined) spremembe.kontaktnaOseba = kontaktnaOseba.value
    if (opomnikDatum.value !== undefined) spremembe.opomnikDatum = opomnikDatum.value
    if (opomnikOpis.value !== undefined) spremembe.opomnikOpis = opomnikOpis.value
    if (zadnjiKontakt.value !== undefined) spremembe.zadnjiKontakt = zadnjiKontakt.value
    if (opombeCRM.value !== undefined) spremembe.opombeCRM = opombeCRM.value
    if (kategorija.value !== undefined) spremembe.kategorija = kategorija.value

    // AuditLog — R156: pravi akter (seja) + oldValue/newValue.
    await db.auditLog.create({
      data: {
        userId: actorIdOf(auth),
        akcija: 'CRM_UPDATE',
        oldValue: JSON.stringify(before),
        newValue: JSON.stringify({ customerId: id, spremembe }),
      },
    })

    return NextResponse.json({ success: true, customer: updated })
  } catch (error) {
    console.error('CRM PATCH Error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju CRM' }, { status: 500 })
  }
}
