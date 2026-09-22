// Testi za railing-layout.ts — prenos domenskega motorja iz BalkonAR (Android).
// Pričakovane vrednosti so ENAKE kot v Kotlin testih (80 testov, zeleni), zato ta
// datoteka dokazuje, da je prenos zvest in ne le približek.
//
// Vse številke, ki jih ti testi preverjajo, končajo na ponudbi in v delavnici:
// število stebrov, širine stekel, dolžine letev in koti žage.

import { describe, expect, it } from 'vitest'
import {
  anchorCount,
  barGapMm,
  bounds,
  cornerCount,
  cutList,
  cutText,
  defaultRailingSpec,
  distanceXZ,
  edgeCount,
  edgeLabel,
  evenDivisions,
  fmtMm,
  fmtNumber,
  frameFromTwoPoints,
  frameFromWorld,
  freeEndCount,
  glassAreaM2,
  handrailLengthMm,
  infillBottomMm,
  infillHeightMm,
  infillTopMm,
  interiorDegrees,
  layoutRailing,
  miterDegrees,
  perimeterOf,
  polygonAreaXZ,
  signedTurnDegrees,
  snapToBoundary,
  splitEqually,
  summarise,
  toWorld,
  totalRunMm,
  v3,
  yawDegrees,
  type Perimeter,
  type RailingSpec,
  type Vec3,
} from '../railing-layout'

/** 4,00 × 1,50 m plošča, obseg izmerjen naokrog. */
const RECT: Vec3[] = [v3(0, 0, 0), v3(4, 0, 0), v3(4, 0, -1.5), v3(0, 0, -1.5)]

const closed = (pts: Vec3[] = RECT, overrides: Record<number, number> = {}): Perimeter =>
  perimeterOf(pts, true, overrides)

const openPath = (pts: Vec3[]): Perimeter => perimeterOf(pts, false)

const L_PATH: Vec3[] = [v3(0, 0, 0), v3(3, 0, 0), v3(3, 0, -2)]

// ══════════════════════════════════════════════════════════════════════════════
describe('geometrija — konvencije, ki jih ni mogoče preveriti na oko', () => {
  it('yaw zasuče lokalno +X na smer poteka', () => {
    expect(yawDegrees(v3(1, 0, 0))).toBeCloseTo(0, 5)
    expect(yawDegrees(v3(0, 0, -1))).toBeCloseTo(90, 5)
    expect(yawDegrees(v3(0, 0, 1))).toBeCloseTo(-90, 5)
    expect(Math.abs(yawDegrees(v3(-1, 0, 0)))).toBeCloseTo(180, 5)
    expect(yawDegrees(v3(1, 0, -1))).toBeCloseTo(45, 5)
  })

  it('pozitiven zasuk = v levo (nasprotno urinega kazalca od zgoraj)', () => {
    expect(signedTurnDegrees(v3(-1, 0, 0), v3(0, 0, 0), v3(0, 0, -1))).toBeCloseTo(90, 4)
    expect(signedTurnDegrees(v3(-1, 0, 0), v3(0, 0, 0), v3(0, 0, 1))).toBeCloseTo(-90, 4)
    expect(signedTurnDegrees(v3(-1, 0, 0), v3(0, 0, 0), v3(1, 0, 0))).toBeCloseTo(0, 4)
  })

  it('miter je polovica zasuka, notranji kot pa njegov komplement', () => {
    const turn = signedTurnDegrees(v3(-1, 0, 0), v3(0, 0, 0), v3(0, 0, -1))
    expect(miterDegrees(turn)).toBeCloseTo(45, 4)
    expect(interiorDegrees(v3(-1, 0, 0), v3(0, 0, 0), v3(0, 0, -1))).toBeCloseTo(90, 4)
  })

  it('distanceXZ ignorira višino — nagnjen estrih ne podaljša ograje', () => {
    expect(distanceXZ(v3(0, 0, 0), v3(3, 4, 0))).toBeCloseTo(3, 5)
    expect(distanceXZ(v3(0, 0, 0), v3(3, 0.02, 0))).toBeCloseTo(3, 5)
  })

  it('splitEqually dela enake kose in nikoli ne preseže maksimuma', () => {
    expect(splitEqually(4000, 1400)).toHaveLength(3)
    splitEqually(4000, 1400).forEach((p) => expect(p).toBeLessThanOrEqual(1400 + 1e-6))
    // Dolžina, ki je točno n × max, ne sme postati n+1 kosov zaradi plavajoče vejice.
    expect(splitEqually(4200, 1400)).toHaveLength(3)
    expect(splitEqually(0, 1400)).toHaveLength(0)
    expect(splitEqually(-5, 1400)).toHaveLength(0)
  })

  it('evenDivisions drži vsak razpon pod maksimumom', () => {
    expect(evenDivisions(4000, 1100).map((d) => Math.round(d))).toEqual([1000, 2000, 3000])
    expect(evenDivisions(900, 1100)).toHaveLength(0)
    expect(evenDivisions(2200, 1100)).toHaveLength(1)
  })

  it('površina mnogokotnika je neodvisna od smeri oštevilčenja', () => {
    expect(polygonAreaXZ(RECT)).toBeCloseTo(6, 5)
    expect(polygonAreaXZ([...RECT].reverse())).toBeCloseTo(6, 5)
    expect(polygonAreaXZ(RECT.slice(0, 2))).toBe(0)
  })

  it('snapToBoundary pripne blizu roba in pusti daleč pri miru', () => {
    const boundary = [v3(0, 0, 0), v3(4, 0, 0)]
    const snapped = snapToBoundary(v3(1.5, 0, 0.04), boundary, false, 0.1)
    expect(snapped.z).toBeCloseTo(0, 5)
    expect(snapped.x).toBeCloseTo(1.5, 5)
    const untouched = snapToBoundary(v3(1.5, 0, 0.4), boundary, false, 0.1)
    expect(untouched.z).toBeCloseTo(0.4, 5)
  })

  it('degenerirana smer vrne +X namesto NaN', () => {
    const l = layoutRailing(closed([v3(1, 0, 1), v3(1, 0, 1)]), defaultRailingSpec())
    expect(Number.isNaN(l.edges[0].yawDeg)).toBe(false)
    expect(bounds([])).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('razpored — steklo v U-profilu na pravokotnem balkonu', () => {
  const spec = defaultRailingSpec()
  const layout = layoutRailing(closed(), spec)

  it('štirje robovi, skupaj 11.000 mm, oznake A–D', () => {
    expect(layout.edges).toHaveLength(4)
    expect(layout.closed).toBe(true)
    expect(totalRunMm(layout)).toBeCloseTo(11_000, 0)
    expect(layout.edges.map((e) => e.label)).toEqual(['A', 'B', 'C', 'D'])
    expect(layout.edges[0].fabricationLengthMm).toBeCloseTo(4000, 0)
    expect(layout.edges[1].fabricationLengthMm).toBeCloseTo(1500, 0)
    expect(edgeCount(closed())).toBe(4)
  })

  it('brez stebrov, en U-profil in ena letev na rob', () => {
    expect(layout.posts).toHaveLength(0)
    expect(layout.baseProfiles).toHaveLength(4)
    expect(layout.handrails).toHaveLength(4)
    expect(handrailLengthMm(layout)).toBeCloseTo(11_000, 0)
  })

  it('višina stekla = višina ograje − letev − odkriti del profila', () => {
    // 1000 − 30 (letev) = 970 zgoraj; 150 − 40 (vpetje) = 110 spodaj → 860 stekla
    expect(infillTopMm(spec)).toBeCloseTo(970, 5)
    expect(infillBottomMm(spec)).toBeCloseTo(110, 5)
    expect(infillHeightMm(spec)).toBeCloseTo(860, 5)
    expect(layout.panels[0].heightMm).toBeCloseTo(860, 1)
    expect(layout.panels[0].bottomOffsetMm).toBeCloseTo(110, 1)
  })

  it('dolg rob se razdeli na ENAKE panele, ne na dolgega plus ostanek', () => {
    const longEdge = layout.panels.filter((p) => p.edgeIndex === 0)
    expect(longEdge).toHaveLength(3)
    const widths = longEdge.map((p) => p.widthMm)
    expect(widths[0]).toBeCloseTo(widths[1], 3)
    expect(widths[1]).toBeCloseTo(widths[2], 3)
    expect(widths[0]).toBeCloseTo(4000 / 3 - 10, 1) // minus 10 mm silikonska fuga
    expect(layout.panels.filter((p) => p.edgeIndex === 1)).toHaveLength(2)
    expect(layout.panels).toHaveLength(10)
    expect(glassAreaM2(layout)).toBeGreaterThan(9)
  })

  it('vsak vogal ima notranji kot 90° in nasprotno nagnjena reza, da se spojita', () => {
    expect(cornerCount(layout)).toBe(4)
    for (const rail of layout.handrails) {
      expect(rail.startInteriorDeg).toBeCloseTo(90, 1)
      expect(rail.endInteriorDeg).toBeCloseTo(90, 1)
      expect(Math.abs(rail.startMiterDeg)).toBeCloseTo(45, 1)
      expect(Math.abs(rail.endMiterDeg)).toBeCloseTo(45, 1)
      expect(Math.sign(rail.startMiterDeg)).toBe(-Math.sign(rail.endMiterDeg))
    }
  })

  it('sklenjena zanka nima prostih koncev', () => {
    expect(freeEndCount(layout)).toBe(0)
  })

  it('lege panelov sedijo na robu plošče na pravi višini', () => {
    const first = layout.panels.find((p) => p.edgeIndex === 0)!
    expect(first.world.x).toBeCloseTo(0.6667, 3) // 1/3 od 4000 mm
    expect(first.world.z).toBeCloseTo(0, 3)
    expect(first.world.y).toBeCloseTo(0.11, 3) // 110 mm nad ploščo
    expect(first.thicknessMm).toBeCloseTo(16.76, 2)
    expect(layout.edges[0].yawDeg).toBeCloseTo(0, 1)
    expect(layout.edges[1].yawDeg).toBeCloseTo(90, 1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('razpored — odprta pot (balkon na treh straneh)', () => {
  const spec = defaultRailingSpec({ system: 'POST_BARS' })
  const layout = layoutRailing(openPath(L_PATH), spec)

  it('prosta konca se režeta pravokotno, miter je samo v vogalu', () => {
    expect(layout.edges).toHaveLength(2)
    expect(freeEndCount(layout)).toBe(2)
    const [first, second] = layout.handrails
    expect(first.startMiterDeg).toBeCloseTo(0, 5)
    expect(first.startInteriorDeg).toBeCloseTo(180, 1)
    expect(first.endMiterDeg).toBeCloseTo(45, 1)
    expect(first.endInteriorDeg).toBeCloseTo(90, 1)
    expect(second.startMiterDeg).toBeCloseTo(-45, 1) // sosednji kos, nasproten nagib
    expect(second.endMiterDeg).toBeCloseTo(0, 5)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('razpored — stebri', () => {
  it('največji razmik nikoli ni presežen in vogali dobijo steber', () => {
    const spec = defaultRailingSpec({ system: 'POST_BARS', postSpacingMaxMm: 1100 })
    const layout = layoutRailing(closed(), spec)
    // 4 vogali + (3 + 1 + 3 + 1) notranjih delilnih stebrov
    expect(layout.posts).toHaveLength(12)
    for (const p of layout.posts) {
      expect(p.spacingFromPreviousMm, `${p.label} → ${p.spacingFromPreviousMm} mm`).toBeLessThanOrEqual(1100.5)
    }
    expect(layout.posts.filter((p) => p.isCorner)).toHaveLength(4)
    const labels = layout.posts.map((p) => p.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels[0]).toBe('S1')
    expect(labels[labels.length - 1]).toBe('S12')
  })

  it('vsak rob se deli enakomerno — v vogalu ne ostane ostanek', () => {
    const spec = defaultRailingSpec({ system: 'POST_BARS', postSpacingMaxMm: 1100 })
    const layout = layoutRailing(closed(), spec)
    expect(layout.edges[0].spanCount).toBe(4) // ceil(4000/1100)
    expect(layout.edges[0].spanSpacingMm).toBeCloseTo(1000, 1) // ne 1100+1100+1100+700
    expect(layout.edges[1].spanCount).toBe(2)
    expect(layout.edges[1].spanSpacingMm).toBeCloseTo(750, 1)
  })

  it('lastnost: razpon nikoli ne preseže maksimuma za poljubno dolžino', () => {
    for (let L = 0.4; L <= 12; L += 0.137) {
      for (const S of [800, 1100, 1500]) {
        const spec = defaultRailingSpec({ system: 'POST_BARS', postSpacingMaxMm: S })
        const layout = layoutRailing(openPath([v3(0, 0, 0), v3(L, 0, 0)]), spec)
        const edge = layout.edges[0]
        expect(edge.spanSpacingMm, `L=${L} S=${S}`).toBeLessThanOrEqual(S + 0.5)
      }
    }
  })

  it('steklo med stebri odšteje širino stebra in tesnilo', () => {
    const spec = defaultRailingSpec({
      system: 'GLASS_POSTS',
      postSpacingMaxMm: 1100,
      baseProfile: { enabled: false, widthMm: 80, heightMm: 150, embedMm: 40, drainageSpacingMm: 300 },
    })
    const layout = layoutRailing(closed(), spec)
    // razpon 1000 − steber 50 − 2 × 6 tesnilo = 938 mm svetle širine
    expect(layout.panels.find((p) => p.edgeIndex === 0)!.widthMm).toBeCloseTo(938, 1)
    expect(layout.posts).toHaveLength(12)
    expect(layout.panels).toHaveLength(12)
  })

  it('palice so enakomerno razporejene, preširok razmik javi opozorilo', () => {
    const spec = defaultRailingSpec({ system: 'POST_BARS', bars: { count: 4, diameterMm: 12, shape: 'ROUND' } })
    const layout = layoutRailing(closed(), spec)
    expect(layout.bars).toHaveLength(16) // 4 palice × 4 robovi
    const total = layout.bars.reduce((s, b) => s + b.lengthMm, 0)
    expect(total).toBeCloseTo(44_000, 0)
    expect(layout.warnings.some((w) => w.code === 'BAR_GAP' && w.severity === 'WARN')).toBe(true)
    // (970 − 10 − 4 × 12) / 5 = 182,4 mm
    expect(barGapMm(spec, infillTopMm(spec) - infillBottomMm(spec))).toBeCloseTo(182.4, 1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('kakovost izmere', () => {
  it('mera s trakom vodi izdelavo, AR vrednost pa ostane vidna', () => {
    const layout = layoutRailing(closed(RECT, { 0: 4050 }), defaultRailingSpec())
    const edgeA = layout.edges[0]
    expect(edgeA.isOverridden).toBe(true)
    expect(edgeA.arLengthMm).toBeCloseTo(4000, 0)
    expect(edgeA.fabricationLengthMm).toBeCloseTo(4050, 0)
    expect(totalRunMm(layout)).toBeCloseTo(11_050, 0)
    expect(edgeA.source).toBe('TAPE')
    expect(layout.warnings.some((w) => w.code === 'EDGE_OVERRIDDEN')).toBe(true)
    // Litev sledi popravljeni meri, ne AR meri.
    expect(layout.handrails[0].lengthMm).toBeCloseTo(4050, 0)
  })

  it('rob, ki ni v vodi, je označen z naklonom, dolžina ostane tlorisna', () => {
    const layout = layoutRailing(openPath([v3(0, 0, 0), v3(4, 0.2, 0)]), defaultRailingSpec())
    const warn = layout.warnings.find((w) => w.code === 'EDGE_NOT_LEVEL')!
    expect(warn.severity).toBe('WARN')
    expect(layout.edges[0].slopeDeg).toBeCloseTo(2.86, 2)
    expect(layout.edges[0].fabricationLengthMm).toBeCloseTo(4000, 0) // ne 4005
  })

  it('prekratek rob je napaka, ne tihi panel', () => {
    const layout = layoutRailing(openPath([v3(0, 0, 0), v3(0.05, 0, 0)]), defaultRailingSpec())
    const err = layout.warnings.find((w) => w.code === 'EDGE_TOO_SHORT')!
    expect(err.severity).toBe('ERROR')
    expect(err.edgeIndex).toBe(0)
  })

  it('pretanko steklo za širino panela javi opozorilo s sklicem na statika', () => {
    const spec = defaultRailingSpec({
      glass: { type: 'ESG_VSG', thicknessMm: 8, maxPanelWidthMm: 4000, sideGapMm: 6, bottomGapMm: 10 },
    })
    const layout = layoutRailing(closed(), spec)
    const warn = layout.warnings.find((w) => w.code === 'GLASS_TOO_WIDE')!
    expect(warn.severity).toBe('WARN')
    expect(warn.message).toContain('statik')
  })

  it('mono ESG v brezokvirni ograji ni sprejemljiv, ESG/VSG pa je', () => {
    const bad = layoutRailing(closed(), defaultRailingSpec({ glass: { ...defaultRailingSpec().glass, type: 'ESG' } }))
    expect(bad.warnings.some((w) => w.code === 'GLASS_NOT_LAMINATED')).toBe(true)
    const good = layoutRailing(closed(), defaultRailingSpec())
    expect(good.warnings.some((w) => w.code === 'GLASS_NOT_LAMINATED')).toBe(false)
  })

  it('premalo prostora za steklo je napaka', () => {
    // 200 mm skupaj, 150 mm profil in 30 mm letev pusti 60 mm stekla.
    const layout = layoutRailing(closed(), defaultRailingSpec({ heightMm: 200 }))
    const err = layout.warnings.find((w) => w.code === 'GLASS_HEIGHT')!
    expect(err.severity).toBe('ERROR')
  })

  it('manj kot dve točki vrne prazen razpored z navodilom', () => {
    const layout = layoutRailing(perimeterOf([v3(0, 0, 0)]), defaultRailingSpec())
    expect(layout.edges).toHaveLength(0)
    expect(layout.posts).toHaveLength(0)
    expect(totalRunMm(layout)).toBe(0)
    expect(layout.warnings.some((w) => w.code === 'NEED_POINTS')).toBe(true)
  })

  it('oznake robov delujejo tudi čez Z', () => {
    expect(edgeLabel(0)).toBe('A')
    expect(edgeLabel(25)).toBe('Z')
    expect(edgeLabel(26)).toBe('AA')
    expect(edgeLabel(27)).toBe('AB')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('rezalni seznam in količine', () => {
  const spec = defaultRailingSpec()
  const layout = layoutRailing(closed(), spec)
  const rows = cutList(layout)

  it('steklo je združeno po točni meri in se na terenu ne reže', () => {
    const glass = rows.filter((r) => r.part === 'Steklo')
    expect(glass).toHaveLength(2)
    expect(glass.map((g) => g.qty).sort()).toEqual([4, 6])
    expect(glass[0].dimension).toMatch(/^\d+ × \d+ mm$/)
    glass.forEach((g) => expect(g.cutStart).toBe('—'))
  })

  it('letev in profili so po kosih s koti žage', () => {
    expect(rows.filter((r) => r.part === 'Pokrovna letev')).toHaveLength(4)
    expect(rows.filter((r) => r.part === 'U-profil')).toHaveLength(4)
    rows.filter((r) => r.part === 'Pokrovna letev').forEach((r) => {
      expect(r.cutStart).toContain('45')
      expect(r.cutEnd).toContain('45')
      expect(r.cutStart).toContain('notranji kot 90°')
    })
  })

  it('cutText pove stran žage in notranji kot', () => {
    expect(cutText(0, 180)).toBe('pravokotno (0°)')
    expect(cutText(45, 90)).toContain('desno')
    expect(cutText(-45, 90)).toContain('levo')
    expect(cutText(22.5, 135)).toContain('22,5')
  })

  it('sidra: na 300 mm po U-profilu plus po stebrih', () => {
    expect(anchorCount(layout, spec)).toBe(37) // ceil(11000/300) = 37, brez stebrov
    const postSpec: RailingSpec = defaultRailingSpec({ system: 'POST_BARS', postFixing: 'SIDE_BRACKET' })
    const postLayout = layoutRailing(closed(), postSpec)
    expect(anchorCount(postLayout, postSpec)).toBe(24) // 12 stebrov × 2 sidra, brez profila
  })

  it('povzetek za glavo ponudbe', () => {
    const s = summarise(layout, spec)
    expect(s.totalRunMm).toBeCloseTo(11_000, 0)
    expect(s.postCount).toBe(0)
    expect(s.panelCount).toBe(10)
    expect(s.cornerCount).toBe(4)
    expect(s.freeEndCount).toBe(0)
    expect(s.anchorCount).toBe(37)
    expect(s.glassAreaM2).toBeGreaterThan(9)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('lokalni koordinatni okvir — izmera preživi konec seje', () => {
  it('normalizira obseg: prva točka v izhodišču, prvi rob vzdolž +X', () => {
    const world = [v3(1, 0.5, 2), v3(1, 0.5, -1), v3(-2, 0.5, -1), v3(-2, 0.5, 2)]
    const { points, frame } = frameFromWorld(world)
    expect(frame.yawDeg).toBeCloseTo(90, 4)
    expect(points[0].x).toBeCloseTo(0, 5)
    expect(points[0].z).toBeCloseTo(0, 5)
    expect(points[1].x).toBeCloseTo(3, 5)
    expect(points[2].x).toBeCloseTo(3, 5)
    expect(points[2].z).toBeCloseTo(-3, 5)
  })

  it('pretvorba tja in nazaj je identiteta', () => {
    const { points, frame } = frameFromWorld(RECT)
    const back = points.map((p) => toWorld(p, frame))
    RECT.forEach((p, i) => {
      expect(back[i].x).toBeCloseTo(p.x, 4)
      expect(back[i].y).toBeCloseTo(p.y, 4)
      expect(back[i].z).toBeCloseTo(p.z, 4)
    })
  })

  it('dva dotika določita lego in smer za ponovno postavitev', () => {
    const frame = frameFromTwoPoints(v3(2, 1, -3), v3(2, 1, -6))
    expect(frame.yawDeg).toBeCloseTo(90, 4)
    const placed = toWorld(v3(3, 0, 0), frame)
    expect(placed.x).toBeCloseTo(2, 4)
    expect(placed.z).toBeCloseTo(-6, 4)
    expect(placed.y).toBeCloseTo(1, 4)
  })

  it('degeneriran drugi dotik ne vrne NaN', () => {
    const frame = frameFromTwoPoints(v3(1, 0, 1), v3(1, 0, 1))
    expect(frame.yawDeg).toBeCloseTo(0, 5)
    expect(frameFromWorld([v3(1, 0, 1)]).frame.yawDeg).toBeCloseTo(0, 5)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('oblikovanje — slovensko, neodvisno od locale-a naprave', () => {
  it('decimalna vejica in pika za tisočice', () => {
    expect(fmtNumber(1234.56, 2)).toBe('1.234,56')
    expect(fmtNumber(1234.56, 1)).toBe('1.234,6')
    expect(fmtNumber(0.5, 1)).toBe('0,5')
    expect(fmtNumber(-5.5, 1)).toBe('\u22125,5')
    expect(fmtMm(1180)).toBe('1.180 mm')
    expect(fmtMm(16.76)).toBe('17 mm')
  })

  it('ni odvisen od privzetega locale-a', () => {
    const prev = Intl.DateTimeFormat().resolvedOptions().locale
    expect(fmtNumber(1234.5, 2)).toBe('1.234,50')
    expect(prev).toBeTruthy()
  })

  it('NaN in Infinity se izpišeta kot 0, ne kot NaN', () => {
    expect(fmtNumber(NaN, 1)).toBe('0,0')
    expect(fmtNumber(Infinity, 1)).toBe('0,0')
  })
})
