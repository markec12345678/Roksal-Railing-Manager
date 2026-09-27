// R230 — ZAMUJENA tema zaključek: kartica 'Zamujena dobava' na Domovu
// (sorojenica vodje kartice R228 — 5. površina iste dimenzije: vodja R228,
// zvonček R229, Naročila oznaka R229, Domov R230; ISTI vir /api/material-orders
// R210, ISTA lib strogost jeZamujenaDobava z izrecno polnočjo — fail-closed,
// manjkajoča/pokvarena obljuba NIKOLI ni zamuda).
//
// + [Mandatory] stil: zadnji stone dvojčki v OPERATIVNEM jedru aplikacije →
//   žetoni (en razred obe temi, 0 novih hex): punch-list (Odprto chip + vrstice
//   + krogci + tekst), deal-pipeline (NACRTOVANO head/over/dot/bar), calculator
//   (betoniranje Card), material-intelligence (advisory teksti). Javni portali
//   (setup/aktivacija/m-token) in cv-studio ostanejo NAMERNE izjeme (lastna
//   estetika zunaj app-lupine).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { jeZamujenaDobava } from '@/lib/zamujena-dobava'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const domov = beri('src/components/roksal/dashboard-tab.tsx')
const punch = beri('src/components/roksal/punch-list.tsx')
const pipeline = beri('src/components/roksal/deal-pipeline.tsx')
const calculator = beri('src/components/roksal/calculator-tab.tsx')
const material = beri('src/components/roksal/material-intelligence-tab.tsx')

const DANAS = new Date('2026-09-28T00:00:00')
const VCERAJ = '2026-09-27T00:00:00.000Z'
const JUTRI = '2026-09-29T00:00:00.000Z'

describe('R230 — Domov kartica Zamujena dobava (sorojenica vodje R228)', () => {
  it('EN VIR: /api/material-orders fetch ostaja EN (R210 — isti feed za aktivna in zamujene)', () => {
    const zadetki = domov.match(/fetch\('\/api\/material-orders'\)/g) ?? []
    expect(zadetki.length).toBe(1)
  })

  it('lib-only logika: jeZamujenaDobava z izrecno polnočjo (danasDomov useMemo)', () => {
    expect(domov).toContain("import { jeZamujenaDobava } from '@/lib/zamujena-dobava'")
    expect(domov).toContain('const danasDomov = useMemo(')
    expect(domov).toContain('d.setHours(0, 0, 0, 0)')
    expect(domov).toContain('(o) => jeZamujenaDobava(o, danasDomov)')
  })

  it('fail-closed: tip datumDobave OPCIJSKO (čuden odgovor = ne moremo presoditi)', () => {
    expect(domov).toContain('datumDobave?: string | null')
  })

  it('iskrena vidnost: LE ko podatki naloženi IN števec > 0 (brez lažnega 0)', () => {
    expect(domov).toContain('!narocilaLoading && !narocilaError && zamujeneDobaveDomov > 0')
  })

  it('aria + title povejeta dejanje (barva ni edini nosilec — družina R223/R228)', () => {
    expect(domov).toContain('aria-label={`Zamujena dobava (${zamujeneDobaveDomov}) — odpre Material → Naročila`}')
    expect(domov).toContain('title="Obljubljeni datum dobave je pretekel, naročilo pa še ni prejeto — klik odpre Naročila"')
  })

  it('roksal-red ALARM družina + CalendarX + tabular-nums števec (en vizual en pomen)', () => {
    expect(domov).toContain('border-roksal-red/20 bg-roksal-red/5')
    expect(domov).toContain('hover:bg-roksal-red/10')
    expect(domov).toContain('<CalendarX className="h-5 w-5 shrink-0 text-roksal-red" aria-hidden="true" />')
    expect(domov).toContain('rounded-full bg-roksal-red px-1.5')
  })

  it('klik → Material → Naročila (subTab orders — ISTI protokol kot R208/R228/R229)', () => {
    expect(domov).toContain("detail: { tab: 'more', more: 'material', subTab: 'orders' }")
  })

  it('lib meje (hitri pin): danes še NI zamuda, jutri NI, včeraj JE; zaprti/manjkajoči NIKOLI', () => {
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: VCERAJ }, DANAS)).toBe(true)
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: JUTRI }, DANAS)).toBe(false)
    expect(jeZamujenaDobava({ status: 'DOBLJENO', datumDobave: VCERAJ }, DANAS)).toBe(false)
    expect(jeZamujenaDobava({ status: 'POSLANO', datumDobave: null }, DANAS)).toBe(false)
  })
})

describe('R230 — [Mandatory] stil: zadnji stone dvojčki v operativnem jedru → žetoni', () => {
  it('punch-list: Odprto chip + vrstice + krogci + tekst na žetonih (stone izbrisan)', () => {
    expect(punch).toContain("'bg-muted text-muted-foreground border-border'")
    expect(punch).toContain("'border-border bg-card text-transparent hover:border-roksal-amber'")
    expect(punch).toContain("'text-muted-foreground line-through' : 'text-roksal-ink'")
    expect(punch).not.toMatch(/stone-[0-9]/)
  })

  it('deal-pipeline: NACRTOVANO head/over/dot/bar na žetonih (stone izbrisan)', () => {
    expect(pipeline).toContain("'from-muted'")
    expect(pipeline).toContain("'ring-muted-foreground/70'")
    expect(pipeline).toContain("dot: 'bg-muted-foreground'")
    expect(pipeline).not.toMatch(/stone-[0-9]/)
  })

  it('calculator: betoniranje Card na žetonih (stone izbrisan)', () => {
    expect(calculator).toContain('<Card className="border-border bg-muted/40">')
    expect(calculator).not.toMatch(/stone-[0-9]/)
  })

  it('material-intelligence: advisory teksti text-roksal-ink (stone izbrisan)', () => {
    expect(material).not.toMatch(/stone-[0-9]/)
  })

  it('0 novih hex v spremenjenih komponentah (žetoni, ne barvni literali)', () => {
    for (const [ime, src] of [['domov', domov], ['punch', punch], ['pipeline', pipeline]] as const) {
      const hexi = src.match(/#[0-9a-fA-F]{6}\b/g) ?? []
      expect(hexi, ime).toEqual([])
    }
  })

  it('namerne izjeme ostanejo DOKUMENTIRANE: javni portali + cv-studio niso del app-lupine', () => {
    // setup/aktivacija/m-token/cv-studio imajo lastno estetiko — ta test
    // dokumentira, da NISO spregledane, ampak izrecno izvzete (r230 odločitev).
    for (const rel of [
      'src/app/setup/setup-client.tsx',
      'src/app/aktivacija/[token]/activation-client.tsx',
      'src/components/roksal/cv-studio.tsx',
    ]) {
      expect(beri(rel)).toMatch(/stone-[0-9]/) // še vedno na stone — namerne izjeme
    }
  })
})
