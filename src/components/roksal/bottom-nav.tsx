'use client'

import {
  Home,
  Camera,
  Calculator,
  Ruler,
  Images,
  Compass,
  Package,
  MoreHorizontal,
  ImagePlus,
  FileDown,
  Pen,
  ShieldCheck,
  Users,
  Boxes,
  Truck,
  BarChart3,
  Wand2,
  ScanLine,
  UserCog,
} from 'lucide-react'
import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FileText, BookOpen, Frame, MapPinned } from 'lucide-react'

export type TabId =
  | 'dashboard'
  | 'viz'
  | 'ar'
  | 'photos'
  | 'calculator'
  | 'measurements'
  | 'inclinometer'
  | 'inventory'
  | 'more'

interface TabItem {
  id: TabId
  label: string
  icon: React.ElementType
  highlight?: boolean
}

const mainTabs: TabItem[] = [
  { id: 'dashboard', label: 'Domov', icon: Home },
  { id: 'viz', label: 'Vizualizacija', icon: Wand2, highlight: true },
  { id: 'ar', label: 'AR kamera', icon: Camera, highlight: true },
  { id: 'photos', label: 'Slike', icon: ImagePlus },
  { id: 'calculator', label: 'Kalkulator', icon: Calculator },
  { id: 'measurements', label: 'Meritve', icon: Ruler },
  { id: 'inclinometer', label: 'Nagib', icon: Compass },
  { id: 'inventory', label: 'Zaloga', icon: Package },
  { id: 'more', label: 'Več', icon: MoreHorizontal },
]

export type MoreTabId = 'teren' | 'documents' | 'safety' | 'catalog' | 'sketches' | 'gallery' | 'pdf' | 'measurement' | 'cvstudio' | 'floorplan' | 'signature' | 'postsig' | 'crm' | 'material' | 'logistics' | 'vodja' | 'ekipa'

interface MoreTabItem {
  id: MoreTabId
  label: string
  icon: React.ElementType
  description: string
}

const moreTabs: MoreTabItem[] = [
  { id: 'teren', label: 'Terenski pregled', icon: MapPinned, description: 'Zapisnik pred montažo: podlaga, ovire, dvig + "s seboj prinesti"' },
  { id: 'vodja', label: 'Pregled za vodjo', icon: BarChart3, description: 'Statistika, opozorila, današnji termini' },
  { id: 'ekipa', label: 'Ekipa', icon: UserCog, description: 'Življenjski cikl računov: povabila, deaktivacija, zaklep, vloge' },
  { id: 'measurement', label: 'Merilni studio', icon: Ruler, description: 'Foto → zaznavi ali označi → merilo → geometrija (brez AI)' },
  { id: 'cvstudio', label: 'CV Studio', icon: ScanLine, description: 'CV analiza prizora + predlog postavitve (ni vir resnice)' },
  { id: 'signature', label: 'Ponudba s podpisom', icon: Pen, description: 'Podpisana PDF ponudba (V4)' },
  { id: 'postsig', label: 'Post-Signature', icon: ShieldCheck, description: 'Deal Lock + BOM Draft + Audit (V4.1)' },
  { id: 'crm', label: 'CRM stranke', icon: Users, description: 'LTV, opomniki, kontaktna oseba (V4.2)' },
  { id: 'material', label: 'Material V5', icon: Boxes, description: 'BOM refine + naročila + dobavitelji' },
  { id: 'logistics', label: 'Logistika V6', icon: Truck, description: 'Koledar montaže + ekipe + oprema' },
  { id: 'floorplan', label: 'Tloris', icon: Frame, description: 'Tloris balkona z stebri, vrati, okni' },
  { id: 'pdf', label: 'Izvoz PDF', icon: FileDown, description: 'Delovni list in ponudba' },
  { id: 'gallery', label: 'Galerija realizacij', icon: Images, description: 'Pred/po montaži, reference' },
  { id: 'catalog', label: 'Katalog profilov', icon: BookOpen, description: 'Roksal WPC, ALU, Inox, steklo' },
  { id: 'sketches', label: 'Skice', icon: Ruler, description: 'Ročne skice in oznake mer' },
  { id: 'documents', label: 'Dokumenti', icon: FileText, description: 'Ponudbe, primopredaja, računi' },
  { id: 'safety', label: 'Varnost', icon: ShieldCheck, description: 'Kontrolni seznam in vreme' },
]

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  badges?: Record<string, number>
  moreActive?: MoreTabId | null
  onMoreSelect?: (tab: MoreTabId) => void
}

export function BottomNav({ activeTab, onTabChange, badges = {}, moreActive = null, onMoreSelect }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  function handleMoreClick(id: MoreTabId) {
    setMoreOpen(false)
    onMoreSelect?.(id)
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-around overflow-x-auto px-0.5 py-1 no-scrollbar md:max-w-3xl md:px-4 md:py-1.5 lg:max-w-5xl">
          {mainTabs.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            const badgeCount = badges[tab.id]
            const isMoreActive = tab.id === 'more' && moreActive !== null
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'more') {
                    setMoreOpen(true)
                  } else {
                    onTabChange(tab.id)
                  }
                }}
                className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-2 text-[9px] font-medium transition-all duration-200 min-h-[48px] md:gap-1 md:text-[11px] ${
                  isActive || isMoreActive
                    ? tab.highlight
                      ? 'bg-roksal-amber text-white'
                      : 'bg-roksal-navy text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
                aria-label={tab.label}
              >
                <Icon
                  className={`h-[18px] w-[18px] transition-transform duration-200 md:h-5 md:w-5 ${
                    isActive ? 'scale-110' : ''
                  } ${tab.highlight && !isActive ? 'text-roksal-amber' : ''}`}
                />
                <span className="whitespace-nowrap">{tab.label}</span>
                {badgeCount !== undefined && badgeCount > 0 && (
                  <span
                    className={`absolute -top-0.5 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                      isActive ? 'bg-white text-roksal-navy' : 'bg-roksal-red text-white'
                    }`}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {/* Safe area padding for iOS */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {/* Več meni
          BUG-FIX: 14 ploščic je višjih od zaslona — prej Sheet ni imel
          max-height/overflow, zato so zgornji elementi (Pregled za vodjo,
          AI Takeoff, Ponudba …) padli IZVEN vidnega okna in jih ni bilo
          mogoče klikniti. Zdaj je glava lepljiva, seznam pa se pomika. */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[85dvh] gap-0 px-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {/* Ročaj za povleci (vizualen namig, kot pri nativnih listih) */}
          <div className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-roksal-navy/15" aria-hidden="true" />
          <SheetHeader className="sticky top-0 z-10 shrink-0 rounded-t-3xl bg-background/95 pb-2 pt-1 backdrop-blur-sm">
            <SheetTitle className="text-center text-roksal-ink">Več funkcij</SheetTitle>
          </SheetHeader>
          <div
            className="grid grid-cols-2 gap-3 overflow-y-auto px-4 pt-1 pb-4 scrollbar-thin sm:gap-4 md:grid-cols-3 md:px-6 md:pt-2 md:pb-6"
            role="menu"
            aria-label="Dodatne funkcije"
          >
            {moreTabs.map((t, i) => {
              const Icon = t.icon
              const active = moreActive === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleMoreClick(t.id)}
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                  className={`more-tile flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.97] ${
                    active
                      ? 'border-roksal-amber bg-roksal-amber/10 shadow-[0_0_0_3px] shadow-roksal-amber/10'
                      : 'border-border bg-card hover:border-roksal-navy/30 dark:hover:border-roksal-ink/30'
                  }`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-200 ${active ? 'bg-roksal-amber text-white' : 'bg-roksal-navy/10 text-roksal-ink'}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-roksal-ink">{t.label}</div>
                    <div className="text-[10px] text-muted-foreground">{t.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
