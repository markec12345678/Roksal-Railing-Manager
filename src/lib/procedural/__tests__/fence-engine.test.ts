/**
 * S+7 testi — PROCEDURAL FENCE ENGINE (spec §7, §8, §10).
 * Dokazujejo: determinizem (isti vhod = isti izhod), čisto aritmetiko
 * števila desk/razmakov/rezov, orientacije, ročaj, stebre, vijake,
 * kataloško integracijo in ločitev geometrije od materiala.
 */
import { describe, it, expect } from 'vitest'
import { computeFenceLayout, renderFence, type FenceRequest } from '../fence-engine'
import { getProduct } from '../../product-catalog'

function colorReq(over: Partial<FenceRequest> = {}): FenceRequest {
  return {
    productId: 'woodcore-polna-128',
    orientation: 'horizontal',
    fenceWidthMm: 1100,
    fenceHeightMm: 1000,
    gapMm: 8,
    material: { kind: 'color', rgb: [110, 82, 60] },
    outWidthPx: 640,
    outHeightPx: 512,
    ...over,
  }
}

function texBuf(w: number, h: number): ImageBuffer {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      data[i] = Math.round((y / h) * 255)
      data[i + 1] = Math.round((x / w) * 255)
      data[i + 2] = 100
      data[i + 3] = 255
    }
  }
  return { data, w, h }
}

describe('computeFenceLayout — deterministična geometrija (spec §7)', () => {
  it('število desk = čista aritmetika: ceil(višina / (širina + razmak))', () => {
    // POLNA 128: pitch = 128 + 8 = 136; 1000/136 = 7,35 → 8 desk
    const lay = computeFenceLayout(colorReq())
    expect(lay.faceWidthMm).toBe(128)
    expect(lay.pitchMm).toBe(136)
    expect(lay.boardCount).toBe(8)
  })

  it('zadnja deska je odrezana (katalog: "se lahko reže na poljubne dolžine")', () => {
    const lay = computeFenceLayout(colorReq())
    const last = lay.boards[lay.boardCount - 1]
    expect(last.cut).toBe(true)
    expect(last.visibleMm).toBeCloseTo(1000 - 7 * 136, 6) // 48 mm
    expect(last.visibleMm).toBeLessThan(lay.faceWidthMm)
    // Vse ostale polne
    expect(lay.boards.slice(0, -1).every((b) => !b.cut)).toBe(true)
    // Ni prekoračitve višine
    expect(lay.boards[lay.boardCount - 1].startMm + last.visibleMm).toBeCloseTo(1000, 6)
  })

  it('točno deljiva višina → ni reza', () => {
    const lay = computeFenceLayout(colorReq({ fenceHeightMm: 272 })) // 2×136
    expect(lay.boardCount).toBe(2)
    expect(lay.boards.every((b) => !b.cut)).toBe(true)
  })

  it('pokončna orientacija: deske tečejo po širini (POLNA 100, pitch 108)', () => {
    const req = colorReq({
      productId: 'woodcore-polna-100',
      orientation: 'vertical',
      fenceWidthMm: 1000,
      fenceHeightMm: 800,
      gapMm: 8,
    })
    const lay = computeFenceLayout(req)
    expect(lay.faceWidthMm).toBe(100)
    expect(lay.pitchMm).toBe(108)
    expect(lay.boardCount).toBe(Math.ceil(1000 / 108)) // 10
    expect(lay.boards[0].startMm).toBe(0)
    expect(lay.boards[1].startMm).toBe(108)
  })

  it('ROMB 67 horizontal: pitch 75 (67+8), kataloška širina 67', () => {
    const lay = computeFenceLayout(colorReq({ productId: 'woodcore-romb-67' }))
    expect(lay.faceWidthMm).toBe(67)
    expect(lay.pitchMm).toBe(75)
  })

  it('isti vhod → enak razpored (determinizem geometrije)', () => {
    const a = computeFenceLayout(colorReq())
    const b = computeFenceLayout(colorReq())
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('razmak izven priporočila proizvajalca → opozorilo (ne tih popravek)', () => {
    const lay = computeFenceLayout(colorReq({ gapMm: 50 }))
    expect(lay.warnings.some((w) => w.includes('izven priporočila'))).toBe(true)
  })

  it('neznan productId → jasna napaka', () => {
    expect(() => computeFenceLayout(colorReq({ productId: 'ne-obstaja' }))).toThrow(/neznan productId/)
  })
})

describe('renderFence — deterministična rasterizacija (spec §7)', () => {
  it('isti vhod → bajtno identičen RGBA izhod (KLJUČNI determinizem)', () => {
    const a = renderFence(colorReq())
    const b = renderFence(colorReq())
    expect(a.w).toBe(b.w)
    expect(a.h).toBe(b.h)
    let same = true
    for (let i = 0; i < a.data.length; i++) {
      if (a.data[i] !== b.data[i]) {
        same = false
        break
      }
    }
    expect(same).toBe(true)
  })

  it('razmaki so beli (ozadje), ploskvice so obarvane — pregled nad vzorcem', () => {
    const req = colorReq({ outWidthPx: 320, outHeightPx: 320 })
    const img = renderFence(req)
    const px = (x: number, y: number): number[] => {
      const i = (y * img.w + x) * 4
      return [img.data[i], img.data[i + 1], img.data[i + 2]]
    }
    // Sredina prve ploskvice (spodaj, deska 0: y 320..(320-128*px)) — vzorči sredino
    const boardPx = px(160, Math.round(320 * (1 - 64 / 1000)))
    const isBoardish = boardPx[0] < 220 && boardPx[2] < 220
    expect(isBoardish).toBe(true)
    // Sredina vrzeli: y = 1000-136-64 = 800 mm od vrha → preveri nekaj pikslov okoli vrzeli
    // pitch 136mm: meja med desko 0 (0..128) in vrzel (128..136) na y=1000-128=872mm
    const gapY = Math.round(320 * (872 / 1000))
    const gapPx = px(160, Math.max(0, Math.min(319, gapY - 2)))
    expect(gapPx[0]).toBe(255)
    expect(gapPx[1]).toBe(255)
    expect(gapPx[2]).toBe(255)
  })

  it('pokončna ograja: bele vrstice so vertikalne (razmaki po x)', () => {
    const req = colorReq({
      productId: 'woodcore-polna-100',
      orientation: 'vertical',
      fenceWidthMm: 1000,
      outWidthPx: 500,
      outHeightPx: 300,
    })
    const img = renderFence(req)
    // pitch 108 mm na 500 px: deska 0 = 0..500*100/108=0..463px... vzorči vrzel pri 505..540 mm
    const gapX = Math.round(500 * (104 / 1000)) // sredina vrzeli 100..108
    let allWhite = true
    for (let y = 1; y < 299; y++) {
      const i = (y * img.w + Math.min(img.w - 1, gapX)) * 4
      if (img.data[i] !== 255 || img.data[i + 1] !== 255 || img.data[i + 2] !== 255) {
        allWhite = false
        break
      }
    }
    expect(allWhite).toBe(true)
  })

  it('material color vs texture: ista geometrija, drugačen material', () => {
    const c = renderFence(colorReq())
    const t = renderFence(colorReq({ material: { kind: 'texture', texture: texBuf(64, 64), mode: 'scan' } }))
    // Geometrija enaka: vrzeli beli v obeh
    const gapY = Math.round(512 * (872 / 1000))
    const gi = ((gapY - 2) * 640 + 320) * 4
    expect(t.data[gi]).toBe(255)
    // Material različen: sredina ploskvice ni enaka
    const bi = (Math.round(512 * (1 - 64 / 1000)) * 640 + 320) * 4
    expect(c.data[bi]).not.toBe(t.data[bi])
  })

  it('texture scan: zaporedne deske vzorčijo različne pasove (deterministično)', () => {
    const img = renderFence(
      colorReq({
        material: { kind: 'texture', texture: texBuf(64, 256), mode: 'scan' },
        outWidthPx: 320,
        outHeightPx: 320,
      })
    )
    // Deska 0 sredina vs deska 1 sredina — različen vzorec (tekstura = vertikalni gradient)
    const y0 = Math.round(320 * (1 - 64 / 1000))
    const y1 = Math.round(320 * (1 - (136 + 64) / 1000))
    const i0 = (y0 * 320 + 160) * 4
    const i1 = (y1 * 320 + 160) * 4
    expect(img.data[i0]).not.toBe(img.data[i1])
  })

  it('ROMB profil: rebro na sredini ploskvice je temnejše od roba (deterministično sencenje)', () => {
    const lay = computeFenceLayout(colorReq({ productId: 'woodcore-romb-67', outHeightPx: 1000 }))
    const img = renderFence(colorReq({ productId: 'woodcore-romb-67', outHeightPx: 1000 }), lay)
    // Deska 0: 0..67 mm od spodaj → sredina 33,5 mm → y=1000-33,5≈966; rob (5 mm od spodaj) y≈995
    const center = (966 * img.w + 320) * 4
    const edge = (995 * img.w + 320) * 4
    const c = img.data[center] + img.data[center + 1] + img.data[center + 2]
    const e = img.data[edge] + img.data[edge + 1] + img.data[edge + 2]
    expect(c).toBeLessThan(e)
  })

  it('ročaj (POLNA 128): zaseda 92 mm zgoraj, vijaki vsak 500 mm (katalog)', () => {
    const req = colorReq({ handle: true, outHeightPx: 512 })
    const lay = computeFenceLayout(req)
    expect(lay.handlePresent).toBe(true)
    expect(lay.handleHeightMm).toBe(92)
    expect(lay.fieldHeightMm).toBe(1000 - 92)
    const img = renderFence(req, lay)
    // Ročaj vrstica (y=10px ≈ 19,5mm od vrha) ima material; vijak na 250 mm od leve
    const screwX = Math.round(640 * (250 / 1100))
    const iScrew = (Math.round(512 * (46 / 1000)) * 640 + screwX) * 4
    const iPlain = (Math.round(512 * (46 / 1000)) * 640 + 10) * 4
    expect(img.data[iScrew]).toBeLessThan(img.data[iPlain])
  })

  it('ročaj pri ROMB ni na voljo → handlePresent=false (katalog pravilo)', () => {
    const lay = computeFenceLayout(colorReq({ productId: 'woodcore-romb-67', handle: true }))
    expect(lay.handlePresent).toBe(false)
  })

  it('stebri: temen alu stolpec VIDEN v razmaku, pokrit za ploskvico (fizični vrstni red)', () => {
    const req = colorReq({ posts: { widthMm: 60, positionsMm: [550] }, outWidthPx: 640, outHeightPx: 320 })
    const lay = computeFenceLayout(req)
    const img = renderFence(req, lay)
    // Vrzel med desko 0 (0..128 mm) in desko 1 (136..): sredina = 132 mm od spodaj
    const gapY = Math.round(((1000 - 132) / 1000) * 320)
    const cx = Math.round(640 * (550 / 1100))
    const iPost = (gapY * 640 + cx) * 4
    const iBoard = (300 * 640 + 100) * 4 // sredina deske 0, stran od stebra
    // Steber temen (alu ~48–58), ploskvica toplo rjava
    expect(img.data[iPost]).toBeLessThan(90)
    expect(img.data[iBoard]).toBeGreaterThan(90)
  })

  it('vidni vijaki samo pri profilih s screwsVisible=true (katalog — spec §10)', () => {
    // POLNA 128 (vijaki vidni): z stebri se na ploskvici prikaže temen disk vijaka
    const posts = { widthMm: 50, positionsMm: [550] }
    const withScrews = renderFence(colorReq({ posts, outHeightPx: 320 }))
    const withoutScrews = renderFence(colorReq({ outHeightPx: 320 }))
    const rowY = 300 // sredina deske 0 (64 mm od spodaj)
    const sx = Math.round(640 * (550 / 1100))
    const iScrew = (rowY * 640 + sx) * 4
    expect(withScrews.data[iScrew]).toBeLessThan(withoutScrews.data[iScrew])
    // ROMB (vijaki skriti): vrstica sredine deske je PIKSLIČNO enaka z/v stebri
    // (steber je za ploskvico, vijaka ni)
    const rombWith = renderFence(colorReq({ productId: 'woodcore-romb-67', posts, outHeightPx: 320 }))
    const rombWithout = renderFence(colorReq({ productId: 'woodcore-romb-67', outHeightPx: 320 }))
    let identical = true
    for (let x = 0; x < 640; x++) {
      const i = (rowY * 640 + x) * 4
      if (
        rombWith.data[i] !== rombWithout.data[i] ||
        rombWith.data[i + 1] !== rombWithout.data[i + 1] ||
        rombWith.data[i + 2] !== rombWithout.data[i + 2]
      ) {
        identical = false
        break
      }
    }
    expect(identical).toBe(true)
  })
})

describe('procedural + katalog integracija (spec §8 — geometrija NI AI)', () => {
  it('samo ~10 desk pokončne POLNE 100 pri višini 1000 mm + razmak 8', () => {
    const lay = computeFenceLayout(
      colorReq({ productId: 'woodcore-polna-100', orientation: 'vertical', fenceWidthMm: 1000, fenceHeightMm: 1000 })
    )
    expect(lay.boardCount).toBe(10) // pitch 108 → 9.26 → 10
  })

  it('kataloški profil pride iz JSON-a (ni duplikata v kodi)', () => {
    const p = getProduct('woodcore-deska-150')!
    const lay = computeFenceLayout(colorReq({ productId: 'woodcore-deska-150' }))
    expect(lay.faceWidthMm).toBe(p.faceWidthMm)
    expect(lay.profile).toBe('DESKA-150 (terasna)')
  })
})
