'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { TopBar } from '@/components/roksal/top-bar'
import { BottomNav, type TabId, type MoreTabId } from '@/components/roksal/bottom-nav'
import { DashboardTab } from '@/components/roksal/dashboard-tab'
import { CalculatorTab } from '@/components/roksal/calculator-tab'
import { MeasurementsTab } from '@/components/roksal/measurements-tab'
import { InventoryTab } from '@/components/roksal/inventory-tab'
import { DocumentsTab } from '@/components/roksal/documents-tab'
import { SafetyTab } from '@/components/roksal/safety-tab'
import { InclinometerTab } from '@/components/roksal/inclinometer-tab'
import { ReferenceGallery } from '@/components/roksal/reference-gallery'
import { RoksalCatalog } from '@/components/roksal/roksal-catalog'
import { SketchCanvas } from '@/components/roksal/sketch-canvas'
import { ArScannerLauncher } from '@/components/roksal/ar-scanner-launcher'
import { WebXrLauncher } from '@/components/roksal/webxr-scanner'
import { PhotoTab } from '@/components/roksal/photo-tab'
import { PdfExport } from '@/components/roksal/pdf-export'
import { FloorPlanTab } from '@/components/roksal/floor-plan-tab'
import { AiTakeoff } from '@/components/roksal/ai-takeoff'
import { SignatureQuote } from '@/components/roksal/signature-quote'
import { PostSignaturePanel } from '@/components/roksal/post-signature-panel'
import { CrmTab } from '@/components/roksal/crm-tab'
import { MaterialIntelligenceTab } from '@/components/roksal/material-intelligence-tab'
import { RefreshCw, Camera, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface CalculatorImportData {
  dolzinaMm: number
  visinaMm: number
  locationName: string
}

interface Project {
  id: string
  nazivProjekta: string
  status: string
  customer?: { ime: string; naslov: string }
  monter?: { ime: string }
  // V4.1 — post-signature fields
  dealLocked?: boolean
  dealLockedAt?: string | null
  dealSignedBy?: string | null
  dealSignedByMonter?: string | null
  marginLocked?: number | null
  estimatedPrice?: number | null
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [moreTab, setMoreTab] = useState<MoreTabId | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [sketchOpen, setSketchOpen] = useState(false)

  // Calculator import from measurements
  const [calculatorImport, setCalculatorImport] = useState<CalculatorImportData | null>(null)

  // Naloži projekte + low-stock
  useEffect(() => {
    let syncTimer: ReturnType<typeof setInterval>
    async function fetchData() {
      try {
        const [projRes, invRes] = await Promise.all([fetch('/api/projects'), fetch('/api/inventory')])
        if (projRes.ok) {
          const data = (await projRes.json()) as Project[]
          setProjects(data)
          if (!selectedProjectId && data.length > 0) {
            setSelectedProjectId(data[0].id)
          }
        }
        if (invRes.ok) {
          const data = await invRes.json()
          const low = (data || []).filter(
            (i: { kolicinaZaloga: number; minimalnaZaloga: number }) =>
              i.kolicinaZaloga <= i.minimalnaZaloga
          )
          setLowStockCount(low.length)
        }
      } catch {
        // ignore
      }
      setLastSyncTime(new Date())
    }
    fetchData()
    syncTimer = setInterval(fetchData, 300000)
    return () => clearInterval(syncTimer)
     
  }, [])

  const badges = useMemo<Record<string, number>>(() => {
    const b: Record<string, number> = {}
    if (lowStockCount > 0) b['inventory'] = lowStockCount
    return b
  }, [lowStockCount])

  function handleSync() {
    setSyncing(true)
    setTimeout(() => {
      setSyncing(false)
      setLastSyncTime(new Date())
    }, 2000)
  }

  const handleNavigateToCalculator = useCallback((dolzinaMm: number, visinaMm: number, locationName: string) => {
    setCalculatorImport({ dolzinaMm, visinaMm, locationName })
    setActiveTab('calculator')
    setMoreTab(null)
  }, [])

  const handleBackToMeasurements = useCallback(() => {
    setCalculatorImport(null)
    setActiveTab('measurements')
  }, [])

  const handleClearImport = useCallback(() => {
    setCalculatorImport(null)
  }, [])

  // Preklop na zavihek iz "Več" menija
  const handleMoreSelect = useCallback((tab: MoreTabId) => {
    setMoreTab(tab)
    if (tab === 'sketches') {
      setSketchOpen(true)
    } else {
      setActiveTab('more')
    }
  }, [])

  // Preklop glavnega zavihka počisti moreTab (razen ko gre v sketches)
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
    if (tab !== 'more') setMoreTab(null)
  }, [])

  function formatSyncTime(date: Date | null): string {
    if (!date) return ''
    return date.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  // Ime aktivnega "več" zavihka za nazaj
  const moreLabel = moreTab
    ? moreTab === 'ai'
      ? 'AI Takeoff'
      : moreTab === 'signature'
        ? 'Ponudba s podpisom'
        : moreTab === 'postsig'
          ? 'Post-Signature (V4.1)'
          : moreTab === 'crm'
            ? 'CRM stranke (V4.2)'
            : moreTab === 'material'
              ? 'Material Intelligence (V5)'
              : moreTab === 'pdf'
          ? 'Izvoz PDF'
      : moreTab === 'gallery'
        ? 'Galerija realizacij'
        : moreTab === 'catalog'
          ? 'Katalog profilov'
          : moreTab === 'sketches'
            ? 'Skice'
            : moreTab === 'documents'
              ? 'Dokumenti'
              : moreTab === 'floorplan'
                ? 'Tloris'
                : 'Varnost'
    : ''

  return (
    <div className="min-h-screen bg-[#f7f9ff] roksal-bg-pattern roksal-texture">
      <TopBar onSync={handleSync} syncing={syncing} />

      {/* Sync status indicator */}
      <div className="mx-auto max-w-lg relative">
        {syncing && (
          <div className="absolute top-0 left-0 right-0 z-30 h-0.5 bg-roksal-amber overflow-hidden">
            <div className="h-full bg-roksal-amber animate-pulse" style={{ width: '100%' }} />
          </div>
        )}
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-muted-foreground">
          <RefreshCw className={`h-2.5 w-2.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>
            {syncing
              ? 'Sinhronizacija...'
              : lastSyncTime
                ? `Zadnja sinhronizacija: ${formatSyncTime(lastSyncTime)}`
                : 'Pridobivanje podatkov...'}
          </span>
        </div>
      </div>

      {/* Aktivni projekt indikator (kompakten) */}
      {selectedProject && (activeTab === 'ar' || activeTab === 'photos' || activeTab === 'inclinometer' || moreTab === 'sketches') && (
        <div className="mx-auto max-w-lg px-3 pb-1">
          <div className="flex items-center gap-2 rounded-lg border border-roksal-amber/30 bg-roksal-amber/5 px-3 py-1.5 text-[11px]">
            <Camera className="h-3 w-3 text-roksal-amber" />
            <span className="font-medium text-roksal-navy">{selectedProject.nazivProjekta}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground truncate">{selectedProject.customer?.naslov ?? 'Brez naslova'}</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-lg pb-24">
        {/* Glavni zavihki */}
        {activeTab === 'dashboard' && (
          <DashboardTab
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => setSelectedProjectId(id)}
          />
        )}
        {activeTab === 'ar' && (
          <div className="p-4 space-y-3">
            <WebXrLauncher projectId={selectedProjectId} />
            <ArScannerLauncher projectId={selectedProjectId} />
          </div>
        )}
        {activeTab === 'photos' && <PhotoTab projectId={selectedProjectId} />}
        {activeTab === 'calculator' && (
          <CalculatorTab
            importedFromMeasurement={calculatorImport}
            onClearImport={handleClearImport}
            onBackToMeasurements={handleBackToMeasurements}
          />
        )}
        {activeTab === 'measurements' && (
          <MeasurementsTab onNavigateToCalculator={handleNavigateToCalculator} />
        )}
        {activeTab === 'inclinometer' && <InclinometerTab projectId={selectedProjectId} />}
        {activeTab === 'inventory' && <InventoryTab />}

        {/* "Več" zavihki */}
        {activeTab === 'more' && moreTab && moreTab !== 'sketches' && (
          <div className="p-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMoreTab(null)
                setActiveTab('dashboard')
              }}
              className="mb-3 -ml-2 text-muted-foreground"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Nazaj
            </Button>
            <h2 className="mb-3 text-lg font-bold text-roksal-navy">{moreLabel}</h2>
            {moreTab === 'ai' && <AiTakeoff projectId={selectedProjectId} />}
            {moreTab === 'signature' && selectedProject && (
              <SignatureQuote
                projectId={selectedProject.id}
                quoteData={{
                  projectName: selectedProject.nazivProjekta,
                  customerName: selectedProject.customer?.ime || '—',
                  customerAddress: selectedProject.customer?.naslov || '—',
                  customerPhone: selectedProject.customer?.telefon,
                  items: [
                    { opis: 'Ograja WPC H-Line (po meri)', kolicina: '1', enota: 'kos', cena: '0', skupaj: '0' },
                  ],
                  skupajBrezDDV: 0,
                  ddv: 0,
                  skupajZDDV: 0,
                  datum: new Date().toLocaleDateString('sl-SI'),
                }}
                monterName={selectedProject.monter?.ime || 'Monter Roksal'}
                onDealLocked={() => {
                  // Po deal-locku osveži projekte da se status posodobi
                  fetch('/api/projects').then(r => r.json()).then(data => setProjects(data)).catch(() => {})
                }}
              />
            )}
            {moreTab === 'postsig' && selectedProject && (
              <PostSignaturePanel project={selectedProject} />
            )}
            {moreTab === 'crm' && <CrmTab />}
            {moreTab === 'material' && <MaterialIntelligenceTab projectId={selectedProjectId} />}
            {moreTab === 'pdf' && <PdfExport project={selectedProject} />}
            {moreTab === 'gallery' && <ReferenceGallery />}
            {moreTab === 'catalog' && <RoksalCatalog />}
            {moreTab === 'documents' && <DocumentsTab />}
            {moreTab === 'safety' && <SafetyTab />}
            {moreTab === 'floorplan' && <FloorPlanTab projectId={selectedProjectId} />}
          </div>
        )}
        {activeTab === 'more' && !moreTab && (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <p className="text-sm">Izberite funkcijo iz menija.</p>
          </div>
        )}
      </main>

      {/* Skica full-screen overlay */}
      {sketchOpen && (
        <div className="fixed inset-0 z-50 bg-white">
          <SketchCanvas projectId={selectedProjectId} onClose={() => setSketchOpen(false)} />
        </div>
      )}

      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        badges={badges}
        moreActive={moreTab}
        onMoreSelect={handleMoreSelect}
      />
    </div>
  )
}
