import sharp from 'sharp'
import { runPipeline, cutoutProduct } from '/home/z/my-project/src/lib/viz/pipeline'
import { warpFloat, solveHomography } from '/home/z/my-project/src/lib/viz/homography'
import type { Corners, ImageBuffer } from '/home/z/my-project/src/lib/viz/types'
import { cornerToPx } from '/home/z/my-project/src/lib/viz/types'

async function toRaw(buf: Buffer): Promise<ImageBuffer> {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  const w = info.width, h = info.height
  const out = new Uint8ClampedArray(w * h * 4)
  if (info.channels === 4) out.set(data.subarray(0, w * h * 4))
  else if (info.channels === 3) {
    for (let i = 0, j = 0; i < w * h; i++, j += 3) { out[i*4]=data[j]; out[i*4+1]=data[j+1]; out[i*4+2]=data[j+2]; out[i*4+3]=255 }
  } else { for (let i = 0; i < w * h; i++) { const g = data[i]; out[i*4]=g; out[i*4+1]=g; out[i*4+2]=g; out[i*4+3]=255 } }
  return { data: out, w, h }
}

const PRODUCT_QUAD: Corners = [[0,80/660],[1,18/660],[1,638/660],[0,600/660]]
const product = await toRaw(await sharp('tmp/scenarios/product_bay.jpg').jpeg().toBuffer())
const pq = cornerToPx(PRODUCT_QUAD, product.w, product.h)

const original = await toRaw(await sharp('/home/z/baseline/input/balcony_2.jpg').jpeg({quality:95}).toBuffer())
const maskRaw = await toRaw(await sharp('/home/z/baseline/mask/mask_b2_middle.png').toBuffer())
const maskBin = new Uint8Array(maskRaw.w * maskRaw.h)
for (let i = 0; i < maskBin.length; i++) maskBin[i] = maskRaw.data[i*4] > 127 ? 1 : 0
const mask: ImageBuffer = { data: (() => { const o = new Uint8ClampedArray(maskBin.length*4); for (let i=0;i<maskBin.length;i++){const v=maskBin[i]?255:0; o[i*4]=v;o[i*4+1]=v;o[i*4+2]=v;o[i*4+3]=255} return o })(), w: maskRaw.w, h: maskRaw.h }

const corners: Corners = [[0.347,0.588],[0.612,0.58],[0.614,0.748],[0.349,0.756]]
const cornersPx = cornerToPx(corners, original.w, original.h)
const res = runPipeline({ original, mask, product, productMask: null, cornersPx, productQuadPx: pq })

// dump warpA profile — replicate pipeline internals: warpA = warped alpha on scene
// pipeline metrics already computed; recompute warp here identically:
import { fillPolygon } from '/home/z/my-project/src/lib/viz/imageops'
const W = original.w, H = original.h
// From pipeline: warpA is product alpha warped into scene with H mapping pq -> cornersPx
const Hp = solveHomography(pq, cornersPx)
const n = W * H
const alphaScene = new Float32Array(n)
// warp product cut alpha: use inverse mapping via warpFloat with Hp? warpFloat(src, w, h, H, outW, outH)
const warpA = warpFloat(cutoutProduct(product, pq).alpha, product.w, product.h, Hp, W, H)
const rw = 700, rh = 300
const dst: Corners = [[0,0],[rw,0],[rw,rh],[0,rh]]
const H2 = solveHomography(cornersPx, dst)
const rect = warpFloat(warpA, W, H, H2, rw, rh)
const cx0 = Math.floor(rw*0.35), cx1 = Math.ceil(rw*0.65)
const stripW = cx1-cx0
const cover: number[] = []
for (let y = 0; y < rh; y++) {
  let s = 0
  for (let x = cx0; x < cx1; x++) s += rect[y*rw+x] > 0.5 ? 1 : 0
  cover.push(s/stripW)
}
const runs: string[] = []
let state = cover[0] > 0.5 ? 'ON' : 'off'
let start = 0
for (let y = 1; y <= rh; y++) {
  const s = y < rh ? (cover[y] > 0.5 ? 'ON' : 'off') : 'end'
  if (s !== state) { runs.push(`${state} ${start}-${y-1} (${y-start}) min=${Math.min(...cover.slice(start,y)).toFixed(2)} max=${Math.max(...cover.slice(start,y)).toFixed(2)}`); state = s; start = y }
}
console.log(`${runs.filter(r=>r.startsWith('ON')).length} ON runs (pipeline said letviceResult=${res.metrics.letviceResult})`)
for (const r of runs) console.log(' ', r)
