// R170 — osvežitev ob vrnitvi v zavihek/okno (P1-b iz R169) + pečat 'Osveženo ob'.
// ---------------------------------------------------------------------------
// Problem: okno, odprto medtem ko druga seja spremeni status, ostane zastarel
// do remonta. Runda doda: (1) čisto lib odločitev biOsvjezitiObFokusu + tanko
// hook ovojnico useRefetchOnFocus; (2) pečat 'Osveženo ob HH:MM:SS' (EN VIR
// RESNICE: casOznaka/osvezitevLabel), viden TOČNO takrat, ko so na zaslonu
// podatki uspešnega branja — nikoli nad napako/nalaganjem/praznim stanjem.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  biOsvjezitiObFokusu,
  casOznaka,
  osvezitevLabel,
  FOKUS_MIN_INTERVAL_MS,
} from '@/lib/osvezitev-fokus'

const hook = (): string =>
  readFileSync(join(process.cwd(), 'src/hooks/use-refetch-on-focus.ts'), 'utf8')

const terminiCard = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/termini-card.tsx'), 'utf8')

const logistics = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/logistics-tab.tsx'), 'utf8')

describe('R170 biOsvjezitiObFokusu — čista odločitev (fail-closed, deterministično)', () => {
  it('prvi dogodek (zadnjaOsvezitev null) → true: prva vrnitev vedno osveži', () => {
    expect(
      biOsvjezitiObFokusu({ now: 1_000_000, zadnjaOsvezitev: null, dokumentViden: true })
    ).toBe(true)
  })

  it('skrit dokument → false, TUDI na prvem dogodku (nikoli fetcha v ozadju)', () => {
    expect(
      biOsvjezitiObFokusu({ now: 1_000_000, zadnjaOsvezitev: null, dokumentViden: false })
    ).toBe(false)
    expect(
      biOsvjezitiObFokusu({
        now: 9_000_000,
        zadnjaOsvezitev: 1_000_000,
        dokumentViden: false,
      })
    ).toBe(false)
  })

  it('rate-limit: znotraj intervala → false, NA točno meji (>=) → true', () => {
    const osnova = { now: 100_000, zadnjaOsvezitev: 70_000, dokumentViden: true }
    // 100_000 - 70_000 = 30_000 = privzeti interval → true (>=).
    expect(biOsvjezitiObFokusu(osnova)).toBe(true)
    // 1 ms pred mejo → false.
    expect(biOsvjezitiObFokusu({ ...osnova, now: 99_999 })).toBe(false)
  })

  it('privzeti minIntervalMs je FOKUS_MIN_INTERVAL_MS = 30_000; po meri ga zamenja', () => {
    expect(FOKUS_MIN_INTERVAL_MS).toBe(30_000)
    // Po meri: 5 s interval, minilo 6 s → true.
    expect(
      biOsvjezitiObFokusu({
        now: 10_000,
        zadnjaOsvezitev: 4_000,
        minIntervalMs: 5_000,
        dokumentViden: true,
      })
    ).toBe(true)
    // Po meri: 5 s interval, minilo 4 s → false.
    expect(
      biOsvjezitiObFokusu({
        now: 8_000,
        zadnjaOsvezitev: 4_000,
        minIntervalMs: 5_000,
        dokumentViden: true,
      })
    ).toBe(false)
  })

  it('determinizem: isti vhod → isti izhod (dvakrat zapored)', () => {
    const vnos = { now: 500_000, zadnjaOsvezitev: 400_000, dokumentViden: true }
    expect(biOsvjezitiObFokusu(vnos)).toBe(biOsvjezitiObFokusu(vnos))
  })

  it('fail-closed: neveljaven vhod → TypeError (nikoli tihega ugibanja)', () => {
    expect(() =>
      biOsvjezitiObFokusu({ now: Number.NaN, zadnjaOsvezitev: null, dokumentViden: true })
    ).toThrow(TypeError)
    expect(() =>
      biOsvjezitiObFokusu({
        now: Number.POSITIVE_INFINITY,
        zadnjaOsvezitev: null,
        dokumentViden: true,
      })
    ).toThrow(TypeError)
    expect(() =>
      biOsvjezitiObFokusu({ now: 1_000, zadnjaOsvezitev: -5, dokumentViden: true })
    ).toThrow(TypeError) // -5 je končen, a negativen ms čas → nesmisel
    expect(() =>
      biOsvjezitiObFokusu({ now: 1_000, zadnjaOsvezitev: null, minIntervalMs: -1, dokumentViden: true })
    ).toThrow(TypeError)
    expect(() =>
      biOsvjezitiObFokusu({
        now: 1_000,
        zadnjaOsvezitev: null,
        minIntervalMs: Number.NaN,
        dokumentViden: true,
      })
    ).toThrow(TypeError)
    expect(() =>
      biOsvjezitiObFokusu({ now: 1_000, zadnjaOsvezitev: null, dokumentViden: 'da' as unknown as boolean })
    ).toThrow(TypeError)
    expect(() =>
      biOsvjezitiObFokusu({
        now: 1_000,
        zadnjaOsvezitev: Number.NaN,
        dokumentViden: true,
      })
    ).toThrow(TypeError)
    expect(() => biOsvjezitiObFokusu(null as unknown as Parameters<typeof biOsvjezitiObFokusu>[0])).toThrow(
      TypeError
    )
  })
})

describe('R170 casOznaka + osvezitevLabel — EN VIR RESNICE pečata', () => {
  it('casOznaka: sl-SI HH:MM:SS z vodilnimi ničlami (ura določena z vnosom)', () => {
    expect(casOznaka(new Date(2026, 8, 26, 14, 5, 9))).toBe('14:05:09')
    expect(casOznaka(new Date(2026, 0, 1, 0, 7, 3))).toBe('00:07:03')
    expect(casOznaka(new Date(2026, 5, 15, 23, 59, 59))).toBe('23:59:59')
  })

  it('casOznaka: fail-closed TypeError na neveljavnem/manjkajočem datumu', () => {
    expect(() => casOznaka(new Date('ne-obstaja'))).toThrow(TypeError)
    expect(() => casOznaka('14:05' as unknown as Date)).toThrow(TypeError)
    expect(() => casOznaka(null as unknown as Date)).toThrow(TypeError)
  })

  it('osvezitevLabel = "Osveženo ob " + casOznaka (vidno besedilo obeh površin)', () => {
    const d = new Date(2026, 8, 26, 14, 5, 9)
    expect(osvezitevLabel(d)).toBe('Osveženo ob 14:05:09')
    expect(osvezitevLabel(d)).toBe(`Osveženo ob ${casOznaka(d)}`)
    expect(() => osvezitevLabel(new Date('x'))).toThrow(TypeError)
  })
})

describe('R170 hook useRefetchOnFocus — tanka ovojnica (žičenje prek surovca)', () => {
  it('registrira OBA dogodka (visibilitychange + focus) in OBA odstrani v cleanupu', () => {
    const h = hook()
    expect(h).toContain("document.addEventListener('visibilitychange', poskusi)")
    expect(h).toContain("window.addEventListener('focus', poskusi)")
    expect(h).toContain("document.removeEventListener('visibilitychange', poskusi)")
    expect(h).toContain("window.removeEventListener('focus', poskusi)")
  })

  it('odločitev gre skozi ISTO lib funkcijo (nič duplikatske logike v hooku)', () => {
    const h = hook()
    expect(h).toContain('biOsvjezitiObFokusu(')
    expect(h).toContain("from '@/lib/osvezitev-fokus'")
    expect(h).toContain('FOKUS_MIN_INTERVAL_MS')
    expect(h).toContain("document.visibilityState === 'visible'")
  })

  it('VEDNO zadnji callback (ref vzorec) — sprememba identitete loadera ne registrira listenerjev znova', () => {
    const h = hook()
    expect(h).toContain('osveziRef.current = osvezi')
    expect(h).toContain('void osveziRef.current()')
    // Efekt za registracijo je prazen deps (enkrat; ref nosi najnovejši callback).
    expect(h).toMatch(/useEffect\(\(\) => \{[\s\S]*?addEventListener[\s\S]*?\}, \[\]\)/)
  })

  it('FAIL-VERBOSE: hook ne požira napak (brez tihega .catch)', () => {
    const h = hook()
    expect(h).not.toMatch(/\.catch\(\(\) =>/)
  })

  it('brez initial fetcha: listenerja sta edina sprožilca (brez direktnega klica osvezi() ob mountu)', () => {
    const h = hook()
    // Edini klic callbacka gre skozi ref ZNOTRAJ poskusi — brez direktnega
    // `osvezi()` ob mountu (prvi load je klicateljev useEffect).
    expect(h).not.toMatch(/\bosvezi\(\)/)
  })
})

describe('R170 žičenje v površinah — Termini kartica + Logistika Koledar', () => {
  it('termini-card: useRefetchOnFocus(nalozi) + import iz hooks', () => {
    const c = terminiCard()
    expect(c).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(c).toContain('useRefetchOnFocus(nalozi)')
  })

  it('termini-card: pečat iz zdaj (EN VIR — brez novega stanja), viden samo ob podatkih', () => {
    const c = terminiCard()
    // `zdaj` je nastavljen SAMO v uspešni veji nalozi — pečat = čas branja.
    expect(c).toContain('{zdaj && (')
    expect(c).toContain('Osveženo ob <span className="tabular-nums">{casOznaka(zdaj)}</span>')
    expect(c).toContain('title="Čas zadnje uspešne osvežitve podatkov"')
    expect(c).toContain("from '@/lib/osvezitev-fokus'")
    // Responsive + semantični žetoni (temna tema = prvi državljan).
    expect(c).toMatch(/hidden items-center gap-1 text-\[11px\] text-muted-foreground sm:flex/)
  })

  it('logistics-tab: useRefetchOnFocus(loadData) + pečat iz zadnjaOsvezitev', () => {
    const l = logistics()
    expect(l).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(l).toContain('useRefetchOnFocus(loadData)')
    expect(l).toContain('const [zadnjaOsvezitev, setZadnjaOsvezitev] = useState<Date | null>(null)')
    expect(l).toContain('Osveženo ob <span className="tabular-nums">{casOznaka(zadnjaOsvezitev)}</span>')
    expect(l).toContain('title="Čas zadnje uspešne osvežitve podatkov logistike"')
    expect(l).toContain("from '@/lib/osvezitev-fokus'")
  })

  it('logistics-tab: pečat = čas USPEŠNEGA branja — uspeh nastavi, VSE napake počistiti (3 veje)', () => {
    const l = logistics()
    // Uspešna veja (vsi 4 viri veljavni):
    expect(l).toContain('setZadnjaOsvezitev(new Date())')
    // Napake: padli viri, neveljaven JSON, omrežje — pečat NIČ (nikoli
    // lažne svežine nad praznimi/odsotnimi podatki):
    expect(l.match(/setZadnjaOsvezitev\(null\)/g)?.length).toBe(3)
    // Skrit med nalaganjem (med fetchem ni še svežega podatka):
    expect(l).toContain('{zadnjaOsvezitev && !loading && (')
  })

  it('DARK stražar: pečata v obeh površinah uporabljata semantične žetone (pregled samo vrstic pečata)', () => {
    // Nauček R165/R167: celoten surovec vsebuje tudi NAMERNE svetle žetone
    // drugače (npr. bg-roksal-navy + text-white gumbi) — pregled je zato
    // omejen na vrstice pečata (R170 dodatek), ne na celotno datoteko.
    const prepovedani = ['bg-white', 'text-gray-', 'bg-gray-', 'text-black']
    for (const [ime, src] of [['termini-card', terminiCard()], ['logistics-tab', logistics()]] as const) {
      const zacetek = src.indexOf('R170 — pečat')
      const konec = zacetek >= 0 ? src.indexOf(')}\n', src.indexOf('casOznaka(', zacetek)) : -1
      expect(zacetek, `${ime} nima pečata`).toBeGreaterThan(-1)
      expect(konec, `${ime}: pečat se ne zapre`).toBeGreaterThan(zacetek)
      const pecat = src.slice(zacetek, konec)
      for (const z of prepovedani) {
        expect(pecat.includes(z), `${ime} pečat vsebuje gol žeton ${z}`).toBe(false)
      }
      // Semantični žetoni so obvezni:
      expect(pecat).toContain('text-muted-foreground')
    }
  })
})

describe('R170 DARK javne strani — aktivacija + meritev + setup (sistemsko temne osebe)', () => {
  // Javne strani (brez prijave) so PRVI vtis novega uporabnika/stranke.
  // next-themes uporabi SISTEMSKO nastavitev — sistemsko temen uporabnik je
  // dobil svetel poln zaslon (bg-stone-100 + bg-white kartice brez dark:).
  // Naučen vzorec R167 preslikave: bg-X-100→dark:bg-X-800, bg-white→dark:bg-card,
  // border-200→dark:border-800, border-300→dark:border-700, X-50→dark:X-950/40,
  // text-500/600→dark:text-400, text-700→dark:text-300.
  const JAVNE = [
    'src/app/aktivacija/[token]/page.tsx',
    'src/app/aktivacija/[token]/activation-client.tsx',
    'src/app/m/[token]/page.tsx',
    'src/app/m/[token]/measure-lazy.tsx',
    'src/app/m/[token]/measure-client.tsx',
    'src/app/setup/setup-client.tsx',
  ] as const

  it.each(JAVNE)('%s: vsak svetli žeton ima dark: ogledalo na isti vrstici', (rel) => {
    const src = readFileSync(join(process.cwd(), rel), 'utf8')
    const vrstice = src.split('\n')
    vrstice.forEach((vrsta, i) => {
      if (vrsta.trim().startsWith('//') || vrsta.trim().startsWith('*')) return
      // Svetli žetoni, ki jih stražar uveljavlja (ali imajo dark: ali so prepovedani):
      const svetli = vrsta.match(
        /(?<![\w-])(?:bg-(?:stone|gray|slate|zinc|neutral)-(?:50|100|200|300)|border-(?:stone|gray|slate|zinc|neutral)-(?:100|200|300)|(?:bg|border)-(?:red|emerald|amber)-(?:50|100|200)|bg-white(?!\/)|text-(?:stone|gray|slate)-(?:500|600|700))/
      )
      if (!svetli) return
      // IZJEMI (dokumentirani): karta/leafleta v m/[token] — svetle ploščice
      // so NAMERNO svetle; locate gumb LEŽI NA svetli karti (bg-white +
      // navy besedilo — kontrast na ploščici, ne na temni kartici).
      if (rel.startsWith('src/app/m/') && vrsta.includes('mapElRef')) return
      if (rel.startsWith('src/app/m/') && vrsta.includes('bg-white text-roksal-navy')) return
      expect(
        vrsta,
        `${rel}:${i + 1} svetli žeton '${svetli[0]}' brez dark: ogledala`
      ).toMatch(/dark:/)
    })
  })

  it('m/[token]: karta (mapElRef) ostane svetla platno — locate gumb bg-white je NAMEREN (brez dark:)', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/m/[token]/measure-client.tsx'), 'utf8')
    const mapa = src.split('\n').find((l) => l.includes('mapElRef'))
    expect(mapa).toBeTruthy()
    // locate gumb je na svetli karti — njegov bg-white mora ostati brez dark:.
    const locate = src.split('\n').find((l) => l.includes('bg-white text-roksal-navy shadow-md'))
    expect(locate).toBeTruthy()
    expect(locate).not.toMatch(/dark:bg-/)
  })
})
