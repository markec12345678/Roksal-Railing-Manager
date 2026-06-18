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
} from 'lucide-react'
import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { FileText, ShieldCheck, BookOpen, Frame } from 'lucide-react'

export type TabId =
  | 'dashboard'
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
  { id: 'ar', label: 'AR kamera', icon: Camera, highlight: true },
  { id: 'photos', label: 'Slike', icon: ImagePlus },
  { id: 'calculator', label: 'Kalkulator', icon: Calculator },
  { id: 'measurements', label: 'Meritve', icon: Ruler },
  { id: 'inclinometer', label: 'Nagib', icon: Compass },
  { id: 'inventory', label: 'Zaloga', icon: Package },
  { id: 'more', label: 'Več', icon: MoreHorizontal },
]

export type MoreTabId = 'documents' | 'safety' | 'catalog' | 'sketches' | 'gallery' | 'pdf' | 'floorplan'

interface MoreTabItem {
  id: MoreTabId
  label: string
  icon: React.ElementType
  description: string
}

const moreTabs: MoreTabItem[] = [
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-around overflow-x-auto px-0.5 py-1 no-scrollbar">
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
                className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-2 text-[9px] font-medium transition-all duration-200 min-h-[48px] ${
                  isActive || isMoreActive
                    ? tab.highlight
                      ? 'bg-roksal-amber text-white'
                      : 'bg-roksal-navy text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
                aria-label={tab.label}
              >
                <Icon
                  className={`h-[18px] w-[18px] transition-transform duration-200 ${
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

      {/* Več meni */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-center text-roksal-navy">Več funkcij</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 p-4 pb-8">
            {moreTabs.map((t) => {
              const Icon = t.icon
              const active = moreActive === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleMoreClick(t.id)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
                    active
                      ? 'border-roksal-amber bg-roksal-amber/10'
                      : 'border-roksal-navy/10 bg-white hover:border-roksal-navy/30'
                  }`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${active ? 'bg-roksal-amber text-white' : 'bg-roksal-navy/10 text-roksal-navy'}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-roksal-navy">{t.label}</div>
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
