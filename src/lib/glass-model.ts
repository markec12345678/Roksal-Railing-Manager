// Roksal Railing Manager — model steklene ograje
// ---------------------------------------------------------------------------
// Izločeno iz src/lib/calculator.ts, ker je bil tam račun fizikalno napačen in
// ker si zasluži svoje teste (src/lib/__tests__/glass-model.test.ts).
// `calculator.ts` ga re-izvozi, zato vsi obstoječi uvozi
// `import { calculateGlassBalustrade } from '@/lib/calculator'` delujejo naprej.
//
// ## Kaj je bilo narobe s starim računom
// Stara formula je bila `σ = 6·w·L²/(8·t²)`:
//   - `L` je bil **vodoravni razpon** med stebri,
//   - `w` je bila **linijska obtežba z vrha ograje** (kN/m),
//   - `t²` v imenovalcu predpostavlja pas širine 1 mm.
//
// Ta kombinacija ne ustreza nobenemu nosilnemu modelu. Linijska obtežba na vrhu
// ograje ne obremenjuje stekla po vodoravnem razponu — pri brezokvirni ograji ga
// obremenjuje po **višini** (konzola), pri sistemu s stebri pa jo prevzamejo
// **stebri**. Posledica je bila, da je funkcija za vsak vhod vrnila napetost
// 30–70× nad trdnostjo stekla:
//
//   8 mm, razpon 1200 mm, 0,5 kN/m  →  8437,5 MPa   (jeklo popusti pri ~500 MPa)
//   25 mm, razpon 1200 mm, 0,5 kN/m →   864,0 MPa
//
// in zato **vedno** vrnila `isSafe = false` ter **vedno** priporočila najdebelejše
// steklo (24/25 mm). Orodje, ki za vsak vhod reče "nevarno, vzemi najdebelejše",
// ni konservativno — je neuporabno, in stranki pove napačno ceno.
//
// ## Model, ki je zdaj notri
// Konzola (brezokvirna, U-profil), pas širine 1 mm, sila P = w na vrhu:
//   M = w·h            Z = t²/6          → σ = 6·w·h / t²
//   I = t³/12          δ = P·h³/(3·E·I)  → δ = 4·w·h³ / (E·t³)
// Dva/štirje robovi (steklo kot visok nosilec preko razpona L, globina h):
//   M = w·L²/8         Z = t·h²/6        → σ = 6·w·L² / (8·t·h²)
//   δ = 5·w·L⁴/(32·E·t·h³)               (štirje robovi: × 0,6, dvoosno delovanje)
// Plus preverba **deformacije**, ki pri ograjah praktično vedno določi debelino.
//
// Preverjeno obnašanje (0,5 kN/m, h = 1000 mm):
//   kaljeno  → 12 mm (σ = 20,8 MPa, δ = 16,5 mm ≈ h/60)
//   lepljeno → 16 mm (z faktorjem folije 1,8)
// To se ujema z izdelki na trgu (12 mm ESG oz. 16,76 mm VSG za 1 m visoko
// brezokvirno ograjo). Stara formula tega ni mogla dati za noben vhod.
//
// **Opozorilo:** poenostavljen ročni model za orientacijo. Končno dimenzioniranje
// po SIST EN 1991-1-1 (in nacionalnih dodatkih) ter z dovoljenjem proizvajalca
// sistema opravi pooblaščeni statik.

export type GlassSupport = 'cantilever' | 'twoEdges' | 'fourEdges'

export interface GlassCalcInput {
  /** Razpon med stebri (mm). Pri konzolni (brezokvirni) ograji ni nosilen. */
  spanMm: number
  /** Višina stekla (mm), navadno 1000–1100. */
  heightMm: number
  /** Horizontalna linijska obtežba na vrhu ograje (kN/m). 1 kN/m = 1 N/mm. */
  loadKnPerM: number
  glassType: 'single' | 'laminated' | 'tempered'
  /**
   * Vpetje stekla — določa nosilni model:
   * - `cantilever` (privzeto): U-profil na dnu, prosto zgoraj → brezokvirna ograja
   * - `twoEdges`: stebrički na obeh navpičnih robovih
   * - `fourEdges`: okvirjeno po vseh robovih
   */
  support?: GlassSupport
  /** Modul elastičnosti stekla (MPa). Privzeto 70 000. */
  glassEMpa?: number
  /** Mejna deformacija kot h/x oz. L/x. Privzeto 60. */
  deflectionLimitDivisor?: number
  /**
   * Faktor povečanja deformacije za lepljeno steklo (PVB folija drsi pri
   * dolgotrajni obtežbi in višji temperaturi). Privzeto 1,8 — poenostavitev;
   * pravi faktor poda proizvajalec folije, pri SGP je bistveno manjši.
   */
  laminatedDeflectionFactor?: number
}

export interface GlassCalcResult {
  recommendedThicknessMm: number
  alternativeThicknesses: Array<{ mm: number; safe: boolean; reason: string }>
  /** Vodoravni razpon, ki ga debelina še prenese po modelu visokega nosilca. */
  maxSpanForThicknessMm: number
  /** Višina konzole, ki jo debelina še prenese — merodajno za brezokvirne ograje. */
  maxHeightForThicknessMm: number
  stressMpa: number
  allowableStressMpa: number
  deflectionMm: number
  deflectionLimitMm: number
  deflectionOk: boolean
  /** Kaj je določilo debelino — pri ograjah skoraj vedno deformacija. */
  governing: 'stress' | 'deflection'
  isSafe: boolean
  layers?: number
  /** Kateri model je bil uporabljen; izpiše se uporabniku. */
  modelNote: string
  warnings: string[]
  recommendations: string[]
}

/** Dovoljene napetosti (poenostavljene projektne vrednosti — potrdi jih dobavitelj). */
const ALLOWABLE_STRESS_MPA: Record<GlassCalcInput['glassType'], number> = {
  single: 40,
  laminated: 50,
  tempered: 120,
}

const CANDIDATES: Record<
  GlassCalcInput['glassType'],
  Array<{ mm: number; layers?: number; baseMm?: number }>
> = {
  laminated: [
    { mm: 12, layers: 2, baseMm: 6 },
    { mm: 16, layers: 2, baseMm: 8 },
    { mm: 20, layers: 2, baseMm: 10 },
    { mm: 24, layers: 2, baseMm: 12 },
  ],
  tempered: [{ mm: 8 }, { mm: 10 }, { mm: 12 }, { mm: 15 }, { mm: 19 }, { mm: 22 }, { mm: 25 }],
  single: [{ mm: 8 }, { mm: 10 }, { mm: 12 }, { mm: 15 }, { mm: 19 }, { mm: 22 }, { mm: 25 }],
}

export function calculateGlassBalustrade(input: GlassCalcInput): GlassCalcResult {
  const { spanMm, heightMm, loadKnPerM, glassType } = input
  const support: GlassSupport = input.support ?? 'cantilever'
  const E = input.glassEMpa ?? 70_000
  const divisor =
    input.deflectionLimitDivisor && input.deflectionLimitDivisor > 0
      ? input.deflectionLimitDivisor
      : 60
  const laminatedFactor = input.laminatedDeflectionFactor ?? 1.8

  const warnings: string[] = []
  const recommendations: string[] = []

  const allowableStressMpa = ALLOWABLE_STRESS_MPA[glassType]
  const candidates = CANDIDATES[glassType]

  const w = Math.max(loadKnPerM, 0) // N/mm — 1 kN/m je točno 1 N/mm
  const h = Math.max(heightMm, 1) // mm
  const L = Math.max(spanMm, 1) // mm
  const twoWay = support === 'fourEdges' ? 0.6 : 1
  const deflFactor = glassType === 'laminated' ? laminatedFactor : 1

  const analyse = (t: number): { stressMpa: number; deflectionMm: number } => {
    if (t <= 0) return { stressMpa: Infinity, deflectionMm: Infinity }
    if (support === 'cantilever') {
      return {
        stressMpa: (6 * w * h) / (t * t),
        deflectionMm: ((4 * w * Math.pow(h, 3)) / (E * Math.pow(t, 3))) * deflFactor,
      }
    }
    return {
      stressMpa: (twoWay * 6 * w * L * L) / (8 * t * h * h),
      deflectionMm:
        ((twoWay * 5 * w * Math.pow(L, 4)) / (32 * E * t * Math.pow(h, 3))) * deflFactor,
    }
  }

  const deflectionLimitMm = (support === 'cantilever' ? h : L) / divisor

  const evaluated = candidates.map((c) => {
    const { stressMpa, deflectionMm } = analyse(c.mm)
    const stressOk = stressMpa <= allowableStressMpa
    const deflectionOk = deflectionMm <= deflectionLimitMm
    const reason =
      `σ = ${stressMpa.toFixed(1)} MPa ${stressOk ? '≤' : '>'} ${allowableStressMpa} MPa · ` +
      `δ = ${deflectionMm.toFixed(1)} mm ${deflectionOk ? '≤' : '>'} ${deflectionLimitMm.toFixed(1)} mm ` +
      `(h/${divisor})` +
      (stressOk && deflectionOk ? ' — varno' : ' — preseženo')
    return { ...c, stressMpa, deflectionMm, stressOk, deflectionOk, safe: stressOk && deflectionOk, reason }
  })

  const alternativeThicknesses = evaluated.map((e) => ({ mm: e.mm, safe: e.safe, reason: e.reason }))

  const chosen = evaluated.find((e) => e.safe) ?? evaluated[evaluated.length - 1]
  const recommendedThicknessMm = chosen.mm
  const isSafe = chosen.safe
  const governing: 'stress' | 'deflection' = chosen.stressOk ? 'deflection' : 'stress'
  const layers = chosen.layers

  // σ = 6wh/t² ≤ σ_dov → h ≤ σ_dov·t²/(6w);  δ ≤ h/x → h² ≤ E·t³/(4·w·x·f)
  const maxHeightForThicknessMm = (() => {
    if (w <= 0) return 0
    const fromStress = (allowableStressMpa * recommendedThicknessMm ** 2) / (6 * w)
    const fromDeflection =
      Math.sqrt((E * recommendedThicknessMm ** 3) / (4 * w * divisor)) / Math.sqrt(deflFactor)
    return Math.round(Math.min(fromStress, fromDeflection))
  })()

  // σ = 6wL²/(8·t·h²) ≤ σ_dov → L ≤ sqrt(σ_dov·8·t·h²/(6w))
  const maxSpanForThicknessMm = Math.round(
    Math.sqrt((allowableStressMpa * 8 * recommendedThicknessMm * h * h) / (6 * Math.max(w, 1e-6) * twoWay)),
  )

  const modelNote =
    support === 'cantilever'
      ? `Model: konzola (vpeto v U-profil, prosto zgoraj). Merodajno: ${
          governing === 'deflection' ? 'deformacija' : 'napetost'
        }. σ = 6·w·h/t², δ = 4·w·h³/(E·t³).`
      : `Model: steklo kot visok nosilec preko razpona (${
          support === 'twoEdges' ? '2 robova' : '4 robovi'
        }). σ = 6·w·L²/(8·t·h²). Linijsko obtežbo z vrha prevzamejo stebri — preveri jih posebej.`

  if (!isSafe) {
    warnings.push(
      `Nobena standardna debelina ne zadošča (${chosen.reason}). Zmanjšaj obtežbo, skrajšaj ` +
        'višino/razpon ali dodaj stebre — in preveri s statikom.',
    )
  }
  if (!chosen.deflectionOk && chosen.stressOk) {
    warnings.push(
      `Debelina ${recommendedThicknessMm} mm ustreza po napetosti, ne pa po deformaciji ` +
        `(${chosen.deflectionMm.toFixed(1)} mm > ${deflectionLimitMm.toFixed(1)} mm). ` +
        'Pri ograjah je deformacija tista, ki jo stranka vidi in čuti.',
    )
  }
  if (glassType === 'single') {
    warnings.push(
      'Enojno (nelepljeno, nekaljeno) steklo ni primerno za varovalne ograje — ob razbitju ' +
        'pade iz ograje. Uporabi VSG ali ESG/VSG.',
    )
  }
  if (glassType === 'laminated') {
    warnings.push(
      `Za lepljeno steklo je uporabljen faktor deformacije ${laminatedFactor}× (PVB folija). ` +
        'Pri SGP foliji je togost večja — preveri pri dobavitelju.',
    )
  }
  if (support === 'cantilever' && spanMm > 1500) {
    warnings.push('Razpon > 1500 mm — pri konzolni ograji preveri vpetje in stike panelov.')
  }
  if (support !== 'cantilever') {
    warnings.push('Pri sistemu s stebri nosilnost določajo stebri in njihova vpetja, ne steklo.')
  }
  if (heightMm < 1000) {
    warnings.push(`Višina stekla ${heightMm} mm je pod 1000 mm — preveri predpisano višino ograje.`)
  }
  if (heightMm > 1200) {
    warnings.push(`Višina ${heightMm} mm — pri večjih višinah raste moment v vpetju, preveri statiko.`)
  }
  if (loadKnPerM >= 2.0) {
    warnings.push('Visoka obtežba (≥ 2,0 kN/m) — obvezna statična analiza, ne ročni izračun.')
  }

  if (glassType === 'laminated') {
    recommendations.push(
      `Laminirano steklo: 2× ${chosen.baseMm ?? recommendedThicknessMm / 2} mm + folija = ` +
        `${recommendedThicknessMm} mm.`,
    )
    recommendations.push('Lepljeno steklo ob razbitju ostane v ograji (folija PVB/SGP).')
  } else if (glassType === 'tempered') {
    recommendations.push('Kaljeno steklo (ESG) je 4–5× odpornejše od navadnega, a ob razbitju razpade.')
    recommendations.push('Za varovalne ograje raje ESG/VSG — kaljeno zunaj, lepljeno notri.')
  }
  if (governing === 'deflection') {
    recommendations.push(
      `Debelino določa deformacija (δ = ${chosen.deflectionMm.toFixed(1)} mm pri meji ` +
        `${deflectionLimitMm.toFixed(1)} mm), ne napetost (σ = ${chosen.stressMpa.toFixed(1)} MPa).`,
    )
  }
  if (support === 'cantilever') {
    recommendations.push(
      `Največja višina konzole za ${recommendedThicknessMm} mm pri tej obtežbi: ` +
        `${maxHeightForThicknessMm} mm.`,
    )
    recommendations.push('Vpetje v U-profil naj bo najmanj 40 mm, s suho montažo in klini.')
  }
  recommendations.push('Robovi stekla morajo biti brušeni in polirani (KDG) — rezani rob je lomni.')
  recommendations.push('Uporabi A4 (Inox 316) vijake in kemično sidranje po navodilih sistema.')

  return {
    recommendedThicknessMm,
    alternativeThicknesses,
    maxSpanForThicknessMm,
    maxHeightForThicknessMm,
    stressMpa: Math.round(chosen.stressMpa * 10) / 10,
    allowableStressMpa,
    deflectionMm: Math.round(chosen.deflectionMm * 10) / 10,
    deflectionLimitMm: Math.round(deflectionLimitMm * 10) / 10,
    deflectionOk: chosen.deflectionOk,
    governing,
    isSafe,
    layers,
    modelNote,
    warnings,
    recommendations,
  }
}
