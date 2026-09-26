'use client'

/**
 * "Meri iz fotke" — AI ocena dimenzij ograje iz ene fotografije.
 *
 * Za telefone BREZ ARCore/WebXR (iPhone, starejši Android): monter fotografira
 * ograjo, VLM (glm-4.6v, samo strežnik) oceni dolžino/višino v mm s
 * referencami (vrata ~200 cm, ročaj ~90–110 cm …). Ocena je PREDLOG —
 * polji sta editabilni, monter popravi in shrani. Prikazan je zaupanje
 * (0–1) + izhodišče ocene, da je jasno, da ni "prave" meritve.
 *
 * Shranjevanje: POST /api/measurements z arMetadata.source='ai-photo'
 * (skoz offline vrsto — fetchWithQueue).
 */

import { useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Camera, Sparkles, Info, CheckCircle2, AlertTriangle } from 'lucide-react'
import { fetchWithQueue } from '@/lib/offline-queue'

interface OcenaMer {
  dolzinaMm: number
  visinaMm: number
  razmikStebrovMm: number | null
  izhodisce: string
  zaupanje: number
  opombe: string
}

function confidenceBadge(z: number) {
  if (z >= 0.7) return { label: 'visoko zaupanje', cls: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300' as const }
  if (z >= 0.45) return { label: 'srednje zaupanje', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300' as const }
  return { label: 'nizko zaupanje — izmeri ročno', cls: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300' as const }
}

export function PhotoMeasure({ projectId }: { projectId: string | null }) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ocena, setOcena] = useState<OcenaMer | null>(null)
  const [dolzina, setDolzina] = useState('')
  const [visina, setVisina] = useState('')

  async function handleFile(file: File) {
    // Pomanjšaj na max 1280px + JPEG ~0.8, da je base64 pod 6 MB
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const max = 1280
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        const ctx = c.getContext('2d')
        if (!ctx) { reject(new Error('Canvas ni na voljo')); return }
        ctx.drawImage(img, 0, 0, c.width, c.height)
        URL.revokeObjectURL(url)
        resolve(c.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Slike ni mogoče prebrati')) }
      img.src = url
    })
    setPreview(dataUrl)
    setOcena(null)
    void analyze(dataUrl)
  }

  async function analyze(dataUrl: string) {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/measure/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, projectId }),
      })
      const data = (await res.json()) as { ok?: boolean; ocena?: OcenaMer; error?: string }
      if (!res.ok || !data.ok || !data.ocena) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setOcena(data.ocena)
      setDolzina(String(data.ocena.dolzinaMm))
      setVisina(String(data.ocena.visinaMm))
      try { navigator.vibrate?.([30, 40, 30]) } catch { /* ignore */ }
      toast.success('✓ Ocena pripravljena', { description: 'Preveri in po potrebi popravi številki.' })
    } catch (err) {
      toast.error('AI ocena ni uspela', {
        description: err instanceof Error ? err.message : 'Neznana napaka',
      })
    } finally {
      setAnalyzing(false)
    }
  }

  async function save() {
    if (!projectId) {
      toast.error('Izberi projekt')
      return
    }
    const d = Math.round(parseFloat(dolzina))
    const v = Math.round(parseFloat(visina))
    if (!d || !v || d <= 0 || v <= 0) {
      toast.error('Vpiši veljavni dolžino in višino')
      return
    }
    setSaving(true)
    try {
      const res = await fetchWithQueue('/api/measurements', {
        body: {
          projectId,
          dolzinaMm: d,
          visinaMm: v,
          arMetadata: {
            source: 'ai-photo',
            zaupanje: ocena?.zaupanje ?? null,
            izhodisce: ocena?.izhodisce ?? null,
            razmikStebrovMm: ocena?.razmikStebrovMm ?? null,
            aiOpombe: ocena?.opombe ?? null,
            savedAt: new Date().toISOString(),
          },
        },
        label: `AI foto ocena ${d}×${v} mm`,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { queued?: boolean }
      try { navigator.vibrate?.([40, 30, 40]) } catch { /* ignore */ }
      if (data?.queued) {
        toast.info('📴 Ocena je v offline vrsti', { description: `Dolžina ${d} mm · višina ${v} mm` })
      } else {
        toast.success('✓ Mera shranjena', { description: `Dolžina ${d} mm · višina ${v} mm` })
      }
      setPreview(null)
      setOcena(null)
      setDolzina('')
      setVisina('')
    } catch (err) {
      toast.error('Shranjevanje ni uspelo', {
        description: err instanceof Error ? err.message : 'Neznana napaka',
      })
    } finally {
      setSaving(false)
    }
  }

  const conf = ocena ? confidenceBadge(ocena.zaupanje) : null

  return (
    <Card className="card-hover transition-all duration-200 animate-fade-in-up border-violet-200/60 dark:border-violet-800/60">
      <CardContent className="px-4 py-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 shrink-0 border border-violet-200 dark:border-violet-800">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-roksal-ink">Meri iz fotke (AI ocena)</p>
              <p className="text-[10px] text-muted-foreground truncate">
                Fotka → ocena dolžine/višine — brez ARCore, tudi za iPhone
              </p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={analyzing}
            className="h-8 px-3 text-[11px] border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40"
          >
            {analyzing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Camera className="mr-1 h-3.5 w-3.5" />}
            {analyzing ? 'Ocenjujem…' : 'Fotografiraj'}
          </Button>
        </div>

        {preview && (
          <div className="mt-3 flex gap-3">
            <img
              src={preview}
              alt="Fotografija ograje za AI oceno mer"
              className="h-20 w-28 rounded-lg border border-border object-cover shrink-0"
            />
            {analyzing && (
              <div className="flex flex-1 items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
                AI meri iz fotke… (nekaj sekund)
              </div>
            )}
          </div>
        )}

        {ocena && !analyzing && (
          <div className="mt-3 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {conf && <Badge className={`text-[9px] px-2 py-0.5 ${conf.cls}`}>{conf.label}</Badge>}
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Info className="h-3 w-3" />
                izhodišče: {ocena.izhodisce}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-medium">Dolžina (mm)</Label>
                <Input
                  type="number"
                  value={dolzina}
                  onChange={(e) => setDolzina(e.target.value)}
                  className="h-9 font-mono text-sm"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-medium">Višina (mm)</Label>
                <Input
                  type="number"
                  value={visina}
                  onChange={(e) => setVisina(e.target.value)}
                  className="h-9 font-mono text-sm"
                  inputMode="numeric"
                />
              </div>
            </div>

            {ocena.opombe && (
              <div className="flex items-start gap-1.5 rounded-lg bg-secondary/60 p-2 text-[10px] text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="line-clamp-2">{ocena.opombe}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => void save()}
                disabled={saving || !projectId}
                size="sm"
                className="min-h-[40px] flex-1 bg-roksal-navy text-white hover:bg-roksal-navy/90"
              >
                {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                Dodaj v meritve
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[40px]"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="mr-1 h-3.5 w-3.5" /> Znova
              </Button>
            </div>
            {!projectId && (
              <p className="text-center text-[9px] text-amber-600 dark:text-amber-400">Za shranjevanje izberi projekt.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
