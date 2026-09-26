// R179 — (a) BANNER "NOVA VERZIJA NA VOLJO" (build žig + /api/version +
// update-banner) in (b) DARK-SWEEP JAVNEGA PORTALA /[token] (tokenizacija
// trdo svetlih površin — R172 družina zaključena).
// ---------------------------------------------------------------------------
// (a) Motiv: long-lived tab/PWA je med deployi STARE UI kode (API so network-
// only §5 — podatki sveži, koda zastarel). Čisto jedro odločbe (vzorec
// osvezitev-fokus) + tanka ovojnica z družinskim hookom useRefetchOnFocus.
// Fail-closed: neznan žig → banner SKRIT (nikoli lažnega "nova verzija").
// (b) Motiv: naprava osebja s shranjeno temno temo je na javnem portalu videla
// SVETLE pege (trdo bg-white/bg-[#f7f9ff] brez dark ogledal). Rešitev:
// TOKENIZACIJA — bg-background/bg-card so v svetlobi BAJTNO enaki prejšnjim
// hex vrednostim (light: background #f7f9ff, card #ffffff), v temi pa pravilni.
// Varnostni pas (R165/R167 nauček): vsi source grepi imajo SCOPED vzorce.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { aliJeNovaVerzijaNaVoljo } from '@/lib/posodobitev-jedro'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

/** Koda BREZ komentarjev (line + JSX blok) — trditve nad klasami NE smejo zadeti
 *  dokumentacijskih omemb starih klas (vzorec: R179 komentar omenja bg-[#f7f9ff]). */
const codeOf = (p: string): string =>
  srcOf(p).replace(/\/\/[^\n]*/g, '').replace(/\{\/\*[\s\S]*?\*\//g, '')

describe('R179 (a) — čisto jedro aliJeNovaVerzijaNaVoljo (posodobitev-jedro)', () => {
  it('različna žiga → true (deploy novejši od tabove gradnje)', () => {
    expect(aliJeNovaVerzijaNaVoljo({ mojZig: '2026-09-26T15:00:00.000Z', streznikovZig: '2026-09-26T16:00:00.000Z' })).toBe(true)
    expect(aliJeNovaVerzijaNaVoljo({ mojZig: 'b', streznikovZig: 'a' })).toBe(true)
  })

  it('ista žiga → false (tab je na trenutnem deployu — NIČ bannerja)', () => {
    expect(aliJeNovaVerzijaNaVoljo({ mojZig: 'zig', streznikovZig: 'zig' })).toBe(false)
  })

  it('fail-closed: neznana stran (null ALI prazen niz) → false — nikoli lažnega bannerja', () => {
    expect(aliJeNovaVerzijaNaVoljo({ mojZig: null, streznikovZig: 'zig' })).toBe(false)
    expect(aliJeNovaVerzijaNaVoljo({ mojZig: 'zig', streznikovZig: null })).toBe(false)
    expect(aliJeNovaVerzijaNaVoljo({ mojZig: null, streznikovZig: null })).toBe(false)
    expect(aliJeNovaVerzijaNaVoljo({ mojZig: '', streznikovZig: 'zig' })).toBe(false)
    expect(aliJeNovaVerzijaNaVoljo({ mojZig: 'zig', streznikovZig: '' })).toBe(false)
  })

  it('fail-closed vhod: ne-objekt in ne-string → TypeError (nikoli tihega ugibanja)', () => {
    expect(() => aliJeNovaVerzijaNaVoljo(null as never)).toThrow(TypeError)
    expect(() => aliJeNovaVerzijaNaVoljo({ mojZig: 42 as never, streznikovZig: 'zig' })).toThrow(TypeError)
    expect(() => aliJeNovaVerzijaNaVoljo({ mojZig: 'zig', streznikovZig: {} as never })).toThrow(TypeError)
  })
})

describe('R179 (a) — /api/version + next.config + proxy (javna, brez podatkov)', () => {
  it('ruta vrne IZKLJUČNO build žig — brez db uvozov, brez podatkov (ničesar ne izdaja)', () => {
    const src = srcOf('src/app/api/version/route.ts')
    expect(src).toContain('process.env.NEXT_PUBLIC_BUILD_STAMP ?? null')
    expect(src).toContain("Response.json({ build })")
    expect(src).not.toMatch(/from '@\/lib\/db'/)
    expect(src).not.toMatch(/authenticate/)
  })

  it('next.config: NEXT_PUBLIC_BUILD_STAMP nastanjen TOČKO ENKRAT ob gradnji (env wiring)', () => {
    const src = srcOf('next.config.ts')
    expect(src).toMatch(/const BUILD_STAMP = new Date\(\)\.toISOString\(\)/)
    expect(src).toContain('NEXT_PUBLIC_BUILD_STAMP: BUILD_STAMP')
  })

  it('proxy: /api/version je javna po zasnovi (zastarel odjavljen tab mora preveriti verzijo)', () => {
    const src = srcOf('src/proxy.ts')
    expect(src).toContain("'/api/version'")
  })
})

describe('R179 (a) — update-banner žičenje (družina refetch-on-focus + fail-closed skrivanje)', () => {
  const banner = (): string => srcOf('src/components/roksal/update-banner.tsx')

  it('EN VIR odločbe: uvaža čisto jedro — komponenta NE odloča sama', () => {
    const src = banner()
    expect(src).toContain("import { aliJeNovaVerzijaNaVoljo } from '@/lib/posodobitev-jedro'")
    expect(src).toContain('aliJeNovaVerzijaNaVoljo({ mojZig: MOJ_ZIG, streznikovZig })')
  })

  it('družinska žičenja: ob mountu + ob vrnitvi v zavihek (useRefetchOnFocus — 30 s vrata)', () => {
    const src = banner()
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toMatch(/useRefetchOnFocus\(checkVersion\)/)
    expect(src).toMatch(/await fetch\('\/api\/version'\)/)
    expect(src).toMatch(/const MOJ_ZIG: string \| null = process\.env\.NEXT_PUBLIC_BUILD_STAMP \?\? null/)
  })

  it('omrežna napaka/ne-ok odgovor → tiho (pas skrit; nasvetna preverba, ni vir resnice)', () => {
    const src = banner()
    expect(src).toMatch(/if \(!res\.ok\) return/)
    // catch: brez setStreznikovZig — stanje ostane null = SKRITO
    expect(src).toMatch(/\} catch \{\s*\n\s*\/\/ brez mreže/)
  })

  it('skrivanje na deploy: ključ v localStorage VSEBUJE strežnikov žig (nov deploy = nov ključ = pas spokan)', () => {
    const src = banner()
    expect(src).toContain("const DISMISS_KEY = 'roksal-update-dismissed-zig'")
    expect(src).toMatch(/window\.localStorage\.setItem\(DISMISS_KEY, streznikovZig\)/)
    expect(src).toMatch(/skritZig !== streznikovZig/)
  })

  it('render: pas z gumbom Osveži (reload) + Skrij — dostopnost (role=status + aria-live + aria-labela)', () => {
    const src = banner()
    expect(src).toContain('role="status"')
    expect(src).toContain('aria-live="polite"')
    expect(src).toContain('Na voljo je nova verzija aplikacije.')
    expect(src).toMatch(/onClick=\{\(\) => window\.location\.reload\(\)\}/)
    expect(src).toContain('aria-label="Ponovno naloži aplikacijo za novo verzijo"')
    expect(src).toContain('aria-label="Skrij obvestilo o novi verziji"')
  })

  it('montaža v lupini: pas zraven PwaStatus, na istih površinah (skrit v VizTab produktu)', () => {
    const src = srcOf('src/app/page.tsx')
    expect(src).toContain("import { UpdateBanner } from '@/components/roksal/update-banner'")
    expect(src).toMatch(/\{activeTab !== 'viz' && <UpdateBanner \/>\}/)
  })
})

describe('R179 (b) — portal /[token] dark-sweep (tokenizacija = svetloba bajtno enaka, tema pravilna)', () => {
  const page = (): string => srcOf('src/app/portal/[token]/page.tsx')
  const gallery = (): string => srcOf('src/app/portal/[token]/gallery.tsx')

  it('page: NIČ trdo svetlega ozadja — bg-[#f7f9ff] in bg-white izrinjena s tokeni (bg-background/bg-card)', () => {
    const code = codeOf('src/app/portal/[token]/page.tsx')
    expect(code).not.toContain('bg-[#f7f9ff]')
    // bg-white brez alpha repka je TRDO svetlo površje — izrinjeno; bg-white/10
    // na navy glavi/črnem lightboxu je temno-nevtralno (namenjeno, ohranjeno).
    expect(code.match(/bg-white(?!\/)/g)).toBeNull()
    expect(code.match(/bg-background/g)?.length).toBeGreaterThanOrEqual(2)
    expect(code.match(/bg-card(?!\/)/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('page: timeline obročki + kontaktna obrobnica imajo pravilno temo (ring-card + dark:border mirror)', () => {
    const src = page()
    expect(src).toContain('ring-2 ring-card')
    expect(src).toContain('border border-roksal-navy/15 bg-card p-5 shadow-sm dark:border-roksal-ink/15')
    // čipi za datum/ceno: bg-card/70 (svetloba = white/70 bajtno enako)
    expect(src.match(/bg-card\/70/g)?.length).toBe(2)
  })

  it('gallery: NIČ trdo svetlega površja (bg-white/10 lightbox ostane — temno-nevtralen po zasnovi)', () => {
    const src = gallery()
    expect(src.match(/bg-white(?!\/)/g)).toBeNull()
    // tokeni že pokrijejo temo
    expect(src).toContain('bg-secondary')
  })

  it('NOVIH pokvarjenih mirrorjev NI (dvojni opacity modifier = Tailwind ne generira razreda)', () => {
    for (const src of [page(), gallery()]) {
      expect(src.match(/dark:[\w-]+-[\w-]+\/\d+\/\d+/g)).toBeNull()
    }
  })
})
