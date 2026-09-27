// R223 — ŠESTI signalec konvergence: kartica 'Brez dobavitelja' na Domovu
// (P1-c nadaljevanje po R221 čip + paleta, R222 badgei na treh signalcih).
//
// Prej: Domov je pokazal SAMO prvo dimenzijo (rdeča kartica 'Nizka zaloga
// materiala') — uporabnik, ki je odprl aplikacijo, ni videl, da naročilni
// tok pri N artiklih ne more oceniti postavke (druga dimenzija je bila
// vidna šele v Zalogi ⌘K/zvončku).
//
// Zdaj: Domov dobi sorojenico — amber kartico iz ISTEGA /api/inventory
// fetcha (EN VIR, nič nove zahteve), vidno LE ko so podatki res naloženi
// in je števec > 0; klik odpre Zalogo z aktivnim čipom (R221 protokol).
// STROGOST: manjkajoči števec NIKOLI ni 'brez' — le izrecna 0.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function beri(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const src = beri('src/components/roksal/dashboard-tab.tsx')

describe('R223 — domov: izpeljanka iz ISTEGA fetcha (strogost === 0)', () => {
  it('opcijski števec v tipu (starejši odgovor brez _count = ne moremo presoditi)', () => {
    expect(src).toContain('_count?: { prices?: number }')
  })

  it('dobesedna enačba === 0 (ISTA kot zvonček R222 + čip R221)', () => {
    expect(src).toContain('(i) => i._count?.prices === 0')
  })

  it('STROGOST: ohlapnejši izrazi so prepovedani (manjkajoče polje nikoli ne laže)', () => {
    expect(src).not.toContain('_count?.prices ?? 0')
    expect(src).not.toContain('_count?.prices <= 0')
  })
})

describe('R223 — domov: iskrena vidnost (brez lažnega 0)', () => {
  it('kartica vidna LE ko podatki naloženi IN števec > 0', () => {
    expect(src).toContain('!invLoading && !invError && brezDobaviteljaCount > 0')
  })

  it('števec je izpeljanka EN VIR (ISTI inventory state kot nizka zaloga)', () => {
    expect(src).toContain('const brezDobaviteljaCount = inventory.filter(')
  })
})

describe('R223 — domov: klik → R221 filter protokol (ISTI dispatch kot zvonček)', () => {
  it('deep-link nosi filter brez-dobavitelja (whitelist guard v page.tsx)', () => {
    expect(src).toContain("detail: { tab: 'inventory', filter: 'brez-dobavitelja' }")
  })

  it('iskren aria-label pove števec IN dejanje', () => {
    expect(src).toContain('— odpre Zalogo s filtrom brez dobavitelja')
  })

  it('opis pove resnico o naročilnem toku (ne samo števec)', () => {
    expect(src).toContain('naročilni tok postavke ne more oceniti')
  })
})

describe('R223 — [Mandatory] stil: amber družina, barva ni edini nosilec', () => {
  it('roksal-amber družina (pozornost, ne alarm — rdeča ostane nizki zalogi)', () => {
    expect(src).toContain('border-roksal-amber/40 bg-roksal-amber/5')
    expect(src).toContain('text-roksal-amber')
  })

  it('PackageX ikona (ISTA kot zvonček brez vrstice — en vizual en pomen)', () => {
    expect(src).toContain('<PackageX className="h-5 w-5 shrink-0 text-roksal-amber" aria-hidden="true" />')
  })

  it('števec pill: tabular-nums + iskren title (sorojenica naročilne kartice R210)', () => {
    expect(src).toContain('rounded-full bg-roksal-amber px-1.5 text-xs font-semibold leading-none text-roksal-ink tabular-nums')
    expect(src).toContain('title="Artikli brez vpisane cene pri katerem koli dobavitelju"')
  })

  it('dostopna interakcija: focus ring + hover + text-left (gumb, ne div)', () => {
    expect(src).toContain('focus-visible:ring-2 focus-visible:ring-roksal-amber/40')
    expect(src).toContain('transition-colors hover:bg-roksal-amber/10')
  })

  it('0 novih hex — kartica uporablja samo tokenne razrede', () => {
    const cardStart = src.indexOf('R223 — ŠESTI signalec konvergence: kartica')
    const cardEnd = src.indexOf('R210 — Naročila, ki čakajo na dejanje', cardStart)
    expect(cardStart).toBeGreaterThan(0)
    expect(cardEnd).toBeGreaterThan(cardStart)
    const card = src.slice(cardStart, cardEnd)
    expect(card).not.toMatch(/#[0-9a-fA-F]{6}/)
  })

  it('animate-fade-in-up (ISTA družina kot Low Stock Alert)', () => {
    expect(src).toContain('animate-fade-in-up')
  })
})

describe('R223 — sožitje z obstoječima signalcema (brez regresij)', () => {
  it('nizka zaloga kartica ostaja nespremenjena (rdeča veja + Zaloga v redu veja)', () => {
    expect(src).toContain('Nizka zaloga materiala')
    expect(src).toContain('Vsi artikli so nad minimalno zalogo.')
  })

  it('naročilna kartica ostaja nespremenjena (R210 pečat svežine R211)', () => {
    expect(src).toContain('Naročila, ki čakajo na dejanje')
    expect(src).toContain('narocilaOsvezitev')
  })

  it('ISTI dispatch protokol kot zvonček R222 (EN VIR usmerjanja)', () => {
    const zv = beri('src/components/roksal/notification-center.tsx')
    expect(zv).toContain("detail: { tab: 'inventory', filter: 'brez-dobavitelja' }")
    expect(src).toContain("detail: { tab: 'inventory', filter: 'brez-dobavitelja' }")
  })
})
