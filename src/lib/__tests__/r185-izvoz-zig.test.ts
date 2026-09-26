// R185 — izvoz telemetrije (CSV) + podrobnost 'Zgrajeno' v bannerju.
// ---------------------------------------------------------------------------
// Dve novi funkcionalnosti na čistih jedrih (vzorec posodobitev-jedro /
// osvezitev-fokus — jedro testabilno, komponenta samo žičenje):
//  1. IZVOZ CSV (telemetrija-csv.ts + rate-limit-panel gumb): mašinetno
//     berljiv arhiv telemetrije blokad za lastnika — BOM + ';' (Excel sl-SI),
//     vrstni red = API red (determinističen), PII zaščita (odtis MORA biti
//     10-hex), fail-closed TypeErrors, izvoz SAMO iz uspešno branega stanja.
//  2. 'ZGRADENO' PODROBNOST (posodobitev-jedro.zigIzpis + update-banner):
//     banner pokaže, KDAJ je nov build narejen — uporabnik vidi, kako
//     zastarel je tab. Eksplicitni pas Europe/Ljubljana (nauček R180), ura
//     iz EN VIR casOznaka; nasvetna podrobnost — pokvarjen žig NE razbije
//     pasu (fail-soft izris, fail-closed jedro).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  izvozImeDatoteke,
  telemetrijaCsv,
  telemetrijaCsvVrstice,
} from '../telemetrija-csv'
import { aliJeNovaVerzijaNaVoljo, zigIzpis } from '../posodobitev-jedro'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

const OK_VNOS = {
  stats: { keys: 2, hits: 25 },
  tripsTotal: 3,
  trips: [
    { kind: 'login', keyHash: 'a1b2c3d4e5', count: 2, lastAt: Date.parse('2026-09-26T19:25:52.000Z') },
    { kind: 'portal', keyHash: 'f6e5d4c3b2', count: 1, lastAt: Date.parse('2026-09-26T19:15:52.000Z') },
  ],
}

describe('R185 — jedro (telemetrija-csv.ts): izvoz, determinizem, fail-closed', () => {
  it('prazno polje tripov → SAMO glava (veljaven CSV mirnega obdobja) + BOM', () => {
    const csv = telemetrijaCsv({ stats: { keys: 0, hits: 0 }, tripsTotal: 0, trips: [] })
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const vrstice = csv.slice(1).split('\r\n')
    expect(vrstice).toHaveLength(1)
    expect(vrstice[0]).toBe('kategorija;odtis;blokad;zadnja_blokada')
  })

  it('polna tabela: glava + vrstice v vrstnem redu vhoda, lastAt = ISO 8601', () => {
    const csv = telemetrijaCsv(OK_VNOS)
    const vrstice = csv.slice(1).split('\r\n')
    expect(vrstice).toHaveLength(3)
    expect(vrstice[1]).toBe('login;a1b2c3d4e5;2;2026-09-26T19:25:52.000Z')
    expect(vrstice[2]).toBe('portal;f6e5d4c3b2;1;2026-09-26T19:15:52.000Z')
  })

  it('determinizem: isti vnos → IDENTIČEN izpis (×2 klica)', () => {
    expect(telemetrijaCsv(OK_VNOS)).toBe(telemetrijaCsv(OK_VNOS))
    expect(telemetrijaCsvVrstice(OK_VNOS)).toEqual(telemetrijaCsvVrstice(OK_VNOS))
  })

  it('izhod vrstic = vrstni red vhoda (API je že urejen count ↓ — jedro NE preureja)', () => {
    const obrnjeno = { ...OK_VNOS, trips: [...OK_VNOS.trips].reverse() }
    const vrstice = telemetrijaCsvVrstice(obrnjeno).slice(1)
    expect(vrstice[0]).toContain('portal;f6e5d4c3b2')
    expect(vrstice[1]).toContain('login;a1b2c3d4e5')
  })

  it('izhod RFC 4180: polje z \';\' se ovije v navedke, navedek podvoji', () => {
    const vrstice = telemetrijaCsvVrstice({
      stats: { keys: 1, hits: 1 },
      tripsTotal: 1,
      trips: [{ kind: 'a;b"c', keyHash: '1234567890', count: 1, lastAt: Date.parse('2026-09-26T19:00:00.000Z') }],
    })
    expect(vrstice[1]).toContain('"a;b""c";1234567890')
  })

  it('PII zaščita: keyHash, ki NI 10-hex odtis (surov ključ), jedro ZAVRNE', () => {
    expect(() =>
      telemetrijaCsvVrstice({
        stats: { keys: 1, hits: 1 },
        tripsTotal: 1,
        trips: [{ kind: 'login', keyHash: 'login:1.2.3.4:a@roksal.si', count: 1, lastAt: Date.now() }],
      }),
    ).toThrow(TypeError)
    expect(() =>
      telemetrijaCsvVrstice({
        stats: { keys: 1, hits: 1 },
        tripsTotal: 1,
        trips: [{ kind: 'login', keyHash: 'a1b2c3d4e5f6', count: 1, lastAt: Date.now() }],
      }),
    ).toThrow(TypeError)
  })

  it('fail-closed: pokvarjen vnos → TypeError (vnos/stats/trips/count/lastAt)', () => {
    expect(() => telemetrijaCsvVrstice(null as unknown as never)).toThrow(TypeError)
    expect(() =>
      telemetrijaCsvVrstice({ stats: { keys: 'x' as unknown as number, hits: 0 }, tripsTotal: 0, trips: [] }),
    ).toThrow(TypeError)
    expect(() =>
      telemetrijaCsvVrstice({ stats: { keys: 0, hits: 0 }, tripsTotal: 0, trips: 'ne' as unknown as never[] }),
    ).toThrow(TypeError)
    expect(() =>
      telemetrijaCsvVrstice({
        stats: { keys: 1, hits: 1 },
        tripsTotal: 1,
        trips: [{ kind: 'login', keyHash: '1234567890', count: 0, lastAt: Date.now() }],
      }),
    ).toThrow(TypeError)
    expect(() =>
      telemetrijaCsvVrstice({
        stats: { keys: 1, hits: 1 },
        tripsTotal: 1,
        trips: [{ kind: 'login', keyHash: '1234567890', count: 1, lastAt: -5 }],
      }),
    ).toThrow(TypeError)
  })

  it('izvozImeDatoteke: deterministično ime (UTC deli) + TypeError za pokvaren datum', () => {
    const now = new Date('2026-09-26T19:15:52.708Z')
    expect(izvozImeDatoteke(now)).toBe('telemetrija-omejitve-20260926-191552.csv')
    expect(izvozImeDatoteke(now)).toBe(izvozImeDatoteke(now))
    expect(() => izvozImeDatoteke(new Date('ne-obstaja'))).toThrow(TypeError)
    expect(() => izvozImeDatoteke('ne-date' as unknown as Date)).toThrow(TypeError)
  })
})

describe('R185 — jedro (posodobitev-jedro.ts): zigIzpis časa gradnje', () => {
  it('poletni žig (CEST) → Ljubljana ura +2 h od UTC', () => {
    expect(zigIzpis('2026-09-26T19:15:52.708Z')).toBe(
      'Zgrajeno 26.09.2026 ob 21:15:52 (Europe/Ljubljana)',
    )
  })

  it('zimski žig (CET) → Ljubljana ura +1 h od UTC (DST pravilen)', () => {
    expect(zigIzpis('2026-01-15T12:00:00.000Z')).toBe(
      'Zgrajeno 15.01.2026 ob 13:00:00 (Europe/Ljubljana)',
    )
  })

  it('determinizem: isti žig → isti izpis (×2 klica)', () => {
    expect(zigIzpis('2026-09-26T19:15:52.708Z')).toBe(zigIzpis('2026-09-26T19:15:52.708Z'))
  })

  it('fail-closed: ne-prazen string, prazen string, pokvaren datum → TypeError', () => {
    expect(() => zigIzpis(undefined as unknown as string)).toThrow(TypeError)
    expect(() => zigIzpis('')).toThrow(TypeError)
    expect(() => zigIzpis('nismo-iso')).toThrow(TypeError)
    // obstoječa odločitev bannerja ostane nedotaknjena (regresija EN vira)
    expect(aliJeNovaVerzijaNaVoljo({ mojZig: 'a', streznikovZig: 'b' })).toBe(true)
    expect(aliJeNovaVerzijaNaVoljo({ mojZig: 'a', streznikovZig: 'a' })).toBe(false)
    expect(aliJeNovaVerzijaNaVoljo({ mojZig: null, streznikovZig: 'b' })).toBe(false)
  })

  it('EN VIR: ura prihaja iz casOznaka (posodobitev-jedro uvaža osvezitev-fokus)', () => {
    const jedro = srcOf('src/lib/posodobitev-jedro.ts')
    expect(jedro).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(jedro).toContain('casOznaka(datum, { casovniPas: IZPIS_PAS })')
    expect(jedro).toContain("const IZPIS_PAS = 'Europe/Ljubljana'")
  })
})

describe('R185 — žičenje (rate-limit-panel): gumb izvoza CSV', () => {
  const panel = srcOf('src/components/roksal/rate-limit-panel.tsx')

  it('jedro je EN VIR: panel uvaža telemetrijaCsv + izvozImeDatoteke', () => {
    expect(panel).toContain("import { izvozImeDatoteke, telemetrijaCsv } from '@/lib/telemetrija-csv'")
  })

  it('gumb: aria-label + tooltip + onemogočen brez uspešno branega stanja (fail-closed)', () => {
    expect(panel).toContain('aria-label="Izvozi telemetrijo omejevanja hitrosti kot CSV"')
    expect(panel).toContain('title="Prenesi trenutno telemetrijo (CSV, ločilo ;)"')
    expect(panel).toContain('disabled={loading || napaka !== null || !data}')
  })

  it('izvoz prek čistega jedra + blob prenos; pokvaren odgovor NE razbije UI (guard)', () => {
    expect(panel).toContain('if (!data) return')
    expect(panel).toContain('prenesiCsv(telemetrijaCsv(data), izvozImeDatoteke(new Date()))')
    expect(panel).toContain("type: 'text/csv;charset=utf-8'")
    expect(panel).toContain('URL.revokeObjectURL(url)')
  })

  it('hover družina: gumb ima transition-colors hover:text-roksal-ink (12. površina)', () => {
    expect(panel).toContain('transition-colors hover:text-roksal-ink')
  })

  it('regresija: pečat + Osveži + telemetrijska glava ostanejo nedotaknjeni', () => {
    expect(panel).toContain('aria-label="Osveži telemetrijo omejevanja hitrosti"')
    expect(panel).toContain('title="Čas zadnje uspešne osvežitve podatkov"')
    expect(panel).toContain('Vzdrževanje — omejevanje hitrosti')
  })
})

describe('R185 — žičenje (update-banner): podrobnost Zgrajeno', () => {
  const banner = srcOf('src/components/roksal/update-banner.tsx')

  it('banner uvaža zigIzpis iz čistega jedra in ga kliče na strežnikovem žigu', () => {
    expect(banner).toContain("import { aliJeNovaVerzijaNaVoljo, zigIzpis } from '@/lib/posodobitev-jedro'")
    expect(banner).toContain('zgrajeno = zigIzpis(streznikovZig)')
  })

  it('nasvetna podrobnost: pokvarjen žig NE razbije pasu (try/catch → null)', () => {
    expect(banner).toContain('} catch {')
    expect(banner).toContain('zgrajeno = null')
  })

  it('izris: podrobnost PRED osnovnim sporočilom, osnovno sporočilo vedno celo', () => {
    expect(banner).toContain("{zgrajeno ? `${zgrajeno} — ` : ''}Osvežite za najnovejše funkcije in popravke.")
  })

  it('regresija: odločitev še vedno prek čistega jedra + skrivanje na deploy', () => {
    expect(banner).toContain('aliJeNovaVerzijaNaVoljo({ mojZig: MOJ_ZIG, streznikovZig })')
    expect(banner).toContain("const DISMISS_KEY = 'roksal-update-dismissed-zig'")
  })
})
