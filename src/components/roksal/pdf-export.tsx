'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { FileDown, Loader2, FileText, FileCheck2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Project {
  id: string
  nazivProjekta: string
  status: string
  datumMontaze?: string | null
  opombe?: string | null
  customer?: { ime: string; naslov: string; telefon?: string | null }
  monter?: { ime: string }
  measurements?: Array<{ dolzinaMm: number; visinaMm: number; createdAt: string }>
}

interface Photo {
  id: string
  kategorija: string
  imageData: string
  opomba: string | null
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  NACRTOVANO: 'Načrtovano',
  V_TEKU: 'V teku',
  ZAKLJUCENO: 'Zaključeno',
  USTAVLJENO: 'Ustavljeno',
}

const COLORS = {
  navy: [29, 43, 62] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  dark: [17, 24, 39] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  lightGray: [229, 231, 235] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

export function PdfExport({ project }: { project: Project | null }) {
  const [generating, setGenerating] = useState<'work' | 'quote' | null>(null)
  const { toast } = useToast()

  async function fetchProjectData(projectId: string) {
    const [measRes, photoRes] = await Promise.all([
      fetch(`/api/measurements?projectId=${projectId}`),
      fetch(`/api/photos?projectId=${projectId}`),
    ])
    const measurements = measRes.ok ? await measRes.json() : []
    const photos = photoRes.ok ? await photoRes.json() : []
    return { measurements, photos: photos as Photo[] }
  }

  async function generateWorkSheet() {
    if (!project) {
      toast({ title: 'Brez projekta', description: 'Izberite projekt v zavihku Domov.', variant: 'destructive' })
      return
    }
    setGenerating('work')
    try {
      const { measurements, photos } = await fetchProjectData(project.id)
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      let y = 0

      // Glava — navy pas
      doc.setFillColor(...COLORS.navy)
      doc.rect(0, 0, pageW, 28, 'F')
      // Logo blok (amber)
      doc.setFillColor(...COLORS.amber)
      doc.rect(14, 8, 12, 12, 'F')
      doc.setTextColor(...COLORS.white)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('R', 18, 17)
      // Naslov
      doc.setFontSize(14)
      doc.text('ROKSAL d.o.o. Kranj', 30, 14)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Delovni list monterja', 30, 20)

      // Datum desno
      doc.setFontSize(8)
      doc.text(new Date().toLocaleDateString('sl-SI'), pageW - 14, 14, { align: 'right' })
      doc.text(`Št: ${project.id.slice(-6).toUpperCase()}`, pageW - 14, 20, { align: 'right' })

      y = 38
      // Podatki o projektu
      doc.setTextColor(...COLORS.dark)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('PODATKI O PROJEKTU', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.setLineWidth(0.5)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 6

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const left = [
        `Naziv: ${project.nazivProjekta}`,
        `Stranka: ${project.customer?.ime ?? '—'}`,
        `Naslov: ${project.customer?.naslov ?? '—'}`,
        `Telefon: ${project.customer?.telefon ?? '—'}`,
      ]
      const right = [
        `Status: ${STATUS_LABELS[project.status] ?? project.status}`,
        `Monter: ${project.monter?.ime ?? '—'}`,
        `Datum montaže: ${project.datumMontaze ? new Date(project.datumMontaze).toLocaleDateString('sl-SI') : '—'}`,
        `Datum izpisa: ${new Date().toLocaleDateString('sl-SI')}`,
      ]
      left.forEach((line, i) => doc.text(line, 14, y + i * 5))
      right.forEach((line, i) => doc.text(line, pageW / 2, y + i * 5))
      y += left.length * 5 + 4

      //Meritve
      if (measurements.length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('MERITVE', 14, y)
        doc.setDrawColor(...COLORS.amber)
        doc.line(14, y + 1.5, pageW - 14, y + 1.5)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['#', 'Dolžina (mm)', 'Višina (mm)', 'Datum meritve']],
          body: measurements.map((m: { dolzinaMm: number; visinaMm: number; createdAt: string }, i: number) => [
            String(i + 1),
            String(m.dolzinaMm),
            String(m.visinaMm),
            new Date(m.createdAt).toLocaleDateString('sl-SI'),
          ]),
          theme: 'grid',
          headStyles: { fillColor: COLORS.navy, fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        })
         
        y = (doc as any).lastAutoTable.finalY + 8
      }

      // Slike — pred/med/po (max 3 na stran)
      const katOrder = ['PRED', 'MED', 'PO'] as const
      const katLabels: Record<string, string> = { PRED: 'PRED MONTAŽO', MED: 'MED MONTAŽO', PO: 'PO MONTAŽI' }
      const photosByKat = katOrder.map((k) => ({ kat: k, items: photos.filter((p) => p.kategorija === k) })).filter((g) => g.items.length > 0)

      if (photosByKat.length > 0) {
        for (const group of photosByKat) {
          if (y > 250) {
            doc.addPage()
            y = 20
          }
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          doc.setTextColor(...COLORS.dark)
          doc.text(katLabels[group.kat], 14, y)
          doc.setDrawColor(...COLORS.amber)
          doc.line(14, y + 1.5, pageW - 14, y + 1.5)
          y += 6

          // 2 sliki na vrstico
          const imgs = group.items.slice(0, 4)
          for (let i = 0; i < imgs.length; i++) {
            const col = i % 2
            const row = Math.floor(i / 2)
            const x = 14 + col * (pageW / 2 - 7)
            const imgY = y + row * 55
            if (imgY > 260) break
            try {
              doc.addImage(imgs[i].imageData, 'JPEG', x, imgY, pageW / 2 - 18, 40)
            } catch {
              /* skip corrupt */
            }
            doc.setFontSize(7)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(...COLORS.gray)
            doc.text(new Date(imgs[i].createdAt).toLocaleString('sl-SI'), x, imgY + 44)
          }
          y += Math.ceil(imgs.length / 2) * 55 + 4
        }
      }

      // Opombe
      if (project.opombe) {
        if (y > 260) {
          doc.addPage()
          y = 20
        }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(...COLORS.dark)
        doc.text('OPOMBE', 14, y)
        doc.setDrawColor(...COLORS.amber)
        doc.line(14, y + 1.5, pageW - 14, y + 1.5)
        y += 6
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        const lines = doc.splitTextToSize(project.opombe, pageW - 28)
        doc.text(lines, 14, y)
        y += lines.length * 4 + 6
      }

      // Podpiši
      if (y > 250) {
        doc.addPage()
        y = 20
      }
      doc.setDrawColor(...COLORS.dark)
      doc.setLineWidth(0.2)
      doc.line(20, y + 15, 90, y + 15)
      doc.line(pageW - 90, y + 15, pageW - 20, y + 15)
      doc.setFontSize(8)
      doc.text('Monter', 30, y + 19)
      doc.text('Stranka', pageW - 80, y + 19)

      // Noga
      const pages = doc.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(...COLORS.gray)
        doc.text('Roksal d.o.o. Kranj · Delovni list monterja', 14, 290)
        doc.text(`Stran ${i} / ${pages}`, pageW - 14, 290, { align: 'right' })
      }

      doc.save(`Roksal-delovni-${project.nazivProjekta.replace(/\s+/g, '-')}.pdf`)
      toast({ title: 'PDF generiran', description: 'Delovni list prenesen.' })
    } catch (e) {
      console.error(e)
      toast({ title: 'Napaka pri PDF', description: 'Generiranje ni uspelo.', variant: 'destructive' })
    } finally {
      setGenerating(null)
    }
  }

  async function generateQuote() {
    if (!project) {
      toast({ title: 'Brez projekta', description: 'Izberite projekt v zavihku Domov.', variant: 'destructive' })
      return
    }
    setGenerating('quote')
    try {
      const { measurements } = await fetchProjectData(project.id)
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      let y = 0

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
      doc.text('Kranj, Slovenija · Ograje in terase po meri', 32, 21)
      doc.text('PONUDBA', pageW - 14, 15, { align: 'right' })
      doc.setFontSize(8)
      doc.text(new Date().toLocaleDateString('sl-SI'), pageW - 14, 21, { align: 'right' })

      y = 44
      // Za & dobivalnik
      doc.setTextColor(...COLORS.dark)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('ZA:', 14, y)
      doc.setFont('helvetica', 'normal')
      doc.text(project.customer?.ime ?? '—', 30, y)
      doc.text(project.customer?.naslov ?? '—', 30, y + 5)
      doc.setFont('helvetica', 'bold')
      doc.text('DATUM:', pageW - 60, y)
      doc.setFont('helvetica', 'normal')
      doc.text(new Date().toLocaleDateString('sl-SI'), pageW - 14, y, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      doc.text('ŠT. PONUDBE:', pageW - 60, y + 5)
      doc.setFont('helvetica', 'normal')
      doc.text(`ROK-${project.id.slice(-6).toUpperCase()}`, pageW - 14, y + 5, { align: 'right' })

      y += 16
      doc.setDrawColor(...COLORS.amber)
      doc.setLineWidth(0.8)
      doc.line(14, y, pageW - 14, y)
      y += 8

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(project.nazivProjekta, 14, y)
      y += 8

      // Postavke iz meritev (ocena)
      const items = measurements.length > 0
        ? measurements.map((m: { dolzinaMm: number; visinaMm: number }, i: number) => {
            const dolzinaM = m.dolzinaMm / 1000
            const visinaM = m.visinaMm / 1000
            const povrsina = dolzinaM * visinaM
            const cenaM2 = 190 // privzeta WPC H-Line
            const skupaj = povrsina * cenaM2
            return {
              nr: i + 1,
              opis: `Ograja WPC H-Line — ${dolzinaM.toFixed(2)}m × ${visinaM.toFixed(2)}m`,
              kolicina: povrsina.toFixed(2),
              enota: 'm²',
              cena: cenaM2.toFixed(2),
              skupaj: skupaj.toFixed(2),
            }
          })
        : [{ nr: 1, opis: 'Ograja po meri (specifikacija po dogovoru)', kolicina: '1,00', enota: 'kos', cena: '0,00', skupaj: '0,00' }]

      autoTable(doc, {
        startY: y,
        head: [['#', 'Opis', 'Količina', 'Enota', 'Cena (€)', 'Skupaj (€)']],
        body: items.map((it: { nr: number; opis: string; kolicina: string; enota: string; cena: string; skupaj: string }) => [
          String(it.nr),
          it.opis,
          it.kolicina,
          it.enota,
          it.cena,
          it.skupaj,
        ]),
        theme: 'striped',
        headStyles: { fillColor: COLORS.navy, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 22, halign: 'right' }, 3: { cellWidth: 14, halign: 'center' }, 4: { cellWidth: 22, halign: 'right' }, 5: { cellWidth: 26, halign: 'right' } },
        margin: { left: 14, right: 14 },
      })
       
      y = (doc as any).lastAutoTable.finalY + 6

      const skupaj = items.reduce((s: number, it: { skupaj: string }) => s + parseFloat(it.skupaj.replace(',', '.')), 0)
      const ddv = skupaj * 0.22
      const total = skupaj + ddv

      // Skupaj
      doc.setFillColor(...COLORS.navy)
      doc.rect(pageW - 80, y, 66, 22, 'F')
      doc.setTextColor(...COLORS.white)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Vrednost:', pageW - 76, y + 6)
      doc.text(`${skupaj.toFixed(2)} €`, pageW - 18, y + 6, { align: 'right' })
      doc.text('DDV (22%):', pageW - 76, y + 12)
      doc.text(`${ddv.toFixed(2)} €`, pageW - 18, y + 12, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('SKUPAJ:', pageW - 76, y + 19)
      doc.text(`${total.toFixed(2)} €`, pageW - 18, y + 19, { align: 'right' })

      y += 30
      // Opomba
      doc.setTextColor(...COLORS.gray)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const note =
        'Ponudba velja 30 dni. Cena vključuje material in montažo. Garancija 15 let na WPC komponente. Plačilo: 50% akontacija ob naročilu, 50% ob prevzemu.'
      const noteLines = doc.splitTextToSize(note, pageW - 28)
      doc.text(noteLines, 14, y)
      y += noteLines.length * 4 + 10

      // Podpis
      doc.setDrawColor(...COLORS.dark)
      doc.setLineWidth(0.2)
      doc.line(pageW - 90, y, pageW - 20, y)
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.dark)
      doc.text('Roksal d.o.o. Kranj', pageW - 55, y + 4, { align: 'center' })

      // Noga
      doc.setFontSize(7)
      doc.setTextColor(...COLORS.gray)
      doc.text('Roksal d.o.o. Kranj · Ponudba', 14, 290)
      doc.text('Hvala za zaupanje!', pageW - 14, 290, { align: 'right' })

      doc.save(`Roksal-ponudba-${project.nazivProjekta.replace(/\s+/g, '-')}.pdf`)
      toast({ title: 'Ponudba generirana', description: 'PDF ponudba prenesen.' })
    } catch (e) {
      console.error(e)
      toast({ title: 'Napaka pri PDF', description: 'Generiranje ni uspelo.', variant: 'destructive' })
    } finally {
      setGenerating(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileDown className="h-5 w-5 text-roksal-amber" />
          Izvoz PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!project && (
          <p className="text-xs text-muted-foreground">Izberite projekt v zavihku Domov za izvoz dokumentacije.</p>
        )}
        <div className="grid grid-cols-1 gap-2">
          <Button
            type="button"
            onClick={generateWorkSheet}
            disabled={!project || generating !== null}
            variant="outline"
            className="h-auto justify-start border-roksal-navy/20 py-3"
          >
            {generating === 'work' ? (
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-roksal-amber" />
            ) : (
              <FileText className="mr-3 h-5 w-5 text-roksal-navy" />
            )}
            <div className="text-left">
              <div className="text-sm font-semibold text-roksal-navy">Delovni list monterja</div>
              <div className="text-[10px] text-muted-foreground">Meritve, slike pred/med/po, opombe, podpisi</div>
            </div>
          </Button>
          <Button
            type="button"
            onClick={generateQuote}
            disabled={!project || generating !== null}
            variant="outline"
            className="h-auto justify-start border-roksal-navy/20 py-3"
          >
            {generating === 'quote' ? (
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-roksal-amber" />
            ) : (
              <FileCheck2 className="mr-3 h-5 w-5 text-roksal-navy" />
            )}
            <div className="text-left">
              <div className="text-sm font-semibold text-roksal-navy">Ponudba za stranko</div>
              <div className="text-[10px] text-muted-foreground">Postavke, DDV, skupaj, pogoji, podpis</div>
            </div>
          </Button>
        </div>
        {project && (
          <Badge variant="secondary" className="w-fit text-[10px]">
            Aktivni projekt: {project.nazivProjekta}
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}
