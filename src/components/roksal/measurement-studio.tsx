'use client'

/**
 * MERILNI STUDIO (issue #2) — deterministično merjenje balkona BREZ AI.
 *
 * - Vir slike: nalaganje datoteke ALI kamera (getUserMedia → canvas → JPEG ≤1280 px, q 0.85).
 * - Zavihka "Samodejno" (POST /api/measurement/detect + overlay zaznanih črt) in
 *   "Ročno" (klik točk: referenca → spodnja linija → zgornja linija → stebri).
 * - Referenčna mera (2 točki + znana mm) je OBVEZNA za absolutne dimenzije —
 *   sistem NIKOLI ne izmišljuje merila (SCALE_REQUIRED = pravilno vedenje).
 * - IZRAČUNAJ MERITEV → POST /api/measurement/confirm (session, takeoffPreview,
 *   layout, savedMeasurementId) — isti rezultatni panel za OBA načina.
 * - Tipizacija rut je LOKALNA (interface); iz '@/lib/measurement' samo TYPE import.
 *
 * Kontrakt: export function MeasurementStudio({ projectId }: { projectId?: string | null })
 * Komponenta NE registrira lastnih zavihkov — vgradi jo page.tsx.
 */

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Crosshair,
  Info,
  Loader2,
  Package,
  Ruler,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'

// TYPE-only import iz merilnega SDK (issue #2) — brez strežniških modulov.
import type {
  DetectedFeatures,
  MeasurementGuidance,
  MeasurementQualityMetrics,
  MeasurementQualityState,
  MeasurementSession,
  NormPoint,
  ScaleSourceKind,
} from '@/lib/measurement'

// ── Lokalni kontrakti API rut (lokalno tipizirano — NE strežniški uvoz) ──────

/** Odgovor POST /api/measurement/detect */
interface DetectResponse {
  features: DetectedFeatures | null
  metrics: MeasurementQualityMetrics | null
  state: MeasurementQualityState
  guidance: MeasurementGuidance
  error?: string
}

/** Predračun materiala (iz fence-engine prek confirm) */
interface TakeoffPreview {
  boardCount: number
  boardsTotalLinearM: number
  postCount: number
  fieldSpanMm: number
  fenceHeightMm: number
  cutList: Array<{ index: number; cutMm: number }>
}

/** Layout povzetek (warnings so relevantna za UI) */
interface ConfirmLayout {
  boardCount: number
  fieldSpanMm: number
  fenceWidthMm: number
  fenceHeightMm: number
  orientation: 'horizontal' | 'vertical'
  warnings: string[]
}

/** Odgovor POST /api/measurement/confirm */
interface ConfirmResponse {
  session: MeasurementSession
  takeoffPreview: TakeoffPreview | null
  layout: ConfirmLayout | null
  savedMeasurementId: string | null
  error?: string
}

/** Izdelek iz GET /api/measurement/products */
interface ProductDefinition {
  id: string
  family: string
  profile: string
  orientations: string[]
  board: { minGapMm: number; maxGapMm: number }
  rights: string
}

/** Odgovor GET /api/measurement/products */
interface ProductsResponse {
  products: ProductDefinition[]
}

/** Telo zahtevka confirm (lokalni tip — zschema strežnika ga validira) */
interface ConfirmRequestBody {
  sessionId: string
  source: 'automatic' | 'manual'
  features?: DetectedFeatures | null
  metrics?: MeasurementQualityMetrics | null
  manual?: { path: NormPoint[]; top: NormPoint[]; posts?: NormPoint[] }
  reference: { p1: NormPoint; p2: NormPoint; knownMm: number; kind: ScaleSourceKind }
  manualCorrections: number
  confirmed: boolean
  projectId?: string
  geometry?: {
    productId: string
    orientation: 'horizontal' | 'vertical'
    gapMm: number
    postWidthMm: number
  }
}

// ── Pomožne konstante / oblike ───────────────────────────────────────────────

type StudioTab = 'auto' | 'manual'
type ManualStep = 'ref1' | 'ref2' | 'path' | 'top' | 'posts'

const MANUAL_STEPS: Array<{ id: ManualStep; label: string }> = [
  { id: 'ref1', label: 'Referenca P1' },
  { id: 'ref2', label: 'Referenca P2' },
  { id: 'path', label: 'Spodnja linija' },
  { id: 'top', label: 'Zgornja linija' },
  { id: 'posts', label: 'Stebri (opcijsko)' },
]

const REF_KIND_OPTIONS: Array<{ value: ScaleSourceKind; label: string }> = [
  { value: 'user-known-measure', label: 'Znana mera (uporabnik)' },
  { value: 'roksal-marker', label: 'Roksal marker' },
  { value: 'known-object', label: 'Znani objekt' },
]

/** Barvno kodirani stanji kakovosti (issue #2 §4). */
const STATE_BADGE: Record<MeasurementQualityState, { label: string; cls: string }> = {
  INSUFFICIENT_DATA: { label: 'INSUFFICIENT_DATA', cls: 'bg-red-100 text-red-800 border-red-300' },
  DETECTED: { label: 'DETECTED', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  SCALE_REQUIRED: { label: 'SCALE_REQUIRED', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  USER_REVIEW_REQUIRED: {
    label: 'USER_REVIEW_REQUIRED',
    cls: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  MEASUREMENT_READY: {
    label: 'MEASUREMENT_READY',
    cls: 'bg-green-100 text-green-800 border-green-300',
  },
  VERIFIED: { label: 'VERIFIED', cls: 'bg-green-600 text-white border-green-700' },
}

/** sessionId = korelacijski id klienta (crypto.randomUUID, ustvarjen ENKRAT). */
function createSessionId(): string {
  const c: Crypto | undefined = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // Fallback za okolja brez crypto.randomUUID (starejši brskalniki).
  return `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** Zaokroži na 2 decimalki in izpiši brez odvečnih ničel. */
function fmtNum(v: number): string {
  return String(Math.round(v * 100) / 100)
}

/** Decimalna metrika (0..1) → % */
function formatPct(v: number): string {
  return `${Math.round(v * 100)} %`
}

/** Normalizirana razdalja med referenčnima točkama v % slike. */
function referenceDistancePct(p1: NormPoint, p2: NormPoint): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y) * 100
}

function parseDec(input: string): number | null {
  const raw = input.trim().replace(',', '.')
  if (!raw) return null
  const v = Number(raw)
  return Number.isFinite(v) ? v : null
}

// ── Pod-komponente (skupni render za OBA načina) ─────────────────────────────

function StateBadge({ state, className }: { state: MeasurementQualityState; className?: string }) {
  const cfg = STATE_BADGE[state] ?? STATE_BADGE.INSUFFICIENT_DATA
  return (
    <Badge variant="outline" className={`text-[9px] ${cfg.cls} ${className ?? ''}`}>
      {cfg.label}
    </Badge>
  )
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-muted/40 p-1.5 text-center">
      <div className="text-sm font-bold text-roksal-ink">{value}</div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  )
}

/** Kakovostna plošča samodejne detekcije (stanje + objektivne metrike + vodenje). */
function QualityPanel({
  state,
  metrics,
  guidance,
  onSwitchToManual,
}: {
  state: MeasurementQualityState
  metrics: MeasurementQualityMetrics | null
  guidance: MeasurementGuidance
  onSwitchToManual: () => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-roksal-navy/15 dark:border-roksal-ink/15 bg-white p-3" role="status">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-roksal-ink">Kakovost detekcije</span>
        <StateBadge state={state} className="ml-auto" />
      </div>

      {metrics && (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <MetricCell label="Robovi (edgeDensity)" value={formatPct(metrics.edgeDensity)} />
          <MetricCell label="Podpora zgornje črte" value={formatPct(metrics.lineSupportTop)} />
          <MetricCell label="Podpora spodnje črte" value={formatPct(metrics.lineSupportBottom)} />
          <MetricCell label="Pokritost linije" value={formatPct(metrics.lineCoverage)} />
          <MetricCell label="Razmaki stebrov" value={formatPct(metrics.postSpacingConsistency)} />
          <MetricCell
            label={`Časovna stabilnost (${metrics.frames} fr.)`}
            value={formatPct(metrics.temporalStability)}
          />
        </div>
      )}

      <div className="space-y-0.5 text-[11px]">
        <p>
          <span className="text-muted-foreground">Vidi:</span> {guidance.seen}
        </p>
        {guidance.missing && (
          <p>
            <span className="text-muted-foreground">Manjka:</span> {guidance.missing}
          </p>
        )}
        <p>
          <span className="text-muted-foreground">Naslednji korak:</span> {guidance.nextAction}
        </p>
      </div>

      {state === 'INSUFFICIENT_DATA' && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-2 text-[11px] text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1 space-y-2">
            <p>Detekcija ni zadostna za samodejno merjenje (fail-safe issue #2).</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-[44px]"
              onClick={onSwitchToManual}
              aria-label="Preklopi na ročno meritev"
            >
              Preklopi na ročno meritev
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Referenčna mera — skupna za OBA načina (obvezna za absolutne mm). */
function ReferenceSection({
  refP1,
  refP2,
  knownMmInput,
  refKind,
  refLenOk,
  onKnownMmChange,
  onKindChange,
  onClearPoints,
}: {
  refP1: NormPoint | null
  refP2: NormPoint | null
  knownMmInput: string
  refKind: ScaleSourceKind
  refLenOk: boolean
  onKnownMmChange: (v: string) => void
  onKindChange: (v: ScaleSourceKind) => void
  onClearPoints: () => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-roksal-amber/30 bg-roksal-amber/5 p-3">
      <div className="flex items-center gap-2">
        <Crosshair className="h-4 w-4 text-roksal-amber" />
        <span className="text-sm font-semibold text-roksal-ink">
          Referenčna mera (obvezna za mm)
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Klikni 2 točki na sliki z znano dolžino in vpiši dolžino v mm. Brez veljavnega merila
        sistem NE izmišljuje dimenzij (vrne SCALE_REQUIRED).
      </p>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded bg-white p-1.5">
          <span className="text-muted-foreground">P1:</span>{' '}
          <span className="font-medium text-roksal-ink">
            {refP1 ? `${(refP1.x * 100).toFixed(1)} %, ${(refP1.y * 100).toFixed(1)} %` : '— klikni na sliki'}
          </span>
        </div>
        <div className="rounded bg-white p-1.5">
          <span className="text-muted-foreground">P2:</span>{' '}
          <span className="font-medium text-roksal-ink">
            {refP2 ? `${(refP2.x * 100).toFixed(1)} %, ${(refP2.y * 100).toFixed(1)} %` : '— klikni na sliki'}
          </span>
        </div>
      </div>

      {refP1 && refP2 && (
        <p className="text-[11px] text-roksal-ink" role="status">
          Izmerjena razdalja: <b>{referenceDistancePct(refP1, refP2).toFixed(1)} % slike</b>
          {!refLenOk && (
            <span className="ml-1 text-red-700">
              — preveč blizu; označi daljšo znano dolžino (najmanj 2 % slike).
            </span>
          )}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="ms-known-mm" className="text-[10px]">
            Znana dolžina (mm)
          </Label>
          <Input
            id="ms-known-mm"
            type="number"
            min={1}
            inputMode="decimal"
            value={knownMmInput}
            onChange={(e) => onKnownMmChange(e.target.value)}
            placeholder="npr. 1000"
            className="h-11 text-sm"
            aria-label="Znana dolžina reference v milimetrih"
          />
        </div>
        <div>
          <Label htmlFor="ms-ref-kind" className="text-[10px]">
            Vir mere
          </Label>
          <Select value={refKind} onValueChange={(v) => onKindChange(v as ScaleSourceKind)}>
            <SelectTrigger id="ms-ref-kind" className="h-11 text-sm" aria-label="Vir referenčne mere">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REF_KIND_OPTIONS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(refP1 || refP2) && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-[44px]"
          onClick={onClearPoints}
          aria-label="Počisti referenčni točki"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Počisti referenčni točki
        </Button>
      )}
    </div>
  )
}

/** Izbira izdelka (opcijsko — za takeoffPreview prek fence-engine). */
function ProductSection({
  products,
  productsError,
  productId,
  orientation,
  gapMm,
  postWidthMm,
  onProductChange,
  onOrientationChange,
  onGapChange,
  onPostWidthChange,
}: {
  products: ProductDefinition[]
  productsError: string | null
  productId: string
  orientation: 'horizontal' | 'vertical'
  gapMm: string
  postWidthMm: string
  onProductChange: (id: string) => void
  onOrientationChange: (o: 'horizontal' | 'vertical') => void
  onGapChange: (v: string) => void
  onPostWidthChange: (v: string) => void
}) {
  const selected = products.find((p) => p.id === productId) ?? null
  return (
    <div className="space-y-2 rounded-lg border border-border bg-white p-3">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-roksal-ink" />
        <span className="text-sm font-semibold text-roksal-ink">
          Izdelek (opcijsko — za predračun materiala)
        </span>
      </div>

      {productsError ? (
        <p className="text-[11px] text-amber-800">{productsError}</p>
      ) : products.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Katalog se nalaga …</p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="ms-product" className="text-[10px]">
                Izdelek
              </Label>
              <Select value={productId} onValueChange={onProductChange}>
                <SelectTrigger id="ms-product" className="h-11 text-sm" aria-label="Izberi izdelek">
                  <SelectValue placeholder="— brez izdelka (samo geometrija) —" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.family} · {p.profile}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ms-orientation" className="text-[10px]">
                Orientacija
              </Label>
              <Select
                value={orientation}
                onValueChange={(v) => onOrientationChange(v as 'horizontal' | 'vertical')}
                disabled={!selected}
              >
                <SelectTrigger id="ms-orientation" className="h-11 text-sm" aria-label="Izberi orientacijo letev">
                  <SelectValue placeholder="— izberi izdelek —" />
                </SelectTrigger>
                <SelectContent>
                  {(selected?.orientations ?? []).map((o) => (
                    <SelectItem key={o} value={o}>
                      {o === 'horizontal' ? 'Horizontalno' : 'Vertikalno'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ms-gap" className="text-[10px]">
                Razmak (mm)
              </Label>
              <Input
                id="ms-gap"
                type="number"
                min={0}
                max={200}
                value={gapMm}
                onChange={(e) => onGapChange(e.target.value)}
                className="h-11 text-sm"
                aria-label="Razmak med deskami v milimetrih"
              />
            </div>
            <div>
              <Label htmlFor="ms-post-width" className="text-[10px]">
                Širina stebra (mm)
              </Label>
              <Input
                id="ms-post-width"
                type="number"
                min={10}
                max={200}
                value={postWidthMm}
                onChange={(e) => onPostWidthChange(e.target.value)}
                className="h-11 text-sm"
                aria-label="Širina stebra v milimetrih"
              />
            </div>
          </div>

          {selected && (
            <p className="text-[10px] text-muted-foreground">
              Profil dovoljuje razmak {selected.board.minGapMm}–{selected.board.maxGapMm} mm ·
              brez izdelka je rezultat samo izmerjena geometrija.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** Rezultat meritve — SKUPNI panel za samodejni in ročni način. */
function ResultsSection({ result, error }: { result: ConfirmResponse | null; error: string | null }) {
  if (error) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-[11px] text-red-800"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }
  if (!result) return null

  const { session, takeoffPreview, layout, savedMeasurementId } = result
  const g = session.geometry

  return (
    <div className="space-y-3 rounded-lg border border-roksal-navy/15 dark:border-roksal-ink/15 bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-sm font-semibold text-roksal-ink">Rezultat meritve</span>
        <StateBadge state={session.quality.state} className="ml-auto" />
      </div>

      {/* Brez merila → SCALE_REQUIRED (pravilno vedenje, NE napaka) */}
      {!g && (
        <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-800">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            SCALE_REQUIRED — merilo ni bilo mogoče določiti
          </p>
          <p>Ni dimenzij — to je pravilno vedenje: sistem NE izmišljuje merila.</p>
          <p>
            <span className="text-muted-foreground">Vidi:</span> {session.quality.guidance.seen}
          </p>
          {session.quality.guidance.missing && (
            <p>
              <span className="text-muted-foreground">Manjka:</span> {session.quality.guidance.missing}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Naslednji korak:</span>{' '}
            {session.quality.guidance.nextAction}
          </p>
        </div>
      )}

      {/* Izmerjena geometrija (samo ob veljavnem merilu) */}
      {g && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-white p-2.5 text-center">
              <Ruler className="mx-auto mb-1 h-4 w-4 text-roksal-ink" />
              <div className="text-lg font-bold text-roksal-ink">
                {(g.totalLengthMm.valueMm / 1000).toFixed(3)} m
              </div>
              <div className="text-[9px] text-muted-foreground">
                Dolžina · {fmtNum(g.totalLengthMm.valueMm)} ± {fmtNum(g.totalLengthMm.uncertaintyMm)} mm
              </div>
            </div>
            <div className="rounded-lg border border-border bg-white p-2.5 text-center">
              <Ruler className="mx-auto mb-1 h-4 w-4 text-roksal-ink" />
              <div className="text-lg font-bold text-roksal-ink">{fmtNum(g.heightMm.valueMm)} mm</div>
              <div className="text-[9px] text-muted-foreground">
                Višina · ± {fmtNum(g.heightMm.uncertaintyMm)} mm
              </div>
            </div>
          </div>

          {/* Segments tabela */}
          <div className="overflow-x-auto rounded-lg border border-border bg-white p-2">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">Odsek</th>
                  <th className="py-1 pr-2 font-medium">Dolžina (mm)</th>
                  <th className="py-1 pr-2 font-medium">Negotovost (± mm)</th>
                  <th className="py-1 font-medium">Začetek (mm)</th>
                </tr>
              </thead>
              <tbody>
                {g.segments.map((s) => (
                  <tr key={s.index} className="border-b border-border/40 last:border-0">
                    <td className="py-1 pr-2">{s.index + 1}</td>
                    <td className="py-1 pr-2 font-medium text-roksal-ink">{fmtNum(s.lengthMm)}</td>
                    <td className="py-1 pr-2">± {fmtNum(s.uncertaintyMm)}</td>
                    <td className="py-1">{fmtNum(s.startMm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stebri */}
          <div className="rounded-lg border border-border bg-white p-2.5 text-[11px]">
            <span className="font-semibold text-roksal-ink">Stebri: {g.postCount}</span>
            {g.postPositionsMm.length > 0 && (
              <p className="text-muted-foreground">
                Položaji (mm od začetka): {g.postPositionsMm.map((p) => fmtNum(p)).join(', ')}
              </p>
            )}
            <p className="text-muted-foreground">
              Konsistentnost razmakov: {formatPct(g.postSpacingConsistency)}
            </p>
          </div>

          {/* Sledljivost (provenance) */}
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <p className="flex items-start gap-1">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{g.totalLengthMm.provenance}</span>
            </p>
            <p className="flex items-start gap-1">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{g.heightMm.provenance}</span>
            </p>
            {session.scale && (
              <p className="flex items-start gap-1">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  Merilo: {fmtNum(session.scale.reference.knownMm)} mm ↔{' '}
                  {(session.scale.referenceLengthUnits * 100).toFixed(1)} % slike (vir:{' '}
                  {REF_KIND_OPTIONS.find((k) => k.value === session.scale?.reference.kind)?.label ??
                    session.scale.reference.kind}
                  )
                </span>
              </p>
            )}
          </div>
        </>
      )}

      {/* Predračun materiala (samo če je bil poslan geometry) */}
      {takeoffPreview && (
        <div className="space-y-2 rounded-lg border border-roksal-amber/40 bg-roksal-amber/5 p-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-roksal-amber" />
            <span className="text-sm font-semibold text-roksal-ink">
              Predračun materiala (iz geometrije)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded bg-white p-1.5">
              <div className="text-base font-bold text-roksal-ink">{takeoffPreview.boardCount}</div>
              <div className="text-[9px] text-muted-foreground">Deske</div>
            </div>
            <div className="rounded bg-white p-1.5">
              <div className="text-base font-bold text-roksal-ink">
                {takeoffPreview.boardsTotalLinearM.toFixed(2)}
              </div>
              <div className="text-[9px] text-muted-foreground">Linearni m</div>
            </div>
            <div className="rounded bg-white p-1.5">
              <div className="text-base font-bold text-roksal-ink">{takeoffPreview.postCount}</div>
              <div className="text-[9px] text-muted-foreground">Stebri</div>
            </div>
          </div>
          {takeoffPreview.cutList.length > 0 && (
            <p className="text-[11px]">
              <span className="text-muted-foreground">Dolžine rezov:</span>{' '}
              {takeoffPreview.cutList.map((c) => `#${c.index + 1}: ${fmtNum(c.cutMm)} mm`).join(' · ')}
            </p>
          )}
          {layout?.warnings && layout.warnings.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800">
              {layout.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shranjeno v projekt */}
      {savedMeasurementId && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-2.5 text-[11px] font-medium text-green-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Meritev shranjena v projekt (ID: {savedMeasurementId})
        </div>
      )}
    </div>
  )
}

// ── Glavna komponenta ────────────────────────────────────────────────────────

export function MeasurementStudio({ projectId }: { projectId?: string | null }) {
  const { toast } = useToast()

  // Identifikator seje — ENKRAT ob mountu (korelacijski id za confirm).
  const [sessionId] = useState<string>(createSessionId)
  const [tab, setTab] = useState<StudioTab>('auto')

  // ── Vir slike + kamera ──
  const [imageData, setImageData] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Samodejni način ──
  const [detecting, setDetecting] = useState(false)
  const [autoResult, setAutoResult] = useState<DetectResponse | null>(null)
  const [detectError, setDetectError] = useState<string | null>(null)

  // ── Ročni način ──
  const [activeStep, setActiveStep] = useState<ManualStep>('ref1')
  const [manualPath, setManualPath] = useState<NormPoint[]>([])
  const [manualTop, setManualTop] = useState<NormPoint[]>([])
  const [manualPosts, setManualPosts] = useState<NormPoint[]>([])

  // ── Referenčna mera (skupna) ──
  const [refP1, setRefP1] = useState<NormPoint | null>(null)
  const [refP2, setRefP2] = useState<NormPoint | null>(null)
  const [knownMmInput, setKnownMmInput] = useState('')
  const [refKind, setRefKind] = useState<ScaleSourceKind>('user-known-measure')

  // ── Katalog izdelkov ──
  const [products, setProducts] = useState<ProductDefinition[]>([])
  const [productsError, setProductsError] = useState<string | null>(null)
  const [productId, setProductId] = useState('')
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal')
  const [gapMm, setGapMm] = useState('30')
  const [postWidthMm, setPostWidthMm] = useState('60')

  // ── Potrditev ──
  const [confirming, setConfirming] = useState(false)
  const [confirmResult, setConfirmResult] = useState<ConfirmResponse | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // ── Overlay (canvas natanko čez prikazano sliko) ──
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [overlaySize, setOverlaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  // ── Izračunane vrednosti ──
  const knownMm = parseDec(knownMmInput)
  const knownMmValid = knownMm !== null && knownMm >= 1
  const refLenUnits = refP1 && refP2 ? Math.hypot(refP2.x - refP1.x, refP2.y - refP1.y) : 0
  const refLenOk = refLenUnits >= 0.02 // strežnik zahteva ≥ 2 % slike
  const referenceReady = refP1 !== null && refP2 !== null && knownMmValid && refLenOk
  const manualTopMatches = manualTop.length === manualPath.length
  const canCompute =
    imageData !== null &&
    referenceReady &&
    (tab === 'auto'
      ? autoResult?.features != null
      : manualPath.length >= 2 && manualTopMatches)

  const computeHint = !imageData
    ? 'Najprej izberite ali posnemite sliko.'
    : !refP1 || !refP2
      ? 'Označite 2 referenčni točki na sliki (rdeči markerja).'
      : !knownMmValid
        ? 'Vpišite znano dolžino v mm (najmanj 1).'
        : !refLenOk
          ? 'Referenčni točki sta preveč blizu (najmanj 2 % slike).'
          : tab === 'auto' && autoResult?.features == null
            ? 'Detekcija ni zaznala ograje — preklopite na ročni način.'
            : tab === 'manual' && manualPath.length < 2
              ? 'Ročno: dodajte vsaj 2 točki spodnje linije.'
              : tab === 'manual' && !manualTopMatches
                ? 'Zgornja linija mora imeti enako število točk kot spodnja.'
                : null

  // ── Kamera: stream je ziva nastavitev; počisti ob unmountu ──
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/measurement/products', { credentials: 'include' })
        if (!res.ok) throw new Error(`products ${res.status}`)
        const data = (await res.json()) as ProductsResponse
        if (!cancelled) setProducts(data.products ?? [])
      } catch {
        if (!cancelled)
          setProductsError('Katalog izdelkov ni dosegljiv — predračun materiala bo preskočen.')
      }
    })()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [])

  // Poveži stream z video elementom, ko se kamera vklopi.
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraActive])

  // Sledi prikazani velikosti slike → overlay canvas natanko prekriva sliko.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || cameraActive || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r && r.width > 0 && r.height > 0) {
        setOverlaySize({ w: Math.round(r.width), h: Math.round(r.height) })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [imageData, cameraActive])

  // ── Overlay risanje (zaznane črte + ročne točke + referenca) ──
  useEffect(() => {
    drawOverlay()
  }, [
    overlaySize,
    autoResult,
    refP1,
    refP2,
    manualPath,
    manualTop,
    manualPosts,
    tab,
    imageData,
    cameraActive,
  ])

  function drawOverlay() {
    const canvas = canvasRef.current
    const { w, h } = overlaySize
    if (!canvas || w <= 0 || h <= 0) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const cw = Math.round(w * dpr)
    const ch = Math.round(h * dpr)
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // Pomožnik: zaporedje točk (kroga s številko + vezne črte).
    const drawSequence = (pts: NormPoint[], color: string, connect: boolean) => {
      if (pts.length === 0) return
      if (connect && pts.length > 1) {
        ctx.save()
        ctx.setLineDash([5, 4])
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.beginPath()
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h)))
        ctx.stroke()
        ctx.restore()
      }
      pts.forEach((p, i) => {
        const x = p.x * w
        const y = p.y * h
        ctx.beginPath()
        ctx.arc(x, y, 9, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), x, y + 0.5)
      })
    }

    // ── SAMODEJNO: zaznane značilke ──
    if (tab === 'auto' && autoResult?.features) {
      const f = autoResult.features
      // runs — zelene horizontalne črte (yTop + yBottom)
      ctx.strokeStyle = '#16a34a'
      ctx.lineWidth = 3
      for (const run of f.runs) {
        for (const yn of [run.yTop, run.yBottom]) {
          ctx.beginPath()
          ctx.moveTo(run.x0 * w, yn * h)
          ctx.lineTo(run.x1 * w, yn * h)
          ctx.stroke()
        }
      }
      // posts — modre vertikalne črtice znotraj glavnega pasu
      const band = f.runs[0]
      const yTick0 = band ? band.yTop * h : h * 0.25
      const yTick1 = band ? band.yBottom * h : h * 0.75
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 3
      for (const p of f.posts) {
        ctx.beginPath()
        ctx.moveTo(p.x * w, yTick0)
        ctx.lineTo(p.x * w, yTick1)
        ctx.stroke()
      }
      // corners — oranžne točke
      if (f.corners) {
        ctx.fillStyle = '#f97316'
        for (const c of f.corners) {
          ctx.beginPath()
          ctx.arc(c.x * w, c.y * h, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // ── ROČNO: uporabniške točke (rumene/rožate + zaporedne številke) ──
    if (tab === 'manual') {
      // spodnja linija — rožata, povezana
      drawSequence(manualPath, '#ec4899', true)
      // zgornja linija — rumena, povezana
      drawSequence(manualTop, '#eab308', true)
      // stebri — rožato-vijolične kratke vertikalne črtice
      for (const p of manualPosts) {
        const x = p.x * w
        const y = p.y * h
        ctx.strokeStyle = '#be185d'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(x, y - 12)
        ctx.lineTo(x, y + 12)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, 7, 0, Math.PI * 2)
        ctx.fillStyle = '#be185d'
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()
      }
    }

    // ── Referenčna mera (OBA načina) — rdeči markerja + črta + razdalja v % ──
    const drawRefMarker = (p: NormPoint) => {
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, 7, 0, Math.PI * 2)
      ctx.fillStyle = '#dc2626'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
    }
    if (refP1) drawRefMarker(refP1)
    if (refP1 && refP2) {
      drawRefMarker(refP2)
      ctx.save()
      ctx.setLineDash([6, 4])
      ctx.strokeStyle = '#dc2626'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(refP1.x * w, refP1.y * h)
      ctx.lineTo(refP2.x * w, refP2.y * h)
      ctx.stroke()
      ctx.restore()

      // oznaka razdalje v %
      const label = `${referenceDistancePct(refP1, refP2).toFixed(1)} %`
      const mx = ((refP1.x + refP2.x) / 2) * w
      const my = ((refP1.y + refP2.y) / 2) * h
      ctx.font = 'bold 12px sans-serif'
      const textW = ctx.measureText(label).width
      const boxW = textW + 10
      const bx = mx + 8 + boxW > w ? mx - 8 - boxW : mx + 8
      const by = Math.min(Math.max(my - 18, 2), h - 20)
      ctx.fillStyle = 'rgba(220, 38, 38, 0.92)'
      ctx.fillRect(bx, by, boxW, 18)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, bx + 5, by + 9.5)
    }
  }

  // ── Nova slika: reset merilnega stanja + samodejna detekcija v auto načinu ──
  function applyNewImage(dataUrl: string) {
    setImageData(dataUrl)
    setAutoResult(null)
    setDetectError(null)
    setConfirmResult(null)
    setConfirmError(null)
    setRefP1(null)
    setRefP2(null)
    setManualPath([])
    setManualTop([])
    setManualPosts([])
    setActiveStep('ref1')
    setCameraError(null)
    setOverlaySize({ w: 0, h: 0 })
    if (tab === 'auto') void runDetect(dataUrl)
  }

  // ── Upload (pomanjšanje na maks. 1280 px, JPEG q 0.85) ──
  function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // dovoli ponovno izbiro iste datoteke
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
        const cw = Math.max(1, Math.round(img.width * scale))
        const ch = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setCameraError('Slike ni bilo mogoče obdelati.')
          return
        }
        ctx.drawImage(img, 0, 0, cw, ch)
        applyNewImage(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => setCameraError('Datoteke ni bilo mogoče prebrati kot sliko.')
      img.src = reader.result as string
    }
    reader.onerror = () => setCameraError('Branje datoteke ni uspelo.')
    reader.readAsDataURL(file)
  }

  // ── Kamera (getUserMedia; ob napaki jasen fallback na upload — brez crasha) ──
  async function startCamera() {
    setCameraError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
    } catch {
      setCameraActive(false)
      setCameraError('Kamera ni dosegljiva (dostop zavrnjen ali ni podprta). Uporabite nalaganje slike.')
      toast({
        title: 'Kamera ni dosegljiva',
        description: 'Preklopite na nalaganje slike.',
        variant: 'destructive',
      })
    }
  }

  function captureFrame() {
    const video = videoRef.current
    if (!video || !streamRef.current || video.videoWidth === 0) return
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight))
    const cw = Math.max(1, Math.round(video.videoWidth * scale))
    const ch = Math.max(1, Math.round(video.videoHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, cw, ch)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    stopCamera()
    applyNewImage(dataUrl)
  }

  function stopCamera() {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop()
      streamRef.current = null
    }
    setCameraActive(false)
  }

  // ── Samodejna detekcija (POST /api/measurement/detect) ──
  async function runDetect(img: string) {
    setDetecting(true)
    setDetectError(null)
    setAutoResult(null)
    try {
      const res = await fetch('/api/measurement/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageData: img }),
      })
      const data = (await res.json().catch(() => null)) as (DetectResponse & { error?: string }) | null
      if (!res.ok || !data) {
        setDetectError(data?.error ?? `Detekcija ni uspela (${res.status}).`)
        return
      }
      setAutoResult({
        features: data.features ?? null,
        metrics: data.metrics ?? null,
        state: data.state,
        guidance: data.guidance,
      })
    } catch {
      setDetectError('Omrežna napaka pri detekciji. Poskusite znova.')
    } finally {
      setDetecting(false)
    }
  }

  // ── Klik na sliko → normalizirana točka → odvisno od načina/koraka ──
  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const el = wrapRef.current
    if (!el || !imageData || cameraActive) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const nx = clamp01((e.clientX - rect.left) / rect.width)
    const ny = clamp01((e.clientY - rect.top) / rect.height)
    const pt: NormPoint = {
      x: Math.round(nx * 10000) / 10000,
      y: Math.round(ny * 10000) / 10000,
    }
    // nov klik pomeni novo merilno odločitev — stari rezultat ni več aktualen
    setConfirmResult(null)
    setConfirmError(null)

    if (tab === 'auto') {
      // samo referenčni točki: P1 → P2 → (nov klik) začni znova
      if (!refP1) setRefP1(pt)
      else if (!refP2) setRefP2(pt)
      else {
        setRefP1(pt)
        setRefP2(null)
      }
      return
    }

    switch (activeStep) {
      case 'ref1':
        setRefP1(pt)
        setActiveStep('ref2')
        break
      case 'ref2':
        setRefP2(pt)
        setActiveStep('path')
        break
      case 'path':
        setManualPath((arr) => (arr.length >= 24 ? arr : [...arr, pt]))
        break
      case 'top':
        setManualTop((arr) => (arr.length >= 24 ? arr : [...arr, pt]))
        break
      case 'posts':
        setManualPosts((arr) => (arr.length >= 48 ? arr : [...arr, pt]))
        break
    }
  }

  function undoLastPoint() {
    switch (activeStep) {
      case 'ref1':
        setRefP1(null)
        break
      case 'ref2':
        setRefP2(null)
        break
      case 'path':
        setManualPath((arr) => arr.slice(0, -1))
        break
      case 'top':
        setManualTop((arr) => arr.slice(0, -1))
        break
      case 'posts':
        setManualPosts((arr) => arr.slice(0, -1))
        break
    }
  }

  function clearAllPoints() {
    setRefP1(null)
    setRefP2(null)
    setManualPath([])
    setManualTop([])
    setManualPosts([])
    setActiveStep('ref1')
  }

  function handleTabChange(next: string) {
    if (next !== 'auto' && next !== 'manual') return
    setTab(next)
    setConfirmResult(null)
    setConfirmError(null)
    // preklop na Samodejno z obstoječo sliko brez rezultata → poženi detekcijo
    if (next === 'auto' && imageData && !autoResult && !detecting) void runDetect(imageData)
  }

  function handleProductChange(id: string) {
    setProductId(id)
    const p = products.find((x) => x.id === id)
    if (p && p.orientations.length > 0 && !p.orientations.includes(orientation)) {
      setOrientation(p.orientations[0] === 'vertical' ? 'vertical' : 'horizontal')
    }
  }

  // ── IZRAČUNAJ MERITEV (POST /api/measurement/confirm) ──
  async function handleConfirm() {
    if (!canCompute || !refP1 || !refP2 || knownMm === null) return

    const reference = { p1: refP1, p2: refP2, knownMm, kind: refKind }
    const manualCorrections =
      tab === 'manual' ? manualPath.length + manualTop.length + manualPosts.length : 0

    // geometry SAMO, če je uporabnik izbral izdelek (sicer rezultat = geometrija)
    let geometry: ConfirmRequestBody['geometry'] = undefined
    if (productId) {
      const gapNum = parseDec(gapMm)
      const pwNum = parseDec(postWidthMm)
      geometry = {
        productId,
        orientation,
        gapMm: gapNum === null ? 30 : Math.min(200, Math.max(0, Math.round(gapNum))),
        postWidthMm: pwNum === null ? 60 : Math.min(200, Math.max(10, Math.round(pwNum))),
      }
    }

    const body: ConfirmRequestBody =
      tab === 'auto'
        ? {
            sessionId,
            source: 'automatic',
            features: autoResult?.features ?? null,
            metrics: autoResult?.metrics ?? null,
            reference,
            manualCorrections,
            confirmed: true,
            projectId: projectId ?? undefined,
            geometry,
          }
        : {
            sessionId,
            source: 'manual',
            manual: {
              path: manualPath,
              top: manualTop,
              ...(manualPosts.length > 0 ? { posts: manualPosts } : {}),
            },
            reference,
            manualCorrections,
            confirmed: true,
            projectId: projectId ?? undefined,
            geometry,
          }

    setConfirming(true)
    setConfirmError(null)
    try {
      const res = await fetch('/api/measurement/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => null)) as (ConfirmResponse & { error?: string }) | null
      if (!res.ok) {
        // 422 s sejo (npr. SCALE_REQUIRED pri shranjevanju) — pokaži seanso tudi ob napaki
        if (data?.session) {
          setConfirmResult({
            session: data.session,
            takeoffPreview: data.takeoffPreview ?? null,
            layout: data.layout ?? null,
            savedMeasurementId: null,
          })
        }
        setConfirmError(data?.error ?? `Izračun ni uspel (${res.status}).`)
        return
      }
      if (!data) {
        setConfirmError('Neveljaven odgovor strežnika.')
        return
      }
      setConfirmResult(data)
      if (data.savedMeasurementId) {
        toast({
          title: 'Meritev shranjena v projekt',
          description: `Dolžina ${fmtNum(data.session.geometry?.totalLengthMm.valueMm ?? 0)} mm · ID: ${data.savedMeasurementId}`,
        })
      }
    } catch {
      setConfirmError('Omrežna napaka pri izračunu meritve.')
    } finally {
      setConfirming(false)
    }
  }

  const manualHint: Record<ManualStep, string> = {
    ref1: 'Klikni 1. referenčno točko (znana dolžina) na sliki.',
    ref2: 'Klikni 2. referenčno točko.',
    path: `Spodnja linija: klikni prelome balkona (2..n) — klikov: ${manualPath.length}.`,
    top: `Zgornja linija: klikni enako število točk kot spodaj (${manualTop.length}/${manualPath.length}).`,
    posts: `Stebri: klikni položaje (opcijsko) — klikov: ${manualPosts.length}.`,
  }

  return (
    <div className="space-y-4">
      <Card className="border-roksal-amber/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Ruler className="h-5 w-5 text-roksal-amber" />
            Merilni studio
            <Badge
              variant="secondary"
              className="ml-auto bg-roksal-navy/10 text-[9px] text-roksal-ink"
            >
              DETERMINISTIČNO · BREZ AI
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── 1 · VIR SLIKE ─────────────────────────────────────────────── */}
          {cameraActive ? (
            <div className="space-y-2">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg border border-border"
                aria-label="Predogled kamere"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={captureFrame}
                  className="min-h-[44px] bg-roksal-amber text-white hover:bg-roksal-amber/90"
                  aria-label="Zajemi fotografijo"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Zajemi
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopCamera}
                  className="min-h-[44px]"
                  aria-label="Prekliči zajem kamere"
                >
                  Prekliči
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={startCamera}
                  className="min-h-[44px] flex-col gap-1 border-roksal-navy/20 dark:border-roksal-ink/20"
                  aria-label="Odpri kamero za zajem slike"
                >
                  <Camera className="h-5 w-5 text-roksal-ink" />
                  <span className="text-xs">Kamera</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] flex-col gap-1 border-roksal-navy/20 dark:border-roksal-ink/20"
                  aria-label="Naloži sliko iz datoteke"
                >
                  <Upload className="h-5 w-5 text-roksal-ink" />
                  <span className="text-xs">Naloži sliko</span>
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadFile}
                aria-label="Izberi sliko za merjenje"
              />
              {cameraError && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>
          )}

          {/* Slika + overlay canvas (natanko čez prikazano sliko) */}
          {imageData && !cameraActive && (
            <div className="space-y-1.5">
              <div
                ref={wrapRef}
                onClick={handleImageClick}
                role="application"
                aria-label="Slika za merjenje — klik dodaja merilne točke"
                className="relative w-full cursor-crosshair select-none overflow-hidden rounded-lg border border-border bg-muted/20"
              >
                <img
                  src={imageData}
                  alt="Fotografija balkona za merjenje"
                  className="block w-full"
                  draggable={false}
                />
                <canvas
                  ref={canvasRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Legenda: zelena = prekni · modra = stebri · oranžna = kotniki · rdeča = referenčna
                mera · rumena/rožata = ročne točke
              </p>
            </div>
          )}

          {/* ── 2 · ZAVIHKI: Samodejno | Ročno ────────────────────────────── */}
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="auto" className="min-h-[44px]" aria-label="Samodejni način merjenja">
                📷 Samodejno
              </TabsTrigger>
              <TabsTrigger value="manual" className="min-h-[44px]" aria-label="Ročni način merjenja">
                ✋ Ročno
              </TabsTrigger>
            </TabsList>

            {/* SAMODEJNO */}
            <TabsContent value="auto" className="space-y-3 pt-2">
              {!imageData && (
                <p className="text-[11px] text-muted-foreground" role="status">
                  Izberite ali posnemite sliko — detekcija se zažene samodejno.
                </p>
              )}
              {detecting && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deterministična detekcija teče (Sobel + Hough, brez AI) …
                </div>
              )}
              {detectError && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-[11px] text-red-800"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{detectError}</span>
                </div>
              )}
              {autoResult && (
                <QualityPanel
                  state={autoResult.state}
                  metrics={autoResult.metrics}
                  guidance={autoResult.guidance}
                  onSwitchToManual={() => handleTabChange('manual')}
                />
              )}
            </TabsContent>

            {/* ROČNO */}
            <TabsContent value="manual" className="space-y-3 pt-2">
              {!imageData && (
                <p className="text-[11px] text-muted-foreground" role="status">
                  Izberite sliko, nato klikajte točke po korakih spodaj.
                </p>
              )}
              <div className="space-y-2 rounded-lg border border-roksal-navy/15 dark:border-roksal-ink/15 bg-roksal-navy/5 p-3">
                <p className="text-xs font-semibold text-roksal-ink">
                  Korak: {MANUAL_STEPS.find((s) => s.id === activeStep)?.label}
                </p>
                <p className="text-[11px] text-muted-foreground" role="status">
                  {manualHint[activeStep]}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {MANUAL_STEPS.map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      size="sm"
                      variant={activeStep === s.id ? 'default' : 'outline'}
                      className="min-h-[44px] text-xs"
                      aria-pressed={activeStep === s.id}
                      aria-label={`Korak: ${s.label}`}
                      onClick={() => setActiveStep(s.id)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] flex-1"
                    onClick={undoLastPoint}
                    aria-label="Razveljavi zadnjo točko"
                  >
                    <Undo2 className="mr-1 h-3.5 w-3.5" />
                    Razveljavi zadnjo točko
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] flex-1"
                    onClick={clearAllPoints}
                    aria-label="Počisti vse točke"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Počisti
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <Badge variant="outline" className="border-rose-300 bg-rose-50 text-[9px] text-rose-700">
                    Spodnja linija: {manualPath.length}
                  </Badge>
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[9px] text-amber-700">
                    Zgornja linija: {manualTop.length}
                  </Badge>
                  <Badge variant="outline" className="border-pink-300 bg-pink-50 text-[9px] text-pink-700">
                    Stebri: {manualPosts.length}
                  </Badge>
                  {manualPath.length >= 2 && !manualTopMatches && (
                    <Badge variant="outline" className="border-red-300 bg-red-50 text-[9px] text-red-700">
                      Zgornja linija mora imeti {manualPath.length} točk!
                    </Badge>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          {/* ── 3 · REFERENČNA MERA (skupna) ──────────────────────────────── */}
          <ReferenceSection
            refP1={refP1}
            refP2={refP2}
            knownMmInput={knownMmInput}
            refKind={refKind}
            refLenOk={refLenOk}
            onKnownMmChange={setKnownMmInput}
            onKindChange={setRefKind}
            onClearPoints={() => {
              setRefP1(null)
              setRefP2(null)
            }}
          />

          {/* ── 4 · IZDELEK (opcijsko) ────────────────────────────────────── */}
          <ProductSection
            products={products}
            productsError={productsError}
            productId={productId}
            orientation={orientation}
            gapMm={gapMm}
            postWidthMm={postWidthMm}
            onProductChange={handleProductChange}
            onOrientationChange={setOrientation}
            onGapChange={setGapMm}
            onPostWidthChange={setPostWidthMm}
          />

          {/* ── 5 · IZRAČUNAJ MERITEV ─────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!canCompute || confirming}
              className="min-h-[44px] w-full bg-roksal-amber text-white hover:bg-roksal-amber/90"
              aria-label="Izračunaj meritev"
            >
              {confirming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ruler className="mr-2 h-4 w-4" />
              )}
              IZRAČUNAJ MERITEV
            </Button>
            {!canCompute && computeHint && !confirming && (
              <p className="text-center text-[10px] text-muted-foreground" role="status">
                {computeHint}
              </p>
            )}
            {!projectId && (
              <p className="text-center text-[10px] text-muted-foreground">
                Projekt ni izbran — meritev bo izračunana, a NE shranjena.
              </p>
            )}
          </div>

          {/* ── 6 · REZULTAT (skupni panel) ───────────────────────────────── */}
          <ResultsSection result={confirmResult} error={confirmError} />
        </CardContent>
      </Card>
    </div>
  )
}
