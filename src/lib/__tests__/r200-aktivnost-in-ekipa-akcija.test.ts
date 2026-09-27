// Roksal — testi R200: 'Zadnja aktivnost' z uro (aktivnostOznaka — Ekipa)
// + 'Odpri Ekipa' akcija na FAILED_LOGINS_OVERVIEW vrstici v zvončku
// ---------------------------------------------------------------------------
// Motiv (R199 P1 (e) + zaprtje varnostne zanke):
//   • Ekipa je 'Zadnja aktivnost' prikazovala SAMO datum — admin ni videl, ali
//     je bila aktivnost danes ob 08:03 ali lani. Nov EN VIR helper
//     aktivnostOznaka: 'danes ob HH:MM:SS' / 'včeraj ob …' / 'DD. MM. YYYY ob …';
//     URa = casOznaka (EN VIR s pečati 'Osveženo ob', R170).
//   • Zvonček FAILED_LOGINS_OVERVIEW vrstica je DoS-ila ADMINa z informacijo
//     brez akcije — zdaj chip 'Odpri Ekipa' pelje direktno v Ekipa zavihek
//     (ročni zaklep R134) prek obstoječega roksal:navigate vzorca (CRM, R182).
//   • Čista funkcija z VBRIZGALNIM `zdaj` → deterministično čez polnoč
//     (lekcija: relativni časi + implicitni Date.now() = flaky testi).
// Brez sheme/migracij; brez AI; brez naključja.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { aktivnostOznaka } from '@/lib/aktivnost-oznaka'
import { casOznaka } from '@/lib/osvezitev-fokus'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

describe('R200 — aktivnostOznaka (čista funkcija, vbrizgalen zdaj)', () => {
  // Fiksni referenčni trenutek: 15.06.2026, 22:04:30 LOKALNO (deterministično).
  const zdaj = new Date(2026, 5, 15, 22, 4, 30)

  it('null / undefined / prazen / neveljaven vnos → null (klicatelj pokaže "nikoli" — brez izmišljije)', () => {
    expect(aktivnostOznaka(null, zdaj)).toBeNull()
    expect(aktivnostOznaka(undefined, zdaj)).toBeNull()
    expect(aktivnostOznaka('', zdaj)).toBeNull()
    expect(aktivnostOznaka('ni datum', zdaj)).toBeNull()
  })

  it('istega koledarskega dne → "danes ob HH:MM:SS" (ura = casOznaka EN VIR)', () => {
    const d = new Date(2026, 5, 15, 8, 3, 9)
    expect(aktivnostOznaka(d, zdaj)).toBe(`danes ob ${casOznaka(d)}`)
    expect(aktivnostOznaka(d, zdaj)).toBe('danes ob 08:03:09')
  })

  it('prejšnji koledarski dan → "včeraj ob …" — TUDI pri 23:59 → polnoč (31 min razlike je "včeraj", ne 24-h okno)', () => {
    const vecer = new Date(2026, 5, 14, 23, 59, 0)
    expect(aktivnostOznaka(vecer, zdaj)).toBe('včeraj ob 23:59:00')
    const jutriZjutraj = new Date(2026, 5, 15, 0, 31, 0) // ista "zdaj" lokacija naslednje jutro
    expect(aktivnostOznaka(vecer, jutriZjutraj)).toBe('včeraj ob 23:59:00')
  })

  it('starejši datum → "DD. MM. YYYY ob HH:MM:SS" (oblika datuma = prejšnja prikazna oblika toLocaleDateString sl-SI)', () => {
    const d = new Date(2026, 5, 13, 7, 45, 12)
    const pričakovano = `${d.toLocaleDateString('sl-SI')} ob 07:45:12`
    expect(aktivnostOznaka(d, zdaj)).toBe(pričakovano)
    // prihodnost (ne bi smela obstajati) pade na ABSOLUTNO obliko — brez posebne relativne oznake
    const prihodnost = new Date(2026, 5, 16, 9, 0, 0)
    expect(aktivnostOznaka(prihodnost, zdaj)).toBe(
      `${prihodnost.toLocaleDateString('sl-SI')} ob 09:00:00`
    )
  })

  it('sprejme ISO string (API vrne lastActive: toISOString() ?? null) in je determinističen (isti vnos → isti izhod)', () => {
    const d = new Date(2026, 5, 14, 12, 0, 0)
    const iso = d.toISOString()
    const a = aktivnostOznaka(iso, zdaj)
    const b = aktivnostOznaka(iso, zdaj)
    expect(a).toBe(b)
    expect(a).toBe('včeraj ob 12:00:00')
  })
})

describe('R200 — zvonček: "Odpri Ekipa" akcija na FAILED_LOGINS_OVERVIEW (source kontrakt)', () => {
  const src = srcOf('src/components/roksal/notification-center.tsx')

  it('UserCog je uvožen iz ENEGA lucide-react vira; r182 kontraktna vrstica ostane nedotaknjena', () => {
    expect(src).toContain('UserCog, Inbox, Wrench, History, ShieldCheck,')
    // r182: EN VIR ikon — zaporedje pred zapiranjem uvoza se ohrani
    // R212: ShoppingCart (aktivna naročila digest) dodan v isti import
    expect(src).toMatch(/Wrench, History, ShieldCheck, ShoppingCart,\n\} from 'lucide-react'/)
  })

  it('akcija obstaja, navigira po obstoječem roksal:navigate vzoru (more: ekipa) in ack-a isto vrstico', () => {
    expect(src).toContain("new CustomEvent('roksal:navigate', { detail: { tab: 'more', more: 'ekipa' } })")
    expect(src).toContain('await openPersisted(n)')
    // zapri panel, NAVIGACIJA, ack — vrstni red je pomemben (panel ne prekrije Ekipe)
    expect(src).toMatch(/setOpen\(false\)\s*\n\s*window\.dispatchEvent\(new CustomEvent\('roksal:navigate'/)
  })

  it('chip je POGOJEN na FAILED_LOGINS_OVERVIEW (edina ekipno-obseg varnostna vrstica) in je SOSED glavnega gumba (ni gnezdenja gumbov)', () => {
    expect(src.match(/n\.template === 'FAILED_LOGINS_OVERVIEW' && \(/g)?.length).toBe(1)
    // sosed, ne otrok: zaključni </button> glavne vrstice NESPRED glavni chip komentar
    expect(src).toMatch(/<\/button>\s*\{\/\* R200 — akcija kot SOSED gumba/)
  })

  it('vidno besedilo + aria-label + temni literali na isti vrstici (r162 stražar: dark:text- literal)', () => {
    expect(src).toContain('Odpri Ekipa')
    expect(src).toContain('aria-label="Odpri Ekipa — pregled ekipnih računov"')
    expect(src).toContain('dark:bg-roksal-ink/10 dark:text-roksal-ink dark:hover:bg-roksal-ink/20')
  })
})

describe('R200 — Ekipa: "Zadnja aktivnost" z uro (source kontrakt)', () => {
  const src = srcOf('src/components/roksal/team-tab.tsx')

  it('uvozi aktivnostOznako in je uporabi z "nikoli" rezervo; stara samo-datum oblika je ODSOTNA', () => {
    expect(src).toContain("import { aktivnostOznaka } from '@/lib/aktivnost-oznaka'")
    expect(src).toContain('aktivnostOznaka(u.lastActive) ?? ')
    expect(src).not.toContain('u.lastActive ? new Date(u.lastActive).toLocaleDateString')
  })

  it('helper je client-safe: brez server-only uvozov (samo casOznaka)', () => {
    const lib = srcOf('src/lib/aktivnost-oznaka.ts')
    expect(lib).toContain("import { casOznaka } from '@/lib/osvezitev-fokus'")
    expect(lib.match(/^import /gm)?.length).toBe(1)
    expect(lib).not.toMatch(/from '.*\/password'|from '@\/lib\/db'|bcrypt/)
  })
})
