// R189 — prijavna diagnostika + številčni povzetek odzivnih časov.
// ---------------------------------------------------------------------------
// (a) F1 POPRAVEK (fail-verbose luknja): /api/auth in /api/auth/demo pošiljata
//     ob 429 podrobnost { detail: 'Poskusi znova čez N s.' } + Retry-After že
//     od R137 — prijavna stran je pa brala SAMO data.error in je podrobnost
//     tiho izgubila. Uporabnik je videl 'Preveč poskusov prijave.' brez
//     čakalnega časa. Zdaj: postaviNapako() pokaže TOČNO to, kar strežnik
//     pove (nič izmišljenega), in ČISTI podrobnost ob vsakem novem poskusu.
// (b) F2 'Zgrajeno' v nogi prijave: terenska diagnostika build žiga ŠE PRED
//     prijavo (MONTR pokliče pisarno, ker se ne more prijaviti → obe veta
//     'kateri build te servira'). EN VIR zigIzpis (R185 banner / R187 kartica
//     vzorec) + javna ruta /api/public/version (R181 dvojček — deluje tudi
//     pod starim middleware artefaktom). Fail-soft po celotni verigi: ne-ok,
//     pokvaren JSON, prazen žig, neveljaven datum → noga SKRITA (nikoli
//     surovega ISO niza, nikoli izmišljenega 'Zgrajeno').
// (c) F3 številčni povzetek zgodovine odzivnih časov (SISTEM — zdravje
//     kartica, R187/R188): trak pokaže OBRIS, povzetek tri točke (min /
//     povprečje / max) iz ISTEGA vihra (zdravje-zgodovina). Fail-closed
//     jedro (prazna / pokvarena zgodovina = TypeError), fail-soft žičenje
//     (null → vrstica odsotna, trak ostane — vzorec 'Zgrajeno' R187).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcOf = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8')

/** Koda BREZ komentarjev (line + JSX blok) — trditve nad klasami/vrsticami NE
 *  smejo zadeti dokumentacijskih omemb (vzorec r179 codeOf). */
const codeOf = (p: string): string =>
  srcOf(p).replace(/\/\/[^\n]*/g, '').replace(/\{\/\*[\s\S]*?\*\//g, '')

const prijava = (): string => srcOf('src/app/login/page.tsx')
const kartica = (): string => srcOf('src/components/roksal/sistem-zdravje-card.tsx')
const jedro = (): string => srcOf('src/lib/zdravje-zgodovina.ts')

// Čisto jedro — pravi uvoz (enake runde testi smejo uvažati jedro neposredno)
import { odziviStatistika } from '../zdravje-zgodovina'

describe('R189 (a) — prijava: 429 podrobnost NI več tiho izgubljena (fail-verbose)', () => {
  it('postaviNapako(): podrobnost le pri ne-praznem nizu, sicer null (nič izmišljenega)', () => {
    const src = prijava()
    expect(src).toContain('function postaviNapako(sporocilo: string, detail: unknown)')
    expect(src).toContain("typeof detail === 'string' && detail !== '' ? detail : null")
  })

  it('OBA handlerja (prijava IN demo) uporabljata istega — API data.detail gre v UI', () => {
    const src = prijava()
    // POST /api/auth:
    expect(src).toMatch(/postaviNapako\(data\?\.error \?\? 'Prijava ni uspela\.', data\?\.detail\)/)
    // POST /api/auth/demo:
    expect(src).toMatch(/postaviNapako\(data\?\.error \?\? 'Demo dostop ni uspel\.', data\?\.detail\)/)
    // vrsta odgovora razširjena z detail (prej samo { error?: string }):
    expect(src.match(/detail\?: unknown/g)?.length).toBe(2)
  })

  it('podrobnost se ČISTI ob vsakem novem poskusu (stara 429 sekunda ne visi pod svežo napako)', () => {
    const src = prijava()
    // 2× na začetku handlerjev + postaviNapako čisti prek ternaria (null pri
    // praznem/ne-nizu detail — isti učinek, ENA točka resnice za čiščenje):
    expect(src.match(/setPodrobnost\(null\)/g)?.length).toBe(2)
    // vsak handler začne s čistim stanjem (setError + setPodrobnost skupaj):
    expect(src).toMatch(/setError\(null\)\n    setPodrobnost\(null\)/)
    // helper sam zapiše ALI podrobnost ALI null — nikoli zastarele vrednosti:
    expect(src).toContain("setPodrobnost(typeof detail === 'string' && detail !== '' ? detail : null)")
  })

  it('izris: podrobnost ZNOTRAJ obstoječega role=alert (enoskrbna napaka, fail-verbose)', () => {
    const src = prijava()
    const alertIdx = src.indexOf('role="alert"')
    const podrobnostIdx = src.indexOf('{podrobnost && (')
    expect(alertIdx).toBeGreaterThan(-1)
    expect(podrobnostIdx).toBeGreaterThan(alertIdx)
    // en izris, blokiran na {error && — brez napake ničesar (nič praznih obljub)
    expect(src.match(/\{podrobnost && \(/g)?.length).toBe(1)
  })

  it('REGRESIJA: glavno sporočilo ostane iz data.error (znano sporočilo 401/403/429)', () => {
    const src = prijava()
    expect(src).toContain("data?.error ?? 'Prijava ni uspela.'")
    expect(src).toContain("data?.error ?? 'Demo dostop ni uspel.'")
    expect(src).toContain('Omrežna napaka. Preveri povezavo.')
  })
})

describe('R189 (b) — prijava: Zgrajeno v nogi (terenska diagnostika pred prijavo)', () => {
  it('EN VIR: uvaža zigIzpis iz posodobitev-jedro — komponenta NE formatiraja časa sama', () => {
    const src = prijava()
    expect(src).toContain("import { zigIzpis } from '@/lib/posodobitev-jedro'")
    // NI lastnega formaterja (nikoli druge resnice ob bannerju/kartici):
    expect(src).not.toContain('Intl.DateTimeFormat')
    expect(src).not.toContain('toLocaleString')
  })

  it('javna ruta NAJPREJ: /api/public/version (R181 dvojček — star middleware artefakt)', () => {
    const src = prijava()
    expect(src.match(/fetch\('\/api\/public\/version'\)/g)?.length).toBe(1)
    expect(src).not.toContain("fetch('/api/version')")
  })

  it('fail-soft po celotni verigi: ne-ok / pokvaren JSON / prazen žig / pokvaren datum → noga SKRITA', () => {
    const src = prijava()
    expect(src).toContain('(r) => (r.ok ? r.json() : null)')
    expect(src).toContain("if (typeof zig !== 'string' || zig === '') return")
    expect(src).toMatch(/try \{\n          setZgrajeno\(zigIzpis\(zig\)\)\n        \} catch \{\n          setZgrajeno\(null\)\n        \}/)
    // omrežni izpad → prav tako skrito (catch veja)
    expect(src).toMatch(/\.catch\(\(\) => \{\n        if \(!cancelled\) setZgrajeno\(null\)\n      \}\)/)
    // nikoli surovega ISO niza v DOM (samo zigIzpis izpis):
    expect(src).not.toContain('toISOString')
  })

  it('noga je pogojena na zgrajeno (null = odsotna) z naslovom za diagnostiko', () => {
    const src = prijava()
    expect(src).toContain('{zgrajeno && (')
    expect(src).toContain('title="Build žig te namestitve"')
    // tabular-nums + diskretna belina na navy — družina obstoječega fallbacka
    expect(src).toContain('text-white/50 tabular-nums')
  })
})

describe('R189 (c) — čisto jedro odziviStatistika (zdravje-zgodovina)', () => {
  it('min / povprečje / max iz realnih meritev (zaokroženo na celo ms)', () => {
    expect(odziviStatistika([7, 22, 10])).toEqual({ najhitrejsa: 7, povprecna: 13, najpocasnejsa: 22 })
    expect(odziviStatistika([3])).toEqual({ najhitrejsa: 3, povprecna: 3, najpocasnejsa: 3 })
    // zaokrožanje: 1.5 → 2 (Math.round), 12.4 → 12:
    expect(odziviStatistika([1, 2]).povprecna).toBe(2)
    expect(odziviStatistika([10, 15]).povprecna).toBe(13)
    // ring vhod (najstarejša pade ven) — povzetek sledi obsegu, ki ga dobi:
    expect(odziviStatistika([100, 8, 9])).toEqual({ najhitrejsa: 8, povprecna: 39, najpocasnejsa: 100 })
  })

  it('fail-closed: prazna zgodovina = TypeError (ničesa ni povzeti)', () => {
    expect(() => odziviStatistika([])).toThrow(TypeError)
  })

  it('fail-closed: pokvarena meritev = TypeError (nikoli lažne številke)', () => {
    expect(() => odziviStatistika([-1])).toThrow(TypeError)
    expect(() => odziviStatistika([Number.NaN])).toThrow(TypeError)
    expect(() => odziviStatistika([Number.POSITIVE_INFINITY])).toThrow(TypeError)
    expect(() => odziviStatistika([7, Number.NaN])).toThrow(TypeError)
  })
})

describe('R189 (c) — kartica: številčni povzetek ob traku (fail-soft žičenje)', () => {
  it('EN VIR: uvaža odziviStatistika + vrsto iz ISTEGA jedra kot trak', () => {
    const src = kartica()
    expect(src).toMatch(/import \{[\s\S]*odziviStatistika,[\s\S]*\} from '@\/lib\/zdravje-zgodovina'/)
    expect(src).toContain('type OdziviStatistika,')
  })

  it('povzetek iz ISTEGA stanja zgodovine (sejaZgodovinaPreber) v USPEŠNI veji, fail-soft → null', () => {
    const src = kartica()
    expect(src).toContain('setStatistika(odziviStatistika(sejaZgodovinaPreber()))')
    // fail-soft ovojnica (vzorec 'Zgrajeno' R187 — pokvaren izračun ne podre kartice):
    expect(src).toMatch(/try \{\n          setStatistika\(odziviStatistika\(sejaZgodovinaPreber\(\)\)\)\n        \} catch \{\n          setStatistika\(null\)\n        \}/)
  })

  it('napaka / omrežje NE pustita zastarele statistike (ravnatelj R188: napaka NE doda palice)', () => {
    const src = kartica()
    // tri veje čistijo: uspešna napaka-veja, catch veja + nič drugega
    expect(src.match(/setStatistika\(null\)/g)?.length).toBe(3)
  })

  it('izris NASVETEN: vrstica samo kadar statistika != null, ob traku, ENA vrsta razredov', () => {
    const src = kartica()
    expect(src.match(/\{statistika && \(/g)?.length).toBe(1)
    // enaka vrsta mikroskopa kot oznaka traku (družina text-[10px] muted/70):
    expect(src).toMatch(/text-\[10px\] leading-tight text-muted-foreground\/70 tabular-nums/)
    // vsebina: razpon + povprečje (sklanjatev v jedru ni potrebna — številke)
    expect(src).toContain('{statistika.najhitrejsa}–{statistika.najpocasnejsa} ms, povp. {statistika.povprecna}')
    // NOTRI znotraj traku bloka (za oznako, pred zaključkom bloka):
    const trakIdx = src.indexOf('Odzivni časi (')
    const statistikaIdx = src.indexOf('{statistika && (')
    expect(trakIdx).toBeGreaterThan(-1)
    expect(statistikaIdx).toBeGreaterThan(trakIdx)
  })

  it('REGRESIJA R188: trak + role=img aria EN VIR + oznaka obsega ostanejo nedotaknjeni', () => {
    const src = kartica()
    expect(src).toContain('role="img"')
    expect(src).toContain('aria-label={odziviPovzetek(zgodovina)}')
    expect(src).toContain('Odzivni časi ({obsegZgodovine(zgodovina.length)}, ring {ZGODOVINA_MAX})')
  })
})
