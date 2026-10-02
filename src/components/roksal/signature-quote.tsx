'use client'

// R374 (issue #13, korak R165 iz §32/§2–§8/§16/§17) — Ponudbe s podpisom V5.
// ---------------------------------------------------------------------------
// REWRITE iz V4.1: do R372 je komponenta pošiljala deal-locku klientov
// quoteData (postavke + seštevki) — zaklep je bil nad klientovim denarjem.
// V5 je vezan na KANONIČNE strežniške verzije:
//   • seznam verzij projekta (GET /api/quotes?projectId=);
//   • hitra ponudba (dolžina/višina → POST /api/quotes — strežnik izračuna
//     iz AKTIVNE knjige, klient ne pošilja denarja);
//   • izdaja osnutka (PATCH /api/quotes/[id] action=issue) nad DRAFT;
//   • zaklep SAMO nad ISSUED/APPROVED verzijo (POST /api/deal-lock z
//     quoteVersionId — brez quoteData);
//   • PDF izhodišče = postavke VERZIJE (ne klientovi izračuni).
// Ohranjeni: podpisna platna, jsPDF izvoz s slovenskimi glifi (R353), STIL/
// a11y vzorci iz rund R344–R372 (roksal žetoni, aria-hidden ikone, kit
// <Button> fokus jezik).

import { useRef, useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import SignatureCanvas from 'react-signature-canvas'
import { Pen, Eraser, Check, X, FileText, User, Download, Plus, Send } from 'lucide-react'
import { slDatumKratko } from '@/lib/csv-export'
import jsPDF from 'jspdf'
import { registerSloPdfFonts } from '@/lib/pdf-sl-font'

/** Postavka verzije (strežniški QuoteItem — vir za PDF in zaklep). */
interface VersionLine {
  code: string
  group: string
  name: string
  detail: string
  qty: number
  unit: string
  unitPrice: number
  total: number
  sourceKey?: string
}

interface QuoteVersionDto {
  id: string
  quoteId: string
  versionNumber: number
  status: string
  subtotal: number
  vat: number
  total: number
  currency: string
  inputHash: string
  createdAt: string
  approvedAt?: string | null
  lines?: VersionLine[]
  priceBookVersion?: number | null
}

interface SignatureQuoteProps {
  projectId: string
  projectName: string
  customerName: string
  customerAddress: string
  customerPhone?: string
  monterName?: string
  onClose?: () => void
  onDealLocked?: () => void
}

/** Statusna signalizacija verzije (ISTI nabori kot strežniški statusni stroj). */
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Osnutek', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
  ISSUED: { label: 'Izdana', cls: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800' },
  APPROVED: { label: 'Odobrena', cls: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800' },
  REJECTED: { label: 'Zavrnjena', cls: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800' },
  SUPERSEDED: { label: 'Zamenjana', cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800' },
}

export function SignatureQuote({
  projectId,
  projectName,
  customerName: initialCustomerName,
  customerAddress,
  customerPhone,
  monterName = 'Monter Roksal',
  onClose,
  onDealLocked,
}: SignatureQuoteProps) {
  const [customerSigOpen, setCustomerSigOpen] = useState(false)
  const [monterSigOpen, setMonterSigOpen] = useState(false)
  const [customerSig, setCustomerSig] = useState<string | null>(null)
  const [monterSig, setMonterSig] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState(initialCustomerName || '')
  const [customerLocation, setCustomerLocation] = useState('')
  const [generating, setGenerating] = useState(false)
  const customerSigRef = useRef<SignatureCanvas | null>(null)
  const monterSigRef = useRef<SignatureCanvas | null>(null)
  const { toast } = useToast()

  // ── V5: strežniške verzije ponudb ────────────────────────────────────────
  const [versions, setVersions] = useState<QuoteVersionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [issuing, setIssuing] = useState<string | null>(null)
  const [dolzinaM, setDolzinaM] = useState('3')
  const [visinaMm, setVisinaMm] = useState('1000')

  const selected = versions.find((v) => v.id === selectedId) ?? null
  /** Zaklep je mogoč SAMO nad izdano/odobreno verzijo (strežna vrata). */
  const lockable = selected !== null && (selected.status === 'ISSUED' || selected.status === 'APPROVED')

  const loadVersions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/quotes?projectId=${projectId}`)
      if (res.ok) {
        const data = await res.json()
        const list: QuoteVersionDto[] = Array.isArray(data.versions) ? data.versions : []
        setVersions(list)
        // Samodejna izbira: zadnja zaklepna (ISSUED/APPROVED) ali zadnja sploh.
        setSelectedId((prev) => {
          if (prev && list.some((v) => v.id === prev)) return prev
          const lockableVerzija = list.find((v) => v.status === 'ISSUED' || v.status === 'APPROVED')
          return lockableVerzija?.id ?? list[0]?.id ?? null
        })
      } else if (res.status === 503) {
        toast({ title: 'Ni aktivnega cenika', description: 'Ponudb ni mogoče izračunati (ni aktivne verzije cenika).', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Napaka pri branju ponudb', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => {
    void loadVersions()
  }, [loadVersions])

  /** Naloži postavke izbrane verzije (detajl endpoint — vir za PDF). */
  useEffect(() => {
    if (!selectedId || selected?.lines) return
    let cancelled = false
    const nalozi = async () => {
      try {
        const res = await fetch(`/api/quotes/${selectedId}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (data.version?.lines) {
          setVersions((prev) => prev.map((v) => (v.id === selectedId ? { ...v, lines: data.version.lines } : v)))
        }
      } catch {
        /* tiho — detajl se naloži ob naslednjem retryju */
      }
    }
    void nalozi()
    return () => {
      cancelled = true
    }
  }, [selectedId, selected?.lines])

  /** Hitra ponudba: dolžina/višina → strežniški izračun iz aktivne knjige. */
  const handleCreateQuote = useCallback(async () => {
    const dolzina = Number(dolzinaM.replace(',', '.'))
    const visina = Number(visinaMm)
    if (!Number.isFinite(dolzina) || dolzina <= 0 || dolzina > 100) {
      toast({ title: 'Neveljavna dolžina', description: 'Vpišite dolžino v metrih (0–100).', variant: 'destructive' })
      return
    }
    if (!Number.isFinite(visina) || visina < 300 || visina > 3000) {
      toast({ title: 'Neveljavna višina', description: 'Vpišite višino v mm (300–3000).', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          points: [
            { xM: 0, yM: 0, zM: 0 },
            { xM: Math.round(dolzina * 1000) / 1000, yM: 0, zM: 0 },
          ],
          closed: false,
          spec: { heightMm: Math.round(visina) },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.version) {
        toast({
          title: `Ponudba v${data.version.versionNumber} ustvarjena (osnutek)`,
          description: `Skupaj z DDV: ${Number(data.version.total).toFixed(2)} € · cenik v${data.version.priceBookVersion?.version ?? '—'}`,
        })
        setSelectedId(null)
        await loadVersions()
      } else {
        toast({ title: 'Ponudbe ni bilo mogoče ustvariti', description: data.error || `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka pri ustvarjanju ponudbe', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }, [dolzinaM, visinaMm, projectId, loadVersions, toast])

  /** Izdaja osnutka: DRAFT → ISSUED (strežnik preveri integriteto). */
  const handleIssue = useCallback(async (versionId: string) => {
    setIssuing(versionId)
    try {
      const res = await fetch(`/api/quotes/${versionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'issue' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ title: 'Verzija izdana', description: 'Zdaj jo je mogoče podpisati in zakleniti.' })
        await loadVersions()
      } else {
        toast({ title: 'Izdaja ni uspela', description: data.error || `HTTP ${res.status}`, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Omrežna napaka pri izdaji', variant: 'destructive' })
    } finally {
      setIssuing(null)
    }
  }, [loadVersions, toast])

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

  /** PDF iz postavk IZBRAE verzije (strežniška resnica — ne klientovi izračuni). */
  const handleGeneratePdf = useCallback(async () => {
    if (!selected) return
    if (!lockable) {
      toast({ title: 'Izdajte verzijo pred podpisom', description: 'Podpisuje se samo izdana (ISSUED) verzija.', variant: 'destructive' })
      return
    }
    if (!selected.lines) {
      toast({ title: 'Postavke se še nalagajo', description: 'Poskusite znova čez trenutek', variant: 'destructive' })
      return
    }
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
      // Postavke verzije → PDF vrstice (ISTI vir kot zaklep).
      const items = selected.lines.map((l) => ({
        opis: `${l.name}${l.detail ? ` — ${l.detail}` : ''}`,
        kolicina: String(l.qty),
        enota: l.unit,
        cena: l.unitPrice.toFixed(2),
        skupaj: l.total.toFixed(2),
      }))
      const skupajBrezDDV = selected.subtotal
      const ddv = selected.vat
      const skupajZDDV = selected.total

      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      // R353 — slovenski glifi: Roboto subset (kanon r269/R351/R352 — kliči
      // pred prvo setFont; VFS je na dokumentu, registracija je idempotentna).
      registerSloPdfFonts(doc)
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
      doc.setFont('Roboto', 'bold')
      doc.text('R', 19, 19)
      doc.setFontSize(15)
      doc.text('ROKSAL d.o.o.', 32, 15)
      doc.setFontSize(9)
      doc.setFont('Roboto', 'normal')
      doc.text('Kranj · Ograje in terase po meri', 32, 21)
      doc.setFontSize(14)
      doc.setFont('Roboto', 'bold')
      doc.text('PONUDBA S PODPISOM', pageW - 14, 15, { align: 'right' })
      doc.setFontSize(8)
      doc.setFont('Roboto', 'normal')
      doc.text(slDatumKratko(new Date()), pageW - 14, 21, { align: 'right' })

      let y = 44
      // Stranka
      doc.setTextColor(...COLORS.dark)
      doc.setFontSize(11)
      doc.setFont('Roboto', 'bold')
      doc.text('STRANKA', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.setLineWidth(0.5)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 6
      doc.setFontSize(9)
      doc.setFont('Roboto', 'normal')
      doc.text(`Ime: ${customerName || initialCustomerName}`, 14, y)
      doc.text(`Naslov: ${customerAddress}`, 14, y + 5)
      if (customerPhone) {
        doc.text(`Telefon: ${customerPhone}`, 14, y + 10)
      }
      y += 18

      // Projekt + verzija (sledljivost kanonične verige)
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(11)
      doc.text('PROJEKT', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 6
      doc.setFont('Roboto', 'normal')
      doc.setFontSize(9)
      doc.text(`${projectName} · verzija ${selected.versionNumber} (${selected.status})`, 14, y)
      y += 8

      // Postavke
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(11)
      doc.text('POSTAVKE', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 4

      // Tabela postavk
      doc.setFontSize(8)
      doc.setFont('Roboto', 'bold')
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
      doc.setFont('Roboto', 'normal')
      items.forEach((item, i) => {
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

      // Skupaj (seštevki VERZIJE)
      doc.setFillColor(...COLORS.navy)
      doc.rect(pageW - 80, y, 66, 22, 'F')
      doc.setTextColor(...COLORS.white)
      doc.setFontSize(9)
      doc.setFont('Roboto', 'normal')
      doc.text('Brez DDV:', pageW - 76, y + 6)
      doc.text(`${skupajBrezDDV.toFixed(2)} €`, pageW - 18, y + 6, { align: 'right' })
      doc.text('DDV (22%):', pageW - 76, y + 12)
      doc.text(`${ddv.toFixed(2)} €`, pageW - 18, y + 12, { align: 'right' })
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(11)
      doc.text('SKUPAJ:', pageW - 76, y + 19)
      doc.text(`${skupajZDDV.toFixed(2)} €`, pageW - 18, y + 19, { align: 'right' })

      y += 30

      // Pogoji
      doc.setTextColor(...COLORS.gray)
      doc.setFontSize(7)
      doc.setFont('Roboto', 'normal')
      const veljavnost = 30
      const pogoji = `Ponudba velja ${veljavnost} dni. Cena vključuje material in montažo. Garancija 15 let na WPC. Plačilo: 50% akontacija ob naročilu, 50% ob prevzemu.`
      const pogojiLines = doc.splitTextToSize(pogoji, pageW - 28)
      doc.text(pogojiLines, 14, y)
      y += pogojiLines.length * 3.5 + 6

      // Podpisni del
      doc.setTextColor(...COLORS.dark)
      doc.setFontSize(11)
      doc.setFont('Roboto', 'bold')
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
      doc.setFont('Roboto', 'normal')
      doc.setTextColor(...COLORS.dark)
      doc.text('Stranka:', podpisLevi, y + 30)
      doc.text(customerName || initialCustomerName, podpisLevi + 18, y + 30)
      doc.text('Monter:', podpisDesni, y + 30)
      doc.text(monterName, podpisDesni + 16, y + 30)

      doc.setFontSize(7)
      doc.setTextColor(...COLORS.gray)
      doc.text(`Datum: ${slDatumKratko(new Date())}`, podpisLevi, y + 34)
      if (customerLocation) {
        doc.text(`Kraj: ${customerLocation}`, podpisLevi, y + 37)
      }
      doc.text(`Datum: ${slDatumKratko(new Date())}`, podpisDesni, y + 34)
      doc.text('Roksal d.o.o. Kranj', podpisDesni, y + 37)

      // Noga
      doc.setFontSize(7)
      doc.setTextColor(...COLORS.gray)
      doc.text('Roksal d.o.o. Kranj · Podpisana ponudba · Veljaven pravni dokument', 14, 290)
      doc.text('Stran 1/1', pageW - 14, 290, { align: 'right' })

      const filename = `Roksal-ponudba-podpisana-${(projectName || 'projekt').replace(/\s+/g, '-')}.pdf`
      doc.save(filename)
      toast({ title: 'PDF s podpisom generiran', description: filename })

      // V5 — kanonični deal-lock nad IZBRANO verzijo (quoteVersionId; brez
      // klientovega quoteData — strežnik sam prebere postavke verzije).
      if (projectId && selected && customerSig && monterSig) {
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
              quoteVersionId: selected.id,
              customerName: customerName || initialCustomerName,
              monterName,
              customerSignature: customerSig,
              monterSignature: monterSig,
              geoLatitude: geo.lat,
              geoLongitude: geo.lon,
            }),
          })
          if (dealRes.ok) {
            const deal = await dealRes.json()
            toast({
              title: '✓ Deal zaklenjen (V5 — kanonična verzija)',
              description: `Status → ZA_MONTAZO · BOM draft: ${deal.bomDraft?.items?.length || 0} art. · Vrednost: ${Number(deal.estimatedPrice ?? 0).toFixed(0)} €${deal.marginLocked === null || deal.marginLocked === undefined ? ' · Marža: NEZNANA (manjkajo nabavne cene)' : ` · Marža: ${Number(deal.marginLocked).toFixed(0)} €`}`,
            })
            onDealLocked?.()
          } else {
            const err = await dealRes.json().catch(() => ({}))
            if (dealRes.status === 409) {
              toast({ title: 'Zaklep zavrnjen', description: err.error || 'Deal je že zaklenjen', variant: 'destructive' })
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
  }, [selected, lockable, customerSig, monterSig, customerName, customerLocation, projectName, initialCustomerName, monterName, projectId, onDealLocked, toast])

  // R167 dark pariteta: fallback badge nosi dark: dvojčka (vzorec DRAFT zgoraj).
  const badgeFor = (status: string) => STATUS_BADGE[status] ?? { label: status, cls: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700' }

  return (
    <Card className="border-roksal-amber/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Pen aria-hidden="true" className="h-5 w-5 text-roksal-amber" />
          Ponudba s podpisom
          <Badge variant="secondary" className="ml-auto text-[9px] bg-roksal-amber/10 text-roksal-amber">
            V5 — kanonične verzije
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hitra ponudba — strežniški izračun iz aktivne knjige */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-xs font-medium text-roksal-ink">Hitra ponudba (strežniški izračun iz aktivnega cenika)</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="hq-dolzina" className="text-xs">Dolžina (m)</Label>
              <Input
                id="hq-dolzina"
                inputMode="decimal"
                value={dolzinaM}
                onChange={(e) => setDolzinaM(e.target.value)}
                placeholder="npr. 3,5"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="hq-visina" className="text-xs">Višina (mm)</Label>
              <Input
                id="hq-visina"
                inputMode="numeric"
                value={visinaMm}
                onChange={(e) => setVisinaMm(e.target.value)}
                placeholder="npr. 1000"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleCreateQuote}
            disabled={creating}
            className="w-full bg-roksal-navy text-white hover:bg-roksal-navy/90"
          >
            <Plus aria-hidden="true" className="mr-1 h-4 w-4" />
            {creating ? 'Ustvarjam…' : 'Ustvari ponudbo (osnutek)'}
          </Button>
        </div>

        {/* Seznam verzij projekta */}
        <div>
          <p className="text-xs font-medium text-roksal-ink mb-1">Verzije ponudb projekta</p>
          {loading ? (
            <p className="text-xs text-muted-foreground py-3 text-center">Nalagam…</p>
          ) : versions.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-border p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">Projekt še nima nobene ponudbe.</p>
              <p className="text-2xs text-muted-foreground">Zgornji obrazec ustvari prvo kanonično verzijo.</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border" role="list" aria-label="Verzije ponudb">
              {versions.map((v) => {
                const badge = badgeFor(v.status)
                const isSel = v.id === selectedId
                return (
                  <div
                    key={v.id}
                    role="listitem"
                    className={`flex items-center gap-2 p-2 text-xs transition-colors ${isSel ? 'bg-roksal-amber/10' : 'hover:bg-muted/50'}`}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant={isSel ? 'secondary' : 'ghost'}
                      className="h-7 flex-1 justify-start text-left"
                      onClick={() => setSelectedId(v.id)}
                      aria-pressed={isSel}
                    >
                      <span className="font-medium text-roksal-ink">v{v.versionNumber}</span>
                      <Badge variant="outline" className={`ml-2 text-[9px] ${badge.cls}`}>{badge.label}</Badge>
                      <span className="ml-auto font-bold text-roksal-amber">{v.total.toFixed(2)} €</span>
                    </Button>
                    {v.status === 'DRAFT' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] shrink-0"
                        onClick={() => handleIssue(v.id)}
                        disabled={issuing === v.id}
                        title="Izdaj verzijo (DRAFT → ISSUED)"
                      >
                        <Send aria-hidden="true" className="mr-1 h-3 w-3" />
                        {issuing === v.id ? 'Izdajam…' : 'Izdaj'}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pregled izbrane verzije */}
        {selected && (
          <div className="rounded-lg border border-border bg-card p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verzija:</span>
              <span className="font-medium text-roksal-ink">v{selected.versionNumber} · {badgeFor(selected.status).label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Projekt:</span>
              <span className="font-medium text-roksal-ink">{projectName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stranka:</span>
              <span className="font-medium text-roksal-ink">{initialCustomerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Skupaj z DDV:</span>
              <span className="font-bold text-roksal-amber">{selected.total.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Postavk:</span>
              <span className="font-medium">{selected.lines?.length ?? '…'}</span>
            </div>
            <div className="flex justify-between text-2xs text-muted-foreground">
              <span>Odtis:</span>
              <span className="font-mono">{selected.inputHash.slice(0, 12)}…</span>
            </div>
          </div>
        )}

        {/* Vnos imena stranke */}
        <div>
          <Label htmlFor="sq-ime" className="text-xs">Ime stranke (za podpis)</Label>
          <Input
            id="sq-ime"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="npr. Andrej Kokalj"
            className="h-9 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="sq-kraj" className="text-xs">Kraj podpisa (opcijsko)</Label>
          <Input
            id="sq-kraj"
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
              <User aria-hidden="true" className="h-4 w-4 text-roksal-ink" />
              <span className="text-xs font-medium">Podpis stranke</span>
            </div>
            {customerSig ? (
              <div className="space-y-2">
                <img src={customerSig} alt="Podpis stranke" className="h-16 w-full object-contain" />
                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800 text-[9px]">
                  <Check aria-hidden="true" className="h-3 w-3 mr-1" /> Podpisano
                </Badge>
                <Button type="button" size="sm" variant="ghost" className="h-6 w-full text-2xs" onClick={() => setCustomerSigOpen(true)}>
                  Spremeni
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" className="w-full bg-roksal-navy text-white" onClick={() => setCustomerSigOpen(true)}>
                <Pen aria-hidden="true" className="h-3 w-3 mr-1" /> Podpiši
              </Button>
            )}
          </div>

          {/* Monter */}
          <div className="rounded-lg border-2 border-dashed border-border p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-2">
              <User aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
              <span className="text-xs font-medium">Podpis monterja</span>
            </div>
            {monterSig ? (
              <div className="space-y-2">
                <img src={monterSig} alt="Podpis monterja" className="h-16 w-full object-contain" />
                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800 text-[9px]">
                  <Check aria-hidden="true" className="h-3 w-3 mr-1" /> Podpisano
                </Badge>
                <Button type="button" size="sm" variant="ghost" className="h-6 w-full text-2xs" onClick={() => setMonterSigOpen(true)}>
                  Spremeni
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" className="w-full bg-roksal-amber text-white" onClick={() => setMonterSigOpen(true)}>
                <Pen aria-hidden="true" className="h-3 w-3 mr-1" /> Podpiši
              </Button>
            )}
          </div>
        </div>

        {/* Generiraj PDF + zaklep nad IZBRANO verzijo */}
        <Button
          type="button"
          onClick={handleGeneratePdf}
          disabled={generating || !customerSig || !monterSig || !lockable}
          className="w-full bg-roksal-navy text-white hover:bg-roksal-navy/90"
        >
          {generating ? (
            <>
              <FileText aria-hidden="true" className="mr-2 h-4 w-4 animate-pulse" />
              Generiram PDF...
            </>
          ) : (
            <>
              <Download aria-hidden="true" className="mr-2 h-4 w-4" />
              Podpiši in zakleni verzijo v{selected?.versionNumber ?? '—'}
            </>
          )}
        </Button>

        {(!customerSig || !monterSig) && lockable && (
          <p className="text-center text-2xs text-roksal-ink">
            {!customerSig && !monterSig
              ? 'Oba podpisa (stranka + monter) sta potrebna'
              : !customerSig
                ? 'Podpis stranke manjka'
                : 'Podpis monterja manjka'}
          </p>
        )}
        {selected && !lockable && (
          <p className="text-center text-2xs text-muted-foreground">
            {selected.status === 'DRAFT'
              ? 'Osnutek se ne podpisuje — najprej ga izdajte (gumb Izdaj).'
              : `Verzija v statusu ${selected.status} ni zaklepna.`}
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
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <Pen aria-hidden="true" className="h-5 w-5 text-roksal-amber" />
              Podpis stranke
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Stranka naj podpiše s prstom na spodnjem platnu. Podpis se uporabi za PDF ponudbo.
            </p>
            <div className="rounded-lg border-2 border-roksal-navy/20 dark:border-roksal-ink/20 bg-white"> {/* PODPISNO PLATNO — belo v OBEH temah (črnilo + izvoz PDF), nič ne spreminjamo */}
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
                <Eraser aria-hidden="true" className="h-4 w-4 mr-1" /> Počisti
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCustomerSigOpen(false)}>
                <X aria-hidden="true" className="h-4 w-4 mr-1" /> Prekliči
              </Button>
              <Button type="button" className="flex-1 bg-roksal-navy text-white" onClick={handleSaveCustomerSig}>
                <Check aria-hidden="true" className="h-4 w-4 mr-1" /> Shrani
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: podpis monterja */}
      <Dialog open={monterSigOpen} onOpenChange={setMonterSigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-ink">
              <Pen aria-hidden="true" className="h-5 w-5 text-roksal-amber" />
              Podpis monterja
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Monter naj podpiše s prstom na spodnjem platnu.
            </p>
            <div className="rounded-lg border-2 border-roksal-amber/30 bg-white"> {/* PODPISNO PLATNO — belo v OBEH temah (črnilo + izvoz PDF), nič ne spreminjamo */}
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
                <Eraser aria-hidden="true" className="h-4 w-4 mr-1" /> Počisti
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => setMonterSigOpen(false)}>
                <X aria-hidden="true" className="h-4 w-4 mr-1" /> Prekliči
              </Button>
              <Button type="button" className="flex-1 bg-roksal-amber text-white" onClick={handleSaveMonterSig}>
                <Check aria-hidden="true" className="h-4 w-4 mr-1" /> Shrani
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
