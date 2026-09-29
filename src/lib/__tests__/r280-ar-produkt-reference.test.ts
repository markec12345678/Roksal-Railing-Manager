// R280 — SEGMENT PRODUKT REFERENCE v skupnem kontraktu (issue #16 §3:
// 'profile / color/material, kjer je relevantno / handrail/posts/
// configuration, kjer je del potrjene konfiguracije'). Zadnji ostanki §3 —
// razmejitev kontrakt vs. business je IZRECNA odločitev (U1–U6 v glavi
// src/lib/ar-contract.ts — zapisane PRED razvojem po kanonu P/Q/S/T):
//   • U1 aditivna v1 (NE v2) — verzija ostane 1, matrika nosi razširitev;
//   • U2 flat verbatim STRINGI 1:1 issue besednjak (NE enumi kataloga —
//     katalog je Product SDK domena; enum = drugi vzporedni vir resnice;
//     NE strukture — §11: layout/posts so v Roksalu DERIVED);
//   • U3 RAZMEJITEV: produkt reference = terenske oznake (provenance),
//     NIKOLI business resnica — BOM/geometry/pricing core NE importira
//     kontrakta (strukturni test) + parse NE izpeljuje ničesar iz teh
//     polj (invariančni test);
//   • U4 izostanek = edini 'brez' — prazen niz in ekspliciten null
//     zavrnjena (kanon T2/P5);
//   • U5 verbatim (brez trim/case-fold — kanon odločitev 6/T4); strop 200;
//   • U6 DB/route NIČ — arMetadata JSON verbatim, brez sheme.
// Zlati fixture (R275) ostaje NESPREMENJEN — v1 brez novih polj.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  parseArSessionPayload,
  serializeArSessionPayload,
  migrateArSessionPayload,
  ArContractError,
  AR_CONTRACT_VERSION,
  AR_CONTRACT_COMPATIBILITY,
  SUPPORTED_AR_CONTRACT_VERSIONS,
} from '@/lib/ar-contract'
import golden from './fixtures/ar-session-golden-v1.json'

const ZLATI = golden as Record<string, unknown>

/** Poln veljaven payload z ZLATIMI obveznimi polji + opcijske produkt
 *  reference per segment. `produkt` = objekt ali undefined (izostanek). */
function osnova(
  produkt: Record<string, unknown> | undefined,
  dodatki: { session?: Record<string, unknown>; segment?: Record<string, unknown> } = {},
): Record<string, unknown> {
  return {
    contractVersion: 1,
    appVersion: 'BalkonAR 0.9.2',
    projectId: 'proj-r280',
    sessionId: 'sess-r280',
    source: 'ARCORE_DEPTH',
    units: 'mm',
    coordinateFrame: { type: 'LOCAL_NORMALIZED' },
    ...dodatki.session,
    segments: [
      {
        segmentId: 'seg-r280-1',
        lengthMm: 3200.75,
        heightMm: 1200,
        startMm: [0, 0],
        endMm: [3200.75, 12.5],
        confidence: 0.92,
        uncertaintyMm: 8.5,
        ...dodatki.segment,
        ...(produkt !== undefined ? produkt : {}),
        source: 'ARCORE_DEPTH',
      },
    ],
  }
}

const POLNI_PRODUKT = {
  profile: 'WPC-120-A',
  color: 'RAL 7016',
  material: 'WPC',
  handrail: 'WPC ročaj 120mm',
  posts: 'Inox 40×40',
  configuration: 'vrtljivi ročaj, zaprti podstavek',
}

describe('R280 produkt reference — sprejetje (issue #16 §3, U2: 1:1 issue besednjak)', () => {
  it('vseh šest referenc preide shemo verbatim — profile/color/material + handrail/posts/configuration (U2)', () => {
    const parsed = parseArSessionPayload(osnova(POLNI_PRODUKT))
    expect(parsed.segments[0].profile).toBe('WPC-120-A')
    expect(parsed.segments[0].color).toBe('RAL 7016')
    expect(parsed.segments[0].material).toBe('WPC')
    expect(parsed.segments[0].handrail).toBe('WPC ročaj 120mm')
    expect(parsed.segments[0].posts).toBe('Inox 40×40')
    expect(parsed.segments[0].configuration).toBe('vrtljivi ročaj, zaprti podstavek')
  })

  it('vsaka dimenzija NEODVISNO opcijska — samo profile + material = veljavno (§3 "kjer je relevantno")', () => {
    const parsed = parseArSessionPayload(osnova({ profile: 'Alu-45', material: 'Aluminij' }))
    expect(parsed.segments[0].profile).toBe('Alu-45')
    expect(parsed.segments[0].material).toBe('Aluminij')
    expect(parsed.segments[0].color).toBeUndefined()
    expect(parsed.segments[0].handrail).toBeUndefined()
    expect(parsed.segments[0].posts).toBeUndefined()
    expect(parsed.segments[0].configuration).toBeUndefined()
  })

  it('izostanek = ni bilo opazovano/potrjeno (iskrena praznina) — zlati fixture ostaja veljaven z vsemi undefined (U4)', () => {
    const parsed = parseArSessionPayload(ZLATI)
    for (const s of parsed.segments) {
      expect(s.profile).toBeUndefined()
      expect(s.color).toBeUndefined()
      expect(s.material).toBeUndefined()
      expect(s.handrail).toBeUndefined()
      expect(s.posts).toBeUndefined()
      expect(s.configuration).toBeUndefined()
    }
    const brez = parseArSessionPayload(osnova(undefined))
    expect(brez.segments[0].profile).toBeUndefined()
    expect(brez.segments[0].configuration).toBeUndefined()
  })

  it('per-segment neodvisnost: en segment s referencami, drugi brez (U2)', () => {
    const payload = osnova(POLNI_PRODUKT)
    ;(payload.segments as Record<string, unknown>[]).push({
      segmentId: 'seg-r280-2',
      lengthMm: 900,
      source: 'MANUAL',
    })
    const parsed = parseArSessionPayload(payload)
    expect(parsed.segments[0].profile).toBe('WPC-120-A')
    expect(parsed.segments[1].profile).toBeUndefined()
    expect(parsed.segments[1].material).toBeUndefined()
  })

  it('prazen niz = ZAVRJEN (U4 — izostanek polja je EDINI način "brez"; ena resnica, kanon T2)', () => {
    for (const kljuc of ['profile', 'color', 'material', 'handrail', 'posts', 'configuration']) {
      try {
        parseArSessionPayload(osnova({ [kljuc]: '' }))
        expect.unreachable(`prazen ${kljuc} mora biti zavrnjen`)
      } catch (e) {
        expect(e).toBeInstanceOf(ArContractError)
        expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
        expect((e as ArContractError).message).toContain(kljuc)
      }
    }
  })
})

describe('R280 — fail-closed strogost (U4/U5 + strict odločitev 3)', () => {
  it('ekspliciten null = ZAVRJEN (U4 — izostanek je edini "brez"; null ni vrednost)', () => {
    for (const kljuc of ['profile', 'configuration']) {
      expect(() => parseArSessionPayload(osnova({ [kljuc]: null }))).toThrowError(ArContractError)
    }
  })

  it('U5 VERBATIM: case-fold ne obstaja — "WPC-120-A" in "wpc-120-a" sta DVE RAZLIČNI resnici (nič normalizacije)', () => {
    const a = parseArSessionPayload(osnova({ profile: 'WPC-120-A' }))
    const b = parseArSessionPayload(osnova({ profile: 'wpc-120-a' }))
    expect(a.segments[0].profile).toBe('WPC-120-A')
    expect(b.segments[0].profile).toBe('wpc-120-a')
    expect(a.segments[0].profile).not.toBe(b.segments[0].profile)
  })

  it('U5 VERBATIM: presledki na robovih ostanejo — brez trim ("  WPC-120-A " = resnica z presledki)', () => {
    const parsed = parseArSessionPayload(osnova({ profile: '  WPC-120-A ' }))
    expect(parsed.segments[0].profile).toBe('  WPC-120-A ')
  })

  it('strop 200 znakov — 200 veljaven, 201 ZAVRJEN (U5)', () => {
    const naMeji = 'W'.repeat(200)
    expect(parseArSessionPayload(osnova({ profile: naMeji })).segments[0].profile).toBe(naMeji)
    expect(() => parseArSessionPayload(osnova({ profile: 'W'.repeat(201) }))).toThrowError(ArContractError)
  })

  it('tipografija "profil" = NEZNANO polje = ZAVRJENA (strict — odločitev 3 nespremenjena)', () => {
    try {
      parseArSessionPayload(osnova({ profil: 'WPC-120-A' }))
      expect.unreachable('tuj ključ mora biti zavrnjen')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      expect((e as ArContractError).message).toContain('profil')
    }
  })
})

describe('R280 — U3 RAZMEJITEV kontrakt vs. business (glavna odločitev runde)', () => {
  it('STRUKTURNI dokaz: BOM/geometry/pricing/railing core moduli NE importirajo ar-contract (business resnica ne bere produkt referenc)', () => {
    const core = [
      'src/lib/measurement/geometry.ts',
      'src/lib/measurement/engine.ts',
      'src/lib/railing-layout.ts',
      'src/lib/quote.ts',
      'src/lib/calculator.ts',
    ]
    for (const rel of core) {
      const vsebina = readFileSync(join(process.cwd(), rel), 'utf8')
      expect(vsebina.includes("from '@/lib/ar-contract'"), `${rel} importira ar-contract!`).toBe(false)
      expect(vsebina.includes("from './ar-contract'"), `${rel} importira ar-contract (relativno)!`).toBe(false)
      expect(vsebina.includes('ar-contract'), `${rel} omenja ar-contract!`).toBe(false)
    }
  })

  it('FUNKCIONALEN dokaz: parse NE izpeljuje NIČESAR iz produkt referenc — payload ± reference = brez njih deep-enak (invariančni test)', () => {
    const z = parseArSessionPayload(osnova(POLNI_PRODUKT))
    const brez = parseArSessionPayload(osnova(undefined))
    const obrezi = (p: ReturnType<typeof parseArSessionPayload>) => {
      const { profile, color, material, handrail, posts, configuration, ...ostalo } = p.segments[0]
      void profile; void color; void material; void handrail; void posts; void configuration
      return ostalo
    }
    expect(obrezi(z)).toEqual(obrezi(brez))
    // dolžina/geometrijska resnica je IDENTIČNA v obeh — kontrakt ne računa iz referenc
    expect(z.segments[0].lengthMm).toBe(brez.segments[0].lengthMm)
  })

  it('korelacija z R279: superRefine referenčna integriteta ostane AKTIVNA ob produkt referencah (soobstoj — osirotela photoId še vedno zavrnjena)', () => {
    const vhod = osnova(POLNI_PRODUKT, {
      session: {
        photoRefs: [{ ref: 'foto-balkon-a', sha256: 'a'.repeat(64) }],
        glbRefs: [{ ref: 'model-balkon-1', sha256: 'b'.repeat(64) }],
      },
      segment: { photoIds: ['foto-osirotena'] },
    })
    try {
      parseArSessionPayload(vhod)
      expect.unreachable('osirotela photoId mora biti zavrnjena tudi ob produkt referencah')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      expect((e as ArContractError).message).toContain('nič osirotelih referenc')
    }
  })
})

describe('R280 — determinizem, round-trip, matrika (U1/U6)', () => {
  it('round-trip serialize(parse(x)) bajtno identičen (produkt reference verbatim — U5/U6)', () => {
    const vhod = osnova(POLNI_PRODUKT)
    const json1 = JSON.stringify(vhod)
    const json2 = serializeArSessionPayload(parseArSessionPayload(vhod))
    expect(json2).toBe(json1)
    const ponovno = parseArSessionPayload(JSON.parse(json2))
    expect(serializeArSessionPayload(ponovno)).toBe(json2)
  })

  it('determinizem: ista resnica → ista žica', () => {
    const vhod = osnova(POLNI_PRODUKT)
    const a = serializeArSessionPayload(parseArSessionPayload(vhod))
    const b = serializeArSessionPayload(parseArSessionPayload(JSON.parse(JSON.stringify(vhod))))
    expect(a).toBe(b)
  })

  it('contractVersion ostane 1 — aditivna razširitev (U1); matrika nosi R280 + U1–U6 izrečno', () => {
    expect(AR_CONTRACT_VERSION).toBe(1)
    expect(SUPPORTED_AR_CONTRACT_VERSIONS).toEqual([1])
    const parsed = parseArSessionPayload(osnova({ profile: 'WPC-120-A' }))
    expect(parsed.contractVersion).toBe(1)
    const razsiritev = AR_CONTRACT_COMPATIBILITY[1].razsiritev
    expect(razsiritev).toContain('R280')
    expect(razsiritev).toContain('profile/color/material/handrail/posts/configuration')
    expect(razsiritev).toContain('U1–U6')
  })

  it('nepodprta verzija 2 = ISTA vrata (AR_CONTRACT_VERSION_UNSUPPORTED z originalom — regresija R274/R277/R278/R279)', () => {
    const vhod = osnova(POLNI_PRODUKT)
    vhod['contractVersion'] = 2
    try {
      migrateArSessionPayload(vhod)
      expect.unreachable('verzija 2 mora biti zavrnjena')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      const err = e as ArContractError
      expect(err.code).toBe('AR_CONTRACT_VERSION_UNSUPPORTED')
      expect(err.payload).toBe(vhod)
    }
  })
})
