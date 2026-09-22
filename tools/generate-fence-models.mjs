#!/usr/bin/env node
/**
 * Generator 3D modelov ograje — Roksal Railing Manager (runda O)
 * -----------------------------------------------------------------------------
 * Izdela parametrične modele balkonske ograje v DVEH formatih × 5 RAL barv:
 *   • public/models/ograjca-klasika-{RAL}.glb (+ .usdz) — palice (balusters)
 *   • public/models/ograjca-steklo-{RAL}.glb  (+ .usdz) — stekleni panel
 *   • public/models/ograjca-{klasika,steklo}.glb (+ .usdz) — alias RAL 7016
 *     (zgodovinske poti ostanejo veljavne za stare povezave/QR)
 *
 * Zakaj brez three.js/GLTFExporter?
 *   Sandbox ima 4 GB RAM + OOM ograjevanje (glej worklog runda M) — lažja
 *   odvisnost = hitrejši build. GLB zapisovalnik je ~120 vrstic (boxi + 2
 *   materiala), USDZ pa USDA tekst + stored-ZIP s 64-bajtno poravnavo
 *   (Apple Quick Look zahteva: uncompressed, aligned, first file = usda).
 *
 * Format spec:
 *   GLB  → glTF 2.0 binary: magic 0x46546C67, JSON chunk (pad ' '), BIN chunk
 *          (pad 0x00), CCW prednje face, +Y gor, enote METRI.
 *   USDZ → #usda 1.0 (Y up, meter) + UsdGeomMesh prims + UsdPreviewSurface;
 *          ZIP method 0 (stored), CRC32, extra-field padding na 64 B.
 *
 * Runda P: RAL palete — prave RAL klasik barve (kovinska prahobarva):
 *   • kovina (stebra + letvi) in palice dobijo izbrano RAL barvo
 *   • metallic/roughness skala po svetlosti (temna = bolj kovinska,
 *     svetla prahobarva = matira aluminij)
 *   • steklo ostane prosojno (panel 8 mm, BLEND, double-sided)
 *   • barve so pretvorjene sRGB → LINEAR (glTF baseColorFactor je linearen;
 *     prej so bile vrednosti zapisane kot suhe sRGB — 7016 je bil zato nekoliko
 *     pretemen v PBR renderju)
 *
 * Zagon: node tools/generate-fence-models.mjs  (idempotentno, ~50 ms)
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'models')
mkdirSync(OUT, { recursive: true })

// ── Geometrija: box z 24 verteksi (4/face) in pravilnim CCW windingom ────────

/** Vrne {positions, normals, indices} za box s centrom c in dimenzijami s. */
function boxMesh(cx, cy, cz, sx, sy, sz) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2
  const x0 = cx - hx, x1 = cx + hx
  const y0 = cy - hy, y1 = cy + hy
  const z0 = cz - hz, z1 = cz + hz
  // 6 faces: [+Z, -Z, +X, -X, +Y, -Y] — vsaka 4 verteksi, indeksi (0,1,2)(2,1,3)
  const faces = [
    { n: [0, 0, 1], v: [[x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1]] },
    { n: [0, 0, -1], v: [[x1, y0, z0], [x0, y0, z0], [x1, y1, z0], [x0, y1, z0]] },
    { n: [1, 0, 0], v: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z1], [x1, y1, z0]] },
    { n: [-1, 0, 0], v: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z0], [x0, y1, z1]] },
    { n: [0, 1, 0], v: [[x0, y1, z1], [x1, y1, z1], [x0, y1, z0], [x1, y1, z0]] },
    { n: [0, -1, 0], v: [[x0, y0, z0], [x1, y0, z0], [x0, y0, z1], [x1, y0, z1]] },
  ]
  const positions = []
  const normals = []
  const indices = []
  faces.forEach((f, fi) => {
    for (const v of f.v) positions.push(v[0], v[1], v[2])
    for (const c of f.n) normals.push(c)
    const b = fi * 4
    indices.push(b, b + 1, b + 2, b + 2, b + 1, b + 3)
  })
  return { positions, normals, indices }
}

// ── Parametri ograje (metri, +Y gor, segment širine 2.0 m) ───────────────────

const W = 2.0          // širina segmenta
const H = 1.1          // višina (standard balkonske ograje)
const POST = 0.06      // profil stebra 60×60 mm
const RAIL_H = 0.04    // višina letve

/** Postavljeni boxi za klasično ograjo (palice) — material 'kovina'|'palice'. */
function klasikaBoxes() {
  const boxes = []
  const add = (m, box) => boxes.push({ mat: m, box })
  // Stebra (robova)
  add('kovina', boxMesh(-(W - POST) / 2, H / 2, 0, POST, H, POST))
  add('kovina', boxMesh((W - POST) / 2, H / 2, 0, POST, H, POST))
  // Letvi (zgoraj + spodaj), med stebroma
  const railW = W - POST
  add('kovina', boxMesh(0, H - RAIL_H / 2, 0, railW, RAIL_H, POST * 1.2))
  add('kovina', boxMesh(0, RAIL_H / 2, 0, railW, RAIL_H, POST * 1.2))
  // 17 navpičnih palic 25×25 mm (razmak ~108 mm)
  const n = 17
  const step = railW / (n + 1)
  for (let i = 1; i <= n; i++) {
    const x = -railW / 2 + step * i
    add('palice', boxMesh(x, (H + RAIL_H) / 2 - 0.01, 0, 0.025, H - RAIL_H * 2 + 0.02, 0.025))
  }
  return boxes
}

/** Postavljeni boxi za stekleno ograjo — material 'kovina'|'steklo'. */
function stekloBoxes() {
  const boxes = []
  const add = (m, box) => boxes.push({ mat: m, box })
  add('kovina', boxMesh(-(W - POST) / 2, H / 2, 0, POST, H, POST))
  add('kovina', boxMesh((W - POST) / 2, H / 2, 0, POST, H, POST))
  const railW = W - POST
  add('kovina', boxMesh(0, H - RAIL_H / 2, 0, railW, RAIL_H, POST * 1.2))
  add('kovina', boxMesh(0, 0.05, 0, railW, 0.06, POST * 1.4))
  // Steklo 8 mm, med letvama
  add('steklo', boxMesh(0, (H - RAIL_H + 0.08) / 2, 0, railW - 0.02, H - RAIL_H - 0.08 - 0.05, 0.008))
  return boxes
}

// ── Materiali — RAL klasik paleta (kovinska prahobarva) ──────────────────────

/** RAL klasik paleta — prave RAL barve s PBR zaključkom prahobarve. */
const RAL_COLORS = [
  { code: '7016', name: 'antracit',  hex: '#383E42', metallic: 0.65, roughness: 0.42 },
  { code: '9005', name: 'črna',      hex: '#0A0A0C', metallic: 0.70, roughness: 0.38 },
  { code: '9016', name: 'bela',      hex: '#F1F0EA', metallic: 0.25, roughness: 0.55 },
  { code: '6005', name: 'zelena',    hex: '#114232', metallic: 0.55, roughness: 0.45 },
  { code: '8017', name: 'rjava',     hex: '#45322E', metallic: 0.55, roughness: 0.45 },
]

/** sRGB (#rrggbb) → linearni RGB triplet (glTF/USD pričakujeta linearne vrednosti). */
function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16)
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
  return srgb.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
}

/** Svetlost (luma) linearnega tripleta — za hevristiko prahobarve. */
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

/** Mešanje z belo (tint) — palice so rahlo svetlejše od profilev. */
const tintWhite = (c, t) => c.map((v) => v * (1 - t) + t)

/** Materiali za posamezno RAL barvo. */
function materialsFor(ral) {
  const base = hexToLinear(ral.hex)
  const dark = luma(base) < 0.08
  return {
    kovina: { color: base, metallic: ral.metallic, roughness: ral.roughness },
    palice: {
      color: tintWhite(base, dark ? 0.16 : 0.1),
      metallic: Math.min(0.8, ral.metallic + 0.05),
      roughness: Math.max(0.3, ral.roughness - 0.04),
    },
    steklo: { color: [0.72, 0.82, 0.83, 0.3], metallic: 0.1, roughness: 0.05, blend: true },
  }
}

// ── GLB zapisovalnik (glTF 2.0 binary, brez odvisnosti) ──────────────────────

function buildGlb(groups, MATERIALS) {
  // groups: { materialName: boxes[] } → vsak material = 1 mesh + 1 node
  const materialNames = Object.keys(groups)
  const buffers = [] // {positions, normals, indices}
  const accessors = []
  const bufferViews = []
  const meshes = []
  const nodes = []
  const binChunks = []
  let offset = 0

  const pushView = (typedArr, target) => {
    const bytes = new Uint8Array(typedArr.buffer, typedArr.byteOffset, typedArr.byteLength)
    const pad = (4 - (bytes.length % 4)) % 4
    binChunks.push(bytes)
    if (pad) binChunks.push(new Uint8Array(pad))
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target })
    offset += bytes.length + pad
    return bufferViews.length - 1
  }

  for (const mat of materialNames) {
    // Združi vse boxe materiala v en mesh (offseti indeksov se premaknejo)
    const positions = []
    const normals = []
    const indices = []
    let vBase = 0
    for (const { box } of groups[mat]) {
      for (let i = 0; i < box.positions.length; i += 3) {
        positions.push(box.positions[i], box.positions[i + 1], box.positions[i + 2])
        normals.push(box.normals[i], box.normals[i + 1], box.normals[i + 2])
      }
      for (const idx of box.indices) indices.push(idx + vBase)
      vBase += box.positions.length / 3
    }
    const posArr = new Float32Array(positions)
    const normArr = new Float32Array(normals)
    const idxArr = new Uint16Array(indices)
    const bvPos = pushView(posArr, 34962)
    const bvNorm = pushView(normArr, 34962)
    const bvIdx = pushView(idxArr, 34963)

    let min = [Infinity, Infinity, Infinity]
    let max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < posArr.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], posArr[i + a])
        max[a] = Math.max(max[a], posArr[i + a])
      }
    }
    accessors.push(
      { bufferView: bvPos, componentType: 5126, count: posArr.length / 3, type: 'VEC3', min, max },
      { bufferView: bvNorm, componentType: 5126, count: normArr.length / 3, type: 'VEC3' },
      { bufferView: bvIdx, componentType: 5123, count: idxArr.length, type: 'SCALAR' },
    )
    const meshIdx = meshes.length
    meshes.push({ primitives: [{ attributes: { POSITION: meshIdx * 3, NORMAL: meshIdx * 3 + 1 }, indices: meshIdx * 3 + 2, material: materialNames.indexOf(mat) }], name: `Mesh_${mat}` })
    nodes.push({ mesh: meshIdx, name: `Node_${mat}` })
  }

  const materials = materialNames.map((m) => {
    const def = MATERIALS[m]
    const base = def.blend ? def.color : [...def.color, 1]
    const out = {
      name: m,
      pbrMetallicRoughness: {
        baseColorFactor: base,
        metallicFactor: def.metallic,
        roughnessFactor: def.roughness,
      },
      doubleSided: !!def.blend,
    }
    if (def.blend) out.alphaMode = 'BLEND'
    return out
  })

  // Binarni buffer (pad na 4)
  const totalBin = offset
  const gltf = {
    asset: { version: '2.0', generator: 'Roksal fence generator (runda P, RAL)' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i), name: 'Ograja' }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: totalBin }],
  }
  const jsonStr = JSON.stringify(gltf)
  const jsonPad = (4 - (jsonStr.length % 4)) % 4
  const jsonChunk = new TextEncoder().encode(jsonStr + ' '.repeat(jsonPad))
  const bin = new Uint8Array(totalBin)
  let p = 0
  for (const c of binChunks) { bin.set(c, p); p += c.length }

  const headerLen = 12
  const jsonHeader = 8
  const binHeader = 8
  const total = headerLen + jsonHeader + jsonChunk.length + binHeader + bin.length
  const out = new DataView(new ArrayBuffer(total))
  out.setUint32(0, 0x46546c67, true) // magic 'glTF'
  out.setUint32(4, 2, true)          // version
  out.setUint32(8, total, true)
  out.setUint32(12, jsonChunk.length, true)
  out.setUint32(16, 0x4e4f534a, true) // 'JSON'
  new Uint8Array(out.buffer).set(jsonChunk, 20)
  const binStart = 20 + jsonChunk.length
  out.setUint32(binStart, bin.length, true)
  out.setUint32(binStart + 4, 0x004e4942, true) // 'BIN\0'
  new Uint8Array(out.buffer).set(bin, binStart + 8)
  return Buffer.from(out.buffer)
}

// ── USDA + USDZ zapisovalnik (stored ZIP s 64 B poravnavo) ───────────────────

const f3 = (x) => (Math.abs(x) < 1e-6 ? 0 : +x.toFixed(6))

function buildUsda(groups, MATERIALS) {
  const mats = Object.keys(groups)
  const body = []
  body.push(`def Xform "Root" (\n    kind = "component"\n)\n{`)
  for (const m of mats) {
    groups[m].forEach(({ box }, bi) => {
      const pos = box.positions
      const pts = []
      for (let i = 0; i < pos.length; i += 3) pts.push(`(${f3(pos[i])}, ${f3(pos[i + 1])}, ${f3(pos[i + 2])})`)
      const idxs = box.indices.join(', ')
      const counts = new Array(box.indices.length / 3).fill(3).join(', ')
      // extent iz pozicij
      let min = [Infinity, Infinity, Infinity]
      let max = [-Infinity, -Infinity, -Infinity]
      for (let i = 0; i < pos.length; i += 3) {
        for (let a = 0; a < 3; a++) {
          min[a] = Math.min(min[a], pos[i + a])
          max[a] = Math.max(max[a], pos[i + a])
        }
      }
      const nrm = box.normals
      const nrms = []
      for (let i = 0; i < nrm.length; i += 3) nrms.push(`(${f3(nrm[i])}, ${f3(nrm[i + 1])}, ${f3(nrm[i + 2])})`)
      body.push(`    def Mesh "Box_${m}_${bi}"
    {
        int[] faceVertexCounts = [${counts}]
        int[] faceVertexIndices = [${idxs}]
        normal3f[] normals = [${nrms.join(', ')}]
        point3f[] points = [${pts.join(', ')}]
        uniform token subdivisionScheme = "none"
        extent = [(${f3(min[0])}, ${f3(min[1])}, ${f3(min[2])}), (${f3(max[0])}, ${f3(max[1])}, ${f3(max[2])})]
        rel material:binding = </Root/Mat_${m}>
    }`)
    })
  }
  for (const m of mats) {
    const def = MATERIALS[m]
    const c = def.color
    const extra = def.blend
      ? `\n        float inputs:opacity = ${c[3] ?? 1}\n        float inputs:opacityThreshold = 0`
      : ''
    body.push(`    def Material "Mat_${m}"
    {
        def Shader "PreviewSurface"
        {
            uniform token info:id = "UsdPreviewSurface"
            color3f inputs:diffuseColor = (${f3(c[0])}, ${f3(c[1])}, ${f3(c[2])})
            float inputs:metallic = ${def.metallic}
            float inputs:roughness = ${def.roughness}${extra}
            token outputs:surface
        }
        token outputs:surface.connect = </Root/Mat_${m}/PreviewSurface.outputs:surface>
    }`)
  }
  body.push('}')
  const usda = `#usda 1.0
(
    defaultPrim = "Root"
    metersPerUnit = 1
    upAxis = "Y"
    doc = "Roksal ograja — parametricni model (runda P, RAL palete)"
)

${body.join('\n\n')}
`
  return new TextEncoder().encode(usda)
}

// Minimalen stored-ZIP pisatelj z 64-bajtno poravnavo podatkov (Apple usdz spec)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function buildZip(entries) {
  const chunks = []
  const central = []
  let offset = 0
  for (const { name, data } of entries) {
    const nameBytes = new TextEncoder().encode(name)
    const crc = crc32(data)
    // Poravnaj ZAČETEK podatkov na 64 B z extra-field paddingom
    const localHeaderLen = 30 + nameBytes.length
    const dataStart = offset + localHeaderLen
    const pad = (64 - (dataStart % 64)) % 64
    const extra = pad > 0 ? (() => { const e = new Uint8Array(pad); e[0] = 0x00; e[1] = 0x00; return e })() : new Uint8Array(0)
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true)
    lh.setUint16(4, 20, true)   // version needed
    lh.setUint16(6, 0, true)    // flags (no data descriptor)
    lh.setUint16(8, 0, true)    // method 0 = stored
    lh.setUint16(10, 0, true); lh.setUint16(12, 0, true) // time/date
    lh.setUint32(14, crc, true)
    lh.setUint32(18, data.length, true)
    lh.setUint32(22, data.length, true)
    lh.setUint16(26, nameBytes.length, true)
    lh.setUint16(28, extra.length, true)
    chunks.push(new Uint8Array(lh.buffer), nameBytes, extra, data)

    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true); cd.setUint16(6, 20, true)
    cd.setUint16(8, 0, true); cd.setUint16(10, 0, true)
    cd.setUint16(12, 0, true); cd.setUint16(14, 0, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true)
    cd.setUint16(28, nameBytes.length, true)
    cd.setUint16(30, extra.length, true)
    cd.setUint16(38, 0, true); cd.setUint16(40, 0, true)
    cd.setUint32(42, offset, true)
    central.push({ cd: new Uint8Array(cd.buffer), name: nameBytes })
    offset += localHeaderLen + extra.length + data.length
  }
  const cdStart = offset
  let cdSize = 0
  for (const { cd, name } of central) { chunks.push(cd, name); cdSize += cd.length + name.length }
  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, 0x06054b50, true)
  eocd.setUint16(8, central.length, true)
  eocd.setUint16(10, central.length, true)
  eocd.setUint32(12, cdSize, true)
  eocd.setUint32(16, cdStart, true)
  chunks.push(new Uint8Array(eocd.buffer))
  return Buffer.concat(chunks.map((c) => Buffer.from(c)))
}

// ── Zagon: 2 modeli × 5 RAL barv (+ zgodovinski alias brez kode) ─────────────

/** Hitra strukturna validacija GLB: magic, verzija, JSON chunk parsabil. */
function assertGlb(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('GLB magic pokvarjen')
  if (dv.getUint32(4, true) !== 2) throw new Error('GLB verzija ≠ 2')
  if (dv.getUint32(8, true) !== buf.length) throw new Error('GLB dolžina ≠ header')
  const jsonLen = dv.getUint32(12, true)
  const json = new TextDecoder().decode(buf.subarray(20, 20 + jsonLen))
  const gltf = JSON.parse(json)
  if (!gltf.materials?.length || !gltf.meshes?.length) throw new Error('GLB brez materialov/meshev')
}

const models = [
  { name: 'ograjca-klasika', boxes: klasikaBoxes() },
  { name: 'ograjca-steklo', boxes: stekloBoxes() },
]

let written = 0
for (const model of models) {
  const groups = {}
  for (const { mat, box } of model.boxes) (groups[mat] ??= []).push({ box })
  for (const ral of RAL_COLORS) {
    const materials = materialsFor(ral)
    const glb = buildGlb(groups, materials)
    assertGlb(glb)
    const usdz = buildZip([{ name: 'model.usda', data: buildUsda(groups, materials) }])
    writeFileSync(join(OUT, `${model.name}-${ral.code}.glb`), glb)
    writeFileSync(join(OUT, `${model.name}-${ral.code}.usdz`), usdz)
    written++
    console.log(`✓ ${model.name}-${ral.code} (${ral.name}): GLB ${glb.length} B · USDZ ${usdz.length} B`)
  }
  // Zgodovinski alias = RAL 7016 (stare povezave/QR ostanejo delujoči)
  const def = materialsFor(RAL_COLORS[0])
  const glbDef = buildGlb(groups, def)
  assertGlb(glbDef)
  writeFileSync(join(OUT, `${model.name}.glb`), glbDef)
  writeFileSync(join(OUT, `${model.name}.usdz`), buildZip([{ name: 'model.usda', data: buildUsda(groups, def) }]))
}
console.log(`Zapisanih ${written} RAL variant + 2 aliasa → ${OUT}`)
