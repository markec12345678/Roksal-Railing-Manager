// R229 — ZAMUJENA tema nadaljevanje (sorojenica R222 'brez' vrstic — ENA
// dimenzija na NOVIH površinah): (1) zvonček — per-naročilo vrstice
// 'zamujena dobava' iz ISTEGA /api/material-orders fetcha (EN VIR — nič
// nove zahteve; ISTA lib strogost kot vodja kartica R228: jeZamujenaDobava
// z IZRECNO polnočjo — fail-closed, manjkajoča/pokvarena obljuba NIKOLI ni
// zamuda); (2) Material → Naročila — per-vrstična oznaka 'Pretekel rok'
// (ISTA lib, ISTA komponenta). ENA definicija badgea (badge-zamujena-dobava)
// — zvonček in Naročila jo uvozita, definicija TOČNO ENKRAT (družina
// R219/R222/R225/R227).
//
// + [Mandatory] stil: invoice-manager (OSNUTEK chip, Zapadlo povzetek,
//   cashflow letvica) + roksal-catalog (Inox chip) — zadnji stone/slate
//   dvojčki → žetoni (en razred obe temi, 0 novih hex; r168 PINi
//   sinhronizirani).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { jeZamujenaDobava, narociloBeseda } from '@/lib/zamujena-dobava'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const zvonek = beri('src/components/roksal/notification-center.tsx')
const material = beri('src/components/roksal/material-intelligence-tab.tsx')
const badge = beri('src/components/roksal/badge-zamujena-dobava.tsx')
const vodja = beri('src/components/roksal/vodja-dashboard.tsx')
const invoice = beri('src/components/roksal/invoice-manager.tsx')
const catalog = beri('src/components/roksal/roksal-catalog.tsx')

const DANAS = new Date('2026-09-28T00:00:00')
const VCERAJ = '2026-09-27T00:00:00.000Z'
const JUTRI = '2026-09-29T00:00:00.000Z'

describe('R229 — badge-zamujena-dobava: ENA definicija, roksal-red družina', () => {
  it('badge nosi dobeseden tekst Pretekel rok (barva ni edini nosilec)', () => {
    expect(badge).toContain('Pretekel rok')
  })

  it('roksal-red družina — ISTA struktura kot sorojeniki (obroba/30 + površina/10 + tekst)', () => {
    expect(badge).toContain('border-roksal-red/30')
    expect(badge).toContain('bg-roksal-red/10')
    expect(badge).toContain('text-roksal-red')
    expect(badge).toContain('uppercase tracking-wide')
  })

  it('oba potrošnika uvozita ISTO komponento (definicija TOČNO ENKRAT)', () => {
    expect(zvonek).toContain("import { BadgeZamujenaDobava } from '@/components/roksal/badge-zamujena-dobava'")
    expect(material).toContain("import { BadgeZamujenaDobava } from '@/components/roksal/badge-zamujena-dobava'")
    // definicija obstaja samo v ENI datoteki (zvonček/material NE definirajo svoje)
    expect(zvonek).not.toContain('function BadgeZamujenaDobava')
    expect(material).not.toContain('function BadgeZamujenaDobava')
  })
})

describe('R229 — zvonček: per-naročilo vrstice zamujena dobava (EN VIR)', () => {
  it('kind razširjen z zamujena (tip + style tabela + badge + aria + klik)', () => {
    expect(zvonek).toContain("'order' | 'brez' | 'zamujena'")
    expect(zvonek).toContain("zamujena: { icon: CalendarX, bg: 'bg-roksal-red/15', fg: 'text-roksal-red' }")
    expect(zvonek).toContain("{item.kind === 'zamujena' && <BadgeZamujenaDobava />}")
    expect(zvonek).toContain("item.kind === 'zamujena'")
  })

  it('EN VIR: /api/material-orders fetch ostaja EN (isti feed za digest in zamujene vrstice)', () => {
    const zadetki = zvonek.match(/fetch\('\/api\/material-orders'\)/g) ?? []
    expect(zadetki.length).toBe(1)
  })

  it('danas = izrecna polnoč (ISTI datumski jezik kot vodja R228 — determinizem)', () => {
    expect(zvonek).toContain('new Date(today.getFullYear(), today.getMonth(), today.getDate())')
  })

  it('filtri skozi lib jeZamujenaDobava (stroge veje — NIKOLI lastna ohlapna logika)', () => {
    expect(zvonek).toContain("import { jeZamujenaDobava } from '@/lib/zamujena-dobava'")
    expect(zvonek).toContain('.filter((o) => jeZamujenaDobava(o, danasZamude))')
  })

  it('iskrene vrstice: dobeseden naslov + podnaslov z obljubljenim datumom + meta dejanje', () => {
    expect(zvonek).toContain('`Naročilo pri ${o.supplier.naziv}`')
    expect(zvonek).toContain("'Naročilo brez dobavitelja'")
    expect(zvonek).toContain('je pretekel — naročilo še ni prejeto')
    expect(zvonek).toContain("'Izterjaj dobavo pri dobavitelju'")
    // omejitev vrstic — ISTI vzorec kot stock/brez (slice 8)
    expect(zvonek).toContain('zamujena.slice(0, 8)')
  })

  it('klik → Material → Naročila (subTab orders — ISTI protokol kot digest R212/R213)', () => {
    expect(zvonek).toContain("} else if (item.kind === 'order' || item.kind === 'zamujena') {")
    expect(zvonek).toContain("{ detail: { tab: 'more', more: 'material', subTab: 'orders' } }")
  })

  it('aria-label pove, kam vrstica vodi (dostopnost — družina R217)', () => {
    expect(zvonek).toContain('? `${item.title} — odpre Material → Naročila`')
  })

  it('fail-closed: tip datumDobave/supplier OPCIJSKO (čuden odgovor = ne moremo presoditi)', () => {
    expect(zvonek).toContain('datumDobave?: string | null')
    expect(zvonek).toContain('supplier?: { naziv: string } | null')
  })
})

describe('R229 — Material → Naročila: per-vrstična oznaka Pretekel rok', () => {
  it('vrstica nosi badge TOČNO ob jeZamujenaDobava (lib strogost, ne lastna logika)', () => {
    expect(material).toContain("import { jeZamujenaDobava } from '@/lib/zamujena-dobava'")
    expect(material).toContain('{jeZamujenaDobava(order, danasZamude) && <BadgeZamujenaDobava />}')
  })

  it('danasZamude = izrecna polnoč v useMemo (en izračun na montajo — determinizem)', () => {
    expect(material).toContain('const danasZamude = useMemo(')
    expect(material).toContain('d.setHours(0, 0, 0, 0)')
  })

  it('regresija: R208 aktivna-naročila pill in statusni chipi nespremenjeni', () => {
    expect(material).toContain("(o) => o.status === 'OSNUTEK' || o.status === 'POSLANO' || o.status === 'POTRJENO',")
    expect(material).toContain("order.status === 'POSLANO' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'")
  })
})

describe('R229 — regresije ZAMUJENA tema (R228 površine ostanejo)', () => {
  it('vodja kartica aria + iskreno vse-v-redu (R228) nespremenjena', () => {
    expect(vodja).toContain('aria-label={`Zamujena dobava (${stats.zamujeneDobave}) — odpre Material → Naročila`}')
    expect(vodja).toContain('stats.zamujeneDobave === 0 && (')
  })

  it('lib stroge veje (hitri ponovni pin — meja dneva + zaprti statusi)', () => {
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: VCERAJ }, DANAS)).toBe(true)
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: JUTRI }, DANAS)).toBe(false)
    expect(jeZamujenaDobava({ status: 'DOBLJENO', datumDobave: VCERAJ }, DANAS)).toBe(false)
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: null }, DANAS)).toBe(false)
    expect(narociloBeseda(1)).toBe('naročilo')
    expect(narociloBeseda(2)).toBe('naročili')
  })
})

describe('R229 — [Mandatory] stil: invoice-manager + roksal-catalog na žetonih', () => {
  it('invoice-manager: OSNUTEK chip + pika + povzetek + letvica na žetonih (stone izbrisan)', () => {
    expect(invoice).toContain("'bg-muted text-muted-foreground border-border'")
    expect(invoice).toContain("dot: 'bg-muted-foreground'")
    expect(invoice).toContain("'border-border bg-muted/40'")
    expect(invoice).toContain('bg-muted">')
    expect(invoice).toContain("'border-l-muted-foreground/40'")
    expect(invoice).not.toContain('bg-stone-100')
    expect(invoice).not.toContain('bg-stone-200')
    expect(invoice).not.toContain('bg-stone-50')
    expect(invoice).not.toContain('border-l-stone-300')
    expect(invoice).not.toContain('text-stone-500')
    expect(invoice).not.toContain('text-stone-600')
  })

  it('roksal-catalog: Inox chip na žetonih (slate izbrisan)', () => {
    expect(catalog).toContain("'bg-muted text-roksal-ink'")
    expect(catalog).not.toContain('bg-slate-200')
    expect(catalog).not.toContain('text-slate-800')
    expect(catalog).not.toContain('dark:bg-slate-500/15')
  })

  it('0 novih hex v treh spremenjenih komponentah (žetoni, ne barvne literale)', () => {
    for (const [ime, src] of [['zvonek', zvonek], ['material', material], ['badge', badge]] as const) {
      const hexi = src.match(/#[0-9a-fA-F]{6}\b/g) ?? []
      expect(hexi, ime).toEqual([])
    }
  })
})
