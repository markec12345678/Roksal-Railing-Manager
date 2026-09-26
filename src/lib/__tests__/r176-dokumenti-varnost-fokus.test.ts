// R176 — refetch-on-focus za DOKUMENTE + VARNOST (P1-b zaključek, vzorec
// zaloga R175): stabilni fail-verbose loaderji namesto nestabilnih in-effect
// funkcij; render vrata; nič dvojnega fetcha; brez utripa skeletov.
// ---------------------------------------------------------------------------
// 1. documents-tab: fetchData (nestabilna, v useEffect) → stabilen useCallback
//    loadAll. Ob osvežitvi ob fokusu se IZBIRA PROJEKTA NE resetira —
//    dokumenti se osvežijo za TRENUTNO izbrani projekt (selectedProjectRef);
//    auto-izbira prvega SAMO ko izbire še ni (prvi load) in v tem primeru
//    dokumente naloži obstoječi selectedProject useEffect — NIČ dvojnega
//    fetcha. Fail-verbose toasti R151 ohranjeni.
// 2. safety-tab: reloadKey + in-effect fetchWeather → stabilen useCallback
//    loadWeather; vrtiljak SAMO na prvem loadu (prviLoadRef) — ob fokusu in
//    ponovnem poskusu ostane vsebina/poštna napaka VIDNA; retryWeather kliče
//    loadWeather NEPOSREDNO (reloadKey država izbrisana — EN VIR); unmount
//    stražar (unmountedRef) ohranjen. Motiv: ocena varnosti montaže je
//    časovno občutljiva — zastareli vetrni podatki = lažna varnost.
// 3. STIL DETAJL: varnostni 'Poskusi znova' gumb dobi enotno povratno
//    informacijo transition-colors hover:text-roksal-ink (konvencija
//    R172/R173/R175 — sedaj 7 površin, stražar v r175 testu).
// Varnostni pas (R165/R167 nauček): vsi source grepi imajo SCOPED vzorce.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const docs = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/documents-tab.tsx'), 'utf8')

const safety = (): string =>
  readFileSync(join(process.cwd(), 'src/components/roksal/safety-tab.tsx'), 'utf8')

describe('R176 P1-b — dokumenti refetch-on-focus + stabilen loader', () => {
  it('documents-tab importira + žiče useRefetchOnFocus(loadAll) — brez .catch (loader = EDINI vir napak)', () => {
    const src = docs()
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toMatch(/useRefetchOnFocus\(loadAll\)/)
    expect(src).not.toMatch(/useRefetchOnFocus\(\s*\(\)\s*=>\s*loadAll\(\)\.catch/)
  })

  it('loadAll je stabilen useCallback + useEffect žičenje; fetchData (nestabilna kopija) izbrisana', () => {
    const src = docs()
    expect(src).toMatch(/const loadAll = useCallback\(async \(\) => \{/)
    expect(src).toMatch(/useEffect\(\(\) => \{\s*\n\s*void loadAll\(\)\s*\n\s*\}, \[loadAll\]\)/)
    expect(src).not.toContain('function fetchData')
  })

  it('izbira projekta se NE resetira ob osvežitvi — auto-izbira SAMO brez obstoječe (selectedProjectRef)', () => {
    const src = docs()
    expect(src).toMatch(/const selectedProjectRef = useRef\(selectedProject\)/)
    expect(src).toMatch(/if \(!selectedProjectRef\.current && projData\.length > 0\) \{\s*\n\s*setSelectedProject\(projData\[0\]\.id\)\s*\n\s*return\s*\n\s*\}/)
  })

  it('nič dvojnega fetcha: ob sveži izbiri dokumente naloži obstoječi selectedProject useEffect (ostane nespremenjen)', () => {
    const src = docs()
    expect(src).toMatch(/\}, \[selectedProject, loading\]\)/)
  })

  it('render vrata: loading && documents.length === 0 + aria-busy (osvežitev ne utripa skeletov)', () => {
    const src = docs()
    expect(src).toMatch(/loading && documents\.length === 0 \?/)
    expect(src).toMatch(/<CardContent className="px-4 pb-4" aria-busy=\{loading \|\| undefined\}>/)
  })

  it('fail-verbose R151 toasti ostanejo (dokumenti/projekti/povezava)', () => {
    const src = docs()
    expect(src).toContain("toast.error('Dokumentov ni mogoče naložiti (napaka strežnika)')")
    expect(src).toContain("toast.error('Projektov ni mogoče naložiti (napaka strežnika)')")
    expect(src).toContain("toast.error('Povezava ni uspela — podatki niso na voljo')")
  })
})

describe('R176 P1-b — varnost refetch-on-focus + stabilen loader (reloadKey izbrisan)', () => {
  it('safety-tab importira + žiče useRefetchOnFocus(loadWeather) — brez .catch', () => {
    const src = safety()
    expect(src).toContain("import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'")
    expect(src).toMatch(/useRefetchOnFocus\(loadWeather\)/)
    expect(src).not.toMatch(/useRefetchOnFocus\(\s*\(\)\s*=>\s*loadWeather\(\)\.catch/)
  })

  it('loadWeather je stabilen useCallback; reloadKey država IZBRISANA — retry kliče loadWeather neposredno (EN VIR)', () => {
    const src = safety()
    expect(src).toMatch(/const loadWeather = useCallback\(async \(\) => \{/)
    // SCOPED: nobene rabe reloadKey države več (omejitev v zgodovinskem komentarju je dovoljena)
    expect(src).not.toMatch(/setReloadKey|useState\(0\)/)
    expect(src).toMatch(/function retryWeather\(\) \{\s*\n\s*void loadWeather\(\)\s*\n\s*\}/)
    expect(src).toMatch(/useEffect\(\(\) => \{\s*\n\s*void loadWeather\(\)\s*\n\s*\}, \[loadWeather\]\)/)
  })

  it('vrtiljak SAMO na prvem loadu (prviLoadRef) — fokus/ponovni poskus brez utripa skeletov', () => {
    const src = safety()
    expect(src).toMatch(/const prviLoadRef = useRef\(true\)/)
    expect(src).toMatch(/if \(prviLoadRef\.current\) \{\s*\n\s*prviLoadRef\.current = false\s*\n\s*setLoading\(true\)\s*\n\s*\}/)
  })

  it('unmount stražar ohranjen (unmountedRef) — setState po odmontiranju je zaščiten', () => {
    const src = safety()
    expect(src).toMatch(/const unmountedRef = useRef\(false\)/)
    expect(src).toMatch(/useEffect\(\(\) => \(\) => \{ unmountedRef\.current = true \}, \[\]\)/)
    expect(src).toMatch(/if \(unmountedRef\.current\) return/)
  })

  it('fail-closed R152 ohranjen — NI izmišljenih varnih vrednosti (napaka je vidna)', () => {
    const src = safety()
    expect(src).toContain('Vremenska storitev ni odgovorila (napaka ')
    expect(src).toContain('Vremenskih podatkov ni mogoče pridobiti — preverite povezavo.')
  })
})
