// R356 — MEASUREMENTS FAZA 9: vnos meritve POST orkestracija →
// measurements/vnos-meritve.ts (vzorec FAZA 5/R348, FAZA 6/R349,
// FAZA 7/R350, FAZA 8/R354 teren-izvozi). Testi:
// (A) uspeh: POST telesa VERBATIM (ključni vrstni red + gps konstanta) +
//     odgovor = podatki;
// (B) ne-ok odgovor → osnutek z ISTIM tełom (R152 — ni fake-success);
// (C) omrežna napaka (fetch rejects) → osnutek z ISTIM tełom (R152);
// (D) telo = ENA definicija: TERENSKA_GPS_TOCKA (46.2397 / 14.3556 — Kranj,
//     R166 izvor; NIč novih podatkov, samo ENA definicija);
// (E) determinizem: isti vhod ×2 → bajtno isti POST body;
// (F) EN VIR dokaz: tab = 1 uvoz + 9 klici posljiVnosMere (R356: 3 —
//     stopniščni čarovnik + WPC palice + steber; R357 FAZA 10: +6 — vnos
//     forma, nagib, kotomer, predloga, AR uvoz ×2 zanki); gps literali v
//     tabu 24 → 15 (R356) → 0 (R357 FAZA 10 — vsi v gradniku);
// (G) UI resnica v UI: createMeasurementDraft nosi rezultat.telo ×9 v tabu
//     (osnutek ostane komponenta — zapira stanje + revizijsko sled) + lib
//     NE pozna toastov (0 × sonner/toast v modulu);
// (H) kontrakt oblike: VnosMereTelo + VnosMereZahteva + RezultatVnosaMere
//     (uspeh/osnutek) + TERENSKA_GPS_TOCKA izvoženi;
// (I) preslikava ostane pri klicatelju: prikazna polja (tipMeritve/oznaka/
//     tipStebra/…) v tabu, NISO v modulu;
// (J) 0 novih hex (modul je logika, ne stil).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const FIKSNI_ODGOVOR = {
  id: 'm-356-a',
  createdAt: '2026-10-01T12:00:00.000Z',
  dolzinaMm: 1200,
  visinaMm: 1100,
  projectId: 'p-1',
}

const ZAHTEVA = {
  projectId: 'p-1',
  dolzinaMm: 1200,
  visinaMm: 1100,
  arMetadata: {
    tipMeritve: 'STEBR',
    oznaka: 'S1',
    segmentId: 'seg-1',
    opomba: 'Stebriček S1 — test',
    status: 'OSNUTEK',
    enota: 'mm',
  },
} as const

const PricakovanTelo = {
  projectId: 'p-1',
  dolzinaMm: 1200,
  visinaMm: 1100,
  arMetadata: ZAHTEVA.arMetadata,
  gpsLokacija: { lat: 46.2397, lng: 14.3556 },
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async () =>
    new Response(JSON.stringify(FIKSNI_ODGOVOR), { status: 200 })
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

import {
  posljiVnosMere,
  TERENSKA_GPS_TOCKA,
} from '@/components/roksal/measurements/vnos-meritve'

const tab = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const modul = readFileSync(join(process.cwd(), 'src/components/roksal/measurements/vnos-meritve.ts'), 'utf8')

describe('r356 FAZA 9 — vnos meritve POST orkestracija (vnos-meritve.ts)', () => {
  it('(A) uspeh: POST /api/measurements z bajtno VERBATIM telesom (vrstni red projectId→dolzinaMm→visinaMm→arMetadata→gpsLokacija) + odgovor = podatki', async () => {
    const r = await posljiVnosMere(ZAHTEVA)
    expect(r.izid).toBe('uspeh')
    if (r.izid === 'uspeh') {
      expect(r.podatki).toEqual(FIKSNI_ODGOVOR)
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/measurements')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    // Bajtni kontrakt: ISTI ključni vrstni red kot stale literali ×9.
    expect(init.body).toBe(JSON.stringify(PricakovanTelo))
  })

  it('(B) ne-ok odgovor (500) → { izid: osnutek, telo } — telo = ISTI payload kot POST (R152: ni fake-success)', async () => {
    fetchMock.mockImplementation(async () => new Response('{"error":"x"}', { status: 500 }))
    const r = await posljiVnosMere(ZAHTEVA)
    expect(r).toEqual({ izid: 'osnutek', telo: PricakovanTelo })
    // telo = ISTI payload, ki ga je videl strežnik (brez ponovnega literala):
    expect((r as { telo: unknown }).telo).toEqual(
      JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)
    )
  })

  it('(C) omrežna napaka (fetch rejects) → { izid: osnutek, telo } — napaka se NIKOLI ne pogoltne v lažni uspeh', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    const r = await posljiVnosMere(ZAHTEVA)
    expect(r).toEqual({ izid: 'osnutek', telo: PricakovanTelo })
  })

  it('(D) TERENSKA_GPS_TOCKA = { lat: 46.2397, lng: 14.3556 } — obstoječa Kranj vrednost (R166 izvor), ENA definicija', () => {
    expect(TERENSKA_GPS_TOCKA).toEqual({ lat: 46.2397, lng: 14.3556 })
    expect(modul).toContain('export const TERENSKA_GPS_TOCKA')
  })

  it('(E) determinizem: isti vhod ×2 → bajtno isti POST body (100% determinizem)', async () => {
    await posljiVnosMere(ZAHTEVA)
    await posljiVnosMere(ZAHTEVA)
    const b1 = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body
    const b2 = (fetchMock.mock.calls[1] as [string, RequestInit])[1].body
    expect(b1).toBe(b2)
    expect(b1).toBe(JSON.stringify(PricakovanTelo))
  })

  it('(F) EN VIR dokaz: tab = 1 uvoz + 9 klici await posljiVnosMere (3× FAZA 9 + 6× FAZA 10); gps literali v tabu 24 → 15 → 0 (R357 FAZA 10 — vsi v gradniku)', () => {
    expect(tab.match(/import \{ posljiVnosMere \} from '\.\/measurements\/vnos-meritve'/g)?.length).toBe(1)
    // Zgodovina števca klicev: R356 = 3 (FAZA 9 bratje); R357 FAZA 10 = 9
    // (+ vnos forma, nagib, kotomer, predloga, AR uvoz ×2 zanki).
    expect(tab.match(/await posljiVnosMere\(/g)?.length).toBe(9)
    // Zgodovina števca gps: R355 stanje = 24; R356 FAZA 9 odstrani 9 (3
    // bratje × POST+osnutek-ne-ok+osnutek-napaka); R357 FAZA 10 odstrani
    // preostalih 15 (5 enojnih tokov) — vse prek TERENSKA_GPS_TOCKA.
    expect((tab.match(/46\.2397/g)?.length ?? 0)).toBe(0)
  })

  it('(G) UI resnica v UI: createMeasurementDraft nosi rezultat.telo ×9 v tabu (3× FAZA 9 + 6× FAZA 10 — R357) + modul NE pozna toastov (0 × sonner/toast)', () => {
    // Zgodovina: R356 = 3 single-line klici; R357 FAZA 10 = 9 skupno
    // (4 single-line + 5 multiline — štejemo VSE pojavitve rezultat.telo).
    expect(tab.match(/rezultat\.telo/g)?.length).toBe(9)
    expect(modul).not.toContain('from \'sonner\'')
    expect(modul).not.toContain('toast.')
    expect(modul).not.toContain('toast(')
  })

  it('(H) kontrakt oblike: VnosMereTelo + VnosMereZahteva + RezultatVnosaMere (uspeh|osnutek) izvoženi z readonly polji', () => {
    expect(modul).toContain('export type VnosMereTelo = {')
    expect(modul).toContain('export interface VnosMereZahteva {')
    expect(modul).toContain("export type RezultatVnosaMere =")
    expect(modul).toContain("| { readonly izid: 'uspeh'; readonly podatki: Measurement }")
    expect(modul).toContain("| { readonly izid: 'osnutek'; readonly telo: VnosMereTelo }")
  })

  it('(I) preslikava odgovora ostane pri klicatelju: prikazna polja v tabu (3× …rezultat.podatki,), NISO v modulu', () => {
    // vsak brat razširi odgovor s svojimi prikaznimi polji (bajtno ista
    // preslikava kot stale telesa) — modul ne ve nič o prikazu.
    expect(tab.match(/\.\.\.rezultat\.podatki,/g)?.length).toBe(3)
    expect(modul).not.toContain('tipStebra')
    expect(modul).not.toContain('kotStopinje')
    expect(modul).not.toContain('setMeasurements')
  })

  it('(J) 0 novih hex v modulu (logika, ne stil)', () => {
    expect(modul.match(/#[0-9a-fA-F]{6}\b/g)).toBeNull()
  })
})
