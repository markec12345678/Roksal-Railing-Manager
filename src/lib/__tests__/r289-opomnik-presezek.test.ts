/**
 * R289 — ISKREN PRESEŽEK v zvončku (family-wide dopolnitev R287/R288):
 * vsaka signalna družina ima cap (×8 / ×6 — vzorec slice(0, N)); brez
 * presežka bi 7. opomnik / 9. zamujena dobava TIHO izginil (lažna varnost —
 * vzorec R152/R182). Dokaz v dveh slojih (vzorec r287):
 *
 *  1. LIB (opomnikZvonekPresezek) — čista funkcija, pravo vedenje:
 *     presežek = veljavni − prikazani, ISTI validacijski sprehod kot
 *     opomnikZvonekVrstice (opomnikZvonekNosilci R289 izvleček — presežek
 *     NE more divergirati od vrstic); pokvareni vnosi NE štejejo; max < 0
 *     = pariteta vrstic (Math.max(0, max)); TypeError na ne-seznamu
 *     (ISTA družina kot vrstice R287); determinizem.
 *  2. KOMPONENTA (strazar — source pins): 7 družin wire-anih z ISTIMI
 *     filtriranimi seznami (low/brez/todays/dueFollowUps/dueInvoices/
 *     zamujena + opomniki prek liba), atomarni set z items, catch reset,
 *     role="note" UI (pogojni, ne-klikljiv — brez lažnih affordance,
 *     title izrecno pove resnico), 0 novih hex (žetoni), r287/r288 pini
 *     ostajajo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { opomnikZvonekPresezek, opomnikZvonekVrstice } from '../opomnik-zvonek'

const beri = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8')

const dan = (odmikDni: number, ura = 9): Date => new Date(2026, 8, 30 + odmikDni, ura, 0, 0)
const iso = (d: Date): string => d.toISOString()

const stranka = (
  id: string,
  status: string | undefined,
  datum: string | null,
) => ({
  id,
  ime: `Stranka ${id}`,
  opomnikStatus: status as 'NI' | 'AKTIVEN' | 'POTEKEL' | undefined,
  opomnikDatum: datum,
  opomnikOpis: 'Pokliči glede ponudbe',
})

/** N veljavnih poteklih strank (datumi vsak svoj — deterministično). */
const potekle = (n: number) =>
  Array.from({ length: n }, (_, i) => stranka(`p${i}`, 'POTEKEL', iso(dan(-1 - i))))

describe('R289 — opomnikZvonekPresezek (lib): EN VIR + fail-closed + determinizem', () => {
  it('0 veljavnih → presežek 0 (iskrena praznina — brez žigona)', () => {
    expect(opomnikZvonekPresezek([])).toBe(0)
  })

  it('≤ max veljavnih → presežek 0 (vse vidne — presežek NIKOLI lažni alarm)', () => {
    expect(opomnikZvonekPresezek(potekle(6))).toBe(0)
    expect(opomnikZvonekPresezek(potekle(5))).toBe(0)
  })

  it('> max → točno veljavni − max (7 → 1, 9 → 3 — iskren presežek)', () => {
    expect(opomnikZvonekPresezek(potekle(7))).toBe(1)
    expect(opomnikZvonekPresezek(potekle(9))).toBe(3)
  })

  it('IZREČEN max: 9 veljavnih, max 8 → 1; max 0 → vsi 9 (pariteta vrstic slice)', () => {
    expect(opomnikZvonekPresezek(potekle(9), 8)).toBe(1)
    expect(opomnikZvonekPresezek(potekle(9), 0)).toBe(9)
    expect(opomnikZvonekPresezek(potekle(9), 20)).toBe(0)
  })

  it('EN VIR: presežek = veljavni − vrstice za ISTI vhod (ne more divergirati)', () => {
    const vhodi = [
      ...potekle(8),
      stranka('a0', 'AKTIVEN', iso(dan(3))),
      stranka('a1', 'AKTIVEN', iso(dan(5))),
      stranka('pokvaren1', 'NI', iso(dan(-2))),
      stranka('pokvaren2', 'POTEKEL', null),
      stranka('pokvaren3', undefined, iso(dan(-2))),
      'ne-objekt',
      null,
    ]
    const vrstice = opomnikZvonekVrstice(vhodi, dan(0), 6)
    expect(vrstice.length).toBe(6)
    expect(opomnikZvonekPresezek(vhodi, 6)).toBe(10 - 6)
  })

  it('pokvareni vnosi NE štejejo v presežek (nikoli napihnjenega alarma)', () => {
    const pokvareni = [
      stranka('x1', 'NI', iso(dan(-2))),
      stranka('x2', 'POTEKEL', ''),
      stranka('x3', 'POTEKEL', 'ni-datum'),
      stranka('x4', undefined, iso(dan(-2))),
      { brezImena: true },
      42,
    ]
    expect(opomnikZvonekPresezek(pokvareni)).toBe(0)
  })

  it('mešani POTEKEL + AKTIVEN: oboje štejeta (status ne spreminja veljavnosti)', () => {
    const mesano = [...potekle(7), stranka('a0', 'AKTIVEN', iso(dan(2)))]
    expect(opomnikZvonekPresezek(mesano)).toBe(2)
  })

  it('prelomljen vhod (ni seznama) → TypeError (ISTA družina kot vrstice R287)', () => {
    expect(() => opomnikZvonekPresezek(undefined as unknown as unknown[])).toThrow(TypeError)
    expect(() => opomnikZvonekPresezek({} as unknown as unknown[])).toThrow(TypeError)
    expect(() => opomnikZvonekPresezek('seznam' as unknown as unknown[])).toThrow(TypeError)
  })

  it('determinizem: isti vhod → isti presežek (čista funkcija, brez ure)', () => {
    const vhodi = potekle(9)
    expect(opomnikZvonekPresezek(vhodi)).toBe(opomnikZvonekPresezek(vhodi))
    expect(opomnikZvonekPresezek(vhodi)).toBe(3)
  })

  it('max < 0 = pariteta vrstic (Math.max(0, max) — slice(0,0) pokaže NIČ → vsi presežek)', () => {
    expect(opomnikZvonekPresezek(potekle(3), -2)).toBe(3)
  })
})

describe('R289 — zvonček komponenta (strazar): 7 družin + atomarnost + UI', () => {
  const src = beri('src/components/roksal/notification-center.tsx')

  it('VSE 6 komponentnih družin wire-anih z ISTIMI filtriranimi seznami (EN VIR — brez ponovnega filtra)', () => {
    expect(src).toContain("dodajPresezek('Nizka zaloga', low.length, 8)")
    expect(src).toContain("dodajPresezek('Brez dobavitelja', brez.length, 8)")
    expect(src).toContain("dodajPresezek('Današnje montaže', todays.length, 8)")
    expect(src).toContain("dodajPresezek('Follow-upi', dueFollowUps.length, 6)")
    expect(src).toContain("dodajPresezek('Zapadli računi', dueInvoices.length, 6)")
    expect(src).toContain("dodajPresezek('Zamujene dobave', zamujena.length, 8)")
  })

  it('opomniki prek LIBA (opomnikZvonekPresezek — isti validacijski sprehod, pokvareni NE štejejo)', () => {
    expect(src).toContain('const opPresezek = opomnikZvonekPresezek(Array.isArray(crm.customers) ? crm.customers : [])')
    expect(src).toContain("if (opPresezek > 0) presezki.push({ kategorija: 'CRM opomniki', st: opPresezek })")
  })

  it('ATOMARNO: set šele ob uspešnem koncu + catch reset (nikoli delnih/mešanih števcev)', () => {
    expect(src).toContain('setPresezki(presezki)')
    expect(src).toContain('setPresezki([])')
    // catch reset mora biti v omrežnem catch (za R182 vrstico — brez lažne svežine)
    const catchIdx = src.indexOf("setViriNapaka('Obvestila niso bila osvežena (omrežje)")
    const resetIdx = src.indexOf('setPresezki([])')
    expect(catchIdx).toBeGreaterThan(-1)
    expect(resetIdx).toBeGreaterThan(catchIdx)
  })

  it('UI: role="note" pogojna vrstica pod seznamom — brez presežka tudi NIČ (pogojni kanon r277)', () => {
    expect(src).toContain('{presezki.length > 0 && (')
    expect(src).toContain('role="note"')
    // R289 — poimenovana note regija (a11y): aria-label = nov, minifier-stabilen literal
    expect(src).toContain('aria-label="Iskren presežek signalov"')
    expect(src).toContain('<span className="font-semibold text-roksal-ink">Presežek:</span>')
  })

  it('UI resnica: title izrecno pove, kje je celotna resnica (brez lažnih affordance — ni klika)', () => {
    expect(src).toContain('Iskren presežek — zvonček prikazuje najpomembnejše vrstice; celotna resnica je na pripadajočih ploščah.')
    // note blok (od pogojnega začetka do join) NE sme vsebovati button/onClick
    const startIdx = src.indexOf('{presezki.length > 0 && (')
    const endIdx = src.indexOf("join(' · ')}</span>", startIdx)
    expect(startIdx).toBeGreaterThan(-1)
    expect(endIdx).toBeGreaterThan(startIdx)
    const block = src.slice(startIdx, endIdx)
    expect(block).not.toContain('onClick')
    expect(block).not.toContain('<button')
  })

  it('STIL: žetoni družine (border-border/60, bg-muted/40, text-muted-foreground, tabular-nums) — 0 novih hex', () => {
    expect(src).toContain('className="mt-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-2xs text-muted-foreground"')
    expect(src).toContain('tabular-nums')
    const hexi = src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    const dovoljeni = new Set(['#0f1724']) // r173 ringOffset — obstoječi kanon
    for (const h of hexi) expect(dovoljeni.has(h), `nepričakovani hex ${h}`).toBe(true)
  })

  it('r287 pini ostajajo: portal akcija + aria + SheetDescription (R289 NE dotakne vrstic)', () => {
    expect(src).toContain("`${item.title} — odpre CRM (opomnik)`")
    expect(src).toContain("neuspeliViri.push('CRM opomniki')")
  })
})
