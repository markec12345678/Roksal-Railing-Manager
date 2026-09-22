// Roksal — razpored ograje po izmerjenem obsegu
// ---------------------------------------------------------------------------
// Most med tlorisom/izmero in delavnico. Vrne lege stebrov, širine panelov,
// dolžine letev s koti žage, rezalni seznam in opozorila — vse iz ENEGA izračuna,
// zato se risba, kosovnica in naročilo ne morejo razhajati.
//
// Uporabljajo ga lahko: floor-plan-tab (iz narisanih zidov), measurements-tab
// (po izmerjenih robovih), bom-draft in mobilni klient.
//
// POST body:
//   {
//     points: [{ xM, yM, zM }],      // metri; prvi rob naj gre vzdolž +X
//     closed: boolean,
//     overridesMm?: { "0": 4050 },   // popravek s trakom po indeksu roba
//     spec?: Partial<RailingSpec>    // kar ni podano, pride iz defaultRailingSpec()
//   }

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, unauthorized } from '@/lib/auth'
import { auditAsync } from '@/lib/audit'
import {
  anchorCount,
  cornerCount,
  cutList,
  defaultRailingSpec,
  freeEndCount,
  layoutRailing,
  mergeSpec,
  perimeterOf,
  summarise,
  totalRunMm,
  type Vec3,
} from '@/lib/railing-layout'
import { railingLayoutSchema } from '@/lib/validations'

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()

  try {
    const body = await request.json().catch(() => null)
    const parsed = railingLayoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Neveljavni podatki', detail: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 },
      )
    }
    const { points, closed, overridesMm, spec: specOverride } = parsed.data

    // Uporabnikova konfiguracija se zlije s privzeto — mobilni klient lahko pošlje
    // samo tisto, kar je spremenil.
    // mergeSpec, ne plitvo zlivanje: klient, ki pošlje samo { glass: { thicknessMm: 12 } },
    // ne sme s tem izbrisati tipa stekla in največje širine panela.
    const spec = mergeSpec(specOverride ?? {})
    const vecs: Vec3[] = points.map((p) => ({ x: p.xM, y: p.yM ?? 0, z: p.zM }))
    const perimeter = perimeterOf(vecs, closed, overridesMm ?? {})
    const layout = layoutRailing(perimeter, spec)

    if (auth.kind === 'user') {
      auditAsync({
        request,
        session: auth.session,
        akcija: 'RAILING_LAYOUT',
        newValue: { edges: layout.edges.length, posts: layout.posts.length, panels: layout.panels.length, runMm: totalRunMm(layout) },
      })
    }

    return NextResponse.json({
      layout,
      cutList: cutList(layout),
      summary: {
        ...summarise(layout, spec),
        anchorCount: anchorCount(layout, spec),
        cornerCount: cornerCount(layout),
        freeEndCount: freeEndCount(layout),
      },
      spec,
    })
  } catch (error) {
    console.error('Railing layout POST error:', error)
    return NextResponse.json({ error: 'Napaka pri izračunu razporeda' }, { status: 500 })
  }
}

// GET vrne privzeto konfiguracijo — vmesnik jo rabi za začetno stanje obrazca.
export async function GET(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  return NextResponse.json({ spec: defaultRailingSpec() })
}
