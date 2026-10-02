// R357 — MEASUREMENTS FAZA 10: 5 enojnih vnosnih tokov migriranih na EN
// gradnik posljiVnosMere (vzorec FAZA 9/R356): handleSubmitMeasurement
// (vnos forma), saveInclinometerReading (nagib), saveKotomerReading
// (kotomer), handleApplyPredloga (predloge), handleImportFromAr (AR uvoz —
// 2 zanki: RAZDALJA pari + STEBR točke). Testi:
// (A) predhodnikId (R276 korekcijska veriga): telo vsebuje predhodnikId kot
//     ZADNJI ključ — bajtno isti vrstni red kot stale telo korekcije
//     (dodeljen PO konstrukciji);
// (B) brez predhodnikId: ključ NE obstaja v JSON telesu (bajtno identično
//     stale telesom brez korekcije — opcionalen ključ, ne null/undefined);
// (C) R357 POPRAVEK stale buga: osnutek korekcije NOSI predhodnikId v OBEH
//     neuspešnih vejah (ne-ok IN omrežna napaka) — stale catch-veja je telo
//     rekonstruirala BREZ predhodnikId (kršitev kontrakta R276: sinhroni-
//     zacija bi ustvarila standalone namesto verzije);
// (D) EN VIR dokaz: tab = 1 uvoz + 9 klici await posljiVnosMere + 0 ×
//     gps literal (24 → 15 R356 → 0 R357); preostali 3 POST fetchi = druge
//     vrste [sinhronizacija osnutka re-pošlje draft.payload VERBATIM,
//     podvojenost/kopiranje re-pošljeta obstoječo meritev] — NI novih
//     gradenj teles, zato izven FAZA 10 klastra (iskrena meja);
// (E) determinizem: korekcijski vhod ×2 → bajtno isti POST body;
// (F) UI resnica v UI: rezultat.telo ×9 v createMeasurementDraft klicih +
//     preslikava (const data = rezultat.podatki → …data) ostane pri
//     klicatelju — modul NE pozna prikaznih polj;
// (G) kontrakt oblike: VnosMereTelo + VnosMereZahteva nosita
//     `readonly predhodnikId?: string`;
// (H) stale buggy rekonstrukcija IZGINILA: 0 × `gpsLokacija: { lat:` v tabu
//     (regresijski stražar — rekonstrukcija telesa v klicatelju je vzorec,
//     ki je povzročil razhajanje POST/osnutek);
// (I) modul ostane čist: ni toastov, ni setMeasurements, ni osnutkov;
// (J) 0 novih hex (logika, ne stil).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  posljiVnosMere,
  TERENSKA_GPS_TOCKA,
} from '@/components/roksal/measurements/vnos-meritve'

const FIKSNI_ODGOVOR = {
  id: 'm-357-a',
  createdAt: '2026-10-02T06:00:00.000Z',
  dolzinaMm: 2400,
  visinaMm: 1100,
  projectId: 'p-1',
}

const KOREKCIJA_ZAHTEVA = {
  projectId: 'p-1',
  dolzinaMm: 2400,
  visinaMm: 1100,
  arMetadata: {
    tipMeritve: 'RAZDALJA',
    oznaka: 'v1',
    status: 'OSNUTEK',
  },
  predhodnikId: 'm-pred-42',
} as const

const OBICAJNA_ZAHTEVA = {
  projectId: 'p-1',
  dolzinaMm: 2400,
  visinaMm: 1100,
  arMetadata: {
    tipMeritve: 'RAZDALJA',
    oznaka: 'v1',
    status: 'OSNUTEK',
  },
} as const

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

const tab = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const modul = readFileSync(join(process.cwd(), 'src/components/roksal/measurements/vnos-meritve.ts'), 'utf8')

describe('r357 FAZA 10 — 5 enojnih tokov na EN gradnik (vnos-meritve.ts)', () => {
  it('(A) predhodnikId = ZADNJI ključ v telesu (bajtno isti vrstni red kot stale telo korekcije — dodeljen PO konstrukciji)', async () => {
    await posljiVnosMere(KOREKCIJA_ZAHTEVA)
    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string
    const kljuci = Object.keys(JSON.parse(body))
    expect(kljuci).toEqual([
      'projectId',
      'dolzinaMm',
      'visinaMm',
      'arMetadata',
      'gpsLokacija',
      'predhodnikId',
    ])
    // Vrednost korekcijske verige (R276): identifikator predhodnika.
    expect(JSON.parse(body).predhodnikId).toBe('m-pred-42')
  })

  it('(B) brez predhodnikId: ključ NE obstaja v JSON telesu (bajtno identično stale telesom brez korekcije)', async () => {
    await posljiVnosMere(OBICAJNA_ZAHTEVA)
    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string
    const razclenjeno = JSON.parse(body) as Record<string, unknown>
    expect('predhodnikId' in razclenjeno).toBe(false)
    expect(body).not.toContain('predhodnikId')
    // Ključni vrstni red 5 osnovnih polj — nespremenjen od stale literala.
    expect(Object.keys(razclenjeno)).toEqual([
      'projectId',
      'dolzinaMm',
      'visinaMm',
      'arMetadata',
      'gpsLokacija',
    ])
  })

  it('(C) R357 popravek: osnutek korekcije NOSI predhodnikId v OBEH neuspešnih vejah (ne-ok IN omrežna napaka — kontrakt R276)', async () => {
    // Veja 1: ne-ok odgovor (500)
    fetchMock.mockImplementation(async () => new Response('{"error":"x"}', { status: 500 }))
    const r1 = await posljiVnosMere(KOREKCIJA_ZAHTEVA)
    expect(r1.izid).toBe('osnutek')
    expect((r1 as { telo: { predhodnikId?: string } }).telo.predhodnikId).toBe('m-pred-42')
    // Veja 2: omrežna napaka — stale catch-veja je tu telo REKONSTRUIRALA
    // brez predhodnikId → sinhronizacija bi ustvarila standalone (bug);
    // gradnik nosi ISTO telo kot POST v obeh vejah.
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    const r2 = await posljiVnosMere(KOREKCIJA_ZAHTEVA)
    expect(r2.izid).toBe('osnutek')
    expect((r2 as { telo: { predhodnikId?: string } }).telo.predhodnikId).toBe('m-pred-42')
    // Obe telo bajtno identična (EN vir, nič rekonstrukcije).
    expect((r1 as { telo: unknown }).telo).toEqual((r2 as { telo: unknown }).telo)
  })

  it('(D) EN VIR dokaz: tab = 1 uvoz + 9 klici + 0 × gps literal (24 → 15 → 0); 3 preostali POST fetchi = druge vrste (iskrena meja)', () => {
    expect(tab.match(/import \{ posljiVnosMere \} from '\.\/measurements\/vnos-meritve'/g)?.length).toBe(1)
    expect(tab.match(/await posljiVnosMere\(/g)?.length).toBe(9)
    expect((tab.match(/46\.2397/g)?.length ?? 0)).toBe(0)
    // Preostali 3 POST /api/measurements klici NE gradijo teles (ni novih
    // gps/gradenj): sinhronizacija osnutka re-pošlje draft.payload,
    // podvojenost/kopiranje re-pošljeta obstoječo meritev.
    const postKlici = tab.match(/fetch\('\/api\/measurements', \{\n/g)?.length ?? 0
    expect(postKlici).toBe(3)
    expect(tab).toContain('JSON.stringify(draft.payload)')
  })

  it('(E) determinizem: korekcijski vhod ×2 → bajtni isti POST body (100% determinizem)', async () => {
    await posljiVnosMere(KOREKCIJA_ZAHTEVA)
    await posljiVnosMere(KOREKCIJA_ZAHTEVA)
    const b1 = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body
    const b2 = (fetchMock.mock.calls[1] as [string, RequestInit])[1].body
    expect(b1).toBe(b2)
    expect(b1).toContain('"predhodnikId":"m-pred-42"')
    // gps = ENA definicija (Kranj, R166) — nespremenjena.
    expect(b1).toContain('"gpsLokacija":{"lat":46.2397,"lng":14.3556}')
  })

  it('(F) UI resnica v UI: preslikava odgovora ostane pri klicatelju (const data = rezultat.podatki ×6) — modul ne ve nič o prikazu', () => {
    // FAZA 10 klicatelji razširijo odgovor s svojimi prikaznimi poljami
    // (bajtno ista preslikava kot stale telesa — vzorec preslikave pri
    // klicatelju iz FAZA 9).
    expect(tab.match(/const data = rezultat\.podatki/g)?.length).toBe(6)
    expect(modul).not.toContain('tipStebra')
    expect(modul).not.toContain('kotStopinje')
    expect(modul).not.toContain('setMeasurements')
  })

  it('(G) kontrakt oblike: VnosMereTelo + VnosMereZahteva nosita opcionalen readonly predhodnikId (R276)', () => {
    expect(modul).toContain('readonly predhodnikId?: string')
    // Ena definicija tipa v modulu (ni podvojenih deklaracij).
    expect(modul.match(/readonly predhodnikId\?: string/g)?.length).toBe(2)
  })

  it('(H) regresijski stražar: buggy rekonstrukcija telesa IZGINILA — 0 × `gpsLokacija: { lat:` v tabu', () => {
    // Vzorec, ki je povzročil razhajanje POST/osnutek (stale catch-veja
    // handleSubmitMeasurement je rekonstruirala telo brez predhodnikId),
    // je iz taba popolnoma izginil — telo gradi IZKLJUČNO gradnik.
    expect((tab.match(/gpsLokacija: \{ lat:/g)?.length ?? 0)).toBe(0)
    expect(TERENSKA_GPS_TOCKA).toEqual({ lat: 46.2397, lng: 14.3556 })
  })

  it('(I) modul ostane čist: ni toastov, ni sonner, ni localStorage osnutkov (UI resnica v UI)', () => {
    expect(modul).not.toContain('from \'sonner\'')
    expect(modul).not.toContain('toast.')
    expect(modul).not.toContain('toast(')
    // Ustvarjanje osnutkov je IZKLJUČNO komponenta (modul vrača telo; UI
    // ga posreduje createMeasurementDraft — komentar v modulu to dokumentira).
    expect(modul.match(/function createMeasurementDraft/g)).toBeNull()
    expect(modul).not.toContain('localStorage')
  })

  it('(J) 0 novih hex v modulu (logika, ne stil)', () => {
    expect(modul.match(/#[0-9a-fA-F]{6}\b/g)).toBeNull()
  })
})
