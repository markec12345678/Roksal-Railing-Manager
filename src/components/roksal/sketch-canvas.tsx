'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Undo2,
  Trash2,
  Ruler,
  Eye,
  Pencil,
  Save,
  X,
  FolderOpen,
  Loader2,
  Image as ImageIcon,
  Trash,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// === Tipi ===
interface DrawingPoint {
  x: number;
  y: number;
}

type DrawingMode = 'VIEW' | 'DRAW' | 'MEASURE';

interface DrawingStroke {
  points: DrawingPoint[];
  color: string;
  width: number;
  mode: DrawingMode;
  label?: string;
}

interface SavedSketch {
  id: string;
  projectId: string;
  naziv: string;
  pngData: string;
  povzetek: string | null;
  createdAt: string;
}

interface SketchCanvasProps {
  projectId: string;
  onClose: () => void;
}

const DRAW_COLORS = [
  { name: 'Antracit', hex: '#383E42' },
  { name: 'Bela', hex: '#FFFFFF' },
  { name: 'Rdeča', hex: '#ef4444' },
  { name: 'Rumena', hex: '#fbbf24' },
  { name: 'Zelena', hex: '#10b981' },
  { name: 'Modra', hex: '#3b82f6' },
];

// === Pomožne risalske funkcije ===
function drawQuadraticBezier(
  ctx: CanvasRenderingContext2D,
  points: DrawingPoint[]
) {
  if (points.length <= 1) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;
  const step = 20;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMeasurementLine(
  ctx: CanvasRenderingContext2D,
  p1: DrawingPoint,
  p2: DrawingPoint,
  label: string,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
  ctx.fill();

  if (label) {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#000';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeText(label, midX + 5, midY - 8);
    ctx.fillText(label, midX + 5, midY - 8);
  }
  ctx.restore();
}

// === Glavna komponenta ===
export function SketchCanvas({ projectId, onClose }: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [mode, setMode] = useState<DrawingMode>('VIEW');
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentPoints, setCurrentPoints] = useState<DrawingPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokeColor, setStrokeColor] = useState('#FFFFFF');
  const [measureStart, setMeasureStart] = useState<DrawingPoint | null>(null);

  // Dialog za vnos meritve
  const [measureDialogOpen, setMeasureDialogOpen] = useState(false);
  const [pendingMeasure, setPendingMeasure] = useState<{
    start: DrawingPoint;
    end: DrawingPoint;
    pixelLen: number;
  } | null>(null);
  const [measureLabel, setMeasureLabel] = useState('');

  // Save dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [sketchName, setSketchName] = useState('');
  const [sketchSummary, setSketchSummary] = useState('');
  const [saving, setSaving] = useState(false);

  // Load dialog
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [savedSketches, setSavedSketches] = useState<SavedSketch[]>([]);
  const [loadingSketches, setLoadingSketches] = useState(false);
  const [viewingSketch, setViewingSketch] = useState<SavedSketch | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    canvas.width = rect.width;
    canvas.height = rect.height;

    // Ozadje
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Mreža
    drawGrid(ctx, canvas.width, canvas.height);

    // Nariši vse poteze
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      if (stroke.mode === 'MEASURE' && stroke.points.length >= 2) {
        drawMeasurementLine(
          ctx,
          stroke.points[0],
          stroke.points[stroke.points.length - 1],
          stroke.label || '',
          stroke.color
        );
      } else {
        ctx.save();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawQuadraticBezier(ctx, stroke.points);
        ctx.restore();
      }
    }

    // Nariši trenutno potezo
    if (currentPoints.length > 1) {
      if (mode === 'MEASURE' && measureStart) {
        drawMeasurementLine(
          ctx,
          currentPoints[0],
          currentPoints[currentPoints.length - 1],
          '',
          '#ef4444'
        );
      } else {
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawQuadraticBezier(ctx, currentPoints);
        ctx.restore();
      }
    }
  }, [strokes, currentPoints, mode, measureStart, strokeWidth, strokeColor]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const handleResize = () => redraw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redraw]);

  // === Pointer handling ===
  function getCanvasPoint(e: React.MouseEvent | React.TouchEvent): DrawingPoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function handlePointerDown(e: React.MouseEvent | React.TouchEvent) {
    if (mode === 'VIEW') return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    setIsDrawing(true);

    if (mode === 'MEASURE') {
      setMeasureStart(pt);
      setCurrentPoints([pt]);
      return;
    }

    // DRAW mode
    setCurrentPoints([pt]);
  }

  function handlePointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || mode === 'VIEW') return;
    e.preventDefault();
    const pt = getCanvasPoint(e);

    if (mode === 'MEASURE' && measureStart) {
      setCurrentPoints([measureStart, pt]);
      return;
    }

    setCurrentPoints((prev) => [...prev, pt]);
  }

  function handlePointerUp(_e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length < 2) {
      setCurrentPoints([]);
      setMeasureStart(null);
      return;
    }

    if (mode === 'MEASURE' && measureStart) {
      const endPt = currentPoints[currentPoints.length - 1];
      const dx = endPt.x - measureStart.x;
      const dy = endPt.y - measureStart.y;
      const pixelLen = Math.sqrt(dx * dx + dy * dy);

      setPendingMeasure({
        start: measureStart,
        end: endPt,
        pixelLen,
      });
      setMeasureLabel('');
      setMeasureDialogOpen(true);
      setMeasureStart(null);
      setCurrentPoints([]);
      return;
    }

    // DRAW mode - shrani potezo
    const newStroke: DrawingStroke = {
      points: [...currentPoints],
      color: strokeColor,
      width: strokeWidth,
      mode: 'DRAW',
    };
    setStrokes((prev) => [...prev, newStroke]);
    setCurrentPoints([]);
  }

  // === Akcije ===
  function handleUndo() {
    if (strokes.length === 0) return;
    setStrokes((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    if (strokes.length === 0) return;
    setStrokes([]);
    setCurrentPoints([]);
    setMeasureStart(null);
    toast({
      title: 'Počiščeno',
      description: 'Vse poteze so bile izbrisane s platna.',
    });
  }

  function confirmMeasure() {
    if (!pendingMeasure || !measureLabel.trim()) return;
    const newStroke: DrawingStroke = {
      points: [pendingMeasure.start, pendingMeasure.end],
      color: '#ef4444',
      width: 2,
      mode: 'MEASURE',
      label: measureLabel.trim(),
    };
    setStrokes((prev) => [...prev, newStroke]);
    setPendingMeasure(null);
    setMeasureLabel('');
    setMeasureDialogOpen(false);
  }

  function cancelMeasure() {
    setPendingMeasure(null);
    setMeasureLabel('');
    setMeasureDialogOpen(false);
  }

  // === Save / Load ===
  function openSaveDialog() {
    if (strokes.length === 0) {
      toast({
        title: 'Platno je prazno',
        description: 'Najprej nariši kaj preden shraniš.',
        variant: 'destructive',
      });
      return;
    }
    setSketchName(`Skica ${new Date().toLocaleDateString('sl-SI')}`);
    setSketchSummary('');
    setSaveDialogOpen(true);
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const pngData = canvas.toDataURL('image/png');
      const res = await fetch('/api/sketches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          naziv: sketchName.trim() || `Skica ${new Date().toLocaleDateString('sl-SI')}`,
          pngData,
          povzetek: sketchSummary.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Napaka pri shranjevanju');
      toast({
        title: 'Skica shranjena',
        description: `Skica "${sketchName}" je bila uspešno shranjena v bazo.`,
      });
      setSaveDialogOpen(false);
      setSketchName('');
      setSketchSummary('');
    } catch (err) {
      console.error(err);
      toast({
        title: 'Napaka',
        description: 'Shranjevanje skice ni uspelo. Poskusi znova.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function loadSketches() {
    setLoadingSketches(true);
    try {
      const res = await fetch(`/api/sketches?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) throw new Error('Napaka pri nalaganju');
      const data: SavedSketch[] = await res.json();
      setSavedSketches(data);
      setLoadDialogOpen(true);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Napaka',
        description: 'Nalaganje skic ni uspelo.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSketches(false);
    }
  }

  async function deleteSketch(id: string) {
    try {
      const res = await fetch(`/api/sketches?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Napaka pri brisanju');
      setSavedSketches((prev) => prev.filter((s) => s.id !== id));
      if (viewingSketch?.id === id) setViewingSketch(null);
      toast({
        title: 'Skica izbrisana',
        description: 'Skica je bila trajno izbrisana.',
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Napaka',
        description: 'Brisanje skice ni uspelo.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-roksal-navy text-white">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/10 h-8 px-2"
          >
            <X className="w-4 h-4 mr-1" />
            Zapri
          </Button>
          <div className="hidden sm:block text-xs text-white/60 truncate">
            Skica · Projekt #{projectId}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={loadSketches}
                disabled={loadingSketches}
                className="text-white hover:bg-white/10 h-8 w-8"
              >
                {loadingSketches ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderOpen className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Naloži shranjene skice</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            size="sm"
            onClick={openSaveDialog}
            className="bg-roksal-amber hover:bg-roksal-amber/90 text-white h-8"
          >
            <Save className="w-4 h-4 mr-1" />
            Shrani
          </Button>
        </div>
      </header>

      {/* Mode + tools toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b bg-muted/30">
        {/* Mode buttons */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            type="button"
            size="sm"
            variant={mode === 'VIEW' ? 'default' : 'ghost'}
            onClick={() => setMode('VIEW')}
            className={cn(
              'h-8 px-2.5',
              mode === 'VIEW' && 'bg-roksal-navy text-white hover:bg-roksal-navy/90'
            )}
          >
            <Eye className="w-4 h-4 mr-1" />
            Pogled
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'DRAW' ? 'default' : 'ghost'}
            onClick={() => setMode('DRAW')}
            className={cn(
              'h-8 px-2.5',
              mode === 'DRAW' && 'bg-roksal-navy text-white hover:bg-roksal-navy/90'
            )}
          >
            <Pencil className="w-4 h-4 mr-1" />
            Risanje
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'MEASURE' ? 'default' : 'ghost'}
            onClick={() => setMode('MEASURE')}
            className={cn(
              'h-8 px-2.5',
              mode === 'MEASURE' && 'bg-roksal-navy text-white hover:bg-roksal-navy/90'
            )}
          >
            <Ruler className="w-4 h-4 mr-1" />
            Mera
          </Button>
        </div>

        {/* Undo / Clear */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className="h-8 w-8 p-0"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Razveljavi</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClear}
                disabled={strokes.length === 0}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Počisti platno</TooltipContent>
          </Tooltip>
        </div>

        {/* Color picker (only DRAW) */}
        {mode === 'DRAW' && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground hidden sm:inline">Barva:</span>
            <div className="flex items-center gap-1">
              {DRAW_COLORS.map((c) => (
                <Tooltip key={c.hex}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setStrokeColor(c.hex)}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-all',
                        strokeColor === c.hex
                          ? 'border-roksal-amber scale-110'
                          : 'border-white/30'
                      )}
                      style={{ backgroundColor: c.hex }}
                      aria-label={`Barva ${c.name}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{c.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        {/* Stroke width slider */}
        {mode === 'DRAW' && (
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Debelina
            </Label>
            <Slider
              value={[strokeWidth]}
              onValueChange={(v) => setStrokeWidth(v[0] ?? 3)}
              min={1}
              max={12}
              step={1}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground w-6 text-right">
              {strokeWidth}
            </span>
          </div>
        )}

        {mode === 'MEASURE' && (
          <Badge variant="outline" className="ml-auto text-red-600 border-red-600/40">
            <Ruler className="w-3 h-3 mr-1" />
            Način merjenja — potegni črto
          </Badge>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full bg-[#1a1a2e] overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className={cn(
            'absolute inset-0 w-full h-full touch-none',
            mode === 'VIEW' ? 'cursor-default' : 'cursor-crosshair'
          )}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
        {strokes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-white/40 px-6">
              <ImageIcon className="w-12 h-12 mx-auto mb-3" />
              <p className="text-sm font-medium">
                Prazno platno
              </p>
              <p className="text-xs mt-1 max-w-xs">
                Izberi način <span className="text-roksal-amber">Risanje</span> za
                ročno skiciranje ali <span className="text-roksal-amber">Mera</span>{' '}
                za označevanje dimenzij.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer status */}
      <footer className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
        <span>Poteze: {strokes.length}</span>
        <span>Način: {mode === 'VIEW' ? 'Pogled' : mode === 'DRAW' ? 'Risanje' : 'Merjenje'}</span>
      </footer>

      {/* Measure dialog */}
      <Dialog open={measureDialogOpen} onOpenChange={setMeasureDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-navy dark:text-white">
              <Ruler className="w-5 h-5 text-roksal-amber" />
              Vnesi mero
            </DialogTitle>
            <DialogDescription>
              Označil si črto na platnu. Vnesi dejansko dolžino ali oznako, ki naj
              se prikaže ob črti.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pendingMeasure && (
              <div className="text-xs text-muted-foreground bg-muted rounded p-2">
                Dolžina črte: {Math.round(pendingMeasure.pixelLen)} px
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="measure-label" className="text-xs">
                Oznaka / dolžina
              </Label>
              <Input
                id="measure-label"
                type="text"
                placeholder="npr. 240 cm, 2,4 m, širina balkona"
                value={measureLabel}
                onChange={(e) => setMeasureLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmMeasure();
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={cancelMeasure}>
              Prekliči
            </Button>
            <Button
              type="button"
              onClick={confirmMeasure}
              disabled={!measureLabel.trim()}
              className="bg-roksal-navy hover:bg-roksal-navy/90 text-white"
            >
              Potrdi mero
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-navy dark:text-white">
              <Save className="w-5 h-5 text-roksal-amber" />
              Shrani skico
            </DialogTitle>
            <DialogDescription>
              Skica bo shranjena v bazo in povezana s trenutnim projektom.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sketch-name" className="text-xs">
                Naziv skice
              </Label>
              <Input
                id="sketch-name"
                type="text"
                placeholder="npr. Tloris balkona Kranj"
                value={sketchName}
                onChange={(e) => setSketchName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sketch-summary" className="text-xs">
                Povzetek (opcijsko)
              </Label>
              <Input
                id="sketch-summary"
                type="text"
                placeholder="kratek opis ali dimenzije"
                value={sketchSummary}
                onChange={(e) => setSketchSummary(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
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
                  <Save className="w-4 h-4 mr-1" />
                  Shrani
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-roksal-navy dark:text-white">
              <FolderOpen className="w-5 h-5 text-roksal-amber" />
              Shranjene skice
            </DialogTitle>
            <DialogDescription>
              Skice za projekt #{projectId}. Klikni za ogled.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[55vh] -mx-1 px-1">
            {savedSketches.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                Za ta projekt še ni shranjenih skic.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pr-2">
                {savedSketches.map((sk) => (
                  <div
                    key={sk.id}
                    className="group relative rounded-lg border overflow-hidden bg-card"
                  >
                    { }
                    <img
                      src={sk.pngData}
                      alt={sk.naziv}
                      className="w-full aspect-video object-cover cursor-pointer bg-[#1a1a2e]"
                      onClick={() => setViewingSketch(sk)}
                    />
                    <div className="p-2">
                      <div className="text-xs font-semibold truncate text-roksal-navy dark:text-white">
                        {sk.naziv}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(sk.createdAt).toLocaleDateString('sl-SI')}
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => deleteSketch(sk.id)}
                          className="absolute top-1 right-1 p-1.5 rounded-full bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Izbriši skico"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Izbriši skico</TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLoadDialogOpen(false)}
            >
              Zapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View sketch fullscreen */}
      <Dialog open={!!viewingSketch} onOpenChange={(o) => !o && setViewingSketch(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-roksal-navy dark:text-white">
              {viewingSketch?.naziv}
            </DialogTitle>
            {viewingSketch?.povzetek && (
              <DialogDescription>{viewingSketch.povzetek}</DialogDescription>
            )}
          </DialogHeader>
          {viewingSketch && (
            <div className="overflow-auto max-h-[70vh] rounded-lg bg-[#1a1a2e]">
              { }
              <img
                src={viewingSketch.pngData}
                alt={viewingSketch.naziv}
                className="w-full h-auto"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewingSketch(null)}
            >
              Zapri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
