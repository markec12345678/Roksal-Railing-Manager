// Roksal Field - API: AI Material Takeoff
// Photo → AI (VLM) → Material Takeoff → Quote
// V2 roadmap: Photo → AI segmentacija → Površina → Material → Ponudba
import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import {
  calculateEqualSpacing,
  calculateMaterialTotal,
  calculateLaborCost,
  calculateDDV,
  formatEUR,
} from '@/lib/calculator'

export const runtime = 'nodejs'
export const maxDuration = 60

interface AiTakeoffRequest {
  imageData: string // base64 data URL
  projectId?: string
  hint?: {
    knownLengthMm?: number // če monter pozna dolžino
    railingType?: 'WPC' | 'ALU' | 'INOX' | 'STEKLO' | 'AUTO'
  }
}

interface DetectedRailing {
  tip: 'WPC' | 'ALU' | 'INOX' | 'STEKLO' | 'NEZNANO'
  orientacija: 'pokončne' | 'vodoravne' | 'poševne' | 'panel' | 'steklo' | 'neznano'
  barva: string
  opis: string
  confidence: number // 0-1
}

interface EstimatedDimensions {
  dolzinaMm: number
  visinaMm: number
  stebrov: number
  palic: number
  referenceObject: string
  confidence: number
}

interface MaterialTakeoff {
  profil: {
    sifra: string
    naziv: string
    material: string
    cenaM: number
  }
  dolzinaM: number
  palic: number
  stebrov: number
  vijakov: number
  sidr: number
  linearniMetri: number
  cenaMateriala: number
  cenaDela: number
  cenaTransporta: number
  skupajBrezDDV: number
  ddv: number
  skupajZDDV: number
}

// VLM prompt za analizo slike ograje
const VLM_PROMPT = `Analiziraj to fotografijo balkona/terase in identificiraj ograjo.

VRNI JSON z naslednjo strukturo (BREZ markdown, BREZ komentarjev):
{
  "detectedRailing": {
    "tip": "WPC|ALU|INOX|STEKLO|NEZNANO",
    "orientacija": "pokončne|vodoravne|poševne|panel|steklo|neznano",
    "barva": "opis barve (npr. antracit siva, bela, naravni les)",
    "opis": "kratek opis ograje (1 stavek)",
    "confidence": 0.0-1.0
  },
  "estimatedDimensions": {
    "dolzinaMm": številka (ocenjena dolžina ograje v mm, glede na referenčne objekte),
    "visinaMm": številka (ocenjena višina ograje v mm, ponavadi 900-1200),
    "stebrov": številka (število vidnih stebrov),
    "palic": številka (število vidnih palic/polnil),
    "referenceObject": "kaj si uporabil za referenco (npr. ploščice, vrata, A4)",
    "confidence": 0.0-1.0
  },
  "materialEstimate": {
    "material": "WPC|Aluminij|Inox|Steklo",
    "profilTip": "H-Line|V-Line|Panel|Steklo|Klasik|Trosse",
    "barvaRal": "ocenjena RAL koda (npr. 7016)"
  }
}

Pravila:
- WPC: leseni videz, rjavi/ogra odtenki, navadno vodoravne ali pokončne letve
- ALU: kovinski, sivi/črni, enostavne linije
- INOX: srebrnkast, sijoč, tanki profili
- STEKLO: prosojno, steklene plošče med stebri
- Standardna višina ograje: 1100mm
- Standardna ploščica: 600x600mm (uporabi za referenco če vidna)
- Standardna višina vrat: 2000mm
- Razmik med stebri: ponavadi 1200-1500mm
- Če nisi prepričan, confidence < 0.5`

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AiTakeoffRequest
    const { imageData, hint } = body

    if (!imageData) {
      return NextResponse.json({ error: 'Manjka slika (imageData)' }, { status: 400 })
    }

    // 1. VLM analiza slike
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VLM_PROMPT },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })

    const vlmResponse = completion.choices[0]?.message?.content || ''

    // 2. Parse JSON iz VLM odgovora (odstrani morebiten markdown)
    let parsed: {
      detectedRailing: DetectedRailing
      estimatedDimensions: EstimatedDimensions
      materialEstimate: {
        material: string
        profilTip: string
        barvaRal: string
      }
    }

    try {
      // Odstrani ```json in ``` če prisotni
      const cleanJson = vlmResponse
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      parsed = JSON.parse(cleanJson)
    } catch {
      return NextResponse.json({
        error: 'AI ni uspel parsati slike',
        rawResponse: vlmResponse.slice(0, 500),
      }, { status: 422 })
    }

    const detected = parsed.detectedRailing
    const dims = parsed.estimatedDimensions
    const matEst = parsed.materialEstimate

    // 3. Najdi najboljši profil iz kataloga
    const profili = await db.profil.findMany({ where: { aktivna: true } })
    const tipMap: Record<string, string[]> = {
      WPC: ['WPC'],
      ALU: ['Alu', 'Aluminij'],
      INOX: ['Inox'],
      STEKLO: ['Steklo'],
    }
    const tipKeys = tipMap[detected.tip] || []
    let bestProfil = profili.find((p) =>
      tipKeys.some((k) => p.material.toLowerCase().includes(k.toLowerCase()))
    )
    // Fallback: če ni najden, uporabi prvi WPC
    if (!bestProfil && profili.length > 0) {
      bestProfil = profili.find((p) => p.material.toLowerCase().includes('wpc')) || profili[0]
    }

    if (!bestProfil) {
      return NextResponse.json({ error: 'Ni profilov v katalogu' }, { status: 500 })
    }

    // 4. Izračun material takeoff-a
    const dolzinaMm = hint?.knownLengthMm || dims.dolzinaMm || 3000
    const visinaMm = dims.visinaMm || 1100
    const sirinaPaliceMm = bestProfil.sirinaMm || 40

    // Razmak palic
    const spacing = calculateEqualSpacing({
      totalLengthMm: dolzinaMm,
      balusterWidthMm: sirinaPaliceMm,
      maxGapMm: 110,
    })

    // Stebri (1 na 1500mm + 1)
    const stebrov = Math.max(dims.stebrov || 0, Math.floor(dolzinaMm / 1500) + 1)

    // Material total
    const materialResult = calculateMaterialTotal({
      segments: [{ lengthMm: dolzinaMm, heightMm: visinaMm, type: 'level' }],
      profileSifra: bestProfil.sifra,
      profili: profili.map((p) => ({
        id: p.id,
        sifra: p.sifra,
        naziv: p.naziv,
        material: p.material,
        kategorija: p.kategorija,
        visinaMm: p.visinaMm,
        sirinaMm: p.sirinaMm,
        cenaM: p.cenaM,
        barvaRal: p.barvaRal,
        slikaUrl: p.slikaUrl,
        aktivna: p.aktivna,
      })),
    })

    // Delo
    const labor = calculateLaborCost({
      urnaPostavka: 35,
      stUr: Math.ceil(dolzinaMm / 1000) * 2, // 2 uri na meter
      stMonterjev: 2,
      transport: 50,
    })

    const cenaMateriala = materialResult.profileCost
    const cenaDela = labor.delaSkupaj
    const cenaTransporta = 50
    const skupajBrezDDV = cenaMateriala + cenaDela + cenaTransporta
    const ddvResult = calculateDDV(skupajBrezDDV, 22)

    const takeoff: MaterialTakeoff = {
      profil: {
        sifra: bestProfil.sifra,
        naziv: bestProfil.naziv,
        material: bestProfil.material,
        cenaM: bestProfil.cenaM,
      },
      dolzinaM: dolzinaMm / 1000,
      palic: spacing.balusterCount,
      stebrov,
      vijakov: spacing.balusterCount * 4 + stebrov * 8,
      sidr: stebrov * 2,
      linearniMetri: materialResult.totalLinearMeters,
      cenaMateriala: Math.round(cenaMateriala),
      cenaDela: Math.round(cenaDela),
      cenaTransporta: cenaTransporta,
      skupajBrezDDV: Math.round(skupajBrezDDV),
      ddv: Math.round(ddvResult.ddvAmount),
      skupajZDDV: Math.round(ddvResult.total),
    }

    // 5. Shrani kot AI poročilo v projekt (če je projectId podan)
    if (body.projectId) {
      try {
        await db.arSnapshot.create({
          data: {
            projectId: body.projectId,
            imageUrl: imageData.slice(0, 100), // samo prefix za referenco
            tocke: JSON.stringify({
              source: 'ai_takeoff',
              detected: detected,
              dimensions: dims,
              materialEstimate: matEst,
            }),
            meritve: JSON.stringify(takeoff),
            kalibracija: JSON.stringify({ confidence: dims.confidence }),
            opombe: `AI Takeoff: ${detected.tip} ${detected.orientacija}, ${dolzinaMm}mm × ${visinaMm}mm`,
          },
        })
      } catch {
        // ne kritično
      }
    }

    return NextResponse.json({
      success: true,
      detected,
      dimensions: dims,
      materialEstimate: matEst,
      takeoff,
      profil: bestProfil,
      formattedPrice: formatEUR(takeoff.skupajZDDV),
      rawVlm: vlmResponse.slice(0, 200),
    })
  } catch (error) {
    console.error('AI Takeoff Error:', error)
    return NextResponse.json(
      { error: 'Napaka pri AI analizi', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
