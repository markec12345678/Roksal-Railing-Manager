'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { TopBar } from '@/components/roksal/top-bar'
import { BottomNav, type TabId, type MoreTabId } from '@/components/roksal/bottom-nav'
import { CommandPalette } from '@/components/roksal/command-palette'
import { QuickActionsFab } from '@/components/roksal/quick-actions-fab'
import { PwaStatus } from '@/components/roksal/pwa-status'
import { RefreshCw, Camera, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// ── Dinamični importi (code-splitting) ───────────────────────────────────────
//
// Vsi zavihki so težki (measurements-tab 7.5k vrstic, calculator-tab 5.8k).
// Prej so bili vsi v initial bundle-u — uporabnik je moral prenesti VSE,
// tudi če je hotel samo pogledati projekt. Z `dynamic()` se vsak zavihek
// naloži šele ob prvi uporabi, kot ločen chunk.
//
// `ssr: false`, ker so zavihki vseeno renderjani šele po izbiri (client state)
// in nekateri (AR, inclinometer) uporabljajo browser-only API-je.
function TabLoading() {
  // Skeleton namesto vrtečega se teksta — pogled je takoj "obenem vsebine"
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-4/5 rounded-xl" />
      </div>
    </div>
  )
}

const DashboardTab = dynamic(() => import('@/components/roksal/dashboard-tab').then((m) => m.DashboardTab), { ssr: false, loading: () => <TabLoading /> })
const CalculatorTab = dynamic(() => import('@/components/roksal/calculator-tab').then((m) => m.CalculatorTab), { ssr: false, loading: () => <TabLoading /> })
const MeasurementsTab = dynamic(() => import('@/components/roksal/measurements-tab').then((m) => m.MeasurementsTab), { ssr: false, loading: () => <TabLoading /> })
const InventoryTab = dynamic(() => import('@/components/roksal/inventory-tab').then((m) => m.InventoryTab), { ssr: false, loading: () => <TabLoading /> })
const DocumentsTab = dynamic(() => import('@/components/roksal/documents-tab').then((m) => m.DocumentsTab), { ssr: false, loading: () => <TabLoading /> })
const SafetyTab = dynamic(() => import('@/components/roksal/safety-tab').then((m) => m.SafetyTab), { ssr: false, loading: () => <TabLoading /> })
const InclinometerTab = dynamic(() => import('@/components/roksal/inclinometer-tab').then((m) => m.InclinometerTab), { ssr: false, loading: () => <TabLoading /> })
const ReferenceGallery = dynamic(() => import('@/components/roksal/reference-gallery').then((m) => m.ReferenceGallery), { ssr: false, loading: () => <TabLoading /> })
const RoksalCatalog = dynamic(() => import('@/components/roksal/roksal-catalog').then((m) => m.RoksalCatalog), { ssr: false, loading: () => <TabLoading /> })
const ArScannerLauncher = dynamic(() => import('@/components/roksal/ar-scanner-launcher').then((m) => m.ArScannerLauncher), { ssr: false, loading: () => <TabLoading /> })
const WebXrLauncher = dynamic(() => import('@/components/roksal/webxr-scanner').then((m) => m.WebXrLauncher), { ssr: false, loading: () => <TabLoading /> })
const PhotoTab = dynamic(() => import('@/components/roksal/photo-tab').then((m) => m.PhotoTab), { ssr: false, loading: () => <TabLoading /> })
const PdfExport = dynamic(() => import('@/components/roksal/pdf-export').then((m) => m.PdfExport), { ssr: false, loading: () => <TabLoading /> })
const FloorPlanTab = dynamic(() => import('@/components/roksal/floor-plan-tab').then((m) => m.FloorPlanTab), { ssr: false, loading: () => <TabLoading /> })
const MapMeasure = dynamic(() => import('@/components/roksal/map-measure').then((m) => m.MapMeasure), { ssr: false, loading: () => <TabLoading /> })
const PunchList = dynamic(() => import('@/components/roksal/punch-list').then((m) => m.PunchList), { ssr: false, loading: () => <TabLoading /> })
const AiTakeoff = dynamic(() => import('@/components/roksal/ai-takeoff').then((m) => m.AiTakeoff), { ssr: false, loading: () => <TabLoading /> })
const SignatureQuote = dynamic(() => import('@/components/roksal/signature-quote').then((m) => m.SignatureQuote), { ssr: false, loading: () => <TabLoading /> })
const PostSignaturePanel = dynamic(() => import('@/components/roksal/post-signature-panel').then((m) => m.PostSignaturePanel), { ssr: false, loading: () => <TabLoading /> })
const CrmTab = dynamic(() => import('@/components/roksal/crm-tab').then((m) => m.CrmTab), { ssr: false, loading: () => <TabLoading /> })
const MaterialIntelligenceTab = dynamic(() => import('@/components/roksal/material-intelligence-tab').then((m) => m.MaterialIntelligenceTab), { ssr: false, loading: () => <TabLoading /> })
const LogisticsTab = dynamic(() => import('@/components/roksal/logistics-tab').then((m) => m.LogisticsTab), { ssr: false, loading: () => <TabLoading /> })
const VodjaDashboard = dynamic(() => import('@/components/roksal/vodja-dashboard').then((m) => m.VodjaDashboard), { ssr: false, loading: () => <TabLoading /> })
const SketchCanvas = dynamic(() => import('@/components/roksal/sketch-canvas').then((m) => m.SketchCanvas), { ssr: false, loading: () => <TabLoading /> })
const OnboardingWrapper = dynamic(() => import('@/components/roksal/onboarding-tour').then((m) => m.OnboardingWrapper), { ssr: false, loading: () => <TabLoading /> })

export interface CalculatorImportData {
  dolzinaMm: number
  visinaMm: number
  locationName: string
}

// Veljavni glavni zavihki za centralno navigacijo (FAB/obvestila/paleta)
const MAIN_TAB_IDS: TabId[] = [
  'dashboard', 'ar', 'photos', 'calculator', 'measurements', 'inclinometer', 'inventory',
]

// One canonical Project type — see src/lib/types.ts for why this is not local.
import type { Project } from '@/lib/types'

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [moreTab, setMoreTab] = useState<MoreTabId | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [sketchOpen, setSketchOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Pull-to-refresh (mobilni PWA občutek): potegni navzdol na vrhu strani
  const [pullPx, setPullPx] = useState(0)
  const pullStartRef = useRef<{ y: number; active: boolean }>({ y: 0, active: false })
  const PTR_THRESHOLD = 68

  // Calculator import from measurements
  const [calculatorImport, setCalculatorImport] = useState<CalculatorImportData | null>(null)

  // Naloži projekte + low-stock. Pravi klic API-ja — prej je bil "Sync" gumb
  // samo 2-sekundni spinner brez funkcije (fake sync).
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setSyncing(true)
    setSyncError(null)
    try {
      const [projRes, invRes] = await Promise.all([fetch('/api/projects'), fetch('/api/inventory')])
      if (projRes.ok) {
        const data = (await projRes.json()) as Project[]
        setProjects(data)
        setSelectedProjectId((current) => {
          if (current && data.some((p) => p.id === current)) return current
          return data.length > 0 ? data[0].id : null
        })
      } else if (projRes.status === 401) {
        // Seja je potekla — proxy že preusmerja na /login ob navigaciji,
        // tu pa pokažemo razumljivo napako namesto prazne strani.
        setSyncError('Seja je potekla — osveži stran in se prijavi znova.')
      }
      if (invRes.ok) {
        const data = await invRes.json()
        const low = (data || []).filter(
          (i: { kolicinaZaloga: number; minimalnaZaloga: number }) =>
            i.kolicinaZaloga <= i.minimalnaZaloga
        )
        setLowStockCount(low.length)
      }
    } catch (e) {
      // Napaka ni več tiha — uporabnik vidi, da sinhronizacija ni uspela.
      console.error('Sinhronizacija ni uspela:', e)
      setSyncError('Ni povezave s strežnikom — podatki so lahko zastareli.')
    } finally {
      setLastSyncTime(new Date())
      if (!silent) setSyncing(false)
      // Obvestilni center (zvonek) osveži badge ob vsakem syncu
      window.dispatchEvent(new CustomEvent('roksal:refresh'))
    }
  }, [])

  useEffect(() => {
    void fetchData(true)
    // PWA bližnjice (/?tab=ar …) iz manifest.json — odpre zavihek ob zagonu
    const tabParam = new URLSearchParams(window.location.search).get('tab')
    if (tabParam && MAIN_TAB_IDS.includes(tabParam as TabId)) {
      setActiveTab(tabParam as TabId)
    }
    const syncTimer = setInterval(() => void fetchData(true), 300000)
    return () => clearInterval(syncTimer)
  }, [fetchData])
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    function onSelectProject(e: Event) {
      const id = (e as CustomEvent<string>).detail
      if (typeof id === 'string' && id) setSelectedProjectId(id)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('roksal:select-project', onSelectProject)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('roksal:select-project', onSelectProject)
    }
  }, [])

  const badges = useMemo<Record<string, number>>(() => {
    const b: Record<string, number> = {}
    if (lowStockCount > 0) b['inventory'] = lowStockCount
    return b
  }, [lowStockCount])

  function handleSync() {
    void fetchData(false)
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

  // ── Centralna navigacija (FAB, obvestilni center, kasneje tudi AR) ────────
  // detail = { tab: TabId, more?: MoreTabId | null } — 'sketches' odpre overlay
  useEffect(() => {
    function onNavigate(e: Event) {
      const d = (e as CustomEvent<{ tab?: string; more?: string | null }>).detail
      if (!d?.tab) return
      if (d.tab === 'more' && d.more) {
        handleMoreSelect(d.more as MoreTabId)
      } else if (MAIN_TAB_IDS.includes(d.tab as TabId)) {
        handleTabChange(d.tab as TabId)
      }
    }
    window.addEventListener('roksal:navigate', onNavigate)
    return () => window.removeEventListener('roksal:navigate', onNavigate)
  }, [handleMoreSelect, handleTabChange])

  // AR WebXR → Kalkulator ("Uporabi v kalkulatorju" iz WebXR HUD)
  useEffect(() => {
    function onCalcImport(e: Event) {
      const d = (e as CustomEvent<{ dolzinaMm?: number; visinaMm?: number; locationName?: string }>).detail
      if (!d?.dolzinaMm || !d?.visinaMm) return
      setCalculatorImport({
        dolzinaMm: d.dolzinaMm,
        visinaMm: d.visinaMm,
        locationName: d.locationName ?? 'AR meritev (WebXR)',
      })
      handleTabChange('calculator')
    }
    window.addEventListener('roksal:calc-import', onCalcImport)
    return () => window.removeEventListener('roksal:calc-import', onCalcImport)
  }, [handleTabChange])

  // ── Pull-to-refresh (PWA občutek na telefonu) ───────────────────────────
  const onPullStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0 && e.touches.length === 1 && !syncing) {
      pullStartRef.current = { y: e.touches[0].clientY, active: true }
    }
  }, [syncing])

  const onPullMove = useCallback((e: React.TouchEvent) => {
    if (!pullStartRef.current.active || e.touches.length !== 1) return
    const dy = e.touches[0].clientY - pullStartRef.current.y
    if (dy > 0 && window.scrollY <= 0) {
      // upor (resistance) — težje ko potegneš, manj se premakne
      setPullPx(Math.min(96, dy * 0.45))
    } else if (pullPx > 0) {
      setPullPx(0)
    }
  }, [pullPx])

  const onPullEnd = useCallback(() => {
    pullStartRef.current.active = false
    if (pullPx >= PTR_THRESHOLD) {
      try { navigator.vibrate?.([20, 30, 20]) } catch { /* ignore */ }
      handleSync()
    }
    setPullPx(0)
  }, [pullPx])

  function formatSyncTime(date: Date | null): string {
    if (!date) return ''
    return date.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  // Ime aktivnega "več" zavihka za nazaj
  const moreLabel = moreTab
    ? moreTab === 'vodja'
      ? 'Pregled za vodjo'
      : moreTab === 'ai'
      ? 'AI Takeoff'
      : moreTab === 'signature'
        ? 'Ponudba s podpisom'
        : moreTab === 'postsig'
          ? 'Post-Signature (V4.1)'
          : moreTab === 'crm'
            ? 'CRM stranke (V4.2)'
            : moreTab === 'material'
              ? 'Material Intelligence (V5)'
              : moreTab === 'logistics'
                ? 'Logistika (V6)'
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
    <div
      className="min-h-screen bg-[#f7f9ff] roksal-bg-pattern roksal-texture"
      onTouchStart={onPullStart}
      onTouchMove={onPullMove}
      onTouchEnd={onPullEnd}
      onTouchCancel={onPullEnd}
    >
      {/* Pull-to-refresh indikator — le prilikom vlečenja navzdol */}
      <div
        className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center transition-opacity"
        style={{ opacity: pullPx > 0 || syncing ? 1 : 0 }}
        aria-hidden="true"
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-roksal-amber/30"
          style={{ transform: `rotate(${pullPx * 3}deg)` }}
        >
          <RefreshCw
            className={`h-4 w-4 text-roksal-amber ${pullPx >= PTR_THRESHOLD || syncing ? 'animate-spin' : ''}`}
          />
        </div>
      </div>

      <TopBar onSync={handleSync} syncing={syncing} onOpenPalette={() => setPaletteOpen(true)} />

      {/* PWA status — offline pas + namestitev app */}
      <PwaStatus />

      {/* Sync status indicator */}
      <div className="mx-auto w-full max-w-lg md:max-w-3xl lg:max-w-5xl relative">
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
              : syncError
                ? syncError
                : lastSyncTime
                  ? `Zadnja sinhronizacija: ${formatSyncTime(lastSyncTime)}`
                  : 'Pridobivanje podatkov...'}
          </span>
        </div>
      </div>

      {/* Aktivni projekt indikator (kompakten) */}
      {selectedProject && (activeTab === 'ar' || activeTab === 'photos' || activeTab === 'inclinometer' || moreTab === 'sketches') && (
        <div className="mx-auto w-full max-w-lg px-3 pb-1 md:max-w-3xl lg:max-w-5xl">
          <div className="flex items-center gap-2 rounded-lg border border-roksal-amber/30 bg-roksal-amber/5 px-3 py-1.5 text-[11px]">
            <Camera className="h-3 w-3 text-roksal-amber" />
            <span className="font-medium text-roksal-navy">{selectedProject.nazivProjekta}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground truncate">{selectedProject.customer?.naslov ?? 'Brez naslova'}</span>
          </div>
        </div>
      )}

      <main
        className="mx-auto w-full max-w-lg pb-24 md:max-w-3xl lg:max-w-5xl"
        style={pullPx > 0 ? { transform: `translateY(${Math.round(pullPx)}px)`, transition: 'transform 80ms linear' } : { transition: 'transform 200ms ease-out' }}
      >
        {/* Mehek prehod med zavihki — ključ je kombinacija zavihka in modula,
          da se animacija sproži tudi znotraj "Več" menija. */}
        <motion.div
          key={activeTab + (moreTab ?? '')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
        {/* Glavni zavihki */}
        {activeTab === 'dashboard' && (
          <DashboardTab
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => setSelectedProjectId(id)}
          />
        )}
        {activeTab === 'ar' && (
          <>
            <div className="grid gap-3 p-4 pb-0 sm:grid-cols-2 sm:items-start">
              <WebXrLauncher projectId={selectedProjectId} />
              <ArScannerLauncher projectId={selectedProjectId} />
            </div>
            <div className="p-4">
              <MapMeasure projectId={selectedProjectId} />
            </div>
          </>
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
            {moreTab === 'vodja' && <VodjaDashboard />}
            {moreTab === 'ai' && <AiTakeoff projectId={selectedProjectId} />}
            {moreTab === 'signature' && selectedProject && (
              <SignatureQuote
                projectId={selectedProject.id}
                quoteData={{
                  projectName: selectedProject.nazivProjekta,
                  customerName: selectedProject.customer?.ime || '—',
                  customerAddress: selectedProject.customer?.naslov || '—',
                  customerPhone: selectedProject.customer?.telefon ?? undefined,
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
                  void fetchData(true)
                }}
              />
            )}
            {moreTab === 'postsig' && selectedProject && (
              <PostSignaturePanel project={selectedProject} />
            )}
            {moreTab === 'crm' && <CrmTab />}
            {moreTab === 'material' && <MaterialIntelligenceTab projectId={selectedProjectId} />}
            {moreTab === 'logistics' && <LogisticsTab projectId={selectedProjectId} />}
            {moreTab === 'pdf' && <PdfExport project={selectedProject} />}
            {moreTab === 'gallery' && <ReferenceGallery />}
            {moreTab === 'catalog' && <RoksalCatalog />}
            {moreTab === 'documents' && (
              <div className="space-y-4">
                <PunchList project={selectedProject} />
                <DocumentsTab />
              </div>
            )}
            {moreTab === 'safety' && <SafetyTab />}
            {moreTab === 'floorplan' && <FloorPlanTab projectId={selectedProjectId} />}
          </div>
        )}
        {activeTab === 'more' && !moreTab && (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <p className="text-sm">Izberite funkcijo iz menija.</p>
          </div>
        )}
        </motion.div>
      </main>

      {/* Ukazna paleta — skok kamorkoli (⌘K) */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={(tab, more) => {
          if (more) {
            setMoreTab(more)
            setActiveTab('more')
          } else {
            handleTabChange(tab)
          }
        }}
        onSync={handleSync}
      />

      {/* Skica full-screen overlay */}
      {/* SketchCanvas needs a real project id; rendering it with null produced a
          `string | null` type error and a save that could never resolve. */}
      {sketchOpen && selectedProjectId && (
        <div className="fixed inset-0 z-50 bg-white">
          <SketchCanvas projectId={selectedProjectId} onClose={() => setSketchOpen(false)} />
        </div>
      )}

      {/* Hitre akcije (FAB) — AR meritev, slika, meritev, skica, kalkulator */}
      <QuickActionsFab />

      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        badges={badges}
        moreActive={moreTab}
        onMoreSelect={handleMoreSelect}
      />

      <OnboardingWrapper onNavigate={(tab) => {
        if (tab === 'ai' || tab === 'signature' || tab === 'logistics') {
          setMoreTab(tab as MoreTabId)
          setActiveTab('more')
        } else {
          handleTabChange(tab as TabId)
        }
      }} />
    </div>
  )
}
