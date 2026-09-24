/**
 * CV STUDIO SDK — zmožnosti naprave + pogodbe ponudnikov (issue #11 §5).
 *
 * CAPABILITY-BASED ARHITEKTURA: jedro Roksala NI vezano na AR platformo.
 * Naprava lahko vrne: camera only | camera + tracking | camera + planes |
 * camera + depth. UI mora jasno vedeti, kaj DEJANSKO obstaja — manjkajoča
 * zmožnost = jasen fallback, NIKOLI fake 3D ali napaka.
 *
 * Ti moduli so browser-only (uporablja jih CV Studio UI); čisti tipi/pogodbe
 * so testabilni brez DOM.
 */

export interface DeviceCapabilities {
  /** getUserMedia na voljo */
  camera: boolean
  /** zadnja kamera verjetno na voljo (mobilna naprava / environment facing) */
  rearCameraAssumed: boolean
  /** WebXR immersive-ar podprt (pravi AR tracking — WebXrArScanner pot) */
  webxrAr: boolean
  /** depth senzor: 'unknown' (potreben živi XR session za potrditev),
   *  'unavailable' (ni WebXR), nikoli neugibano 'available' */
  depth: 'unknown' | 'unavailable' | 'available'
  /** LIVE predogled možen (kamera) */
  livePreview: boolean
  /** iskrena opomba za UI (fallback razlage) */
  note: string
}

/**
 * Zazna zmožnosti naprave (client-side). VARNOSTNO: nikoli ne vrže —
 * neznana zmožnost = false/'unknown' + opomba (fail-open za UI izbiro
 * načina, fail-closed za zahtevane zmožnosti: LIVE brez kamere NI ponujen).
 */
export async function detectDeviceCapabilities(): Promise<DeviceCapabilities> {
  const caps: DeviceCapabilities = {
    camera: false,
    rearCameraAssumed: false,
    webxrAr: false,
    depth: 'unavailable',
    livePreview: false,
    note: '',
  }

  // kamera (getUserMedia) — runtime preverba (lib.dom tipi so optimistični)
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  ) {
    caps.camera = true
    caps.livePreview = true
    // zadnja kamera: preveri naprave, če je enumerateDevices na voljo
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter((d) => d.kind === 'videoinput')
      if (videoInputs.length > 0) {
        // hevristika: več kot 1 kamera ali mobilni UA → environment facing
        const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
        caps.rearCameraAssumed = videoInputs.length > 1 || mobile
      }
    } catch {
      // enumerateDevices lahko javi NotAllowedError pred dovoljenjem —
      // to NI napaka: kamera ostane 'true', rearCameraAssumed ostane false
    }
  }

  // WebXR AR (pravi tracking/hit-test)
  const xr = (navigator as unknown as { xr?: { isSessionSupported?: (m: string) => Promise<boolean> } }).xr
  if (typeof xr?.isSessionSupported === 'function') {
    try {
      caps.webxrAr = await xr.isSessionSupported('immersive-ar')
    } catch {
      caps.webxrAr = false
    }
  }
  caps.depth = caps.webxrAr ? 'unknown' : 'unavailable'

  if (!caps.camera) {
    caps.note = 'Kamera ni na voljo — LIVE način ni ponujen; uporabi PHOTO (naloži fotografijo).'
  } else if (!caps.webxrAr) {
    caps.note = 'WebXR AR ni podprt — LIVE ostaja 2D CV predogled (frame-relative overlay); pravi AR ni simuliran.'
  } else {
    caps.note = 'WebXR AR podprt — za pravi tracking/hit-test uporabi AR skener; CV Studio deluje v 2D CV načinu.'
  }
  return caps
}

// ───────────────────────────────────────────────────────────────────────────
// Pogodbe ponudnikov (issue #11 §5 — čista abstrakcija, brez platforme)
// ───────────────────────────────────────────────────────────────────────────

/** Kamera ponudnik (getUserMedia implementacija v UI komponenti). */
export interface CameraProvider {
  start(facing: 'environment' | 'user'): Promise<void>
  /** Zajemi trenutni frame → data URL (maxDim omeji daljšo stranico). */
  captureFrame(maxDim?: number): { dataUrl: string; w: number; h: number } | null
  stop(): void
  isActive(): boolean
}

/** Scena detekcija ponudnik (klic /api/vision/scene). */
export interface SceneDetectionProvider {
  analyze(dataUrl: string): Promise<SceneAnalysisLike | { error: string }>
}

/** Kje je analiza dostopna (konzervativna struktura za UI brez tipov API). */
export interface SceneAnalysisLike {
  sessionId: string
  elements: Array<{ id: string; type: string; state: string; warnings: string[] }>
  guidance: { seen: string; missing: string | null; nextAction: string }
}

/** Plane ponudnik — capability-based. */
export interface PlaneProvider {
  kind: 'none' | 'frame-relative' | 'tracked'
  note: string
}

/** Depth ponudnik — capability-based. */
export interface DepthProvider {
  kind: 'none' | 'device'
  note: string
}

/** Pose ponudnik — capability-based. */
export interface PoseProvider {
  kind: 'none' | 'device'
  note: string
}

/** Renderer postavitve (2D canvas implementacija v UI). */
export interface PlacementRenderer {
  render(overlay: CanvasRenderingContext2D, result: unknown, imageSize: { w: number; h: number }): void
}

/** Privzeti ponudniki glede na zaznane zmožnosti (iskren fallback). */
export function providersForCapabilities(caps: DeviceCapabilities): {
  plane: PlaneProvider
  depth: DepthProvider
  pose: PoseProvider
} {
  return {
    plane: caps.webxrAr
      ? { kind: 'tracked', note: 'WebXR hit-test na voljo v AR skenerju.' }
      : { kind: 'frame-relative', note: 'Overlay glede na trenutni frame (brez trackinga).' },
    depth: caps.webxrAr
      ? { kind: 'none', note: 'Depth NI potrjen brez živega XR sessiona (nikoli neugiban).' }
      : { kind: 'none', note: 'Depth ni na voljo.' },
    pose: caps.webxrAr
      ? { kind: 'none', note: 'Pose prek WebXR sessiona (AR skener); CV Studio ostaja frame-relative.' }
      : { kind: 'none', note: 'Pose ni na voljo.' },
  }
}
