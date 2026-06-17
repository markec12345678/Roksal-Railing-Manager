'use client';

import React, { useState, useMemo } from 'react';
import { RAL_BALCONY_COLORS, RAL_CATEGORIES, findRALColor, type RALColor } from '@/lib/ral-colors';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Check, Search, Palette, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RALColorPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (ralCode: string, ralName: string, hex: string) => void;
  value?: string;
}

export function RALColorPicker({
  open,
  onOpenChange,
  onSelect,
  value,
}: RALColorPickerProps) {
  const [category, setCategory] = useState<string>('Vse');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<RALColor | null>(null);

  const filteredColors = useMemo(() => {
    let colors: RALColor[] = RAL_BALCONY_COLORS;
    if (category !== 'Vse') {
      colors = colors.filter((c) => c.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      colors = colors.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q)
      );
    }
    return colors;
  }, [category, search]);

  const selectedColor = value
    ? findRALColor(value)
    : preview ?? undefined;

  function handleConfirm() {
    if (preview) {
      onSelect(preview.code, preview.name, preview.hexColor);
    } else if (value && selectedColor) {
      onSelect(selectedColor.code, selectedColor.name, selectedColor.hexColor);
    }
    setPreview(null);
    setSearch('');
    setCategory('Vse');
    onOpenChange(false);
  }

  function handleCancel() {
    setPreview(null);
    setSearch('');
    setCategory('Vse');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-4 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-roksal-navy dark:text-white">
            <Palette className="w-5 h-5 text-roksal-amber" />
            Izberi RAL barvo
          </DialogTitle>
          <DialogDescription>
            Roksal palet 26 standardnih barv za balkonske ograje. Izberi barvo kovinskih delov (stebrički, nosilci).
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Išči RAL kodo ali ime..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {RAL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                category === cat
                  ? 'bg-roksal-amber text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Selected color preview */}
        {selectedColor && (
          <div className="flex items-center gap-3 p-2 rounded-lg border border-roksal-amber/30 bg-roksal-amber/5">
            <div
              className="w-10 h-10 rounded border border-white/20 flex-shrink-0 shadow-sm"
              style={{ backgroundColor: selectedColor.hexColor }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-roksal-navy dark:text-white">
                RAL {selectedColor.code}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {selectedColor.name}
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              {selectedColor.hexColor.toUpperCase()}
            </Badge>
          </div>
        )}

        {/* Color grid */}
        <ScrollArea className="flex-1 max-h-[40vh] sm:max-h-[45vh] -mx-1 px-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pr-2">
            {filteredColors.length === 0 ? (
              <div className="col-span-full text-center py-8 text-sm text-muted-foreground">
                Ni najdenih barv za iskanje &quot;{search}&quot;
              </div>
            ) : (
              filteredColors.map((color) => {
                const isActive =
                  (preview?.code === color.code) ||
                  (!preview && value === color.code);
                const isLight = ['#FFFFFF', '#EDEDED', '#F6F6F6'].includes(
                  color.hexColor
                );
                return (
                  <button
                    key={color.code}
                    type="button"
                    onClick={() => setPreview(color)}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg border transition-all hover:bg-muted/50 text-left',
                      isActive
                        ? 'border-roksal-amber ring-2 ring-roksal-amber/40 bg-roksal-amber/5'
                        : 'border-border'
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-9 h-9 rounded border border-white/20 shadow-sm"
                        style={{ backgroundColor: color.hexColor }}
                      />
                      {isActive && (
                        <Check
                          className={cn(
                            'absolute inset-0 w-9 h-9 p-1.5',
                            isLight ? 'text-black' : 'text-white'
                          )}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate text-roksal-navy dark:text-white">
                        RAL {color.code}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {color.name}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="h-9"
          >
            <X className="w-4 h-4 mr-1" />
            Prekliči
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!preview && !value}
            className="h-9 bg-roksal-navy hover:bg-roksal-navy/90 text-white"
          >
            <Check className="w-4 h-4 mr-1" />
            Potrdi izbiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
