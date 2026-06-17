// Roksal Field - API: Kalkulator
import { NextResponse } from 'next/server'
import { calculateRailingSpacing, calculateAnchoring, calculateWindLoad } from '@/lib/calculator'
import { railingCalcSchema, anchoringCalcSchema, windLoadCalcSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type } = body

    switch (type) {
      case 'railing': {
        const validated = railingCalcSchema.parse(body)
        const result = calculateRailingSpacing(validated)
        return NextResponse.json(result)
      }
      case 'anchoring': {
        const validated = anchoringCalcSchema.parse(body)
        const result = calculateAnchoring(validated)
        return NextResponse.json(result)
      }
      case 'wind': {
        const validated = windLoadCalcSchema.parse(body)
        const result = calculateWindLoad(validated)
        return NextResponse.json(result)
      }
      default:
        return NextResponse.json({ error: 'Neznan tip izračuna. Uporabite: railing, anchoring, wind' }, { status: 400 })
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json({ error: 'Neveljavni podatki', details: (error as { issues: unknown }).issues }, { status: 400 })
    }
    console.error('Calculator Error:', error)
    return NextResponse.json({ error: 'Napaka pri izračunu' }, { status: 500 })
  }
}
