/**
 * R288 — (k) opomnik DEEP-LINK — dopolnitev R287 portal akcije:
 * signal → dejanje → CILJ. Dva sloja dokaza (vzorec r287/r229):
 *  1. LIB (crm-deep-link.ts) — čisti funkciji:
 *     - opomnikStrankaIdIzVrstice: fail-closed parser vrstične id
 *       ('opomnik-{id}' → id; ne-niz/brez prefiksa/prazen ostanek → null);
 *     - crmDeepLinkOdlocitev: poraba zahteve (CAKAJ — nalaganje/napaka/
 *       brez/ne-polje; ODPRI — najdena; PRESKOCI — uspešen seznam brez
 *       stranke = R287 vedenje, R216 fail-safe vzorec); ne-objektni vnosi
 *       preskočeni; determinizem.
 *  2. KOMPONENTE (strazar — source pins): notification-center (dvo-dogodkovni
 *     protokol + fail-closed parser + followup/invoice ostajata R182),
 *     page.tsx (lupina lasti stanje + whitelist guard + one-shot callback +
 *     prop prehod), crm-tab (lib odločitev + one-shot poraba + poudarjena
 *     vrstica roksal-amber — 0 novih hex).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { opomnikStrankaIdIzVrstice, crmDeepLinkOdlocitev } from '../crm-deep-link'

const beri = (rel: string): string => readFileSync(join(process.cwd(), rel), 'utf8')

interface TestStranka {
  id: string
  ime: string
}
const stranka = (id: string): TestStranka => ({ id, ime: `Stranka ${id}` })

describe('R288 — opomnikStrankaIdIzVrstice: fail-closed parser', () => {
  it('veljaven \'opomnik-{id}\' → id stranke', () => {
    expect(opomnikStrankaIdIzVrstice('opomnik-e2e-r287-str-potekel')).toBe('e2e-r287-str-potekel')
    expect(opomnikStrankaIdIzVrstice('opomnik-abc123')).toBe('abc123')
  })

  it('brez prefiksa → null (nikoli lažne izbire)', () => {
    expect(opomnikStrankaIdIzVrstice('install-proj-1')).toBeNull()
    expect(opomnikStrankaIdIzVrstice('followup-x')).toBeNull()
    expect(opomnikStrankaIdIzVrstice('stock-abc')).toBeNull()
    expect(opomnikStrankaIdIzVrstice('brez-1')).toBeNull()
  })

  it('samo prefiks brez ostanka → null (pokvaren id)', () => {
    expect(opomnikStrankaIdIzVrstice('opomnik-')).toBeNull()
  })

  it('prazen niz → null', () => {
    expect(opomnikStrankaIdIzVrstice('')).toBeNull()
  })

  it('ne-niz (runtime smeti) → null (defenzivno — TS podpis ostane tight)', () => {
    expect(opomnikStrankaIdIzVrstice(null as unknown as string)).toBeNull()
    expect(opomnikStrankaIdIzVrstice(42 as unknown as string)).toBeNull()
    expect(opomnikStrankaIdIzVrstice(undefined as unknown as string)).toBeNull()
  })

  it('iskren passthrough ostanka: id sme vsebovati vezaje (parser reže SAMO prvi prefiks)', () => {
    expect(opomnikStrankaIdIzVrstice('opomnik--x')).toBe('-x')
    expect(opomnikStrankaIdIzVrstice('opomnik-a-b-c')).toBe('a-b-c')
  })

  it('determinizem: isti vhod → isti izid', () => {
    const a = opomnikStrankaIdIzVrstice('opomnik-x1')
    const b = opomnikStrankaIdIzVrstice('opomnik-x1')
    expect(a).toBe(b)
  })
})

describe('R288 — crmDeepLinkOdlocitev: poraba deep-link zahteve', () => {
  const seznam = [stranka('a'), stranka('b')]

  it('ODPRI: stranka najdena v podanem seznamu → vrne IZ SEZNAMA (nikoli fantomske konstrukcije)', () => {
    const o = crmDeepLinkOdlocitev<TestStranka>('b', seznam, false, null)
    expect(o).toEqual({ dejanje: 'ODPRI', stranka: seznam[1] })
    expect((o as { stranka?: TestStranka }).stranka).toBe(seznam[1]) // ISTA referenca
  })

  it('PRESKOCI: uspešen seznam brez stranke (izbrisana/RBAC) → R287 vedenje (navadni CRM seznam)', () => {
    expect(crmDeepLinkOdlocitev<TestStranka>('ne-obstaja', seznam, false, null)).toEqual({ dejanje: 'PRESKOCI' })
    expect(crmDeepLinkOdlocitev<TestStranka>('a', [], false, null)).toEqual({ dejanje: 'PRESKOCI' })
  })

  it('CAKAJ: nalaganje v teku (zahteva ostane — poraba šele po uspešnem reload-u)', () => {
    expect(crmDeepLinkOdlocitev<TestStranka>('a', seznam, true, null)).toEqual({ dejanje: 'CAKAJ' })
    expect(crmDeepLinkOdlocitev<TestStranka>('a', [], true, null)).toEqual({ dejanje: 'CAKAJ' })
  })

  it('CAKAJ: nalaganje spodletelo (napaka ≠ null) — zahteva ostane za retry', () => {
    expect(crmDeepLinkOdlocitev<TestStranka>('a', seznam, false, 'Strežnik ni vrnil strank (napaka 500).')).toEqual({ dejanje: 'CAKAJ' })
  })

  it('CAKAJ: brez zahteve (null/prazen/tuj tip) — nikoli lažnega odpiranja', () => {
    expect(crmDeepLinkOdlocitev<TestStranka>(null, seznam, false, null)).toEqual({ dejanje: 'CAKAJ' })
    expect(crmDeepLinkOdlocitev<TestStranka>('', seznam, false, null)).toEqual({ dejanje: 'CAKAJ' })
    expect(crmDeepLinkOdlocitev<TestStranka>(42, seznam, false, null)).toEqual({ dejanje: 'CAKAJ' })
  })

  it('CAKAJ: seznam ni seznam (defenzivno — runtime smeti)', () => {
    expect(crmDeepLinkOdlocitev<TestStranka>('a', null as unknown as TestStranka[], false, null)).toEqual({ dejanje: 'CAKAJ' })
    expect(crmDeepLinkOdlocitev<TestStranka>('a', 'smeti' as unknown as TestStranka[], false, null)).toEqual({ dejanje: 'CAKAJ' })
  })

  it('ne-objektni vnosi v seznamu so preskočeni (fail-closed per vnos — vzorec R287 lib)', () => {
    const smeti = [null, 42, 'a', {}, { ime: 'brez id' }, stranka('prava')] as unknown as TestStranka[]
    const o = crmDeepLinkOdlocitev<TestStranka>('prava', smeti, false, null)
    expect(o).toEqual({ dejanje: 'ODPRI', stranka: { id: 'prava', ime: 'Stranka prava' } })
    expect(crmDeepLinkOdlocitev<TestStranka>('a', smeti, false, null)).toEqual({ dejanje: 'PRESKOCI' })
  })

  it('determinizem: isti vhod → isti izid (JSON enakost)', () => {
    const a = crmDeepLinkOdlocitev<TestStranka>('a', seznam, false, null)
    const b = crmDeepLinkOdlocitev<TestStranka>('a', seznam, false, null)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('R288 — zvonček komponenta (strazar): dvo-dogodkovni protokol', () => {
  const src = beri('src/components/roksal/notification-center.tsx')

  it('R214 vzorec: opomnik vrstica pošlje navigate crm + roksal:select-crm (dva dogodka)', () => {
    expect(src).toContain("item.kind === 'opomnik' || item.kind === 'opomnikPotekel'")
    expect(src).toContain("window.dispatchEvent(new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'crm' } }))")
    expect(src).toContain("new CustomEvent('roksal:select-crm', { detail: strankaId })")
  })

  it('fail-closed: parser odloža dispatch — brez id stranke SAMO navigacija (R216 vzorec)', () => {
    expect(src).toContain("import { opomnikStrankaIdIzVrstice } from '@/lib/crm-deep-link'")
    expect(src).toContain('const strankaId = opomnikStrankaIdIzVrstice(item.id)')
    expect(src).toContain('if (strankaId) window.dispatchEvent')
  })

  it('followup/invoice ostajata navadna R182 navigacija (deep-link nosi SAMO opomnik — izrecna odločitev)', () => {
    expect(src).toContain("} else if (item.kind === 'followup' || item.kind === 'invoice') {")
    // followup/invoice veja ima navigate crm, BREZ select-crm:
    const veja = src.split("item.kind === 'followup' || item.kind === 'invoice'")[1]?.split("} else if")[0] ?? ''
    expect(veja).toContain("roksal:navigate")
    expect(veja).not.toContain('roksal:select-crm')
  })

  it('aria + KIND_STYLE pini ostajajo nedotaknjeni (R287 regresija — copy NI spremenjen)', () => {
    expect(src).toContain('— odpre CRM (opomnik)')
    expect(src).toContain("opomnik: { icon: PhoneCall, bg: 'bg-roksal-amber/15', fg: 'text-roksal-amber' },")
    expect(src).toContain("opomnikPotekel: { icon: PhoneCall, bg: 'bg-roksal-red/15', fg: 'text-roksal-red' },")
  })
})

describe('R288 — page.tsx (strazar): lupina lasti deep-link stanje (R214 vzorec)', () => {
  const src = beri('src/app/page.tsx')

  it('listener roksal:select-crm z whitelist guardom (samo ne-prazen niz — fail-closed)', () => {
    expect(src).toContain("window.addEventListener('roksal:select-crm', onSelectCrmStranka)")
    expect(src).toContain("window.removeEventListener('roksal:select-crm', onSelectCrmStranka)")
    const veja = src.split('function onSelectCrmStranka')[1]?.split('}')[0] ?? ''
    expect(veja).toContain("typeof id === 'string' && id")
  })

  it('state v lupini + one-shot callback (useCallback — stabilen identifikator za učinek)', () => {
    expect(src).toContain('const [izbranaStrankaId, setIzbranaStrankaId] = useState<string | null>(null)')
    expect(src).toContain('const obravnavajIzbranoStranko = useCallback(() => setIzbranaStrankaId(null), [])')
  })

  it('prop prehod v CrmTab (zahteva + one-shot callback)', () => {
    expect(src).toContain('<CrmTab izbranaStrankaId={izbranaStrankaId} onStrankaIzbranaObravnavana={obravnavajIzbranoStranko} />')
  })
})

describe('R288 — CrmTab (strazar): poraba + poudarjena vrstica (D6 stil)', () => {
  const src = beri('src/components/roksal/crm-tab.tsx')

  it('poraba je čista lib funkcija (komponenta tanka vez — R283 vzorec)', () => {
    expect(src).toContain("import { crmDeepLinkOdlocitev } from '@/lib/crm-deep-link'")
    expect(src).toContain('crmDeepLinkOdlocitev<CrmCustomer>(izbranaStrankaId, customers, loading, error)')
    expect(src).toContain("if (odlocitev.dejanje === 'CAKAJ') return")
  })

  it('one-shot: ODPRI → detail Sheet + poudarek; PRESKOCI/ODPRI počistita zahtevo (callback)', () => {
    expect(src).toContain("setPoudarjenStrankaId(odlocitev.stranka.id)")
    expect(src).toContain('setSelectedCustomer(odlocitev.stranka)')
    expect(src).toContain('setDetailOpen(true)')
    expect(src).toContain('onStrankaIzbranaObravnavana?.()')
  })

  it('poudarjena vrstica: roksal-amber obroba + polnilo (ISTO žetonska družina kot hover — 0 novih hex)', () => {
    expect(src).toContain("poudarjenStrankaId === c.id ? 'border-roksal-amber/60 bg-roksal-amber/5' : ''")
    expect(src).toContain("poudarjenStrankaId === c.id ? 'Poudarjeno iz zvončka (opomnik)' : undefined")
  })

  it('props z varnimi privzetimi vrednostmi (<CrmTab /> brez propov ostaja veljaven)', () => {
    expect(src).toContain('izbranaStrankaId?: string | null')
    expect(src).toContain('onStrankaIzbranaObravnavana?: () => void')
  })

  it('0 novih hex (žetonska družina — R288 dodaja samo roksal-amber razrede)', () => {
    // isti pin kot r287 — crm-tab je že vseboval hex proste resnico (barve v
    // STATUS_COLORS/Sheet so tailwind tokeni); R288 ne doda NOVEGA hex-a.
    const novi = src.match(/#[0-9a-fA-F]{6}\b/g) ?? []
    expect(novi).toEqual([])
  })
})
