// R136 — CSV izvozni pomočnik: deterministična pogodba oblike (Excel SI).
import { describe, expect, it } from 'vitest'
import { csvField, toCsv, todayStamp } from '../csv-export'

describe('csvField — oblika celic', () => {
  it('števila: 2 decimalki + decimalna vejica', () => {
    expect(csvField(12.5)).toBe('12,50')
    expect(csvField(0)).toBe('0,00')
    expect(csvField(-3.4)).toBe('-3,40')
  })

  it('nekončno število in null/undefined → prazno polje (brez "NaN"/"undefined")', () => {
    expect(csvField(Number.NaN)).toBe('')
    expect(csvField(Number.POSITIVE_INFINITY)).toBe('')
    expect(csvField(null)).toBe('')
    expect(csvField(undefined)).toBe('')
  })

  it('besedilo s šumniki ostane netaknjeno', () => {
    expect(csvField('Šifra čžš')).toBe('Šifra čžš')
  })

  it('polja s `;`, `"`, novico ali vodilnim presledkom so citirana po RFC 4180', () => {
    expect(csvField('a;b')).toBe('"a;b"')
    expect(csvField('reci "zdravo"')).toBe('"reci ""zdravo"""')
    expect(csvField('vrstica\nnaprej')).toBe('"vrstica\nnaprej"')
    expect(csvField(' presledek')).toBe('" presledek"')
    expect(csvField('navadno')).toBe('navadno')
  })
})

describe('toCsv — pogodba datoteke', () => {
  it('BOM + podpičje + CRLF; ista vhodna data = ista datoteka (determinizem)', () => {
    const headers = ['Šifra', 'Zaloga']
    const rows = [
      ['A1', 10],
      ['B;2', 3.5],
    ]
    const expected = '\uFEFFŠifra;Zaloga\r\nA1;10,00\r\n"B;2";3,50\r\n'
    expect(toCsv(headers, rows)).toBe(expected)
    expect(toCsv(headers, rows)).toBe(toCsv(headers, rows))
  })

  it('prazne vrstice so dovoljene (samo glava)', () => {
    expect(toCsv(['a', 'b'], [])).toBe('\uFEFFa;b\r\n')
  })
})

describe('todayStamp — deterministično oblikovanje datuma', () => {
  it('YYYY-MM-DD z vodilnimi ničlami', () => {
    expect(todayStamp(new Date(2026, 8, 5))).toBe('2026-09-05') // meseci so 0-indeksni
    expect(todayStamp(new Date(2026, 11, 25))).toBe('2026-12-25')
  })
})
