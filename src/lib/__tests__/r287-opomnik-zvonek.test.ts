/**
 * R287 — (k) opomnik portal akcija — ZAPRTJE evalvacije (odprta od R251):
 * signal 7 'opomnik' v zvončku + portal dejanje (klik → CRM, R182 protokol).
 *
 * DVA sloja dokaza (vzorec r229 zamujena-zvonek-vrstice):
 *  1. LIB (opomnikZvonekVrstice) — čista funkcija, pravo vedenje:
 *     fail-closed per vnos (status verbatim — lib NE razsoja AKTIVEN/
 *     POTEKEL; brez veljavnega datuma = brez vrstice), POTEKEL prioriteta,
 *     AKTIVEN po datumu naraščajoče, koledarsko iskrene dni (polnočna
 *     sidrišča), max omejitev, TypeError na prelomljenem seznamu.
 *  2. KOMPONENTA (strazar — source pins): EN VIR /api/crm, kindi + stil
 *     (PhoneCall, amber/red — 0 novih hex), portal akcija, aria-label,
 *     meta alarm barvni pogoj, copy dopolnjena (SheetDescription +
 *     empty state), r212/r222/r229 pini ostajajo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { opomnikZvonekVrstice } from '../opomnik-zvonek'

const beri = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8')

/** Deterministični "danes": sreda, 2026-09-30 12:00 (polnočno sidro se
 * izračuna V libu — tukaj je pomembna samo koledarska data). */
const DANAS = new Date(2026, 8, 30, 12, 0, 0)
const dan = (odmikDni: number, ura = 9): Date => new Date(2026, 8, 30 + odmikDni, ura, 0, 0)
const iso = (d: Date): string => d.toISOString()

const stranka = (
  id: string,
  status: string | undefined,
  datum: string | null,
  opis: string | null = 'Pokliči glede ponudbe',
) => ({
  id,
  ime: `Stranka ${id}`,
  // Cast je test-only: tuj niz ('BOG') posnema pokvaren strežniški odgovor —
  // lib ga mora preskočiti na runtime (fail-closed), TS ga tu NE more videti.
  opomnikStatus: status as 'NI' | 'AKTIVEN' | 'POTEKEL' | undefined,
  opomnikDatum: datum,
  opomnikOpis: opis,
})

describe('R287 — opomnikZvonekVrstice: fail-closed (status VERBATIM, R251 kanon)', () => {
  it('AKTIVEN + POTEKEL ustvarita vrstici (status verbatim — lib NE izračunava svojega)', () => {
    const vrstice = opomnikZvonekVrstice(
      [stranka('a', 'AKTIVEN', iso(dan(2))), stranka('b', 'POTEKEL', iso(dan(-3)))],
      DANAS,
    )
    expect(vrstice).toHaveLength(2)
    expect(vrstice[0].alarm).toBe(true)   // POTEKEL prioriteta
    expect(vrstice[0].ime).toBe('Stranka b')
    expect(vrstice[1].alarm).toBe(false)
    expect(vrstice[1].ime).toBe('Stranka a')
  })

  it('status NI / undefined / tuj niz → vnos preskočen (nikoli lažnega žiga)', () => {
    const vrstice = opomnikZvonekVrstice(
      [
        stranka('n', 'NI', iso(dan(-3))),
        stranka('u', undefined, iso(dan(-3))),
        stranka('t', 'BOG', iso(dan(-3)) as string),
      ],
      DANAS,
    )
    expect(vrstice).toHaveLength(0)
  })

  it('status brez veljavnega datuma (null / prazen / pokvaren) → preskočen (brez izmišljenih dni)', () => {
    const vrstice = opomnikZvonekVrstice(
      [
        stranka('x', 'POTEKEL', null),
        stranka('y', 'POTEKEL', ''),
        stranka('z', 'AKTIVEN', 'ni-datum'),
      ],
      DANAS,
    )
    expect(vrstice).toHaveLength(0)
  })

  it('vnos brez id/ime ALI prazen ime → preskočen; ne-objekt → preskočen (fail-closed per vnos)', () => {
    const vrstice = opomnikZvonekVrstice(
      [
        { ime: 'Brez id', opomnikStatus: 'POTEKEL', opomnikDatum: iso(dan(-1)) },
        { id: '', ime: 'Prazan id', opomnikStatus: 'POTEKEL', opomnikDatum: iso(dan(-1)) },
        { id: 'p', ime: '   ', opomnikStatus: 'POTEKEL', opomnikDatum: iso(dan(-1)) },
        null,
        42,
        'niz',
      ],
      DANAS,
    )
    expect(vrstice).toHaveLength(0)
  })

  it('prelomljen vhod (ni seznama) → TypeError (fail-verbose, vzorec R228 steviloZamujenihDobav)', () => {
    expect(() => opomnikZvonekVrstice(undefined as unknown as unknown[], DANAS)).toThrow(TypeError)
    expect(() => opomnikZvonekVrstice({} as unknown as unknown[], DANAS)).toThrow(TypeError)
  })
})

describe('R287 — opomnikZvonekVrstice: vrstni red + meta (koledarsko iskrene dni)', () => {
  it('POTEKEL najprej, AKTIVEN po datumu naraščajoče (najbližji rok prvi)', () => {
    const vrstice = opomnikZvonekVrstice(
      [
        stranka('a7', 'AKTIVEN', iso(dan(7))),
        stranka('p1', 'POTEKEL', iso(dan(-1))),
        stranka('a2', 'AKTIVEN', iso(dan(2))),
        stranka('a1', 'AKTIVEN', iso(dan(1))),
      ],
      DANAS,
    )
    expect(vrstice.map((v) => v.id)).toEqual(['opomnik-p1', 'opomnik-a1', 'opomnik-a2', 'opomnik-a7'])
  })

  it('POTEKEL meta: zapadlo X dni (koledarsko — včeraj = 1, ne 0)', () => {
    const vrstice = opomnikZvonekVrstice(
      [stranka('p', 'POTEKEL', iso(dan(-1, 23)))],  // včeraj 23:00 — koledarsko 1 dan
      DANAS,
    )
    expect(vrstice[0].meta).toBe('POTEKEL · zapadlo 1 dni')
    const tri = opomnikZvonekVrstice([stranka('p', 'POTEKEL', iso(dan(-3)))], DANAS)
    expect(tri[0].meta).toBe('POTEKEL · zapadlo 3 dni')
  })

  it('POTEKEL še danes (ura pretekla) → "POTEKEL · danes" (iskreno, ne 1 dni)', () => {
    const vrstice = opomnikZvonekVrstice(
      [stranka('p', 'POTEKEL', iso(dan(0, 8)))],  // danes 08:00 — že preteklo
      DANAS,
    )
    expect(vrstice[0].meta).toBe('POTEKEL · danes')
  })

  it('AKTIVEN meta: še X dni; rok še danes → "rok danes" (ne napačnega 1 dni)', () => {
    const sedem = opomnikZvonekVrstice([stranka('a', 'AKTIVEN', iso(dan(7)))], DANAS)
    expect(sedem[0].meta).toBe('še 7 dni')
    const danes = opomnikZvonekVrstice([stranka('a', 'AKTIVEN', iso(dan(0, 18)))], DANAS)
    expect(danes[0].meta).toBe('rok danes')
  })

  it('opis verbatim; prazen/brez opisa → datum (iskrena praznina, brez izmišljevanja)', () => {
    const zOpisom = opomnikZvonekVrstice([stranka('a', 'AKTIVEN', iso(dan(1)), 'Sestanek na terenu')], DANAS)
    expect(zOpisom[0].opis).toBe('Sestanek na terenu')
    const brezOpisa = opomnikZvonekVrstice([stranka('a', 'AKTIVEN', iso(dan(1)), null)], DANAS)
    expect(brezOpisa[0].opis).toContain('Opomnik · ')
    const presledek = opomnikZvonekVrstice([stranka('a', 'AKTIVEN', iso(dan(1)), '   ')], DANAS)
    expect(presledek[0].opis).toContain('Opomnik · ')
  })

  it('id protokol: opomnik-${id stranke} (dedup zvončka kompatibilen)', () => {
    const vrstice = opomnikZvonekVrstice([stranka('abc', 'POTEKEL', iso(dan(-1)))], DANAS)
    expect(vrstice[0].id).toBe('opomnik-abc')
  })

  it('max omejitev: slice po prioriteti (POTEKEL vedno preživi, AKTIVEN po datumu)', () => {
    const vhodi = [
      stranka('a9', 'AKTIVEN', iso(dan(9))),
      stranka('p1', 'POTEKEL', iso(dan(-1))),
      stranka('a8', 'AKTIVEN', iso(dan(8))),
      stranka('a6', 'AKTIVEN', iso(dan(6))),
    ]
    const vrstice = opomnikZvonekVrstice(vhodi, DANAS, 3)
    expect(vrstice.map((v) => v.id)).toEqual(['opomnik-p1', 'opomnik-a6', 'opomnik-a8'])
    const prazno = opomnikZvonekVrstice([stranka('a', 'AKTIVEN', iso(dan(1)))], DANAS, 0)
    expect(prazno).toHaveLength(0)
  })

  it('determinizem: isti vhod + isti danas = bajtno enak izid (dvakrat poklicano)', () => {
    const vhodi = [stranka('a', 'AKTIVEN', iso(dan(3))), stranka('p', 'POTEKEL', iso(dan(-2)))]
    const prva = opomnikZvonekVrstice(vhodi, DANAS)
    const druga = opomnikZvonekVrstice(vhodi, DANAS)
    expect(JSON.stringify(prva)).toBe(JSON.stringify(druga))
  })
})

describe('R287 — zvonček komponenta (strazar): EN VIR + portal akcija + stil', () => {
  const src = beri('src/components/roksal/notification-center.tsx')

  it('EN VIR: /api/crm v ISTEM Promise.all kot zaloga/projekti (R251 kanon — brez nove zahteve v ločenem toku)', () => {
    expect(src).toContain("fetch('/api/crm')")
    expect(src).toContain('const [invRes, projRes, crmRes] = await Promise.all(')
    // R289 — pin posodobljen z ohranjeno namero: EN VIR uvoz razširjen z
    // opomnikZvonekPresezek (isti lib, isti vir — presežek NE more divergirati)
    expect(src).toContain("import { opomnikZvonekVrstice, opomnikZvonekPresezek } from '@/lib/opomnik-zvonek'")
  })

  it('opomnikStatus VERBATIM — komponenta NE filtrira po lastnem izračunu (lib je vrata; brez ?? 0 ohlapnosti)', () => {
    expect(src).toContain('Array.isArray(crm.customers) ? crm.customers : []')
    expect(src).toContain("new Date(today.getFullYear(), today.getMonth(), today.getDate())")
  })

  it('kindi + KIND_STYLE: PhoneCall, AKTIVEN amber / POTEKEL red (0 novih tokenov)', () => {
    expect(src).toContain("'zamujena' | 'opomnik' | 'opomnikPotekel'")
    expect(src).toContain("opomnik: { icon: PhoneCall, bg: 'bg-roksal-amber/15', fg: 'text-roksal-amber' },")
    expect(src).toContain("opomnikPotekel: { icon: PhoneCall, bg: 'bg-roksal-red/15', fg: 'text-roksal-red' },")
  })

  it('portal akcija: klik → CRM (R182 protokol) — R288: opomnik dobi deep-link (dvo-dogodkovni R214 vzorec), followup/invoice ostajata navadni R182', () => {
    // R288 (posodobitev pina z ohranjeno namero): skupna veja followup/
    // invoice/opomnik/opomnikPotekel se cepi — opomnik kinda dobita roksal:
    // select-crm deep-link, followup/invoice ostajata na navadni navigaciji.
    expect(src).toContain("item.kind === 'followup' || item.kind === 'invoice'")
    expect(src).toContain("item.kind === 'opomnik' || item.kind === 'opomnikPotekel'")
    expect(src).toContain("new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'crm' } })")
    expect(src).toContain("new CustomEvent('roksal:select-crm', { detail: strankaId })")
  })

  it('a11y (R217 vzorec): aria-label pove cilj — odpre CRM (opomnik)', () => {
    expect(src).toContain("item.kind === 'opomnik' || item.kind === 'opomnikPotekel'")
    expect(src).toContain('— odpre CRM (opomnik)')
  })

  it('meta alarm barvni pogoj: POTEKEL rdeča, ostali amber (novi kindi NE spreminjajo obstoječega kontrakta)', () => {
    expect(src).toContain("item.kind === 'opomnikPotekel' ? 'text-roksal-red' : 'text-roksal-amber'")
  })

  it('fail-verbose: ne-ok /api/crm (razen 403) gre v vidno opozorilno vrstico (R182)', () => {
    expect(src).toContain("neuspeliViri.push('CRM opomniki')")
  })

  it('copy: SheetDescription + empty state omenjata opomnike (r212/r222 pini posodobljeni)', () => {
    expect(src).toContain('Nizka zaloga, današnje montaže, naročila, vreme, računi, CRM opomniki in poslana obvestila.')
    expect(src).toContain('ni aktivnih naročil, ni opomnikov in vreme ne povzroča skrbi.')
  })

  it('0 novih hex (žetonska družina)', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })

  it('regresija r229: zamujena pin substring ostaja (kind union pripet na repu)', () => {
    expect(src).toContain("'order' | 'brez' | 'zamujena'")
    expect(src).toContain("zamujena: { icon: CalendarX, bg: 'bg-roksal-red/15', fg: 'text-roksal-red' }")
  })

  it('regresija r222: brez vrstica + aria ostajata nedotaknjena', () => {
    expect(src).toContain("detail: { tab: 'inventory', filter: 'brez-dobavitelja' }")
    expect(src).toContain('Ni nizke zaloge, ni artiklov brez dobavitelja, danes ni montaž')
  })
})
