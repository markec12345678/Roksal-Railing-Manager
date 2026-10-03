// Roksal Field - API: Kalkulator
// R150 (§32–34 engineering/versioning): POST teče skozi inženirske ovojnice
// (lib/calc-engineering) — fail-closed validacija območja umerjenosti ZAPE
// pred izračunom (Infinity/NaN/izven mej → 400 z eksplicitnimi napakami,
// NIČ tihega nonsensa), odgovor nosi verzijo formule + deterministični
// prstni odtis vhodov (reproducibilnost). GET = register formul (odkritje
// verzij za audite; anon → 401 kot povsod).
// R393 (issue #13 §15 — LOČITEV): VSAK uspešen odgovor nosi razred
// 'INFORMATIVNO' + opozorilo ENega vira (lib/engineering-rules
// SKLADNOST_OPOZORILO) — informativni inženirski izračun je JASNO ločen od
// uradnega projektantskega/statističnega preverjanja. DODATNA polja —
// izračuni/determinizem (§1 temelji) so NESPREMENJENI.
import { NextResponse } from 'next/server'
import {
  runRailingCalcV1,
  runAnchoringCalcV1,
  runWindCalcV1,
  CALC_FORMULA_VERSIONS,
  CALC_CALIBRATION,
  type CalcType,
} from '@/lib/calc-engineering'
import { railingCalcSchema, anchoringCalcSchema, windLoadCalcSchema } from '@/lib/validations'
import { authenticate, unauthorized } from '@/lib/auth'
import { preberiJsonTelo } from '@/lib/api-telo'

import { zapisOmejitev } from '@/lib/rate-limit'
import { SKLADNOST_OPOZORILO } from '@/lib/engineering-rules'
export async function GET(request: Request) {
  // Zaščita: brez veljavne seje ali API ključa ni dostopa.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  const formulas = (Object.keys(CALC_FORMULA_VERSIONS) as CalcType[]).map((type) => ({
    type,
    formulaVersion: CALC_FORMULA_VERSIONS[type],
    calibration: CALC_CALIBRATION[type],
  }))
  return NextResponse.json({
    formulas,
    determinism: 'isti vhod + ista verzija formule = isti rezultat in isti odtis',
    // R393 §15 — ločitev informativnega izračuna od uradne preverbe.
    razred: 'INFORMATIVNO' as const,
    opozorilo: SKLADNOST_OPOZORILO,
  })
}

export async function POST(request: Request) {
  // R190 — val 1 omejevanja hitrosti na pisanju (WRITE_LIMIT, kind `write`)
  const zavrnjeno = zapisOmejitev(request, 'calculator')
  if (zavrnjeno) return zavrnjeno
  // Zaščita: brez veljavne seje ali API ključa ni dostopa do podatkov.
  const auth = await authenticate(request)
  if (!auth) return unauthorized()
  try {
    // R308 meja (R309: EN VIR — src/lib/api-telo): pokvarjen/manjkajoč JSON
    // je NAPAKA ODJEMALCA (400), ne strežnika (500) — guard PRED uporabo
    // (brez tihega 500 v monitoring; kanon ovojnice { error }).
    const telo = await preberiJsonTelo(request)
    if (!telo.ok) return telo.odgovor
    const body = telo.telo
    const { type } = body

    switch (type) {
      case 'railing': {
        const validated = railingCalcSchema.parse(body)
        const envelope = runRailingCalcV1(validated)
        if (!envelope.ok) {
          return NextResponse.json(
            { error: 'Inženirska validacija ni uspela', errors: envelope.errors },
            { status: 400 },
          )
        }
        return NextResponse.json({
          ...envelope.result,
          formulaVersion: envelope.formulaVersion,
          inputHash: envelope.inputHash,
          // R393 §15 — ločitev informativnega izračuna od uradne preverbe.
          razred: 'INFORMATIVNO' as const,
          opozorilo: SKLADNOST_OPOZORILO,
        })
      }
      case 'anchoring': {
        const validated = anchoringCalcSchema.parse(body)
        const envelope = runAnchoringCalcV1(validated)
        if (!envelope.ok) {
          return NextResponse.json(
            { error: 'Inženirska validacija ni uspela', errors: envelope.errors },
            { status: 400 },
          )
        }
        return NextResponse.json({
          ...envelope.result,
          formulaVersion: envelope.formulaVersion,
          inputHash: envelope.inputHash,
          // R393 §15 — ločitev informativnega izračuna od uradne preverbe.
          razred: 'INFORMATIVNO' as const,
          opozorilo: SKLADNOST_OPOZORILO,
        })
      }
      case 'wind': {
        const validated = windLoadCalcSchema.parse(body)
        const envelope = runWindCalcV1(validated)
        if (!envelope.ok) {
          return NextResponse.json(
            { error: 'Inženirska validacija ni uspela', errors: envelope.errors },
            { status: 400 },
          )
        }
        return NextResponse.json({
          ...envelope.result,
          formulaVersion: envelope.formulaVersion,
          inputHash: envelope.inputHash,
          // R393 §15 — ločitev informativnega izračuna od uradne preverbe.
          razred: 'INFORMATIVNO' as const,
          opozorilo: SKLADNOST_OPOZORILO,
        })
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
