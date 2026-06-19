'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Sparkles,
  Loader2,
  Ruler,
  Package,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Upload,
} from 'lucide-react'
import jsPDF from 'jspdf'

interface DetectedRailing {
  tip: string
  orientacija: string
  barva: string
  opis: string
  confidence: number
}

interface EstimatedDimensions {
  dolzinaMm: number
  visinaMm: number
  stebrov: number
  palic: number
  referenceObject: string
  confidence: number
}

interface MaterialTakeoff {
  profil: { sifra: string; naziv: string; material: string; cenaM: number }
  dolzinaM: number
  palic: number
  stebrov: number
  vijakov: number
  sidr: number
  linearniMetri: number
  cenaMateriala: number
  cenaDela: number
  cenaTransporta: number
  skupajBrezDDV: number
  ddv: number
  skupajZDDV: number
}

interface AiResult {
  success: boolean
  detected: DetectedRailing
  dimensions: EstimatedDimensions
  takeoff: MaterialTakeoff
  profil: { sifra: string; naziv: string; material: string; cenaM: number; barvaRal: string | null }
  formattedPrice: string
  rawVlm: string
}

interface AiTakeoffProps {
  projectId: string | null
  imageData?: string | null // če pride iz photo-tab (že posneta slika)
  onClose?: () => void
}

const TIP_LABELS: Record<string, string> = {
  WPC: 'WPC (lesni kompozit)',
  ALU: 'Aluminij',
  INOX: 'Inox',
  STEKLO: 'Steklo',
  NEZNANO: 'Neznano',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  low: 'bg-red-100 text-red-800 border-red-300',
}

function confidenceLevel(c: number): 'high' | 'medium' | 'low' {
  if (c >= 0.75) return 'high'
  if (c >= 0.5) return 'medium'
  return 'low'
}

export function AiTakeoff({ projectId, imageData: initialImage, onClose }: AiTakeoffProps) {
  const [imageData, setImageData] = useState<string | null>(initialImage || null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<AiResult | null>(null)
  const [hintLength, setHintLength] = useState('')
  const [hintType, setHintType] = useState<'AUTO' | 'WPC' | 'ALU' | 'INOX' | 'STEKLO'>('AUTO')
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const { toast } = useToast()

  // Upload slike
  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      // Kompresija na max 800px
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 800 / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setImageData(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }, [])

  // Kamera
  const handleCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      const video = document.createElement('video')
      video.srcObject = stream
      video.play()
      // Počakaj 2s da se kamera zazene
      await new Promise((r) => setTimeout(r, 2000))
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0)
      stream.getTracks().forEach((t) => t.stop())
      setImageData(canvas.toDataURL('image/jpeg', 0.7))
    } catch {
      toast({ title: 'Kamera ni na voljo', variant: 'destructive' })
    }
  }, [toast])

  // AI analiza
  const handleAnalyze = useCallback(async () => {
    if (!imageData) return
    setAnalyzing(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai-takeoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          projectId,
          hint: {
            knownLengthMm: hintLength ? parseInt(hintLength) : undefined,
            railingType: hintType,
          },
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setResult(data)
        toast({
          title: 'AI analiza končana',
          description: `${TIP_LABELS[data.detected.tip] || data.detected.tip} · ${data.formattedPrice}`,
        })
      } else {
        toast({
          title: 'AI analiza ni uspela',
          description: data.error || 'Poskusi znova z drugo sliko',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Omrežna napaka', variant: 'destructive' })
    } finally {
      setAnalyzing(false)
    }
  }, [imageData, projectId, hintLength, hintType, toast])

  // Generiraj PDF ponudbo
  const handleGeneratePdf = useCallback(async () => {
    if (!result) return
    setGeneratingPdf(true)
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const COLORS = {
        navy: [29, 43, 62] as [number, number, number],
        amber: [245, 158, 11] as [number, number, number],
        dark: [17, 24, 39] as [number, number, number],
        gray: [107, 114, 128] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
      }

      // Glava
      doc.setFillColor(...COLORS.navy)
      doc.rect(0, 0, pageW, 32, 'F')
      doc.setFillColor(...COLORS.amber)
      doc.rect(14, 8, 14, 14, 'F')
      doc.setTextColor(...COLORS.white)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('R', 19, 19)
      doc.setFontSize(15)
      doc.text('ROKSAL d.o.o.', 32, 15)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Kranj · Ograje in terase po meri', 32, 21)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('PONUDBA (AI Takeoff)', pageW - 14, 15, { align: 'right' })
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(new Date().toLocaleDateString('sl-SI'), pageW - 14, 21, { align: 'right' })

      let y = 44
      // AI zaznano
      doc.setTextColor(...COLORS.dark)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('AI ZAZNANA OGRAJA', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.setLineWidth(0.5)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 6

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const aiInfo = [
        `Tip: ${TIP_LABELS[result.detected.tip] || result.detected.tip}`,
        `Orientacija: ${result.detected.orientacija}`,
        `Barva: ${result.detected.barva}`,
        `Opis: ${result.detected.opis}`,
        `Reference: ${result.dimensions.referenceObject}`,
        `Zaupanje: ${Math.round(result.detected.confidence * 100)}% / ${Math.round(result.dimensions.confidence * 100)}%`,
      ]
      aiInfo.forEach((line) => {
        doc.text(line, 14, y)
        y += 5
      })
      y += 4

      // Dimenzije
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('DIMENZIJE', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`Dolžina: ${result.dimensions.dolzinaMm} mm (${(result.dimensions.dolzinaMm / 1000).toFixed(2)} m)`, 14, y)
      doc.text(`Višina: ${result.dimensions.visinaMm} mm`, pageW / 2, y)
      y += 5
      doc.text(`Stebri: ${result.takeoff.stebrov} kos`, 14, y)
      doc.text(`Palice: ${result.takeoff.palic} kos`, pageW / 2, y)
      y += 8

      // Material
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('MATERIAL TAKEOFF', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 4

      // Tabela
      const rows = [
        ['Profil', `${result.profil.naziv} (${result.profil.sifra})`, `${result.profil.cenaM} €/m`],
        ['Linearni metri', `${result.takeoff.linearniMetri.toFixed(2)} m`, ''],
        ['Palice', `${result.takeoff.palic} kos`, ''],
        ['Stebri', `${result.takeoff.stebrov} kos`, ''],
        ['Vijaki (A2 Inox)', `${result.takeoff.vijakov} kos`, ''],
        ['Sidra (kemična)', `${result.takeoff.sidr} kos`, ''],
        ['Material', '', `${result.takeoff.cenaMateriala} €`],
        ['Delo (monterji)', '', `${result.takeoff.cenaDela} €`],
        ['Transport', '', `${result.takeoff.cenaTransporta} €`],
      ]
      doc.setFontSize(9)
      rows.forEach((row, i) => {
        doc.setFont('helvetica', i >= 6 ? 'bold' : 'normal')
        doc.text(row[0], 14, y + (i + 1) * 5)
        doc.text(row[1], 80, y + (i + 1) * 5)
        doc.text(row[2], pageW - 14, y + (i + 1) * 5, { align: 'right' })
      })
      y += rows.length * 5 + 4

      // Skupaj
      doc.setFillColor(...COLORS.navy)
      doc.rect(pageW - 80, y, 66, 22, 'F')
      doc.setTextColor(...COLORS.white)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Brez DDV:', pageW - 76, y + 6)
      doc.text(`${result.takeoff.skupajBrezDDV} €`, pageW - 18, y + 6, { align: 'right' })
      doc.text('DDV (22%):', pageW - 76, y + 12)
      doc.text(`${result.takeoff.ddv} €`, pageW - 18, y + 12, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('SKUPAJ:', pageW - 76, y + 19)
      doc.text(`${result.takeoff.skupajZDDV} €`, pageW - 18, y + 19, { align: 'right' })

      y += 30
      // Slika
      if (imageData) {
        try {
          doc.addImage(imageData, 'JPEG', 14, y, 60, 45)
          doc.setFontSize(7)
          doc.setTextColor(...COLORS.gray)
          doc.setFont('helvetica', 'normal')
          doc.text('Analizirana slika', 14, y + 49)
        } catch {
          /* skip */
        }
      }

      // Noga
      doc.setFontSize(7)
      doc.setTextColor(...COLORS.gray)
      doc.text('Roksal d.o.o. Kranj · AI Takeoff ponudba · Veljavnost 30 dni', 14, 290)
      doc.text('Garancija 15 let na WPC · DDV 22%', pageW - 14, 290, { align: 'right' })

      doc.save(`Roksal-AI-ponudba-${Date.now()}.pdf`)
      toast({ title: 'PDF ponudba generirana' })
    } catch {
      toast({ title: 'Napaka pri PDF', variant: 'destructive' })
    } finally {
      setGeneratingPdf(false)
    }
  }, [result, imageData, toast])

  return (
    <div className="space-y-4">
      <Card className="border-roksal-amber/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-roksal-amber" />
            AI Material Takeoff
            <Badge variant="secondary" className="ml-auto text-[9px] bg-roksal-amber/10 text-roksal-amber">
              V2 BETA
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!imageData && (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" onClick={handleCamera} variant="outline" className="h-20 flex-col gap-1 border-roksal-navy/20">
                <Camera className="h-6 w-6 text-roksal-navy" />
                <span className="text-xs">Slikaj</span>
              </Button>
              <label className="cursor-pointer">
                <Button type="button" variant="outline" className="h-20 w-full flex-col gap-1 border-roksal-navy/20" onClick={() => document.getElementById('ai-upload')?.click()}>
                  <Upload className="h-6 w-6 text-roksal-navy" />
                  <span className="text-xs">Naloži sliko</span>
                </Button>
                <input id="ai-upload" type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
            </div>
          )}

          {imageData && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageData} alt="Za analizo" className="w-full rounded-lg border border-border max-h-48 object-cover" />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Dolžina (mm, opcijsko)</Label>
                  <Input
                    type="number"
                    value={hintLength}
                    onChange={(e) => setHintLength(e.target.value)}
                    placeholder="npr. 3000"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Tip (opcijsko)</Label>
                  <Select value={hintType} onValueChange={(v) => setHintType(v as typeof hintType)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTO">Samodejno</SelectItem>
                      <SelectItem value="WPC">WPC</SelectItem>
                      <SelectItem value="ALU">Aluminij</SelectItem>
                      <SelectItem value="INOX">Inox</SelectItem>
                      <SelectItem value="STEKLO">Steklo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" onClick={() => setImageData(null)} variant="outline" size="sm" className="flex-1">
                  Druga slika
                </Button>
                <Button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex-1 bg-roksal-amber text-white hover:bg-roksal-amber/90"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      AI analizira...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Analiziraj
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Rezultati */}
          {result && (
            <div className="space-y-3 pt-2 border-t border-border">
              {/* Zaznano */}
              <div className="rounded-lg border border-roksal-amber/20 bg-roksal-amber/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold text-roksal-navy">AI zaznal</span>
                  <Badge
                    variant="outline"
                    className={`ml-auto text-[9px] ${CONFIDENCE_COLORS[confidenceLevel(result.detected.confidence)]}`}
                  >
                    {Math.round(result.detected.confidence * 100)}% zaupanja
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <div><span className="text-muted-foreground">Tip:</span> <span className="font-medium">{TIP_LABELS[result.detected.tip] || result.detected.tip}</span></div>
                  <div><span className="text-muted-foreground">Orientacija:</span> <span className="font-medium">{result.detected.orientacija}</span></div>
                  <div><span className="text-muted-foreground">Barva:</span> <span className="font-medium">{result.detected.barva}</span></div>
                  <div><span className="text-muted-foreground">Reference:</span> <span className="font-medium">{result.dimensions.referenceObject}</span></div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 italic">{result.detected.opis}</p>
              </div>

              {/* Dimenzije */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-white p-2.5 text-center">
                  <Ruler className="h-4 w-4 mx-auto text-roksal-navy mb-1" />
                  <div className="text-lg font-bold text-roksal-navy">{(result.dimensions.dolzinaMm / 1000).toFixed(2)}m</div>
                  <div className="text-[9px] text-muted-foreground">Dolžina</div>
                </div>
                <div className="rounded-lg border border-border bg-white p-2.5 text-center">
                  <Ruler className="h-4 w-4 mx-auto text-roksal-navy mb-1" />
                  <div className="text-lg font-bold text-roksal-navy">{result.dimensions.visinaMm}mm</div>
                  <div className="text-[9px] text-muted-foreground">Višina</div>
                </div>
              </div>

              {/* Material takeoff */}
              <div className="rounded-lg border border-border bg-white p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-roksal-amber" />
                  <span className="text-sm font-semibold text-roksal-navy">Material takeoff</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="rounded bg-muted/30 p-1.5">
                    <div className="text-base font-bold text-roksal-navy">{result.takeoff.palic}</div>
                    <div className="text-[9px] text-muted-foreground">Palice</div>
                  </div>
                  <div className="rounded bg-muted/30 p-1.5">
                    <div className="text-base font-bold text-roksal-navy">{result.takeoff.stebrov}</div>
                    <div className="text-[9px] text-muted-foreground">Stebri</div>
                  </div>
                  <div className="rounded bg-muted/30 p-1.5">
                    <div className="text-base font-bold text-roksal-navy">{result.takeoff.vijakov}</div>
                    <div className="text-[9px] text-muted-foreground">Vijaki</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px] mt-1">
                  <div className="rounded bg-muted/30 p-1.5">
                    <div className="text-base font-bold text-roksal-navy">{result.takeoff.sidr}</div>
                    <div className="text-[9px] text-muted-foreground">Sidra</div>
                  </div>
                  <div className="rounded bg-muted/30 p-1.5">
                    <div className="text-base font-bold text-roksal-navy">{result.takeoff.linearniMetri.toFixed(1)}m</div>
                    <div className="text-[9px] text-muted-foreground">Linearni</div>
                  </div>
                  <div className="rounded bg-muted/30 p-1.5">
                    <div className="text-base font-bold text-roksal-navy">{result.profil.sifra}</div>
                    <div className="text-[9px] text-muted-foreground">Profil</div>
                  </div>
                </div>
              </div>

              {/* Cena */}
              <div className="rounded-lg border-2 border-roksal-amber bg-roksal-amber/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-roksal-amber" />
                  <span className="text-sm font-semibold text-roksal-navy">Cena</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Material:</span>
                    <span className="font-medium">{result.takeoff.cenaMateriala} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delo:</span>
                    <span className="font-medium">{result.takeoff.cenaDela} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transport:</span>
                    <span className="font-medium">{result.takeoff.cenaTransporta} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DDV (22%):</span>
                    <span className="font-medium">{result.takeoff.ddv} €</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-roksal-amber/30">
                    <span className="font-bold text-roksal-navy">SKUPAJ:</span>
                    <span className="font-bold text-roksal-amber text-base">{result.takeoff.skupajZDDV} €</span>
                  </div>
                </div>
              </div>

              {/* Opozorila */}
              {result.detected.confidence < 0.5 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Nizko zaupanje AI. Preveri mere ročno z laserjem za natančno ponudbo.</span>
                </div>
              )}

              {/* Akcije */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleGeneratePdf}
                  disabled={generatingPdf}
                  className="flex-1 bg-roksal-navy text-white hover:bg-roksal-navy/90"
                >
                  {generatingPdf ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Ponudba PDF
                </Button>
                {onClose && (
                  <Button type="button" onClick={onClose} variant="outline">
                    Zapri
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
