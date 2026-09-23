'use client'

/**
 * VIZ — KORAK 3: STARA OGRAJA (runda S+2).
 * Ista komponenta urejevalnika maske kot pri izdelku, vendar VRSTI (brez
 * dialoga) in s POLIGONOM: tapni točke (≥3) → [Zapri poligon]; čopič/radirka
 * tudi. Izvoz → POST /api/viz/stage (kind=mask) je OBVEZEN, preden greš naprej.
 */

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { ArrowRight } from 'lucide-react'
import type { StageResult } from '@/lib/viz/types'
import { stageImage } from './api'
import { MaskEditor } from './mask-editor'
import { toVizImage, useVizStore } from './viz-store'

export function StepMask() {
  const balcony = useVizStore((s) => s.balcony)
  const mask = useVizStore((s) => s.mask)
  const setStep = useVizStore((s) => s.setStep)
  const setStaging = useVizStore((s) => s.setStaging)
  const setMask = useVizStore((s) => s.setMask)

  const [saving, setSaving] = useState(false)

  const saveMask = useCallback(
    async (blob: Blob) => {
      setSaving(true)
      setStaging(true)
      try {
        const res: StageResult = await stageImage(blob, 'mask', 'mask.png')
        setMask({ ...toVizImage(res), edited: true })
        toast({ title: 'Maska stare ograje shranjena ✓', description: 'To območje bo zamenjano z vašo ograjo.' })
      } catch (e) {
        toast({
          title: 'Shranjevanje maske ni uspelo',
          description: e instanceof Error ? e.message : 'Poskusi znova.',
          variant: 'destructive',
        })
      } finally {
        setSaving(false)
        setStaging(false)
      }
    },
    [setMask, setStaging],
  )

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h2 className="text-lg font-bold text-roksal-navy">Označite staro ograjo</h2>
        <p className="text-xs leading-snug text-muted-foreground">
          Povlecite s prstom čez območje stare ograje — to območje bo zamenjano z vašo novo ograjo.
        </p>
      </header>

      {balcony ? (
        <div className="h-[560px] max-h-[68vh] rounded-2xl border bg-white p-2 shadow-sm">
          <MaskEditor
            key={`${balcony.url}-${mask?.url ?? 'none'}`}
            imageUrl={balcony.url}
            initialMaskUrl={mask?.url ?? null}
            polygonEnabled
            title="Označi staro ograjo"
            hint="Poligon: tapni točke po obodu stare ograje (vsaj 3) in zapri poligon. Lahko tudi pobarvaš z Dodaj (čopič); Odstrani (radirka) popravi."
            saveLabel={mask ? 'Posodobi masko' : 'Shrani masko'}
            saving={saving}
            onSave={(blob) => void saveMask(blob)}
            className="h-full"
          />
        </div>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">Najprej naloži fotografijo balkona (korak 1).</p>
      )}

      {/* Lepljiva akcija nad spodnjo navigacijo aplikacije */}
      <div className="sticky bottom-20 z-20 flex items-center gap-2 rounded-2xl border bg-background/95 p-2 shadow-sm backdrop-blur">
        <Button type="button" variant="ghost" className="h-11 flex-1" onClick={() => setStep(2)} aria-label="Nazaj na izbiro izdelka">
          ← Nazaj
        </Button>
        <Button
          type="button"
          className="h-11 flex-1 bg-roksal-amber font-semibold text-white hover:bg-roksal-amber/90"
          onClick={() => setStep(4)}
          disabled={!mask}
          aria-label="Naprej na nastavitev 4 vogalov"
        >
          Naprej
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
