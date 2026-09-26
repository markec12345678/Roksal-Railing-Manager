// R151 — testi (issue #5 §35 — Quote/document reproducibility).
// ---------------------------------------------------------------------------
//   • Lib determinizem: canonicalizeQuoteInputs (rekurzivno — polja v
//     OHRANJENEM vrstnem redu [točke obsega so po vrsti], ključi objektov
//     urejeni, števila normalizirana, ne-končne vrednosti vidne),
//     quoteInputFingerprint (verzija 'quote-v1' vezana v hash,
//     determinizem 100×, občutljivost na vrstni red točk).
//   • POST /api/quote: anon → 401; veljavna ponudba → 200 z
//     reproducibility { quoteVersion, inputHash } + odtis == lib odtis nad
//     UČINKOVITIMI vhodi; isti vhod 2× → ISTI odtis; spec predelava → drug
//     odtis; odgovor ostane nazaj-združljiv (quote/summary/warnings/cutList).
//
// Handlerji direktno, baza roksal_test prek globalSetup (vzorec R128–R150).
import { describe, expect, it } from 'vitest'
import { POST as quotePost } from '@/app/api/quote/route'
import {
  canonicalizeQuoteInputs,
  quoteInputFingerprint,
  fnv1a32Hex,
  QUOTE_FORMULA_VERSION,
} from '@/lib/quote-repro'
import { defaultPriceBook, mergePriceBook } from '@/lib/quote'
import { mergeSpec } from '@/lib/railing-layout'
import { createTestUserWithSession } from './helpers/test-session'

const BASE = 'http://localhost/api'

function jsonReq(
  reqPath: string,
  token: string | null,
  init: { method?: string; body?: unknown } = {},
): Request {
  return new Request(`${BASE}${reqPath}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

// ── Lib: canonicalizeQuoteInputs ────────────────────────────────────────────

describe('R151 §35 canonicalizeQuoteInputs (rekurzivna kanonizacija)', () => {
  it('vrstni red ključev objektov NE vpliva, vrstni red POLJ pa JA', () => {
    const a = canonicalizeQuoteInputs([{ xM: 0, zM: 0 }, { xM: 5, zM: 1 }])
    const b = canonicalizeQuoteInputs([{ zM: 0, xM: 0 }, { zM: 1, xM: 5 }])
    expect(a).toBe(b) // ključi urejeni
    const c = canonicalizeQuoteInputs([{ xM: 5, zM: 1 }, { xM: 0, zM: 0 }])
    expect(a).not.toBe(c) // točke v drugem vrstnem redu = druga ograja
  })

  it('globoko gnezdenje (spec z objekti) je deterministično', () => {
    const spec = mergeSpec({ glass: { type: 'VSG' } })
    const a = canonicalizeQuoteInputs(spec)
    const b = canonicalizeQuoteInputs(mergeSpec({ glass: { type: 'VSG' } }))
    expect(a).toBe(b)
  })

  it('števila so normalizirana, ne-končna vidno označena', () => {
    expect(canonicalizeQuoteInputs({ x: 2.5 })).toBe('{x:n2.5}')
    expect(canonicalizeQuoteInputs({ x: Infinity })).toBe('{x:nInfinity}')
    expect(canonicalizeQuoteInputs({ x: null })).toBe('{x:null}')
    expect(canonicalizeQuoteInputs({ x: [1, 2] })).toBe('{x:[n1,n2]}')
  })
})

// ── Lib: quoteInputFingerprint ──────────────────────────────────────────────

describe('R151 §35 quoteInputFingerprint (verzija vezana, determinističen)', () => {
  const veljavni = {
    points: [{ xM: 0, yM: 0, zM: 0 }, { xM: 5, yM: 0, zM: 0 }],
    closed: false,
    overridesMm: {},
    spec: mergeSpec({}),
    prices: defaultPriceBook(),
  }

  it('nosi verzijo formule in je determinističen za isti vhod (100×)', () => {
    const fp1 = quoteInputFingerprint(veljavni)
    expect(fp1.quoteVersion).toBe('quote-v1')
    expect(QUOTE_FORMULA_VERSION).toBe('quote-v1')
    expect(fp1.inputHash).toMatch(/^[0-9a-f]{8}$/)
    for (let i = 0; i < 100; i++) {
      expect(quoteInputFingerprint(veljavni)).toEqual(fp1)
    }
  })

  it('ključni vrstni red ne vpliva; vrstni red točk JA', () => {
    const reordered = { ...veljavni, prices: defaultPriceBook() }
    expect(quoteInputFingerprint(reordered).inputHash).toBe(quoteInputFingerprint(veljavni).inputHash)
    const flipped = {
      ...veljavni,
      points: [{ xM: 5, yM: 0, zM: 0 }, { xM: 0, yM: 0, zM: 0 }],
    }
    expect(quoteInputFingerprint(flipped).inputHash).not.toBe(quoteInputFingerprint(veljavni).inputHash)
  })

  it('sprememba specifikacije ali cenika → drug odtis', () => {
    const drugSpec = { ...veljavni, spec: mergeSpec({ heightMm: 1200 }) }
    expect(quoteInputFingerprint(drugSpec).inputHash).not.toBe(quoteInputFingerprint(veljavni).inputHash)
    const drugCenik = {
      ...veljavni,
      prices: mergePriceBook({ glassPerM2: 200 }),
    }
    expect(quoteInputFingerprint(drugCenik).inputHash).not.toBe(quoteInputFingerprint(veljavni).inputHash)
  })

  it('fnv1a32Hex velja znano vrednost (isti algoritem kot R150)', () => {
    expect(fnv1a32Hex('')).toBe('811c9dc5')
  })
})

// ── API: POST /api/quote ────────────────────────────────────────────────────

describe('R151 POST /api/quote (reproducibility v odgovoru)', () => {
  const telo = {
    points: [
      { xM: 0, zM: 0 },
      { xM: 5, zM: 0 },
      { xM: 5, zM: 3 },
    ],
    closed: false,
  }

  it('anon POST → 401', async () => {
    const res = await quotePost(jsonReq('/api/quote', null, { method: 'POST', body: telo }))
    expect(res.status).toBe(401)
  })

  it('veljavna ponudba → 200 + nazaj-združljiva polja + reproducibility', async () => {
    const { token } = await createTestUserWithSession(`r151-quote-a-${Date.now()}`, 'VODJA')
    const res = await quotePost(jsonReq('/api/quote', token, { method: 'POST', body: telo }))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Nazaj-združljivost: obstoječa oblika ostane.
    expect(body.quote).toBeDefined()
    expect(body.summary).toBeDefined()
    expect(body.warnings).toBeDefined()
    expect(body.cutList).toBeDefined()
    // Novo (§35): odtis nad učinkovitimi vhodi.
    expect(body.reproducibility.quoteVersion).toBe('quote-v1')
    expect(body.reproducibility.inputHash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('odtisi == lib odtis nad UČINKOVITIMI vhodi; isti vhod 2× → isti odtis', async () => {
    const { token } = await createTestUserWithSession(`r151-quote-b-${Date.now()}`, 'VODJA')
    const res1 = await quotePost(jsonReq('/api/quote', token, { method: 'POST', body: { ...telo, projectId: undefined } }))
    const res2 = await quotePost(jsonReq('/api/quote', token, { method: 'POST', body: telo }))
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    const b1 = await res1.json()
    const b2 = await res2.json()
    expect(b1.reproducibility.inputHash).toBe(b2.reproducibility.inputHash)
    // Lib preverba: odtis nad merged spec + merged pricebook (učinkoviti vhodi).
    const libFp = quoteInputFingerprint({
      points: telo.points.map((p: { xM: number; zM: number }) => ({ xM: p.xM, yM: 0, zM: p.zM })),
      closed: false,
      overridesMm: {},
      spec: mergeSpec({}),
      prices: defaultPriceBook(),
    })
    expect(b1.reproducibility.inputHash).toBe(libFp.inputHash)
  })

  it('spec predelava → drug odtis (isti klient, druga specifikacija)', async () => {
    const { token } = await createTestUserWithSession(`r151-quote-c-${Date.now()}`, 'VODJA')
    const r1 = await quotePost(jsonReq('/api/quote', token, { method: 'POST', body: telo }))
    const r2 = await quotePost(jsonReq('/api/quote', token, { method: 'POST', body: { ...telo, spec: { heightMm: 1200 } } }))
    const b1 = await r1.json()
    const b2 = await r2.json()
    expect(b1.reproducibility.inputHash).not.toBe(b2.reproducibility.inputHash)
  })

  it('API ključ / pomanjkljiva pravica → 403 (quotes.create)', async () => {
    // SKLADISCE nima quotes.create — forbidden, ne 500.
    const { token } = await createTestUserWithSession(`r151-quote-d-${Date.now()}`, 'SKLADISCE')
    const res = await quotePost(jsonReq('/api/quote', token, { method: 'POST', body: telo }))
    expect(res.status).toBe(403)
  })
})
