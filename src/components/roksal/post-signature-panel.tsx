'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { slDatumKratko, slCasDolgo } from '@/lib/csv-export'
import {
  Lock,
  CheckCircle2,
  Package,
  TrendingUp,
  FileText,
  ShieldCheck,
  Clock,
  Loader2,
  AlertTriangle,
  Download,
} from 'lucide-react'
import jsPDF from 'jspdf'
import { registerSloPdfFonts } from '@/lib/pdf-sl-font'

import type { Project, SignatureAuditEntry } from '@/lib/types'

interface BomItem {
  kategorija: string
  naziv: string
  kolicina: number
  enota: string
  opomba?: string
  status: string
}

interface BomDraft {
  projectName: string
  generatedAt: string
  quoteTotal: number
  items: BomItem[]
  notes?: string
}

// SignatureAuditEntry moved to src/lib/types.ts — R395 (§16): API NE vrača
// več geoLatitude/geoLongitude/ipAddress/userAgent/deviceFingerprint
// (allowlist kanon §17 — nepotrebna občutljiva polja IZ DTO-ja); vrne pa
// §16 verigo (quoteVersionId/bomVersionId/documentVersionId), ki jo ta
// komponenta prikazuje.

export function PostSignaturePanel({ project }: { project: Project }) {
  const [loading, setLoading] = useState(true)
  const [bomDraft, setBomDraft] = useState<BomDraft | null>(null)
  const [audits, setAudits] = useState<SignatureAuditEntry[]>([])
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [bomRes, auditRes] = await Promise.all([
        fetch(`/api/bom-draft?projectId=${project.id}`),
        fetch(`/api/signature-audit?projectId=${project.id}`),
      ])
      if (bomRes.ok) {
        const bomData = await bomRes.json()
        setBomDraft(bomData.bomDraft || null)
      }
      if (auditRes.ok) {
        const auditData = await auditRes.json()
        setAudits(auditData.audits || [])
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExportAuditPdf = useCallback(async () => {
    setExporting(true)
    try {
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
      doc.text('AUDIT TRAIL — PODPISI', pageW - 14, 15, { align: 'right' })
      doc.setFontSize(8)
      doc.setFont('Roboto', 'normal')
      doc.text(`${slDatumKratko(new Date())}, ${slCasDolgo(new Date())}`, pageW - 14, 21, { align: 'right' })

      let y = 44
      // Projekt info
      doc.setTextColor(...COLORS.dark)
      doc.setFontSize(11)
      doc.setFont('Roboto', 'bold')
      doc.text('PROJEKT', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 6
      doc.setFontSize(9)
      doc.setFont('Roboto', 'normal')
      doc.text(`Naziv: ${project.nazivProjekta}`, 14, y)
      doc.text(`Stranka: ${project.customer?.ime || '—'}`, 14, y + 5)
      doc.text(`Status: ZA_MONTAZO (podpisano)`, 14, y + 10)
      if (project.dealLockedAt) {
        doc.text(`Datum podpisa: ${slDatumKratko(new Date(project.dealLockedAt))}, ${slCasDolgo(new Date(project.dealLockedAt))}`, 14, y + 15)
      }
      if (project.estimatedPrice) {
        doc.text(`Skupna cena: ${project.estimatedPrice.toFixed(2)} € z DDV`, 14, y + 20)
      }
      if (project.marginLocked) {
        doc.text(`Zaklenjena marža: ${project.marginLocked.toFixed(2)} €`, 14, y + 25)
      }
      y += 32

      // Podpisi audit
      doc.setFont('Roboto', 'bold')
      doc.setFontSize(11)
      doc.text('PODPISI (AUDIT TRAIL)', 14, y)
      doc.setDrawColor(...COLORS.amber)
      doc.line(14, y + 1.5, pageW - 14, y + 1.5)
      y += 6

      audits.forEach((a, i) => {
        if (y > 250) {
          doc.addPage()
          y = 20
        }
        doc.setFontSize(9)
        doc.setFont('Roboto', 'bold')
        doc.text(`${i + 1}. ${a.signatureType === 'CUSTOMER' ? 'STRANKA' : 'MONTER'}`, 14, y)
        doc.setFont('Roboto', 'normal')
        y += 5
        doc.text(`Ime: ${a.signedByName}`, 18, y)
        y += 4
        doc.text(`Datum: ${slDatumKratko(new Date(a.createdAt))}, ${slCasDolgo(new Date(a.createdAt))}`, 18, y)
        y += 4
        // R395 (§16): IP/fingerprint/GPS so IZ DTO-ja odstranjeni (nepotrebna
        // občutljiva polja — kanon deal-lock GET §17). Dodana je VERIGA
        // dokumenta (quote/dokument verzija).
        if (a.quoteVersionId) {
          doc.setFontSize(7)
          doc.text(`Verzija ponudbe: ${a.quoteVersionId}`, 18, y)
          doc.setFontSize(9)
          y += 4
        }
        if (a.documentVersionId) {
          doc.setFontSize(7)
          doc.text(`PDF verzija dokumenta: ${a.documentVersionId}`, 18, y)
          doc.setFontSize(9)
          y += 4
        }
        if (a.pdfHash) {
          doc.setFontSize(7)
          doc.text(`PDF hash: ${a.pdfHash.slice(0, 40)}...`, 18, y)
          doc.setFontSize(9)
          y += 4
        }
        y += 4
      })

      // BOM draft
      if (bomDraft && y < 230) {
        if (y > 240) {
          doc.addPage()
          y = 20
        }
        doc.setFont('Roboto', 'bold')
        doc.setFontSize(11)
        doc.text('BOM DRAFT (NE NAROČILO)', 14, y)
        doc.setDrawColor(...COLORS.amber)
        doc.line(14, y + 1.5, pageW - 14, y + 1.5)
        y += 6
        doc.setFontSize(8)
        doc.setFont('Roboto', 'normal')
        if (bomDraft.items.length === 0) {
          doc.text('Ni artiklov v BOM draft-u.', 14, y)
        } else {
          bomDraft.items.forEach((item, i) => {
            if (y > 270) {
              doc.addPage()
              y = 20
            }
            doc.text(`${i + 1}. [${item.kategorija}] ${item.naziv}`, 14, y)
            doc.text(`${item.kolicina} ${item.enota}`, 150, y)
            y += 4
            if (item.opomba) {
              doc.setFontSize(7)
              doc.setTextColor(...COLORS.gray)
              doc.text(`   Opomba: ${item.opomba}`, 14, y)
              doc.setTextColor(...COLORS.dark)
              doc.setFontSize(8)
              y += 4
            }
          })
        }
        if (bomDraft.notes) {
          y += 4
          doc.setFontSize(7)
          doc.setTextColor(...COLORS.gray)
          const noteLines = doc.splitTextToSize(bomDraft.notes, pageW - 28)
          doc.text(noteLines, 14, y)
        }
      }

      // Noga
      doc.setFontSize(7)
      doc.setTextColor(...COLORS.gray)
      doc.text('Roksal d.o.o. Kranj · Audit trail poročilo · Pravno veljaven dokument', 14, 290)

      doc.save(`Roksal-audit-trail-${project.id.slice(-6)}.pdf`)
      toast({ title: 'Audit trail PDF generiran' })
    } catch {
      toast({ title: 'Napaka pri PDF', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }, [project, bomDraft, audits, toast])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin mx-auto text-roksal-amber" />
          <p className="text-xs text-muted-foreground mt-2">Nalagam post-signature podatke...</p>
        </CardContent>
      </Card>
    )
  }

  if (!project.dealLocked) {
    return (
      <Card className="border-roksal-amber/40 bg-roksal-amber/10">
        <CardContent className="py-6 text-center">
          <Lock aria-hidden="true" className="h-8 w-8 mx-auto text-roksal-amber mb-2" />
          <p className="text-sm font-medium text-roksal-ink">Deal še ni zaklenjen</p>
          <p className="text-xs text-roksal-ink/80 mt-1">
            Po podpisu ponudbe (V4) se deal samodejno zaklene in aktivirajo post-signature avtomatizacije.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Status: DEAL LOCKED */}
      <Card className="border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/15">
              <Lock aria-hidden="true" className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-green-900 dark:text-green-200">DEAL ZAKLENJEN</span>
                <Badge className="bg-green-600 text-white text-[9px]">WON</Badge>
              </div>
              <p className="text-[11px] text-green-700 dark:text-green-300 mt-0.5">
                {project.dealLockedAt && `${slDatumKratko(new Date(project.dealLockedAt))}, ${slCasDolgo(new Date(project.dealLockedAt))}`}
              </p>
              <p className="text-2xs text-green-600 dark:text-green-400 mt-0.5">
                Stranka: {project.dealSignedBy} · Monter: {project.dealSignedByMonter}
              </p>
            </div>
            <Badge variant="outline" className="bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-200 border-green-300 dark:border-green-800">
              <ShieldCheck aria-hidden="true" className="h-3 w-3 mr-1" />
              ZA_MONTAZO
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 4 avtomatizacije */}
      <div className="grid grid-cols-2 gap-2">
        {/* 1. Deal Lock */}
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Lock aria-hidden="true" className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-[11px] font-semibold text-roksal-ink">Deal Lock</span>
              <CheckCircle2 aria-hidden="true" className="h-3 w-3 text-green-600 dark:text-green-400 ml-auto" />
            </div>
            <p className="text-2xs text-muted-foreground">
              Ponudba zaklenjena. Nič več editanja.
            </p>
          </CardContent>
        </Card>

        {/* 2. BOM Draft */}
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Package aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-[11px] font-semibold text-roksal-ink">BOM Draft</span>
              {bomDraft && (
                <Badge variant="outline" className="ml-auto text-3xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                  {bomDraft.items.length} art.
                </Badge>
              )}
            </div>
            <p className="text-2xs text-muted-foreground">
              {bomDraft ? 'Material draft generiran (ne naročilo)' : 'Ni še generiran'}
            </p>
          </CardContent>
        </Card>

        {/* 3. Project auto-create (status ZA_MONTAZO) */}
        <Card className="border-roksal-amber/40">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
              <span className="text-[11px] font-semibold text-roksal-ink">Projekt = ZA_MONTAZO</span>
              <CheckCircle2 aria-hidden="true" className="h-3 w-3 text-green-600 dark:text-green-400 ml-auto" />
            </div>
            <p className="text-2xs text-muted-foreground">
              Status samodejno spremenjen na &quot;Za montažo&quot;
            </p>
          </CardContent>
        </Card>

        {/* 4. Margin Lock */}
        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp aria-hidden="true" className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="text-[11px] font-semibold text-roksal-ink">Marža zaklenjena</span>
              {project.marginLocked && (
                <Badge variant="outline" className="ml-auto text-3xs bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                  {project.marginLocked.toFixed(0)} €
                </Badge>
              )}
            </div>
            <p className="text-2xs text-muted-foreground">
              {project.marginLocked ? `${project.marginLocked.toFixed(2)} € zaklenjene marže` : 'Ni na voljo'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* BOM Draft podrobnosti */}
      {bomDraft && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Package aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
              BOM Draft (Bill of Materials)
              <Badge variant="secondary" className="ml-auto text-[9px]">DRAFT</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg border border-border bg-muted/30 p-2 text-2xs text-muted-foreground italic">
              ⚠️ {bomDraft.notes || 'BOM draft — avtomatsko generiran iz podpisane ponudbe. Ni naročilo.'}
            </div>
            <div className="space-y-1">
              {bomDraft.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-border bg-white dark:bg-card p-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-3xs bg-muted/50">
                      {item.kategorija}
                    </Badge>
                    <span className="font-medium text-roksal-ink">{item.naziv}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-roksal-amber">
                      {item.kolicina} {item.enota}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {bomDraft.notes && (
              <p className="text-2xs text-muted-foreground pt-1">{bomDraft.notes}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit Trail */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-roksal-amber" />
            Audit Trail — Podpisi
            <Badge variant="outline" className="ml-auto text-[9px]">
              {audits.length} vnosa
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {audits.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-white dark:bg-card p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className={
                    a.signatureType === 'CUSTOMER'
                      ? 'text-[9px] bg-roksal-navy/10 text-roksal-ink border-roksal-navy/20 dark:border-roksal-ink/20'
                      : 'text-[9px] bg-roksal-amber/10 text-roksal-amber border-roksal-amber/30'
                  }
                >
                  {a.signatureType === 'CUSTOMER' ? 'STRANKA' : 'MONTER'}
                </Badge>
                <span className="text-xs font-semibold text-roksal-ink">{a.signedByName}</span>
                <CheckCircle2 aria-hidden="true" className="h-3 w-3 text-green-600 dark:text-green-400 ml-auto" />
              </div>
              <div className="grid grid-cols-2 gap-1 text-2xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock aria-hidden="true" className="h-2.5 w-2.5" />
                  {`${slDatumKratko(new Date(a.createdAt))}, ${slCasDolgo(new Date(a.createdAt))}`}
                </div>
                {/* R395 (§16): IP/GPS/fingerprint so IZ DTO-ja odstranjeni
                    (nepotrebna občutljiva polja — kanon §17 allowlist);
                    prikazana je VERIGA dokumenta. */}
                {a.documentVersionId && (
                  <div className="truncate">PDF: {a.documentVersionId.slice(0, 12)}…</div>
                )}
                {a.quoteVersionId && (
                  <div className="truncate">Ponudba: {a.quoteVersionId.slice(0, 12)}…</div>
                )}
              </div>
              {a.pdfHash && (
                <div className="mt-1 text-3xs text-muted-foreground truncate font-mono">
                  PDF hash: {a.pdfHash.slice(0, 32)}...
                </div>
              )}
            </div>
          ))}
          {audits.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Ni audit vnosov</p>
          )}
        </CardContent>
      </Card>

      {/* Izvoz audit PDF */}
      <Button
        type="button"
        onClick={handleExportAuditPdf}
        disabled={exporting}
        className="w-full bg-roksal-navy text-white hover:bg-roksal-navy/90"
      >
        {exporting ? (
          <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download aria-hidden="true" className="mr-2 h-4 w-4" />
        )}
        Izvozi Audit Trail PDF
      </Button>

      {/* Legal disclaimer */}
      <div className="rounded-lg border border-roksal-amber/40 bg-roksal-amber/10 p-2 text-2xs text-roksal-ink">
        <AlertTriangle aria-hidden="true" className="h-3 w-3 inline mr-1" />
        Deal je zaklenjen z avtomatskim sistemom. Vsa dejanja so zabeležena v audit trail
        z IP, device fingerprint in časom. Podpisana PDF ponudba je pravno veljaven dokument.
      </div>
    </div>
  )
}
