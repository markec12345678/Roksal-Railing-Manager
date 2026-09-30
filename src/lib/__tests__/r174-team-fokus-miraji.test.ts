// R174 — Ekipa (team-tab) fail-verbose + refetch-on-focus + pokvarjeni mirrori.
// ---------------------------------------------------------------------------
// 1. FIX (R162 CRM / R173 plošča vzorec): team-tab `load` je bil fail-silent —
//    `if (res.ok) {…} else { setUsers([]) }` + `catch { setUsers([]) }` brez
//    error state: pri padcu APIja je seznam TIHO ostal star/prazen (admin je
//    mislil, da ekipe ni, medtem ko je API padel) — kršitev "brez tihe
//    degradacije". Zdaj error state z razlogom (401/json.error/status/omrežje)
//    + error panel role="alert" + gumb "Poskusi znova".
// 2. P1 (iz R173 kandidatov): refetch-on-focus za Ekipa — pisarna/admin
//    spreminja vloge, povablja in zaklepa račune v drugi seji; pregled je
//    zastarel do remonta. Hook načelo: loader = EDINI vir napak (fail-verbose).
// 3. Render vrata (vzorec termini-card R170 / CRM R173): vrtiljak SAMO ko
//    loading && prazno — ob osvežitvi ob fokusu ostane seznam VIDEN;
//    error panel ima prednost pred praznim stanjem (nikoli lažnega
//    "Ni podatkov — povabite prvega člana ekipe").
// 4. STIL PASS (novo družina v scanu): POKVARJENI MIRRORI — dvojni poševnici
//    v opacity modifierju (`dark:bg-X-950/40/60`) ne generirajo CSS-a (Tailwind
//    ne prepozna razreda) → svetel madež v temni temi. 9 popravkov v 4
//    datotekah (measurements, calculator, logistics ×2, invoice-manager ×4)
//    + team-tab (`dark:bg-amber-950/40/70`). Scan r168-dark-scan.py dobi
//    novo družino 'pokvarjen-mirror'; test je stražar na ravni virov.
// Varnostni pas (R165/R167 nauček): vsi source grepi imajo SCOPED vzorce.
// R175 DODATEK: 403 users.read NI error — produkcija QA (spot MONTER) je
// ulovila lažen alarm: error panel je prekril zasnovano pošteno stanje
// 'Ekipa — ureja pisarna' (§10/R135). Fail-verbose ostane za 401/5xx/omrežje.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const team = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/team-tab.tsx'), 'utf8')

describe('R174 FIX — team-tab fail-silent → fail-verbose (R162/R173 vzorec)', () => {
  it('!res.ok VEJA počisti users; error SAMO za realne napake (403 = pravična meja, ne napaka)', () => {
    const src = team()
    expect(src).toMatch(
      /if \(!res\.ok\) \{\s*\n\s*setUsers\(\[\]\)\s*\n[\s\S]*?if \(res\.status !== 403\) \{\s*\n\s*setError\(/,
    )
  })

  it('403 users.read NI error — pošteno stanje R135 (Ekipa — ureja pisarna) ostane ŽIVO', () => {
    const src = team()
    // 403 izjema pred setError (produkcija QA spot MONTER — lažen alarm)
    expect(src).toContain('if (res.status !== 403) {')
    // pošteno stanje panel je ohranjen (canRead=false veja)
    expect(src).toContain('Ekipa — ureja pisarna')
    expect(src).toContain('Pregled računov je pravica users.read (pisarna).')
  })

  it('401 ima lastno sporočilo (isti vzorec kot CRM R162 + plošča R173)', () => {
    const src = team()
    expect(src).toContain("'Prijava je potekla — ponovno se prijavite (napaka 401).'")
  })

  it('json.error razlog je vključen v sporočilo ("Strežnik ni vrnil ekipe")', () => {
    const src = team()
    expect(src).toContain('`Strežnik ni vrnil ekipe: ${json.error} (napaka ${res.status}).`')
    expect(src).toContain('`Strežnik ni vrnil ekipe (napaka ${res.status}).`')
  })

  it('catch NIČ tihega ignore — omrežna napaka je vidna', () => {
    const src = team()
    // catch blok v load() nastavi error (ne samo setUsers([]))
    // R178: med vstavljen še fail-closed čiščenje pečata (setEkipaOsvezitev(null))
    expect(src).toMatch(
      /\} catch \{\s*\n\s*setUsers\(\[\]\)\s*\n\s*setEkipaOsvezitev\(null\)\s*\n\s*setError\('Ni povezave s strežnikom/,
    )
  })

  it('setError(null) na začetku load() — nikoli zastarelega errorja ob ponovnem osveževanju', () => {
    const src = team()
    expect(src).toMatch(/setLoading\(true\)\s*\n\s*setError\(null\)/)
  })

  it('error panel: role="alert" + AlertCircle + "Poskusi znova" z aria-label', () => {
    const src = team()
    expect(src).toMatch(/role="alert"/)
    expect(src).toContain('<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-roksal-amber" aria-hidden="true" />')
    expect(src).toContain('Poskusi znova')
    expect(src).toContain('aria-label="Ponovno naloži seznam ekipe"')
  })

  it('fail-verbose 401/5xx sporočila ostanejo (samo 403 je izjema)', () => {
    const src = team()
    expect(src).toContain("'Prijava je potekla — ponovno se prijavite (napaka 401).'")
    expect(src).toContain('`Strežnik ni vrnil ekipe: ${json.error} (napaka ${res.status}).`')
    expect(src).toContain('`Strežnik ni vrnil ekipe (napaka ${res.status}).`')
  })

  it('Poskusi znova gumb ima hover detail (transition-colors hover:text-roksal-ink — R172/R173 vzorec)', () => {
    const src = team()
    expect(src).toMatch(
      /className="shrink-0 transition-colors hover:text-roksal-ink focus-visible:ring-2 focus-visible:ring-roksal-navy\/40 focus-visible:ring-offset-2"\s*\n\s*aria-label="Ponovno naloži seznam ekipe"/,
    )
  })

  it('error panel ima PREDNOST pred praznim stanjem (nikoli lažnega "Ni podatkov")', () => {
    const src = team()
    const errIdx = src.indexOf('{error ? (')
    const emptyIdx = src.indexOf('Ni podatkov — povabite prvega člana ekipe.')
    expect(errIdx).toBeGreaterThan(-1)
    expect(emptyIdx).toBeGreaterThan(-1)
    expect(errIdx).toBeLessThan(emptyIdx)
  })
})

describe('R174 P1 — Ekipa refetch-on-focus (loader = EDINI vir napak)', () => {
  it('team-tab importira + žiče useRefetchOnFocus(load)', () => {
    const src = team()
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toMatch(/useRefetchOnFocus\(load\)/)
    // loader ostane EDINI vir napak (hook ne požira — brez .catch v žičenju)
    expect(src).not.toMatch(/useRefetchOnFocus\(\s*\(\)\s*=>\s*load\(\)\.catch/)
  })

  it('render vrata: loading && users.length === 0 (osvežitev ne utripa vrtiljaka nad seznamom)', () => {
    const src = team()
    expect(src).toMatch(/loading && users\.length === 0 \?/)
  })

  it('seznam med osvežitvijo signalizira z aria-busy (vzorec CRM CardContent)', () => {
    const src = team()
    expect(src).toMatch(/className="space-y-2" aria-busy=\{loading \|\| undefined\}/)
  })
})

describe('R174 STIL — pokvarjeni mirrori (dvojni poševnici v opacity modifierju)', () => {
  const ROCSAL = join(process.cwd(), 'src', 'components', 'roksal')

  it('nobena roksal komponenta ne vsebuje dark: razreda z dvema opacity modifierjema', () => {
    const offenders: string[] = []
    for (const f of readdirSync(ROCSAL).filter((x) => x.endsWith('.tsx'))) {
      const src = readFileSync(join(ROCSAL, f), 'utf8')
      const lines = src.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.trim().startsWith('*') || lines[i]!.trim().startsWith('//')) continue
        if (/dark:[\w-]+-[\w-]+\/\d+\/\d+/.test(lines[i]!)) offenders.push(`${f}:${i + 1}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('popravljeni mirrorji uporabljajo ustaljen /40 konvencijo (EN VIR z ostalimi paneli)', () => {
    for (const [file, count] of [
      ['measurements-tab.tsx', 1],
      // R314 pin shift (ISTI vzorec kot invoice-manager R309): calculator-tab
      // estrih kartici harmonizirani na roksal žetone — raw mirror tam
      // ZAKONITO ne obstaja več (obrnjena regresija spodaj).
      ['logistics-tab.tsx', 2],
    ] as const) {
      const src = readFileSync(join(ROCSAL, file), 'utf8')
      const fixed = src.match(/dark:bg-\w+-950\/40\b/g) ?? []
      expect(fixed.length, file).toBeGreaterThanOrEqual(count)
    }
    // R309 pin shift: invoice-manager je surove palete PRESELJAL na roksal
    // žetone (roksal-green/amber/red z alfo) — žeton je temsko prilagodljiv
    // PO NARAVI, zato raw `dark:bg-*-950/40` mirrorji tam ZAKONITO ne
    // obstajajo več (0, ne ≥4). Invarianta se obrne: vsak raw mirror, ki bi
    // se vrnil, je regresija harmonizacije.
    const inv = readFileSync(join(ROCSAL, 'invoice-manager.tsx'), 'utf8')
    const rawMirrors = inv.match(/dark:bg-\w+-950\/40\b/g) ?? []
    expect(rawMirrors.length, 'invoice-manager.tsx').toBe(0)
    // R314 obrnjena regresija: calculator-tab raw mirrorjev 0 (žetoni temsko
    // prilagodljivi po naravi) — vsak raw mirror, ki bi se vrnil, je regresija.
    const calc = readFileSync(join(ROCSAL, 'calculator-tab.tsx'), 'utf8')
    const calcMirrors = calc.match(/dark:bg-\w+-950\/40\b/g) ?? []
    expect(calcMirrors.length, 'calculator-tab.tsx').toBe(0)
  })

  it('team-tab pošteno-stanje panel je popavljen na žetonih (R310 pin shift — surovi amber → roksal žetoni)', () => {
    // R310 pin shift: baner je harmoniziran iz surove palete
    // (bg-amber-50 dark:bg-amber-950/40) na roksal žetone
    // (border-roksal-amber/40 bg-roksal-amber/10) — žeton je temsko
    // prilagodljiv PO NARAVI (isti precedens kot invoice-manager R309),
    // besedilo je ink (r162 lekcija: dolgo besedilo NI žeton-besedilo).
    // Regresija: surovi mirror se ne sme vrniti; /40/70 repka ostaja prepovedana.
    const src = team()
    expect(src).toContain('rounded-xl border border-roksal-amber/40 bg-roksal-amber/10 px-3.5 py-3')
    expect(src).not.toContain('bg-amber-50 dark:bg-amber-950/40')
    expect(src).not.toContain('/40/70')
  })
})
