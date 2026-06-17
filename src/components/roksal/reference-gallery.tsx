'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  MapPin,
  Loader2,
  ImageIcon,
  Upload,
  GripVertical,
  RefreshCw,
} from 'lucide-react';

// === Tipi ===
interface Profil {
  id: string;
  sifra: string;
  naziv: string;
  material: string;
  kategorija: string;
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
      {/* After image (full) */}
      { }
      <img
        src={afterSrc}
        alt="Po montaži"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Before image (clipped) */}
      { }
      <img
        src={beforeSrc}
        alt="Pred montažo"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 ${100 - percentage}% 0 0)` }}
        draggable={false}
      />

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
        style={{ left: `${percentage}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg">
          <GripVertical className="w-4 h-4 text-roksal-navy" />
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded z-20">
        Pred
      </div>
      <div className="absolute top-2 right-2 bg-roksal-amber/90 text-white text-xs px-2 py-1 rounded z-20">
        Po
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

  // === Open card → Sheet ===
  function openItem(item: GalleryItem) {
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-roksal-navy dark:text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-roksal-amber" />
            Galeria realizacij
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pred in po montaži · {items.length} vnosov
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <CardContent className="p-4 space-y-2">
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => openItem(item)}
            >
              <div className="aspect-video relative overflow-hidden bg-muted">
                {item.slikaPo ? (
                   
                  <img
                    src={item.slikaPo}
                    alt={item.naslov}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : item.slikaPred ? (
                   
                  <img
                    src={item.slikaPred}
                    alt={item.naslov}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                  </div>
                )}
                {item.slikaPred && item.slikaPo && (
                  <Badge
                    variant="secondary"
                    className="absolute top-2 left-2 bg-roksal-amber/90 text-white text-[10px]"
                  >
                    Pred / Po
                  </Badge>
                )}
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
                {item.profil && (
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {item.profil.naziv}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
                  { }
                  <img
                    src={selectedItem.slikaPo}
                    alt={selectedItem.naslov}
                    className="w-full h-auto"
                  />
                </div>
              ) : selectedItem.slikaPred ? (
                <div className="rounded-lg overflow-hidden border">
                  { }
                  <img
                    src={selectedItem.slikaPred}
                    alt={selectedItem.naslov}
                    className="w-full h-auto"
                  />
                </div>
              ) : null}

              {selectedItem.opis && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Opis
                  </h4>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {selectedItem.opis}
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
                    <Badge variant="secondary">
                      {selectedItem.profil.kategorija}
                    </Badge>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-2 border-t">
                Dodano:{' '}
                {new Date(selectedItem.createdAt).toLocaleDateString('sl-SI', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
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
