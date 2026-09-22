'use client'

/**
 * 3D ograja v AR — <model-viewer> (runda O)
 * -----------------------------------------------------------------------------
 * Google <model-viewer> (Apache-2.0, npm @google/model-viewer) prikazuje
 * parametrično ograjo in ponuja AR prek:
 *   • webxr       → takojšnja AR v Chrome (istega dne kot naš WebXR skener)
 *   • scene-viewer → Google Scene Viewer (Android ARCore, namestitvena globina)
 *   • quick-look  → Apple AR Quick Look (iOS Safari, potreben USDZ = ios-src)
 *
 * Modeli so izdelani z tools/generate-fence-models.mjs (GLB + USDZ, brez
 * zunanjih odvisnosti) — prava velikost segmenta 2,0 × 1,1 m, 5 RAL prahobarv
 * (7016/9005/9016/6005/8017); izbira je trajna (localStorage).
 *
 * Zakaj imperativno (document.createElement)?
 *   Custom element ne gre skozi React JSX tipiziranje brez hackov; imperativna
 *   integracija omogoča tudi natanko enkratno pripenjanje slot="ar-button" gumba
 *   in čiste event listenerje ('load' | 'error' | 'ar-status').
 *
 * Code-splitting: @google/model-viewer (~1 MB) se naloži ŠELE ko je kartica
 * vidna (IntersectionObserver + dynamic import) — ne obteži prve strani.
 *
 * ar-placement: 'wall' (privzeto — balkonska ograja gre na rob stene/tlorisa)
 * ali 'floor' (prosto postavljanje na tla) — preklopna stikala v UI.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Box, Loader2, AlertTriangle, CheckCircle2, RotateCw,
  Move3d, Smartphone, Layers, PanelTop, Info, Palette,
} from 'lucide-react'

type FenceVariant = 'klasika' | 'steklo'
type Placement = 'wall' | 'floor'

type Ral = { code: string; name: string; hex: string }

/** Isti seznam kot tools/generate-fence-models.mjs (RAL_COLORS) — runda P. */
const RAL_COLORS: Ral[] = [
  { code: '7016', name: 'antracit', hex: '#383E42' },
  { code: '9005', name: 'črna', hex: '#0A0A0C' },
  { code: '9016', name: 'bela', hex: '#F1F0EA' },
  { code: '6005', name: 'zelena', hex: '#114232' },
  { code: '8017', name: 'rjava', hex: '#45322E' },
]
const DEFAULT_RAL = '7016'
const RAL_STORAGE_KEY = 'roksal-ar-ral'

const VARIANTS: { id: FenceVariant; label: string; opis: string }[] = [
  { id: 'klasika', label: 'Klasika', opis: 'palice 25×25 · letvi 40×60 · po izbranem RAL' },
  { id: 'steklo', label: 'Steklo', opis: 'panel 8 mm · ročaji po izbranem RAL' },
]

interface ArStatusDetail { status: string }

export function Fence3dViewer() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mvRef = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [mvReady, setMvReady] = useState(false)
  const [variant, setVariant] = useState<FenceVariant>('klasika')
  const [ral, setRal] = useState<string>(DEFAULT_RAL)
  const [placement, setPlacement] = useState<Placement>('wall')
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const [loadError, setLoadError] = useState('')
  const [arAvailable, setArAvailable] = useState<boolean | null>(null)
  const [arActive, setArActive] = useState(false)
  const variantRef = useRef(variant)
  variantRef.current = variant
  const ralRef = useRef(ral)
  ralRef.current = ral

  // 0) Ral izbira — trajna (localStorage, piškotki niso potrebni)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RAL_STORAGE_KEY)
      if (stored && RAL_COLORS.some((r) => r.code === stored)) setRal(stored)
    } catch { /* localStorage nedostopen (privatni način) — tiho */ }
  }, [])

  const selectRal = useCallback((code: string) => {
    setRal(code)
    try { window.localStorage.setItem(RAL_STORAGE_KEY, code) } catch { /* tiho */ }
  }, [])

  // 1) Lazy-load @google/model-viewer šele, ko je kartica blizu viewporta
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '160px' },
    )
    io.observe(host)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let alive = true
    void import('@google/model-viewer')
      .then(() => { if (alive) setMvReady(true) })
      .catch(() => { if (alive) setLoadError('3D pregledovalnik se ni naložil (povezava?)') })
    return () => { alive = false }
  }, [visible])

  // 2) Ustvari <model-viewer> + slot AR gumb imperativno (enkrat)
  useEffect(() => {
    if (!mvReady || !hostRef.current) return
    const el = document.createElement('model-viewer')
    el.setAttribute('alt', '3D model balkonske ograje — poglej v prostoru v pravi velikosti')
    el.setAttribute('camera-controls', '')
    el.setAttribute('auto-rotate', '')
    el.setAttribute('auto-rotate-delay', '2500')
    el.setAttribute('rotation-per-second', '18deg')
    el.setAttribute('shadow-intensity', '1.1')
    el.setAttribute('shadow-softness', '0.7')
    el.setAttribute('exposure', '1.05')
    el.setAttribute('environment-image', 'neutral')
    el.setAttribute('interaction-prompt', 'auto')
    el.setAttribute('loading', 'eager')
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.backgroundColor = 'transparent'
    el.style.setProperty('--poster-color', 'transparent')
    el.style.setProperty('--progress-bar-color', '#f59e0b')
    el.style.setProperty('--progress-bar-height', '3px')

    // AR gumb (slot="ar-button") — model-viewer ga pokaže samo, če AR deluje
    const arBtn = document.createElement('button')
    arBtn.setAttribute('slot', 'ar-button')
    arBtn.type = 'button'
    arBtn.textContent = 'Poglej v prostoru'
    arBtn.style.cssText = [
      'position:absolute', 'bottom:12px', 'left:50%', 'transform:translateX(-50%)',
      'min-height:44px', 'padding:0 18px', 'border-radius:12px',
      'background:#f59e0b', 'color:#fff', 'font-weight:700', 'font-size:13px',
      'border:none', 'box-shadow:0 4px 14px rgba(245,158,11,0.45)', 'cursor:pointer',
      'display:flex', 'align-items:center', 'gap:6px',
    ].join(';')
    el.appendChild(arBtn)

    const onLoad = () => setLoaded((prev) => ({ ...prev, [`${variantRef.current}-${ralRef.current}`]: true }))
    const onError = () => setLoadError('Model se ni naložil — osveži stran ali preveri povezavo')
    const onArStatus = (e: Event) => {
      const status = (e as CustomEvent<ArStatusDetail>).detail?.status
      if (status === 'session-started') setArActive(true)
      else if (status === 'object-placed' || status === 'failed' || status === 'not-presenting') setArActive(false)
      if (status === 'failed') setArAvailable(false)
    }
    el.addEventListener('load', onLoad)
    el.addEventListener('error', onError)
    el.addEventListener('ar-status', onArStatus as EventListener)

    hostRef.current.appendChild(el)
    mvRef.current = el
    return () => {
      el.removeEventListener('load', onLoad)
      el.removeEventListener('error', onError)
      el.removeEventListener('ar-status', onArStatus as EventListener)
      el.remove()
      mvRef.current = null
    }
  }, [mvReady])

  // 3) Spremembe atributov (varianta / RAL / postavitev)
  useEffect(() => {
    const el = mvRef.current
    if (!el) return
    el.setAttribute('src', `/models/ograjca-${variant}-${ral}.glb`)
    el.setAttribute('ios-src', `/models/ograjca-${variant}-${ral}.usdz`)
    el.setAttribute('ar', '')
    el.setAttribute('ar-modes', 'webxr scene-viewer quick-look')
    el.setAttribute('ar-placement', placement)
    el.setAttribute('ar-scale', 'auto')
  }, [variant, ral, placement, mvReady])

  // 4) Ali je AR sploh na voljo (WebXR immersive-ar ALI Scene Viewer/Quick Look)?
  useEffect(() => {
    let alive = true
    const check = () => {
      if (!alive) return
      const el = mvRef.current as (HTMLElement & { canActivateAR?: boolean }) | null
      if (el && typeof el.canActivateAR === 'boolean') setArAvailable(el.canActivateAR)
    }
    const t = window.setInterval(check, 600)
    const stop = window.setTimeout(() => window.clearInterval(t), 6000)
    return () => { alive = false; window.clearInterval(t); window.clearTimeout(stop) }
  }, [mvReady])

  const retry = useCallback(() => {
    const el = mvRef.current as (HTMLElement & { dismissPoster?: () => void }) | null
    setLoadError('')
    if (el) {
      const src = el.getAttribute('src')
      if (src) el.setAttribute('src', `${src}?r=${Date.now()}`)
    }
  }, [])

  const isLoaded = loaded[`${variant}-${ral}`]
  const activeRal = RAL_COLORS.find((r) => r.code === ral) ?? RAL_COLORS[0]

  return (
    <Card className="overflow-hidden border-roksal-navy/15 transition-all hover:border-roksal-navy/25 hover:shadow-md">
      <CardContent className="p-0">
        {/* Glava */}
        <div className="flex items-start gap-3 border-b border-roksal-navy/10 bg-gradient-to-r from-roksal-navy/[0.06] to-transparent p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-roksal-navy shadow-sm">
            <Move3d className="h-5 w-5 text-roksal-amber" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-roksal-navy">3D ograja v AR</h3>
              <span className="rounded-full bg-roksal-amber/10 px-1.5 py-0.5 text-[8px] font-bold text-roksal-amber">model-viewer</span>
              <span className="rounded-full bg-roksal-navy/5 px-1.5 py-0.5 text-[8px] font-bold text-roksal-navy">GLB</span>
              <span className="rounded-full bg-roksal-navy/5 px-1.5 py-0.5 text-[8px] font-bold text-roksal-navy">USDZ · Quick Look</span>
              <span className="rounded-full bg-roksal-amber/10 px-1.5 py-0.5 text-[8px] font-bold text-roksal-amber">5× RAL</span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Oddelek 2,0 × 1,1 m v pravi velikosti: Android → Scene Viewer/WebXR,
              iPhone → AR Quick Look. Barva prahu po RAL klasik — stranka vidi
              ograjo <em>v svoji barvi, na svojem balkonu</em>, preden jo naroči.
            </p>
          </div>
        </div>

        {/* 3D prikaz — temen studijski gradient, 3D model izstopa */}
        <div ref={hostRef} className="relative h-64 w-full overflow-hidden sm:h-72" style={{ background: 'radial-gradient(120% 90% at 50% 0%, #3a4a5e 0%, #1d2b3e 55%, #14202e 100%)' }}>
          {!mvReady && !loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-roksal-amber" />
              <p className="text-[11px]">Nalagam 3D pregledovalnik…</p>
            </div>
          )}
          {mvReady && !isLoaded && !loadError && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <span className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-[10px] font-medium text-white/85 backdrop-blur-sm">
                <Loader2 className="h-3 w-3 animate-spin text-roksal-amber" /> Nalagam model ograje…
              </span>
            </div>
          )}
          {loadError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              <p className="text-xs text-white/85">{loadError}</p>
              <button
                type="button"
                onClick={retry}
                className="min-h-[36px] rounded-lg bg-white/10 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-white/20"
              >
                Poskusi znova
              </button>
            </div>
          )}
          {/* Prekrivni namig vrtenja (izgine ob 'load') */}
          {isLoaded && !arActive && (
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[10px] text-white/85 backdrop-blur-sm">
              <RotateCw className="h-3 w-3 text-roksal-amber" /> vrti s prstom · ščipni za približek
            </div>
          )}
          {arActive && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
              <span className="flex items-center gap-1.5 rounded-full bg-green-600/90 px-3 py-1 text-[10px] font-bold text-white shadow-lg">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> AR aktivna — postavi ograjo na rob
              </span>
            </div>
          )}
        </div>

        {/* Kontrole: varianta + postavitev */}
        <div className="space-y-2.5 p-4">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Izbira tipa ograje">
            {VARIANTS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariant(v.id)}
                aria-pressed={variant === v.id}
                className={`min-h-[44px] rounded-xl border px-2.5 py-1.5 text-left transition-all ${
                  variant === v.id
                    ? 'border-roksal-amber bg-roksal-amber/10 shadow-sm'
                    : 'border-roksal-navy/10 bg-white hover:border-roksal-navy/25 hover:bg-roksal-navy/[0.03]'
                }`}
              >
                <span className={`flex items-center gap-1.5 text-[12px] font-bold ${variant === v.id ? 'text-roksal-amber' : 'text-roksal-navy'}`}>
                  {v.id === 'klasika' ? <Layers className="h-3.5 w-3.5" /> : <PanelTop className="h-3.5 w-3.5" />}
                  {v.label}
                  {isLoaded && variant === v.id && <CheckCircle2 className="ml-auto h-3 w-3 text-green-500" />}
                </span>
                <span className="mt-0.5 block text-[9px] leading-tight text-muted-foreground">{v.opis}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2" role="group" aria-label="Izbira RAL barve prahu">
            <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Palette className="h-3 w-3" /> RAL:
            </span>
            <div className="flex flex-1 items-center gap-1.5">
              {RAL_COLORS.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => selectRal(r.code)}
                  aria-pressed={ral === r.code}
                  aria-label={`RAL ${r.code} ${r.name}`}
                  title={`RAL ${r.code} · ${r.name}`}
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                    ral === r.code
                      ? 'ring-2 ring-roksal-amber ring-offset-2 ring-offset-white'
                      : 'ring-1 ring-roksal-navy/15 hover:scale-110 hover:ring-roksal-navy/40'
                  }`}
                  style={{ backgroundColor: r.hex }}
                >
                  {r.code === '9016' && <span className="sr-only">bela</span>}
                  {ral === r.code && (
                    <CheckCircle2
                      className={`h-4 w-4 ${r.code === '9016' ? 'text-roksal-navy' : 'text-white'}`}
                      strokeWidth={3}
                    />
                  )}
                </button>
              ))}
              <span className="ml-auto rounded-md bg-roksal-navy/[0.06] px-2 py-1 text-right text-[9px] font-bold leading-tight text-roksal-navy">
                {activeRal.code}
                <span className="block font-medium text-muted-foreground">{activeRal.name}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2" role="group" aria-label="Postavitev v AR">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Postavitev:</span>
            <div className="flex flex-1 gap-1 rounded-xl bg-roksal-navy/[0.05] p-1">
              {([
                { id: 'wall' as Placement, label: 'Stena / rob', icon: PanelTop },
                { id: 'floor' as Placement, label: 'Tla', icon: Box },
              ]).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlacement(p.id)}
                  aria-pressed={placement === p.id}
                  className={`min-h-[36px] flex-1 rounded-lg px-2 text-[11px] font-semibold transition-all ${
                    placement === p.id
                      ? 'bg-roksal-navy text-white shadow'
                      : 'text-roksal-navy/60 hover:bg-white'
                  }`}
                >
                  <p.icon className="mr-1 inline h-3.5 w-3.5" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status AR dostopnosti */}
          <div className="flex items-start gap-2 rounded-lg bg-roksal-navy/[0.04] px-3 py-2 ring-1 ring-roksal-navy/10">
            {arAvailable === false ? (
              <>
                <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  AR gumb bo deloval na <strong className="text-roksal-navy">telefonu</strong> (Android: Scene Viewer · iPhone: Quick Look).
                  Na računalniku vrti 3D model s prstom/miško.
                </p>
              </>
            ) : (
              <>
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-roksal-navy/50" />
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Klikni <strong className="text-roksal-navy">„Poglej v prostoru“</strong> — Scene Viewer/Quick Look
                  namesti segment v pravi velikosti; stranka potrdi višino in barvo na mestu.
                </p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default Fence3dViewer
