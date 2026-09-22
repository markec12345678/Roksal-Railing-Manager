// Roksal — AI ocena meritev iz navadne fotografije (VLM prek z-ai-web-dev-sdk)
// ---------------------------------------------------------------------------
// Za telefone BREZ ARCore/WebXR (iPhone, starejši Androidi): monter zajame
// eno fotografijo ograje, vizualni model pa oceni DIMENZIJE v milimetrih:
//   · dolzinaMm — skupna dolžina ograje na fotki
//   · visinaMm — višina ograje (od podlage do ročaja)
//   · razmikStebrovMm — opcijsko
//   · zaupanje 0–1 + izhodišče ocene (katera referenca je uporabljena)
// OCENA NI NADOMESTILO za pravo meritev — UI jo vedno pokaže kot predlog,
// ki ga monter lahko popravi pred shranjevanjem.
//
// Varnost: authenticate + rate-limit 20/10min + audit; SDK samo na strežniku.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import ZAI from 'z-ai-web-dev-sdk'
import { authenticate, unauthorized } from '@/lib/auth'
import { checkRate, clientIp } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

const bodySchema = z.object({
  /** data:image/jpeg;base64,… */
  image: z.string().min(64).max(6_000_000),
  projectId: z.string().max(64).optional().nullable(),
})

const SYSTEM_PROMPT = `Si izkušen merilec ograj pri slovenskem podjetju Roksal.
Iz fotografije balkona/terase/stopišča OCENIŠ dimenzije ograje v milimetrih.
Odgovori IZKLJUČNO z veljavnim JSON objektom (brez markdown, brez uvoda):

{
  "dolzinaMm": <pozitivno celo število — ocena skupne dolžine ograje v mm>,
  "visinaMm": <pozitivno celo število — ocena višine ograje od podlage do vrha/ročaja v mm>,
  "razmikStebrovMm": <pozitivno celo število ali null — ocena razmika med stebri>,
  "izhodisce": "<katero referenco si uporabil za merilo, npr. 'višina vrat ~200 cm' ali 'standardni ročaj 90 cm'>",
  "zaupanje": <0.0-1.0 realno število — kako zanesljiva je ocena>,
  "opombe": "<kratek opis, kaj je na fotki vidno in kaj bi bilo treba izmeriti natančno>"
}

Pravila:
- Uporabi znane reference na fotki (višina vrat ~2000 mm, klasični ročaj 900–1100 mm, standardna ploščica ~300 mm, oseba ~1700 mm).
- Realne vrednosti: dolžina balkona 1500–12000 mm, višina ograje 900–1300 mm, razmik stebrov 900–1600 mm.
- Če je fotka pretemna ali nejasna, nastavi zaupanje pod 0.4 in to zapiši.
- Nikoli ne vrni null za dolzinaMm ali visinaMm — vedno daj najboljšo oceno.`

interface OcenaMer {
  dolzinaMm: number
  visinaMm: number
  razmikStebrovMm: number | null
  izhodisce: string
  zaupanje: number
  opombe: string
}

/** Model včasih odvrne JSON z uvodom/markdownom — izlušči pravi objekt. */
function extractJson(raw: string): OcenaMer | null {
  if (!raw) return null
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
    const num = (k: string, alt: string) => {
      const v = obj[k] ?? obj[alt]
      return typeof v === 'number' && isFinite(v) && v > 0 ? v : null
    }
    const dolzinaMm = num('dolzinaMm', 'dolzina_mm')
    const visinaMm = num('visinaMm', 'visina_mm')
    if (dolzinaMm === null || visinaMm === null) return null
    const raz = num('razmikStebrovMm', 'razmik_stebrov_mm')
    const zaupanjeRaw = obj['zaupanje'] ?? obj['confidence']
    const zaupanje = typeof zaupanjeRaw === 'number' && zaupanjeRaw >= 0 && zaupanjeRaw <= 1 ? zaupanjeRaw : 0.5
    return {
      dolzinaMm: Math.min(60000, Math.max(200, Math.round(dolzinaMm))),
      visinaMm: Math.min(4000, Math.max(300, Math.round(visinaMm))),
      razmikStebrovMm: raz !== null ? Math.min(3000, Math.max(300, Math.round(raz))) : null,
      izhodisce: typeof obj['izhodisce'] === 'string' ? obj['izhodisce'] : '—',
      zaupanje,
      opombe: typeof obj['opombe'] === 'string' ? obj['opombe'] : '',
    }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return unauthorized()

  const limitKey = `measure-photo:${clientIp(request)}:${auth.kind === 'user' ? auth.session.sub : 'api'}`
  const limit = checkRate(limitKey, { limit: 20, windowMs: 10 * 60 * 1000 })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Preveč ocen.', detail: `Poskusi znova čez ${limit.retryAfterSeconds} s.` },
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
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Oceni dimenzije ograje na tej fotografiji in odgovori samo z zahtevanim JSON objektom.',
              },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      })

    let ocena: OcenaMer | null = null
    for (let attempt = 0; attempt < 2 && !ocena; attempt++) {
      try {
        const response = await askModel()
        const raw = response.choices[0]?.message?.content ?? ''
        ocena = extractJson(raw)
        if (!ocena) {
          console.error('[measure-photo] poskus', attempt + 1, '— brez veljavnega JSON:', raw.slice(0, 200))
        }
      } catch (err) {
        console.error('[measure-photo] poskus', attempt + 1, '— napaka VLM:', err)
      }
    }
    if (!ocena) {
      return NextResponse.json(
        { error: 'Ocena ni uspela. Poskusite jasnejšo fotografijo s celotno ograjo.' },
        { status: 502 },
      )
    }

    await audit({
      request,
      userId: auth.kind === 'user' ? auth.session.sub : undefined,
      akcija: 'AI_FOTO_OCENA_MER',
      newValue: { dolzinaMm: ocena.dolzinaMm, visinaMm: ocena.visinaMm, projectId: projectId ?? null },
    }).catch(() => undefined)

    return NextResponse.json({ ok: true, ocena })
  } catch (error) {
    console.error('Measure photo error:', error)
    return NextResponse.json({ error: 'Napaka pri AI oceni mer.' }, { status: 500 })
  }
}
