'use client'

import { useEffect, useState, useMemo } from 'react'
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
  X,
  FileStack,
  Inbox,
} from 'lucide-react'
import { toast } from 'sonner'

interface DocumentItem {
  id: string
  tipDokumenta: string
  pdfUrl?: string | null
  status: string
  createdAt: string
  projectId: string
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
  PODPISANO: { label: 'Podpisano', color: 'bg-blue-100 text-blue-800' },
  POSLANO: { label: 'Poslano', color: 'bg-roksal-amber/15 text-roksal-navy' },
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

  useEffect(() => {
    async function fetchData() {
      try {
        const projRes = await fetch('/api/projects')
        if (projRes.ok) {
          const projData = await projRes.json()
          setProjects(projData)
          if (projData.length > 0) {
            const firstProjectId = projData[0].id
            setSelectedProject(firstProjectId)
            const docRes = await fetch(`/api/documents?projectId=${firstProjectId}`)
            if (docRes.ok) {
              const docData = await docRes.json()
              if (docData.length > 0) {
                setDocuments(docData)
              } else {
                setDocuments(demoDocuments)
              }
            } else {
              setDocuments(demoDocuments)
            }
          } else {
            setDocuments(demoDocuments)
          }
        } else {
          setProjects(demoProjects)
          setDocuments(demoDocuments)
        }
      } catch {
        setProjects(demoProjects)
        setDocuments(demoDocuments)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (!selectedProject || loading) return
    async function fetchDocs() {
      try {
        const docRes = await fetch(`/api/documents?projectId=${selectedProject}`)
        if (docRes.ok) {
          const docData = await docRes.json()
          if (docData.length > 0) {
            setDocuments(docData)
          } else {
            setDocuments([])
          }
        }
      } catch {
        // keep existing docs
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
            pdfUrl: data.pdfUrl,
            status: data.status,
            createdAt: data.createdAt,
            projectId: data.projectId,
          },
          ...prev,
        ])
        toast.success(`Dokument "${docTypeLabels[type]}" ustvarjen`)
      } else {
        setDocuments((prev) => [
          {
            id: `local_${Date.now()}`,
            tipDokumenta: type,
            pdfUrl: null,
            status: 'GENERIRANO',
            createdAt: new Date().toISOString(),
            projectId: selectedProject,
          },
          ...prev,
        ])
        toast.success(`Dokument "${docTypeLabels[type]}" ustvarjen (lokalno)`)
      }
    } catch {
      setDocuments((prev) => [
        {
          id: `local_${Date.now()}`,
          tipDokumenta: type,
          pdfUrl: null,
          status: 'GENERIRANO',
          createdAt: new Date().toISOString(),
          projectId: selectedProject,
        },
        ...prev,
      ])
      toast.success(`Dokument "${docTypeLabels[type]}" ustvarjen (lokalno)`)
    } finally {
      setDocLoading(false)
    }
  }

  function handleDeleteDoc(docId: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== docId))
    toast.success('Dokument odstranjen')
  }

  function openDocPreview(doc: DocumentItem) {
    setPreviewDoc(doc)
    setPreviewOpen(true)
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
        <h2 className="text-xl font-bold text-roksal-navy">Dokumenti</h2>
        <p className="text-sm text-muted-foreground">
          Tehnični listi, podpisi in računi
        </p>
      </div>

      {/* Project Selector */}
      <Card className="card-hover transition-all duration-200 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-4 w-4 text-roksal-navy" />
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
              <FileStack className="h-5 w-5 text-roksal-navy" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-roksal-navy">
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
          <CardTitle className="text-sm font-semibold text-roksal-navy">
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
                    <Loader2 className="h-5 w-5 text-roksal-navy animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5 text-roksal-navy" />
                  )}
                  <span className="text-xs font-medium text-roksal-navy">
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
            <CardTitle className="text-sm font-semibold text-roksal-navy">
              Dokumenti
            </CardTitle>
            <Badge variant="secondary">{documents.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
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
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-3 transition-colors hover:bg-secondary/30 slide-in-right cursor-pointer"
                    onClick={() => openDocPreview(doc)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-roksal-navy/10">
                        <Icon className="h-4.5 w-4.5 text-roksal-navy" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-roksal-navy">
                          {docTypeLabels[doc.tipDokumenta] || doc.tipDokumenta}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(doc.createdAt).toLocaleDateString('sl-SI', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge className={`text-[10px] h-5 px-1.5 ${statusCfg.color}`}>
                        {doc.pdfUrl ? (
                          <Eye className="mr-1 h-2.5 w-2.5" />
                        ) : (
                          <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                        )}
                        {statusCfg.label}
                      </Badge>
                      {doc.pdfUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            toast.info('PDF generiranje bo kmalu na voljo')
                          }}
                        >
                          <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-roksal-red"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteDoc(doc.id)
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50">
                <Inbox className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Ni dokumentov za izbrani projekt
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Uporabite hitra dejanja za ustvarjanje novih dokumentov
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {previewDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="text-roksal-navy">
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
                      return <Icon className="h-5 w-5 text-roksal-navy" />
                    })()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-roksal-navy">
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
                  <span className="text-xs font-medium text-roksal-navy">
                    {new Date(previewDoc.createdAt).toLocaleDateString('sl-SI', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {/* Project Name */}
                <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Projekt</span>
                  </div>
                  <span className="text-xs font-medium text-roksal-navy">
                    {projects.find((p) => p.id === previewDoc.projectId)?.nazivProjekta || 'Neznan projekt'}
                  </span>
                </div>

                {/* PDF Available */}
                {previewDoc.pdfUrl && (
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
                <Button
                  variant="outline"
                  onClick={() => {
                    toast.info('PDF generiranje bo kmalu na voljo')
                  }}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </Button>
                <Button onClick={() => setPreviewOpen(false)}>Zapri</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const demoProjects: Project[] = [
  { id: 'demo1', nazivProjekta: 'Ograja Horjul - WPC Classic' },
  { id: 'demo2', nazivProjekta: 'Terasa Kranj - Inox Z-line' },
]

const demoDocuments: DocumentItem[] = [
  {
    id: 'doc1',
    tipDokumenta: 'TEHNICNI_LIST',
    pdfUrl: '/docs/tl_001.pdf',
    status: 'GENERIRANO',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    projectId: 'demo1',
  },
  {
    id: 'doc2',
    tipDokumenta: 'PRIMOPREDAJA',
    pdfUrl: '/docs/pp_001.pdf',
    status: 'PODPISANO',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    projectId: 'demo1',
  },
  {
    id: 'doc3',
    tipDokumenta: 'E_RACUN',
    pdfUrl: null,
    status: 'POSLANO',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    projectId: 'demo2',
  },
  {
    id: 'doc4',
    tipDokumenta: 'ZAPISNIK_NAVORA',
    pdfUrl: null,
    status: 'GENERIRANO',
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    projectId: 'demo1',
  },
]
