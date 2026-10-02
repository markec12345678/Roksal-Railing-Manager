// R358 — MEASUREMENTS FAZA 11: REPOST družina — 3 preostali per-item tokovi
// (iskrena meja FAZA 10, zdaj prevzeta) na EN gradnik posljiRepostMere + EN
// builder teloRepostaIzMeritve (vzorec FAZA 5–10):
//   • sinhronizacija osnutka (syncSingleDraft — draft.payload VERBATIM, R152),
//   • podvojenost obstoječe meritve (handleDuplicateMeasurement),
//   • kopiranje v segment (handleBulkCopyToSegment — batch po izbranih).
// KLJUČNA RAZLIKA od posljiVnosMere: telo GRADI KLICATELJ (re-post obstoječih
// podatkov — NIČ novih teles, NIČ vsiljenih vrednosti): RepostTelo nosi
// NULLABLE arMetadata/gpsLokacija (vir brez AR/GPS) in gpsLokacija NI vsiljena
// TERENSKA_GPS_TOCKA (no fabricated data — kopija nosi izvorno točko).
// Testi:
// (A) builder: polna meritev (arMetadata + gpsLokacija niza) → telo z 5
//     ključi v stale vrstnem redu projectId→dolzinaMm→visinaMm→arMetadata→
//     gpsLokacija (bajtno identično stale literaloma podvojenosti/kopiranja);
// (B) builder: meritev brez AR/GPS vira → null/null (nič izmišljenega);
// (C) posljiRepostMere uspeh: podatki = odgovor strežnika; body bajtno =
//     JSON.stringify(telo) (ključni vrstni red ohranjen; predhodnikId — kadar
//     prisoten — ostane v telesu, R276 re-post osnutka korekcije);
// (D) posljiRepostMere ne-ok (500) → 'osnutek' z ISTIM telesom (R152 ni
//     fake-success);
// (E) posljiRepostMere omrežna napaka → 'osnutek' z ISTIM telesom (isti
//     per-item tok kot FAZA 9 — gradnik nikoli ne meče);
// (F) NO fabricated data: telo z izvirno GPS točko (≠ terenska) preživi
//     bajtno nespremenjeno; null gps ostane null — gradnik NE vsiljuje
//     TERENSKA_GPS_TOCKA v repostu (v nasprotju s strogo vnosno potjo);
// (G) EN VIR dokaz: tab = 1 uvoz iz ./measurements/vnos-meritve + 9 × await
//     posljiVnosMere + 3 × await posljiRepostMere + builder ×2 klici
//     (podvojenost + kopiranje — stale podvojena telesa izginila) + 0 × POST
//     fetch v tabu + 0 × JSON.parse(m.arMetadata/m.gpsLokacija) + 0 × gps
//     literal;
// (H) determinizem: isti telo ×2 → bajtni isti POST body (100% determinizem);
// (I) UI resnica v UI: preslikava (const data = rezultat.podatki) ostane pri
//     klicatelju — modul NE pozna prikaznih polj, toastov, osnutkov;
// (J) 0 novih hex (logika, ne stil) + regresijski stražar: stale
//     'JSON.stringify(draft.payload)' je izginil iz taba (stringify zdaj v
//     gradniku — EN vir).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  posljiRepostMere,
  teloRepostaIzMeritve,
  TERENSKA_GPS_TOCKA,
} from '@/components/roksal/measurements/vnos-meritve'

const FIKSNI_ODGOVOR = {
  id: 'm-358-a',
  createdAt: '2026-10-02T08:00:00.000Z',
  dolzinaMm: 1800,
  visinaMm: 950,
  projectId: 'p-9',
}

// Polna meritev (AR + GPS vir) — stale oblika podvojenosti/kopiranja.
const MERITEV_POLNA = {
  projectId: 'p-9',
  dolzinaMm: 1800,
  visinaMm: 950,
  arMetadata: '{"tipMeritve":"RAZDALJA","oznaka":"A1"}',
  gpsLokacija: '{"lat":46.0569,"lng":14.5058}',
}

// Meritev brez AR/GPS vira (stale: null/null — nič izmišljenega).
const MERITEV_GOLA = {
  projectId: 'p-9',
  dolzinaMm: 1800,
  visinaMm: 950,
  arMetadata: null,
  gpsLokacija: null,
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

const tab = readFileSync(join(process.cwd(), 'src/components/roksal/measurements-tab.tsx'), 'utf8')
const modul = readFileSync(join(process.cwd(), 'src/components/roksal/measurements/vnos-meritve.ts'), 'utf8')

describe('r358 FAZA 11 — repost družina na EN gradnik (posljiRepostMere + teloRepostaIzMeritve)', () => {
  it('(A) builder: polna meritev → 5 ključi v stale vrstnem redu (bajtno identično stale literaloma podvojenosti/kopiranja)', () => {
    const telo = teloRepostaIzMeritve(MERITEV_POLNA, 'p-fallback')
    // Ključni vrstni red — bajtno isti kot stale telesa R152.
    expect(Object.keys(telo)).toEqual([
      'projectId',
      'dolzinaMm',
      'visinaMm',
      'arMetadata',
      'gpsLokacija',
    ])
    // Vrednosti 1:1 iz meritve (fallback NI uporabljen, ker projectId obstaja).
    expect(telo.projectId).toBe('p-9')
    expect(telo.dolzinaMm).toBe(1800)
    expect(telo.visinaMm).toBe(950)
    expect(telo.arMetadata).toEqual({ tipMeritve: 'RAZDALJA', oznaka: 'A1' })
    expect(telo.gpsLokacija).toEqual({ lat: 46.0569, lng: 14.5058 })
  })

  it('(B) builder: meritev brez AR/GPS vira → null/null (nič izmišljenega — no fabricated data)', () => {
    const telo = teloRepostaIzMeritve(MERITEV_GOLA, 'p-fallback')
    expect(telo.arMetadata).toBeNull()
    expect(telo.gpsLokacija).toBeNull()
    // Fallback projekt vstopi SAMO, ko meritev NIMA projectId (obrambni || —
    // stale vzorec 1:1).
    const telo2 = teloRepostaIzMeritve({ ...MERITEV_GOLA, projectId: '' }, 'p-fallback')
    expect(telo2.projectId).toBe('p-fallback')
  })

  it('(C) posljiRepostMere uspeh: podatki = odgovor strežnika; body bajtno = JSON.stringify(telo) (predhodnikId ohranjen — R276)', async () => {
    // Korekcijski osnutek nosi predhodnikId (R357 popravek) — re-post ga
    // OHRANI (sinhronizacija ustvari verzijo, ne standalone).
    const telo = { ...teloRepostaIzMeritve(MERITEV_POLNA, 'p-9'), predhodnikId: 'm-pred-42' }
    const rezultat = await posljiRepostMere(telo)
    expect(rezultat.izid).toBe('uspeh')
    if (rezultat.izid === 'uspeh') {
      expect(rezultat.podatki).toEqual(FIKSNI_ODGOVOR)
    }
    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string
    // Bajtno identično direktnemu stringify-ju shranjenega telesa (stale
    // JSON.stringify(draft.payload) — kontrakt R152 "točno telo").
    expect(body).toBe(JSON.stringify(telo))
    expect(body).toContain('"predhodnikId":"m-pred-42"')
  })

  it('(D) posljiRepostMere ne-ok (500) → osnutek z ISTIM telesom (R152: ni fake-success)', async () => {
    fetchMock.mockImplementation(async () => new Response('{"error":"x"}', { status: 500 }))
    const telo = teloRepostaIzMeritve(MERITEV_POLNA, 'p-9')
    const rezultat = await posljiRepostMere(telo)
    expect(rezultat.izid).toBe('osnutek')
    if (rezultat.izid === 'osnutek') {
      // ISTI telo kot POST — nič rekonstrukcije (LEKCIJA R357: rekonstrukcija
      // telesa v klicatelju = vzorec razhajanja POST/osnutek).
      expect(rezultat.telo).toBe(telo)
    }
  })

  it('(E) posljiRepostMere omrežna napaka → osnutek z ISTIM telesom (gradnik nikoli ne meče)', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    const telo = teloRepostaIzMeritve(MERITEV_GOLA, 'p-9')
    const rezultat = await posljiRepostMere(telo)
    expect(rezultat.izid).toBe('osnutek')
    if (rezultat.izid === 'osnutek') {
      expect(rezultat.telo).toBe(telo)
    }
  })

  it('(F) NO fabricated data: izvirna GPS točka (≠ terenska) preživi bajtno; null ostane null — repost NE vsiljuje TERENSKA_GPS_TOCKA', async () => {
    await posljiRepostMere(teloRepostaIzMeritve(MERITEV_POLNA, 'p-9'))
    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string
    // Ljubljana točka meritve — NE Kranj (46.2397/14.3556): kopija nosi
    // IZVORNO točko, gradnik je ne prepisuje.
    expect(body).toContain('"lat":46.0569')
    expect(body).not.toContain('46.2397')
    // Gola meritev: null gps NE postane terenska točka.
    await posljiRepostMere(teloRepostaIzMeritve(MERITEV_GOLA, 'p-9'))
    const body2 = (fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string
    expect(body2).toContain('"gpsLokacija":null')
    // Stroga vnosna pot (posljiVnosMere) ostane nespremenjena — kontrakt
    // FAZA 9/10 v ISTEM modulu.
    expect(TERENSKA_GPS_TOCKA).toEqual({ lat: 46.2397, lng: 14.3556 })
    expect(modul).toContain('gpsLokacija: TERENSKA_GPS_TOCKA')
  })

  it('(G) EN VIR dokaz: tab = 1 uvoz + 9 vnosnih + 3 repost klici + builder ×2 + 0 POST fetch + 0 parse literalov + 0 gps', () => {
    expect(tab.match(/from '\.\/measurements\/vnos-meritve'/g)?.length).toBe(1)
    expect(tab.match(/await posljiVnosMere\(/g)?.length).toBe(9)
    expect(tab.match(/await posljiRepostMere\(/g)?.length).toBe(3)
    // Builder ×2 klicna mesta (podvojenost + kopiranje) — stale podvojena
    // telesa (2 × 5 vrstic) izginila.
    expect(tab.match(/teloRepostaIzMeritve\(m, selectedProject\)/g)?.length).toBe(2)
    // 0 × POST fetch na /api/measurements v tabu (vse v gradnikih).
    expect((tab.match(/fetch\('\/api\/measurements', \{\n/g)?.length ?? 0)).toBe(0)
    // 0 × stale parse literalov (zdaj v builderju — EN vir).
    expect((tab.match(/JSON\.parse\(m\.arMetadata\)/g)?.length ?? 0)).toBe(0)
    expect((tab.match(/JSON\.parse\(m\.gpsLokacija\)/g)?.length ?? 0)).toBe(0)
    // 0 × gps literal (R357: 24 → 15 → 0; R358: ostaja 0).
    expect((tab.match(/46\.2397/g)?.length ?? 0)).toBe(0)
  })

  it('(H) determinizem: isti telo ×2 → bajtni isti POST body (100% determinizem)', async () => {
    const telo = teloRepostaIzMeritve(MERITEV_POLNA, 'p-9')
    await posljiRepostMere(telo)
    await posljiRepostMere(telo)
    const b1 = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body
    const b2 = (fetchMock.mock.calls[1] as [string, RequestInit])[1].body
    expect(b1).toBe(b2)
    // Ključni vrstni red — nespremenjen od stale literala.
    expect(Object.keys(JSON.parse(b1 as string))).toEqual([
      'projectId',
      'dolzinaMm',
      'visinaMm',
      'arMetadata',
      'gpsLokacija',
    ])
  })

  it('(I) UI resnica v UI: preslikava ostane pri klicatelju — modul čist (ni toastov, ni setMeasurements, ni osnutkov)', () => {
    // ×9 = FAZA 10 ×6 + R358 FAZA 11 ×3 (sinhronizacija osnutka +
    // podvojenost + kopiranje — vsi trije preslikavajo pri klicatelju).
    expect(tab.match(/const data = rezultat\.podatki/g)?.length).toBe(9)
    expect(modul).not.toContain('from \'sonner\'')
    expect(modul).not.toContain('toast.')
    expect(modul).not.toContain('toast(')
    expect(modul).not.toContain('setMeasurements')
    expect(modul.match(/function createMeasurementDraft/g)).toBeNull()
    // Builder vrača telo; osnutek ustvarja IZKLJUČNO komponenta
    // (createMeasurementDraft ×4 klicna mesta ostanejo v tabu).
    expect(tab.match(/createMeasurementDraft\(/g)?.length).toBeGreaterThan(0)
  })

  it('(J) 0 novih hex + regresijski stražar: stale stringify osnutka izginil iz taba (stringify zdaj v gradniku — EN vir)', () => {
    expect(modul.match(/#[0-9a-fA-F]{6}\b/g)).toBeNull()
    // Stale vzorec — sinhronizacija osnutka je stringificirala v komponenti;
    // zdaj telo potovalo kot OBJEKT v gradnik (stringify EN VIR).
    expect(tab).not.toContain('JSON.stringify(draft.payload)')
    expect(tab).toContain('posljiRepostMere(draft.payload as RepostTelo)')
  })
})
