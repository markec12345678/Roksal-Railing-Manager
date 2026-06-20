'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import SignatureCanvas from 'react-signature-canvas'
import { Pen, Eraser, Check, X, FileText, User, Download } from 'lucide-react'
import jsPDF from 'jspdf'

interface SignedQuoteData {
  projectName: string
  customerName: string
  customerAddress: string
  customerPhone?: string
  items: Array<{ opis: string; kolicina: string; enota: string; cena: string; skupaj: string }>
  skupajBrezDDV: number
  ddv: number
  skupajZDDV: number
  datum: string
  veljavnostDni?: number
}

interface PodpisaniPdfAkcija {
  imeStranke: string
  podpisStranke: string | null // base64 PNG
  podpisMonterja: string | null // base64 PNG
  imeMonterja?: string
  datumPodpisa: string
  lokacijaPodpisa?: string
}

interface SignatureQuoteProps {
  quoteData: SignedQuoteData
  monterName?: string
  projectId?: string | null
  onClose?: () => void
  onDealLocked?: () => void
}

export function SignatureQuote({ quoteData, monterName = 'Monter Roksal', projectId, onClose, onDealLocked }: SignatureQuoteProps) {
  const [customerSigOpen, setCustomerSigOpen] = useState(false)
  const [monterSigOpen, setMonterSigOpen] = useState(false)
  const [customerSig, setCustomerSig] = useState<string | null>(null)
  const [monterSig, setMonterSig] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState(quoteData.customerName || '')
  const [customerLocation, setCustomerLocation] = useState('')
  const [generating, setGenerating] = useState(false)
  const customerSigRef = useRef<SignatureCanvas | null>(null)
  const monterSigRef = useRef<SignatureCanvas | null>(null)
  const { toast } = useToast()

  const handleClearCustomer = useCallback(() => {
    customerSigRef.current?.clear()
  }, [])

  const handleClearMonter = useCallback(() => {
    monterSigRef.current?.clear()
  }, [])

  const handleSaveCustomerSig = useCallback(() => {
    if (customerSigRef.current?.isEmpty()) {
      toast({ title: 'Podpis je prazen', description: 'Narišite podpis na platnu', variant: 'destructive' })
      return
    }
    const dataUrl = customerSigRef.current?.toDataURL('image/png')
    setCustomerSig(dataUrl || null)
    setCustomerSigOpen(false)
    toast({ title: 'Podpis stranke shranjen' })
  }, [toast])

  const handleSaveMonterSig = useCallback(() => {
    if (monterSigRef.current?.isEmpty()) {
      toast({ title: 'Podpis je prazen', description: 'Narišite podpis na platnu', variant: 'destructive' })
      return
    }
    const dataUrl = monterSigRef.current?.toDataURL('image/png')
    setMonterSig(dataUrl || null)
    setMonterSigOpen(false)
    toast({ title: 'Podpis monterja shranjen' })
  }, [toast])

  const handleGeneratePdf = useCallback(async () => {
    if (!customerSig) {
      toast({ title: 'Podpis stranke manjka', description: 'Stranka mora podpisati pred izvozom', variant: 'destructive' })
      return
    }
    if (!monterSig) {
      toast({ title: 'Podpis monterja manjka', description: 'Monter mora podpisati pred izvozom', variant: 'destructive' })
      return
    }
    setGenerating(true)
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
      doc.text('PONUDBA S PODPISOM', pageW - 14, 15, { align: 'right' })
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(quoteData.datum, pageW - 14, 21, { align: 'right' })

      let y = 44
      // Stranka
      doc.setTextColor(...COLORS.dark)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('STRANKA', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.setLineWidth(0.5)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 6
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Ime: ${customerName || quoteData.customerName}`, 14, y)
      doc.text(`Naslov: ${quoteData.customerAddress}`, 14, y + 5)
      if (quoteData.customerPhone) {
        doc.text(`Telefon: ${quoteData.customerPhone}`, 14, y + 10)
      }
      y += 18

      // Projekt
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('PROJEKT', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(quoteData.projectName, 14, y)
      y += 8

      // Postavke
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('POSTAVKE', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 4

      // Tabela postavk
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setFillColor(...COLORS.navy)
      doc.rect(14, y, pageW - 28, 6, 'F')
      doc.setTextColor(...COLORS.white)
      doc.text('Opis', 16, y + 4)
      doc.text('Kol.', 110, y + 4)
      doc.text('Enota', 130, y + 4)
      doc.text('Cena', 150, y + 4)
      doc.text('Skupaj', pageW - 16, y + 4, { align: 'right' })
      y += 6

      doc.setTextColor(...COLORS.dark)
      doc.setFont('helvetica', 'normal')
      quoteData.items.forEach((item, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(245, 247, 250)
          doc.rect(14, y, pageW - 28, 5, 'F')
        }
        doc.text(item.opis.slice(0, 60), 16, y + 3.5)
        doc.text(item.kolicina, 110, y + 3.5)
        doc.text(item.enota, 130, y + 3.5)
        doc.text(item.cena, 150, y + 3.5)
        doc.text(item.skupaj, pageW - 16, y + 3.5, { align: 'right' })
        y += 5
      })
      y += 4

      // Skupaj
      doc.setFillColor(...COLORS.navy)
      doc.rect(pageW - 80, y, 66, 22, 'F')
      doc.setTextColor(...COLORS.white)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Brez DDV:', pageW - 76, y + 6)
      doc.text(`${quoteData.skupajBrezDDV.toFixed(2)} €`, pageW - 18, y + 6, { align: 'right' })
      doc.text('DDV (22%):', pageW - 76, y + 12)
      doc.text(`${quoteData.ddv.toFixed(2)} €`, pageW - 18, y + 12, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('SKUPAJ:', pageW - 76, y + 19)
      doc.text(`${quoteData.skupajZDDV.toFixed(2)} €`, pageW - 18, y + 19, { align: 'right' })

      y += 30

      // Pogoji
      doc.setTextColor(...COLORS.gray)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      const veljavnost = quoteData.veljavnostDni || 30
      const pogoji = `Ponudba velja ${veljavnost} dni. Cena vključuje material in montažo. Garancija 15 let na WPC. Plačilo: 50% akontacija ob naročilu, 50% ob prevzemu.`
      const pogojiLines = doc.splitTextToSize(pogoji, pageW - 28)
      doc.text(pogojiLines, 14, y)
      y += pogojiLines.length * 3.5 + 6

      // Podpisni del
      doc.setTextColor(...COLORS.dark)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('PRIMOPREDAJA S PODPISOM', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.setLineWidth(0.8)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 8

      // Dva podpisa
      const podpisSirina = (pageW - 28 - 10) / 2
      const podpisLevi = 14
      const podpisDesni = 14 + podpisSirina + 10

      // Črte za podpis
      doc.setDrawColor(...COLORS.dark)
      doc.setLineWidth(0.3)
      doc.line(podpisLevi, y + 25, podpisLevi + podpisSirina, y + 25)
      doc.line(podpisDesni, y + 25, podpisDesni + podpisSirina, y + 25)

      // Podpisi (slike)
      try {
        doc.addImage(customerSig, 'PNG', podpisLevi + 5, y + 5, podpisSirina - 10, 18)
      } catch {
        /* skip */
      }
      try {
        doc.addImage(monterSig, 'PNG', podpisDesni + 5, y + 5, podpisSirina - 10, 18)
      } catch {
        /* skip */
      }

      // Labele
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.dark)
      doc.text('Stranka:', podpisLevi, y + 30)
      doc.text(customerName || quoteData.customerName, podpisLevi + 18, y + 30)
      doc.text('Monter:', podpisDesni, y + 30)
      doc.text(monterName, podpisDesni + 16, y + 30)

      doc.setFontSize(7)
      doc.setTextColor(...COLORS.gray)
      doc.text(`Datum: ${new Date().toLocaleDateString('sl-SI')}`, podpisLevi, y + 34)
      if (customerLocation) {
        doc.text(`Kraj: ${customerLocation}`, podpisLevi, y + 37)
      }
      doc.text(`Datum: ${new Date().toLocaleDateString('sl-SI')}`, podpisDesni, y + 34)
      doc.text('Roksal d.o.o. Kranj', podpisDesni, y + 37)

      // Noga
      doc.setFontSize(7)
      doc.setTextColor(...COLORS.gray)
      doc.text('Roksal d.o.o. Kranj · Podpisana ponudba · Veljaven pravni dokument', 14, 290)
      doc.text('Stran 1/1', pageW - 14, 290, { align: 'right' })

      const filename = `Roksal-ponudba-podpisana-${(quoteData.projectName || 'projekt').replace(/\s+/g, '-')}.pdf`
      doc.save(filename)
      toast({ title: 'PDF s podpisom generiran', description: filename })

      // V4.1 — avtomatski deal-lock ob podpisu PDF-ja
      if (projectId && customerSig && monterSig) {
        try {
          const geo = await new Promise<{ lat?: number; lon?: number }>((resolve) => {
            if (!navigator.geolocation) return resolve({})
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
              () => resolve({}),
              { timeout: 3000, enableHighAccuracy: true }
            )
          })
          const dealRes = await fetch('/api/deal-lock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              customerName: customerName || quoteData.customerName,
              monterName,
              customerSignature: customerSig,
              monterSignature: monterSig,
              quoteData: {
                items: quoteData.items,
                skupajBrezDDV: quoteData.skupajBrezDDV,
                ddv: quoteData.ddv,
                skupajZDDV: quoteData.skupajZDDV,
              },
              geoLatitude: geo.lat,
              geoLongitude: geo.lon,
            }),
          })
          if (dealRes.ok) {
            const deal = await dealRes.json()
            toast({
              title: '✓ Deal zaklenjen (V4.1)',
              description: `Status → ZA_MONTAZO · BOM draft: ${deal.bomDraft?.items?.length || 0} art. · Marža: ${deal.marginLocked?.toFixed(0) || 0} €`,
            })
            onDealLocked?.()
          } else {
            const err = await dealRes.json().catch(() => ({}))
            if (dealRes.status === 409) {
              toast({ title: 'Deal je že zaklenjen', variant: 'default' })
            } else {
              toast({ title: 'Deal-lock ni uspel', description: err.error || 'Napaka', variant: 'destructive' })
            }
          }
        } catch (e) {
          console.error('Deal-lock error:', e)
          toast({ title: 'Deal-lock omrežna napaka', variant: 'destructive' })
        }
      }
    } catch (e) {
      console.error(e)
      toast({ title: 'Napaka pri PDF', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }, [customerSig, monterSig, customerName, customerLocation, quoteData, monterName, projectId, onDealLocked, toast])

  return (
    <Card className="border-roksal-amber/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Pen className="h-5 w-5 text-roksal-amber" />
          Ponudba s podpisom
          <Badge variant="secondary" className="ml-auto text-[9px] bg-roksal-amber/10 text-roksal-amber">
            V4
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pregled podatkov */}
        <div className="rounded-lg border border-border bg-white p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Projekt:</span>
            <span className="font-medium text-roksal-navy">{quoteData.projectName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stranka:</span>
            <span className="font-medium text-roksal-navy">{quoteData.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Skupaj z DDV:</span>
            <span className="font-bold text-roksal-amber">{quoteData.skupajZDDV.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Postavk:</span>
            <span className="font-medium">{quoteData.items.length}</span>
          </div>
        </div>

        {/* Vnos imena stranke */}
        <div>
          <Label className="text-xs">Ime stranke (za podpis)</Label>
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="npr. Andrej Kokalj"
            className="h-9 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Kraj podpisa (opcijsko)</Label>
          <Input
            value={customerLocation}
            onChange={(e) => setCustomerLocation(e.target.value)}
            placeholder="npr. Kranj"
            className="h-9 text-sm"
          />
        </div>

        {/* Podpisi */}
        <div className="grid grid-cols-2 gap-3">
          {/* Stranka */}
          <div className="rounded-lg border-2 border-dashed border-border p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-2">
              <User className="h-4 w-4 text-roksal-navy" />
              <span className="text-xs font-medium">Podpis stranke</span>
            </div>
            {customerSig ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={customerSig} alt="Podpis stranke" className="h-16 w-full object-contain" />
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-[9px]">
                  <Check className="h-3 w-3 mr-1" /> Podpisano
                </Badge>
                <Button type="button" size="sm" variant="ghost" className="h-6 w-full text-[10px]" onClick={() => setCustomerSigOpen(true)}>
                  Spremeni
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" className="w-full bg-roksal-navy text-white" onClick={() => setCustomerSigOpen(true)}>
                <Pen className="h-3 w-3 mr-1" /> Podpiši
              </Button>
            )}
          </div>

          {/* Monter */}
          <div className="rounded-lg border-2 border-dashed border-border p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-2">
              <User className="h-4 w-4 text-roksal-amber" />
              <span className="text-xs font-medium">Podpis monterja</span>
            </div>
            {monterSig ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={monterSig} alt="Podpis monterja" className="h-16 w-full object-contain" />
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-[9px]">
                  <Check className="h-3 w-3 mr-1" /> Podpisano
                </Badge>
                <Button type="button" size="sm" variant="ghost" className="h-6 w-full text-[10px]" onClick={() => setMonterSigOpen(true)}>
                  Spremeni
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" className="w-full bg-roksal-amber text-white" onClick={() => setMonterSigOpen(true)}>
                <Pen className="h-3 w-3 mr-1" /> Podpiši
              </Button>
            )}
          </div>
        </div>

        {/* Generiraj PDF */}
        <Button
          type="button"
          onClick={handleGeneratePdf}
          disabled={generating || !customerSig || !monterSig}
          className="w-full bg-roksal-navy text-white hover:bg-roksal-navy/90"
        >
          {generating ? (
            <>
              <FileText className="mr-2 h-4 w-4 animate-pulse" />
              Generiram PDF...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generiraj podpisano ponudbo PDF
            </>
          )}
        </Button>

        {(!customerSig || !monterSig) && (
          <p className="text-center text-[10px] text-amber-600">
            {!customerSig && !monterSig
              ? 'Oba podpisa (stranka + monter) sta potrebna'
              : !customerSig
                ? 'Podpis stranke manjka'
                : 'Podpis monterja manjka'}
          </p>
        )}

        {onClose && (
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Zapri
          </Button>
        )}
      </CardContent>

      {/* Dialog: podpis stranke */}
      <Dialog open={customerSigOpen} onOpenChange={setCustomerSigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-navy">
              <Pen className="h-5 w-5 text-roksal-amber" />
              Podpis stranke
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Stranka naj podpiše s prstom na spodnjem platnu. Podpis se uporabi za PDF ponudbo.
            </p>
            <div className="rounded-lg border-2 border-roksal-navy/20 bg-white">
              <SignatureCanvas
                ref={(ref) => {
                  customerSigRef.current = ref
                }}
                canvasProps={{
                  width: 400,
                  height: 180,
                  className: 'w-full h-44 touch-none',
                }}
                backgroundColor="rgba(255,255,255,1)"
                penColor="#1d2b3e"
                minWidth={1.5}
                maxWidth={3.5}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClearCustomer}>
                <Eraser className="h-4 w-4 mr-1" /> Počisti
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCustomerSigOpen(false)}>
                <X className="h-4 w-4 mr-1" /> Prekliči
              </Button>
              <Button type="button" className="flex-1 bg-roksal-navy text-white" onClick={handleSaveCustomerSig}>
                <Check className="h-4 w-4 mr-1" /> Shrani
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: podpis monterja */}
      <Dialog open={monterSigOpen} onOpenChange={setMonterSigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-navy">
              <Pen className="h-5 w-5 text-roksal-amber" />
              Podpis monterja
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Monter naj podpiše s prstom na spodnjem platnu.
            </p>
            <div className="rounded-lg border-2 border-roksal-amber/30 bg-white">
              <SignatureCanvas
                ref={(ref) => {
                  monterSigRef.current = ref
                }}
                canvasProps={{
                  width: 400,
                  height: 180,
                  className: 'w-full h-44 touch-none',
                }}
                backgroundColor="rgba(255,255,255,1)"
                penColor="#f59e0b"
                minWidth={1.5}
                maxWidth={3.5}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClearMonter}>
                <Eraser className="h-4 w-4 mr-1" /> Počisti
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setMonterSigOpen(false)}>
                <X className="h-4 w-4 mr-1" /> Prekliči
              </Button>
              <Button type="button" className="flex-1 bg-roksal-amber text-white" onClick={handleSaveMonterSig}>
                <Check className="h-4 w-4 mr-1" /> Shrani
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
