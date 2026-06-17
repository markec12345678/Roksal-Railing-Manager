// Roksal Field - API: Katalog profilov ograj
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Vsi profili (ali samo aktivni)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const samoAktivne = searchParams.get('aktivne') !== 'false'
    const kategorija = searchParams.get('kategorija')

    const profili = await db.profil.findMany({
      where: {
        ...(samoAktivne ? { aktivna: true } : {}),
        ...(kategorija ? { kategorija } : {}),
      },
      orderBy: { naziv: 'asc' },
    })
    return NextResponse.json(profili)
  } catch (error) {
    console.error('Profili GET Error:', error)
    return NextResponse.json({ error: 'Napaka pri branju profilov' }, { status: 500 })
  }
}

// POST - Ustvari nov profil (admin)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const profil = await db.profil.create({
      data: {
        sifra: body.sifra,
        naziv: body.naziv,
        material: body.material,
        kategorija: body.kategorija,
        visinaMm: body.visinaMm ?? 1100,
        sirinaMm: body.sirinaMm ?? 140,
        cenaM: body.cenaM,
        barvaRal: body.barvaRal ?? null,
        slikaUrl: body.slikaUrl ?? null,
      },
    })
    return NextResponse.json(profil, { status: 201 })
  } catch (error) {
    console.error('Profili POST Error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju profila' }, { status: 500 })
  }
}
