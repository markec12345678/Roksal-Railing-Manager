// R281 — SYNC METADATA v skupnem kontraktu (issue #16 §10: 'mutation
// identity, revision, base revision/update timestamp, device identity,
// conflict state, sync state in tombstone state, kjer je relevantno').
// Semantične odločitve V1–V6 v glavi src/lib/ar-contract.ts — zapisane
// PRED razvojem po kanonu P/Q/S/T/U:
//   • V1 aditivna v1 (NE v2) — verzija ostane 1, matrika nosi razširitev;
//   • V2 session-level opcijski `sync` strictObject — besednjak 1:1 iz
//     issue §10 in 1:1 z OBSTOJEČIM sync modelom (stropi ENAKI shemi
//     /api/sync/route.ts: 128/64/int ≥ 0); syncState = zaprt besednjak
//     čakalnega vrsta ('synced'|'pending'|'conflict'|'error');
//   • V3 RAZMEJITEV provenance vs. protocol: sync blok = opazovano stanje
//     klienta, NIKOLI sync resnica — resnica ostane v /api/sync
//     (detectSyncConflict 'strežnik ne zaupa klientu', R148); kontrakt
//     NE implementira protokola (issue #17 F STOP) — BOM/geometry/pricing
//     core NE importira kontrakta (strukturni test) + parse NE izpeljuje
//     ničesar iz sync bloka (invariančni test) + ruta /api/sync ostane
//     NEOSLABLJENA (strukturni needleji na detectSyncConflict vez);
//   • V4 izostanek bloka = edini 'brez' — null zavrnjen; syncState
//     OBVEZEN kadar je blok prisoten; tombstone: false = veljavno
//     izrecno stanje (analog 0 iz S5);
//   • V5 verbatim (brez trim/case-fold — kanon odločitev 6);
//   • V6 DB/route NIČ — arMetadata JSON verbatim, brez sheme.
// Zlati fixture (R275) ostaja NESPREMENJEN — v1 brez sync bloka.
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
  AR_SYNC_STATES,
  SUPPORTED_AR_CONTRACT_VERSIONS,
  isArContractPayload,
} from '@/lib/ar-contract'
import golden from './fixtures/ar-session-golden-v1.json'

const ZLATI = golden as Record<string, unknown>

/** Poln veljaven payload z ZLATIMI obveznimi polji + opcijski session-level
 *  sync blok. `sync` = objekt ali undefined (izostanek). */
function osnova(
  sync: Record<string, unknown> | undefined,
  dodatki: { session?: Record<string, unknown>; segment?: Record<string, unknown> } = {},
): Record<string, unknown> {
  return {
    contractVersion: 1,
    appVersion: 'BalkonAR 0.9.2',
    projectId: 'proj-r281',
    sessionId: 'sess-r281',
    source: 'ARCORE_DEPTH',
    units: 'mm',
    coordinateFrame: { type: 'LOCAL_NORMALIZED' },
    ...dodatki.session,
    ...(sync !== undefined ? { sync } : {}),
    segments: [
      {
        segmentId: 'seg-r281-1',
        lengthMm: 3200.75,
        heightMm: 1200,
        ...dodatki.segment,
        source: 'ARCORE_DEPTH',
      },
    ],
  }
}

const POLNI_SYNC = {
  mutationId: 'mut-2026-09-29-001',
  deviceId: 'device-pixel-8-pro',
  baseRevision: 3,
  baseUpdatedAt: '2026-09-29T07:15:00Z',
  syncRevision: 7,
  syncState: 'synced',
  tombstone: false,
}

describe('R281 sync metadata — sprejetje (issue #16 §10, V2: 1:1 issue besednjak)', () => {
  it('poln sync blok preide shemo verbatim — vsa §10 polja (mutation identity, revision, base revision/timestamp, device identity, sync state, tombstone)', () => {
    const parsed = parseArSessionPayload(osnova(POLNI_SYNC))
    expect(parsed.sync).toEqual(POLNI_SYNC)
  })

  it('syncState: vsi štirje zaprti besednjak veljavni — synced/pending/conflict/error (V2; §13 offline vrsta)', () => {
    for (const stanje of AR_SYNC_STATES) {
      const parsed = parseArSessionPayload(osnova({ syncState: stanje }))
      expect(parsed.sync?.syncState).toBe(stanje)
    }
  })

  it('tombstone: true (lokalno za brisanje) IN false (izrecno NE grobnica) sta VELJAVNI realni stanji (V4 — analog 0 iz S5)', () => {
    expect(parseArSessionPayload(osnova({ syncState: 'pending', tombstone: true })).sync?.tombstone).toBe(true)
    expect(parseArSessionPayload(osnova({ syncState: 'pending', tombstone: false })).sync?.tombstone).toBe(false)
  })

  it('vsako opcijsko polje NEODVISNO opcijsko — samo syncState (obvezno jedro bloka, V4) = veljavno', () => {
    const parsed = parseArSessionPayload(osnova({ syncState: 'conflict' }))
    expect(parsed.sync).toEqual({ syncState: 'conflict' })
  })

  it('baseRevision 0 in syncRevision 0 sta VELJAVNI reviziji (int ≥ 0 = shema /api/sync; R148 vzorec)', () => {
    const parsed = parseArSessionPayload(osnova({ syncState: 'error', baseRevision: 0, syncRevision: 0 }))
    expect(parsed.sync?.baseRevision).toBe(0)
    expect(parsed.sync?.syncRevision).toBe(0)
  })

  it('izostanek sync bloka = klient NI poročal sync stanja (iskrena praznina) — zlati fixture ostaja veljaven (V4)', () => {
    const parsed = parseArSessionPayload(osnova(undefined))
    expect(parsed.sync).toBeUndefined()
    const zlatiParsed = parseArSessionPayload(ZLATI)
    expect(zlatiParsed.sync).toBeUndefined()
  })
})

describe('R281 — fail-closed strogost (V2/V4/V5 + strict odločitev 3)', () => {
  it('ekspliciten null sync blok = ZAVRJEN (V4 — izostanek je edini "brez"; null ni vrednost)', () => {
    expect(() => parseArSessionPayload(osnova(null as unknown as Record<string, unknown>))).toThrow(ArContractError)
  })

  it('blok brez syncState = ZAVRJEN (V4 — blok brez stanja je dvosmerna izjava; analog U4 prazen niz)', () => {
    expect(() => parseArSessionPayload(osnova({ deviceId: 'device-x' }))).toThrow(ArContractError)
    expect(() => parseArSessionPayload(osnova({}))).toThrow(ArContractError)
  })

  it('neznan syncState = ZAVRJEN (zaprt besednjak — nič ugibanja; case-fold ne obstaja)', () => {
    expect(() => parseArSessionPayload(osnova({ syncState: 'SYNCED' }))).toThrow(ArContractError)
    expect(() => parseArSessionPayload(osnova({ syncState: 'najina' }))).toThrow(ArContractError)
    expect(() => parseArSessionPayload(osnova({ syncState: '' }))).toThrow(ArContractError)
  })

  it('neznano polje v sync bloku = ZAVRJENO (strict nested — odločitev 3 velja na VSEH nivojih)', () => {
    expect(() => parseArSessionPayload(osnova({ syncState: 'synced', syncovan: true }))).toThrow(ArContractError)
    expect(() => parseArSessionPayload(osnova({ syncState: 'synced', revision: 3 }))).toThrow(ArContractError)
  })

  it('stropi = shema /api/sync (V5 — ENA resnica o mejah): mutationId/deviceId 128, baseUpdatedAt 64', () => {
    const s128 = 'x'.repeat(128)
    const s64 = 'x'.repeat(64)
    const ok = parseArSessionPayload(
      osnova({ syncState: 'synced', mutationId: s128, deviceId: s128, baseUpdatedAt: s64 }),
    )
    expect(ok.sync?.mutationId).toHaveLength(128)
    expect(() =>
      parseArSessionPayload(osnova({ syncState: 'synced', mutationId: 'x'.repeat(129) })),
    ).toThrow(ArContractError)
    expect(() =>
      parseArSessionPayload(osnova({ syncState: 'synced', deviceId: 'x'.repeat(129) })),
    ).toThrow(ArContractError)
    expect(() =>
      parseArSessionPayload(osnova({ syncState: 'synced', baseUpdatedAt: 'x'.repeat(65) })),
    ).toThrow(ArContractError)
  })

  it('prazen niz mutationId/deviceId/baseUpdatedAt = ZAVRJEN (min(1) — izostanek je edini "brez")', () => {
    expect(() => parseArSessionPayload(osnova({ syncState: 'synced', mutationId: '' }))).toThrow(ArContractError)
    expect(() => parseArSessionPayload(osnova({ syncState: 'synced', deviceId: '' }))).toThrow(ArContractError)
    expect(() => parseArSessionPayload(osnova({ syncState: 'synced', baseUpdatedAt: '' }))).toThrow(ArContractError)
  })

  it('baseRevision/syncRevision: negativno, necelo, niz, null = VSE ZAVRJENE (int ≥ 0 = shema /api/sync — ne tiho uporabljeno)', () => {
    for (const slabo of [-1, 2.5, 'dva', null]) {
      expect(() =>
        parseArSessionPayload(osnova({ syncState: 'synced', baseRevision: slabo as unknown as number })),
      ).toThrow(ArContractError)
      expect(() =>
        parseArSessionPayload(osnova({ syncState: 'synced', syncRevision: slabo as unknown as number })),
      ).toThrow(ArContractError)
    }
  })

  it('tombstone: string in null ZAVRJENA (boolean — V4)', () => {
    expect(() =>
      parseArSessionPayload(osnova({ syncState: 'synced', tombstone: 'ne' as unknown as boolean })),
    ).toThrow(ArContractError)
    expect(() =>
      parseArSessionPayload(osnova({ syncState: 'synced', tombstone: null as unknown as boolean })),
    ).toThrow(ArContractError)
  })

  it('V5 VERBATIM: presledki na robovih in velikost ostanejo — brez trim/case-fold ("DEV-01" ≠ "dev-01")', () => {
    const parsed = parseArSessionPayload(
      osnova({ syncState: 'synced', mutationId: '  mut-001  ', deviceId: 'DEV-01' }),
    )
    expect(parsed.sync?.mutationId).toBe('  mut-001  ')
    expect(parsed.sync?.deviceId).toBe('DEV-01')
    expect(() =>
      parseArSessionPayload(osnova({ syncState: 'synced', deviceId: 'dev-01' })),
    ).not.toThrow()
  })
})

describe('R281 — V3 RAZMEJITEV provenance vs. protocol (glavna odločitev runde)', () => {
  it('STRUKTURNI dokaz: BOM/geometry/pricing/railing core moduli NE importirajo ar-contract (sync resnica ne teče skozi business)', () => {
    const coreji = [
      'src/lib/bom/engine.ts',
      'src/lib/geometry/engine.ts',
      'src/lib/railing-layout.ts',
      'src/lib/pricing/calculator.ts',
      'src/lib/quote/engine.ts',
    ]
    const obstoječi = coreji.filter((pot) => {
      try {
        return readFileSync(join(process.cwd(), pot), 'utf8').includes("from '@/lib/ar-contract'")
      } catch {
        return false // modul ne obstaja v tem repozitoriju — nič dokazati
      }
    })
    expect(obstoječi).toEqual([])
  })

  it('STRUKTURNI dokaz V6: /api/sync ruta ostane NEOSLABLJENA — detectSyncConflict vez + baseRevision/mutationId/tombstone besednjak še vedno v resnici rute', () => {
    const ruta = readFileSync(join(process.cwd(), 'src/app/api/sync/route.ts'), 'utf8')
    expect(ruta).toContain('detectSyncConflict')
    expect(ruta).toContain('baseRevision')
    expect(ruta).toContain('baseUpdatedAt')
    expect(ruta).toContain('mutationId')
    expect(ruta).toContain('tombstone')
    expect(ruta).toContain('syncRevision')
  })

  it('FUNKCIONALEN dokaz: parse NE izpeljuje NIČESAR iz sync bloka — payload ± sync = brez njega deep-enak (invariančni test)', () => {
    const zSync = parseArSessionPayload(osnova(POLNI_SYNC))
    const brezSync = parseArSessionPayload(osnova(undefined))
    const { sync: odstranjen, ...ostanek } = zSync as Record<string, unknown> & { sync?: unknown }
    expect(odstranjen).toBeDefined()
    expect(ostanek).toEqual(brezSync)
  })

  it('legacy diskriminator: objekt z SAMO sync poljem (brez contractVersion) NI kontrakt payload — legacy vrata ostanejo nespremenjena', () => {
    expect(isArContractPayload({ sync: POLNI_SYNC })).toBe(false)
    expect(isArContractPayload(POLNI_SYNC)).toBe(false)
  })
})

describe('R281 — determinizem, round-trip, matrika (V1/V5/V6)', () => {
  it('round-trip serialize(parse(x)) bajtno identičen (sync blok verbatim — V5/V6)', () => {
    const vhod = osnova(POLNI_SYNC)
    const zica = serializeArSessionPayload(parseArSessionPayload(vhod))
    expect(serializeArSessionPayload(parseArSessionPayload(JSON.parse(zica)))).toBe(zica)
  })

  it('determinizem: ista resnica → ista žica (brez ure/locale/naključja)', () => {
    const a = serializeArSessionPayload(parseArSessionPayload(osnova(POLNI_SYNC)))
    const b = serializeArSessionPayload(parseArSessionPayload(osnova(POLNI_SYNC)))
    expect(a).toBe(b)
  })

  it('contractVersion ostane 1 — aditivna razširitev (V1); matrika nosi R281 + V1–V6 izrečno', () => {
    expect(AR_CONTRACT_VERSION).toBe(1)
    expect(SUPPORTED_AR_CONTRACT_VERSIONS).toEqual([1])
    const razsiritev = AR_CONTRACT_COMPATIBILITY[1].razsiritev
    expect(razsiritev).toContain('R281')
    expect(razsiritev).toContain('V1–V6')
    expect(razsiritev).toContain('sync')
  })

  it('nepodprta verzija 2 = ISTA vrata (AR_CONTRACT_VERSION_UNSUPPORTED z originalom — regresija R274/R277/R278/R279/R280)', () => {
    const vhod = { ...osnova(POLNI_SYNC), contractVersion: 2 }
    try {
      migrateArSessionPayload(vhod)
      expect.unreachable('migracija mora zavrniti v2')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      const napaka = e as ArContractError
      expect(napaka.code).toBe('AR_CONTRACT_VERSION_UNSUPPORTED')
      expect(napaka.payload).toEqual(vhod)
    }
  })

  it('korelacija z R279: superRefine referenčna integriteta ostane AKTIVNA ob sync bloku (soobstoj — osirotela photoId še vedno zavrnjena)', () => {
    const vhod = osnova(POLNI_SYNC, { segment: { photoIds: ['osirocena-ref'] } })
    try {
      parseArSessionPayload(vhod)
      expect.unreachable('osirotela referenca mora ostati zavrnjena')
    } catch (e) {
      expect(e).toBeInstanceOf(ArContractError)
      expect((e as ArContractError).code).toBe('AR_CONTRACT_VALIDACIJA')
      expect((e as ArContractError).message).toContain('nič osirotelih referenc')
    }
  })
})
