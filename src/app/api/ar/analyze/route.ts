// Roksal — AI analiza fotografije ograje (VLM prek z-ai-web-dev-sdk)
// ---------------------------------------------------------------------------
// ⚠️ S+8 §19 STATUS: EKSPERIMENTALNO SUGESTIJSKO ORODJE — NI PRODUKCIJSKI
// VIR GEOMETRIJE. Rezultat je SAMO predlog uporabniku (tip/barva/mere);
// uporabnik ga izrecno POTRDI. Ta ruta NIKOLI ne hrani geometrije v
// deterministični Product SDK / A-pipeline / BOM source-of-truth.
// Polna deterministična zamenjava (CV + ročna meritev): GitHub issue #2.
//
// "Kamera naj analizira čimbolj lahkо": monter zajame en sam kader obstoječe
// ograje, ta ruta pa z vizualnim modelom oceni:
//   · tip ograje (WPC vodoravno / pokončno, Inox, Steklo, Alu, Drugo)
//   · stanje in material, predlog barve (RAL), tip montaže
//   · ovire (prodor, radiator, cvetje …) in opombe za montažo
//   · katere mere je najbolj smiselno vzeti (priprava za kalkulator)
//
// Varnost: zaščitena s sejo/API ključem (authenticate), omejena s hitrostjo,
// sdk se uporablja IZKLJUČNO na strežniku. Velikost slike omejimo (~4 MB
// base64), ker je to fotka iz kamere, ne arhiv.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import ZAI from 'z-ai-web-dev-sdk'
import { authenticate, unauthorized } from '@/lib/auth'
import { checkRate, clientIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

const bodySchema = z.object({
  /** data:image/jpeg;base64,… — zajem iz AR kamere */
  image: z.string().min(64).max(6_000_000),
  projectId: z.string().max(64).optional().nullable(),
})

const SYSTEM_PROMPT = `Si izkušen tehnik za meritve in ponudbe ograj pri slovenskem podjetju Roksal.
Analiziraš fotografijo balkona/terase/stopišča z obstoječo (ali brez) ograjo.
Odgovori IZKLJUČNO z veljavnim JSON objektom (brez markdown, brez uvoda) v tej strukturi:

{
  "tipOgraje": "WPC vodoravno" | "WPC pokončno" | "Inox" | "Steklo" | "Alu klasično" | "Brez ograje" | "Drugo",
  "stanje": "<kratek opis stanja obstoječe ograje, 1-2 povedi; če je ni, opiši lokacijo>",
  "material": "<ocena materiala>",
  "predlaganaBarva": "<konkreten predlog barve, po možnosti RAL št.>",
  "tipMontaze": "<ocena: čelno/bočno na ploščo, na stopnico, v tlak …>",
  "ovire": "<prodori, radiatorji, rastline, kabelski vodi … ali 'ni vidnih ovir'>",
  "priporoceneMere": [
    { "naziv": "<npr. Skupna dolžina>", "opis": "<kaj točno izmeriti in kako>", "prednost": "visoka|srednja|nizka" }
  ],
  "opombe": "<kaj je še pomembno za ponudbo in montažo>",
  "zaupanje": <0.0-1.0 realno število>
}

Pravila:
- IZPOLNI VSAKA polja. Če podatka ni vidno na fotografiji, napiši "ni vidno" — nikoli ne pusti praznega niza.
- priporoceneMere: 3-5 mer, od najpomembnejše (dolžina odseka, višina) do manj pomembnih (odmik od stene)
- Bodi specifičen za balkone/terase/stopišča (npr. 'višina od tal balkona do ročaja')
- Če je slika nejasna, nastavi zaupanje nizko in to zapiši v opombe.`

interface PriporocenaMera {
  naziv: string
  opis: string
  prednost: string
}

interface AnalizaOgraje {
  tipOgraje: string
  stanje: string
  material: string
  predlaganaBarva: string
  tipMontaze: string
  ovire: string
  priporoceneMere: PriporocenaMera[]
  opombe: string
  zaupanje: number
}

function extractJson(text: string): AnalizaOgraje | null {
  // Model včasih oda JSON v ```fence``` — odstrani in poišči prvi { … zadnji }.
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }

  // Normalizacija ključev: model občasno vrne snake_case namesto camelCase.
  const get = (...keys: string[]): string => {
    for (const k of keys) {
      const v = obj[k] ?? obj[k.replace(/([A-Z])/g, (_, c) => `_${c.toLowerCase()}`)]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return 'ni vidno'
  }

  const tipOgraje = get('tipOgraje')
  // Validacija: brez prepoznanega tipa je analiza neuporabna → spodleti,
  // da klient pokaže jasno napako namesto praznih polj.
  if (!tipOgraje || tipOgraje === 'ni vidno') return null

  const rawMere = (obj['priporoceneMere'] ?? obj['priporocene_mere']) as unknown
  let priporoceneMere: PriporocenaMera[] = Array.isArray(rawMere)
    ? rawMere
        .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
        .map((m) => ({
          naziv: String(m['naziv'] ?? 'Meritev'),
          opis: String(m['opis'] ?? ''),
          prednost: String(m['prednost'] ?? 'srednja'),
        }))
        .slice(0, 8)
    : []

  // Fallback: če model mer ni vrnil, ponudimo standardni nabor za ograje,
  // da monter vedno dobi koristen izhodiščni seznam.
  if (priporoceneMere.length === 0) {
    priporoceneMere = [
      {
        naziv: 'Skupna dolžina odseka',
        opis: 'Celotna dolžina balkona/terase, kjer bo ograja (od roba do roba ali stene do stene).',
        prednost: 'visoka',
      },
      {
        naziv: 'Višina ograje',
        opis: 'Od tal balkona/terase do zgornjega ročaja (standard je 1100 mm).',
        prednost: 'visoka',
      },
      {
        naziv: 'Širina med stebri',
        opis: 'Razmik med sosednjimi stebri — pomemben za število polj in material.',
        prednost: 'srednja',
      },
      {
        naziv: 'Odmik od stene / roba',
        opis: 'Možnost pritrditve čelno ali bočno; preverite robi plošče.',
        prednost: 'nizka',
      },
    ]
  }

  const zaupanjeRaw = obj['zaupanje']
  const zaupanje =
    typeof zaupanjeRaw === 'number' && zaupanjeRaw >= 0 && zaupanjeRaw <= 1 ? zaupanjeRaw : 0.5

  return {
    tipOgraje,
    stanje: get('stanje'),
    material: get('material'),
    predlaganaBarva: get('predlaganaBarva'),
    tipMontaze: get('tipMontaze'),
    ovire: get('ovire'),
    priporoceneMere,
    opombe: get('opombe'),
    zaupanje,
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()

  // AI klici so dragi — omejimo hitrost na (IP + uporabnik).
  const limitKey = `ar-analyze:${clientIp(request)}:${auth.kind === 'user' ? auth.session.sub : 'api'}`
  const limit = checkRate(limitKey, { limit: 20, windowMs: 10 * 60 * 1000 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Preveč analiz.', detail: `Poskusi znova čez ${limit.retryAfterSeconds} s.` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  try {
    const body = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavna slika.' }, { status: 400 })
    }
    const { image, projectId } = parsed.data

    const zai = await ZAI.create()

    const askModel = () =>
      zai.chat.completions.createVision({
        model: 'glm-4.6v',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analiziraj to fotografijo ograje in odgovori samo z zahtevanim JSON objektom.',
              },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      })

    // VLM občasno vrne odrezan/neveljaven JSON — en poskus ponovitve je poceni
    // zavarovanje, da monter na terenu ne vidi napake brez razloga.
    let analiza: AnalizaOgraje | null = null
    for (let attempt = 0; attempt < 2 && !analiza; attempt++) {
      try {
        const response = await askModel()
        const raw = response.choices[0]?.message?.content ?? ''
        analiza = extractJson(raw)
        if (!analiza) {
          console.error('[ar-analyze] poskus', attempt + 1, '— model ni vrnil veljavnega JSON:', raw.slice(0, 200))
        }
      } catch (err) {
        console.error('[ar-analyze] poskus', attempt + 1, '— napaka VLM:', err)
      }
    }
    if (!analiza) {
      return NextResponse.json(
        { error: 'Analiza ni uspela. Poskusite jasnejšo fotografijo.' },
        { status: 502 },
      )
    }

    await audit({
      request,
      userId: auth.kind === 'user' ? auth.session.sub : undefined,
      akcija: 'AR_AI_ANALIZA',
      newValue: { tipOgraje: analiza.tipOgraje, projectId: projectId ?? null },
    }).catch(() => undefined)

    return NextResponse.json({ ok: true, analiza })
  } catch (error) {
    console.error('AR analyze error:', error)
    return NextResponse.json({ error: 'Napaka pri AI analizi.' }, { status: 500 })
  }
}
