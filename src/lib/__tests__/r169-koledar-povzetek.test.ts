// R169 — povzetek 'Skupaj ur' v Logistika → Koledar (EN VIR RESNICE).
// ---------------------------------------------------------------------------
// Runda R169 doda: koledar podzavihek Logistike prikaže ISTI povzetek
// predvidenih ur kot dashboard Termini kartica — prek ISTIH lib funkcij
// (normalizirajTermin → vsotaPredvidenihUr → terminUrPovzetek). Nič nove
// agregacijske logike — samo žičenje + preskočeni števec (fail-verbose).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const logistics = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/logistics-tab.tsx'), 'utf8')

const terminiCard = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/termini-card.tsx'), 'utf8')

describe('R169 Koledar povzetek — EN VIR RESNICE z dashboard Termini kartico', () => {
  it('logistics-tab importira ISTE lib funkcije kot termini-card (vsota/povzetek + normalizacija po isti poti)', () => {
    const log = logistics()
    const card = terminiCard()
    for (const fn of ['terminUrPovzetek', 'vsotaPredvidenihUr']) {
      expect(log).toContain(fn)
      expect(card).toContain(fn)
    }
    // oba iz ISTE knjižnice (en sam vir resnice):
    expect(log).toContain("from '@/lib/termini-prikaz'")
    expect(card).toContain("from '@/lib/termini-prikaz'")
    // normalizacija gre pri obeh skozi ISTE lib funkcije: koledar direktno
    // (normalizirajTermin), kartica prek groupTermini (ki normalizirajTermin
    // kliče interno) — nič nove duplikatske logike v komponentah:
    expect(log).toContain('normalizirajTermin(raw, null)')
    expect(card).toContain('groupTermini(')
  })

  it('agregat je useMemo nad schedules z preskočenim števcem (ne tiho izgubljene vrstice)', () => {
    const log = logistics()
    expect(log).toMatch(/const urPovzetek = useMemo\(/)
    const idx = log.indexOf('const urPovzetek = useMemo(')
    const body = log.slice(idx, idx + 600)
    expect(body).toContain('for (const raw of schedules)')
    expect(body).toContain("normalizirajTermin(raw, null)")
    expect(body).toContain('preskoceni += 1')
    expect(body).toContain('vsotaPredvidenihUr(prikazne)')
  })

  it('povzetek je izrisan SAMO v veji z termini (nikoli ob nalaganju/praznem stanju)', () => {
    const log = logistics()
    const nalaganjeIdx = log.indexOf('Ni terminov. Ustvari nov termin montaže.')
    const povzetekIdx = log.indexOf('{terminUrPovzetek(urPovzetek.ag)}')
    expect(nalaganjeIdx).toBeGreaterThan(-1)
    expect(povzetekIdx).toBeGreaterThan(-1)
    expect(povzetekIdx).toBeGreaterThan(nalaganjeIdx)
  })

  it('preskočeni vnosi VIDNO omenjeni v povzetku (fail-verbose, vzorec TerminiCard)', () => {
    const log = logistics()
    expect(log).toContain('urPovzetek.preskoceni > 0')
    expect(log).toContain("'vnos preskočen'")
    expect(log).toContain("'vnosov preskočenih'")
  })

  it('povzetek: Clock ikona + tabular-nums + title dokumentira izključitev preklicanih', () => {
    const log = logistics()
    const idx = log.indexOf('Vsota predvidenih ur vidnih terminov (preklicani so izključeni)')
    expect(idx).toBeGreaterThan(-1)
    const block = log.slice(Math.max(0, idx - 500), idx + 400)
    expect(block).toContain('tabular-nums')
    expect(block).toMatch(/Clock className="h-3 w-3[^"]*text-roksal-amber"/)
  })

  it('dark žetoni: bg-muted/60 semantični (temen samodejno) — brez golih svetlih bg žetonov', () => {
    const log = logistics()
    const idx = log.indexOf('rounded-md bg-muted/60')
    expect(idx).toBeGreaterThan(-1)
  })
})
