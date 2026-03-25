'use client';

import { useState, useMemo } from 'react';
import { Search, X, Check, Palette } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// ── Colour catalogue ────────────────────────────────────────────────────────

interface ColourEntry {
  name: string;
  hex: string;
  group: string;
}

const COLOUR_CATALOGUE: ColourEntry[] = [
  // Whites & Creams
  { name: 'White', hex: '#FFFFFF', group: 'White & Cream' },
  { name: 'Off White', hex: '#FAF9F6', group: 'White & Cream' },
  { name: 'Ivory', hex: '#FFFFF0', group: 'White & Cream' },
  { name: 'Cream', hex: '#FFFDD0', group: 'White & Cream' },
  { name: 'Champagne', hex: '#F7E7CE', group: 'White & Cream' },
  { name: 'Linen', hex: '#FAF0E6', group: 'White & Cream' },
  // Neutrals
  { name: 'Light Grey', hex: '#D3D3D3', group: 'Neutral' },
  { name: 'Silver', hex: '#C0C0C0', group: 'Neutral' },
  { name: 'Grey', hex: '#808080', group: 'Neutral' },
  { name: 'Ash Grey', hex: '#B2BEB5', group: 'Neutral' },
  { name: 'Charcoal', hex: '#36454F', group: 'Neutral' },
  { name: 'Dark Grey', hex: '#A9A9A9', group: 'Neutral' },
  { name: 'Stone', hex: '#928E85', group: 'Neutral' },
  { name: 'Taupe', hex: '#483C32', group: 'Neutral' },
  // Blacks
  { name: 'Black', hex: '#000000', group: 'Black' },
  { name: 'Jet Black', hex: '#0A0A0A', group: 'Black' },
  { name: 'Midnight', hex: '#1A1A2E', group: 'Black' },
  // Browns
  { name: 'Beige', hex: '#F5F5DC', group: 'Brown & Beige' },
  { name: 'Sand', hex: '#C2B280', group: 'Brown & Beige' },
  { name: 'Tan', hex: '#D2B48C', group: 'Brown & Beige' },
  { name: 'Camel', hex: '#C19A6B', group: 'Brown & Beige' },
  { name: 'Khaki', hex: '#C3B091', group: 'Brown & Beige' },
  { name: 'Mocha', hex: '#967259', group: 'Brown & Beige' },
  { name: 'Brown', hex: '#964B00', group: 'Brown & Beige' },
  { name: 'Chocolate', hex: '#7B3F00', group: 'Brown & Beige' },
  { name: 'Coffee', hex: '#6F4E37', group: 'Brown & Beige' },
  { name: 'Espresso', hex: '#3A2D28', group: 'Brown & Beige' },
  // Reds
  { name: 'Light Red', hex: '#FF6B6B', group: 'Red' },
  { name: 'Red', hex: '#FF0000', group: 'Red' },
  { name: 'Crimson', hex: '#DC143C', group: 'Red' },
  { name: 'Cherry', hex: '#9B2335', group: 'Red' },
  { name: 'Burgundy', hex: '#800020', group: 'Red' },
  { name: 'Maroon', hex: '#800000', group: 'Red' },
  { name: 'Wine', hex: '#722F37', group: 'Red' },
  { name: 'Rust', hex: '#B7410E', group: 'Red' },
  { name: 'Terracotta', hex: '#E2725B', group: 'Red' },
  // Pinks
  { name: 'Light Pink', hex: '#FFB6C1', group: 'Pink' },
  { name: 'Pink', hex: '#FFC0CB', group: 'Pink' },
  { name: 'Baby Pink', hex: '#F4C2C2', group: 'Pink' },
  { name: 'Rose', hex: '#FF007F', group: 'Pink' },
  { name: 'Dusty Rose', hex: '#DCAE96', group: 'Pink' },
  { name: 'Blush', hex: '#DE5D83', group: 'Pink' },
  { name: 'Fuchsia', hex: '#FF00FF', group: 'Pink' },
  { name: 'Hot Pink', hex: '#FF69B4', group: 'Pink' },
  { name: 'Magenta', hex: '#FF00FF', group: 'Pink' },
  { name: 'Mauve', hex: '#E0B0FF', group: 'Pink' },
  // Oranges
  { name: 'Peach', hex: '#FFCBA4', group: 'Orange' },
  { name: 'Apricot', hex: '#FBCEB1', group: 'Orange' },
  { name: 'Salmon', hex: '#FA8072', group: 'Orange' },
  { name: 'Coral', hex: '#FF7F50', group: 'Orange' },
  { name: 'Orange', hex: '#FFA500', group: 'Orange' },
  { name: 'Burnt Orange', hex: '#CC5500', group: 'Orange' },
  { name: 'Amber', hex: '#FFBF00', group: 'Orange' },
  // Yellows
  { name: 'Light Yellow', hex: '#FFFFE0', group: 'Yellow' },
  { name: 'Lemon', hex: '#FFF44F', group: 'Yellow' },
  { name: 'Yellow', hex: '#FFFF00', group: 'Yellow' },
  { name: 'Golden', hex: '#FFD700', group: 'Yellow' },
  { name: 'Mustard', hex: '#FFDB58', group: 'Yellow' },
  { name: 'Gold', hex: '#CFB53B', group: 'Yellow' },
  // Greens
  { name: 'Mint', hex: '#98FF98', group: 'Green' },
  { name: 'Sage', hex: '#BCB88A', group: 'Green' },
  { name: 'Light Green', hex: '#90EE90', group: 'Green' },
  { name: 'Lime', hex: '#32CD32', group: 'Green' },
  { name: 'Green', hex: '#008000', group: 'Green' },
  { name: 'Olive', hex: '#808000', group: 'Green' },
  { name: 'Emerald', hex: '#50C878', group: 'Green' },
  { name: 'Forest Green', hex: '#228B22', group: 'Green' },
  { name: 'Hunter Green', hex: '#355E3B', group: 'Green' },
  { name: 'Dark Green', hex: '#006400', group: 'Green' },
  { name: 'Teal', hex: '#008080', group: 'Green' },
  { name: 'Turquoise', hex: '#40E0D0', group: 'Green' },
  // Blues
  { name: 'Light Blue', hex: '#ADD8E6', group: 'Blue' },
  { name: 'Sky Blue', hex: '#87CEEB', group: 'Blue' },
  { name: 'Baby Blue', hex: '#89CFF0', group: 'Blue' },
  { name: 'Powder Blue', hex: '#B0E0E6', group: 'Blue' },
  { name: 'Cornflower', hex: '#6495ED', group: 'Blue' },
  { name: 'Blue', hex: '#0000FF', group: 'Blue' },
  { name: 'Royal Blue', hex: '#4169E1', group: 'Blue' },
  { name: 'Cobalt', hex: '#0047AB', group: 'Blue' },
  { name: 'Navy', hex: '#000080', group: 'Blue' },
  { name: 'Denim', hex: '#1560BD', group: 'Blue' },
  { name: 'Slate Blue', hex: '#6A5ACD', group: 'Blue' },
  { name: 'Steel Blue', hex: '#4682B4', group: 'Blue' },
  { name: 'Ice Blue', hex: '#99C5C4', group: 'Blue' },
  // Purples
  { name: 'Lavender', hex: '#E6E6FA', group: 'Purple' },
  { name: 'Lilac', hex: '#C8A2C8', group: 'Purple' },
  { name: 'Periwinkle', hex: '#CCCCFF', group: 'Purple' },
  { name: 'Violet', hex: '#EE82EE', group: 'Purple' },
  { name: 'Purple', hex: '#800080', group: 'Purple' },
  { name: 'Plum', hex: '#DDA0DD', group: 'Purple' },
  { name: 'Eggplant', hex: '#614051', group: 'Purple' },
  { name: 'Indigo', hex: '#4B0082', group: 'Purple' },
  // Metallic
  { name: 'Rose Gold', hex: '#B76E79', group: 'Metallic' },
  { name: 'Bronze', hex: '#CD7F32', group: 'Metallic' },
  { name: 'Copper', hex: '#B87333', group: 'Metallic' },
  { name: 'Gold Metallic', hex: '#D4AF37', group: 'Metallic' },
  { name: 'Silver Metallic', hex: '#AAA9AD', group: 'Metallic' },
  { name: 'Platinum', hex: '#E5E4E2', group: 'Metallic' },
  // Patterns (no swatch)
  { name: 'Multi-colour', hex: 'linear-gradient(135deg,#FF6B6B,#FFD93D,#6BCB77,#4D96FF)', group: 'Pattern' },
  { name: 'Tie-Dye', hex: '#E040FB', group: 'Pattern' },
  { name: 'Stripe', hex: '#607D8B', group: 'Pattern' },
  { name: 'Floral', hex: '#AB47BC', group: 'Pattern' },
  { name: 'Camouflage', hex: '#78866B', group: 'Pattern' },
  { name: 'Animal Print', hex: '#8D6E63', group: 'Pattern' },
  { name: 'Plaid', hex: '#B71C1C', group: 'Pattern' },
  { name: 'Polka Dot', hex: '#F06292', group: 'Pattern' },
];

const GROUPS = [...new Set(COLOUR_CATALOGUE.map((c) => c.group))];

// ── Component ────────────────────────────────────────────────────────────────

interface ColourPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingColours: string[];
  onInsert: (colours: string[]) => void;
}

export function ColourPickerModal({
  open,
  onOpenChange,
  existingColours,
  onInsert,
}: ColourPickerModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COLOUR_CATALOGUE;
    return COLOUR_CATALOGUE.filter(
      (c) => c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    );
  }, [search]);

  const groupedFiltered = useMemo(() => {
    const groups: Record<string, ColourEntry[]> = {};
    for (const entry of filtered) {
      if (!groups[entry.group]) groups[entry.group] = [];
      groups[entry.group]!.push(entry);
    }
    return groups;
  }, [filtered]);

  const visibleGroups = GROUPS.filter((g) => groupedFiltered[g]?.length);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleInsert() {
    const toAdd = [...selected].filter(
      (name) => !existingColours.some((c) => c.toLowerCase() === name.toLowerCase()),
    );
    if (toAdd.length > 0) onInsert(toAdd);
    setSelected(new Set());
    setSearch('');
    onOpenChange(false);
  }

  function handleClose() {
    setSelected(new Set());
    setSearch('');
    onOpenChange(false);
  }

  function isAlreadyAdded(name: string) {
    return existingColours.some((c) => c.toLowerCase() === name.toLowerCase());
  }

  function getSwatchStyle(hex: string): React.CSSProperties {
    if (hex.startsWith('linear-gradient')) {
      return { background: hex };
    }
    return { backgroundColor: hex };
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-mist px-5 py-4">
          <DialogTitle className="font-display text-espresso">
            <Palette className="mr-2 inline-block h-5 w-5 text-terracotta" />
            Select Colours
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="shrink-0 border-b border-mist px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search colours…"
              className="pl-9 font-body"
              autoFocus
            />
          </div>
        </div>

        {/* Colour grid */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {visibleGroups.length === 0 ? (
            <p className="py-8 text-center font-body text-sm text-mist">No colours match your search.</p>
          ) : (
            visibleGroups.map((group) => (
              <div key={group} className="mb-4">
                <p className="mb-2 font-body text-xs font-semibold uppercase tracking-wider text-espresso/50">
                  {group}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(groupedFiltered[group] ?? []).map((colour) => {
                    const alreadyAdded = isAlreadyAdded(colour.name);
                    const isSelected = selected.has(colour.name);
                    return (
                      <button
                        key={colour.name}
                        type="button"
                        onClick={() => !alreadyAdded && toggle(colour.name)}
                        disabled={alreadyAdded}
                        title={colour.name}
                        className={`relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          alreadyAdded
                            ? 'cursor-not-allowed border-mist/30 bg-linen text-mist opacity-60'
                            : isSelected
                              ? 'border-espresso bg-espresso text-pearl'
                              : 'border-mist bg-white text-espresso hover:border-espresso hover:bg-linen'
                        }`}
                      >
                        <span
                          className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-mist/40"
                          style={getSwatchStyle(colour.hex)}
                          aria-hidden="true"
                        />
                        {colour.name}
                        {isSelected && !alreadyAdded && (
                          <Check className="h-3 w-3 shrink-0" />
                        )}
                        {alreadyAdded && (
                          <Check className="h-3 w-3 shrink-0 text-mist" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-mist px-5 py-3">
          <p className="font-body text-sm text-espresso/60">
            {selected.size > 0
              ? `${selected.size} colour${selected.size !== 1 ? 's' : ''} selected`
              : 'Click colours to select'}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleInsert}
              disabled={selected.size === 0}
              className="bg-espresso text-pearl hover:bg-espresso/90"
            >
              Insert {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
