// R160 — testi (a11y stražar za <a> povezave + izvoz ekipe v CSV).
// ---------------------------------------------------------------------------
//   • REGRESIJSKI STRAŽAR: skener od R160 pokriva tudi SUROVE <a> povezave —
//     ikonska povezava brez dostopnega imena je isti razred napake kot ikonski
//     gumb (R158 kandidat (c): ročni pregled je našel 1 pravo vrzel — Google
//     Maps povezava v photo-tab, popravljena z izrecnim aria-labelom; preostale
//     povezave imajo vidno besedilo ali aria-label). Stražar stanje DRŽI.
//   • lib/ekipa-csv: BOM, glava, status z ISTIM prednostnim redom kot značke
//     v team-tab (deaktiviran > zaklenjen > povabilo > aktiven), vloge z ISTIMI
//     naslovi kot UI, neznana vloga → fail-closed TypeError, escape navedkov,
//     null polja → prazen stolpec, deterministično ime datoteke.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { iconOnlyButtonsWithoutLabel } from '@/lib/a11y-scan'
import {
  buildEkipaCsv,
  ekipaCsvFilename,
  ekipaStatusOf,
  EKIPA_VLOGE,
  EKIPA_STATUSI,
  type EkipaCsvRow,
} from '@/lib/ekipa-csv'

// ---------------------------------------------------------------------------
// 1) A11Y STRAŽAR — ikonske <a> povezave (R158 kandidat (c), zaprto)
// ---------------------------------------------------------------------------

describe('R160 regresijski stražar — ikonske <a> povezave', () => {
  it('nobena ikonska <a> povezava v roksal komponentah ni brez dostopnega imena', () => {
    const dir = join(process.cwd(), 'src', 'components', 'roksal')
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'))
    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8')
      const found = iconOnlyButtonsWithoutLabel(src, f).filter((o) => o.tag === '<a')
      for (const o of found) offenders.push(`${f}:${o.line}`)
    }
    expect(offenders).toEqual([])
  })
})

describe('R160 a11y-scan — <a> enote', () => {
  it('prepozna ikonsko <a> povezavo brez aria-label, ne javi imenovanih/besedilnih', () => {
    const src = [
      '<a href="/f"><Download /></a>',
      '<a href="/f" aria-label="Prenesi"><Download /></a>',
      '<a href="tel:040">040 123 456</a>',
      '<a href="/x">Kliči</a>',
    ].join('\n')
    const found = iconOnlyButtonsWithoutLabel(src)
    expect(found).toHaveLength(1)
    expect(found[0]!.tag).toBe('<a')
    expect(found[0]!.line).toBe(1)
  })

  it('samozapirajoča <a … /> brez aria-label je kršitev', () => {
    const src = '<a href="/f" aria-label="Ok" />\n<a href="/g" />'
    const found = iconOnlyButtonsWithoutLabel(src)
    expect(found).toHaveLength(1)
    expect(found[0]!.line).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 2) ekipaStatusOf — EN VIR RESNICE z značkami v team-tab
// ---------------------------------------------------------------------------

describe('R160 ekipaStatusOf — prednostni red statusov', () => {
  const base = { deactivated: false, locked: false, invited: false, inviteExpired: false }

  it('deaktiviran ima prednost pred vsem', () => {
    expect(ekipaStatusOf({ ...base, deactivated: true, locked: true, invited: true })).toBe('Deaktiviran')
  })

  it('zaklenjen ima prednost pred povabilom', () => {
    expect(ekipaStatusOf({ ...base, locked: true, invited: true })).toBe('Zaklenjen')
  })

  it('povabilo: poteklo proti čakajočemu', () => {
    expect(ekipaStatusOf({ ...base, invited: true, inviteExpired: true })).toBe('Povabilo poteklo')
    expect(ekipaStatusOf({ ...base, invited: true })).toBe('Čaka aktivacijo')
  })

  it('svež račun je aktiven', () => {
    expect(ekipaStatusOf(base)).toBe('Aktiven')
  })

  it('statusi so natanko tista besedila, ki jih vidi UI (5 možnosti)', () => {
    expect(EKIPA_STATUSI).toEqual([
      'Deaktiviran',
      'Zaklenjen',
      'Povabilo poteklo',
      'Čaka aktivacijo',
      'Aktiven',
    ])
  })
})

// ---------------------------------------------------------------------------
// 3) buildEkipaCsv — determinističen, iskren, fail-closed
// ---------------------------------------------------------------------------

function row(over: Partial<EkipaCsvRow> = {}): EkipaCsvRow {
  return {
    ime: 'Marko Novak',
    email: 'marko@roksal.si',
    vloga: 'MONTER',
    lifecycle: { deactivated: false, locked: false, invited: false, inviteExpired: false },
    telefon: '040 123 456',
    lastActive: '2026-09-26T08:30:00.000Z',
    createdAt: '2026-01-15T10:00:00.000Z',
    ...over,
  }
}

describe('R160 buildEkipaCsv', () => {
  it('BOM + glava + ena vrstica na člana', () => {
    const { csv, vrstic } = buildEkipaCsv([row()])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Ime,E-pošta,Vloga,Status,Telefon,Zadnja aktivnost,Ustvarjen')
    expect(vrstic).toBe(1)
    expect(csv).toContain('"Marko Novak","marko@roksal.si","Monter","Aktiven","040 123 456"')
  })

  it('status v izvozu = isti prednostni red kot značke', () => {
    const { csv } = buildEkipaCsv([
      row({ ime: 'A', email: 'a@x.si', lifecycle: { deactivated: true, locked: true, invited: true, inviteExpired: true } }),
      row({ ime: 'B', email: 'b@x.si', lifecycle: { deactivated: false, locked: false, invited: true, inviteExpired: true } }),
    ])
    expect(csv).toContain('"Deaktiviran"')
    expect(csv).toContain('"Povabilo poteklo"')
    expect(csv).not.toContain('"Zaklenjen"')
    expect(csv).not.toContain('"Čaka aktivacijo"')
  })

  it('vloge z ISTIMI naslovi kot UI (ROLE_LABEL)', () => {
    const { csv } = buildEkipaCsv([
      row({ vloga: 'ADMIN' }),
      row({ ime: 'N', email: 'n@x.si', vloga: 'VODJA' }),
      row({ ime: 'S', email: 's@x.si', vloga: 'SKLADISCE' }),
    ])
    expect(csv).toContain('"Admin"')
    expect(csv).toContain('"Vodja"')
    expect(csv).toContain('"Skladišče"')
    expect(EKIPA_VLOGE.ADMIN).toBe('Admin')
    expect(EKIPA_VLOGE.MONTER).toBe('Monter')
  })

  it('determinizem: ista vhoda → enak izhod', () => {
    const a = buildEkipaCsv([row(), row({ ime: 'Druga', email: 'd@x.si' })]).csv
    const b = buildEkipaCsv([row(), row({ ime: 'Druga', email: 'd@x.si' })]).csv
    expect(a).toBe(b)
  })

  it('CSV injekcija: navedki in podvojeni narekovaji', () => {
    const { csv } = buildEkipaCsv([row({ ime: 'Novak "Moro", Marko' })])
    expect(csv).toContain('"Novak ""Moro"", Marko"')
  })

  it('null telefon / null lastActive → PRAZEN stolpec (nikoli "null")', () => {
    const { csv } = buildEkipaCsv([row({ telefon: null, lastActive: null })])
    expect(csv).not.toContain('null')
    // telefon prazen, zadnja aktivnost prazna, ustvarjen izpolnjen
    expect(csv).toContain('"Aktiven","","","15. 1. 2026"')
  })

  it('datumi v sl-SI prikazu', () => {
    const { csv } = buildEkipaCsv([row()])
    expect(csv).toContain('26. 9. 2026')
    expect(csv).toContain('15. 1. 2026')
  })

  it('prazno polje → samo glava', () => {
    const { csv, vrstic } = buildEkipaCsv([])
    expect(vrstic).toBe(0)
    expect(csv).toBe('\uFEFFIme,E-pošta,Vloga,Status,Telefon,Zadnja aktivnost,Ustvarjen')
  })

  it('fail-closed: neznana vloga', () => {
    expect(() => buildEkipaCsv([row({ vloga: 'BOG' })])).toThrow(TypeError)
    expect(() => buildEkipaCsv([row({ vloga: 'BOG' })])).toThrow('neznana vloga')
  })

  it('fail-closed: prazno ime / prazen e-mail / neveljaven datum / manjkajoč lifecycle', () => {
    expect(() => buildEkipaCsv([row({ ime: '  ' })])).toThrow(TypeError)
    expect(() => buildEkipaCsv([row({ email: '' })])).toThrow(TypeError)
    expect(() => buildEkipaCsv([row({ createdAt: 'ne-obstaja' })])).toThrow(TypeError)
    expect(() => buildEkipaCsv([row({ lastActive: '31. 2. 2026' })])).toThrow(TypeError)
    expect(() => buildEkipaCsv([row({ lifecycle: undefined as unknown as EkipaCsvRow['lifecycle'] })])).toThrow(TypeError)
    expect(() => buildEkipaCsv('ne-polje' as unknown as readonly EkipaCsvRow[])).toThrow(TypeError)
  })

  it('ekipaCsvFilename: deterministično in striktno', () => {
    expect(ekipaCsvFilename('2026-09-26')).toBe('ekipa_2026-09-26.csv')
    expect(() => ekipaCsvFilename('26.9.2026')).toThrow(TypeError)
    expect(() => ekipaCsvFilename('')).toThrow(TypeError)
  })
})
