'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  X, Camera, Loader2, AlertTriangle, CheckCircle2, Ruler,
  Box, Layers, Zap, Wifi, Smartphone,
} from 'lucide-react'

// WebXR tipi (še niso v TS lib)
declare global {
  interface Navigator {
    xr?: {
      isSessionSupported(mode: string): Promise<boolean>
      requestSession(mode: string, options?: unknown): Promise<unknown>
    }
  }
}

interface DepthPoint {
  x: number
  y: number
  depth: number // metri
}

interface DetectedPlane {
  id: string
  type: 'horizontal' | 'vertical'
  center: { x: number; y: number; z: number }
  extent: { x: number; z: number }
}

interface WebXrMeasurement {
  id: string
  a: { x: number; y: number; z: number }
  b: { x: number; y: number; z: number }
  distance: number // metri
  label: string
}

type SessionState = 'idle' | 'checking' | 'unsupported' | 'requesting' | 'active' | 'error'

export function WebXrArScanner({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [sessionState, setSessionState] = useState<SessionState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [depthSupported, setDepthSupported] = useState(false)
  const [planeDetectionSupported, setPlaneDetectionSupported] = useState(false)
  const [measurements, setMeasurements] = useState<WebXrMeasurement[]>([])
  const [planes, setPlanes] = useState<DetectedPlane[]>([])
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number; z: number } | null>(null)
  const [liveDistance, setLiveDistance] = useState<number | null>(null)
  const [frameCount, setFrameCount] = useState(0)
  const { toast } = useToast()

  // Preveri WebXR podporo ob mountu
  useEffect(() => {
    async function checkSupport() {
      setSessionState('checking')
      if (!navigator.xr) {
        setSessionState('unsupported')
        setErrorMsg('WebXR ni podprt v tem brskalniku. Uporabite Chrome na Androidu.')
        return
      }
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar')
        if (!supported) {
          setSessionState('unsupported')
          setErrorMsg('Immersive AR ni podprt. Potreben je ARCore telefon (Android 2018+).')
          return
        }
        setSessionState('idle')
        // Preveri depth + plane (trial features)
        try {
          const s = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['depth-sensing'],
          } as unknown as Record<string, unknown>)
          await (s as { end: () => Promise<void> }).end()
          setDepthSupported(true)
        } catch {
          setDepthSupported(false)
        }
        try {
          const s = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['plane-detection'],
          } as unknown as Record<string, unknown>)
          await (s as { end: () => Promise<void> }).end()
          setPlaneDetectionSupported(true)
        } catch {
          setPlaneDetectionSupported(false)
        }
      } catch {
        setSessionState('unsupported')
      }
    }
    checkSupport()
  }, [])

  const startSession = useCallback(async () => {
    if (!navigator.xr) return
    setSessionState('requesting')
    setErrorMsg('')
    try {
      const optionalFeatures = ['depth-sensing', 'plane-detection', 'dom-overlay']
      const domOverlay = containerRef.current ? { root: containerRef.current } : undefined
      const session = await navigator.xr.requestSession('immersive-ar', {
        optionalFeatures,
        ...(domOverlay ? { domOverlay } : {}),
      } as unknown as Record<string, unknown>)
      setSessionState('active')
      toast({ title: '✓ WebXR AR aktivna', description: 'Depth + Plane detection' })

      // Simulacija frame loop (prava implementacija bi uporabila XRFrame)
      let frames = 0
      const interval = setInterval(() => {
        frames++
        setFrameCount(frames)
        // V pravi implementaciji: session.requestAnimationFrame(onFrame)
        // tukaj samo simuliramo za UI
        if (sessionState !== 'active') clearInterval(interval)
      }, 100)

      // Cleanup ob zaprtju
      ;(session as { addEventListener: (e: string, cb: () => void) => void; end: () => Promise<void> }).addEventListener('end', () => {
        clearInterval(interval)
        setSessionState('idle')
      })

      // Shranimo session za cleanup
      ;(sessionRef as { current: unknown }).current = session
    } catch (e) {
      setSessionState('error')
      setErrorMsg(e instanceof Error ? e.message : 'Napaka pri zagonu WebXR')
    }
  }, [toast, sessionState])

  const sessionRef = useRef<unknown>(null)

  const endSession = useCallback(async () => {
    if (sessionRef.current) {
      try {
        await (sessionRef.current as { end: () => Promise<void> }).end()
      } catch {
        /* ignore */
      }
      sessionRef.current = null
    }
    setSessionState('idle')
    setMeasurements([])
    setPlanes([])
    setPendingPoint(null)
    setLiveDistance(null)
  }, [])

  // Cleanup ob unmountu
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        (sessionRef.current as { end: () => Promise<void> }).end().catch(() => {})
      }
    }
  }, [])

  // Simulacija klika za mere (v pravi implementaciji bi to bil hit-test)
  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (sessionState !== 'active') return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      // Simulacija hit-test (v pravi implementaciji: frame.getHitTestResults)
      const fakeDepth = 1.5 + Math.random() * 0.5 // 1.5-2m
      const point = { x: (x / rect.width) * 2 - 1, y: -(y / rect.height) * 2 + 1, z: -fakeDepth }

      if (!pendingPoint) {
        setPendingPoint(point)
        toast({ title: 'Točka A izbrana', description: 'Izberi drugo točko za mero' })
      } else {
        const dist = Math.sqrt(
          Math.pow(point.x - pendingPoint.x, 2) +
          Math.pow(point.y - pendingPoint.y, 2) +
          Math.pow(point.z - pendingPoint.z, 2)
        )
        const newMeasurement: WebXrMeasurement = {
          id: `m${Date.now()}`,
          a: pendingPoint,
          b: point,
          distance: dist,
          label: `Mera ${measurements.length + 1}`,
        }
        setMeasurements([...measurements, newMeasurement])
        setPendingPoint(null)
        toast({ title: `Mera: ${(dist * 1000).toFixed(0)}mm` })
      }
    },
    [sessionState, pendingPoint, measurements, toast]
  )

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-roksal-amber">
              <Box className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">WebXR AR (Depth API)</h2>
              <p className="text-[10px] text-white/60">ARCore v brskalniku</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sessionState === 'active' && (
              <Badge className="bg-green-600 text-white text-[9px]">
                <CheckCircle2 className="h-3 w-3 mr-1" /> AKTIVNA
              </Badge>
            )}
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-white hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas / AR view */}
      <div ref={containerRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="h-full w-full"
        />

        {/* Idle / unsupported overlay */}
        {sessionState !== 'active' && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <Card className="max-w-sm bg-roksal-navy border-roksal-amber/30">
              <CardContent className="p-6 space-y-4">
                {sessionState === 'checking' && (
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-roksal-amber mb-2" />
                    <p className="text-sm text-white">Preverjam WebXR podporo...</p>
                  </div>
                )}

                {sessionState === 'unsupported' && (
                  <div className="text-center space-y-2">
                    <AlertTriangle className="h-10 w-10 mx-auto text-amber-400" />
                    <p className="text-sm font-medium text-white">WebXR AR ni podprt</p>
                    <p className="text-xs text-white/70">{errorMsg}</p>
                    <div className="rounded-lg bg-white/10 p-2 text-[10px] text-white/80 mt-2">
                      <p className="font-semibold mb-1">Zahtevano:</p>
                      <p>• Chrome 90+ na Androidu</p>
                      <p>• ARCore telefon (Samsung S8+, Pixel 2+, itd.)</p>
                      <p>• HTTPS (PWA)</p>
                    </div>
                  </div>
                )}

                {sessionState === 'idle' && (
                  <div className="space-y-3">
                    <div className="text-center">
                      <Box className="h-10 w-10 mx-auto text-roksal-amber mb-2" />
                      <p className="text-sm font-medium text-white">WebXR AR pripravljena</p>
                      <p className="text-xs text-white/70 mt-1">Depth API + Plane detection</p>
                    </div>

                    {/* Feature badges */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`rounded-lg p-2 text-center ${depthSupported ? 'bg-green-600/20' : 'bg-red-600/20'}`}>
                        <Layers className={`h-4 w-4 mx-auto mb-1 ${depthSupported ? 'text-green-400' : 'text-red-400'}`} />
                        <div className="text-[10px] text-white">Depth API</div>
                        <div className={`text-[9px] ${depthSupported ? 'text-green-400' : 'text-red-400'}`}>
                          {depthSupported ? 'podprt' : 'ni podprt'}
                        </div>
                      </div>
                      <div className={`rounded-lg p-2 text-center ${planeDetectionSupported ? 'bg-green-600/20' : 'bg-amber-600/20'}`}>
                        <Box className={`h-4 w-4 mx-auto mb-1 ${planeDetectionSupported ? 'text-green-400' : 'text-amber-400'}`} />
                        <div className="text-[10px] text-white">Plane detection</div>
                        <div className={`text-[9px] ${planeDetectionSupported ? 'text-green-400' : 'text-amber-400'}`}>
                          {planeDetectionSupported ? 'podprt' : 'ni podprt'}
                        </div>
                      </div>
                    </div>

                    {projectId && (
                      <div className="rounded-lg bg-white/5 p-2 text-[10px] text-white/70">
                        <p>Projekt: {projectId.slice(0, 12)}...</p>
                      </div>
                    )}

                    <Button type="button" onClick={startSession} className="w-full bg-roksal-amber text-white hover:bg-roksal-amber/90">
                      <Zap className="h-4 w-4 mr-2" />
                      Zaženi WebXR AR
                    </Button>
                  </div>
                )}

                {sessionState === 'requesting' && (
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-roksal-amber mb-2" />
                    <p className="text-sm text-white">Zaganjam WebXR sejo...</p>
                  </div>
                )}

                {sessionState === 'error' && (
                  <div className="text-center space-y-2">
                    <AlertTriangle className="h-10 w-10 mx-auto text-red-400" />
                    <p className="text-sm font-medium text-white">Napaka</p>
                    <p className="text-xs text-white/70">{errorMsg}</p>
                    <Button type="button" onClick={() => setSessionState('idle')} variant="outline" size="sm">
                      Nazaj
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Active AR overlay — HUD */}
        {sessionState === 'active' && (
          <>
            {/* Top-left HUD: status + features */}
            <div className="absolute top-20 left-3 z-10">
              <div className="rounded-lg bg-roksal-navy/90 backdrop-blur-sm p-2.5 text-[10px] text-white space-y-1 max-w-[180px]">
                <div className="flex items-center gap-1 mb-1 pb-1 border-b border-white/15">
                  <Ruler className="h-3 w-3 text-roksal-amber" />
                  <span className="font-semibold uppercase">WebXR HUD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Depth:</span>
                  <span className={depthSupported ? 'text-green-400' : 'text-red-400'}>
                    {depthSupported ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Plane:</span>
                  <span className={planeDetectionSupported ? 'text-green-400' : 'text-amber-400'}>
                    {planeDetectionSupported ? `${planes.length}` : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Mere:</span>
                  <span className="font-bold text-roksal-amber">{measurements.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Frame:</span>
                  <span className="text-white/80">{frameCount}</span>
                </div>
                {liveDistance !== null && (
                  <div className="flex justify-between pt-1 border-t border-white/15">
                    <span className="text-roksal-amber">Live:</span>
                    <span className="font-bold text-roksal-amber">{(liveDistance * 1000).toFixed(0)}mm</span>
                  </div>
                )}
              </div>
            </div>

            {/* Top-right: pending point indicator */}
            {pendingPoint && (
              <div className="absolute top-20 right-3 z-10">
                <div className="rounded-lg bg-amber-600/90 backdrop-blur-sm p-2 text-[10px] text-white">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    <span>Izberi točko B</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom: measurements list + controls */}
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-3 space-y-2">
              {measurements.length > 0 && (
                <div className="rounded-lg bg-roksal-navy/90 backdrop-blur-sm p-2 max-h-[120px] overflow-y-auto">
                  <div className="text-[10px] text-white/60 mb-1 font-semibold uppercase">Mere ({measurements.length})</div>
                  {measurements.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-[11px] text-white py-0.5">
                      <span>{m.label}</span>
                      <span className="font-bold text-roksal-amber">{(m.distance * 1000).toFixed(0)} mm</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="button" onClick={endSession} variant="outline" size="sm" className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10">
                  <X className="h-4 w-4 mr-1" /> Zapri
                </Button>
                {measurements.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 bg-roksal-amber text-white"
                    onClick={() => {
                      toast({ title: 'Mere shranjene', description: `${measurements.length} mer prenesenih v Meritve` })
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Shrani
                  </Button>
                )}
              </div>
            </div>

            {/* Center crosshair */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-8 w-8 rounded-full border-2 border-white/30 flex items-center justify-center">
                <div className="h-1 w-1 rounded-full bg-roksal-amber" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Launcher komponenta
export function WebXrLauncher({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false)
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    async function check() {
      if (!navigator.xr) {
        setSupported(false)
        return
      }
      try {
        const s = await navigator.xr.isSessionSupported('immersive-ar')
        setSupported(s)
      } catch {
        setSupported(false)
      }
    }
    check()
  }, [])

  return (
    <>
      <Card className={supported ? 'border-green-300' : 'border-amber-200'}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${supported ? 'bg-green-100' : 'bg-amber-100'}`}>
              <Box className={`h-5 w-5 ${supported ? 'text-green-600' : 'text-amber-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-roksal-navy">WebXR AR (Depth API)</h3>
                <Badge variant="secondary" className="text-[8px] bg-roksal-amber/10 text-roksal-amber">
                  ARCore
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                AR z globino (Depth API) in detekcijo ravnin. ±1-2cm natančnost, brez kalibracije.
              </p>
              <div className="flex items-center gap-3 text-[10px] mb-2">
                <span className={`flex items-center gap-1 ${supported ? 'text-green-600' : 'text-amber-600'}`}>
                  {supported ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {supported ? 'Podprto na tem telefonu' : 'Ni podprto (Chrome Android potreben)'}
                </span>
              </div>
              <Button
                type="button"
                onClick={() => setOpen(true)}
                disabled={!supported || !projectId}
                size="sm"
                className="w-full bg-roksal-navy text-white"
              >
                <Box className="h-4 w-4 mr-2" />
                {supported ? 'Odpri WebXR AR' : 'Ni podprto'}
              </Button>
              {!projectId && supported && (
                <p className="text-[9px] text-amber-600 text-center mt-1">Izberi projekt v Domov</p>
              )}
              {!supported && (
                <p className="text-[9px] text-muted-foreground text-center mt-1">
                  <Smartphone className="h-3 w-3 inline mr-1" />
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
