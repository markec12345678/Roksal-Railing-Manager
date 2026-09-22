'use client'

/**
 * WebXR AR skener — PRAVI XRFrame hit-test (brez simulacije).
 *
 * Kaj je pravo v tej implementaciji:
 *  • immersive-ar seja z requiredFeatures: ['hit-test'] — brez hit-testa seja ne starta
 *  • pravi render zanka prek session.requestAnimationFrame((t, frame) => …) — XRFrame API
 *  • frame.getHitTestResults(hitTestSource) vsak frame → retikla drži pravo realno ploskev
 *  • XRHitTestResult.createAnchor() → sidra; mere se vsak frame PREKALIBRIRAJU
 *    (ARCore popravlja drift, razdalja med dvema sidroma postaja natančnejša)
 *  • depth-sensing (CPU): frame.getDepthInformation(view).getDepthInMeters(0.5, 0.5)
 *    → živa razdalja do objekta na sredini zaslona
 *  • plane-detection: frame.getDetectedPlanes() → števec ravnin (vodoravne/navpične)
 *  • dom-overlay: HUD ostane klikaben čez kamero; gumbi z 'beforexrselect'
 *    preventDefault, da klik na gumb NE postavi točke
 *  • Shranjevanje: POST /api/measurements (dolžina/višina + arMetadata s segmenti)
 *
 * Degradacija: brez dom-overlay je HUD neviden med sejo (tap vseeno meri prek
 * 'select'), brez sidra so točke enkratne pozicije, brez globine ni žive razdalje.
 * Za render ne potrebujemo three.js — kompozitor ARCore prikaže kamero, mi le
 * počistimo framebuffer (alpha 0) in retiklo pozicioniramo prek DOM (projekcija
 * world→NDC z lastnim mat4 računom).
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { fetchWithQueue } from '@/lib/offline-queue'
import {
  X, Loader2, AlertTriangle, CheckCircle2, Box, Layers, Zap,
  Smartphone, Anchor, ScanLine, Undo2, Save, Crosshair, Gauge, Ruler,
  Calculator, Image as ImageIcon,
} from 'lucide-react'

// ── WebXR tipi (še niso v TS lib.dom — minimalni lokalni opisi) ──────────────

interface XRVec3Like { x: number; y: number; z: number }

interface XRRigidTransformLike {
  position: XRVec3Like
  matrix: Float32Array
  inverse: XRRigidTransformLike
}

interface XRViewLike {
  projectionMatrix: Float32Array
  transform: XRRigidTransformLike
}

interface XRViewerPoseLike { views: XRViewLike[] }

interface XRAnchorLike { anchorSpace: unknown; delete: () => void }

interface XRPlaneLike { orientation?: string; planeSpace: unknown; lastChangedTime: number }

interface XRCPUDepthInformationLike { getDepthInMeters(x: number, y: number): number }

interface XRHitTestResultLike {
  getPose(refSpace: unknown): { transform: XRRigidTransformLike } | null
  createAnchor?: () => Promise<XRAnchorLike>
}

interface XRHitTestSourceLike { cancel: () => void }

interface XRSessionLike {
  requestAnimationFrame(cb: (time: number, frame: XRFrameLike) => void): number
  cancelAnimationFrame(id: number): void
  updateRenderState(o: Record<string, unknown>): Promise<void> | void
  requestReferenceSpace(type: string): Promise<unknown>
  requestHitTestSource?(o: { space: unknown }): Promise<XRHitTestSourceLike> | undefined
  addEventListener(type: string, cb: (e?: unknown) => void): void
  removeEventListener(type: string, cb: (e?: unknown) => void): void
  end(): Promise<void>
  renderState: {
    baseLayer?: {
      framebuffer: WebGLFramebuffer | null
      framebufferWidth: number
      framebufferHeight: number
    }
  }
  enabledFeatures?: string[]
}

interface XRFrameLike {
  session: XRSessionLike
  getViewerPose(space: unknown): XRViewerPoseLike | null
  getPose(space: unknown, refSpace: unknown): { transform: XRRigidTransformLike } | null
  getHitTestResults(source: unknown): XRHitTestResultLike[]
  getDepthInformation?(view: XRViewLike): XRCPUDepthInformationLike
  getDetectedPlanes?: () => Set<XRPlaneLike>
}

interface XRWebGLLayerLike {
  framebuffer: WebGLFramebuffer | null
  framebufferWidth: number
  framebufferHeight: number
}

type XRWebGLLayerCtor = new (
  session: XRSessionLike,
  gl: WebGL2RenderingContext | WebGLRenderingContext,
) => XRWebGLLayerLike

declare global {
  interface Navigator {
    xr?: {
      isSessionSupported(mode: string): Promise<boolean>
      requestSession(mode: string, options?: Record<string, unknown>): Promise<XRSessionLike>
    }
  }
  interface Window {
    XRWebGLLayer?: XRWebGLLayerCtor
  }
}

// ── Modeli ───────────────────────────────────────────────────────────────────

interface XrPoint {
  id: string
  label: string
  anchor: XRAnchorLike | null
  pos: XRVec3Like
}

interface XrMeasurement {
  id: string
  label: string
  aId: string
  bId: string
  aPos: XRVec3Like
  bPos: XRVec3Like
  distanceMm: number
}

// ── Accuracy coach (raziskava: drift je #1 pritožba AR merilnikov) ─────────
// Če je ista os (vodoravno/navpično) izmerjena ≥2×, se meritve primerjajo.
// majhen razpon = zanesljivo, velik = opozorilo pred shranjevanjem.
type AccuracyVerdict = 'zanesljivo' | 'sprejemljivo' | 'razhajajoce'
interface AccuracyInfo {
  count: number
  avgMm: number
  minMm: number
  maxMm: number
  spreadMm: number
  spreadPct: number
  verdict: AccuracyVerdict
}

function analyzeSpread(lens: number[]): AccuracyInfo | null {
  if (lens.length < 2) return null
  const avg = lens.reduce((s, x) => s + x, 0) / lens.length
  const min = Math.min(...lens)
  const max = Math.max(...lens)
  const spreadMm = max - min
  const spreadPct = avg > 0 ? (spreadMm / avg) * 100 : 100
  const verdict: AccuracyVerdict =
    spreadPct <= 2 ? 'zanesljivo' : spreadPct <= 5 ? 'sprejemljivo' : 'razhajajoce'
  return {
    count: lens.length,
    avgMm: Math.round(avg),
    minMm: min,
    maxMm: max,
    spreadMm: Math.round(spreadMm),
    spreadPct: Math.round(spreadPct * 10) / 10,
    verdict,
  }
}

interface HudData {
  frameCount: number
  fps: number
  planeCount: number
  planesVertical: number
  centerDistM: number | null
  tracking: boolean
  reticleDistMm: number | null
  liveDistMm: number | null
}

type SessionState = 'idle' | 'checking' | 'unsupported' | 'requesting' | 'active' | 'error'

interface FeatureFlags {
  anchors: boolean
  depth: boolean
  planes: boolean
  overlay: boolean
}

const NO_FEATURES: FeatureFlags = { anchors: false, depth: false, planes: false, overlay: false }

// ── Pomožne funkcije ─────────────────────────────────────────────────────────

function dist3(a: XRVec3Like, b: XRVec3Like): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function fmtMm(mm: number): string {
  return mm < 1000 ? `${Math.round(mm)} mm` : `${(mm / 1000).toFixed(2)} m`
}

/** world → NDC → piksli. Matrike so column-major (WebGL konvencija). */
function projectToScreen(
  v: XRVec3Like,
  view: XRViewLike,
  w: number,
  h: number,
): { x: number; y: number; visible: boolean } {
  const inv = view.transform.inverse.matrix
  // eye = viewMatrix * world
  const ex = inv[0] * v.x + inv[4] * v.y + inv[8] * v.z + inv[12]
  const ey = inv[1] * v.x + inv[5] * v.y + inv[9] * v.z + inv[13]
  const ez = inv[2] * v.x + inv[6] * v.y + inv[10] * v.z + inv[14]
  const p = view.projectionMatrix
  // clip = proj * eye
  const cx = p[0] * ex + p[4] * ey + p[8] * ez + p[12]
  const cy = p[1] * ex + p[5] * ey + p[9] * ez + p[13]
  const cw = p[3] * ex + p[7] * ey + p[11] * ez + p[15]
  if (cw <= 0.0001) return { x: 0, y: 0, visible: false }
  const ndcX = cx / cw
  const ndcY = cy / cw
  return {
    x: (ndcX * 0.5 + 0.5) * w,
    y: (0.5 - ndcY * 0.5) * h,
    visible: Math.abs(ndcX) <= 1.2 && Math.abs(ndcY) <= 1.2,
  }
}

// ── Glavna komponenta ────────────────────────────────────────────────────────

export function WebXrArScanner({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hudRef = useRef<HTMLDivElement | null>(null)
  const { toast } = useToast()

  const [sessionState, setSessionState] = useState<SessionState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [features, setFeatures] = useState<FeatureFlags>(NO_FEATURES)
  const [hud, setHud] = useState<HudData>({
    frameCount: 0, fps: 0, planeCount: 0, planesVertical: 0,
    centerDistM: null, tracking: false, reticleDistMm: null, liveDistMm: null,
  })
  const [pointsView, setPointsView] = useState<{ id: string; label: string }[]>([])
  const [measurementsView, setMeasurementsView] = useState<XrMeasurement[]>([])
  const [pendingView, setPendingView] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedToProject, setSavedToProject] = useState(false)
  const [savingSchema, setSavingSchema] = useState(false)
  const [schemaSaved, setSchemaSaved] = useState(false)

  // Refs — vse, kar XRFrame zanka bere/pise (brez re-renderjev pri 60 fps)
  const sessionRef = useRef<XRSessionLike | null>(null)
  const glRef = useRef<WebGL2RenderingContext | WebGLRenderingContext | null>(null)
  const refSpaceRef = useRef<unknown>(null)
  const viewerSpaceRef = useRef<unknown>(null)
  const hitSourceRef = useRef<XRHitTestSourceLike | null>(null)
  const rafIdRef = useRef(0)
  const latestHitRef = useRef<XRHitTestResultLike | null>(null)
  const reticlePosRef = useRef<XRVec3Like | null>(null)
  const trackingRef = useRef(false)
  const pointsRef = useRef<XrPoint[]>([])
  const pendingRef = useRef<XrPoint | null>(null)
  const measurementsRef = useRef<XrMeasurement[]>([])
  const suppressSelectRef = useRef(0)
  const lastSyncRef = useRef(0)
  const framesRef = useRef(0)
  const fpsRef = useRef({ t: 0, count: 0 })
  const screenRef = useRef({ w: 1, h: 1 })
  const pointSeqRef = useRef(0)

  // DOM refi za direktno pozicioniranje/besedilo (60 fps brez Reacta)
  const reticleRef = useRef<HTMLDivElement | null>(null)
  const markerElsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const liveDistElRef = useRef<HTMLSpanElement | null>(null)

  // ── Podpora ob mountu (samo isSessionSupported — brez probe sej) ──────────
  useEffect(() => {
    let alive = true
    async function check() {
      setSessionState('checking')
      if (!navigator.xr) {
        if (alive) {
          setSessionState('unsupported')
          setErrorMsg('WebXR ni podprt v tem brskalniku. Uporabi Chrome na Androidu (ARCore telefon).')
        }
        return
      }
      try {
        const ok = await navigator.xr.isSessionSupported('immersive-ar')
        if (alive) setSessionState(ok ? 'idle' : 'unsupported')
        if (alive && !ok) setErrorMsg('Immersive AR ni podprt. Potreben je ARCore telefon (Android 2018+).')
      } catch {
        if (alive) setSessionState('unsupported')
      }
    }
    void check()
    return () => { alive = false }
  }, [])

  // ── Resize → cache dimenzij za projekcijo ─────────────────────────────────
  const updateScreenSize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    screenRef.current = { w: rect.width || window.innerWidth, h: rect.height || window.innerHeight }
  }, [])

  useEffect(() => {
    updateScreenSize()
    window.addEventListener('resize', updateScreenSize)
    return () => window.removeEventListener('resize', updateScreenSize)
  }, [updateScreenSize])

  // ── Postavitev točke (klic iz 'select' dogodka) ───────────────────────────
  const placePoint = useCallback(async () => {
    const hit = latestHitRef.current
    const reticle = reticlePosRef.current
    if (!hit || !reticle) {
      toast({ title: 'Ploskev ni zaznana', description: 'Telefon usmeri proti tlem ali steni in počakaj retiklo.' })
      return
    }

    // Sidro, če ga naprava podpira — razdalja se bo sama izboljševala
    let anchor: XRAnchorLike | null = null
    try {
      if (hit.createAnchor) anchor = await hit.createAnchor()
    } catch { /* sidro ni ključno — nadaljujemo z enkratno pozicijo */ }

    pointSeqRef.current += 1
    const n = pointSeqRef.current
    const point: XrPoint = {
      id: `p${Date.now()}_${n}`,
      label: n % 2 === 1 ? 'A' : 'B',
      anchor,
      pos: { x: reticle.x, y: reticle.y, z: reticle.z },
    }

    const prevPending = pendingRef.current
    pointsRef.current = [...pointsRef.current, point]
    setPointsView((p) => [...p, { id: point.id, label: point.label }])

    if (!prevPending) {
      pendingRef.current = point
      setPendingView(true)
      try { navigator.vibrate?.(25) } catch { /* ignore */ }
      toast({ title: 'Točka A postavljena', description: anchor ? 'Sidro ✓ — izberi točko B' : 'Izberi točko B' })
    } else {
      const distanceMm = dist3(prevPending.pos, point.pos) * 1000
      const m: XrMeasurement = {
        id: `m${Date.now()}_${n}`,
        label: `Mera ${measurementsRef.current.length + 1}`,
        aId: prevPending.id,
        bId: point.id,
        aPos: { ...prevPending.pos },
        bPos: { ...point.pos },
        distanceMm,
      }
      measurementsRef.current = [...measurementsRef.current, m]
      setMeasurementsView(measurementsRef.current)
      pendingRef.current = null
      setPendingView(false)
      setSavedToProject(false)
      try { navigator.vibrate?.([30, 40, 30]) } catch { /* ignore */ }
      toast({ title: `Mera: ${fmtMm(distanceMm)}`, description: anchor ? 'Sidri ✓' : undefined })
    }
  }, [toast])

  // ── XRFrame zanka — PRAVI render + hit-test vsak frame ───────────────────
  const onXRFrame = useCallback((time: number, frame: XRFrameLike) => {
    const s = frame.session
    rafIdRef.current = s.requestAnimationFrame(onXRFrame)
    framesRef.current += 1
    fpsRef.current.count += 1
    if (!fpsRef.current.t) fpsRef.current.t = time
    else if (time - fpsRef.current.t >= 1000) {
      fpsRef.current.t = time
      fpsRef.current.count = 0
    }

    // Prozoren framebuffer — kamero prikaže ARCore kompozitor
    const gl = glRef.current
    const layer = s.renderState.baseLayer
    if (gl && layer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    }

    const refSpace = refSpaceRef.current
    const viewerPose = refSpace ? frame.getViewerPose(refSpace) : null
    if (!viewerPose || viewerPose.views.length === 0) return
    const view = viewerPose.views[0]
    const head = view.transform.position

    // 1) HIT-TEST iz središča zaslona (viewer space)
    let reticle: XRVec3Like | null = null
    const src = hitSourceRef.current
    if (src && refSpace) {
      const results = frame.getHitTestResults(src)
      if (results.length > 0) {
        const pose = results[0].getPose(refSpace)
        if (pose) {
          const p = pose.transform.position
          reticle = { x: p.x, y: p.y, z: p.z }
          latestHitRef.current = results[0]
        }
      }
    }
    const tracking = reticle !== null
    trackingRef.current = tracking
    reticlePosRef.current = reticle

    // 2) Sidra — popravljene pozicije točk (ARCore drift korekcija)
    for (const pt of pointsRef.current) {
      if (pt.anchor && refSpace) {
        const pp = frame.getPose(pt.anchor.anchorSpace, refSpace)
        if (pp) {
          const p = pp.transform.position
          pt.pos = { x: p.x, y: p.y, z: p.z }
        }
      }
    }

    // 3) Žive razdalje
    const pending = pendingRef.current
    const liveMm = reticle && pending ? dist3(pending.pos, reticle) * 1000 : null
    const reticleMm = reticle ? dist3(reticle, head) * 1000 : null

    // 4) Ravnine
    let planeCount = 0
    let planesVertical = 0
    if (frame.getDetectedPlanes && refSpace) {
      try {
        const set = frame.getDetectedPlanes()
        planeCount = set.size
        for (const pl of set) if (pl.orientation === 'vertical') planesVertical += 1
      } catch { /* plane-detection brez podpore */ }
    }

    // 5) Globina v središču zaslona (Depth API, CPU)
    let centerM: number | null = null
    if (frame.getDepthInformation) {
      try {
        const di = frame.getDepthInformation(view)
        if (di) centerM = di.getDepthInMeters(0.5, 0.5)
      } catch { /* npr. gpu-optimized usage — ignoriraj */ }
    }

    // 6) Direktni DOM update — retikla + markerji + živa razdalja (brez Reacta)
    const { w, h } = screenRef.current
    if (reticleRef.current) {
      if (reticle) {
        const sp = projectToScreen(reticle, view, w, h)
        reticleRef.current.style.opacity = sp.visible ? '1' : '0.25'
        reticleRef.current.style.transform = `translate3d(${sp.x - 22}px, ${sp.y - 22}px, 0)`
      } else {
        reticleRef.current.style.opacity = '0'
      }
    }
    for (const pt of pointsRef.current) {
      const el = markerElsRef.current.get(pt.id)
      if (!el) continue
      const sp = projectToScreen(pt.pos, view, w, h)
      el.style.opacity = sp.visible ? '1' : '0.3'
      el.style.transform = `translate3d(${sp.x - 7}px, ${sp.y - 7}px, 0)`
    }
    if (liveDistElRef.current) {
      liveDistElRef.current.textContent = liveMm !== null ? fmtMm(liveMm) : ''
    }

    // 7) Throttled React sync (4 Hz) — številke za HUD in seznam mer
    if (time - lastSyncRef.current > 250) {
      lastSyncRef.current = time
      setHud({
        frameCount: framesRef.current,
        fps: fpsRef.current.count,
        planeCount,
        planesVertical,
        centerDistM: centerM,
        tracking,
        reticleDistMm: reticleMm,
        liveDistMm: liveMm,
      })
      // Mere z osveženimi sidri
      setMeasurementsView(measurementsRef.current.map((m) => {
        const a = pointsRef.current.find((p) => p.id === m.aId)
        const b = pointsRef.current.find((p) => p.id === m.bId)
        if (a && b && (a.anchor || b.anchor)) {
          return { ...m, aPos: { ...a.pos }, bPos: { ...b.pos }, distanceMm: dist3(a.pos, b.pos) * 1000 }
        }
        return m
      }))
    }
  }, [])

  // ── Konec seje — cleanup (mere ostanejo za shranjevanje!) ─────────────────
  const cleanupSession = useCallback((session: XRSessionLike | null) => {
    if (rafIdRef.current && session) {
      try { session.cancelAnimationFrame(rafIdRef.current) } catch { /* ignore */ }
    }
    rafIdRef.current = 0
    try { hitSourceRef.current?.cancel() } catch { /* ignore */ }
    hitSourceRef.current = null
    latestHitRef.current = null
    reticlePosRef.current = null
    glRef.current = null
    refSpaceRef.current = null
    viewerSpaceRef.current = null
    // Sidra pobrišemo na napravi; mere/točke ostanejo v state-u za "Shrani"
    for (const pt of pointsRef.current) {
      try { pt.anchor?.delete() } catch { /* ignore */ }
    }
    pendingRef.current = null
    setPendingView(false)
  }, [])

  // ── Zagon seje ─────────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    const xr = navigator.xr
    if (!xr) return
    setSessionState('requesting')
    setErrorMsg('')
    try {
      const request = (withExtras: boolean) => {
        const opts: Record<string, unknown> = {
          requiredFeatures: ['hit-test'],
          optionalFeatures: withExtras
            ? ['anchors', 'depth-sensing', 'plane-detection', 'dom-overlay']
            : ['dom-overlay'],
        }
        if (withExtras) {
          opts.depthSensing = {
            usagePreference: ['cpu-optimized', 'gpu-optimized'],
            formatPreference: ['luminance-alpha', 'float32'],
          }
        }
        if (hudRef.current) opts.domOverlay = { root: hudRef.current }
        return xr.requestSession('immersive-ar', opts)
      }

      // 1. poskus: vse funkcije; 2. poskus: samo hit-test (najnižja skupna točka)
      let session: XRSessionLike
      try {
        session = await request(true)
      } catch {
        session = await request(false)
      }
      sessionRef.current = session

      // Podeljene funkcije (Chrome: session.enabledFeatures)
      const granted: string[] = session.enabledFeatures ?? []
      const flags: FeatureFlags = {
        anchors: granted.includes('anchors'),
        depth: granted.includes('depth-sensing'),
        planes: granted.includes('plane-detection'),
        overlay: granted.includes('dom-overlay'),
      }
      setFeatures(flags)

      // WebGL + XR sloj
      const canvas = canvasRef.current
      if (!canvas) throw new Error('Canvas ni na voljo')
      const ctxOpts = { xrCompatible: true, alpha: true } as WebGLContextAttributes
      const gl = (canvas.getContext('webgl2', ctxOpts) ??
        canvas.getContext('webgl', ctxOpts)) as WebGL2RenderingContext | WebGLRenderingContext | null
      if (!gl) throw new Error('WebGL kontekst ni na voljo')
      const glXr = gl as unknown as { makeXRCompatible?: () => Promise<void> }
      if (typeof glXr.makeXRCompatible === 'function') {
        await glXr.makeXRCompatible()
      }
      const LayerCtor = window.XRWebGLLayer
      if (!LayerCtor) throw new Error('XRWebGLLayer ni na voljo')
      const baseLayer = new LayerCtor(session, gl)
      await session.updateRenderState({ baseLayer })
      glRef.current = gl

      // Prostori + hit-test vir
      refSpaceRef.current = await session.requestReferenceSpace('local')
      viewerSpaceRef.current = await session.requestReferenceSpace('viewer')
      if (session.requestHitTestSource && viewerSpaceRef.current) {
        hitSourceRef.current =
          (await session.requestHitTestSource({ space: viewerSpaceRef.current })) ?? null
      }
      if (!hitSourceRef.current) throw new Error('Hit-test vir ni na voljo')

      // 'select' = tap po zaslonu → postavi točko (gumbi ga zatirajo)
      const onSelect = () => {
        if (Date.now() < suppressSelectRef.current) return
        void placePoint()
      }
      const onEnd = () => {
        cleanupSession(session)
        setSessionState('idle')
      }
      session.addEventListener('select', onSelect)
      session.addEventListener('end', onEnd)

      // beforexrselect: klik na HUD kontrole NE sme postaviti točke
      const hud = hudRef.current
      const onBeforeXrSelect = (e: Event) => {
        const target = e.target as HTMLElement | null
        if (target?.closest('button, [data-xr-ui]')) e.preventDefault()
      }
      hud?.addEventListener('beforexrselect', onBeforeXrSelect)
      const onHudPointerDown = (e: PointerEvent) => {
        const target = e.target as HTMLElement | null
        if (target?.closest('button, [data-xr-ui]')) suppressSelectRef.current = Date.now() + 600
      }
      hud?.addEventListener('pointerdown', onHudPointerDown)
      const onSessionEndRemove = () => {
        hud?.removeEventListener('beforexrselect', onBeforeXrSelect)
        hud?.removeEventListener('pointerdown', onHudPointerDown)
      }
      session.addEventListener('end', onSessionEndRemove)

      setSessionState('active')
      updateScreenSize()
      framesRef.current = 0
      fpsRef.current = { t: 0, count: 0 }
      lastSyncRef.current = 0
      toast({
        title: '✓ WebXR AR aktivna — pravi hit-test',
        description: flags.anchors ? 'Sidra ✓ · merjenje v realnem času' : 'Tapni zaslon za postavitev točk',
      })

      rafIdRef.current = session.requestAnimationFrame(onXRFrame)
    } catch (e) {
      cleanupSession(sessionRef.current)
      sessionRef.current = null
      setSessionState('error')
      setErrorMsg(e instanceof Error ? e.message : 'Napaka pri zagonu WebXR seje')
    }
  }, [toast, placePoint, onXRFrame, cleanupSession, updateScreenSize])

  const endSession = useCallback(async () => {
    const session = sessionRef.current
    if (session) {
      try { await session.end() } catch { /* onEnd poskrbi za cleanup */ }
    }
    sessionRef.current = null
    setSessionState('idle')
  }, [])

  // ── Undo ────────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (pendingRef.current) {
      const p = pendingRef.current
      try { p.anchor?.delete() } catch { /* ignore */ }
      pointsRef.current = pointsRef.current.filter((x) => x.id !== p.id)
      setPointsView((arr) => arr.filter((x) => x.id !== p.id))
      markerElsRef.current.delete(p.id)
      pendingRef.current = null
      setPendingView(false)
      return
    }
    const last = measurementsRef.current[measurementsRef.current.length - 1]
    if (!last) return
    measurementsRef.current = measurementsRef.current.filter((m) => m.id !== last.id)
    setMeasurementsView(measurementsRef.current)
    for (const id of [last.aId, last.bId]) {
      const pt = pointsRef.current.find((p) => p.id === id)
      if (pt) {
        try { pt.anchor?.delete() } catch { /* ignore */ }
        markerElsRef.current.delete(id)
      }
    }
    pointsRef.current = pointsRef.current.filter((p) => p.id !== last.aId && p.id !== last.bId)
    setPointsView((arr) => arr.filter((x) => x.id !== last.aId && x.id !== last.bId))
    setSavedToProject(false)
    setSchemaSaved(false)
  }, [])

  // ── Povzetek mer (skupno za Shrani / Kalkulator / Shema) ─────────────────
  const summarize = useCallback(() => {
    const segs = measurementsRef.current.map((m) => ({
      oznaka: m.label,
      dolzinaMm: Math.max(1, Math.round(m.distanceMm)),
      a: { x: +m.aPos.x.toFixed(4), y: +m.aPos.y.toFixed(4), z: +m.aPos.z.toFixed(4) },
      b: { x: +m.bPos.x.toFixed(4), y: +m.bPos.y.toFixed(4), z: +m.bPos.z.toFixed(4) },
    }))
    if (segs.length === 0) return null
    // Najboljša ocena za kalkulator: najdaljši "vodoravni" segment (|dy| ≤ 50 %)
    // je dolžina ograje, "navpični" (|dy| > 50 %) pa višina. Fallback: najdaljši.
    const withAxis = segs.map((s) => ({
      ...s,
      dy: Math.abs(s.a.y - s.b.y),
      horiz: Math.sqrt((s.a.x - s.b.x) ** 2 + (s.a.z - s.b.z) ** 2),
    }))
    const horizontalLens = withAxis.filter((s) => s.dy <= 0.5 * Math.max(s.horiz, 0.001)).map((s) => s.dolzinaMm)
    const verticalLens = withAxis.filter((s) => s.dy > 0.5 * Math.max(s.horiz, 0.001)).map((s) => s.dolzinaMm)
    const longest = Math.max(...segs.map((s) => s.dolzinaMm))
    const dolzinaMm = horizontalLens.length ? Math.max(...horizontalLens) : longest
    const visinaMm = verticalLens.length ? Math.max(...verticalLens) : longest
    const accuracy = { horiz: analyzeSpread(horizontalLens), vert: analyzeSpread(verticalLens) }
    return { segs, dolzinaMm, visinaMm, accuracy }
  }, [])

  // Živi accuracy nadzor iz trenutnih meritev (render v panelu med sejo)
  const accuracyView = useMemo<AccuracyInfo | null>(() => {
    if (measurementsView.length < 2) return null
    const lensH: number[] = []
    const lensV: number[] = []
    for (const m of measurementsView) {
      const dy = Math.abs(m.aPos.y - m.bPos.y)
      const horiz = Math.sqrt((m.aPos.x - m.bPos.x) ** 2 + (m.aPos.z - m.bPos.z) ** 2)
      const mm = Math.max(1, Math.round(m.distanceMm))
      if (dy <= 0.5 * Math.max(horiz, 0.001)) lensH.push(mm)
      else lensV.push(mm)
    }
    return analyzeSpread(lensH) ?? analyzeSpread(lensV)
  }, [measurementsView])

  // ── Shrani v Meritve (pravi POST /api/measurements) ───────────────────────
  const saveMeasurements = useCallback(async () => {
    if (!projectId || measurementsRef.current.length === 0) return
    setSaving(true)
    try {
      const summary = summarize()
      if (!summary) return
      const { segs, dolzinaMm, visinaMm, accuracy } = summary

      // fetchWithQueue: brez povezave se zapis vrsti in pošlje samodejno ob povezavi
      const res = await fetchWithQueue('/api/measurements', {
        body: {
          projectId,
          dolzinaMm,
          visinaMm,
          arMetadata: {
            source: 'webxr-hit-test',
            segments: segs,
            features,
            planeCount: hud.planeCount,
            fps: hud.fps,
            accuracy,
            savedAt: new Date().toISOString(),
          },
        },
        label: `WebXR meritev ${dolzinaMm}×${visinaMm} mm`,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { queued?: boolean }
      setSavedToProject(true)
      try { navigator.vibrate?.([40, 30, 40]) } catch { /* ignore */ }
      if (data?.queued) {
        toast({
          title: '📴 Meritev je v offline vrsti',
          description: 'Samodejno se pošlje, ko povezava pride nazaj.',
        })
      } else {
        const worst = accuracy.horiz?.verdict === 'razhajajoce' || accuracy.vert?.verdict === 'razhajajoce'
          ? 'razhajajoce'
          : accuracy.horiz?.verdict === 'sprejemljivo' || accuracy.vert?.verdict === 'sprejemljivo'
            ? 'sprejemljivo'
            : accuracy.horiz?.verdict === 'zanesljivo' || accuracy.vert?.verdict === 'zanesljivo'
              ? 'zanesljivo'
              : null
        toast({
          title: '✓ Mere shranjene v Meritve',
          description:
            `Dolžina ${fmtMm(dolzinaMm)} · višina ${fmtMm(visinaMm)} (${segs.length} segmentov)` +
            (worst === 'razhajajoce'
              ? ' · ⚠️ meritve se razlikujejo — priporočamo ponovno merjenje'
              : worst === 'zanesljivo'
                ? ' · ✓ kontrola natančnosti OK'
                : ''),
        })
      }
    } catch (err) {
      toast({
        title: 'Shranjevanje ni uspelo',
        description: err instanceof Error ? err.message : 'Neznana napaka',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }, [projectId, features, hud.planeCount, hud.fps, toast])

  // ── Uporabi mere v Kalkulatorju (dogodek → page.tsx preklopi zavihek) ─────
  const useInCalculator = useCallback(() => {
    const summary = summarize()
    if (!summary) return
    window.dispatchEvent(new CustomEvent('roksal:calc-import', {
      detail: {
        dolzinaMm: summary.dolzinaMm,
        visinaMm: summary.visinaMm,
        locationName: `AR WebXR (${summary.segs.length} segmentov)`,
      },
    }))
    try { navigator.vibrate?.([30, 20, 30]) } catch { /* ignore */ }
    toast({
      title: '→ Kalkulator odprt',
      description: `Dolžina ${fmtMm(summary.dolzinaMm)} · višina ${fmtMm(summary.visinaMm)} prenešeni.`,
    })
  }, [summarize, toast])

  // ── AR shema (tloris) → AR posnetki ─────────────────────────────────────────
  // Iz pozicij točk/sider nariše ploskovni tloris (pogled zgoraj: x→X, z→Y)
  // z izmerjenimi segmenti v mm in ga shrani kot base64 PNG v AR posnetke.
  const generateSchemaCanvas = useCallback((): { dataUrl: string; summary: NonNullable<ReturnType<typeof summarize>> } | null => {
    const summary = summarize()
    const pts = pointsRef.current
    if (!summary || pts.length === 0) return null
    const W = 1080
    const H = 1400
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const xs = pts.map((p) => p.pos.x)
    const zs = pts.map((p) => p.pos.z)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minZ = Math.min(...zs), maxZ = Math.max(...zs)
    const spanX = Math.max(maxX - minX, 0.4)
    const spanZ = Math.max(maxZ - minZ, 0.4)
    const scale = Math.min((W - 200) / spanX, (H - 420) / spanZ, 320)
    const map = (p: { x: number; z: number }) => ({
      x: W / 2 + (p.x - (minX + maxX) / 2) * scale,
      y: H / 2 + 40 + (p.z - (minZ + maxZ) / 2) * scale,
    })

    // Ozadje + glava
    ctx.fillStyle = '#1d2b3e'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#f59e0b'
    ctx.font = 'bold 44px system-ui, sans-serif'
    ctx.fillText('WEBXR AR — SHEMA MERITEV', 60, 96)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = '26px system-ui, sans-serif'
    ctx.fillText(`Tloris (pogled zgoraj) · ${new Date().toLocaleString('sl-SI')}`, 60, 140)

    // Ravninski grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for (let gx = 0; gx < W; gx += 90) {
      ctx.beginPath(); ctx.moveTo(gx, 180); ctx.lineTo(gx, H - 180); ctx.stroke()
    }
    for (let gy = 180; gy < H - 160; gy += 90) {
      ctx.beginPath(); ctx.moveTo(40, gy); ctx.lineTo(W - 40, gy); ctx.stroke()
    }

    // Segmenti + oznake
    for (const m of measurementsRef.current) {
      const a = pts.find((p) => p.id === m.aId)
      const b = pts.find((p) => p.id === m.bId)
      if (!a || !b) continue
      const pa = map({ x: a.pos.x, z: a.pos.z })
      const pb = map({ x: b.pos.x, z: b.pos.z })
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke()
      // oznaka mm na sredini
      const mm = fmtMm(m.distanceMm)
      ctx.font = 'bold 30px system-ui, sans-serif'
      const tw = ctx.measureText(mm).width
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(mx - tw / 2 - 14, my - 44, tw + 28, 42)
      ctx.fillStyle = '#1d2b3e'
      ctx.fillText(mm, mx - tw / 2, my - 13)
    }

    // Točke
    for (const pt of pts) {
      const pp = map({ x: pt.pos.x, z: pt.pos.z })
      ctx.beginPath()
      ctx.arc(pp.x, pp.y, 17, 0, Math.PI * 2)
      ctx.fillStyle = '#f59e0b'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px system-ui, sans-serif'
      ctx.fillText(pt.label, pp.x - 6, pp.y + 7)
    }

    // Noga
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = '24px system-ui, sans-serif'
    const feet = [
      `Vir: pravi XRFrame hit-test${features.anchors ? ' + sidra' : ''}`,
      `Segmenti: ${summary.segs.length} · skupna dolžina ${fmtMm(summary.segs.reduce((a, s) => a + s.dolzinaMm, 0))}`,
      `Ravnine: ${hud.planeCount} · Roksal Railing Manager`,
    ]
    feet.forEach((t, i) => ctx.fillText(t, 60, H - 110 + i * 34))

    return { dataUrl: canvas.toDataURL('image/png'), summary }
  }, [summarize, features.anchors, hud.planeCount])

  const saveSchema = useCallback(async () => {
    if (!projectId) {
      toast({ title: 'Izberi projekt', description: 'Shema se shrani v AR posnetke projekta.', variant: 'destructive' })
      return
    }
    const gen = generateSchemaCanvas()
    if (!gen) {
      toast({ title: 'Ni mer za shemo', variant: 'destructive' })
      return
    }
    setSavingSchema(true)
    try {
      const res = await fetchWithQueue('/api/ar-snapshots', {
        body: {
          projectId,
          imageUrl: gen.dataUrl,
          tocke: pointsRef.current.map((p) => ({ label: p.label, x: +p.pos.x.toFixed(3), y: +p.pos.y.toFixed(3), z: +p.pos.z.toFixed(3) })),
          meritve: gen.summary.segs.map((s) => ({ a: s.a, b: s.b, dolzinaMm: s.dolzinaMm, oznaka: s.oznaka })),
          opombe: `WebXR hit-test shema · dolžina ${fmtMm(gen.summary.dolzinaMm)} · višina ${fmtMm(gen.summary.visinaMm)}`,
        },
        label: 'AR shema (WebXR)',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { queued?: boolean }
      setSchemaSaved(true)
      try { navigator.vibrate?.([40, 30, 40]) } catch { /* ignore */ }
      toast({
        title: data?.queued ? '📴 Shema je v offline vrsti' : '✓ Shema shranjena v AR posnetke',
        description: `Tloris z ${gen.summary.segs.length} segmenti (dolžina ${fmtMm(gen.summary.dolzinaMm)}).`,
      })
    } catch (err) {
      toast({
        title: 'Shema ni shranjena',
        description: err instanceof Error ? err.message : 'Neznana napaka',
        variant: 'destructive',
      })
    } finally {
      setSavingSchema(false)
    }
  }, [projectId, generateSchemaCanvas, toast])

  // ── Cleanup ob unmountu ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const session = sessionRef.current
      if (session) {
        session.end().catch(() => { /* ignore */ })
        cleanupSession(session)
      }
      sessionRef.current = null
    }
  }, [cleanupSession])

  // ── Render ──────────────────────────────────────────────────────────────────

  const featureChips = [
    { label: 'Hit-test', ok: true, value: 'XRFrame' },
    { label: 'Sidra', ok: features.anchors, value: features.anchors ? 'drift ✓' : '—' },
    { label: 'Globina', ok: features.depth, value: hud.centerDistM !== null ? `${hud.centerDistM.toFixed(2)} m` : '—' },
    { label: 'Ravnine', ok: features.planes, value: features.planes ? `${hud.planeCount}` : '—' },
    { label: 'Overlay', ok: features.overlay, value: features.overlay ? 'HUD' : '—' },
  ]

  return (
    <div className="fixed inset-0 z-[60] bg-black" role="dialog" aria-label="WebXR AR merjenje">
      {/* Glava (vidna tudi pred sejo) */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-roksal-amber">
              <Box className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">WebXR AR — pravi hit-test</h2>
              <p className="text-[10px] text-white/60">XRFrame · sidra · Depth API</p>
            </div>
          </div>
          {sessionState === 'active' && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[9px] font-bold text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> AKTIVNA
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-full p-2 text-white hover:bg-white/10"
            aria-label="Zapri WebXR skener"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* GL canvas — kompozitor ARCore prikaže kamero; mi le počistimo framebuffer */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

      {/* HUD root = dom-overlay root; MORA obstajati pred requestSession */}
      <div ref={hudRef} className="absolute inset-0">
        {sessionState === 'active' && (
          <>
            {/* Statusni čipi (zgled, fullscreen, tapne se skoznje ne meri) */}
            <div className="absolute top-[68px] left-3 right-3 z-10 flex flex-wrap gap-1.5 pointer-events-none">
              {featureChips.map((c) => (
                <span
                  key={c.label}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold backdrop-blur-sm ${
                    c.ok ? 'bg-roksal-navy/85 text-white' : 'bg-black/50 text-white/50'
                  }`}
                >
                  {c.ok ? <CheckCircle2 className="h-3 w-3 text-roksal-amber" /> : <AlertTriangle className="h-3 w-3" />}
                  {c.label}
                  <span className={c.ok ? 'text-roksal-amber' : ''}>{c.value}</span>
                </span>
              ))}
              <span className="flex items-center gap-1 rounded-full bg-roksal-navy/85 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                <Gauge className="h-3 w-3 text-roksal-amber" />
                {hud.fps} fps · f{hud.frameCount}
              </span>
            </div>

            {/* Retikla — drži PRAVO realno ploskev (hit-test vsak frame) */}
            <div
              ref={reticleRef}
              className="pointer-events-none absolute left-0 top-0 z-10 opacity-0 transition-opacity duration-150"
              aria-hidden="true"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-roksal-amber bg-roksal-amber/10 shadow-[0_0_12px_rgba(245,158,11,0.5)]">
                <div className="h-1.5 w-1.5 rounded-full bg-roksal-amber" />
              </div>
            </div>

            {/* Postavljeni točki (markerji iz hit-testa/sider) */}
            <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
              {pointsView.map((p) => (
                <div
                  key={p.id}
                  ref={(el) => {
                    if (el) markerElsRef.current.set(p.id, el)
                    else markerElsRef.current.delete(p.id)
                  }}
                  className="absolute left-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-white/90 text-[7px] font-black text-roksal-navy opacity-0 shadow"
                >
                  {p.label}
                </div>
              ))}
            </div>

            {/* Namigi sledenja */}
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-16 text-center">
              {!hud.tracking && (
                <p className="mx-auto inline-block rounded-full bg-black/60 px-3 py-1 text-[11px] text-white/90">
                  Poglej proti tlem ali steni — iščem ploskev…
                </p>
              )}
              {hud.tracking && features.depth && hud.centerDistM !== null && (
                <p className="mx-auto inline-block rounded-full bg-black/60 px-3 py-1 text-[11px] text-white/90">
                  <ScanLine className="mr-1 inline h-3 w-3 text-roksal-amber" />
                  Objekt na sredini: {hud.centerDistM.toFixed(2)} m
                </p>
              )}
            </div>

            {/* Spodnja paluba: živa razdalja + mere + kontrole */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto w-full max-w-md space-y-2 rounded-2xl bg-roksal-navy/92 p-3 backdrop-blur-md shadow-xl">
                {/* Živa razdalja A→retikla (tape-measure način) */}
                <div className="min-h-[44px] rounded-xl bg-black/30 px-3 py-2 text-center" data-xr-ui>
                  {pendingView ? (
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-white/50">
                        Točka A postavljena — živa razdalja do B
                      </div>
                      <div className="text-3xl font-black tabular-nums text-roksal-amber">
                        <span ref={liveDistElRef}>—</span>
                      </div>
                    </div>
                  ) : hud.reticleDistMm !== null ? (
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-white/50">
                        Razdalja do ploskve
                      </div>
                      <div className="text-2xl font-black tabular-nums text-white">
                        {fmtMm(hud.reticleDistMm)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-[11px] text-white/60">
                      <Crosshair className="h-4 w-4 text-roksal-amber" />
                      {hud.tracking ? 'Tapni zaslon → točka A' : 'Usmeri telefon proti ploskvi'}
                    </div>
                  )}
                </div>

                {/* Seznam mer */}
                {measurementsView.length > 0 && (
                  <div className="max-h-24 overflow-y-auto rounded-xl bg-black/25 px-3 py-1.5" data-xr-ui>
                    {measurementsView.map((m) => (
                      <div key={m.id} className="flex items-center justify-between py-0.5 text-[11px] text-white">
                        <span className="text-white/70">{m.label}</span>
                        <span className="font-bold tabular-nums text-roksal-amber">{fmtMm(m.distanceMm)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Accuracy coach — živi nadzor razpona meritev */}
                {accuracyView && (
                  <div
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                      accuracyView.verdict === 'zanesljivo'
                        ? 'border-green-500/40 bg-green-500/10 text-green-300'
                        : accuracyView.verdict === 'sprejemljivo'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : 'border-red-500/40 bg-red-500/10 text-red-300'
                    }`}
                    data-xr-ui
                  >
                    {accuracyView.verdict === 'razhajajoce' ? (
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    )}
                    <span>
                      Kontrola natančnosti ({accuracyView.count}×):
                      {' '}{accuracyView.minMm}–{accuracyView.maxMm} mm
                      {' '}(razpon {accuracyView.spreadPct}%) —{' '}
                      {accuracyView.verdict === 'zanesljivo'
                        ? 'zanesljivo ✓'
                        : accuracyView.verdict === 'sprejemljivo'
                          ? 'sprejemljivo'
                          : 'prevelik razpon — ponovno izmeri!'}
                    </span>
                  </div>
                )}

                {/* Kontrole */}
                <div className="flex gap-2" data-xr-ui>
                  <Button
                    type="button"
                    onClick={undo}
                    variant="outline"
                    size="sm"
                    disabled={pointsView.length === 0}
                    className="min-h-[44px] flex-1 border-white/20 bg-transparent text-white hover:bg-white/10"
                  >
                    <Undo2 className="mr-1 h-4 w-4" /> Undo
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void saveMeasurements()}
                    disabled={saving || !projectId || measurementsView.length === 0 || savedToProject}
                    size="sm"
                    className="min-h-[44px] flex-1 bg-roksal-amber text-white hover:bg-roksal-amber/90"
                  >
                    {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                    {savedToProject ? 'Shranjeno ✓' : 'Shrani'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void saveSchema()}
                    disabled={savingSchema || measurementsView.length === 0 || schemaSaved}
                    size="sm"
                    variant="outline"
                    aria-label="Shrani AR shemo v posnetke"
                    className="min-h-[44px] w-[52px] shrink-0 border-white/20 bg-transparent px-0 text-white hover:bg-white/10"
                  >
                    {savingSchema ? <Loader2 className="h-4 w-4 animate-spin" /> : schemaSaved ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <ImageIcon className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void endSession()}
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] flex-1 border-white/20 bg-transparent text-white hover:bg-white/10"
                  >
                    <X className="mr-1 h-4 w-4" /> Konec
                  </Button>
                </div>
                {!projectId && (
                  <p className="text-center text-[9px] text-amber-300/80">
                    Za shranjevanje izberi projekt (Domov → izberi projekt)
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Vmesna stanja — kartica (idle / checking / requesting / unsupported / error) */}
        {sessionState !== 'active' && (
          <div className="absolute inset-0 flex items-center justify-center p-4 pt-20">
            <Card className="w-full max-w-sm bg-roksal-navy border-roksal-amber/30">
              <CardContent className="space-y-4 p-5 sm:p-6">
                {sessionState === 'checking' && (
                  <div className="text-center">
                    <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-roksal-amber" />
                    <p className="text-sm text-white">Preverjam WebXR podporo…</p>
                  </div>
                )}

                {sessionState === 'unsupported' && (
                  <div className="space-y-2 text-center">
                    <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
                    <p className="text-sm font-medium text-white">WebXR AR ni podprt</p>
                    <p className="text-xs text-white/70">{errorMsg}</p>
                    <div className="mt-2 rounded-lg bg-white/10 p-2.5 text-left text-[10px] text-white/80">
                      <p className="mb-1 font-semibold">Zahtevano:</p>
                      <p>• Chrome 90+ na Androidu</p>
                      <p>• ARCore telefon (Pixel 2+, Galaxy S8+, …)</p>
                      <p>• HTTPS (PWA namestitev)</p>
                    </div>
                    <Button type="button" onClick={onClose} variant="outline" size="sm" className="min-h-[44px]">
                      <Smartphone className="mr-1 h-4 w-4" /> Razumem
                    </Button>
                  </div>
                )}

                {sessionState === 'idle' && (
                  <div className="space-y-3">
                    <div className="text-center">
                      <Box className="mx-auto mb-2 h-10 w-10 text-roksal-amber" />
                      <p className="text-sm font-semibold text-white">WebXR AR — pravi merjenik</p>
                      <p className="mt-1 text-xs text-white/70">
                        XRFrame hit-test + sidra + Depth API. Retikla drži realno ploskev,
                        mere se samodejno kalibrirajo.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-green-600/15 p-2">
                        <Crosshair className="mx-auto mb-1 h-4 w-4 text-green-400" />
                        <div className="text-[9px] text-white">Hit-test</div>
                        <div className="text-[9px] font-semibold text-green-400">obvezen</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2">
                        <Anchor className="mx-auto mb-1 h-4 w-4 text-roksal-amber" />
                        <div className="text-[9px] text-white">Sidra</div>
                        <div className="text-[9px] text-white/50">samodejno</div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2">
                        <Layers className="mx-auto mb-1 h-4 w-4 text-roksal-amber" />
                        <div className="text-[9px] text-white">Ravnine</div>
                        <div className="text-[9px] text-white/50">samodejno</div>
                      </div>
                    </div>

                    {measurementsView.length > 0 && (
                      <div className="rounded-lg bg-roksal-amber/10 p-2.5">
                        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase text-roksal-amber">
                          <Ruler className="h-3 w-3" /> Zadnja seja: {measurementsView.length} mer
                        </div>
                        <div className="max-h-24 space-y-0.5 overflow-y-auto">
                          {measurementsView.map((m) => (
                            <div key={m.id} className="flex justify-between text-[11px] text-white/85">
                              <span>{m.label}</span>
                              <span className="font-bold tabular-nums text-roksal-amber">{fmtMm(m.distanceMm)}</span>
                            </div>
                          ))}
                        </div>
                        {projectId && !savedToProject && (
                          <Button
                            type="button"
                            onClick={() => void saveMeasurements()}
                            disabled={saving}
                            size="sm"
                            className="mt-2 min-h-[40px] w-full bg-roksal-amber text-white"
                          >
                            <Save className="mr-1 h-3.5 w-3.5" /> Shrani {measurementsView.length} mer v Meritve
                          </Button>
                        )}
                        {measurementsView.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              onClick={useInCalculator}
                              size="sm"
                              variant="outline"
                              className="min-h-[40px] border-white/20 bg-transparent text-white hover:bg-white/10"
                            >
                              <Calculator className="mr-1 h-3.5 w-3.5" /> V kalkulator
                            </Button>
                            <Button
                              type="button"
                              onClick={() => void saveSchema()}
                              disabled={savingSchema || schemaSaved}
                              size="sm"
                              variant="outline"
                              className="min-h-[40px] border-white/20 bg-transparent text-white hover:bg-white/10"
                            >
                              {savingSchema ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : schemaSaved ? <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-green-400" /> : <ImageIcon className="mr-1 h-3.5 w-3.5" />}
                              {schemaSaved ? 'Shema ✓' : 'Shema'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={() => void startSession()}
                      className="min-h-[48px] w-full bg-roksal-amber text-white hover:bg-roksal-amber/90"
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Zaženi WebXR AR
                    </Button>
                    <p className="text-center text-[9px] text-white/45">
                      Brskalnik bo zahteval dovoljenje za kamero in zaznavanje prostora.
                    </p>
                  </div>
                )}

                {sessionState === 'requesting' && (
                  <div className="text-center">
                    <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-roksal-amber" />
                    <p className="text-sm text-white">Zaganjam WebXR sejo…</p>
                    <p className="mt-1 text-[10px] text-white/60">Potrdi dovoljenja na telefonu.</p>
                  </div>
                )}

                {sessionState === 'error' && (
                  <div className="space-y-2 text-center">
                    <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
                    <p className="text-sm font-medium text-white">Napaka</p>
                    <p className="text-xs text-white/70">{errorMsg}</p>
                    <div className="flex justify-center gap-2">
                      <Button type="button" onClick={() => setSessionState('idle')} variant="outline" size="sm" className="min-h-[44px]">
                        Nazaj
                      </Button>
                      <Button type="button" onClick={() => void startSession()} size="sm" className="min-h-[44px] bg-roksal-amber text-white">
                        Poskusi znova
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Zaganjalnik (kartica v AR zavihku) ───────────────────────────────────────

export function WebXrLauncher({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false)
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    async function check() {
      if (!navigator.xr) {
        setSupported(false)
        return
      }
      try {
        const s = await navigator.xr.isSessionSupported('immersive-ar')
        if (alive) setSupported(s)
      } catch {
        if (alive) setSupported(false)
      }
    }
    void check()
    return () => { alive = false }
  }, [])

  return (
    <>
      <Card className={supported ? 'border-green-300' : 'border-amber-200'}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${supported ? 'bg-green-100' : 'bg-amber-100'}`}>
              <Box className={`h-5 w-5 ${supported ? 'text-green-600' : 'text-amber-600'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-roksal-navy">WebXR AR — pravi hit-test</h3>
                <span className="rounded-full bg-roksal-amber/10 px-1.5 py-0.5 text-[8px] font-bold text-roksal-amber">
                  XRFrame
                </span>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Pravi XRFrame hit-test v realnem času + sidra (samokalibracija) + Depth API.
                Tapni točko A → točko B → mera v mm. ±1–2 cm, brez kalibracije.
              </p>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
                <span className={`flex items-center gap-1 ${supported ? 'text-green-600' : 'text-amber-600'}`}>
                  {supported ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {supported ? 'Podprto na tej napravi' : 'Ni podprto (Chrome Android potreben)'}
                </span>
              </div>
              <Button
                type="button"
                onClick={() => setOpen(true)}
                disabled={!supported || !projectId}
                size="sm"
                className="min-h-[44px] w-full bg-roksal-navy text-white"
              >
                <Box className="mr-2 h-4 w-4" />
                {supported ? 'Odpri WebXR AR' : 'Ni podprto'}
              </Button>
              {!projectId && supported && (
                <p className="mt-1 text-center text-[9px] text-amber-600">Izberi projekt v Domov</p>
              )}
              {!supported && (
                <p className="mt-1 text-center text-[9px] text-muted-foreground">
                  <Smartphone className="mr-1 inline h-3 w-3" />
                  Potreben Android Chrome + ARCore telefon
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {open && <WebXrArScanner projectId={projectId} onClose={() => setOpen(false)} />}
    </>
  )
}
