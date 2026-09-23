'use client'

/**
 * VIZ — KORAK 2: IZDELEK — "MOJA OGRAJA" (runda S+2).
 * Predogled izdelka z SAMODEJNIM izrezom prek `cutoutProduct()` iz
 * src/lib/viz/pipeline (čisti TS, varen v brskalniku). Import je VAROVAN
 * (dinamičen + try/catch), ker pipeline.ts prinaša vzporedni agent S2-a —
 * do takrat pokažemo pravokoten (neizrezan) predogled. Izvoz maske: PNG
 * (belo = izdelek) v ločljivosti slike → POST /api/viz/stage (kind=productMask).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { Check, Replace, Loader2, WandSparkles, ArrowRight, PenTool, Camera, Images } from 'lucide-react'
import type { Corners, ImageBuffer } from '@/lib/viz/types'
import { cornerToPx } from '@/lib/viz/types'
import { friendlyError, LOADING_TEXT, stageImage } from './api'
import { MaskEditor } from './mask-editor'
import { toVizImage, useVizStore } from './viz-store'

const MAX_SIDE = 1600

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Slike ni mogoče naložiti.'))
    img.src = url
  })
}

/** Varovan dinamični import pipeline.ts (morda še ni spojen — S2-a vzporedno). */
async function tryLoadCutout(): Promise<((img: ImageBuffer, quadPx?: Corners | null) => { alpha: Float32Array; w: number; h: number }) | null> {
  try {
    // Predmetni specifier: tsc ne rešuje statično (pogodba dovoljuje izjemo),
    // paketnik pa ustvari kontekst mape src/lib/viz — ko pipeline.ts prispe,
    // izrez samodejno začne delovati brez sprememb tukaj.
    const mod = (await import(`@/lib/viz/${'pipeline'}`)) as {
      cutoutProduct?: (img: ImageBuffer, quadPx?: Corners | null) => { alpha: Float32Array; w: number; h: number }
    }
    return typeof mod?.cutoutProduct === 'function' ? mod.cutoutProduct : null
  } catch {
    return null
  }
}

/** Samodejni izrez → dataURL (prosojno ozadje) ali null (fallback: pravokoten prikaz). */
async function renderAutoCutout(url: string, productQuad: Corners | null): Promise<string | null> {
  const cutout = await tryLoadCutout()
  if (!cutout) return null
  const img = await loadHtmlImage(url)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  const buf: ImageBuffer = { data: ctx.getImageData(0, 0, w, h).data, w, h }
  const quadPx = productQuad ? cornerToPx(productQuad, w, h) : null
  const { alpha, w: aw, h: ah } = cutout(buf, quadPx)
  const out = document.createElement('canvas')
  out.width = aw
  out.height = ah
  const octx = out.getContext('2d')
  if (!octx) return null
  const outData = octx.createImageData(aw, ah)
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    outData.data[p] = buf.data[p]
    outData.data[p + 1] = buf.data[p + 1]
    outData.data[p + 2] = buf.data[p + 2]
    outData.data[p + 3] = Math.round(Math.min(1, Math.max(0, alpha[i])) * 255)
  }
  octx.putImageData(outData, 0, 0)
  return out.toDataURL('image/png')
}

export function StepProduct() {
  const product = useVizStore((s) => s.product)
  const productMask = useVizStore((s) => s.productMask)
  const productQuad = useVizStore((s) => s.productQuad)
  const setStep = useVizStore((s) => s.setStep)
  const setStaging = useVizStore((s) => s.setStaging)
  const setProduct = useVizStore((s) => s.setProduct)
  const setProductMask = useVizStore((s) => s.setProductMask)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const [stagingLocal, setStagingLocal] = useState(false)
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null)
  const [cutoutTried, setCutoutTried] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [savingMask, setSavingMask] = useState(false)

  // Samodejni izrez (ko pipeline.ts obstaja) — ob spremembi izdelka/quadra.
  useEffect(() => {
    if (!product) {
      setCutoutUrl(null)
      setCutoutTried(false)
      return
    }
    let cancelled = false
    setCutoutTried(false)
    renderAutoCutout(product.url, productQuad)
      .then((u) => {
        if (!cancelled) {
          setCutoutUrl(u)
          setCutoutTried(true)
        }
      })
      .catch(() => {
        if (!cancelled) setCutoutTried(true)
      })
    return () => {
      cancelled = true
    }
  }, [product, productQuad])

  const processFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
        toast({ title: 'Nepodprt format', description: 'Uporabi JPG, PNG ali WebP.', variant: 'destructive' })
        return
      }
      setStagingLocal(true)
      setStaging(true)
      try {
        // EXIF orientacija + pomanjšanje (isti postopek kot pri balkonu)
        let decoded: ImageBitmap | HTMLImageElement
        try {
          decoded = await createImageBitmap(file, { imageOrientation: 'from-image' })
        } catch {
          const u = URL.createObjectURL(file)
          const im = new Image()
          im.src = u
          await im.decode()
          decoded = im
          setTimeout(() => URL.revokeObjectURL(u), 5000)
        }
        const w = 'naturalWidth' in decoded ? decoded.naturalWidth : decoded.width
        const h = 'naturalHeight' in decoded ? decoded.naturalHeight : decoded.height
        const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(w * scale))
        canvas.height = Math.max(1, Math.round(h * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas ni na voljo.')
        ctx.drawImage(decoded, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
        if (!blob) throw new Error('Pretvorba v JPEG ni uspela.')
        const res = await stageImage(blob, 'product', 'product.jpg')
        setProduct(toVizImage(res))
        setProductMask(null) // nova fotografija → maska razveljavljena
      } catch (e) {
        console.error('product staging failed:', e)
        toast({
          title: 'Nalaganje ni uspelo',
          description: friendlyError(e, 'stage'),
          variant: 'destructive',
        })
      } finally {
        setStagingLocal(false)
        setStaging(false)
      }
    },
    [setProduct, setProductMask, setStaging],
  )

  const saveMask = useCallback(
    async (blob: Blob) => {
      if (!product) return
      setSavingMask(true)
      setStaging(true)
      try {
        const res = await stageImage(blob, 'productMask', 'product-mask.png')
        setProductMask({ ...toVizImage(res), edited: true })
        setEditorOpen(false)
        toast({ title: 'Maska izdelka shranjena ✓', description: 'Izrez bo upošteval tvoje oznake.' })
      } catch (e) {
        toast({
          title: 'Shranjevanje maske ni uspelo',
          description: e instanceof Error ? e.message : 'Poskusi znova.',
          variant: 'destructive',
        })
      } finally {
        setSavingMask(false)
        setStaging(false)
      }
    },
    [product, setProductMask, setStaging],
  )

  const busy = stagingLocal

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void processFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void processFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <header className="px-1">
        <h2 className="text-lg font-bold text-roksal-navy">Dodajte svojo ograjo</h2>
        <p className="text-xs leading-snug text-muted-foreground">
          Fotografirajte svojo ograjo ali izberite sliko — vzorec in barva izdelka ostajajo točno takšni, kot so.
        </p>
      </header>

      {!product ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-roksal-navy/10" aria-hidden="true">
              <WandSparkles className="h-7 w-7 text-roksal-navy" />
            </div>
            <p className="text-sm font-semibold text-roksal-navy">Naložite fotografijo ograje</p>
            <p className="text-xs text-muted-foreground">
              Najbolje po primeru: ograja čim bolj zapolni kader, čim manj okoliških predmetov.
            </p>
            <div className="mt-1 flex w-full flex-col gap-2">
              <Button
                type="button"
                className="h-14 bg-roksal-amber text-base font-bold text-white hover:bg-roksal-amber/90"
                onClick={() => cameraInputRef.current?.click()}
                disabled={busy}
                aria-label="Fotografiraj ograjo"
              >
                {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}
                {busy ? LOADING_TEXT.upload : 'Fotografiraj'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                aria-label="Izberi fotografijo iz galerije"
              >
                <Images className="mr-2 h-5 w-5" />
                Iz galerije
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-roksal-navy">VAŠA OGRAJA</p>
              {productMask?.edited ? (
                <Badge className="bg-roksal-amber/15 text-[10px] font-semibold text-roksal-amber hover:bg-roksal-amber/15">
                  Maska urejena ročno
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Samodejni izrez (predlog)
                </Badge>
              )}
            </div>

            <div
              className="flex items-center justify-center overflow-hidden rounded-xl border bg-secondary/40"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #e2e5ea 25%, transparent 25%, transparent 75%, #e2e5ea 75%), linear-gradient(45deg, #e2e5ea 25%, transparent 25%, transparent 75%, #e2e5ea 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 8px 8px',
              }}
            >
              { }
              <img
                src={cutoutUrl ?? product.url}
                alt="Fotografija izbrane ograje (izdelek)"
                className="max-h-[40vh] w-full object-contain"
                draggable={false}
              />
            </div>

            {/* POTRDITEV (spec §9) — "Ali je to prava ograja?" */}
            <div className="rounded-xl bg-roksal-navy/5 p-3 text-center">
              <p className="text-sm font-semibold text-roksal-navy">Ali je to prava ograja?</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                To bo vizualizirano na vašem balkonu.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-11 text-xs" onClick={() => inputRef.current?.click()} disabled={busy} aria-label="Zamenjaj fotografijo ograje">
                <Replace className="mr-1 h-4 w-4" />
                Zamenjaj
              </Button>
              <Button type="button" variant="outline" className="h-11 text-xs" onClick={() => setEditorOpen(true)} disabled={busy} aria-label="Uredi masko izdelka (napredno)">
                <PenTool className="mr-1 h-4 w-4" />
                Uredi masko
              </Button>
            </div>

            <p className="text-[11px] leading-snug text-muted-foreground">
              Maska: pobarvajte deli ograje, ki naj bodo vidne. Samodejni izrez je predlog —
              po navadi je zadosten.
              {cutoutTried && !cutoutUrl && !productMask?.edited && ' Predogled izreza ni na voljo — strežnik izreže samodejno.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Urejevalnik maske izdelka — celozaslonski dialog na mobitelu */}
      <Dialog open={editorOpen} onOpenChange={(o) => !savingMask && setEditorOpen(o)}>
        <DialogContent className="flex h-[100dvh] max-w-full flex-col gap-2 rounded-none p-3 sm:h-auto sm:max-h-[94dvh] sm:max-w-xl sm:rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Urejevalnik maske izdelka</DialogTitle>
          </DialogHeader>
          {product && (
            <MaskEditor
              key={`${product.url}-${productMask?.url ?? 'none'}`}
              imageUrl={product.url}
              initialMaskUrl={productMask?.url ?? null}
              polygonEnabled={false}
              title="Maska izdelka — pobarvaj deli ograje, ki naj bodo vidne"
              hint="Belo označena območja ostanejo vidna v vizualizaciji. Uporabi čopič za dodajanje, radirko za brisanje."
              saveLabel="Shrani masko"
              saving={savingMask}
              onSave={(blob) => void saveMask(blob)}
              onCancel={() => setEditorOpen(false)}
              className="min-h-0 flex-1"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Lepljiva akcija nad spodnjo navigacijo aplikacije */}
      <div className="sticky bottom-20 z-20 flex items-center gap-2 rounded-2xl border bg-background/95 p-2 shadow-sm backdrop-blur">
        <Button type="button" variant="ghost" className="h-11 flex-1" onClick={() => setStep(1)} aria-label="Nazaj na fotografijo balkona">
          ← Nazaj
        </Button>
        <Button
          type="button"
          className="h-11 flex-1 bg-roksal-amber font-semibold text-white hover:bg-roksal-amber/90"
          onClick={() => setStep(3)}
          disabled={!product}
          aria-label="Da, uporabi to ograjo in naprej"
        >
          <Check className="mr-1 h-4 w-4" />
          Da, uporabi
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
