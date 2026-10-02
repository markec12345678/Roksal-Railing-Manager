// R380 (issue #13, korak R168 iz §12) — CENTRALNA ZAOKROŽEVALNA POLITIKA.
// ---------------------------------------------------------------------------
// Testi dokazujejo, da je decimal-policy EN VIR resnice o zaokroževanju:
//   • NAIJBLIZJE = half-up (0.5 GOR — kompatibilno s PG numeric semantiko);
//   • GORI/DOL = strop/talna (nabava/izdaja);
//   • EKSAKTNA aritmetika prek String(v) → decimal.js: 0.145 → 0.15
//     (Math.round bi dal 0.14 — float laž odstranjena), vsota 0.1+0.2 = 0.3;
//   • fail-closed: NaN/Infinity/neveljavne decimalke → JAVNA napaka
//     (nikoli tiha substitucija);
//   • honest NULL (§8): decToNum(null) → null, ne izmišljena ničla;
//   • decToPlain: globoki serializer DTO meje (Decimal → number povsod,
//     Date/null/primitivi nedotaknjeni, vhod NI mutiran).
import { describe, expect, it } from 'vitest'
import {
  zaokrozi,
  zaokroziDenar,
  zaokroziKolicino,
  zaokroziFaktor,
  zaokroziOdstotek,
  vsotaDenarja,
  vsotaKolicin,
  decToNum,
  decToNumObvezno,
  decToPlain,
  DecimalPolicyError,
  DENAR_DECIMALKE,
  KOLICINA_DECIMALKE,
  FAKTOR_DECIMALKE,
  ODSOTEK_DECIMALKE,
  NACINI_ZAOKROZEVANJA,
} from '@/lib/decimal-policy'

describe('R380 — decimal-policy (§12 centralna politika)', () => {
  describe('zamrznjene konstante (pogodba s shemo)', () => {
    it('preciznost po domenu: denar 2, količina 3, faktor 4, odstotek 2', () => {
      expect(DENAR_DECIMALKE).toBe(2)
      expect(KOLICINA_DECIMALKE).toBe(3)
      expect(FAKTOR_DECIMALKE).toBe(4)
      expect(ODSOTEK_DECIMALKE).toBe(2)
    })
    it('nabor načinov je zamrznjen (GORI/DOL/NAJBLIZJE)', () => {
      expect([...NACINI_ZAOKROZEVANJA]).toEqual(['GORI', 'DOL', 'NAJBLIZJE'])
    })
  })

  describe('zaokrozi — trije načini', () => {
    it('NAJBLIZJE = half-up: 0.5 VEDNO gor (tudi negativno, simetrično od nič)', () => {
      expect(zaokrozi(0.5, 0)).toBe(1)
      expect(zaokrozi(1.5, 0)).toBe(2)
      expect(zaokrozi(2.5, 0)).toBe(3)
      expect(zaokrozi(-0.5, 0)).toBe(-1)
      expect(zaokrozi(-1.5, 0)).toBe(-2)
    })
    it('GORI = strop (nabava: bolj naročiti kot zmanjkati)', () => {
      expect(zaokrozi(0.11, 0, 'GORI')).toBe(1)
      expect(zaokrozi(1.001, 2, 'GORI')).toBe(1.01)
      expect(zaokrozi(-1.001, 2, 'GORI')).toBe(-1)
    })
    it('DOL = talna (izdaja: ne izdati več kot je)', () => {
      expect(zaokrozi(0.99, 0, 'DOL')).toBe(0)
      expect(zaokrozi(1.999, 2, 'DOL')).toBe(1.99)
      expect(zaokrozi(-1.001, 2, 'DOL')).toBe(-1.01)
    })
    it('EKSAKTNOST prek najkrajše reprezentacije: 0.145 → 0.15 (float laž odstranjena)', () => {
      // 0.145 kot double je 0.1449999999999999… — Math.round(0.145*100)/100
      // bi dal 0.14 (tiha izguba centa); politika zaokroži kar je bilo
      // MIŠLJENO (0.145), ne dvojični rep.
      expect(zaokrozi(0.145, 2)).toBe(0.15)
      expect(zaokrozi(2.675, 2)).toBe(2.68)
    })
    it('identiteta: cela števila in ustrezne decimalke gredo nespremenjeno', () => {
      expect(zaokrozi(42, 2)).toBe(42)
      expect(zaokrozi(12.5, 2)).toBe(12.5)
      expect(zaokrozi(0, 3)).toBe(0)
      expect(zaokrozi(1.234, 3)).toBe(1.234)
    })
    it('fail-closed: NaN/Infinity → DecimalPolicyError (ne tiha 0)', () => {
      expect(() => zaokrozi(NaN, 2)).toThrow(DecimalPolicyError)
      expect(() => zaokrozi(Infinity, 2)).toThrow(DecimalPolicyError)
      expect(() => zaokrozi(-Infinity, 2)).toThrow(DecimalPolicyError)
    })
    it('fail-closed: decimalke zunaj 0–6 → DecimalPolicyError', () => {
      expect(() => zaokrozi(1, -1)).toThrow(DecimalPolicyError)
      expect(() => zaokrozi(1, 7)).toThrow(DecimalPolicyError)
      expect(() => zaokrozi(1, 1.5)).toThrow(DecimalPolicyError)
    })
  })

  describe('domenske bližnjice', () => {
    it('zaokroziDenar → 2 decimalke', () => {
      expect(zaokroziDenar(10.005)).toBe(10.01)
      expect(zaokroziDenar(10.004)).toBe(10)
    })
    it('zaokroziKolicino → 3 decimalke', () => {
      expect(zaokroziKolicino(0.0005)).toBe(0.001)
      expect(zaokroziKolicino(0.0004)).toBe(0)
    })
    it('zaokroziFaktor → 4 decimalke (wasteFactor kompatibilno)', () => {
      expect(zaokroziFaktor(0.12345)).toBe(0.1235)
    })
    it('zaokroziOdstotek → 2 decimalke (popust/DDV stopnja)', () => {
      expect(zaokroziOdstotek(22)).toBe(22)
      expect(zaokroziOdstotek(9.999)).toBe(10)
    })
  })

  describe('vsote — eksaktna Decimal aritmetika', () => {
    it('KLASIČNA FLOAT LAŽ UBITA: 0.1 + 0.2 = TOČNO 0.3', () => {
      // Float: 0.1 + 0.2 === 0.30000000000000004 — to je RAZLOG za §12.
      expect(0.1 + 0.2).not.toBe(0.3) // dokaz laži v float svetu
      expect(vsotaDenarja([0.1, 0.2])).toBe(0.3) // politika: eksaktno
    })
    it('vsota denarja: enkratna zaokrožitev na koncu (ne po členih)', () => {
      // trije 0.005: po členih bi bilo 0.02+0.02+0.02 = 0.06 (kumulirana
      // pristranost gor); enkrat na koncu: 0.015 → 0.02.
      expect(vsotaDenarja([0.005, 0.005, 0.005])).toBe(0.02)
    })
    it('velike vsote ostanejo točne (cent po cent)', () => {
      const vrednosti = [1234.56, 789.01, 0.99, 1000000.25]
      expect(vsotaDenarja(vrednosti)).toBe(1002024.81)
    })
    it('prazen seznam → 0 (vsota praznega nabora je objektivna ničla)', () => {
      expect(vsotaDenarja([])).toBe(0)
      expect(vsotaKolicin([])).toBe(0)
    })
    it('vsota kolicin: 3 decimalke, eksaktno', () => {
      expect(vsotaKolicin([0.1, 0.2, 0.3])).toBe(0.6)
      expect(vsotaKolicin([1.001, 2.002])).toBe(3.003)
    })
    it('fail-closed: nekončni člen → DecimalPolicyError', () => {
      expect(() => vsotaDenarja([1, NaN])).toThrow(DecimalPolicyError)
      expect(() => vsotaKolicin([1, Infinity])).toThrow(DecimalPolicyError)
    })
  })

  describe('decToNum — DTO most (honest NULL)', () => {
    it('Decimal-like objekt (strukturno toNumber) → number', () => {
      const dec = { toNumber: () => 12.5 }
      expect(decToNum(dec)).toBe(12.5)
    })
    it('number gre nespremenjeno; veljaven string se parse-a', () => {
      expect(decToNum(3.14)).toBe(3.14)
      expect(decToNum('2.5')).toBe(2.5)
    })
    it('HONEST NULL (§8): null/undefined → null (ne izmišljena ničla)', () => {
      expect(decToNum(null)).toBeNull()
      expect(decToNum(undefined)).toBeNull()
    })
    it('fail-closed: smeten string → DecimalPolicyError (NE NaN)', () => {
      expect(() => decToNum('abc')).toThrow(DecimalPolicyError)
      expect(() => decToNum('')).toThrow(DecimalPolicyError)
    })
    it('fail-closed: nekončna Decimal vrednost → napaka', () => {
      expect(() => decToNum({ toNumber: () => NaN })).toThrow(DecimalPolicyError)
    })
    it('decToNumObvezno: null → JAVNA napaka (missing = napaka, ne tiha 0)', () => {
      expect(() => decToNumObvezno(null, 'osnova')).toThrow(/osnova/)
      expect(decToNumObvezno(7, 'kolicina')).toBe(7)
    })
  })

  describe('decToPlain — globoki serializer DTO meje', () => {
    it('pretvori Decimal v CELIEM drevesu (vključno gnezdenimi polji)', () => {
      const vhod = {
        id: 'x1',
        kolicinaZaloga: { toNumber: () => 450 },
        nested: { lot: { quantityRemaining: { toNumber: () => 12.5 } }, lista: [{ cena: { toNumber: () => 2.5 } }] },
      }
      const izhod = decToPlain(vhod) as Record<string, unknown>
      expect(izhod.kolicinaZaloga).toBe(450)
      const nested = izhod.nested as Record<string, unknown>
      const lot = nested.lot as Record<string, unknown>
      expect(lot.quantityRemaining).toBe(12.5)
      const lista = nested.lista as Array<Record<string, unknown>>
      expect(lista[0].cena).toBe(2.5)
    })
    it('Date ostane Date (JSON ga serializira kot ISO — kot prej)', () => {
      const d = new Date('2026-10-06T08:00:00Z')
      const izhod = decToPlain({ ustvarjeno: d }) as Record<string, unknown>
      expect(izhod.ustvarjeno).toBeInstanceOf(Date)
    })
    it('null/undefined/primitivi gredo nespremenjeno skozi', () => {
      const izhod = decToPlain({ a: null, b: 'tekst', c: 5, d: true, e: undefined }) as Record<string, unknown>
      expect(izhod.a).toBeNull()
      expect(izhod.b).toBe('tekst')
      expect(izhod.c).toBe(5)
      expect(izhod.d).toBe(true)
      expect(izhod.e).toBeUndefined()
    })
    it('NE mutira vhoda (čisti izhod)', () => {
      const dec = { toNumber: () => 1.5 }
      const vhod = { v: dec }
      const izhod = decToPlain(vhod) as Record<string, unknown>
      expect(izhod.v).toBe(1.5)
      expect((vhod.v as { toNumber(): number }).toNumber()).toBe(1.5) // vhod nedotaknjen
    })
    it('polje/array na vrhnji ravni deluje', () => {
      expect(decToPlain([{ toNumber: () => 9 }])).toEqual([9])
      expect(decToPlain(null)).toBeNull()
      expect(decToPlain(5)).toBe(5)
    })
  })
})
