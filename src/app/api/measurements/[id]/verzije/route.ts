// Roksal Field - API: Zgodovina verzij meritve — R276 (issue #16 §6;
// register #17-E). Celotna veriga korekcij ene meritve: v1 → v2 → v3 …
// z deltami ('kaj se je spremenilo'), virom, statusom in aktivno verzijo.
//
// Semantične odločitve O1–O9: docs/MEASUREMENT-HISTORY.md (zapisane PRED
// razvojem). Jedro:
//   • veriga = {OR [{id: korenId}, {korenId: korenId}]} — O(1) fetch po
//     korenskem indeksu (koren = vrstica z korenId null; vsaka naslednica
//     nosi korenId korena — O3);
//   • vrstni red DETERMINISTIČEN: verzija ASC (null = legacy koren — prva,
//     PostgreSQL NULLS FIRST), kravata createdAt ASC;
//   • delti med sosedi v verigi (nova − stara, cela števila mm — O6);
//   • aktivna verzija = najvišja verzija, če ni ARHIVIRANA; sicer iskrena
//     praznina (nikoli padec nazaj — O5);
//   • dostop = isti vrata kot branje meritev projekta (401/403/404
//     fail-closed); brez paginacije — veriga je po O4 enojna in kratka
//     (predhodnikId UNIQUE = največ en naslednik na verzijo).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, unauthorized } from '@/lib/auth'
import { assertProjectAccess, AccessDeniedError } from '@/lib/access'
import { aktivnaVerzijaIzVerige } from '@/lib/meritev-verzije'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    const { id } = await params
    const meritev = await db.measurement.findUnique({ where: { id } })
    if (!meritev) {
      return NextResponse.json({ error: 'Meritev ne obstaja' }, { status: 404 })
    }

    // Dostop do verzij = dostop do projekta (403 na tuj projekt, 404 neznano).
    const project = await db.project.findUnique({ where: { id: meritev.projectId } })
    if (!project) throw new AccessDeniedError(404, 'Projekt ne obstaja')
    assertProjectAccess(auth, project, 'read')

    // O3: koren verige — meritev sama, če je koren (korenId null), sicer
    // korenId, ki ga nosi vsaka naslednica verige.
    const korenId = meritev.korenId ?? meritev.id
    const veriga = await db.measurement.findMany({
      where: { OR: [{ id: korenId }, { korenId }] },
      orderBy: [{ verzija: 'asc' }, { createdAt: 'asc' }],
    })

    // O6 — delti med sosedi (prva vrstica verige = brez delte → null,
    // iskrena praznina, ne nič).
    const verzije = veriga.map((v, i) => ({
      id: v.id,
      verzija: v.verzija,
      vir: v.vir,
      status: v.status,
      dolzinaMm: v.dolzinaMm,
      visinaMm: v.visinaMm,
      predhodnikId: v.predhodnikId,
      createdAt: v.createdAt.toISOString(),
      deltaDolzinaMm: i > 0 ? v.dolzinaMm - veriga[i - 1].dolzinaMm : null,
      deltaVisinaMm: i > 0 ? v.visinaMm - veriga[i - 1].visinaMm : null,
    }))

    // O5 — aktivna verzija (najvišja; ARHIVIRANA zadnja = iskrena praznina).
    const aktivna = aktivnaVerzijaIzVerige(veriga)

    return NextResponse.json({
      korenId,
      aktivnaId: aktivna?.id ?? null,
      aktivnaVerzija: aktivna?.verzija ?? null,
      steviloVerzij: veriga.length,
      verzije,
    })
  } catch (error: unknown) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Measurement verzije GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju zgodovine verzij' }, { status: 500 })
  }
}
