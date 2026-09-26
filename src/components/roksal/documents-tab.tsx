'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  FileText,
  PenLine,
  FileCheck,
  ScrollText,
  Download,
  Eye,
  Clock,
  CheckCircle2,
  Loader2,
  FolderOpen,

  FileStack,
} from 'lucide-react'
import { toast } from 'sonner'

interface DocumentItem {
  id: string
  tipDokumenta: string
  pdfUrl?: string | null
  status: string
  createdAt: string
  projectId: string
  // R151 (§35): reprodukcija — verzija + sha256 odtis iz API-ja (iskreno;
  // manjkajoča polja = podatka ni, ne izmišljujemo).
  verzija?: number
  sha256?: string | null
  storageKey?: string | null
  versions?: { version: number; storageKey?: string; sha256?: string }[]
}

interface Project {
  id: string
  nazivProjekta: string
}

const docTypeLabels: Record<string, string> = {
  TEHNICNI_LIST: 'Tehnični list',
  PRIMOPREDAJA: 'Primopredaja',
  E_RACUN: 'E-račun',
  ZAPISNIK_NAVORA: 'Zapisnik navora',
}

const docTypeIcons: Record<string, React.ElementType> = {
  TEHNICNI_LIST: FileText,
  PRIMOPREDAJA: PenLine,
  E_RACUN: ScrollText,
  ZAPISNIK_NAVORA: FileCheck,
}

const statusConfig: Record<string, { label: string; color: string }> = {
  GENERIRANO: { label: 'Generirano', color: 'bg-roksal-green/15 text-roksal-green' },
  PODPISANO: { label: 'Podpisano', color: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-200' },
  POSLANO: { label: 'Poslano', color: 'bg-roksal-amber/15 text-roksal-ink' },
}

const quickActions = [
  { id: 'TEHNICNI_LIST', label: 'Tehnični list', icon: FileText, desc: 'Specifikacija materialov' },
  { id: 'PRIMOPREDAJA', label: 'Primopredaja', icon: PenLine, desc: 'Podpis stranke' },
  { id: 'E_RACUN', label: 'E-račun', icon: ScrollText, desc: 'Elektronski račun' },
  { id: 'ZAPISNIK_NAVORA', label: 'Zapisnik navora', icon: FileCheck, desc: 'Dnevnik dela' },
]

export function DocumentsTab() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [docLoading, setDocLoading] = useState(false)

  // Document preview dialog
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // R176 — stabilen fail-verbose loader (EN VIR napak, žičen tudi na
  // useRefetchOnFocus): prej fetchData (nestabilna funkcija v useEffect).
  // Ob osvežitvi ob fokusu NE resetiramo izbire projekta — dokumente osvežimo
  // za TRENUTNO izbrani projekt; auto-izbira prvega SAMO ko izbire še ni
  // (prvi load; dokumente za sveže izbrani projekt naloži obstoječi
  // selectedProject useEffect — nič dvojnega fetcha).
  const selectedProjectRef = useRef(selectedProject)
  useEffect(() => {
    selectedProjectRef.current = selectedProject
  }, [selectedProject])

  const loadAll = useCallback(async () => {
    try {
      const projRes = await fetch('/api/projects')
      if (projRes.ok) {
        const projData = await projRes.json()
        setProjects(projData)
        if (!selectedProjectRef.current && projData.length > 0) {
          setSelectedProject(projData[0].id)
          return
        }
      } else {
        // R151: brez demo projekatov/dokumentov — prazen + izrecna napaka.
        setProjects([])
        toast.error('Projektov ni mogoče naložiti (napaka strežnika)')
      }
      const pid = selectedProjectRef.current
      if (pid) {
        const docRes = await fetch(`/api/documents?projectId=${pid}`)
        if (docRes.ok) {
          const docData = await docRes.json()
          setDocuments(docData)
        } else {
          // R151: napaka je izrecna — ne pusti zastarelih podatkov kot lažno varnost.
          setDocuments([])
          toast.error('Dokumentov ni mogoče naložiti (napaka strežnika)')
        }
      }
    } catch {
      setProjects([])
      setDocuments([])
      toast.error('Povezava ni uspela — podatki niso na voljo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // R176 (iz R175 kandidatov) — vrnitev v zavihek/okno → ponovno naloži
  // projekte + dokumente izbranega projekta (pisarna dodaja dokumente v drugi
  // seji; terenski pregled ostane zastarel do remonta). loadAll je
  // fail-verbose — hook ne požira napak.
  useRefetchOnFocus(loadAll)

  useEffect(() => {
    if (!selectedProject || loading) return
    async function fetchDocs() {
      try {
        const docRes = await fetch(`/api/documents?projectId=${selectedProject}`)
        if (docRes.ok) {
          const docData = await docRes.json()
          setDocuments(docData)
        } else {
          // R151: napaka je izrecna — ne pusti zastarelih podatkov kot lažno varnost.
          setDocuments([])
          toast.error('Dokumentov ni mogoče naložiti (napaka strežnika)')
        }
      } catch {
        toast.error('Povezava ni uspela — podatki niso na voljo')
      }
    }
    fetchDocs()
  }, [selectedProject, loading])

  async function handleGenerateDoc(type: string) {
    if (!selectedProject) {
      toast.error('Izberite projekt za generiranje dokumenta')
      return
    }
    setDocLoading(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          tipDokumenta: type,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setDocuments((prev) => [
          {
            id: data.id,
            tipDokumenta: data.tipDokumenta,
            pdfUrl: data.url ?? null,
            status: data.status,
            createdAt: data.createdAt ?? new Date().toISOString(),
            projectId: data.projectId ?? selectedProject,
            verzija: data.verzija,
            sha256: data.sha256,
            storageKey: data.storageKey ?? null,
          },
          ...prev,
        ])
        toast.success(`Dokument "${docTypeLabels[type]}" ustvarjen (v${data.verzija ?? 1})`)
      } else {
        // R151 (popravek fail-open buga): nič izmišljenih vrstic — API napaka
        // je izrecna, dokument NE OBSTAJA in seznam to iskreno pokaže.
        let reason = 'napaka strežnika'
        try {
          const errData = await res.json()
          if (typeof errData?.error === 'string') reason = errData.error
        } catch { /* body brez JSON — keep reason */ }
        toast.error(`Generiranje dokumenta ni uspelo: ${reason}`)
      }
    } catch (err) {
      // R151: nič "lokalno ustvarjen" falsifikatov — povezava ni uspela.
      toast.error(`Generiranje dokumenta ni uspelo: ${err instanceof Error ? err.message : 'povezava ni uspela'}`)
    } finally {
      setDocLoading(false)
    }
  }

  // R151: handleDeleteDoc ODSTRANJEN — brisanje uradnih dokumentov ni delo
  // klienta (dokumenti so revizijski artefakti z verzijami v object storage;
  // DELETE API-ja ni, prejšnji gumb je bil no-op s success toastom = falsifikat).

  function openDocPreview(doc: DocumentItem) {
    setPreviewDoc(doc)
    setPreviewOpen(true)
  }

  // R151 (§35): verzija iz API-ja (POST) ali iz zadnje verzije (GET list).
  function verzijaOf(doc: DocumentItem): number | undefined {
    if (doc.verzija) return doc.verzija
    const last = doc.versions?.[doc.versions.length - 1]?.version
    return last
  }

  // R151: pravi PDF je v object storage — datoteka se prenese prek
  // avtenticirane /api/files rute (brez stub toastov).
  function fileUrlOf(doc: DocumentItem): string | null {
    if (doc.storageKey) return `/api/files/${doc.storageKey}`
    if (doc.pdfUrl && doc.pdfUrl.startsWith('/api/files/')) return doc.pdfUrl
    return null
  }

  // Document count summary
  const docCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const doc of documents) {
      const type = doc.tipDokumenta
      counts[type] = (counts[type] || 0) + 1
    }
    return counts
  }, [documents])

  return (
    <div className="space-y-4 px-4 pb-4 pt-2">
      <div>
        <h2 className="text-xl font-bold text-roksal-ink">Dokumenti</h2>
        <p className="text-sm text-muted-foreground">
          Tehnični listi, podpisi in računi
        </p>
      </div>

      {/* Project Selector */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-4 w-4 text-roksal-ink" />
            <div className="flex-1">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Izberi projekt" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nazivProjekta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Count Summary */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-roksal-navy/10">
              <FileStack className="h-5 w-5 text-roksal-ink" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-roksal-ink">
                {documents.length} {documents.length === 1 ? 'dokument' : documents.length === 2 ? 'dokumenta' : documents.length === 3 || documents.length === 4 ? 'dokumenti' : 'dokumentov'}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {Object.entries(docCounts).map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-[10px] h-5 px-1.5">
                    {docTypeLabels[type] || type}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="animate-fade-in-up transition-all duration-200" style={{ animationDelay: '120ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-roksal-ink">
            Hitra dejanja
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Button
                  key={action.id}
                  variant="outline"
                  className="h-auto flex-col gap-1.5 py-3 px-2 card-hover press-scale"
                  onClick={() => handleGenerateDoc(action.id)}
                  disabled={docLoading}
                >
                  {docLoading ? (
                    <Loader2 className="h-5 w-5 text-roksal-ink animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5 text-roksal-ink" />
                  )}
                  <span className="text-xs font-medium text-roksal-ink">
                    {action.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {action.desc}
                  </span>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      <Card className="animate-fade-in-up transition-all duration-200" style={{ animationDelay: '180ms' }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-roksal-ink">
              Dokumenti
            </CardTitle>
            <Badge variant="secondary">{documents.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4" aria-busy={loading || undefined}>
          {loading && documents.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
              {documents.map((doc) => {
                const Icon = docTypeIcons[doc.tipDokumenta] || FileText
                const statusCfg = statusConfig[doc.status] || statusConfig.GENERIRANO
                const verzija = verzijaOf(doc)
                const fileUrl = fileUrlOf(doc)
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-3 transition-colors hover:bg-secondary/30 slide-in-right cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-roksal-navy/40"
                    onClick={() => openDocPreview(doc)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-roksal-navy/10">
                        <Icon className="h-4.5 w-4.5 text-roksal-ink" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-roksal-ink">
                          {docTypeLabels[doc.tipDokumenta] || doc.tipDokumenta}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="tabular-nums">
                            {new Date(doc.createdAt).toLocaleDateString('sl-SI', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                          {/* R151 (§35): verzija + odtis — reprodukcija vidna na prvi pogled */}
                          {verzija && (
                            <span className="tabular-nums font-mono text-muted-foreground/80">v{verzija}</span>
                          )}
                          {doc.sha256 && (
                            <span className="font-mono tabular-nums text-muted-foreground/80" title={`SHA-256: ${doc.sha256}`}>
                              odtis {doc.sha256.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={`text-[10px] h-5 px-1.5 ${statusCfg.color}`}>
                        {fileUrl ? (
                          <Eye className="mr-1 h-2.5 w-2.5" />
                        ) : (
                          <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                        )}
                        {statusCfg.label}
                      </Badge>
                      {fileUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                          aria-label={`Prenesi PDF: ${docTypeLabels[doc.tipDokumenta] || doc.tipDokumenta}${verzija ? `, verzija ${verzija}` : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(fileUrl, '_blank', 'noopener')
                          }}
                        >
                          <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="Ni dokumentov"
              description="Ponudbe, primopredaja in računi bodo tukaj."
            />
          )}
        </CardContent>
      </Card>

      {/* Document Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {previewDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="text-roksal-ink">
                  {docTypeLabels[previewDoc.tipDokumenta] || previewDoc.tipDokumenta}
                </DialogTitle>
                <DialogDescription>
                  Podrobnosti dokumenta
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Document Type */}
                <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-roksal-navy/10">
                    {(() => {
                      const Icon = docTypeIcons[previewDoc.tipDokumenta] || FileText
                      return <Icon className="h-5 w-5 text-roksal-ink" />
                    })()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-roksal-ink">
                      {docTypeLabels[previewDoc.tipDokumenta] || previewDoc.tipDokumenta}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tip dokumenta
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Badge className={`text-[10px] h-5 px-2 ${statusConfig[previewDoc.status]?.color || statusConfig.GENERIRANO.color}`}>
                    {statusConfig[previewDoc.status]?.label || 'Generirano'}
                  </Badge>
                </div>

                {/* Creation Date */}
                <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Datum ustvarjanja</span>
                  </div>
                  <span className="text-xs font-medium text-roksal-ink tabular-nums">
                    {new Date(previewDoc.createdAt).toLocaleDateString('sl-SI', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {/* R151 (§35): verzija + odtis — reprodukcija dokumenta */}
                {verzijaOf(previewDoc) && (
                  <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div className="flex items-center gap-2">
                      <FileStack className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Verzija</span>
                    </div>
                    <span className="text-xs font-medium text-roksal-ink font-mono tabular-nums">
                      v{verzijaOf(previewDoc)}
                    </span>
                  </div>
                )}
                {previewDoc.sha256 && (
                  <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <span className="text-xs text-muted-foreground">Odtis (SHA-256)</span>
                    <span className="text-xs font-medium text-roksal-ink font-mono tabular-nums" title={`SHA-256: ${previewDoc.sha256}`}>
                      {previewDoc.sha256.slice(0, 8)}…{previewDoc.sha256.slice(-4)}
                    </span>
                  </div>
                )}

                {/* Project Name */}
                <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Projekt</span>
                  </div>
                  <span className="text-xs font-medium text-roksal-ink">
                    {projects.find((p) => p.id === previewDoc.projectId)?.nazivProjekta || 'Neznan projekt'}
                  </span>
                </div>

                {/* PDF Available */}
                {fileUrlOf(previewDoc) && (
                  <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div className="flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5 text-roksal-green" />
                      <span className="text-xs text-muted-foreground">PDF datoteka</span>
                    </div>
                    <span className="text-xs font-medium text-roksal-green">Na voljo</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                {fileUrlOf(previewDoc) ? (
                  <Button
                    variant="outline"
                    onClick={() => window.open(fileUrlOf(previewDoc) as string, '_blank', 'noopener')}
                    className="gap-1.5 focus-visible:ring-2 focus-visible:ring-roksal-navy/40"
                    aria-label="Prenesi PDF datoteko dokumenta"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Prenesi PDF
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    className="gap-1.5"
                    title="PDF datoteka ni na voljo (dokument brez shranjene datoteke)"
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF ni na voljo
                  </Button>
                )}
                <Button onClick={() => setPreviewOpen(false)}>Zapri</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
