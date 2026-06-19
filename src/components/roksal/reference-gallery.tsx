'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import {
  Plus,
  MapPin,
  Loader2,
  ImageIcon,
  Upload,
  GripVertical,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  FileDown,
  Search,
  Filter,
  ArrowUpDown,
  Calendar,
  Layers,
  Eye,
  EyeOff,
  SlidersHorizontal,
} from 'lucide-react';

// === Tipi ===
interface Profil {
  id: string;
  sifra: string;
  naziv: string;
  material: string;
  kategorija: string;
}

interface Customer {
  id: string;
  ime: string;
}

interface ProjectInfo {
  id: string;
  nazivProjekta: string;
  customer?: Customer | null;
}

interface GalleryItem {
  id: string;
  projectId: string | null;
  profilId: string | null;
  naslov: string;
  opis: string | null;
  lokacija: string | null;
  slikaPred: string | null;
  slikaPo: string | null;
  javno: boolean;
  createdAt: string;
  profil?: Profil | null;
  project?: ProjectInfo | null;
}

// === Konstante ===
const MATERIALS = ['WPC', 'Inox', 'Alu', 'Steklo'] as const;
const FEATURED_KEY = 'roksal_featured_gallery_ids';
const FEATURED_PREFIX = '[FEATURED]';

type SortOption = 'newest' | 'oldest' | 'az' | 'location';
type ImageMode = 'po' | 'pred' | 'slider';

// === Pomožne funkcije ===
function isFeatured(item: GalleryItem, featuredIds: string[]): boolean {
  if (featuredIds.includes(item.id)) return true;
  if (item.opis?.trim().startsWith(FEATURED_PREFIX)) return true;
  return false;
}

function cleanOpis(opis: string | null): string | null {
  if (!opis) return null;
  const trimmed = opis.trim();
  if (trimmed.startsWith(FEATURED_PREFIX)) {
    const cleaned = trimmed.slice(FEATURED_PREFIX.length).trim();
    return cleaned || null;
  }
  return opis;
}

function getYear(dateStr: string): string {
  try {
    return new Date(dateStr).getFullYear().toString();
  } catch {
    return '—';
  }
}

function formatDateSI(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('sl-SI', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('sl-SI');
  } catch {
    return dateStr;
  }
}

// Check if a material string matches one of the known material categories
// (handles values like "WPC + ALU", "Inox 316L", etc.)
function materialMatches(material: string | undefined | null, target: string): boolean {
  if (!material) return false;
  return material.toLowerCase().includes(target.toLowerCase());
}

// === Before/After Slider ===
function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
}: {
  beforeSrc: string;
  afterSrc: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [percentage, setPercentage] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPercentage(pct);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-lg overflow-hidden border bg-black/40 select-none touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onTouchStart={() => setIsDragging(true)}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setIsDragging(false)}
    >
      <img
        src={afterSrc}
        alt="Po montaži"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
      <img
        src={beforeSrc}
        alt="Pred montažo"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 ${100 - percentage}% 0 0)` }}
        draggable={false}
      />
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
        style={{ left: `${percentage}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg">
          <GripVertical className="w-4 h-4 text-roksal-navy" />
        </div>
      </div>
      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded z-20">
        Pred
      </div>
      <div className="absolute top-2 right-2 bg-roksal-amber/90 text-white text-xs px-2 py-1 rounded z-20">
        Po
      </div>
    </div>
  );
}

// === Statistična kartica ===
function StatisticsCard({ items }: { items: GalleryItem[] }) {
  const total = items.length;
  const publicCount = items.filter((i) => i.javno).length;

  // Material counts
  const materialCounts = MATERIALS.map((mat) => ({
    material: mat,
    count: items.filter((i) => materialMatches(i.profil?.material, mat)).length,
  }));
  const othersCount = items.filter(
    (i) => {
      const m = i.profil?.material;
      if (!m) return false;
      return !MATERIALS.some((mat) => materialMatches(m, mat));
    }
  ).length;
  const noMaterialCount = items.filter((i) => !i.profil?.material).length;

  // Najnovejša realizacija
  const newest = items.reduce<{ date: string | null; naslov: string | null }>(
    (acc, i) => {
      if (!acc.date || new Date(i.createdAt) > new Date(acc.date)) {
        return { date: i.createdAt, naslov: i.naslov };
      }
      return acc;
    },
    { date: null, naslov: null }
  );

  const maxCount = Math.max(
    1,
    ...materialCounts.map((m) => m.count),
    othersCount,
    noMaterialCount
  );

  const barColor = (mat: string) => {
    switch (mat) {
      case 'WPC': return 'bg-amber-600';
      case 'Inox': return 'bg-slate-400';
      case 'Alu': return 'bg-slate-500';
      case 'Steklo': return 'bg-cyan-500';
      default: return 'bg-muted-foreground/40';
    }
  };

  return (
    <Card className="border-roksal-navy/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-roksal-navy dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-roksal-amber" />
          Pregled galerije
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Skupno */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Skupno realizacij
          </p>
          <p className="text-2xl font-bold text-roksal-navy dark:text-white">
            {total}
          </p>
        </div>

        {/* Javno */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Z javnim prikazom
          </p>
          <p className="text-2xl font-bold text-roksal-navy dark:text-white flex items-center gap-1">
            <Eye className="w-4 h-4 text-roksal-amber" />
            {publicCount}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {total - publicCount} privatnih
          </p>
        </div>

        {/* Najnovejša */}
        <div className="space-y-1 col-span-2 md:col-span-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Najnovejša realizacija
          </p>
          {newest.date ? (
            <>
              <p className="text-sm font-semibold text-roksal-navy dark:text-white line-clamp-1">
                {newest.naslov}
              </p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDateShort(newest.date)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>

        {/* Material bars */}
        <div className="col-span-2 md:col-span-1 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Po materialu
          </p>
          {total === 0 ? (
            <p className="text-xs text-muted-foreground">Ni podatkov</p>
          ) : (
            <>
              {materialCounts.map((m) => (
                <div key={m.material} className="flex items-center gap-2">
                  <span className="text-[10px] w-12 text-muted-foreground">{m.material}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barColor(m.material)} transition-all`}
                      style={{ width: `${(m.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] w-5 text-right font-medium">{m.count}</span>
                </div>
              ))}
              {othersCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] w-12 text-muted-foreground">Ostalo</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-muted-foreground/40 transition-all"
                      style={{ width: `${(othersCount / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] w-5 text-right font-medium">{othersCount}</span>
                </div>
              )}
              {noMaterialCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] w-12 text-muted-foreground">Brez</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-muted-foreground/20 transition-all"
                      style={{ width: `${(noMaterialCount / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] w-5 text-right font-medium">{noMaterialCount}</span>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// === Lightbox ===
function Lightbox({
  item,
  hasPrev,
  hasNext,
  featured,
  imageMode,
  onImageModeChange,
  onClose,
  onPrev,
  onNext,
  onToggleFeatured,
  onOpenDetails,
}: {
  item: GalleryItem;
  hasPrev: boolean;
  hasNext: boolean;
  featured: boolean;
  imageMode: ImageMode;
  onImageModeChange: (m: ImageMode) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFeatured: () => void;
  onOpenDetails: () => void;
}) {
  const hasBoth = !!item.slikaPred && !!item.slikaPo;
  const displaySrc =
    imageMode === 'pred' ? item.slikaPred : imageMode === 'po' ? item.slikaPo : item.slikaPo;
  const cleanDescription = cleanOpis(item.opis);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Predogled: ${item.naslov}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top bar */}
      <div className="flex items-start justify-between gap-3 p-4 text-white">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold truncate">{item.naslov}</h3>
          {item.lokacija && (
            <p className="text-xs text-white/70 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{item.lokacija}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleFeatured}
            className="text-white hover:bg-white/10"
          >
            <Star
              className={`w-4 h-4 mr-1 ${featured ? 'fill-roksal-amber text-roksal-amber' : 'text-white'}`}
            />
            <span className="text-xs">{featured ? 'Izpostavljeno' : 'Izpostavi'}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenDetails}
            className="text-white hover:bg-white/10"
          >
            <SlidersHorizontal className="w-4 h-4 mr-1" />
            <span className="text-xs">Podrobnosti</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
            aria-label="Zapri"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center px-2 sm:px-4 relative min-h-0"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={onPrev}
          disabled={!hasPrev}
          className="absolute left-2 sm:left-4 z-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-0 disabled:opacity-30"
          aria-label="Prejšnja"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        <div
          className="max-w-[85vw] max-h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {imageMode === 'slider' && hasBoth ? (
            <div className="w-[90vw] sm:w-[80vw] max-h-[75vh]">
              <BeforeAfterSlider beforeSrc={item.slikaPred!} afterSrc={item.slikaPo!} />
            </div>
          ) : displaySrc ? (
            <img
              src={displaySrc}
              alt={item.naslov}
              className="max-h-[75vh] max-w-[85vw] object-contain rounded"
            />
          ) : (
            <div className="flex flex-col items-center text-white/50">
              <ImageIcon className="w-16 h-16 mb-2" />
              <p className="text-sm">Brez slike</p>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={onNext}
          disabled={!hasNext}
          className="absolute right-2 sm:right-4 z-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-0 disabled:opacity-30"
          aria-label="Naslednja"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {/* Bottom: toggle + metadata */}
      <div
        className="p-4 bg-black/60 text-white max-h-[25vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {hasBoth && (
          <div className="flex gap-2 mb-3">
            <Button
              type="button"
              size="sm"
              variant={imageMode === 'po' ? 'default' : 'outline'}
              onClick={() => onImageModeChange('po')}
              className={
                imageMode === 'po'
                  ? 'bg-roksal-amber hover:bg-roksal-amber/90 text-white border-0'
                  : 'bg-transparent text-white border-white/30 hover:bg-white/10'
              }
            >
              Po montaži
            </Button>
            <Button
              type="button"
              size="sm"
              variant={imageMode === 'pred' ? 'default' : 'outline'}
              onClick={() => onImageModeChange('pred')}
              className={
                imageMode === 'pred'
                  ? 'bg-roksal-amber hover:bg-roksal-amber/90 text-white border-0'
                  : 'bg-transparent text-white border-white/30 hover:bg-white/10'
              }
            >
              Pred montažo
            </Button>
            <Button
              type="button"
              size="sm"
              variant={imageMode === 'slider' ? 'default' : 'outline'}
              onClick={() => onImageModeChange('slider')}
              className={
                imageMode === 'slider'
                  ? 'bg-roksal-amber hover:bg-roksal-amber/90 text-white border-0'
                  : 'bg-transparent text-white border-white/30 hover:bg-white/10'
              }
            >
              <GripVertical className="w-3 h-3 mr-1" />
              Drsnik Pred/Po
            </Button>
          </div>
        )}

        {cleanDescription && (
          <p className="text-sm text-white/90 mb-2 whitespace-pre-wrap">{cleanDescription}</p>
        )}

        <div className="flex flex-wrap gap-2 items-center text-xs">
          {item.profil && (
            <>
              <Badge variant="secondary" className="text-[10px]">
                {item.profil.naziv}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-white/40 text-white">
                {item.profil.material}
              </Badge>
            </>
          )}
          {item.project?.customer?.ime && (
            <Badge variant="outline" className="text-[10px] border-white/40 text-white">
              Stranka: {item.project.customer.ime}
            </Badge>
          )}
          {item.javno ? (
            <Badge variant="outline" className="text-[10px] border-roksal-amber/60 text-roksal-amber">
              <Eye className="w-3 h-3 mr-1" />
              Javno
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-white/40 text-white/70">
              <EyeOff className="w-3 h-3 mr-1" />
              Privatno
            </Badge>
          )}
          <span className="text-white/60 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDateSI(item.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// === Glavna komponenta ===
export function ReferenceGallery() {
  const { toast } = useToast();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [profili, setProfili] = useState<Profil[]>([]);
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Add form state
  const [addOpen, setAddOpen] = useState(false);
  const [formNaziv, setFormNaziv] = useState('');
  const [formOpis, setFormOpis] = useState('');
  const [formLokacija, setFormLokacija] = useState('');
  const [formProfilId, setFormProfilId] = useState<string>('');
  const [formSlikaPred, setFormSlikaPred] = useState<string>('');
  const [formSlikaPo, setFormSlikaPo] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Filters & sort
  const [search, setSearch] = useState('');
  const [filterProfilId, setFilterProfilId] = useState<string>('all');
  const [filterMaterial, setFilterMaterial] = useState<string>('all');
  const [filterLokacija, setFilterLokacija] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Featured (localStorage)
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [userImageMode, setUserImageMode] = useState<ImageMode>('po');

  // Export
  const [exporting, setExporting] = useState(false);

  // === Load gallery items ===
  const loadGallery = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gallery?all=true');
      if (!res.ok) throw new Error('Napaka pri nalaganju galerije');
      const data: GalleryItem[] = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Napaka',
        description: 'Nalaganje galerije ni uspelo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // === Load profili for select ===
  const loadProfili = useCallback(async () => {
    try {
      const res = await fetch('/api/profili');
      if (!res.ok) throw new Error('Napaka pri nalaganju profilov');
      const data: Profil[] = await res.json();
      setProfili(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadGallery();
    loadProfili();
  }, [loadGallery, loadProfili]);

  // === Load featured IDs from localStorage ===
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FEATURED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setFeaturedIds(parsed.filter((x) => typeof x === 'string'));
      }
    } catch {
      // ignore
    }
  }, []);

  // === Unique lokacije ===
  const lokacije = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.lokacija) set.add(i.lokacija);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'sl'));
  }, [items]);

  // === Unique years ===
  const years = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(getYear(i.createdAt)));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [items]);

  // === Filtered + sorted items ===
  const filtered = useMemo(() => {
    let result = items.slice();

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (i) =>
          i.naslov.toLowerCase().includes(q) ||
          (i.opis?.toLowerCase().includes(q) ?? false) ||
          (i.lokacija?.toLowerCase().includes(q) ?? false) ||
          (i.project?.customer?.ime?.toLowerCase().includes(q) ?? false) ||
          (i.profil?.naziv?.toLowerCase().includes(q) ?? false) ||
          (i.profil?.material?.toLowerCase().includes(q) ?? false)
      );
    }

    // Filters
    if (filterProfilId !== 'all') {
      result = result.filter((i) => i.profilId === filterProfilId);
    }
    if (filterMaterial !== 'all') {
      result = result.filter((i) => materialMatches(i.profil?.material, filterMaterial));
    }
    if (filterLokacija !== 'all') {
      result = result.filter((i) => i.lokacija === filterLokacija);
    }
    if (filterYear !== 'all') {
      result = result.filter((i) => getYear(i.createdAt) === filterYear);
    }

    // Sort — featured always first, then by selected sort
    result.sort((a, b) => {
      const af = isFeatured(a, featuredIds) ? 0 : 1;
      const bf = isFeatured(b, featuredIds) ? 0 : 1;
      if (af !== bf) return af - bf;

      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'az':
          return a.naslov.localeCompare(b.naslov, 'sl');
        case 'location':
          return (a.lokacija || '').localeCompare(b.lokacija || '', 'sl');
        default:
          return 0;
      }
    });

    return result;
  }, [items, search, filterProfilId, filterMaterial, filterLokacija, filterYear, sortBy, featuredIds]);

  // === Active filter count ===
  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (search.trim()) n++;
    if (filterProfilId !== 'all') n++;
    if (filterMaterial !== 'all') n++;
    if (filterLokacija !== 'all') n++;
    if (filterYear !== 'all') n++;
    return n;
  }, [search, filterProfilId, filterMaterial, filterLokacija, filterYear]);

  // === Lightbox navigation ===
  const openLightbox = useCallback(
    (index: number) => {
      const item = filtered[index];
      if (!item) return;
      setLightboxIndex(index);
      // Default image mode based on available images
      if (item.slikaPred && item.slikaPo) {
        setUserImageMode('slider');
      } else if (item.slikaPo) {
        setUserImageMode('po');
      } else if (item.slikaPred) {
        setUserImageMode('pred');
      } else {
        setUserImageMode('po');
      }
    },
    [filtered]
  );

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const prevLightbox = useCallback(() => {
    setLightboxIndex((curr) => {
      if (curr === null) return curr;
      return (curr - 1 + filtered.length) % filtered.length;
    });
  }, [filtered.length]);

  const nextLightbox = useCallback(() => {
    setLightboxIndex((curr) => {
      if (curr === null) return curr;
      return (curr + 1) % filtered.length;
    });
  }, [filtered.length]);

  // Compute effective image mode based on current item's available images
  // (falls back to a sensible default if the user's last choice isn't valid)
  const effectiveImageMode = useMemo<ImageMode>(() => {
    if (lightboxIndex === null) return 'po';
    const item = filtered[lightboxIndex];
    if (!item) return 'po';
    const hasPred = !!item.slikaPred;
    const hasPo = !!item.slikaPo;
    if (userImageMode === 'slider' && hasPred && hasPo) return 'slider';
    if (userImageMode === 'pred' && hasPred) return 'pred';
    if (userImageMode === 'po' && hasPo) return 'po';
    // Fallback
    if (hasPo) return 'po';
    if (hasPred) return 'pred';
    return 'po';
  }, [lightboxIndex, filtered, userImageMode]);

  // === Keyboard navigation for lightbox ===
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') prevLightbox();
      else if (e.key === 'ArrowRight') nextLightbox();
    };
    window.addEventListener('keydown', handler);
    // Lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIndex, closeLightbox, prevLightbox, nextLightbox]);

  // === Toggle featured ===
  const toggleFeatured = useCallback((id: string) => {
    setFeaturedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(FEATURED_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // === Clear all filters ===
  const clearFilters = useCallback(() => {
    setSearch('');
    setFilterProfilId('all');
    setFilterMaterial('all');
    setFilterLokacija('all');
    setFilterYear('all');
  }, []);

  // === Open item sheet (from lightbox "Podrobnosti" button) ===
  function openItemDetails(item: GalleryItem) {
    setSelectedItem(item);
    setSheetOpen(true);
  }

  // === Image upload handlers ===
  function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (b64: string) => void
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Prevelika slika',
        description: 'Največja dovoljena velikost je 5 MB.',
        variant: 'destructive',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setter(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  // === Reset form ===
  function resetForm() {
    setFormNaziv('');
    setFormOpis('');
    setFormLokacija('');
    setFormProfilId('');
    setFormSlikaPred('');
    setFormSlikaPo('');
  }

  // === Save new gallery item ===
  async function handleSave() {
    if (!formNaziv.trim()) {
      toast({
        title: 'Manjka naslov',
        description: 'Vnesite naslov galerijskega vnosa.',
        variant: 'destructive',
      });
      return;
    }
    if (!formSlikaPo && !formSlikaPred) {
      toast({
        title: 'Manjka slika',
        description: 'Naložite vsaj sliko Po (končno stanje).',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naslov: formNaziv.trim(),
          opis: formOpis.trim() || null,
          lokacija: formLokacija.trim() || null,
          profilId: formProfilId || null,
          slikaPred: formSlikaPred || null,
          slikaPo: formSlikaPo || null,
          javno: true,
        }),
      });
      if (!res.ok) throw new Error('Napaka pri shranjevanju');
      toast({
        title: 'Dodano v galerijo',
        description: `Vnos "${formNaziv}" je bil uspešno dodan v galerijo.`,
      });
      resetForm();
      setAddOpen(false);
      await loadGallery();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Napaka',
        description: 'Dodajanje v galerijo ni uspelo.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  // === PDF Export ===
  async function exportPdf() {
    if (filtered.length === 0) {
      toast({
        title: 'Ni podatkov',
        description: 'Ni realizacij za izvoz.',
        variant: 'destructive',
      });
      return;
    }
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const headerHeight = 18;
      const footerHeight = 10;
      const contentTop = headerHeight + 4;
      const contentBottom = pageHeight - footerHeight - 4;
      const contentHeight = contentBottom - contentTop;
      const colWidth = (pageWidth - 3 * margin) / 2;
      const imgHeight = contentHeight - 35; // leave space for title + meta

      const itemsToExport = filtered;
      const totalPages = Math.ceil(itemsToExport.length / 2);

      const drawHeader = (pageNo: number) => {
        // Navy header bar
        doc.setFillColor(29, 43, 62); // #1d2b3e
        doc.rect(0, 0, pageWidth, headerHeight, 'F');
        // Amber accent line
        doc.setFillColor(245, 158, 11); // #f59e0b
        doc.rect(0, headerHeight, pageWidth, 1.2, 'F');
        // Title text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ROKSAL', margin, 11);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Katalog realizacij', margin + 28, 11);
        // Page number
        doc.setFontSize(9);
        doc.text(`${pageNo} / ${totalPages}`, pageWidth - margin, 11, { align: 'right' });
      };

      const drawFooter = () => {
        doc.setFillColor(29, 43, 62);
        doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');
        doc.setTextColor(220, 220, 220);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date().toLocaleDateString('sl-SI', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        doc.text(`Roksal Kranj · Izvoz ${dateStr}`, margin, pageHeight - 3.5);
        doc.text('www.roksal.si', pageWidth - margin, pageHeight - 3.5, { align: 'right' });
      };

      // Helper: load image and add to doc
      const addImageToDoc = (
        src: string,
        x: number,
        y: number,
        w: number,
        h: number
      ): Promise<void> => {
        return new Promise((resolve) => {
          if (src.startsWith('data:')) {
            try {
              // Try JPEG first, fall back to PNG
              doc.addImage(src, 'JPEG', x, y, w, h, undefined, 'FAST');
            } catch {
              try {
                doc.addImage(src, 'PNG', x, y, w, h, undefined, 'FAST');
              } catch {
                drawPlaceholder(x, y, w, h);
              }
            }
            resolve();
            return;
          }
          // URL — load via Image and convert to dataURL via canvas
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || 800;
              canvas.height = img.naturalHeight || 600;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                drawPlaceholder(x, y, w, h);
                resolve();
                return;
              }
              ctx.fillStyle = '#f0f0f0';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
              doc.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST');
            } catch {
              drawPlaceholder(x, y, w, h);
            }
            resolve();
          };
          img.onerror = () => {
            drawPlaceholder(x, y, w, h);
            resolve();
          };
          img.src = src;
        });
      };

      const drawPlaceholder = (x: number, y: number, w: number, h: number) => {
        doc.setFillColor(240, 240, 240);
        doc.rect(x, y, w, h, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y, w, h);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('Brez slike', x + w / 2, y + h / 2, { align: 'center' });
      };

      const drawItemMeta = (item: GalleryItem, x: number, y: number, w: number) => {
        // Title
        doc.setTextColor(29, 43, 62);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        const title = (item.naslov || 'Brez naslova').slice(0, 70);
        doc.text(title, x, y);

        // Meta lines
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        let yMeta = y + 6;
        if (item.lokacija) {
          doc.text(`Lokacija: ${item.lokacija}`, x, yMeta);
          yMeta += 5;
        }
        if (item.profil) {
          doc.text(
            `Profil: ${item.profil.naziv} (${item.profil.material})`,
            x,
            yMeta
          );
          yMeta += 5;
        }
        if (item.project?.customer?.ime) {
          doc.text(`Stranka: ${item.project.customer.ime}`, x, yMeta);
          yMeta += 5;
        }
        doc.text(`Datum: ${formatDateShort(item.createdAt)}`, x, yMeta);

        // Description (if there's space)
        const cleanText = cleanOpis(item.opis);
        if (cleanText) {
          yMeta += 6;
          doc.setTextColor(60, 60, 60);
          doc.setFontSize(8);
          const lines = doc.splitTextToSize(cleanText, w);
          doc.text(lines.slice(0, 2), x, yMeta);
        }
      };

      // Render pages — 2 items per page
      let pageNo = 1;
      drawHeader(pageNo);

      for (let i = 0; i < itemsToExport.length; i += 2) {
        const item1 = itemsToExport[i];
        const item2 = itemsToExport[i + 1];

        // Column 1
        const x1 = margin;
        const imgY = contentTop;
        const src1 = item1.slikaPo || item1.slikaPred || '';
        if (src1) {
          await addImageToDoc(src1, x1, imgY, colWidth, imgHeight);
        } else {
          drawPlaceholder(x1, imgY, colWidth, imgHeight);
        }
        drawItemMeta(item1, x1, imgY + imgHeight + 5, colWidth);

        // Column 2
        if (item2) {
          const x2 = margin * 2 + colWidth;
          const src2 = item2.slikaPo || item2.slikaPred || '';
          if (src2) {
            await addImageToDoc(src2, x2, imgY, colWidth, imgHeight);
          } else {
            drawPlaceholder(x2, imgY, colWidth, imgHeight);
          }
          drawItemMeta(item2, x2, imgY + imgHeight + 5, colWidth);
        }

        drawFooter();

        if (i + 2 < itemsToExport.length) {
          doc.addPage();
          pageNo++;
          drawHeader(pageNo);
        }
      }

      doc.save('Roksal-katalog-realizacij.pdf');
      toast({
        title: 'Katalog izvožen',
        description: `Izvoženih ${itemsToExport.length} realizacij v PDF.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Napaka',
        description: 'Izvoz PDF ni uspel.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  }

  const currentLightboxItem =
    lightboxIndex !== null && lightboxIndex >= 0 && lightboxIndex < filtered.length
      ? filtered[lightboxIndex]
      : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-roksal-navy dark:text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-roksal-amber" />
            Galerija realizacij
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pred in po montaži · {items.length} vnosov
            {activeFiltersCount > 0 && ` · ${filtered.length} po filtrih`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportPdf}
            disabled={exporting || filtered.length === 0}
            className="h-8"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 mr-1" />
            )}
            Izvozi PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadGallery}
            disabled={loading}
            className="h-8"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Osveži
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setAddOpen(true)}
            className="h-8 bg-roksal-amber hover:bg-roksal-amber/90 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Dodaj v galerijo
          </Button>
        </div>
      </div>

      {/* Statistics card */}
      {!loading && items.length > 0 && <StatisticsCard items={items} />}

      {/* Filter bar */}
      {!loading && items.length > 0 && (
        <Card className="border-roksal-navy/10">
          <CardContent className="p-3 sm:p-4 space-y-3">
            {/* Search + sort row */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Iskanje po naslovu, opisu, lokaciji, stranki..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
                {search && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearch('')}
                    aria-label="Počisti iskanje"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="h-9 w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Najnovejše</SelectItem>
                    <SelectItem value="oldest">Najstarejše</SelectItem>
                    <SelectItem value="az">Po naslovu A-Z</SelectItem>
                    <SelectItem value="location">Po lokaciji</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Material pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" />
                Material:
              </span>
              <Button
                type="button"
                variant={filterMaterial === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMaterial('all')}
                className={`h-7 px-2.5 text-xs ${
                  filterMaterial === 'all'
                    ? 'bg-roksal-navy hover:bg-roksal-navy/90 text-white'
                    : ''
                }`}
              >
                Vse
              </Button>
              {MATERIALS.map((mat) => (
                <Button
                  key={mat}
                  type="button"
                  variant={filterMaterial === mat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterMaterial(filterMaterial === mat ? 'all' : mat)}
                  className={`h-7 px-2.5 text-xs ${
                    filterMaterial === mat
                      ? 'bg-roksal-amber hover:bg-roksal-amber/90 text-white'
                      : ''
                  }`}
                >
                  {mat}
                </Button>
              ))}
            </div>

            {/* Selects: profil, lokacija, year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={filterProfilId} onValueChange={setFilterProfilId}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Vsi profili" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsi profili</SelectItem>
                  {profili.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.naziv} ({p.material})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterLokacija} onValueChange={setFilterLokacija}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Vse lokacije" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vse lokacije</SelectItem>
                  {lokacije.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Vsa leta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsa leta</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active filter badges */}
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t">
                <span className="text-xs text-muted-foreground">Aktivni filtri:</span>
                {search.trim() && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    Iskanje: &quot;{search.trim().slice(0, 20)}&quot;
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="ml-0.5 hover:bg-muted-foreground/20 rounded"
                      aria-label="Odstrani iskanje"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {filterProfilId !== 'all' && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    Profil: {profili.find((p) => p.id === filterProfilId)?.naziv || '?'}
                    <button
                      type="button"
                      onClick={() => setFilterProfilId('all')}
                      className="ml-0.5 hover:bg-muted-foreground/20 rounded"
                      aria-label="Odstrani filter profila"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {filterMaterial !== 'all' && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    Material: {filterMaterial}
                    <button
                      type="button"
                      onClick={() => setFilterMaterial('all')}
                      className="ml-0.5 hover:bg-muted-foreground/20 rounded"
                      aria-label="Odstrani filter materiala"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {filterLokacija !== 'all' && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    Lokacija: {filterLokacija}
                    <button
                      type="button"
                      onClick={() => setFilterLokacija('all')}
                      className="ml-0.5 hover:bg-muted-foreground/20 rounded"
                      aria-label="Odstrani filter lokacije"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {filterYear !== 'all' && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    Leto: {filterYear}
                    <button
                      type="button"
                      onClick={() => setFilterYear('all')}
                      className="ml-0.5 hover:bg-muted-foreground/20 rounded"
                      aria-label="Odstrani filter leta"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                >
                  Počisti vse
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Masonry grid / skeleton / empty */}
      {loading ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="break-inside-avoid mb-3 overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Galerija je še prazna
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Dodajte prvi vnos s klikom na gumb &quot;Dodaj v galerijo&quot; zgoraj.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <Search className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Ni realizacij, ki ustrezajo filtrom
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto mb-4">
              Poskusite spremeniti iskalni niz ali počistiti aktivne filtre.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="h-8"
            >
              <X className="w-4 h-4 mr-1" />
              Počisti filtre
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-3">
          {filtered.map((item, idx) => {
            const featured = isFeatured(item, featuredIds);
            const hasBoth = !!item.slikaPred && !!item.slikaPo;
            return (
              <Card
                key={item.id}
                className="break-inside-avoid mb-3 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group relative"
                onClick={() => openLightbox(idx)}
              >
                <div className="relative overflow-hidden bg-muted">
                  {item.slikaPo ? (
                    <img
                      src={item.slikaPo}
                      alt={item.naslov}
                      className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : item.slikaPred ? (
                    <img
                      src={item.slikaPred}
                      alt={item.naslov}
                      className="w-full h-auto object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-video flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                  )}
                  {/* Pred/Po badge */}
                  {hasBoth && (
                    <Badge
                      variant="secondary"
                      className="absolute top-2 left-2 bg-roksal-amber/90 text-white text-[10px]"
                    >
                      Pred / Po
                    </Badge>
                  )}
                  {/* Featured badge */}
                  {featured && (
                    <Badge
                      variant="secondary"
                      className="absolute top-2 right-2 bg-white/90 text-roksal-amber text-[10px] gap-0.5 border border-roksal-amber/40"
                    >
                      <Star className="w-3 h-3 fill-roksal-amber" />
                      Izpostavljeno
                    </Badge>
                  )}
                  {/* Hover hint */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100">
                    <span className="text-[10px] text-white bg-black/50 px-2 py-0.5 rounded">
                      Klikni za predogled
                    </span>
                  </div>
                </div>
                <CardContent className="p-3 space-y-1">
                  <h3 className="text-sm font-semibold text-roksal-navy dark:text-white line-clamp-1">
                    {item.naslov}
                  </h3>
                  {item.lokacija && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{item.lokacija}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {item.profil && (
                      <Badge variant="outline" className="text-[10px]">
                        {item.profil.naziv}
                      </Badge>
                    )}
                    {item.profil?.material && (
                      <Badge variant="secondary" className="text-[10px]">
                        {item.profil.material}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {formatDateShort(item.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* === Lightbox === */}
      {currentLightboxItem && (
        <Lightbox
          item={currentLightboxItem}
          hasPrev={filtered.length > 1}
          hasNext={filtered.length > 1}
          featured={isFeatured(currentLightboxItem, featuredIds)}
          imageMode={effectiveImageMode}
          onImageModeChange={setUserImageMode}
          onClose={closeLightbox}
          onPrev={prevLightbox}
          onNext={nextLightbox}
          onToggleFeatured={() => toggleFeatured(currentLightboxItem.id)}
          onOpenDetails={() => openItemDetails(currentLightboxItem)}
        />
      )}

      {/* === Detail Sheet === */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto p-4 sm:p-6"
        >
          <SheetHeader>
            <SheetTitle className="text-roksal-navy dark:text-white">
              {selectedItem?.naslov}
            </SheetTitle>
            {selectedItem?.lokacija && (
              <SheetDescription className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {selectedItem.lokacija}
              </SheetDescription>
            )}
          </SheetHeader>

          {selectedItem && (
            <div className="mt-4 space-y-4">
              {selectedItem.slikaPred && selectedItem.slikaPo ? (
                <BeforeAfterSlider
                  beforeSrc={selectedItem.slikaPred}
                  afterSrc={selectedItem.slikaPo}
                />
              ) : selectedItem.slikaPo ? (
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={selectedItem.slikaPo}
                    alt={selectedItem.naslov}
                    className="w-full h-auto"
                  />
                </div>
              ) : selectedItem.slikaPred ? (
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={selectedItem.slikaPred}
                    alt={selectedItem.naslov}
                    className="w-full h-auto"
                  />
                </div>
              ) : null}

              {cleanOpis(selectedItem.opis) && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Opis
                  </h4>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {cleanOpis(selectedItem.opis)}
                  </p>
                </div>
              )}

              {selectedItem.profil && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Profil
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{selectedItem.profil.naziv}</Badge>
                    <Badge variant="secondary">{selectedItem.profil.material}</Badge>
                    <Badge variant="secondary">{selectedItem.profil.kategorija}</Badge>
                  </div>
                </div>
              )}

              {selectedItem.project?.customer?.ime && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Stranka
                  </h4>
                  <p className="text-sm text-foreground">
                    {selectedItem.project.customer.ime}
                  </p>
                </div>
              )}

              <Separator />

              <div className="text-xs text-muted-foreground">
                Dodano: {formatDateSI(selectedItem.createdAt)}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* === Add dialog === */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-navy dark:text-white">
              <Plus className="w-5 h-5 text-roksal-amber" />
              Dodaj v galerijo
            </DialogTitle>
            <DialogDescription>
              Dodaj novo realizacijo s slikami pred in po montaži.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-naziv" className="text-xs">
                Naslov *
              </Label>
              <Input
                id="g-naziv"
                type="text"
                placeholder="npr. Balkon Kranj - WPC H-Line"
                value={formNaziv}
                onChange={(e) => setFormNaziv(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-lokacija" className="text-xs">
                  Lokacija
                </Label>
                <Input
                  id="g-lokacija"
                  type="text"
                  placeholder="npr. Kranj"
                  value={formLokacija}
                  onChange={(e) => setFormLokacija(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-profil" className="text-xs">
                  Profil
                </Label>
                <Select value={formProfilId} onValueChange={setFormProfilId}>
                  <SelectTrigger id="g-profil" className="w-full">
                    <SelectValue placeholder="Izberi profil" />
                  </SelectTrigger>
                  <SelectContent>
                    {profili.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.naziv}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="g-opis" className="text-xs">
                Opis
              </Label>
              <Textarea
                id="g-opis"
                placeholder="Kratek opis projekta, dimenzije, posebnosti..."
                value={formOpis}
                onChange={(e) => setFormOpis(e.target.value)}
                rows={3}
              />
            </div>

            {/* Image uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Slika PRED (opcijsko)</Label>
                <label className="cursor-pointer">
                  <div className="aspect-video rounded-lg border-2 border-dashed border-border hover:border-roksal-amber/50 transition-colors flex items-center justify-center overflow-hidden bg-muted/30">
                    {formSlikaPred ? (
                      <img
                        src={formSlikaPred}
                        alt="Pred"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Upload className="w-6 h-6 mx-auto mb-1" />
                        <span className="text-[10px]">Klikni za nalaganje</span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, setFormSlikaPred)}
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Slika PO *</Label>
                <label className="cursor-pointer">
                  <div className="aspect-video rounded-lg border-2 border-dashed border-border hover:border-roksal-amber/50 transition-colors flex items-center justify-center overflow-hidden bg-muted/30">
                    {formSlikaPo ? (
                      <img
                        src={formSlikaPo}
                        alt="Po"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Upload className="w-6 h-6 mx-auto mb-1" />
                        <span className="text-[10px]">Klikni za nalaganje</span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, setFormSlikaPo)}
                  />
                </label>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Največja velikost slike: 5 MB. Priporočena ločljivost 1920×1080.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={saving}
            >
              Prekliči
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-roksal-amber hover:bg-roksal-amber/90 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Shranjujem...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Dodaj
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
