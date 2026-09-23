import sharp from 'sharp'
import { cutoutProduct } from '/home/z/my-project/src/lib/viz/pipeline'
import { warpFloat } from '/home/z/my-project/src/lib/viz/homography'
import { solveHomography } from '/home/z/my-project/src/lib/viz/homography'
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
const cut = cutoutProduct(product, pq)

const rw = 700, rh = 300
const dst: Corners = [[0,0],[rw,0],[rw,rh],[0,rh]]
const H = solveHomography(pq, dst)
const rect = warpFloat(cut.alpha, product.w, product.h, H, rw, rh)
const cx0 = Math.floor(rw*0.35), cx1 = Math.ceil(rw*0.65)
const stripW = cx1-cx0
// profile at 3 pixel thresholds
for (const th of [0.5, 0.75]) {
  const cover: number[] = []
  for (let y = 0; y < rh; y++) {
    let s = 0
    for (let x = cx0; x < cx1; x++) s += rect[y*rw+x] > th ? 1 : 0
    cover.push(s/stripW)
  }
  // compress to runs
  const runs: string[] = []
  let state = cover[0] > 0.5 ? 'on' : 'off'
  let start = 0
  for (let y = 1; y <= rh; y++) {
    const s = y < rh ? (cover[y] > 0.5 ? 'on' : 'off') : 'end'
    if (s !== state) {
      runs.push(`${state==='on'?'ON':'off'} ${start}-${y-1} (${y-start}) min=${Math.min(...cover.slice(start,y)).toFixed(2)} max=${Math.max(...cover.slice(start,y)).toFixed(2)}`)
      state = s; start = y
    }
  }
  console.log(`\n=== pixel threshold ${th}: ${runs.filter(r=>r.startsWith('ON')).length} ON runs ===`)
  for (const r of runs) console.log(' ', r)
}
